/**
 * Open Graph (OG) Image Generator for Shalom Youth App
 * Resolution: 1200px x 631px (Standard Open Graph 1.91:1 aspect ratio)
 * Generates crisp, retina-ready PNG images server-side using Sharp & SVG compositing.
 */

import sharp from 'sharp';

export interface OgImageOptions {
  pageType: 'home' | 'profile' | 'service' | 'event' | 'sermon' | 'department' | 'news' | 'article' | 'gallery' | 'prayer' | 'football' | 'default';
  title: string;
  subtitle?: string;
  description?: string;
  category?: string;
  dateStr?: string;
  timeStr?: string;
  venueStr?: string;
  speakerStr?: string;
  avatarUrl?: string;
  coverUrl?: string;
  defaultOgImage?: string;
  isFallback?: boolean;
  roleBadge?: string;
  metaDetails?: Array<{ label: string; value: string }>;
  siteUrl?: string;
}

// In-memory cache for generated OG image buffers to ensure lightning fast response times (<5ms)
const ogCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

export function getCachedOgImage(key: string): Buffer | null {
  const cached = ogCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    ogCache.delete(key);
    return null;
  }
  return cached.buffer;
}

export function setCachedOgImage(key: string, buffer: Buffer): void {
  ogCache.set(key, { buffer, timestamp: Date.now() });
}

export function clearOgCache(key?: string): void {
  if (key) {
    ogCache.delete(key);
  } else {
    ogCache.clear();
  }
}

/**
 * Escapes XML/SVG entities
 */
function escapeXml(str: string = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Helper to split text into lines with max width wrapping
 */
function wrapText(text: string, maxCharsPerLine: number = 32, maxLines: number = 3): string[] {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  // Truncate last line with ellipsis if remaining words exist
  if (words.length > 0 && lines.length === maxLines) {
    const totalWordsCount = lines.join(' ').split(/\s+/).length;
    if (totalWordsCount < words.length) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/\.?\s*$/, '...');
    }
  }

  return lines;
}

/**
 * Helper to fetch an external image and convert it to a base64 data URL
 */
async function fetchImageAsBase64(url?: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:image/')) return url;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Process and normalize with sharp
    const resizedBuffer = await sharp(buffer)
      .resize(300, 300, { fit: 'cover' })
      .png()
      .toBuffer();

    return `data:image/png;base64,${resizedBuffer.toString('base64')}`;
  } catch (err) {
    return null;
  }
}

/**
 * Generates an SVG string for 1200 x 631 resolution
 */
export async function generateOgSvg(options: OgImageOptions): Promise<string> {
  const {
    pageType,
    title,
    subtitle = 'Shalom Youth Fellowship - JSAG',
    description,
    category,
    dateStr,
    timeStr,
    venueStr,
    speakerStr,
    avatarUrl,
    coverUrl,
    defaultOgImage,
    isFallback,
    roleBadge,
    metaDetails = [],
    siteUrl = 'jsagyouth.netlify.app'
  } = options;

  const escTitle = escapeXml(title);
  const escSubtitle = escapeXml(subtitle);
  const escCategory = escapeXml(category || pageType.toUpperCase());
  const escSiteUrl = escapeXml(siteUrl.replace(/^https?:\/\//, ''));

  // Pre-fetch avatar and cover image base64 if available
  const avatarBase64 = avatarUrl ? await fetchImageAsBase64(avatarUrl) : null;
  const coverImgUrl = coverUrl || defaultOgImage;
  const coverBase64 = coverImgUrl ? await fetchImageAsBase64(coverImgUrl) : null;

  // Title wrapping (1200px width gives us ~32 chars at 46px font size)
  const titleLines = wrapText(title, 32, 2);
  const escDescription = escapeXml(description ? (description.length > 110 ? description.substring(0, 107) + '...' : description) : '');

  // Theme Colors according to Page Type
  let primaryGradientStart = '#064e3b'; // Emerald 900
  let primaryGradientEnd = '#022c22'; // Emerald 950
  let accentColor = '#f59e0b'; // Amber 500
  let cardBg = 'rgba(15, 23, 42, 0.65)'; // Slate backdrop
  let typeLabel = 'SHALOM YOUTH FELLOWSHIP';

  if (pageType === 'profile') {
    primaryGradientStart = '#0f172a'; // Slate 900
    primaryGradientEnd = '#064e3b'; // Emerald 900
    accentColor = '#38bdf8'; // Sky 400
    typeLabel = 'MEMBER PROFILE CARD';
  } else if (pageType === 'service') {
    primaryGradientStart = '#1e1b4b'; // Indigo 950
    primaryGradientEnd = '#064e3b'; // Emerald 900
    accentColor = '#f43f5e'; // Rose 500
    typeLabel = 'WORSHIP SERVICE SCHEDULE';
  } else if (pageType === 'event') {
    primaryGradientStart = '#312e81'; // Indigo 900
    primaryGradientEnd = '#4c1d95'; // Violet 900
    accentColor = '#fbbf24'; // Amber 400
    typeLabel = 'UPCOMING FELLOWSHIP EVENT';
  } else if (pageType === 'sermon') {
    primaryGradientStart = '#1c1917'; // Stone 900
    primaryGradientEnd = '#064e3b'; // Emerald 900
    accentColor = '#eab308'; // Yellow 500
    typeLabel = 'SERMON & MESSAGE ARCHIVE';
  } else if (pageType === 'department') {
    primaryGradientStart = '#0284c7'; // Sky 600
    primaryGradientEnd = '#0f172a'; // Slate 900
    accentColor = '#38bdf8'; // Sky 400
    typeLabel = 'CHURCH DEPARTMENT';
  } else if (pageType === 'news' || pageType === 'article') {
    primaryGradientStart = '#064e3b'; // Emerald 900
    primaryGradientEnd = '#1e293b'; // Slate 800
    accentColor = '#10b981'; // Emerald 500
    typeLabel = 'NEWS & ANNOUNCEMENT';
  } else if (pageType === 'prayer') {
    primaryGradientStart = '#4c1d95'; // Purple 900
    primaryGradientEnd = '#0f172a'; // Slate 900
    accentColor = '#c084fc'; // Purple 400
    typeLabel = 'PRAYER REQUEST & FELLOWSHIP';
  } else if (pageType === 'football') {
    primaryGradientStart = '#065f46'; // Emerald 800
    primaryGradientEnd = '#022c22'; // Emerald 950
    accentColor = '#22c55e'; // Green 500
    typeLabel = 'SHALOM FOOTBALL LEAGUE';
  }

  // Construct SVG output
  return `
<svg width="1200" height="631" viewBox="0 0 1200 631" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <!-- Main Background Gradient -->
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryGradientStart}" />
      <stop offset="100%" stop-color="${primaryGradientEnd}" />
    </linearGradient>

    <!-- Accent Glow Gradient -->
    <radialGradient id="glow" cx="80%" cy="20%" r="60%">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.25" />
      <stop offset="100%" stop-color="${primaryGradientEnd}" stop-opacity="0" />
    </radialGradient>

    <!-- Gold Accent Line Gradient -->
    <linearGradient id="goldLine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b" />
      <stop offset="50%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>

    <!-- Circular Avatar Clip Path -->
    <clipPath id="avatarClip">
      <circle cx="980" cy="270" r="100" />
    </clipPath>

    <!-- Soft Drop Shadow Filter -->
    <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.45" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="631" fill="url(#bgGradient)" />
  <rect width="1200" height="631" fill="url(#glow)" />

  ${coverBase64 ? `
  <!-- Fallback / Custom Cover Art Overlay -->
  <g opacity="${isFallback ? '0.40' : '0.22'}">
    <image xlink:href="${coverBase64}" x="0" y="0" width="1200" height="631" preserveAspectRatio="xMidYMid slice" />
  </g>
  ` : ''}

  <!-- Decorative Geometry Background Pattern -->
  <g opacity="0.06">
    <circle cx="1100" cy="100" r="300" fill="none" stroke="#ffffff" stroke-width="2" />
    <circle cx="1100" cy="100" r="450" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="8,8" />
    <circle cx="100" cy="550" r="250" fill="none" stroke="#ffffff" stroke-width="2" />
  </g>

  <!-- Top Accent Bar -->
  <rect x="0" y="0" width="1200" height="6" fill="url(#goldLine)" />

  <!-- Main Outer Frame Card -->
  <rect x="50" y="45" width="1100" height="540" rx="24" fill="${cardBg}" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1.5" filter="url(#dropShadow)" />

  <!-- Header Branding Section -->
  <g transform="translate(90, 85)">
    <!-- Church Crest Emblem Badge -->
    <rect x="0" y="0" width="48" height="48" rx="12" fill="#064e3b" stroke="#f59e0b" stroke-width="1.5" />
    <!-- Cross/Dove Graphic inside Crest -->
    <path d="M24 12 v24 M16 20 h16" stroke="#fbbf24" stroke-width="3" stroke-linecap="round" />
    <circle cx="24" cy="24" r="3" fill="#ffffff" />

    <!-- Church Name & Subtitle -->
    <text x="64" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="900" fill="#f59e0b" letter-spacing="2">
      ${typeLabel}
    </text>
    <text x="64" y="41" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="600" fill="#cbd5e1">
      Mizoram Assemblies of God Church • JSAG Aizawl
    </text>
  </g>

  <!-- Category Badge if Present -->
  ${category ? `
  <g transform="translate(90, 160)">
    <rect x="0" y="0" width="${Math.min(escCategory.length * 9 + 28, 280)}" height="26" rx="13" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" stroke-width="1" />
    <text x="14" y="17" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#fbbf24" letter-spacing="1">
      ${escCategory.toUpperCase()}
    </text>
  </g>
  ` : ''}

  <!-- Main Title Area -->
  <g transform="translate(90, ${category ? 220 : 195})">
    ${titleLines.map((line, idx) => `
      <text x="0" y="${idx * 56}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="${titleLines.length === 1 ? '46' : '40'}" font-weight="900" fill="#ffffff" letter-spacing="-0.5">
        ${escapeXml(line)}
      </text>
    `).join('')}

    ${escDescription ? `
      <text x="0" y="${titleLines.length * 56 + 20}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="500" fill="#94a3b8" width="720">
        ${escDescription}
      </text>
    ` : ''}
  </g>

  <!-- User Avatar / Profile Image Graphic (If profile or image available) -->
  ${avatarBase64 ? `
  <g filter="url(#dropShadow)">
    <circle cx="980" cy="270" r="106" fill="url(#goldLine)" />
    <circle cx="980" cy="270" r="102" fill="#0f172a" />
    <image xlink:href="${avatarBase64}" x="880" y="170" width="200" height="200" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice" />
  </g>
  ` : `
  <!-- Graphic Placeholder Crest / Event Emblem -->
  <g transform="translate(870, 170)" opacity="0.85" filter="url(#dropShadow)">
    <rect x="0" y="0" width="180" height="180" rx="36" fill="rgba(255, 255, 255, 0.05)" stroke="rgba(245, 158, 11, 0.4)" stroke-width="2" />
    <circle cx="90" cy="90" r="60" fill="rgba(245, 158, 11, 0.1)" />
    <path d="M90 50 v80 M50 90 h80" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" />
    <circle cx="90" cy="90" r="12" fill="#ffffff" />
  </g>
  `}

  <!-- Role Badge / Subtitle Pill under Avatar -->
  ${roleBadge ? `
  <g transform="translate(860, 395)">
    <rect x="0" y="0" width="240" height="32" rx="16" fill="#064e3b" stroke="#10b981" stroke-width="1.5" />
    <text x="120" y="20" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#34d399" text-anchor="middle" letter-spacing="0.5">
      ${escapeXml(roleBadge)}
    </text>
  </g>
  ` : ''}

  <!-- Metadata Details Grid (Date, Time, Speaker, Venue) -->
  <g transform="translate(90, 425)">
    ${dateStr ? `
    <g transform="translate(0, 0)">
      <rect x="0" y="0" width="180" height="42" rx="10" fill="rgba(255, 255, 255, 0.06)" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1" />
      <text x="14" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="800" fill="#94a3b8" letter-spacing="1">DATE</text>
      <text x="14" y="33" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#ffffff">${escapeXml(dateStr)}</text>
    </g>
    ` : ''}

    ${timeStr ? `
    <g transform="translate(195, 0)">
      <rect x="0" y="0" width="160" height="42" rx="10" fill="rgba(255, 255, 255, 0.06)" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1" />
      <text x="14" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="800" fill="#94a3b8" letter-spacing="1">TIME</text>
      <text x="14" y="33" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#ffffff">${escapeXml(timeStr)}</text>
    </g>
    ` : ''}

    ${venueStr ? `
    <g transform="translate(${dateStr && timeStr ? 370 : (dateStr ? 195 : 0)}, 0)">
      <rect x="0" y="0" width="220" height="42" rx="10" fill="rgba(255, 255, 255, 0.06)" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1" />
      <text x="14" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="800" fill="#94a3b8" letter-spacing="1">LOCATION / VENUE</text>
      <text x="14" y="33" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#ffffff">${escapeXml(venueStr)}</text>
    </g>
    ` : ''}

    ${speakerStr ? `
    <g transform="translate(0, ${dateStr || timeStr || venueStr ? 50 : 0})">
      <rect x="0" y="0" width="350" height="42" rx="10" fill="rgba(245, 158, 11, 0.1)" stroke="#f59e0b" stroke-width="1" />
      <text x="14" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="800" fill="#fbbf24" letter-spacing="1">SPEAKER / MINISTER</text>
      <text x="14" y="33" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#ffffff">${escapeXml(speakerStr)}</text>
    </g>
    ` : ''}
  </g>

  <!-- Footer Bar Section -->
  <g transform="translate(90, 535)">
    <!-- Dividing Line -->
    <line x1="0" y1="0" x2="1020" y2="0" stroke="rgba(255, 255, 255, 0.15)" stroke-width="1" />

    <!-- Left Footer Slogan -->
    <text x="0" y="28" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#64748b">
      Connecting Youth • Empowering Faith • Celebrating Fellowship
    </text>

    <!-- Right Footer Domain Badge -->
    <g transform="translate(850, 10)">
      <rect x="0" y="0" width="170" height="26" rx="6" fill="#064e3b" stroke="#10b981" stroke-width="1" />
      <text x="85" y="17" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">
        🌐 ${escSiteUrl}
      </text>
    </g>
  </g>
</svg>
`;
}

/**
 * Renders an Open Graph PNG Buffer (1200 x 631 px) from SVG options
 */
export async function generateOgImagePng(options: OgImageOptions): Promise<Buffer> {
  const cacheKey = JSON.stringify({
    pageType: options.pageType,
    title: options.title,
    subtitle: options.subtitle,
    avatarUrl: options.avatarUrl,
    dateStr: options.dateStr,
    speakerStr: options.speakerStr,
    venueStr: options.venueStr,
    category: options.category,
    roleBadge: options.roleBadge
  });

  const cached = getCachedOgImage(cacheKey);
  if (cached) {
    return cached;
  }

  const svgString = await generateOgSvg(options);
  const pngBuffer = await sharp(Buffer.from(svgString))
    .resize(1200, 631)
    .png({ quality: 95, compressionLevel: 8 })
    .toBuffer();

  setCachedOgImage(cacheKey, pngBuffer);
  return pngBuffer;
}

export const generateOgImage = generateOgImagePng;

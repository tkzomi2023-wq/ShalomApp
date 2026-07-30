/**
 * Client-side SEO & Open Graph Meta Synchronizer
 * Dynamically updates document.title and head meta tags during client SPA navigation.
 */

export interface UpdateSeoOptions {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogType?: string;
  ogImage?: string;
}

export function updateClientHeadMeta(options: UpdateSeoOptions) {
  if (typeof document === 'undefined') return;

  const {
    title = 'Shalom Youth Fellowship | JSAG Aizawl',
    description = 'Connecting youth, empowering faith, and celebrating fellowship at Shalom Youth Fellowship (Assembly of God Church, JSAG Aizawl).',
    canonicalUrl = window.location.href,
    ogType = 'website',
    ogImage
  } = options;

  // 1. Update Document Title
  document.title = title;

  // Helper to set or create meta element
  const setMeta = (selector: string, attrName: string, attrVal: string, content: string) => {
    let el = document.head.querySelector(selector) as HTMLMetaElement;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrVal);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  // Helper to set or create link element
  const setLink = (relVal: string, hrefVal: string) => {
    let el = document.head.querySelector(`link[rel="${relVal}"]`) as HTMLLinkElement;
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', relVal);
      document.head.appendChild(el);
    }
    el.setAttribute('href', hrefVal);
  };

  // Determine site URL and default OG Image
  const origin = window.location.origin;
  const path = window.location.pathname;
  const currentOgImage = ogImage || `${origin}/api/og${path === '/' ? '' : path}`;

  // Update Standard Meta
  setMeta('meta[name="description"]', 'name', 'description', description);
  setLink('canonical', canonicalUrl);

  // Update Open Graph Tags
  setMeta('meta[property="og:type"]', 'property', 'og:type', ogType);
  setMeta('meta[property="og:title"]', 'property', 'og:title', title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', description);
  setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  setMeta('meta[property="og:image"]', 'property', 'og:image', currentOgImage);
  setMeta('meta[property="og:image:secure_url"]', 'property', 'og:image:secure_url', currentOgImage);
  setMeta('meta[property="og:image:width"]', 'property', 'og:image:width', '1200');
  setMeta('meta[property="og:image:height"]', 'property', 'og:image:height', '631');
  setMeta('meta[property="og:image:type"]', 'property', 'og:image:type', 'image/png');
  setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', 'Shalom Youth Fellowship - JSAG');

  // Update Twitter Cards
  setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', currentOgImage);
  setMeta('meta[name="twitter:image:alt"]', 'name', 'twitter:image:alt', title);
}

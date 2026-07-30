import React, { useState, useEffect } from 'react';
import { Globe, Save, RefreshCw, Eye, Sparkles, Check, AlertCircle, Link as LinkIcon, Image as ImageIcon, Upload } from 'lucide-react';
import { supabase, db } from '../lib/supabase';

interface MetaConfig {
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
  defaultOgImage?: string;
  favicon: string;
  siteUrl: string;
  isFootballEnabled?: boolean;
  isPrayerRequestsEnabled?: boolean;
  isCallingEnabled?: boolean;
}

interface WebsiteMetaSettingsPageProps {
  currentUser: any;
}

import { getApiUrl, apiFetch, safeJsonParse } from '../lib/api';

const isNetlify = typeof window !== 'undefined' && (
  window.location.hostname.includes('netlify') ||
  window.location.hostname.includes('static') ||
  window.location.hostname.includes('github.io') ||
  (window.location.hostname.endsWith('.app') && !window.location.hostname.includes('run.app') && !window.location.hostname.includes('google'))
);

const PRESET_DEFAULT_OG_IMAGES = [
  {
    id: 'emerald-shield',
    name: 'Emerald Shield Banner',
    url: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=1200&auto=format&fit=crop',
    desc: 'Classic Shalom Emerald & Gold Crest'
  },
  {
    id: 'worship-sanctuary',
    name: 'Sanctuary Worship Night',
    url: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=1200&auto=format&fit=crop',
    desc: 'Praise & Worship Gathering'
  },
  {
    id: 'youth-fellowship',
    name: 'Youth Bible Study',
    url: 'https://images.unsplash.com/photo-1511649475669-e288648b2339?q=80&w=1200&auto=format&fit=crop',
    desc: 'Fellowship & Scripture Study'
  },
  {
    id: 'football-league',
    name: 'Shalom League Banner',
    url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop',
    desc: 'Sports & Football Fellowship'
  },
  {
    id: 'dynamic-engine',
    name: 'Dynamic OG Engine',
    url: '/api/og',
    desc: 'Server-Rendered 1200x631 Canvas'
  }
];

export const toFullUrl = (url?: string, siteUrl?: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  let base = siteUrl?.trim() || '';
  if (!base && typeof window !== 'undefined') {
    base = window.location.origin;
  }
  if (base && !base.startsWith('http://') && !base.startsWith('https://')) {
    base = `https://${base}`;
  }
  base = base.replace(/\/+$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return base ? `${base}${cleanPath}` : (typeof window !== 'undefined' ? `${window.location.origin}${cleanPath}` : cleanPath);
};

export const WebsiteMetaSettingsPage: React.FC<WebsiteMetaSettingsPageProps> = ({ currentUser }) => {
  const [config, setConfig] = useState<MetaConfig>({
    title: '',
    description: '',
    keywords: '',
    ogImage: '',
    defaultOgImage: '',
    favicon: '',
    siteUrl: ''
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isFallbackMode, setIsFallbackMode] = useState<boolean>(false);

  // Upload States
  const [isOgUploading, setIsOgUploading] = useState<boolean>(false);
  const [ogUploadProgress, setOgUploadProgress] = useState<number>(0);
  const [ogUploadError, setOgUploadError] = useState<string | null>(null);

  const [isDefaultOgUploading, setIsDefaultOgUploading] = useState<boolean>(false);
  const [defaultOgUploadProgress, setDefaultOgUploadProgress] = useState<number>(0);
  const [defaultOgUploadError, setDefaultOgUploadError] = useState<string | null>(null);

  const [isFaviconUploading, setIsFaviconUploading] = useState<boolean>(false);
  const [faviconUploadProgress, setFaviconUploadProgress] = useState<number>(0);
  const [faviconUploadError, setFaviconUploadError] = useState<string | null>(null);

  const handleOgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOgUploading(true);
    setOgUploadError(null);
    setOgUploadProgress(10);

    const progressInterval = setInterval(() => {
      setOgUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 15;
      });
    }, 120);

    try {
      const filePath = `meta/og-image.png`;
      const imageUrl = await db.uploadToStorage('thumbnails', filePath, file);
      const freshImageUrl = `${imageUrl.split('?')[0]}?v=${Date.now()}`;
      const fullOg = toFullUrl(freshImageUrl, config.siteUrl);
      
      clearInterval(progressInterval);
      setOgUploadProgress(100);
      setConfig(prev => ({ ...prev, ogImage: fullOg }));
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error('Error uploading custom OG image:', err);
      setOgUploadError(`Upload Failed: ${err.message || 'Check connection.'}`);
    } finally {
      setIsOgUploading(false);
      setTimeout(() => setOgUploadProgress(0), 800);
    }
  };

  const handleDefaultOgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsDefaultOgUploading(true);
    setDefaultOgUploadError(null);
    setDefaultOgUploadProgress(10);

    const progressInterval = setInterval(() => {
      setDefaultOgUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 15;
      });
    }, 120);

    try {
      const filePath = `meta/default-og-image.png`;
      const imageUrl = await db.uploadToStorage('thumbnails', filePath, file);
      const freshImageUrl = `${imageUrl.split('?')[0]}?v=${Date.now()}`;
      const fullDefaultOg = toFullUrl(freshImageUrl, config.siteUrl);
      
      clearInterval(progressInterval);
      setDefaultOgUploadProgress(100);
      setConfig(prev => ({ ...prev, defaultOgImage: fullDefaultOg }));
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error('Error uploading custom Default OG fallback image:', err);
      setDefaultOgUploadError(`Upload Failed: ${err.message || 'Check connection.'}`);
    } finally {
      setIsDefaultOgUploading(false);
      setTimeout(() => setDefaultOgUploadProgress(0), 800);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFaviconUploading(true);
    setFaviconUploadError(null);
    setFaviconUploadProgress(10);

    const progressInterval = setInterval(() => {
      setFaviconUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 15;
      });
    }, 120);

    try {
      const filePath = `meta/favicon.png`;
      const imageUrl = await db.uploadToStorage('thumbnails', filePath, file);
      const freshFaviconUrl = `${imageUrl.split('?')[0]}?v=${Date.now()}`;
      const fullFavicon = toFullUrl(freshFaviconUrl, config.siteUrl);
      
      clearInterval(progressInterval);
      setFaviconUploadProgress(100);
      setConfig(prev => ({ ...prev, favicon: fullFavicon }));
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error('Error uploading custom favicon:', err);
      setFaviconUploadError(`Upload Failed: ${err.message || 'Check connection.'}`);
    } finally {
      setIsFaviconUploading(false);
      setTimeout(() => setFaviconUploadProgress(0), 800);
    }
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/meta-config');
      if (response.ok) {
        const data = await safeJsonParse(response);
        const resolvedSiteUrl = data.siteUrl || (typeof window !== 'undefined' ? window.location.origin : '');
        const resolvedOgImage = toFullUrl(data.ogImage, resolvedSiteUrl);
        const resolvedDefaultOgImage = toFullUrl(data.defaultOgImage || data.default_og_image, resolvedSiteUrl);
        const resolvedFavicon = toFullUrl(data.favicon, resolvedSiteUrl);
        
        setConfig({
          title: data.title || '',
          description: data.description || '',
          keywords: data.keywords || '',
          ogImage: resolvedOgImage,
          defaultOgImage: resolvedDefaultOgImage,
          favicon: resolvedFavicon,
          siteUrl: resolvedSiteUrl
        });
        setIsFallbackMode(false);
        // Sync local cache
        localStorage.setItem('sy_local_meta_config', JSON.stringify({
          ...data,
          ogImage: resolvedOgImage,
          defaultOgImage: resolvedDefaultOgImage,
          favicon: resolvedFavicon,
          siteUrl: resolvedSiteUrl
        }));
      } else {
        throw new Error(`Server returned error status ${response.status}`);
      }
    } catch (err) {
      console.warn('Backend API `/api/meta-config` is not available. Switching to Client-Side Fallback Mode:', err);
      setIsFallbackMode(true);
      try {
        const cached = localStorage.getItem('sy_local_meta_config');
        if (cached) {
          const data = JSON.parse(cached);
          const resolvedSiteUrl = data.siteUrl || (typeof window !== 'undefined' ? window.location.origin : '');
          setConfig({
            title: data.title || '',
            description: data.description || '',
            keywords: data.keywords || '',
            ogImage: toFullUrl(data.ogImage, resolvedSiteUrl),
            defaultOgImage: toFullUrl(data.defaultOgImage || data.default_og_image, resolvedSiteUrl),
            favicon: toFullUrl(data.favicon, resolvedSiteUrl),
            siteUrl: resolvedSiteUrl
          });
        }
      } catch (e) {
        console.error('Failed to parse cached local config:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    let cleanSiteUrl = config.siteUrl.trim();
    if (cleanSiteUrl && !cleanSiteUrl.startsWith('http://') && !cleanSiteUrl.startsWith('https://')) {
      cleanSiteUrl = `https://${cleanSiteUrl}`;
    }
    if (!cleanSiteUrl && typeof window !== 'undefined') {
      cleanSiteUrl = window.location.origin;
    }

    const fullOgImage = toFullUrl(config.ogImage, cleanSiteUrl);
    const fullDefaultOgImage = toFullUrl(config.defaultOgImage, cleanSiteUrl);
    const fullFavicon = toFullUrl(config.favicon, cleanSiteUrl);

    const normConfig: MetaConfig = {
      title: config.title.trim(),
      description: config.description.trim(),
      keywords: config.keywords.trim(),
      ogImage: fullOgImage,
      defaultOgImage: fullDefaultOgImage,
      favicon: fullFavicon,
      siteUrl: cleanSiteUrl
    };

    setConfig(normConfig);

    const updateClientSideInstant = () => {
      if (normConfig.title) {
        document.title = normConfig.title;
      }
      
      const setMetaTag = (selector: string, attrName: string, attrVal: string, contentVal: string) => {
        if (!contentVal) return;
        let el = document.querySelector(selector);
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute(attrName, attrVal);
          document.head.appendChild(el);
        }
        el.setAttribute('content', contentVal);
      };

      setMetaTag('meta[name="description"]', 'name', 'description', normConfig.description);
      setMetaTag('meta[name="keywords"]', 'name', 'keywords', normConfig.keywords);
      
      setMetaTag('meta[property="og:title"]', 'property', 'og:title', normConfig.title);
      setMetaTag('meta[property="og:description"]', 'property', 'og:description', normConfig.description);
      setMetaTag('meta[property="og:image"]', 'property', 'og:image', normConfig.ogImage);
      setMetaTag('meta[property="og:image:secure_url"]', 'property', 'og:image:secure_url', normConfig.ogImage);
      setMetaTag('meta[property="og:url"]', 'property', 'og:url', normConfig.siteUrl);

      setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', normConfig.title);
      setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', normConfig.description);
      setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', normConfig.ogImage);
      setMetaTag('meta[name="twitter:url"]', 'name', 'twitter:url', normConfig.siteUrl);

      if (normConfig.siteUrl) {
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
          canonical = document.createElement('link');
          canonical.setAttribute('rel', 'canonical');
          document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', normConfig.siteUrl);
      }

      if (normConfig.favicon) {
        let faviconLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
        if (faviconLinks.length === 0) {
          const newFav = document.createElement('link');
          newFav.setAttribute('rel', 'icon');
          document.head.appendChild(newFav);
          faviconLinks = document.querySelectorAll('link[rel="icon"]');
        }
        faviconLinks.forEach(link => {
          link.setAttribute('href', normConfig.favicon);
        });
      }

      try {
        window.dispatchEvent(new CustomEvent('meta_config_updated', { detail: normConfig }));
      } catch (e) {}
    };

    // Attempt direct database write to Supabase first for absolute high-fidelity persistence
    let dbSyncSuccess = false;
    try {
      const { error: dbError } = await supabase
        .from('meta_configs')
        .upsert({
          id: 'singleton',
          title: normConfig.title,
          description: normConfig.description,
          keywords: normConfig.keywords,
          og_image: normConfig.ogImage,
          default_og_image: normConfig.defaultOgImage,
          favicon: normConfig.favicon,
          site_url: normConfig.siteUrl,
          is_football_enabled: normConfig.isFootballEnabled,
          is_prayer_requests_enabled: normConfig.isPrayerRequestsEnabled,
          is_calling_enabled: normConfig.isCallingEnabled,
          updated_at: new Date().toISOString()
        });
      
      if (!dbError) {
        dbSyncSuccess = true;
      } else {
        console.warn('[WebsiteMeta] Direct Supabase upsert returned error:', dbError.message);
      }
    } catch (dbErr: any) {
      console.warn('[WebsiteMeta] Direct Supabase upsert exception:', dbErr.message || dbErr);
    }

    if (isFallbackMode) {
      // Direct LocalStorage fallback mode saving
      try {
        localStorage.setItem('sy_local_meta_config', JSON.stringify(normConfig));
        updateClientSideInstant();
        setFeedback({ 
          type: 'success', 
          message: dbSyncSuccess 
            ? 'Website meta details and full OG Image URL saved to browser cache and synced directly with Supabase database!'
            : 'Website meta details successfully saved locally! (Fallback Mode Active due to static hosting)' 
        });
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Failed to save settings locally.' });
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      const response = await apiFetch('/api/meta-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requesterEmail: currentUser?.email,
          ...normConfig
        })
      });

      if (response.ok) {
        const successData = await safeJsonParse(response);
        setFeedback({ 
          type: 'success', 
          message: dbSyncSuccess
            ? 'Website meta details and full OG Image URL successfully saved and synchronized across all files & database!'
            : (successData.message || 'Website meta details and OG image settings successfully saved!')
        });
        updateClientSideInstant();
        localStorage.setItem('sy_local_meta_config', JSON.stringify(normConfig));
      } else {
        // If API fails but direct DB write succeeded, we can still report success!
        if (dbSyncSuccess) {
          setFeedback({
            type: 'success',
            message: 'Website meta details successfully saved and updated directly in the Supabase database!'
          });
          updateClientSideInstant();
          localStorage.setItem('sy_local_meta_config', JSON.stringify(normConfig));
        } else {
          const errData = await safeJsonParse(response);
          setFeedback({ type: 'error', message: errData.error || 'Failed to save settings' });
        }
      }
    } catch (err: any) {
      console.warn('Network error while saving settings via API, falling back to LocalStorage & direct DB:', err);
      // Fallback
      try {
        localStorage.setItem('sy_local_meta_config', JSON.stringify(normConfig));
        updateClientSideInstant();
        setIsFallbackMode(true);
        setFeedback({ 
          type: 'success', 
          message: dbSyncSuccess
            ? 'Website meta details saved successfully to browser cache and direct Supabase database!'
            : 'Website meta details saved successfully to browser cache. (Switched to Fallback Mode)' 
        });
      } catch (e: any) {
        setFeedback({ type: 'error', message: `An error occurred: ${err.message || err}` });
      }
    } finally {
      setSaving(false);
    }
  };

  if (currentUser?.email?.toLowerCase() !== 'tkpaite2016@gmail.com') {
    return (
      <div className="bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 p-6 rounded-2xl border border-red-100 dark:border-red-900/40 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <div>
          <h4 className="font-bold">Access Denied</h4>
          <p className="text-xs">Only tkpaite2016@gmail.com is authorized to access and modify the website meta details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-150 dark:border-stone-850 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-2xl border border-purple-100 dark:border-purple-900/40 shadow-xs">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-stone-900 dark:text-white">Website Meta & OG Details</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">Configure global SEO, titles, descriptions, keywords, and share preview images</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('sy_open_og_inspector'))}
            className="p-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            Inspect OG Image &amp; Tags
          </button>
          <button
            onClick={fetchConfig}
            disabled={loading}
            className="p-2 px-4 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 transition-all flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Reload Settings
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-semibold shadow-xs ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/40' 
            : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-100 dark:border-red-900/40'
        }`}>
          {feedback.type === 'success' ? <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-stone-900 p-12 rounded-2xl border border-stone-150 dark:border-stone-850 shadow-xs flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
          <p className="text-xs font-bold text-stone-500 dark:text-stone-400">Retrieving meta details...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Settings Form - Left Column */}
          <div className="lg:col-span-7 bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-150 dark:border-stone-850 shadow-xs space-y-6">
            <div className="flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
              <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
              <h3 className="font-black text-stone-900 dark:text-white text-sm">Configure SEO Meta Parameters</h3>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600 dark:text-stone-300 block">Website Title</label>
                <input
                  type="text"
                  required
                  value={config.title}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  placeholder="e.g. Shalom Youth Fellowship - MZP"
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50 dark:bg-stone-950/50 text-stone-900 dark:text-stone-100"
                />
                <p className="text-[10px] text-stone-400 dark:text-stone-500">Used as the browser tab title and the primary title on search engine results. Recommended: under 60 characters.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600 dark:text-stone-300 block">Meta Description</label>
                <textarea
                  required
                  rows={3}
                  value={config.description}
                  onChange={(e) => setConfig({ ...config, description: e.target.value })}
                  placeholder="Describe your youth fellowship page..."
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50 dark:bg-stone-950/50 text-stone-900 dark:text-stone-100 resize-none animate-none"
                />
                <p className="text-[10px] text-stone-400 dark:text-stone-500">A clear, short summary of what the page is about. Used by Google and chat applications for link descriptions. Recommended: under 160 characters.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600 dark:text-stone-300 block">Meta Keywords</label>
                <input
                  type="text"
                  value={config.keywords}
                  onChange={(e) => setConfig({ ...config, keywords: e.target.value })}
                  placeholder="e.g. Shalom Youth, MZP, Fellowship, Mizo Presbyterian"
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50 dark:bg-stone-950/50 text-stone-900 dark:text-stone-100"
                />
                <p className="text-[10px] text-stone-400 dark:text-stone-500">Comma-separated list of keywords relevant to your website.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600 dark:text-stone-300 block">Open Graph (OG) Image URL</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={config.ogImage}
                      onChange={(e) => setConfig({ ...config, ogImage: e.target.value })}
                      placeholder="e.g. /og-image.png or https://..."
                      className="w-full text-xs p-3 pl-9 rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50 dark:bg-stone-950/50 text-stone-900 dark:text-stone-100"
                    />
                    <ImageIcon className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3 top-3.5" />
                  </div>
                </div>
                
                {/* File Upload zone for OG Image */}
                <div className="mt-2 py-1 flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="relative flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-xl border border-purple-200 dark:border-purple-800/60 cursor-pointer transition-all self-start">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isOgUploading ? `Uploading (${ogUploadProgress}%)` : 'Upload Custom OG Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isOgUploading}
                      onChange={handleOgImageUpload}
                      className="hidden"
                    />
                  </label>
                  {isOgUploading && (
                    <div className="w-24 bg-stone-100 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-purple-600 dark:bg-purple-500 h-full transition-all" style={{ width: `${ogUploadProgress}%` }}></div>
                    </div>
                  )}
                  {ogUploadError && (
                    <p className="text-[10px] text-red-650 dark:text-rose-400 font-bold">{ogUploadError}</p>
                  )}
                </div>
                
                <p className="text-[10px] text-stone-400 dark:text-stone-500">Direct URL to an image shown when the website is shared on social networks (WhatsApp, Facebook, Discord). Optimal size: 1200 x 630 pixels.</p>
                {config.ogImage && (
                  <div className="mt-1 p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-[10px] font-mono text-emerald-800 dark:text-emerald-300 break-all flex items-center gap-1.5">
                    <span className="font-bold shrink-0">Resolved Full Link:</span>
                    <span>{toFullUrl(config.ogImage, config.siteUrl)}</span>
                  </div>
                )}
              </div>

              {/* Default OG Image Fallback Section (1200x631) */}
              <div className="space-y-3 p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <label className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                      Default Fallback OG Image (1200 × 631)
                    </label>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100">
                    1200 × 631 px
                  </span>
                </div>

                <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
                  Select or upload a default fallback image (1200x631). The <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded text-[10px]">generateOgImage</code> function will automatically use this fallback image whenever database data for a page (missing member profile, unknown event, etc.) is missing or incomplete.
                </p>

                {/* Preset Image Options */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                    Quick Preset Fallback Templates:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PRESET_DEFAULT_OG_IMAGES.map((preset) => {
                      const fullPresetUrl = toFullUrl(preset.url, config.siteUrl);
                      const isSelected = (config.defaultOgImage || config.ogImage) === fullPresetUrl || config.defaultOgImage === preset.url;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setConfig(prev => ({ ...prev, defaultOgImage: fullPresetUrl }))}
                          className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-20 relative overflow-hidden group ${
                            isSelected
                              ? 'border-purple-600 dark:border-purple-500 bg-purple-50 dark:bg-purple-950/60 ring-2 ring-purple-500/30'
                              : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-purple-300 dark:hover:border-purple-700'
                          }`}
                        >
                          {preset.url !== '/api/og' ? (
                            <img src={preset.url} alt={preset.name} className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/20 to-purple-900/20" />
                          )}
                          <div className="relative z-10 flex items-center justify-between w-full">
                            <span className="text-[11px] font-black text-stone-900 dark:text-white truncate">{preset.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />}
                          </div>
                          <span className="relative z-10 text-[9px] text-stone-500 dark:text-stone-400 truncate">{preset.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* URL Input & Upload Row */}
                <div className="space-y-2 pt-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={config.defaultOgImage || ''}
                      onChange={(e) => setConfig({ ...config, defaultOgImage: e.target.value })}
                      placeholder="e.g. https://... or /og-image.png (Fallback 1200x631)"
                      className="w-full text-xs p-3 pl-9 rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-white dark:bg-stone-950/50 text-stone-900 dark:text-stone-100"
                    />
                    <ImageIcon className="w-4 h-4 text-amber-500 dark:text-amber-400 absolute left-3 top-3.5" />
                  </div>

                  {/* File Upload zone for Default OG Fallback Image */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="relative flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all self-start">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isDefaultOgUploading ? `Uploading (${defaultOgUploadProgress}%)` : 'Upload Custom Fallback Image (1200x631)'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isDefaultOgUploading}
                        onChange={handleDefaultOgImageUpload}
                        className="hidden"
                      />
                    </label>
                    {isDefaultOgUploading && (
                      <div className="w-24 bg-stone-100 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-amber-600 dark:bg-amber-500 h-full transition-all" style={{ width: `${defaultOgUploadProgress}%` }}></div>
                      </div>
                    )}
                    {defaultOgUploadError && (
                      <p className="text-[10px] text-red-650 dark:text-rose-400 font-bold">{defaultOgUploadError}</p>
                    )}
                  </div>

                  {config.defaultOgImage && (
                    <div className="p-2 bg-amber-100/60 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/80 rounded-lg text-[10px] font-mono text-amber-900 dark:text-amber-200 break-all flex items-center gap-1.5">
                      <span className="font-bold shrink-0">Resolved Fallback Link:</span>
                      <span>{toFullUrl(config.defaultOgImage, config.siteUrl)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600 dark:text-stone-300 block">Favicon URL (Browser Tab Icon)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={config.favicon}
                      onChange={(e) => setConfig({ ...config, favicon: e.target.value })}
                      placeholder="e.g. /favicon.ico or https://..."
                      className="w-full text-xs p-3 pl-9 rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50 dark:bg-stone-950/50 text-stone-900 dark:text-stone-100"
                    />
                    <Sparkles className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3 top-3.5" />
                  </div>
                </div>

                {/* File Upload zone for Favicon */}
                <div className="mt-2 py-1 flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="relative flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-xl border border-purple-200 dark:border-purple-800/60 cursor-pointer transition-all self-start">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isFaviconUploading ? `Uploading (${faviconUploadProgress}%)` : 'Upload Custom Favicon'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isFaviconUploading}
                      onChange={handleFaviconUpload}
                      className="hidden"
                    />
                  </label>
                  {isFaviconUploading && (
                    <div className="w-24 bg-stone-100 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-purple-600 dark:bg-purple-500 h-full transition-all" style={{ width: `${faviconUploadProgress}%` }}></div>
                    </div>
                  )}
                  {faviconUploadError && (
                    <p className="text-[10px] text-red-650 dark:text-rose-400 font-bold">{faviconUploadError}</p>
                  )}
                </div>

                <p className="text-[10px] text-stone-400 dark:text-stone-500">The shortcut icon displayed in browser tabs. You can use standard local path `/favicon.ico` or any external image URL.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600 dark:text-stone-300 block">Website Domain / URL</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={config.siteUrl}
                      onChange={(e) => setConfig({ ...config, siteUrl: e.target.value })}
                      placeholder={`e.g. ${typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}`}
                      className="w-full text-xs p-3 pl-9 rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50 dark:bg-stone-950/50 text-stone-900 dark:text-stone-100"
                    />
                    <LinkIcon className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3 top-3.5" />
                  </div>
                </div>
                <p className="text-[10px] text-stone-400 dark:text-stone-500">The canonical address or public domain of this application, used for metadata schemas and search engines.</p>
              </div>

              <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Meta Configurations'}
                </button>
              </div>
            </form>
          </div>

          {/* Social Live Preview - Right Column */}
          <div className="lg:col-span-5 space-y-6">
            {/* Default OG Fallback Preview Card (1200x631) */}
            <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-150 dark:border-stone-850 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <h4 className="font-extrabold text-stone-800 dark:text-stone-200 text-xs uppercase tracking-wide">
                    Default Fallback OG Card (1200 × 631)
                  </h4>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  Auto-Fallback Active
                </span>
              </div>

              <div className="relative rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-stone-900 aspect-[1200/631] flex items-center justify-center group">
                {(config.defaultOgImage || config.ogImage) ? (
                  <img
                    src={config.defaultOgImage || config.ogImage}
                    alt="Default OG Fallback Preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-center p-4 space-y-1">
                    <ImageIcon className="w-8 h-8 text-stone-500 mx-auto" />
                    <p className="text-xs text-stone-400 font-bold">No Fallback Image Configured</p>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/20 to-transparent flex flex-col justify-end p-3 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black drop-shadow-sm">generateOgImage Fallback Banner</p>
                      <p className="text-[10px] text-amber-300 font-medium">Used when database data for a page is missing/incomplete</p>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-1 rounded bg-black/60 border border-white/20">
                      1200 × 631 px
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* WhatsApp / Chat App Link Preview */}
            <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-150 dark:border-stone-850 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 pb-2.5">
                <Eye className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                <h4 className="font-extrabold text-stone-800 dark:text-stone-200 text-xs uppercase tracking-wide">WhatsApp / Messenger Preview</h4>
              </div>

              <div className="bg-[#e5ddd5] dark:bg-stone-950/80 p-4 rounded-xl space-y-2">
                <div className="bg-white dark:bg-stone-900 rounded-xl overflow-hidden shadow-xs border border-stone-150 dark:border-stone-800 max-w-xs ml-auto">
                  {config.ogImage ? (
                    <img src={config.ogImage} alt="OG Share Preview" className="w-full h-40 object-cover border-b border-stone-100 dark:border-stone-800" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-40 bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 dark:text-stone-500">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                  <div className="p-3 space-y-1 bg-[#f0f2f5] dark:bg-stone-850">
                    <div className="text-xs font-bold text-stone-800 dark:text-stone-100 truncate">{config.title || 'Shalom Youth Fellowship - MZP'}</div>
                    <div className="text-[10px] text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">{config.description || 'Describe your youth fellowship page...'}</div>
                    <div className="text-[9px] text-stone-400 dark:text-stone-500 uppercase tracking-wider truncate">{config.siteUrl ? config.siteUrl.replace(/^https?:\/\//i, '') : (typeof window !== 'undefined' ? window.location.host : 'shalomyouth.app')}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Google Search Result Preview */}
            <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-150 dark:border-stone-850 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 pb-2.5">
                <Globe className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                <h4 className="font-extrabold text-stone-800 dark:text-stone-200 text-xs uppercase tracking-wide">Google Search Snippet</h4>
              </div>

              <div className="p-4 bg-stone-50 dark:bg-stone-950/50 rounded-xl space-y-1 border border-stone-200/60 dark:border-stone-800">
                <div className="text-xs text-stone-500 dark:text-stone-400 truncate">{config.siteUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://shalomyouth.app')}</div>
                <div className="text-base font-medium text-[#1a0dab] dark:text-[#8ab4f8] hover:underline cursor-pointer leading-tight line-clamp-1">{config.title || 'Shalom Youth Fellowship - MZP'}</div>
                <div className="text-xs text-[#4d5156] dark:text-[#bdc1c6] line-clamp-2 leading-relaxed">{config.description || 'Describe your youth fellowship page...'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

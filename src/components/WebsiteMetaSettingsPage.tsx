import React, { useState, useEffect } from 'react';
import { Globe, Save, RefreshCw, Eye, Sparkles, Check, AlertCircle, Link as LinkIcon, Image as ImageIcon, Upload } from 'lucide-react';
import { supabase, db } from '../lib/supabase';

interface MetaConfig {
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
  favicon: string;
  siteUrl: string;
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

export const WebsiteMetaSettingsPage: React.FC<WebsiteMetaSettingsPageProps> = ({ currentUser }) => {
  const [config, setConfig] = useState<MetaConfig>({
    title: '',
    description: '',
    keywords: '',
    ogImage: '',
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
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `meta/og_image_${Date.now()}.${ext}`;
      const imageUrl = await db.uploadToStorage('thumbnails', filePath, file);
      
      clearInterval(progressInterval);
      setOgUploadProgress(100);
      setConfig(prev => ({ ...prev, ogImage: imageUrl }));
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error('Error uploading custom OG image:', err);
      setOgUploadError(`Upload Failed: ${err.message || 'Check connection.'}`);
    } finally {
      setIsOgUploading(false);
      setTimeout(() => setOgUploadProgress(0), 800);
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
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `meta/favicon_${Date.now()}.${ext}`;
      const imageUrl = await db.uploadToStorage('thumbnails', filePath, file);
      
      clearInterval(progressInterval);
      setFaviconUploadProgress(100);
      setConfig(prev => ({ ...prev, favicon: imageUrl }));
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
        setConfig({
          title: data.title || '',
          description: data.description || '',
          keywords: data.keywords || '',
          ogImage: data.ogImage || '',
          favicon: data.favicon || '',
          siteUrl: data.siteUrl || ''
        });
        setIsFallbackMode(false);
        // Sync local cache
        localStorage.setItem('sy_local_meta_config', JSON.stringify(data));
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
          setConfig({
            title: data.title || '',
            description: data.description || '',
            keywords: data.keywords || '',
            ogImage: data.ogImage || '',
            favicon: data.favicon || '',
            siteUrl: data.siteUrl || ''
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

    const updateClientSideInstant = () => {
      if (config.title) {
        document.title = config.title;
      }
      if (config.favicon) {
        let faviconLink = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
        if (!faviconLink) {
          faviconLink = document.createElement('link');
          faviconLink.setAttribute('rel', 'icon');
          document.head.appendChild(faviconLink);
        }
        faviconLink.setAttribute('href', config.favicon);
      }
    };

    // Attempt direct database write to Supabase first for absolute high-fidelity persistence
    let dbSyncSuccess = false;
    try {
      const { error: dbError } = await supabase
        .from('meta_configs')
        .upsert({
          id: 'singleton',
          title: config.title,
          description: config.description,
          keywords: config.keywords,
          og_image: config.ogImage,
          favicon: config.favicon,
          site_url: config.siteUrl,
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
        localStorage.setItem('sy_local_meta_config', JSON.stringify(config));
        updateClientSideInstant();
        setFeedback({ 
          type: 'success', 
          message: dbSyncSuccess 
            ? 'Website meta details saved to browser cache and synced directly with Supabase database!'
            : 'Website meta details successfully saved locally! (Fallback Mode Active due to static Netlify hosting)' 
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
          ...config
        })
      });

      if (response.ok) {
        const successData = await safeJsonParse(response);
        setFeedback({ 
          type: 'success', 
          message: dbSyncSuccess
            ? 'Website meta details successfully saved, with high-fidelity database synchronizations complete!'
            : (successData.message || 'Website meta details and OG image settings successfully saved!')
        });
        updateClientSideInstant();
        localStorage.setItem('sy_local_meta_config', JSON.stringify(config));
      } else {
        // If API fails but direct DB write succeeded, we can still report success!
        if (dbSyncSuccess) {
          setFeedback({
            type: 'success',
            message: 'Website meta details successfully saved and updated directly in the Supabase database!'
          });
          updateClientSideInstant();
          localStorage.setItem('sy_local_meta_config', JSON.stringify(config));
        } else {
          const errData = await safeJsonParse(response);
          setFeedback({ type: 'error', message: errData.error || 'Failed to save settings' });
        }
      }
    } catch (err: any) {
      console.warn('Network error while saving settings via API, falling back to LocalStorage & direct DB:', err);
      // Fallback
      try {
        localStorage.setItem('sy_local_meta_config', JSON.stringify(config));
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
      <div className="bg-red-50 text-red-800 p-6 rounded-2xl border border-red-100 flex items-center gap-3">
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
      <div className="bg-white p-6 rounded-2xl border border-stone-150 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 shadow-xs">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-stone-900">Website Meta & OG Details</h2>
            <p className="text-xs text-stone-500">Configure global SEO, titles, descriptions, keywords, and share preview images</p>
          </div>
        </div>
        <button
          onClick={fetchConfig}
          disabled={loading}
          className="p-2 px-4 hover:bg-stone-50 text-stone-600 text-xs font-semibold rounded-xl border border-stone-200 transition-all flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Reload Settings
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-semibold shadow-xs ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
            : 'bg-red-50 text-red-800 border-red-100'
        }`}>
          {feedback.type === 'success' ? <Check className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-stone-150 shadow-xs flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
          <p className="text-xs font-bold text-stone-500">Retrieving meta details...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Settings Form - Left Column */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-stone-150 shadow-xs space-y-6">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <h3 className="font-black text-stone-900 text-sm">Configure SEO Meta Parameters</h3>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600 block">Website Title</label>
                <input
                  type="text"
                  required
                  value={config.title}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  placeholder="e.g. Shalom Youth Fellowship - MZP"
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50"
                />
                <p className="text-[10px] text-stone-400">Used as the browser tab title and the primary title on search engine results. Recommended: under 60 characters.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600 block">Meta Description</label>
                <textarea
                  required
                  rows={3}
                  value={config.description}
                  onChange={(e) => setConfig({ ...config, description: e.target.value })}
                  placeholder="Describe your youth fellowship page..."
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50 resize-none animate-none"
                />
                <p className="text-[10px] text-stone-400">A clear, short summary of what the page is about. Used by Google and chat applications for link descriptions. Recommended: under 160 characters.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600 block">Meta Keywords</label>
                <input
                  type="text"
                  value={config.keywords}
                  onChange={(e) => setConfig({ ...config, keywords: e.target.value })}
                  placeholder="e.g. Shalom Youth, MZP, Fellowship, Mizo Presbyterian"
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50"
                />
                <p className="text-[10px] text-stone-400">Comma-separated list of keywords relevant to your website.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600 block">Open Graph (OG) Image URL</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={config.ogImage}
                      onChange={(e) => setConfig({ ...config, ogImage: e.target.value })}
                      placeholder="e.g. /og-image.png or https://..."
                      className="w-full text-xs p-3 pl-9 rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50"
                    />
                    <ImageIcon className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  </div>
                </div>
                
                {/* File Upload zone for OG Image */}
                <div className="mt-2 py-1 flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="relative flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 cursor-pointer transition-all self-start">
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
                    <div className="w-24 bg-stone-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-purple-600 h-full transition-all" style={{ width: `${ogUploadProgress}%` }}></div>
                    </div>
                  )}
                  {ogUploadError && (
                    <p className="text-[10px] text-red-650 font-bold">{ogUploadError}</p>
                  )}
                </div>
                
                <p className="text-[10px] text-stone-400">Direct URL to an image shown when the website is shared on social networks (WhatsApp, Facebook, Discord). Optimal size: 1200 x 630 pixels.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600 block">Favicon URL (Browser Tab Icon)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={config.favicon}
                      onChange={(e) => setConfig({ ...config, favicon: e.target.value })}
                      placeholder="e.g. /favicon.ico or https://..."
                      className="w-full text-xs p-3 pl-9 rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50"
                    />
                    <Sparkles className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  </div>
                </div>

                {/* File Upload zone for Favicon */}
                <div className="mt-2 py-1 flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="relative flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 cursor-pointer transition-all self-start">
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
                    <div className="w-24 bg-stone-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-purple-600 h-full transition-all" style={{ width: `${faviconUploadProgress}%` }}></div>
                    </div>
                  )}
                  {faviconUploadError && (
                    <p className="text-[10px] text-red-650 font-bold">{faviconUploadError}</p>
                  )}
                </div>

                <p className="text-[10px] text-stone-400">The shortcut icon displayed in browser tabs. You can use standard local path `/favicon.ico` or any external image URL.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600 block">Website Domain / URL</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={config.siteUrl}
                      onChange={(e) => setConfig({ ...config, siteUrl: e.target.value })}
                      placeholder="e.g. https://shalomyouthfellowship.mzp"
                      className="w-full text-xs p-3 pl-9 rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50"
                    />
                    <LinkIcon className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  </div>
                </div>
                <p className="text-[10px] text-stone-400">The canonical address or public domain of this application, used for metadata schemas and search engines.</p>
              </div>

              <div className="pt-4 border-t border-stone-100 flex justify-end">
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
            {/* WhatsApp / Chat App Link Preview */}
            <div className="bg-white p-5 rounded-2xl border border-stone-150 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
                <Eye className="w-4 h-4 text-stone-500" />
                <h4 className="font-extrabold text-stone-800 text-xs uppercase tracking-wide">WhatsApp / Messenger Preview</h4>
              </div>

              <div className="bg-[#e5ddd5] p-4 rounded-xl space-y-2">
                <div className="bg-white rounded-xl overflow-hidden shadow-xs border border-stone-150 max-w-xs ml-auto">
                  {config.ogImage ? (
                    <img src={config.ogImage} alt="OG Share Preview" className="w-full h-40 object-cover border-b border-stone-100" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-40 bg-stone-100 flex items-center justify-center text-stone-400">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                  <div className="p-3 space-y-1 bg-[#f0f2f5]">
                    <div className="text-xs font-bold text-stone-800 truncate">{config.title || 'Shalom Youth Fellowship - MZP'}</div>
                    <div className="text-[10px] text-stone-500 line-clamp-2 leading-relaxed">{config.description || 'Describe your youth fellowship page...'}</div>
                    <div className="text-[9px] text-stone-400 uppercase tracking-wider truncate">{config.siteUrl ? config.siteUrl.replace(/^https?:\/\//i, '') : 'shalomyouthfellowship.mzp'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Google Search Result Preview */}
            <div className="bg-white p-5 rounded-2xl border border-stone-150 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
                <Globe className="w-4 h-4 text-stone-500" />
                <h4 className="font-extrabold text-stone-800 text-xs uppercase tracking-wide">Google Search Snippet</h4>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl space-y-1 border border-stone-200/60">
                <div className="text-xs text-stone-500 truncate">{config.siteUrl || 'https://shalomyouthfellowship.mzp'}</div>
                <div className="text-base font-medium text-[#1a0dab] hover:underline cursor-pointer leading-tight line-clamp-1">{config.title || 'Shalom Youth Fellowship - MZP'}</div>
                <div className="text-xs text-[#4d5156] line-clamp-2 leading-relaxed">{config.description || 'Describe your youth fellowship page...'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

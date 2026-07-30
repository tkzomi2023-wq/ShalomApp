import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  X, 
  Shield, 
  Image as ImageIcon, 
  Sparkles,
  Info
} from 'lucide-react';

interface OgPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: string;
}

interface MetaCheckItem {
  label: string;
  selector: string;
  requiredValue?: string;
  found: boolean;
  content: string;
}

export const OgPreviewModal: React.FC<OgPreviewModalProps> = ({ isOpen, onClose, currentTab }) => {
  const [ogImageUrl, setOgImageUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [metaChecklist, setMetaChecklist] = useState<MetaCheckItem[]>([]);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://jsagyouth.netlify.app';
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  const updateModalData = () => {
    // Determine OG Image URL
    const timestamp = Date.now();
    const cleanPath = currentPath === '/' ? `/${currentTab || ''}` : currentPath;
    const imgUrl = `${origin}/api/og?path=${encodeURIComponent(cleanPath)}&t=${timestamp}`;
    setOgImageUrl(imgUrl);

    // Audit live document head meta tags
    if (typeof document !== 'undefined') {
      const getMeta = (selector: string, attr: string = 'content') => {
        const el = document.querySelector(selector);
        return el ? (el.getAttribute(attr) || '') : '';
      };

      const getTitle = () => document.title || '';
      const getCanonical = () => {
        const el = document.querySelector('link[rel="canonical"]');
        return el ? el.getAttribute('href') || '' : '';
      };

      const checks: MetaCheckItem[] = [
        { label: 'Page Title (<title>)', selector: 'title', found: !!getTitle(), content: getTitle() },
        { label: 'Description (meta description)', selector: 'meta[name="description"]', found: !!getMeta('meta[name="description"]'), content: getMeta('meta[name="description"]') },
        { label: 'Canonical URL (link canonical)', selector: 'link[rel="canonical"]', found: !!getCanonical(), content: getCanonical() },
        { label: 'OG Type (og:type)', selector: 'meta[property="og:type"]', found: !!getMeta('meta[property="og:type"]'), content: getMeta('meta[property="og:type"]') },
        { label: 'OG Title (og:title)', selector: 'meta[property="og:title"]', found: !!getMeta('meta[property="og:title"]'), content: getMeta('meta[property="og:title"]') },
        { label: 'OG Description (og:description)', selector: 'meta[property="og:description"]', found: !!getMeta('meta[property="og:description"]'), content: getMeta('meta[property="og:description"]') },
        { label: 'OG Image (og:image)', selector: 'meta[property="og:image"]', found: !!getMeta('meta[property="og:image"]'), content: getMeta('meta[property="og:image"]') },
        { label: 'OG Image Width (1200px)', selector: 'meta[property="og:image:width"]', found: getMeta('meta[property="og:image:width"]') === '1200', content: getMeta('meta[property="og:image:width"]') },
        { label: 'OG Image Height (631px)', selector: 'meta[property="og:image:height"]', found: getMeta('meta[property="og:image:height"]') === '631', content: getMeta('meta[property="og:image:height"]') },
        { label: 'Twitter Card (summary_large_image)', selector: 'meta[name="twitter:card"]', found: getMeta('meta[name="twitter:card"]') === 'summary_large_image', content: getMeta('meta[name="twitter:card"]') },
        { label: 'Twitter Image (twitter:image)', selector: 'meta[name="twitter:image"]', found: !!getMeta('meta[name="twitter:image"]'), content: getMeta('meta[name="twitter:image"]') },
      ];

      setMetaChecklist(checks);
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateModalData();
    }
  }, [isOpen, currentTab]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(ogImageUrl.split('&t=')[0]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefreshCache = async () => {
    setIsRefreshing(true);
    try {
      await fetch('/api/og/clear-cache', { method: 'POST' });
    } catch (e) {}
    setTimeout(() => {
      updateModalData();
      setIsRefreshing(false);
    }, 600);
  };

  const pageCanonical = metaChecklist.find(c => c.label.includes('Canonical'))?.content || origin;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-800 flex items-center justify-between sticky top-0 bg-stone-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                Open Graph (OG) Dev Inspector
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Admin Tool
                </span>
              </h2>
              <p className="text-xs text-stone-400">
                1200 × 631 Dynamic Social Preview &amp; Meta Tags Checklist
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-750 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Live OG Image Card */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" /> Live Generated 1200×631 OG Image
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefreshCache}
                  disabled={isRefreshing}
                  className="px-2.5 py-1 bg-stone-800 hover:bg-stone-750 text-stone-200 text-xs font-bold rounded-lg border border-stone-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
                <button
                  onClick={handleCopyLink}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied URL!' : 'Copy Image URL'}
                </button>
              </div>
            </div>

            {/* Preview Frame */}
            <div className="relative aspect-[1200/631] bg-stone-950 rounded-xl overflow-hidden border border-stone-800 shadow-inner group">
              {ogImageUrl ? (
                <img
                  src={ogImageUrl}
                  alt="Open Graph Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-500 text-xs font-medium">
                  Generating preview...
                </div>
              )}
              <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 text-[10px] font-mono font-bold text-amber-300 border border-amber-500/30">
                1200 × 631 • PNG
              </div>
            </div>
          </div>

          {/* Social Sharing Debugger Quick Links */}
          <div className="bg-stone-850 p-3.5 rounded-xl border border-stone-800 space-y-2">
            <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              Verify on Social Media Debuggers:
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              <a
                href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(pageCanonical)}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg font-bold hover:bg-blue-600/30 transition-colors"
              >
                Facebook Sharing Debugger ↗
              </a>
              <a
                href={`https://cards-dev.twitter.com/validator?url=${encodeURIComponent(pageCanonical)}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 bg-sky-600/20 text-sky-400 border border-sky-500/30 rounded-lg font-bold hover:bg-sky-600/30 transition-colors"
              >
                X (Twitter) Card Validator ↗
              </a>
              <a
                href={`https://www.linkedin.com/post-inspector/inspect/${encodeURIComponent(pageCanonical)}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 rounded-lg font-bold hover:bg-cyan-600/30 transition-colors"
              >
                LinkedIn Post Inspector ↗
              </a>
            </div>
          </div>

          {/* Meta Tags Audit Checklist */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-400 flex items-center justify-between">
              <span>Meta Tags Health Checklist</span>
              <span className="text-[10px] text-emerald-400 font-extrabold">
                {metaChecklist.filter(c => c.found).length} / {metaChecklist.length} Valid
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {metaChecklist.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                    item.found
                      ? 'bg-emerald-950/20 border-emerald-900/40 text-stone-200'
                      : 'bg-rose-950/20 border-rose-900/40 text-rose-300'
                  }`}
                >
                  {item.found ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="truncate">{item.label}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.25 rounded bg-stone-900 text-stone-400">
                        {item.selector}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400 truncate font-mono bg-stone-950/50 p-1 rounded border border-stone-800/60">
                      {item.content || <span className="italic text-stone-600">Missing</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-stone-800 bg-stone-950/80 flex items-center justify-between text-xs text-stone-400">
          <span className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-stone-500" /> Shortcut: <kbd className="px-1.5 py-0.5 bg-stone-800 text-stone-200 rounded font-mono text-[10px]">Ctrl+Shift+O</kbd>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold rounded-xl cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};

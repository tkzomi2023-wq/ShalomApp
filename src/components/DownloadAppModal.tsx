import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Download, 
  X, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  Share2, 
  Copy, 
  Check, 
  Info,
  ExternalLink,
  Laptop
} from 'lucide-react';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadAppModal: React.FC<DownloadAppModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'pwa'>('android');
  const [copiedLink, setCopiedLink] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!isOpen) return null;

  const handleDownloadApk = () => {
    setIsDownloading(true);
    setDownloadSuccess(false);

    // Trigger direct download
    const link = document.createElement('a');
    link.href = '/api/download-apk';
    link.download = 'Shalom_Youth_App_v2.4.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setIsDownloading(false);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    }, 1500);
  };

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the PWA install prompt');
        setDeferredPrompt(null);
      }
    } else {
      alert('To install as Web App: Tap your browser menu (3 dots or share button) and select "Add to Home Screen" or "Install App".');
    }
  };

  const handleCopyLink = () => {
    const shareUrl = window.location.origin;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[9999] animate-fade-in text-left">
      <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-scale-up flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-900 to-teal-900 p-5 sm:p-6 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-emerald-200 hover:text-white bg-black/20 hover:bg-black/40 p-2 rounded-full transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-emerald-300 shadow-inner">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 mb-1">
                <Sparkles className="w-3 h-3" /> Mobile App v2.4
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight leading-tight">
                Shalom Youth Mobile App
              </h2>
            </div>
          </div>
          
          <p className="text-xs text-emerald-200/90 leading-relaxed max-w-md">
            Download and install the official Shalom Youth Android App (.APK) or add the Web App directly to your phone's home screen for fast offline access.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 shrink-0">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-3 px-2 text-center text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'android'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Android (.APK)
          </button>
          
          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 py-3 px-2 text-center text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'pwa'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            Web App (PWA)
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-3 px-2 text-center text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'ios'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            iOS (iPhone/iPad)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">

          {/* ANDROID TAB */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              
              {/* Highlight Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200/80 dark:border-emerald-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-emerald-800 dark:text-emerald-300 font-extrabold text-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Android Application (.APK)
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Package: <code className="bg-white/80 dark:bg-stone-900 px-1.5 py-0.5 rounded text-[11px]">com.shalomyouth.app</code>
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    File Size: ~3.2 MB • Compatible with Android 7.0+
                  </p>
                </div>

                <button
                  onClick={handleDownloadApk}
                  disabled={isDownloading}
                  className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-60"
                >
                  <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                  {isDownloading ? 'Preparing APK...' : 'Download Android APK'}
                </button>
              </div>

              {downloadSuccess && (
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span><strong>APK download started!</strong> Check your browser downloads folder to open and install <code className="font-mono">Shalom_Youth_App_v2.4.apk</code>.</span>
                </div>
              )}

              {/* Step by Step installation instructions */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black uppercase text-stone-400 dark:text-stone-500 tracking-wider">
                  How to Install APK on Android:
                </h4>
                
                <ol className="space-y-2.5 text-xs text-stone-700 dark:text-stone-300">
                  <li className="flex items-start gap-2.5 p-2.5 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200/60 dark:border-stone-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">1</span>
                    <div>
                      <strong>Tap "Download Android APK" button above</strong> to download the <code className="bg-stone-200 dark:bg-stone-800 px-1 py-0.5 rounded text-[11px]">.apk</code> file to your mobile phone.
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5 p-2.5 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200/60 dark:border-stone-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">2</span>
                    <div>
                      Open your phone's <strong>Downloads</strong> folder or notification banner and tap on <code className="bg-stone-200 dark:bg-stone-800 px-1 py-0.5 rounded text-[11px]">Shalom_Youth_App_v2.4.apk</code>.
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5 p-2.5 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200/60 dark:border-stone-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">3</span>
                    <div>
                      If prompted, enable <strong>"Allow installation from unknown sources"</strong> in your Android security settings.
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5 p-2.5 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200/60 dark:border-stone-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">4</span>
                    <div>
                      Tap <strong>"Install"</strong>. Once finished, launch Shalom Youth from your app drawer!
                    </div>
                  </li>
                </ol>
              </div>

            </div>
          )}

          {/* PWA TAB */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/30 border border-indigo-200/80 dark:border-indigo-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-indigo-900 dark:text-indigo-300 font-extrabold text-sm">
                    <Laptop className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Progressive Web App (PWA)
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Install instantly without downloading external APK files.
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Works on Chrome, Edge, Safari, Brave, and Samsung Internet.
                  </p>
                </div>

                <button
                  onClick={handleInstallPwa}
                  className="w-full sm:w-auto px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  Install Web App
                </button>
              </div>

              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-800 dark:text-amber-300 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Manual Web App Installation:</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  On Chrome/Brave mobile: Tap the 3 dots menu at top right → Select <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong>.
                </p>
              </div>
            </div>
          )}

          {/* IOS TAB */}
          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-stone-100 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-2">
                <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-black text-sm">
                  <Share2 className="w-4 h-4 text-blue-500" />
                  iPhone & iPad Safari Installation
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  Apple iOS does not allow direct APK files. You can install Shalom Youth in 2 quick taps via Safari:
                </p>
              </div>

              <ol className="space-y-2.5 text-xs text-stone-700 dark:text-stone-300">
                <li className="flex items-start gap-2.5 p-2.5 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200/60 dark:border-stone-800">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">1</span>
                  <div>
                    Open this website in <strong>Safari</strong> on your iPhone or iPad.
                  </div>
                </li>

                <li className="flex items-start gap-2.5 p-2.5 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200/60 dark:border-stone-800">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">2</span>
                  <div>
                    Tap the <strong>Share button</strong> <span className="inline-block px-1.5 py-0.5 bg-stone-200 dark:bg-stone-750 rounded text-[11px]">⎋ / ⬆</span> at the bottom toolbar.
                  </div>
                </li>

                <li className="flex items-start gap-2.5 p-2.5 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200/60 dark:border-stone-800">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">3</span>
                  <div>
                    Scroll down and tap <strong>"Add to Home Screen"</strong>.
                  </div>
                </li>

                <li className="flex items-start gap-2.5 p-2.5 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200/60 dark:border-stone-800">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">4</span>
                  <div>
                    Tap <strong>"Add"</strong> in top right corner. Shalom Youth will now appear on your iPhone home screen!
                  </div>
                </li>
              </ol>
            </div>
          )}

          {/* Quick Share Link Box */}
          <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span className="font-bold">Share Download Link to Phone:</span>
              {copiedLink && (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                  <Check className="w-3 h-3" /> Copied link!
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={window.location.origin}
                className="flex-1 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-750 rounded-xl px-3 py-2 text-xs font-mono text-stone-700 dark:text-stone-300 focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-50 dark:bg-stone-950 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-400 dark:text-stone-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Safe & Verified Package</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

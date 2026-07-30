/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink,
  Image as ImageIcon,
  User,
  Sparkles
} from 'lucide-react';

interface ImagePreviewModalProps {
  imageUrl: string;
  title?: string;
  subtitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onShare?: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  imageUrl,
  title = 'Image Preview',
  subtitle,
  isOpen,
  onClose,
  onShare
}) => {
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setCopied(false);
    }
  }, [isOpen, imageUrl]);

  if (!isOpen || !imageUrl) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.35, 3.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.35, 0.6));
  const handleResetZoom = () => setZoom(1);

  const handleDownload = async () => {
    try {
      if (imageUrl.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = `${title.toLowerCase().replace(/[^a-z0-0]/g, '_')}_photo.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_photo.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      // Fallback: open in new tab
      window.open(imageUrl, '_blank');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      console.warn('Failed to copy image link:', e);
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-6 z-50 overflow-hidden select-none"
        onClick={onClose}
      >
        {/* Top Floating Control Bar */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className="w-full max-w-4xl flex items-center justify-between gap-3 bg-stone-900/90 text-white p-3 rounded-2xl border border-stone-800 shadow-2xl z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-white text-sm sm:text-base truncate leading-snug">
                {title}
              </h3>
              <p className="text-[11px] text-stone-400 truncate flex items-center gap-2">
                {subtitle && <span>{subtitle}</span>}
                {naturalDimensions && (
                  <span className="font-mono text-[10px] text-emerald-400/90 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/50">
                    {naturalDimensions.width} × {naturalDimensions.height} px
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center gap-1 bg-stone-800/80 p-1 rounded-xl border border-stone-700/60">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.6}
                className="p-1.5 hover:bg-stone-700 rounded-lg text-stone-300 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-2 py-1 text-[10px] font-mono font-bold text-emerald-400 hover:bg-stone-700 rounded-md transition-colors cursor-pointer"
                title="Reset Zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 3.5}
                className="p-1.5 hover:bg-stone-700 rounded-lg text-stone-300 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 sm:px-3 sm:py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              title="Download High Quality Image"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </button>

            {onShare && (
              <button
                type="button"
                onClick={onShare}
                className="p-2 sm:px-3 sm:py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-stone-700"
                title="Share Profile"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-xl transition-colors cursor-pointer border border-stone-700"
              title="Close Preview (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        {/* Center Main Stage / Image Viewer */}
        <div 
          className="flex-1 w-full flex items-center justify-center p-2 sm:p-6 overflow-hidden relative cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            animate={{ scale: zoom }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative max-w-full max-h-full flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl border border-stone-800 bg-stone-950/60"
          >
            <img
              src={imageUrl}
              alt={title}
              onLoad={handleImageLoad}
              className="max-w-[85vw] max-h-[72vh] sm:max-h-[78vh] object-contain transition-all duration-100 select-none"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>

        {/* Bottom Bar Details & Mobile Controls */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="w-full max-w-md flex items-center justify-between gap-3 bg-stone-900/90 text-stone-300 p-2.5 px-4 rounded-2xl border border-stone-800 text-xs shadow-xl z-20"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile Zoom Controls */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 bg-stone-800 rounded-lg text-stone-300"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs text-emerald-400 font-bold">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 bg-stone-800 rounded-lg text-stone-300"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1.5 bg-stone-800 text-stone-400 rounded-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {!imageUrl.startsWith('data:') && (
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-[11px] font-bold text-stone-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer bg-stone-800 px-2.5 py-1 rounded-lg border border-stone-700/60"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied Link' : 'Copy Image URL'}</span>
              </button>
            )}
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/60"
            >
              <ExternalLink className="w-3 h-3" /> Full Res
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

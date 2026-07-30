/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  MessageSquare, 
  Globe, 
  ExternalLink, 
  QrCode, 
  IdCard, 
  User, 
  Sparkles,
  Send,
  Facebook,
  Twitter
} from 'lucide-react';
import { Member, formatMemberName, getDefaultAvatar, getCleanAvatar } from '../types';
import { RoleBadge } from './RoleBadge';

interface ShareProfileModalProps {
  member: Member;
  isOpen: boolean;
  onClose: () => void;
  onOpenIdCard?: () => void;
}

export const ShareProfileModal: React.FC<ShareProfileModalProps> = ({
  member,
  isOpen,
  onClose,
  onOpenIdCard
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  if (!isOpen || !member) return null;

  const formattedName = formatMemberName(
    member.display_name || member.username || member.name, 
    member.gender, 
    member.marital_status
  );

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  // Clean shareable URLs (both ?profile= and /profile/ deep links)
  const profileUrl = `${baseUrl}/?profile=${member.id}`;
  const cleanAvatarUrl = getCleanAvatar(member.avatar) || getDefaultAvatar(member.gender);

  // Pre-formatted share text for messaging apps (WhatsApp, Telegram, etc.)
  const shareText = `✨ *SHALOM YOUTH FELLOWSHIP* ✨
👤 *MEMBER PROFILE:* ${formattedName}
🛡️ *ROLE:* ${member.role || 'Member'}
${member.bial ? `📍 *BIAL DIVISION:* ${member.bial}\n` : ''}
🔗 *View Full Profile & Fellowship Card:*
👉 ${profileUrl}

_Mizoram Assemblies of God Church, JSAG Aizawl_`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      const textArea = document.createElement('textarea');
      textArea.value = profileUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleCopyFormattedText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2200);
    } catch (e) {
      const textArea = document.createElement('textarea');
      textArea.value = shareText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2200);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${formattedName} - Shalom Youth Profile`,
          text: shareText,
          url: profileUrl
        });
      } catch (err) {
        console.warn('Native share cancelled or failed:', err);
      }
    } else {
      handleCopyLink();
    }
  };

  const handleWhatsAppShare = () => {
    const encodedText = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank', 'noopener,noreferrer');
  };

  const handleTelegramShare = () => {
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(profileUrl);
    window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank', 'noopener,noreferrer');
  };

  const handleFacebookShare = () => {
    const encodedUrl = encodeURIComponent(profileUrl);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank', 'noopener,noreferrer');
  };

  const handleTwitterShare = () => {
    const tweetText = encodeURIComponent(`View ${formattedName}'s profile on Shalom Youth Fellowship`);
    const encodedUrl = encodeURIComponent(profileUrl);
    window.open(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${tweetText}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: 'spring', duration: 0.35 }}
          className="bg-white dark:bg-stone-900 rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden my-auto shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-950/40">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 dark:text-white text-base leading-snug">
                  Share Member Profile
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Share link or send profile details to WhatsApp
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-5">
            {/* Member Identity Card Summary Preview */}
            <div className="p-4 rounded-xl bg-linear-to-br from-stone-50 to-stone-100 dark:from-stone-950/60 dark:to-stone-900 border border-stone-200 dark:border-stone-800 flex items-center gap-3.5 relative overflow-hidden">
              {member.cover_photo && (
                <div className="absolute inset-0 z-0">
                  <img
                    src={member.cover_photo}
                    alt="Cover Banner"
                    className="w-full h-full object-cover opacity-15 dark:opacity-20"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-linear-to-r from-stone-50/90 via-stone-50/80 to-transparent dark:from-stone-900/90 dark:via-stone-900/80" />
                </div>
              )}
              <div className="w-14 h-14 rounded-full border-2 border-emerald-500/50 overflow-hidden shrink-0 bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-lg font-extrabold text-stone-600 dark:text-stone-300 relative z-10 shadow-sm">
                {cleanAvatarUrl ? (
                  <img 
                    src={cleanAvatarUrl} 
                    alt={formattedName} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{member.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h4 className="font-extrabold text-stone-900 dark:text-white text-sm truncate">
                    {formattedName}
                  </h4>
                  <RoleBadge role={member.role} />
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1 truncate">
                  <User className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{member.bial ? `Bial: ${member.bial}` : 'Shalom Youth Fellowship'}</span>
                </p>
                <p className="text-[10px] text-stone-400 font-mono mt-0.5 truncate">
                  ID: {member.id.substring(0, 10)}
                </p>
              </div>
            </div>

            {/* Direct Copy Link Box */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center justify-between">
                <span>Profile Share Link</span>
                {copied && (
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Link Copied to Clipboard!
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-stone-600 dark:text-stone-300 truncate select-all">
                  {profileUrl}
                </div>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    copied 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : 'bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Social Share Grid */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider block">
                Share via App
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                {/* WhatsApp */}
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center gap-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 transition-all cursor-pointer group"
                >
                  <div className="p-1.5 bg-emerald-500 text-white rounded-lg group-hover:scale-110 transition-transform">
                    <MessageSquare className="w-4 h-4 fill-current" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-stone-900 dark:text-white">WhatsApp</div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">Send card & link</div>
                  </div>
                </button>

                {/* Telegram */}
                <button
                  type="button"
                  onClick={handleTelegramShare}
                  className="p-2.5 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800/60 rounded-xl flex items-center gap-2.5 text-xs font-bold text-sky-800 dark:text-sky-300 transition-all cursor-pointer group"
                >
                  <div className="p-1.5 bg-sky-500 text-white rounded-lg group-hover:scale-110 transition-transform">
                    <Send className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-stone-900 dark:text-white">Telegram</div>
                    <div className="text-[10px] text-sky-700 dark:text-sky-400 font-medium">Share in chat</div>
                  </div>
                </button>

                {/* Facebook */}
                <button
                  type="button"
                  onClick={handleFacebookShare}
                  className="p-2.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-center gap-2.5 text-xs font-bold text-blue-800 dark:text-blue-300 transition-all cursor-pointer group"
                >
                  <div className="p-1.5 bg-blue-600 text-white rounded-lg group-hover:scale-110 transition-transform">
                    <Facebook className="w-4 h-4 fill-current" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-stone-900 dark:text-white">Facebook</div>
                    <div className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">Post link</div>
                  </div>
                </button>

                {/* X / Twitter */}
                <button
                  type="button"
                  onClick={handleTwitterShare}
                  className="p-2.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-750 border border-stone-200 dark:border-stone-700 rounded-xl flex items-center gap-2.5 text-xs font-bold text-stone-800 dark:text-stone-200 transition-all cursor-pointer group"
                >
                  <div className="p-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-lg group-hover:scale-110 transition-transform">
                    <Twitter className="w-4 h-4 fill-current" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-stone-900 dark:text-white">X / Twitter</div>
                    <div className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">Tweet profile</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Additional Actions */}
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleCopyFormattedText}
                className="px-3 py-1.5 text-xs font-bold text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedMessage ? 'Message Copied!' : 'Copy Formatted Text'}
              </button>

              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" /> More Options
                </button>
              )}

              {onOpenIdCard && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenIdCard();
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer ml-auto"
                >
                  <IdCard className="w-3.5 h-3.5" /> View Member ID Card
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

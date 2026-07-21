/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { toPng, toBlob } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { ServiceSchedule, schedulesDb } from '../lib/schedule';
import { Member } from '../types';
import { db } from '../lib/supabase';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  BookOpen, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  Download,
  Share2,
  Heart,
  Users,
  Megaphone,
  Music,
  Mic,
  GripVertical,
  Link,
  Check,
  Copy
} from 'lucide-react';

const PRESET_COVERS = [
  { id: 'worship', name: 'Worship Service', url: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=600&auto=format&fit=crop' },
  { id: 'bible', name: 'Bible Study', url: 'https://images.unsplash.com/photo-1504052434569-7c9602df539f?q=80&w=600&auto=format&fit=crop' },
  { id: 'fellowship', name: 'Youth Fellowship', url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=600&auto=format&fit=crop' },
  { id: 'study', name: 'Acoustic Prayer', url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=600&auto=format&fit=crop' }
];

export interface SegmentItem {
  key: string;
  label: string;
  shortLabel: string;
  icon: any;
  value?: string;
  posterBg: string;
  posterText: string;
  posterBorder: string;
  cardBg: string;
  cardIconBg: string;
  cardIconColor: string;
}

export function getSegmentsForItem(item: ServiceSchedule): SegmentItem[] {
  const map: Record<string, SegmentItem> = {
    lst_simna_quiz: {
      key: 'lst_simna_quiz',
      label: '📖 LST Simna & Quiz',
      shortLabel: 'Bible & Quiz',
      icon: BookOpen,
      value: item.lst_simna_quiz,
      posterBg: 'bg-stone-900/80',
      posterText: 'text-indigo-300',
      posterBorder: 'border-indigo-500/30',
      cardBg: 'bg-white dark:bg-stone-900',
      cardIconBg: 'bg-indigo-50 dark:bg-indigo-950/40',
      cardIconColor: 'text-indigo-600 dark:text-indigo-400'
    },
    solo: {
      key: 'solo',
      label: '🎶 Lasakna (Solo)',
      shortLabel: 'Lasakna / Solo',
      icon: Music,
      value: item.solo,
      posterBg: 'bg-stone-900/80',
      posterText: 'text-purple-300',
      posterBorder: 'border-purple-500/30',
      cardBg: 'bg-white dark:bg-stone-900',
      cardIconBg: 'bg-purple-50 dark:bg-purple-950/40',
      cardIconColor: 'text-purple-600 dark:text-purple-400'
    },
    sumpi_aapna: {
      key: 'sumpi_aapna',
      label: '🙏 Sumpi Aap',
      shortLabel: 'Sumpi Aap',
      icon: Heart,
      value: item.sumpi_aapna,
      posterBg: 'bg-stone-900/80',
      posterText: 'text-amber-300',
      posterBorder: 'border-amber-500/30',
      cardBg: 'bg-white dark:bg-stone-900',
      cardIconBg: 'bg-amber-50 dark:bg-amber-950/40',
      cardIconColor: 'text-amber-600 dark:text-amber-400'
    },
    sumpi_khon_ding: {
      key: 'sumpi_khon_ding',
      label: '🤝 Sumpi khon Ding',
      shortLabel: 'Sumpi khon Ding',
      icon: Users,
      value: item.sumpi_khon_ding,
      posterBg: 'bg-stone-900/80',
      posterText: 'text-teal-300',
      posterBorder: 'border-teal-500/30',
      cardBg: 'bg-white dark:bg-stone-900',
      cardIconBg: 'bg-teal-50 dark:bg-teal-950/40',
      cardIconColor: 'text-teal-600 dark:text-teal-400'
    }
  };

  const defaultKeys = ['lst_simna_quiz', 'solo', 'sumpi_aapna', 'sumpi_khon_ding'];
  const userOrder = item.segment_order && item.segment_order.length > 0 ? item.segment_order : defaultKeys;

  const result: SegmentItem[] = [];
  userOrder.forEach(k => {
    if (map[k] && map[k].value) {
      result.push(map[k]);
    }
  });

  defaultKeys.forEach(k => {
    if (map[k] && map[k].value && !result.some(r => r.key === k)) {
      result.push(map[k]);
    }
  });

  return result;
}

function NextServiceCountdown({ schedule }: { schedule: ServiceSchedule }) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false });

  useEffect(() => {
    const updateCountdown = () => {
      if (!schedule || !schedule.date) return;
      const parts = schedule.date.split('-').map(Number);
      let hour = 16;
      let minute = 30;
      if (schedule.time) {
        const match = schedule.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (match) {
          hour = parseInt(match[1], 10);
          minute = parseInt(match[2], 10);
          const ampm = match[3] ? match[3].toUpperCase() : null;
          if (ampm === 'PM' && hour < 12) hour += 12;
          if (ampm === 'AM' && hour === 12) hour = 0;
        }
      }
      const targetDate = new Date(parts[0], parts[1] - 1, parts[2], hour, minute, 0);
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isPast: false });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [schedule.date, schedule.time]);

  return (
    <div className="bg-stone-850/90 border border-emerald-500/35 p-5 rounded-2xl shadow-xl space-y-3.5 backdrop-blur-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-700/60 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                COUNTDOWN TO NEXT FELLOWSHIP
              </span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <h3 className="text-sm font-black text-white tracking-tight">{schedule.title}</h3>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-stone-300 bg-stone-900/60 px-3 py-1.5 rounded-xl border border-stone-700/50">
          <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-emerald-400" /> {schedule.date} • {schedule.time}</span>
          <span>•</span>
          <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-emerald-400" /> {schedule.venue || 'Shalom Sanctuary'}</span>
        </div>
      </div>

      {timeLeft.isPast ? (
        <div className="text-center py-2.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-300 animate-pulse">
          🎉 Youth Fellowship Service is in session now! Welcome all!
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center">
          <div className="bg-stone-900/95 border border-stone-700/80 rounded-xl p-2.5 shadow-inner">
            <span className="text-xl sm:text-2xl font-black text-white font-mono block tracking-tight">
              {String(timeLeft.days).padStart(2, '0')}
            </span>
            <span className="text-[9px] uppercase font-bold tracking-wider text-stone-400 block mt-0.5">Days</span>
          </div>
          <div className="bg-stone-900/95 border border-stone-700/80 rounded-xl p-2.5 shadow-inner">
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono block tracking-tight">
              {String(timeLeft.hours).padStart(2, '0')}
            </span>
            <span className="text-[9px] uppercase font-bold tracking-wider text-stone-400 block mt-0.5">Hours</span>
          </div>
          <div className="bg-stone-900/95 border border-stone-700/80 rounded-xl p-2.5 shadow-inner">
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono block tracking-tight">
              {String(timeLeft.minutes).padStart(2, '0')}
            </span>
            <span className="text-[9px] uppercase font-bold tracking-wider text-stone-400 block mt-0.5">Mins</span>
          </div>
          <div className="bg-stone-900/95 border border-emerald-500/40 rounded-xl p-2.5 shadow-inner">
            <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono block tracking-tight animate-pulse">
              {String(timeLeft.seconds).padStart(2, '0')}
            </span>
            <span className="text-[9px] uppercase font-bold tracking-wider text-stone-400 block mt-0.5">Secs</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between text-[11px] text-stone-400 pt-1.5 border-t border-stone-750">
        <span><strong className="text-white">Sermon / Speaker:</strong> {schedule.speaker}</span>
        <span><strong className="text-white">Service Chairman:</strong> {schedule.leader}</span>
      </div>
    </div>
  );
}

interface SchedulePageProps {
  currentUser: Member;
  onAddLog: (action: string, details: string) => void;
}

export function SchedulePage({ currentUser, onAddLog }: SchedulePageProps) {
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  // Drag and drop state for service segment reordering
  const [draggedSegment, setDraggedSegment] = useState<{ scheduleId: string; segmentKey: string } | null>(null);

  const handleReorderSegment = async (scheduleId: string, fromIndex: number, toIndex: number) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    const activeSegments = getSegmentsForItem(schedule);
    if (fromIndex < 0 || fromIndex >= activeSegments.length || toIndex < 0 || toIndex >= activeSegments.length) return;

    const currentKeys = activeSegments.map(s => s.key);
    const [movedKey] = currentKeys.splice(fromIndex, 1);
    currentKeys.splice(toIndex, 0, movedKey);

    setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, segment_order: currentKeys } : s));

    try {
      await schedulesDb.updateSchedule(scheduleId, { segment_order: currentKeys });
      setSuccessMessage('Order of service segments reordered successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      onAddLog('Reorder Service Segments', `Reordered order of service segments for "${schedule.title}"`);
    } catch (err) {
      console.error('Failed to update segment reorder:', err);
    }
  };

  // Form states for Create / Edit
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ServiceSchedule | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType]);

  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('04:30 PM');
  const [formSpeaker, setFormSpeaker] = useState(''); // Speaker/Sermon
  const [formLeader, setFormLeader] = useState('');   // Chairman
  const [formSolo, setFormSolo] = useState('');       // Solo
  const [formSumpiAapna, setFormSumpiAapna] = useState(''); // Sumpi Aapna
  const [formLstSimnaQuiz, setFormLstSimnaQuiz] = useState(''); // LST Simna & Quiz
  const [formSumpiKhonDing, setFormSumpiKhonDing] = useState(''); // Sumpi khon ding
  const [formVenue, setFormVenue] = useState('Shalom Sanctuary');
  const [formNotes, setFormNotes] = useState('');
  const [formThumbnail, setFormThumbnail] = useState(''); // Preset cover or base64 data string
  const [isThumbnailUploading, setIsThumbnailUploading] = useState(false);
  const [thumbnailUploadError, setThumbnailUploadError] = useState<string | null>(null);
  const [thumbnailUploadProgress, setThumbnailUploadProgress] = useState<number>(0);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [highlightedScheduleId, setHighlightedScheduleId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const handleCopyShareLink = async (item: ServiceSchedule) => {
    const url = `${window.location.origin}${window.location.pathname}?scheduleId=${item.id}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedLinkId(item.id);
      setSuccessMessage(`Shareable link for "${item.title}" copied to clipboard!`);
      setTimeout(() => {
        setCopiedLinkId(null);
        setSuccessMessage(null);
      }, 3000);
      onAddLog('Share Link Copied', `Copied shareable link for schedule "${item.title}"`);
    } catch (err) {
      console.error('Failed to copy share link:', err);
      setFormError('Failed to copy share link to clipboard.');
      setTimeout(() => setFormError(null), 3000);
    }
  };

  // Deep-linking: handle URL query param ?scheduleId=...
  useEffect(() => {
    if (schedules.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('scheduleId') || params.get('id');

    if (targetId) {
      const found = schedules.find(s => s.id === targetId);
      if (found) {
        setExpandedRecordId(targetId);
        setHighlightedScheduleId(targetId);

        const isPast = new Date(found.date) < new Date(new Date().setHours(0, 0, 0, 0));
        if (isPast && filterType === 'upcoming') {
          setFilterType('all');
        }

        setTimeout(() => {
          const el = document.getElementById(`schedule-card-${targetId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 350);

        setTimeout(() => {
          setHighlightedScheduleId(null);
        }, 7000);
      }
    }
  }, [schedules]);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const data = await db.getMembers();
        setMembers(data);
      } catch (err) {
        console.error('Error loading members for roles on SchedulePage:', err);
      }
    };
    loadMembers();
  }, []);

  const getCreatorRole = (createdByEmail: string, fallbackName: string) => {
    const member = members.find(m => m.email?.toLowerCase() === createdByEmail.toLowerCase());
    if (member && member.role) {
      if (member.role === 'standard') {
        return 'Youth Member';
      }
      return member.role;
    }
    if (createdByEmail.toLowerCase() === 'tkpaite2016@gmail.com') {
      return 'Founder';
    }
    return 'OB Member';
  };

  const formatFullDate = (dateStr: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
      const dateObj = new Date(dateStr);
      return dateObj.toLocaleDateString('en-US', options);
    } catch (err) {
      return dateStr;
    }
  };

  const captureCardAsBlob = async (itemId: string): Promise<{ blob: Blob | null, dataUrl: string | null }> => {
    try {
      const targetEl = document.getElementById(`schedule-poster-${itemId}`);
      if (!targetEl) {
        console.warn(`[Poster Engine] Target poster-element schedule-poster-${itemId} not found, falling back to card.`);
        const cardEl = document.getElementById(`schedule-card-${itemId}`);
        if (!cardEl) return { blob: null, dataUrl: null };
        const dataUrl = await toPng(cardEl, { pixelRatio: 2 });
        const blob = await toBlob(cardEl, { pixelRatio: 2 });
        return { blob, dataUrl };
      }

      // Forcing opacity: '1' and visibility: 'visible' during cloning so that html-to-image
      // captures the offscreen template flawlessly with complete color opacity.
      const options = {
        backgroundColor: '#0c0a09', // Premium deep dark theme slate
        pixelRatio: 2, // Retina-ready 2x density is highly compatible, lightweight, and sharp
        cacheBust: true,
        style: {
          opacity: '1',
          visibility: 'visible',
          transform: 'none',
          left: '0',
          top: '0',
          position: 'relative',
        }
      };

      const dataUrl = await toPng(targetEl, options);
      const blob = await toBlob(targetEl, options);

      return { blob, dataUrl };
    } catch (error) {
      console.error('Error capturing poster:', error);
      return { blob: null, dataUrl: null };
    }
  };

  const handleExportPNG = async (itemId: string, title: string) => {
    const item = schedules.find(s => s.id === itemId);
    if (!item) return;
    setIsExporting(itemId);
    try {
      const { dataUrl } = await captureCardAsBlob(itemId);
      if (dataUrl) {
        const cleanTitle = (title || "CA_HUN_GEELNA")
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        const filename = `${cleanTitle}_${item.date}.png`;

        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
        
        setSuccessMessage("Successfully generated and downloaded the high-fidelity programme image!");
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setFormError("Failed to render the programme image. Please try again.");
        setTimeout(() => setFormError(null), 4000);
      }
    } catch (err) {
      console.error('Export failed:', err);
      setFormError("Error generating programme image.");
      setTimeout(() => setFormError(null), 4000);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPDF = async (item: ServiceSchedule) => {
    setIsExporting(item.id);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
      const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
      
      // Theme colors
      const primaryColor = [5, 150, 105]; // Emerald
      const darkColor = [28, 25, 23]; // Deep stone
      const accentColor = [245, 158, 11]; // Amber
      const lightBg = [250, 250, 249]; // Light stone/cream
      
      // --- Top Colored Banner ---
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 38, 'F');
      
      // Banner text
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('SHALOM YOUTH FELLOWSHIP', pageWidth / 2, 16, { align: 'center' });
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('OFFICIAL WEEKLY SERVICE PROGRAMME SCHEDULE', pageWidth / 2, 23, { align: 'center' });
      
      // Accent line in banner
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(pageWidth / 2 - 25, 27, 50, 1.2, 'F');
      
      let y = 52;
      
      // --- Title ---
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(20);
      const titleLines = doc.splitTextToSize(item.title.toUpperCase(), pageWidth - 40);
      doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
      y += (titleLines.length * 8) + 2;
      
      // Topic/Theme
      if (item.topic) {
        doc.setFont('Helvetica', 'oblique');
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139); // Slate grey
        doc.text(`Theme: "${item.topic}"`, pageWidth / 2, y, { align: 'center' });
        y += 10;
      } else {
        y += 4;
      }
      
      // Decorative Divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(20, y, pageWidth - 20, y);
      y += 10;
      
      // --- Info Summary Cards (Rounded Box Grid) ---
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.setDrawColor(217, 217, 217);
      doc.setLineWidth(0.3);
      doc.roundedRect(20, y, pageWidth - 40, 36, 4, 4, 'FD');
      
      // Headers
      doc.setTextColor(100, 116, 139);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('DATE', 26, y + 8);
      doc.text('TIME', 86, y + 8);
      doc.text('VENUE', 142, y + 8);
      
      // Values
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(formatFullDate(item.date), 26, y + 14);
      doc.text(item.time, 86, y + 14);
      
      const venueLines = doc.splitTextToSize(item.venue || 'Shalom Sanctuary', 45);
      doc.text(venueLines, 142, y + 14);
      
      // Separator inside info block
      doc.setDrawColor(241, 245, 249);
      doc.line(25, y + 20, pageWidth - 25, y + 20);
      
      // Speaker & Chairman
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('SPEAKER / SERMON', 26, y + 26);
      doc.text('CHAIRMAN / LEADER', 106, y + 26);
      
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(item.speaker, 26, y + 32);
      doc.text(item.leader, 106, y + 32);
      
      y += 48;
      
      // --- Order of Service / Programme Details ---
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('ORDER OF SERVICE PROGRAMME', 20, y);
      
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.8);
      doc.line(20, y + 2, 45, y + 2);
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(45, y + 2, pageWidth - 20, y + 2);
      y += 9;
      
      // Table rows
      const itemsList = getSegmentsForItem(item).map(seg => ({
        label: seg.shortLabel,
        value: seg.value
      }));
      
      if (itemsList.length === 0) {
        doc.setTextColor(148, 163, 184);
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(10);
        doc.text('No active programme details recorded.', 25, y);
        y += 10;
      } else {
        itemsList.forEach(prog => {
          // Row container
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.4);
          
          const valLines = doc.splitTextToSize(prog.value || '', pageWidth - 55);
          const rowHeight = Math.max(14, (valLines.length * 5) + 7);
          
          doc.roundedRect(20, y, pageWidth - 40, rowHeight, 1.5, 1.5, 'FD');
          
          // Green left status line
          doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.rect(20, y, 2, rowHeight, 'F');
          
          // Row Label
          doc.setTextColor(100, 116, 139);
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(prog.label.toUpperCase(), 25, y + 5);
          
          // Row Value
          doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.text(valLines, 25, y + 10);
          
          y += rowHeight + 4;
        });
      }
      
      // --- Announcements ---
      if (item.notes) {
        y += 2;
        doc.setFillColor(254, 252, 243); // Creamy warm yellow
        doc.setDrawColor(245, 158, 11); // Amber
        doc.setLineWidth(0.4);
        
        const noteLines = doc.splitTextToSize(item.notes, pageWidth - 52);
        const noteBoxHeight = (noteLines.length * 5) + 14;
        
        doc.roundedRect(20, y, pageWidth - 40, noteBoxHeight, 2.5, 2.5, 'FD');
        
        // Left accent bar
        doc.setFillColor(245, 158, 11);
        doc.rect(20, y, 2.5, noteBoxHeight, 'F');
        
        doc.setTextColor(180, 83, 9); // Dark amber title
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('📢 ANNOUNCEMENTS & MEMORANDA', 26, y + 6);
        
        doc.setTextColor(68, 64, 60); // Neutral dark
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        
        let lineY = y + 12;
        noteLines.forEach((line: string) => {
          doc.text(`• ${line.trim()}`, 26, lineY);
          lineY += 5;
        });
        
        y += noteBoxHeight + 8;
      }
      
      // --- Footer ---
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);
      
      doc.setTextColor(148, 163, 184);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Logged by: ${item.created_by_name} (${item.created_by_email})`, 20, pageHeight - 14);
      doc.text('Shalom Youth Fellowship Management', pageWidth - 20, pageHeight - 14, { align: 'right' });
      
      const cleanTitle = (item.title || "CA_HUN_GEELNA")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      const filename = `${cleanTitle}_${item.date}_PROGRAMME.pdf`;
      
      doc.save(filename);
      
      setSuccessMessage("PDF printable schedule successfully generated and downloaded!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setFormError("Failed to generate PDF schedule.");
      setTimeout(() => setFormError(null), 4000);
    } finally {
      setIsExporting(null);
    }
  };

  const handleShareWhatsApp = async (item: ServiceSchedule) => {
    setIsExporting(item.id);
    try {
      // 1. Generate and download the high-quality PNG card automatically
      // so the user has the image ready in their gallery/downloads to share.
      const { blob, dataUrl } = await captureCardAsBlob(item.id);
      
      const cleanTitle = (item.title || "CA_HUN_GEELNA")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      const filename = `${cleanTitle}_${item.date}.png`;

      // Download fallback
      if (dataUrl) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
      }

      // 2. Draft the highly professional, beautifully formatted, community-optimized text.
      const formattedDate = formatFullDate(item.date);
      const currentUrl = `${window.location.origin}${window.location.pathname}?scheduleId=${item.id}`;

      let shareText = `✨ *SHALOM YOUTH FELLOWSHIP* ✨\n`;
      shareText += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      shareText += `📖 *PROGRAMME:* ${item.title.toUpperCase()}\n`;
      if (item.topic) {
        shareText += `🎯 *THEME:* "${item.topic}"\n`;
      }
      shareText += `🗓️ *DATE:* ${formattedDate}\n`;
      shareText += `⏰ *TIME:* ${item.time}\n`;
      shareText += `📍 *VENUE:* ${item.venue || 'Shalom Sanctuary'}\n\n`;
      shareText += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      shareText += `🎤 *SPEAKER / SERMON:*\n  └─ ${item.speaker}\n\n`;
      shareText += `👤 *CHAIRMAN / LEADER:*\n  └─ ${item.leader}\n\n`;
      shareText += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      shareText += `📋 *ORDER OF SERVICE:*\n\n`;
      
      if (item.lst_simna_quiz) {
        shareText += `📖 *Bible Reading / Quiz*\n  └─ ${item.lst_simna_quiz}\n\n`;
      }
      if (item.solo) {
        shareText += `🎶 *Lasakna (Solo)*\n  └─ ${item.solo}\n\n`;
      }
      if (item.sumpi_aapna) {
        shareText += `🙏 *Sumpi Aap (Dedicated Offering)*\n  └─ ${item.sumpi_aapna}\n\n`;
      }
      if (item.sumpi_khon_ding) {
        shareText += `🤝 *Sumpi khon Ding (Collectors)*\n  └─ ${item.sumpi_khon_ding}\n\n`;
      }
      
      shareText += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      if (item.notes) {
        shareText += `📢 *ANNOUNCEMENTS:*\n`;
        const noteLines = item.notes.split('\n').filter(line => line.trim() !== '');
        noteLines.forEach(line => {
          shareText += ` • ${line.trim()}\n`;
        });
        shareText += `\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      }
      
      shareText += `🔗 *View Full Details & Live Updates:*\n👉 ${currentUrl}\n\n`;
      shareText += `💫 _Join us in fellowship and prayer!_\n`;
      shareText += `_Generated via Shalom Youth Admin_`;

      // 3. Try utilizing the Native Web Share API (which lets users share the actual file + text in WhatsApp)
      if (navigator.share && blob) {
        try {
          const file = new File([blob], filename, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: item.title,
              text: shareText,
              files: [file]
            });
            setIsExporting(null);
            return;
          }
        } catch (shareErr) {
          console.warn('Native share failed or cancelled, falling back to direct web link:', shareErr);
        }
      }

      // 4. Fallback: Open WhatsApp API with the beautifully encoded text
      const encodedText = encodeURIComponent(shareText);
      window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
      
      setSuccessMessage("Card image downloaded & WhatsApp message drafted successfully!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('WhatsApp share failed:', err);
      setFormError("Error sharing to WhatsApp.");
      setTimeout(() => setFormError(null), 4000);
    } finally {
      setIsExporting(null);
    }
  };

  // Check permissions: CRUDS is strictly for Secretary and Assistant Secretary (plus Founder / Admin for fail-safe)
  const canManageSchedules = 
    currentUser.role === 'Secretary' || 
    currentUser.role === 'Assistant Secretary' || 
    currentUser.role === 'Founder' ||
    currentUser.role === 'Admin';

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const data = await schedulesDb.getSchedules();
      setSchedules(data);
    } catch (e) {
      console.error('Error fetching schedules:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleOpenForm = (schedule: ServiceSchedule | null = null) => {
    if (!canManageSchedules) {
      setFormError('You do not have permission to manage schedules');
      return;
    }
    setEditingSchedule(schedule);
    setFormError(null);
    setThumbnailUploadError(null);
    setThumbnailUploadProgress(0);
    if (schedule) {
      setFormTitle(schedule.title);
      setFormDate(schedule.date);
      setFormTime(schedule.time);
      setFormSpeaker(schedule.speaker);
      setFormLeader(schedule.leader);
      setFormSolo(schedule.solo || '');
      setFormSumpiAapna(schedule.sumpi_aapna || '');
      setFormLstSimnaQuiz(schedule.lst_simna_quiz || '');
      setFormSumpiKhonDing(schedule.sumpi_khon_ding || '');
      setFormVenue(schedule.venue || 'Shalom Sanctuary');
      setFormNotes(schedule.notes || '');
      setFormThumbnail(schedule.thumbnail || '');
    } else {
      // Default inputs for new item
      setFormTitle('');
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormTime('04:30 PM');
      setFormSpeaker('');
      setFormLeader('');
      setFormSolo('');
      setFormSumpiAapna('');
      setFormLstSimnaQuiz('');
      setFormSumpiKhonDing('');
      setFormVenue('Shalom Sanctuary');
      setFormNotes('');
      setFormThumbnail('');
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingSchedule(null);
    setFormError(null);
    setThumbnailUploadError(null);
    setThumbnailUploadProgress(0);
  };

  const handleThumbnailUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setThumbnailUploadError('Please select a valid image file (PNG, JPG, or JPEG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setThumbnailUploadError(`Image size too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Custom banners must be under 2MB.`);
      return;
    }

    setIsThumbnailUploading(true);
    setThumbnailUploadError(null);
    setThumbnailUploadProgress(10);

    const progressInterval = setInterval(() => {
      setThumbnailUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 15;
      });
    }, 120);

    try {
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `schedules/thumb_${Date.now()}.${ext}`;
      const imageUrl = await db.uploadToStorage('thumbnails', filePath, file);
      
      clearInterval(progressInterval);
      setThumbnailUploadProgress(100);
      setFormThumbnail(imageUrl);
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error('Error uploading custom schedule image:', err);
      setThumbnailUploadError(`Upload Failed: ${err.message || 'Check your network connection and try again.'}`);
    } finally {
      setIsThumbnailUploading(false);
      setTimeout(() => setThumbnailUploadProgress(0), 800);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formTitle.trim() || !formDate || !formSpeaker.trim() || !formLeader.trim()) {
      setFormError('Please fill inrequired fields (Event Title, Date, Speaker/Sermon, Chairman)');
      return;
    }

    try {
      const payload = {
        title: formTitle.trim(),
        date: formDate,
        time: formTime.trim(),
        speaker: formSpeaker.trim(),
        leader: formLeader.trim(),
        solo: formSolo.trim() || undefined,
        sumpi_aapna: formSumpiAapna.trim() || undefined,
        lst_simna_quiz: formLstSimnaQuiz.trim() || undefined,
        sumpi_khon_ding: formSumpiKhonDing.trim() || undefined,
        venue: formVenue.trim() || 'Shalom Sanctuary',
        notes: formNotes.trim() || undefined,
        thumbnail: formThumbnail.trim() || undefined
      };

      if (editingSchedule) {
        const updated = await schedulesDb.updateSchedule(editingSchedule.id, payload);
        onAddLog(
          'Update Service Schedule',
          `Modified schedule "${updated.title}" set for ${updated.date} at ${updated.time}`
        );
        showSuccessToast('Schedule updated successfully');
      } else {
        const created = await schedulesDb.addSchedule(payload, currentUser.email, currentUser.name);
        onAddLog(
          'Create Service Schedule',
          `Created new schedule "${created.title}" for ${created.date} at ${created.time}`
        );
        showSuccessToast('New schedule created successfully');
      }

      await fetchSchedules();
      handleCloseForm();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save youth schedule');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    const item = schedules.find(s => s.id === id);
    if (!item) return;

    try {
      await schedulesDb.deleteSchedule(id);
      onAddLog(
        'Delete Service Schedule',
        `Removed schedule "${item.title}" that was scheduled on ${item.date}`
      );
      showSuccessToast('Schedule deleted successfully');
      await fetchSchedules();
    } catch (err: any) {
      console.error('Delete operation failed:', err);
    }
  };

  const showSuccessToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const toggleExpand = (id: string) => {
    setExpandedRecordId(expandedRecordId === id ? null : id);
  };

  // Timing helper: check if date is in the future
  const isUpcoming = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const serviceDate = new Date(dateStr);
    serviceDate.setHours(0, 0, 0, 0);
    return serviceDate >= today;
  };

  // Filter & Search logic
  const filteredSchedules = schedules.filter(item => {
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.speaker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.leader.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.topic && item.topic.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.venue.toLowerCase().includes(searchQuery.toLowerCase());

    const isFuture = isUpcoming(item.date);
    if (filterType === 'upcoming') {
      return matchesSearch && isFuture;
    } else if (filterType === 'past') {
      return matchesSearch && !isFuture;
    }
    return matchesSearch;
  }).sort((a, b) => {
    // Sort upcoming ascending (nearest first), past descending (latest first)
    if (filterType === 'past') {
      return b.date.localeCompare(a.date);
    }
    return a.date.localeCompare(b.date);
  });

  const totalPages = Math.ceil(filteredSchedules.length / itemsPerPage);
  const paginatedSchedules = filteredSchedules.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const nextUpcomingService = schedules
    .filter(item => isUpcoming(item.date))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {successMessage && (
        <div id="toast-success" className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg border border-emerald-500 animate-bounce">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold">{successMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <header className="bg-stone-900 text-stone-100 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-md">
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-600/15 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold text-[10px] tracking-wide uppercase">
                <Sparkles className="w-3 h-3" />
                Fellowship Planning
              </span>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">Youth Service Schedules</h2>
              <p className="text-xs text-stone-400 max-w-xl">
                Organize and sync scripture study, worship coordinates, and fellowship schedules. 
                Schedules are manageable exclusively by designated Secretaries and Assitant Secretaries.
              </p>
            </div>

            {canManageSchedules && (
              <button
                id="btn-create-schedule"
                onClick={() => handleOpenForm(null)}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold py-3 px-5 rounded-2xl transition-all shadow-md cursor-pointer hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4" />
                <span>Create Schedule</span>
              </button>
            )}
          </div>

          {/* Next Service Live Countdown Timer Component */}
          {nextUpcomingService && (
            <NextServiceCountdown schedule={nextUpcomingService} />
          )}
        </div>
      </header>

      {/* Control Area: Tab-Swappers, Search, and Status Info */}
      <section className="bg-white rounded-3xl p-5 border border-stone-150 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tab switches */}
          <div className="flex gap-1.5 bg-stone-100 p-1 rounded-2xl border border-stone-200/60 max-w-md shrink-0">
            <button
              id="filter-tab-upcoming"
              onClick={() => setFilterType('upcoming')}
              className={`py-2 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer ${filterType === 'upcoming' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-550 hover:text-stone-800'}`}
            >
              Upcoming Services
            </button>
            <button
              id="filter-tab-past"
              onClick={() => setFilterType('past')}
              className={`py-2 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer ${filterType === 'past' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-550 hover:text-stone-800'}`}
            >
              Past Services
            </button>
            <button
              id="filter-tab-all"
              onClick={() => setFilterType('all')}
              className={`py-2 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer ${filterType === 'all' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-550 hover:text-stone-800'}`}
            >
              All
            </button>
          </div>

          {/* High utility search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by speaker, leader, title, or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium"
            />
          </div>
        </div>

        {/* Warning Badge for standard users */}
        {!canManageSchedules && (
          <div className="flex items-center gap-2 bg-amber-50 text-amber-850 p-3.5 rounded-2xl border border-amber-150 text-[11px] leading-relaxed">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>View-only Clearance:</strong> You have active reader clearance. Only members registered as <strong>Secretary</strong> or <strong>Assistant Secretary</strong> can perform CRUD (create, update, delete) mutations. Please request administrators to log new schedules.
            </span>
          </div>
        )}
      </section>

      {/* Main Schedule Container */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-stone-150 shadow-xs flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
          <p className="text-xs text-stone-500 font-bold">Synchronizing youth schedules database...</p>
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-stone-150 shadow-xs space-y-3">
          <Calendar className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="text-sm font-bold text-stone-800">No Fellowship Schedules Found</h3>
          <p className="text-xs text-stone-450 max-w-sm mx-auto">
            {searchQuery 
              ? "We couldn't find any schedules that match your active search filter. Try clearing or editing the keyword."
              : `There are currently no services listed under "${filterType}" filter category.`}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
            >
              Clear Search Query
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {paginatedSchedules.map((item, index) => {
            const isItemExp = expandedRecordId === item.id;
            const flagUpcoming = isUpcoming(item.date);

            return (
              <React.Fragment key={item.id}>
                {/* Visual Card Layout */}
                <motion.div 
                  id={`schedule-card-${item.id}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
                  className={`group bg-white dark:bg-stone-900 rounded-3xl border transition-all duration-300 overflow-hidden shadow-xs hover:shadow-md flex flex-col justify-between ${
                    highlightedScheduleId === item.id
                      ? 'border-emerald-500 ring-2 ring-emerald-500/80 shadow-xl scale-[1.01]'
                      : flagUpcoming 
                        ? 'border-emerald-200 dark:border-emerald-900/40 ring-1 ring-emerald-600/5' 
                        : 'border-stone-150 dark:border-stone-800'
                  }`}
                >
                  {/* Modern Full Hero Section */}
                  <div className="relative w-full min-h-[220px] p-6 flex flex-col justify-between overflow-hidden shrink-0">
                    {/* Background Image / Gradient */}
                    <div className="absolute inset-0">
                      <img 
                        src={item.thumbnail || "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=600&auto=format&fit=crop"} 
                        alt={item.title} 
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out" 
                        referrerPolicy="no-referrer"
                      />
                      {/* Subtle dark overlay 35-50% */}
                      <div className="absolute inset-0 bg-stone-950/45 dark:bg-stone-950/50" />
                      {/* Smooth gradient fade into the white/dark content area */}
                      <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-stone-900 via-transparent to-black/25" />
                    </div>

                    {/* Floating Upcoming Badge at the top-right */}
                    <div className="relative z-10 flex justify-between items-center w-full">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/85 bg-black/20 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/10">
                        Shalom Youth
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest shadow-sm border relative z-20 ${
                        flagUpcoming 
                          ? 'bg-emerald-600 text-white border-emerald-500' 
                          : 'bg-stone-800 text-stone-300 border-stone-700'
                      }`}>
                        {flagUpcoming ? 'Upcoming' : 'Concluded'}
                      </span>
                    </div>

                    {/* Title, Date, and Time on top of the Hero image */}
                    <div className="relative z-10 mt-6 space-y-3">
                      {/* Date & Time Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-white/15 dark:bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-mono text-white font-bold border border-white/10 shadow-xs">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{item.date}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/15 dark:bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-mono text-white font-bold border border-white/10 shadow-xs">
                          <Clock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{item.time}</span>
                        </div>
                      </div>

                      {/* Programme Title */}
                      <div className="space-y-1">
                        <h4 
                          className="text-lg md:text-xl font-black text-white leading-tight tracking-tight drop-shadow-sm hover:text-emerald-300 transition-colors cursor-pointer select-none"
                          onClick={() => toggleExpand(item.id)}
                        >
                          {item.title}
                        </h4>
                        {item.topic && (
                          <p className="text-xs text-white/95 font-medium italic drop-shadow-xs line-clamp-1">
                            Topic: "{item.topic}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Content Area */}
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-5 bg-white dark:bg-stone-900">
                    
                    {/* Redesigned Info Cards Layout (Speaker, Chairman, Venue, Theme) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Speaker Card */}
                      <div className="bg-stone-50 dark:bg-stone-950/20 p-3.5 rounded-2xl border border-stone-150/60 dark:border-stone-800/80 flex items-center gap-3 transition-all hover:bg-stone-100/50 dark:hover:bg-stone-850/50">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] text-stone-400 dark:text-stone-500 font-extrabold uppercase tracking-wider">Speaker / Sermon</p>
                          <p className="text-xs font-bold text-stone-800 dark:text-stone-100 truncate">{item.speaker}</p>
                        </div>
                      </div>

                      {/* Chairman Card */}
                      <div className="bg-stone-50 dark:bg-stone-950/20 p-3.5 rounded-2xl border border-stone-150/60 dark:border-stone-800/80 flex items-center gap-3 transition-all hover:bg-stone-100/50 dark:hover:bg-stone-850/50">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] text-stone-400 dark:text-stone-500 font-extrabold uppercase tracking-wider">Chairman</p>
                          <p className="text-xs font-bold text-stone-800 dark:text-stone-100 truncate">{item.leader}</p>
                        </div>
                      </div>

                      {/* Venue Card */}
                      <div className="bg-stone-50 dark:bg-stone-950/20 p-3.5 rounded-2xl border border-stone-150/60 dark:border-stone-800/80 flex items-center gap-3 transition-all hover:bg-stone-100/50 dark:hover:bg-stone-850/50 sm:col-span-2">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] text-stone-400 dark:text-stone-500 font-extrabold uppercase tracking-wider">Venue</p>
                          <p className="text-xs font-bold text-stone-800 dark:text-stone-100 truncate">{item.venue || 'Shalom Sanctuary'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Order of Service / Program Items (Shown only when expanded) */}
                    {isItemExp && (
                      <div className="space-y-4 pt-4 border-t border-stone-100 dark:border-stone-800 animate-fadeIn">
                        {/* Service Program Table Redesign */}
                        <div className="bg-stone-50/50 dark:bg-stone-950/10 rounded-2xl border border-stone-150/80 dark:border-stone-800/80 p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-stone-800/80 pb-2.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Order of Service
                            </span>
                            {canManageSchedules && (
                              <span className="text-[9px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-md font-extrabold uppercase tracking-wider flex items-center gap-1">
                                <GripVertical className="w-3 h-3" /> Drag to Reorder
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-2.5">
                            {getSegmentsForItem(item).map((seg, idx, array) => {
                              const IconComp = seg.icon;
                              const isDragging = draggedSegment?.scheduleId === item.id && draggedSegment?.segmentKey === seg.key;

                              return (
                                <div
                                  key={seg.key}
                                  draggable={canManageSchedules}
                                  onDragStart={(e) => {
                                    setDraggedSegment({ scheduleId: item.id, segmentKey: seg.key });
                                    e.dataTransfer.effectAllowed = 'move';
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (draggedSegment && draggedSegment.scheduleId === item.id) {
                                      const fromIdx = array.findIndex(s => s.key === draggedSegment.segmentKey);
                                      if (fromIdx !== -1 && fromIdx !== idx) {
                                        handleReorderSegment(item.id, fromIdx, idx);
                                      }
                                    }
                                    setDraggedSegment(null);
                                  }}
                                  className={`group/seg flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 ${seg.cardBg} ${
                                    isDragging 
                                      ? 'opacity-40 border-dashed border-emerald-500 scale-[0.98]' 
                                      : 'border-stone-150 dark:border-stone-800 hover:border-emerald-500/40'
                                  }`}
                                >
                                  {canManageSchedules && (
                                    <div className="flex items-center justify-center p-1 text-stone-400 hover:text-emerald-500 cursor-grab active:cursor-grabbing shrink-0" title="Drag to reorder segment">
                                      <GripVertical className="w-4 h-4" />
                                    </div>
                                  )}

                                  <div className={`w-8 h-8 rounded-xl ${seg.cardIconBg} ${seg.cardIconColor} flex items-center justify-center shrink-0 shadow-xs`}>
                                    <IconComp className="w-4 h-4" />
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <p className="text-[9px] text-stone-400 dark:text-stone-500 uppercase tracking-wider font-extrabold">{seg.label}</p>
                                    <p className="text-xs font-bold text-stone-800 dark:text-stone-100 truncate">{seg.value}</p>
                                  </div>

                                  {canManageSchedules && (
                                    <div className="flex items-center gap-0.5 opacity-80 group-hover/seg:opacity-100 transition-opacity">
                                      {idx > 0 && (
                                        <button
                                          onClick={() => handleReorderSegment(item.id, idx, idx - 1)}
                                          title="Move Up"
                                          className="p-1 text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                                        >
                                          <ChevronUp className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {idx < array.length - 1 && (
                                        <button
                                          onClick={() => handleReorderSegment(item.id, idx, idx + 1)}
                                          title="Move Down"
                                          className="p-1 text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                                        >
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Highlighted Service Announcement Card */}
                        {item.notes && (
                          <div className="bg-amber-50/40 dark:bg-amber-950/10 border border-amber-100/80 dark:border-amber-900/20 p-4 rounded-2xl shadow-3xs flex items-start gap-3">
                            <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 p-2 rounded-xl shrink-0">
                              <Megaphone className="w-4 h-4" />
                            </div>
                            <div className="space-y-1.5 flex-1">
                              <p className="text-[10px] text-amber-800 dark:text-amber-300 font-extrabold uppercase tracking-widest leading-relaxed">
                                📢 Service Announcements
                              </p>
                              <div className="text-stone-700 dark:text-stone-300 text-xs leading-relaxed font-semibold space-y-1">
                                {item.notes.split('\n').filter(line => line.trim() !== '').map((line, index) => (
                                  <p key={index} className="flex items-start gap-1.5">
                                    <span className="text-amber-500">•</span>
                                    <span>{line}</span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Interactive Controls (Hidden in PNG captures) */}
                    <div className="space-y-2 mt-2" data-html2canvas-ignore="true">
                      {/* Toggle Button */}
                      <button 
                        onClick={() => toggleExpand(item.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-stone-50 hover:bg-stone-100 dark:bg-stone-800/40 dark:hover:bg-stone-800 text-stone-600 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer border border-stone-150 dark:border-stone-800 shadow-3xs"
                      >
                        <span>{isItemExp ? 'Hide Service Program' : 'Toggle Service Program & Details'}</span>
                        {isItemExp ? <ChevronUp className="w-3.5 h-3.5 text-stone-500" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-500" />}
                      </button>

                      {/* Export, PDF, WhatsApp & Copy Link Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <button
                          onClick={() => handleCopyShareLink(item)}
                          className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer border shadow-3xs ${
                            copiedLinkId === item.id
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
                              : 'bg-white hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-850 text-stone-700 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100 border-stone-200 dark:border-stone-800'
                          }`}
                          title="Copy direct shareable link to clipboard"
                        >
                          {copiedLinkId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-white shrink-0" />
                          ) : (
                            <Link className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          )}
                          <span className="truncate">{copiedLinkId === item.id ? 'Copied Link' : 'Copy Link'}</span>
                        </button>

                        <button
                          onClick={() => handleExportPNG(item.id, item.title)}
                          disabled={isExporting !== null}
                          className="flex items-center justify-center gap-1.5 py-2 px-1 bg-white hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-850 text-stone-700 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100 rounded-xl text-[10px] font-bold transition-all cursor-pointer border border-stone-200 dark:border-stone-800 shadow-3xs disabled:opacity-50"
                          title="Save whole card as PNG image"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{isExporting === item.id ? 'Saving...' : 'Save PNG'}</span>
                        </button>

                        <button
                          onClick={() => handleExportPDF(item)}
                          disabled={isExporting !== null}
                          className="flex items-center justify-center gap-1.5 py-2 px-1 bg-white hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-850 text-stone-700 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100 rounded-xl text-[10px] font-bold transition-all cursor-pointer border border-stone-200 dark:border-stone-800 shadow-3xs disabled:opacity-50"
                          title="Download high-quality printable PDF schedule"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{isExporting === item.id ? 'PDF...' : 'Save PDF'}</span>
                        </button>

                        <button
                          onClick={() => handleShareWhatsApp(item)}
                          disabled={isExporting !== null}
                          className="flex items-center justify-center gap-1.5 py-2 px-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer border border-emerald-750 shadow-3xs disabled:opacity-50"
                          title="Share schedule to WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{isExporting === item.id ? 'Sharing...' : 'WhatsApp'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card Unified Footer */}
                  <div className="bg-stone-50 dark:bg-stone-950/20 px-6 py-3.5 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-400 dark:text-stone-505">
                    <div className="truncate max-w-[180px] sm:max-w-[200px]" title={`Creator: ${item.created_by_email}`}>
                      Logged by <span className="font-bold text-stone-700 dark:text-stone-300">{getCreatorRole(item.created_by_email, item.created_by_name)}</span>
                    </div>

                    {canManageSchedules && (
                      <div className="flex items-center gap-2 shrink-0" data-html2canvas-ignore="true">
                        <button
                          onClick={() => handleOpenForm(item)}
                          className="inline-flex items-center gap-1 text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-stone-100 hover:bg-stone-150/50 dark:hover:bg-stone-800/50 text-[11px] font-bold py-1 px-2.5 rounded-lg transition-all cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        {deleteConfirmId === item.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => {
                                handleDeleteSchedule(item.id);
                                setDeleteConfirmId(null);
                              }}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] py-1 px-2.5 rounded-lg transition-all cursor-pointer shadow-xs"
                              title="Confirm Deletion"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 font-bold text-[10px] py-1 px-2 rounded-lg transition-all cursor-pointer"
                              title="Cancel Deletion"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-450 hover:text-rose-900 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/15 active:bg-rose-100 text-[11px] font-bold py-1 px-2.5 rounded-lg transition-all cursor-pointer"
                            title="Remove Schedule"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Dedicated Off-Screen Poster Template for High-Fidelity PNG Export */}
                <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', overflow: 'hidden', pointerEvents: 'none' }}>
                  <div 
                    id={`schedule-poster-${item.id}`}
                    className="select-none text-white"
                    style={{ 
                      width: '720px', 
                      minHeight: '1080px', 
                      padding: '44px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justify: 'space-between', 
                      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
                      position: 'relative',
                      backgroundColor: '#0c0a09',
                      color: '#ffffff'
                    }}
                  >
                    {/* Background Artwork Layer */}
                    <div className="absolute inset-0">
                      <img 
                        src={item.thumbnail || "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=600&auto=format&fit=crop"} 
                        alt="" 
                        className="w-full h-full object-cover opacity-20 filter blur-[2px]"
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-stone-950/95 via-stone-950/90 to-stone-950" />
                      <div className="absolute inset-5 border border-emerald-500/20 rounded-3xl pointer-events-none" />
                    </div>

                    <div className="relative z-10 flex-1 flex flex-col justify-between space-y-6">
                      
                      {/* Brand Header */}
                      <div className="flex flex-col items-center text-center space-y-2.5">
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                          <span className="text-[11px] font-black uppercase tracking-[0.3em]">SHALOM YOUTH FELLOWSHIP</span>
                        </div>
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Official Weekly Programme Schedule</p>
                      </div>

                      {/* Hero Programme Title & Theme Card */}
                      <div className="bg-stone-900/80 border border-emerald-500/30 rounded-2xl p-6 text-center shadow-xl space-y-3">
                        <h1 className="text-3xl font-black text-white tracking-tight uppercase leading-snug drop-shadow-md">
                          {item.title}
                        </h1>
                        {item.topic && (
                          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-xs font-semibold italic text-emerald-300">
                            <span>Theme:</span>
                            <span className="font-bold text-white">"{item.topic}"</span>
                          </div>
                        )}
                      </div>

                      {/* Quick Details Grid (Date, Time, Venue) */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-3.5 text-center shadow-sm">
                          <Calendar className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                          <p className="text-[9px] text-stone-400 uppercase font-black tracking-wider">Date</p>
                          <p className="text-xs font-black text-white mt-0.5">{item.date}</p>
                        </div>
                        <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-3.5 text-center shadow-sm">
                          <Clock className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                          <p className="text-[9px] text-stone-400 uppercase font-black tracking-wider">Time</p>
                          <p className="text-xs font-black text-white mt-0.5">{item.time}</p>
                        </div>
                        <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-3.5 text-center shadow-sm">
                          <MapPin className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                          <p className="text-[9px] text-stone-400 uppercase font-black tracking-wider">Venue</p>
                          <p className="text-xs font-black text-white mt-0.5 truncate">{item.venue || 'Shalom Sanctuary'}</p>
                        </div>
                      </div>

                      {/* Leadership & Sermon Segment Cards */}
                      <div className="grid grid-cols-2 gap-3.5">
                        {/* Speaker / Sermon Segment */}
                        <div className="bg-stone-900/90 border-l-4 border-l-emerald-500 border border-stone-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-md">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400">
                            <Mic className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] text-emerald-400 uppercase font-black tracking-wider">Sermon / Speaker</p>
                            <p className="text-sm font-black text-white truncate">{item.speaker}</p>
                          </div>
                        </div>

                        {/* Chairman / Leader Segment */}
                        <div className="bg-stone-900/90 border-l-4 border-l-amber-500 border border-stone-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-md">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] text-amber-400 uppercase font-black tracking-wider">Service Chairman</p>
                            <p className="text-sm font-black text-white truncate">{item.leader}</p>
                          </div>
                        </div>
                      </div>

                      {/* Order of Service Segment Cards */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 border-b border-stone-800 pb-2">
                          <BookOpen className="w-4 h-4 text-emerald-400" />
                          <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400">Order of Service Segments</h3>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                          {getSegmentsForItem(item).map((seg) => {
                            const IconComp = seg.icon;
                            return (
                              <div key={seg.key} className={`flex items-center justify-between p-3.5 ${seg.posterBg} border ${seg.posterBorder} rounded-2xl shadow-sm`}>
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                    <IconComp className="w-3.5 h-3.5" />
                                  </div>
                                  <span className={`text-xs ${seg.posterText} font-extrabold uppercase tracking-wide`}>{seg.label}</span>
                                </div>
                                <span className="text-xs font-black text-white text-right max-w-[60%] truncate">{seg.value}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Service Announcements Segment Card */}
                      {item.notes && (
                        <div className="bg-amber-950/30 border border-amber-500/30 p-4 rounded-2xl space-y-2 shadow-md">
                          <div className="flex items-center gap-2">
                            <Megaphone className="w-4 h-4 text-amber-400 shrink-0" />
                            <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest">📢 Service Announcements</p>
                          </div>
                          <div className="text-stone-200 text-xs font-semibold leading-relaxed space-y-1 pl-1">
                            {item.notes.split('\n').filter(line => line.trim() !== '').map((line, index) => (
                              <p key={index} className="flex items-start gap-1.5">
                                <span className="text-amber-400 font-bold">•</span>
                                <span>{line}</span>
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Footer Logo & Creator Reference */}
                      <div className="flex items-center justify-between border-t border-stone-800 pt-4 text-[10px] text-stone-400 uppercase font-mono tracking-wider">
                        <span>Logged by: {getCreatorRole(item.created_by_email, item.created_by_name)}</span>
                        <span className="text-emerald-400 font-extrabold">Shalom Youth Fellowship</span>
                      </div>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-stone-150 dark:border-stone-850 bg-white dark:bg-stone-900 px-4 py-3.5 sm:px-6 rounded-2xl shadow-xxs">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-xl border border-stone-250 dark:border-stone-700 bg-white dark:bg-stone-850 px-4 py-2 text-xs font-bold text-stone-700 dark:text-stone-350 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="relative ml-3 inline-flex items-center rounded-xl border border-stone-250 dark:border-stone-700 bg-white dark:bg-stone-850 px-4 py-2 text-xs font-bold text-stone-700 dark:text-stone-355 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Showing <span className="font-extrabold text-stone-800 dark:text-stone-200">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                <span className="font-extrabold text-stone-800 dark:text-stone-200">{Math.min(currentPage * itemsPerPage, filteredSchedules.length)}</span> of{' '}
                <span className="font-extrabold text-stone-800 dark:text-stone-200">{filteredSchedules.length}</span> schedules
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-xl gap-1" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-extrabold text-stone-555 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-extrabold text-stone-555 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  Prev
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = currentPage;
                  if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  if (pageNum < 1 || pageNum > totalPages) return null;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`relative inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${
                        currentPage === pageNum
                          ? 'z-10 bg-emerald-600 text-white shadow-xs'
                          : 'text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-extrabold text-stone-555 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-extrabold text-stone-555 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  Last
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* modal create/update form layout */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-stone-150 flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="p-6 border-b border-stone-150 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-stone-900">
                  {editingSchedule ? 'Modify Service Schedule' : 'Create Youth Service Schedule'}
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Update leadership, timing, and topic details for youth fellowship.
                </p>
              </div>
              <button 
                onClick={handleCloseForm}
                className="text-stone-400 hover:text-stone-700 transition-all text-xs font-bold p-2 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body form */}
            <form onSubmit={handleFormSubmit} className="p-6 overflow-y-auto space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-800 p-3.5 rounded-xl border border-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] text-stone-500 font-extrabold uppercase tracking-wider block">Event Title *</label>
                <input
                  type="text"
                  placeholder="e.g., Youth Fellowship & Worship Service"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-850 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-semibold"
                  required
                />
              </div>

              {/* Event Image Banner (Thumbnail / Cover Photo) */}
              <div className="space-y-3 p-4 bg-stone-50/50 rounded-2xl border border-stone-200/80">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-stone-600 font-extrabold uppercase tracking-widest block">Service Banner Cover (Optional)</label>
                  {formThumbnail && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormThumbnail('');
                        setThumbnailUploadError(null);
                      }}
                      className="text-[9px] font-black text-rose-600 uppercase hover:underline cursor-pointer"
                    >
                      Clear Cover Photo
                    </button>
                  )}
                </div>

                {/* Banner Preview */}
                {formThumbnail ? (
                  <div className="w-full h-28 rounded-xl relative overflow-hidden bg-stone-100 border border-stone-200 shadow-xs group/banner">
                    <img
                      src={formThumbnail}
                      alt="Banner Preview"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover/banner:scale-102"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 right-2 bg-emerald-600/90 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded shadow">
                      {formThumbnail.includes('schedules/thumb_') ? 'Custom Banner Selected' : 'Preset Banner Selected'}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-stone-900/60 backdrop-blur-xs p-1.5 text-white text-[8px] flex items-center justify-between">
                      <span className="font-semibold truncate max-w-[200px]">{formThumbnail.split('/').pop() || 'banner_image'}</span>
                      <span className="font-extrabold uppercase text-[7px] text-emerald-300">Before Saving</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-16 bg-white/70 rounded-xl border border-dashed border-stone-300 flex items-center justify-center text-[10px] text-stone-400 font-medium italic">
                    No cover banner selected. Banner defaults to gradient context.
                  </div>
                )}

                {/* Uploading Progress Indicator */}
                {isThumbnailUploading && (
                  <div className="space-y-1 p-2 bg-emerald-50/40 border border-emerald-100/30 rounded-xl">
                    <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider text-emerald-600">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 border-2 border-t-transparent border-emerald-600 rounded-full animate-spin"></span>
                        Uploading Custom Banner to Supabase Bucket...
                      </span>
                      <span>{thumbnailUploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-stone-200/80 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-600 transition-all duration-150 rounded-full"
                        style={{ width: `${thumbnailUploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Upload Specific Error Display with Dismiss/Retry buttons */}
                {thumbnailUploadError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[10px] leading-relaxed text-rose-800 space-y-1.5">
                    <p className="font-extrabold flex items-center gap-1 uppercase tracking-wider text-[9px]">
                      ⚠️ Cover Upload Failed
                    </p>
                    <p className="font-semibold">{thumbnailUploadError}</p>
                    <p className="text-[9px] text-stone-500">
                      Ensure the file size is under 2MB, your internet connection is active, and the file is a valid image.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button 
                        type="button"
                        onClick={() => document.getElementById('input-schedule-thumbnail')?.click()}
                        className="bg-rose-100 hover:bg-rose-200 px-2 py-1 rounded font-extrabold uppercase text-[8px] tracking-wider transition-colors cursor-pointer"
                      >
                        Try Another Image
                      </button>
                      <button 
                        type="button"
                        onClick={() => setThumbnailUploadError(null)}
                        className="text-stone-400 hover:text-stone-600 font-extrabold uppercase text-[8px] tracking-wider transition-colors cursor-pointer"
                      >
                        Dismiss Error
                      </button>
                    </div>
                  </div>
                )}

                {/* Preset List Selection */}
                <div className="space-y-1.5">
                  <p className="text-[9px] text-stone-500 font-extrabold uppercase tracking-wider">Select a Professional Design Preset:</p>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_COVERS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setFormThumbnail(preset.url);
                          setThumbnailUploadError(null);
                        }}
                        className={`relative h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                          formThumbnail === preset.url ? 'border-emerald-600 scale-95 ring-3 ring-emerald-500/15' : 'border-stone-200 hover:border-stone-300'
                        }`}
                        title={preset.name}
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[8px] text-white font-extrabold text-center py-0.5 truncate px-1">
                          {preset.id.toUpperCase()}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* File Upload Field */}
                <div className="space-y-1.5">
                  <p className="text-[9px] text-stone-500 font-extrabold uppercase tracking-wider">Or Upload Custom Image:</p>
                  <label
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (isThumbnailUploading) return;
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        handleThumbnailUpload(file);
                      }
                    }}
                    className="flex flex-col items-center justify-center p-3.5 bg-white border border-dashed border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50/50 hover:border-emerald-500 transition-all relative min-h-[90px]"
                  >
                    {isThumbnailUploading ? (
                      <div className="flex flex-col items-center justify-center text-center">
                        <span className="w-6 h-6 border-2 border-t-transparent border-emerald-600 rounded-full animate-spin mb-1"></span>
                        <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Uploading Custom Image...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center">
                        <Sparkles className="w-5 h-5 text-emerald-600 mb-0.5 shrink-0" />
                        <p className="text-[10px] text-stone-600 font-bold">
                          Click here to browse files <span className="text-stone-400">or drop image here</span>
                        </p>
                        <p className="text-[8px] text-stone-450 font-medium">PNG, JPG or JPEG up to 2MB</p>
                      </div>
                    )}
                    <input
                      type="file"
                      id="input-schedule-thumbnail"
                      accept="image/*"
                      className="hidden"
                      disabled={isThumbnailUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleThumbnailUpload(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-stone-500 font-extrabold uppercase tracking-wider block">Date *</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-850 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-semibold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-stone-500 font-extrabold uppercase tracking-wider block">Service Time *</label>
                  <input
                    type="text"
                    placeholder="e.g. 04:30 PM"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-850 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-stone-500 font-extrabold uppercase tracking-wider block">Speaker/Sermon *</label>
                  <input
                    type="text"
                    placeholder="e.g., Pastor Joseph Liam"
                    value={formSpeaker}
                    onChange={(e) => setFormSpeaker(e.target.value)}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-850 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-semibold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-stone-500 font-extrabold uppercase tracking-wider block">Chairman *</label>
                  <input
                    type="text"
                    placeholder="e.g. Tg. Do Lian"
                    value={formLeader}
                    onChange={(e) => setFormLeader(e.target.value)}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-850 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-stone-500 font-extrabold uppercase tracking-wider block">Solo (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Lia Rebecca"
                    value={formSolo}
                    onChange={(e) => setFormSolo(e.target.value)}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-850 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-stone-500 font-extrabold uppercase tracking-wider block">Sumpi Aapna (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Tg. Khup & Lia Ching"
                    value={formSumpiAapna}
                    onChange={(e) => setFormSumpiAapna(e.target.value)}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-850 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-stone-500 font-extrabold uppercase tracking-wider block">LST Simna & Quiz (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Sermon speed quiz"
                    value={formLstSimnaQuiz}
                    onChange={(e) => setFormLstSimnaQuiz(e.target.value)}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-850 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-stone-500 font-extrabold uppercase tracking-wider block">Sumpi khon ding (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Lia Niang"
                    value={formSumpiKhonDing}
                    onChange={(e) => setFormSumpiKhonDing(e.target.value)}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-850 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-stone-500 font-extrabold uppercase tracking-wider block">Venue (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., Shalom Sanctuary"
                    value={formVenue}
                    onChange={(e) => setFormVenue(e.target.value)}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-850 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-stone-500 font-extrabold uppercase tracking-wider block">Notes</label>
                <textarea
                  placeholder="e.g. Special instructions or devotional notes..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-850 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-semibold"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-stone-150 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 text-xs font-bold rounded-2xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-schedule-form"
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-2xl transition-all shadow-md cursor-pointer"
                >
                  {editingSchedule ? 'Modify Schedule' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

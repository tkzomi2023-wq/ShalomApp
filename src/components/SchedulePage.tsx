/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { toPng, toBlob } from 'html-to-image';
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
  Share2
} from 'lucide-react';

const PRESET_COVERS = [
  { id: 'worship', name: 'Worship Service', url: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=600&auto=format&fit=crop' },
  { id: 'bible', name: 'Bible Study', url: 'https://images.unsplash.com/photo-1504052434569-7c9602df539f?q=80&w=600&auto=format&fit=crop' },
  { id: 'fellowship', name: 'Youth Fellowship', url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=600&auto=format&fit=crop' },
  { id: 'study', name: 'Acoustic Prayer', url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=600&auto=format&fit=crop' }
];

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

  const captureCardAsBlob = async (itemId: string): Promise<{ blob: Blob | null, dataUrl: string | null }> => {
    const cardEl = document.getElementById(`schedule-card-${itemId}`);
    if (!cardEl) return { blob: null, dataUrl: null };

    const isAlreadyExpanded = expandedRecordId === itemId;
    
    if (!isAlreadyExpanded) {
      setExpandedRecordId(itemId);
      // Wait for React to render and expand the card
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    try {
      const targetEl = document.getElementById(`schedule-card-${itemId}`);
      if (!targetEl) return { blob: null, dataUrl: null };

      // html-to-image filter function to ignore interactive buttons/edit controls
      const filterFn = (node: Node) => {
        if (node instanceof HTMLElement) {
          if (node.getAttribute('data-html2canvas-ignore') === 'true') {
            return false;
          }
        }
        return true;
      };

      const options = {
        filter: filterFn,
        backgroundColor: '#ffffff',
        style: {
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
          borderRadius: '24px',
          transform: 'scale(1)',
        },
        pixelRatio: 2.5, // High definition capture
      };

      const dataUrl = await toPng(targetEl, options);
      const blob = await toBlob(targetEl, options);

      if (!isAlreadyExpanded) {
        setExpandedRecordId(null);
      }

      return { blob, dataUrl };
    } catch (error) {
      console.error('Error capturing card:', error);
      if (!isAlreadyExpanded) {
        setExpandedRecordId(null);
      }
      return { blob: null, dataUrl: null };
    }
  };

  const handleExportPNG = async (itemId: string, title: string) => {
    setIsExporting(itemId);
    try {
      const { dataUrl } = await captureCardAsBlob(itemId);
      if (dataUrl) {
        const link = document.createElement('a');
        link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-schedule.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(null);
    }
  };

  const handleShareWhatsApp = async (item: ServiceSchedule) => {
    setIsExporting(item.id);
    try {
      const { blob, dataUrl } = await captureCardAsBlob(item.id);
      
      if (navigator.share && blob) {
        try {
          const file = new File([blob], `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: item.title,
              text: `📅 *${item.title}*\n🗓️ Date: ${item.date}\n⏰ Time: ${item.time}\n🎤 Speaker: ${item.speaker}\n📍 Venue: ${item.venue}\n\nHere is our service schedule details:`,
              files: [file]
            });
            setIsExporting(null);
            return;
          }
        } catch (shareErr) {
          console.warn('Native share failed or cancelled, falling back to direct link:', shareErr);
        }
      }

      if (dataUrl) {
        const link = document.createElement('a');
        link.download = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-schedule.png`;
        link.href = dataUrl;
        link.click();
      }

      let shareText = `*📅 ${item.title.toUpperCase()}*\n`;
      shareText += `*🗓️ Date:* ${item.date}\n`;
      shareText += `*⏰ Time:* ${item.time}\n`;
      shareText += `*🎤 Speaker/Sermon:* ${item.speaker}\n`;
      shareText += `*👤 Chairman:* ${item.leader}\n\n`;
      
      if (item.lst_simna_quiz) shareText += `*📖 Bible/Quiz:* ${item.lst_simna_quiz}\n`;
      if (item.solo) shareText += `*🎵 Lasakna:* ${item.solo}\n`;
      if (item.sumpi_aapna) shareText += `*🙏 Sumpi Aap:* ${item.sumpi_aapna}\n`;
      if (item.sumpi_khon_ding) shareText += `*🤝 Sumpi khon Ding:* ${item.sumpi_khon_ding}\n`;
      if (item.venue) shareText += `*📍 Venue:* ${item.venue}\n`;
      if (item.notes) shareText += `\n*Announcements:* ${item.notes}\n`;
      
      shareText += `\n_(The service schedule flyer image has been downloaded. Please attach the image when sharing.)_`;

      const encodedText = encodeURIComponent(shareText);
      window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
      
    } catch (err) {
      console.error('WhatsApp share failed:', err);
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

          {/* Quick next meeting countdown widget */}
          {nextUpcomingService && (
            <div className="bg-stone-800/80 border border-stone-700/60 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-600/20 text-emerald-450 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-450 uppercase font-extrabold tracking-wider">Next Service Venue</p>
                  <h3 className="text-xs font-bold text-stone-100">{nextUpcomingService.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-stone-400">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-stone-500" /> {nextUpcomingService.date} • {nextUpcomingService.time}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-stone-500" /> {nextUpcomingService.venue}</span>
                  </div>
                </div>
              </div>
              <div className="text-left md:text-right border-t md:border-t-0 border-stone-750 pt-2 md:pt-0">
                <p className="text-[10px] text-stone-450 uppercase font-black">Speaker</p>
                <p className="text-xs font-bold text-white mt-0.5">{nextUpcomingService.speaker}</p>
                <p className="text-[10px] text-stone-400">Leader: {nextUpcomingService.leader}</p>
              </div>
            </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedSchedules.map((item) => {
            const isItemExp = expandedRecordId === item.id;
            const flagUpcoming = isUpcoming(item.date);

            return (
              <div 
                key={item.id}
                id={`schedule-card-${item.id}`}
                className={`group bg-white rounded-3xl border transition-all duration-300 overflow-hidden shadow-2xs hover:shadow-xs flex flex-col justify-between ${
                  flagUpcoming 
                    ? 'border-emerald-100 ring-2 ring-emerald-600/5' 
                    : 'border-stone-200 opacity-90'
                }`}
              >
                {/* Visual Thumbnail Cover Banner */}
                {item.thumbnail ? (
                  <div className="w-full h-40 relative overflow-hidden bg-stone-100 shrink-0">
                    <img 
                      src={item.thumbnail} 
                      alt={item.title} 
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/20 to-transparent"></div>
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest shadow-sm ${
                        flagUpcoming 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-stone-800 text-stone-300'
                      }`}>
                        {flagUpcoming ? 'Upcoming' : 'Concluded'}
                      </span>
                    </div>
                    
                    {/* Floating Date/Time on Image */}
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-black/45 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] font-mono text-stone-200 font-bold border border-white/15">
                        <Calendar className="w-3 h-3 text-emerald-400" />
                        <span>{item.date}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-black/45 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] font-mono text-stone-200 font-bold border border-white/15">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        <span>{item.time}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-28 bg-gradient-to-br from-emerald-800/90 to-emerald-950 relative overflow-hidden shrink-0 flex flex-col justify-between p-4">
                    {/* Decorative abstract elements */}
                    <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none"></div>
                    <div className="absolute -left-10 -top-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-lg pointer-events-none"></div>
                    
                    <div className="flex items-center justify-between w-full relative z-10">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Shalom Youth</span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest shadow-sm ${
                        flagUpcoming 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-stone-800 text-stone-300'
                      }`}>
                        {flagUpcoming ? 'Upcoming' : 'Concluded'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap relative z-10 mt-auto">
                      <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] font-mono text-white font-bold border border-white/5">
                        <Calendar className="w-3 h-3 text-emerald-300" />
                        <span>{item.date}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] font-mono text-white font-bold border border-white/5">
                        <Clock className="w-3 h-3 text-emerald-300" />
                        <span>{item.time}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Card Main Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  {/* Title and Topic */}
                  <div className="space-y-2">
                    <h4 className="text-base font-black text-stone-900 leading-relaxed tracking-tight hover:text-emerald-700 transition-colors cursor-pointer" onClick={() => toggleExpand(item.id)}>
                      {item.title}
                    </h4>
                    {item.topic && (
                      <p className="text-xs text-stone-500 italic font-medium bg-stone-50 py-1.5 px-3 rounded-lg border border-stone-100 inline-block leading-relaxed">
                        Topic: "{item.topic}"
                      </p>
                    )}
                  </div>

                  {/* Core details grid: Speaker & Chairman */}
                  <div className="grid grid-cols-2 gap-3.5 pt-3.5 border-t border-stone-100">
                    <div className="bg-stone-50/50 p-3 rounded-2xl border border-stone-100/80 hover:bg-stone-50 transition-colors">
                      <p className="text-[9px] text-stone-400 font-extrabold uppercase tracking-wider mb-1 leading-relaxed">Speaker/Sermon</p>
                      <div className="flex items-center gap-2 text-stone-850 font-bold text-xs leading-relaxed">
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-emerald-700" />
                        </div>
                        <span className="truncate">{item.speaker}</span>
                      </div>
                    </div>
                    <div className="bg-stone-50/50 p-3 rounded-2xl border border-stone-100/80 hover:bg-stone-50 transition-colors">
                      <p className="text-[9px] text-stone-400 font-extrabold uppercase tracking-wider mb-1 leading-relaxed">Chairman</p>
                      <div className="flex items-center gap-2 text-stone-850 font-bold text-xs leading-relaxed">
                        <div className="w-6 h-6 rounded-lg bg-stone-200/80 flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-stone-600" />
                        </div>
                        <span className="truncate">{item.leader}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Order of Service (Only shown when expanded) */}
                  {isItemExp && (
                    <div className="space-y-3.5 pt-3.5 border-t border-stone-100 animate-fadeIn">
                      {/* Unified Church Bulletin Sheet */}
                      <div className="bg-stone-50/60 rounded-2xl border border-stone-150 p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-stone-200/80 pb-2.5 mb-1.5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-stone-550 flex items-center gap-1.5 leading-relaxed">
                            <BookOpen className="w-3.5 h-3.5 text-emerald-600" /> Service Details
                          </span>
                          <span className="text-[9px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-extrabold uppercase tracking-wider leading-relaxed">
                            Bulletin
                          </span>
                        </div>

                        <div className="divide-y divide-stone-150/60 text-xs leading-relaxed">
                          {item.lst_simna_quiz && (
                            <div className="flex items-center justify-between py-2">
                              <span className="font-bold text-[10px] text-stone-400 uppercase tracking-wider leading-relaxed">Bible / Quiz</span>
                              <span className="font-extrabold text-stone-850 text-right max-w-[70%] truncate leading-relaxed" title={item.lst_simna_quiz}>{item.lst_simna_quiz}</span>
                            </div>
                          )}
                          
                          {item.solo && (
                            <div className="flex items-center justify-between py-2">
                              <span className="font-bold text-[10px] text-stone-400 uppercase tracking-wider leading-relaxed">Lasakna</span>
                              <span className="font-extrabold text-stone-850 text-right max-w-[70%] truncate leading-relaxed" title={item.solo}>{item.solo}</span>
                            </div>
                          )}
                          
                          {item.sumpi_aapna && (
                            <div className="flex items-center justify-between py-2">
                              <span className="font-bold text-[10px] text-stone-400 uppercase tracking-wider leading-relaxed">Sumpi Aap</span>
                              <span className="font-extrabold text-stone-850 text-right max-w-[70%] truncate leading-relaxed" title={item.sumpi_aapna}>{item.sumpi_aapna}</span>
                            </div>
                          )}
                          
                          {item.sumpi_khon_ding && (
                            <div className="flex items-center justify-between py-2">
                              <span className="font-bold text-[10px] text-stone-400 uppercase tracking-wider leading-relaxed">Sumpi khon Ding</span>
                              <span className="font-extrabold text-stone-850 text-right max-w-[70%] truncate leading-relaxed" title={item.sumpi_khon_ding}>{item.sumpi_khon_ding}</span>
                            </div>
                          )}

                          {item.venue && (
                            <div className="flex items-center justify-between py-2">
                              <span className="font-bold text-[10px] text-stone-400 uppercase tracking-wider leading-relaxed">Venue</span>
                              <span className="font-extrabold text-emerald-800 text-right max-w-[70%] truncate leading-relaxed" title={item.venue}>{item.venue}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Notes Section */}
                      {item.notes && (
                        <div className="space-y-1.5">
                          <p className="text-[9px] text-stone-400 font-extrabold uppercase tracking-wider leading-relaxed">Service Announcements</p>
                          <div className="text-stone-600 bg-emerald-50/25 border-l-2 border-emerald-500 p-3 rounded-r-xl text-xs leading-relaxed font-medium">
                            {item.notes}
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
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-stone-55 hover:bg-stone-100 text-stone-600 hover:text-stone-850 rounded-xl text-[11px] font-bold transition-all cursor-pointer border border-stone-150 shadow-3xs"
                    >
                      <span>{isItemExp ? 'Hide Service Program' : 'Toggle Service Program & Details'}</span>
                      {isItemExp ? <ChevronUp className="w-3.5 h-3.5 text-stone-500" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-500" />}
                    </button>

                    {/* Export & WhatsApp Row */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleExportPNG(item.id, item.title)}
                        disabled={isExporting !== null}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-900 rounded-xl text-[11px] font-bold transition-all cursor-pointer border border-stone-200 shadow-3xs disabled:opacity-50"
                        title="Save whole card as PNG image"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{isExporting === item.id ? 'Saving...' : 'Save PNG'}</span>
                      </button>
                      <button
                        onClick={() => handleShareWhatsApp(item)}
                        disabled={isExporting !== null}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer border border-emerald-750 shadow-3xs disabled:opacity-50"
                        title="Share schedule to WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{isExporting === item.id ? 'Sharing...' : 'WhatsApp'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Unified Footer */}
                <div className="bg-stone-50 px-5 py-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400">
                  <div className="truncate max-w-[180px] sm:max-w-[200px]" title={`Creator: ${item.created_by_email}`}>
                    Logged by <span className="font-bold text-stone-600">{item.created_by_name}</span>
                  </div>

                  {canManageSchedules && (
                    <div className="flex items-center gap-2 shrink-0" data-html2canvas-ignore="true">
                      <button
                        onClick={() => handleOpenForm(item)}
                        className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-900 hover:bg-stone-150 active:bg-stone-200 text-[11px] font-bold py-1 px-2.5 rounded-lg transition-all cursor-pointer"
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
                            className="bg-stone-200 hover:bg-stone-300 text-stone-600 font-bold text-[10px] py-1 px-2 rounded-lg transition-all cursor-pointer"
                            title="Cancel Deletion"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-900 hover:bg-rose-50 active:bg-rose-100 text-[11px] font-bold py-1 px-2.5 rounded-lg transition-all cursor-pointer"
                          title="Remove Schedule"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
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

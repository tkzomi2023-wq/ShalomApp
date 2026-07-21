import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Sparkles, 
  ShieldCheck, 
  Lock, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  Trash2, 
  UserCheck, 
  Plus, 
  X, 
  MessageSquare, 
  ChevronRight, 
  HelpCircle,
  EyeOff,
  Eye,
  Check,
  Edit3
} from 'lucide-react';
import { Member, PrayerRequest, PrayerCategory, isOBUser, DEFAULT_ADMIN_EMAIL } from '../types';
import { prayerService } from '../lib/prayers';

interface PrayerRequestsPageProps {
  currentUser: Member;
}

const PRAYER_CATEGORIES: PrayerCategory[] = [
  'General',
  'Health & Healing',
  'Family & Relationships',
  'Spiritual Growth',
  'Financial & Career',
  'Youth & Studies',
  'Urgent'
];

export const PrayerRequestsPage: React.FC<PrayerRequestsPageProps> = ({ currentUser }) => {
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'prayed'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Create Modal & Form state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<PrayerCategory>('General');
  const [newDetails, setNewDetails] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Modal State
  const [editingRequest, setEditingRequest] = useState<PrayerRequest | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editCategory, setEditCategory] = useState<PrayerCategory>('General');
  const [editDetails, setEditDetails] = useState<string>('');
  const [editIsAnonymous, setEditIsAnonymous] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // OB "Prayed For" Modal State
  const [prayedModalRequest, setPrayedModalRequest] = useState<PrayerRequest | null>(null);
  const [obNote, setObNote] = useState<string>('');
  const [isMarkingPrayed, setIsMarkingPrayed] = useState<boolean>(false);

  // View detail modal
  const [viewDetailRequest, setViewDetailRequest] = useState<PrayerRequest | null>(null);

  // Delete modal state
  const [deletingRequest, setDeletingRequest] = useState<PrayerRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const isOB = currentUser?.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || isOBUser(currentUser.role);

  useEffect(() => {
    loadPrayerRequests();
  }, [currentUser]);

  const loadPrayerRequests = async () => {
    setIsLoading(true);
    try {
      const data = await prayerService.getPrayerRequests(currentUser);
      setRequests(data);
    } catch (err) {
      console.error('Failed to load prayer requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDetails.trim()) {
      setFormError('Please fill in both the prayer title and details.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const created = await prayerService.createPrayerRequest(
        {
          title: newTitle,
          category: newCategory,
          details: newDetails,
          is_anonymous: isAnonymous
        },
        currentUser
      );

      // Optimistic state update
      setRequests(prev => [created, ...prev.filter(r => r.id !== created.id)]);

      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setIsSubmitModalOpen(false);
        setNewTitle('');
        setNewDetails('');
        setNewCategory('General');
        setIsAnonymous(true);
        loadPrayerRequests();
      }, 1200);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit prayer request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (req: PrayerRequest) => {
    setEditingRequest(req);
    setEditTitle(req.title);
    setEditCategory((req.category as PrayerCategory) || 'General');
    setEditDetails(req.details);
    setEditIsAnonymous(req.is_anonymous);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest) return;
    if (!editTitle.trim() || !editDetails.trim()) {
      alert('Title and details cannot be empty.');
      return;
    }

    setIsUpdating(true);
    try {
      await prayerService.updatePrayerRequest(
        editingRequest.id,
        {
          title: editTitle,
          category: editCategory,
          details: editDetails,
          is_anonymous: editIsAnonymous
        },
        currentUser
      );
      setEditingRequest(null);
      await loadPrayerRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to update prayer request.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmMarkAsPrayed = async () => {
    if (!prayedModalRequest) return;
    setIsMarkingPrayed(true);

    try {
      await prayerService.markAsPrayed(prayedModalRequest.id, currentUser, obNote);
      setPrayedModalRequest(null);
      setObNote('');
      await loadPrayerRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to update prayer status.');
    } finally {
      setIsMarkingPrayed(false);
    }
  };

  const handleMarkAsPending = async (requestId: string) => {
    try {
      await prayerService.markAsPending(requestId, currentUser);
      await loadPrayerRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRequest) return;
    const reqId = deletingRequest.id;
    setIsDeleting(true);
    try {
      // Optimistically remove from state immediately
      setRequests(prev => prev.filter(r => r.id !== reqId));
      if (viewDetailRequest?.id === reqId) setViewDetailRequest(null);
      
      await prayerService.deletePrayerRequest(reqId, currentUser);
      setDeletingRequest(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete prayer request.');
      // Reload on failure
      loadPrayerRequests();
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered requests
  const filteredRequests = requests.filter(req => {
    // Status tab filter
    if (activeTab === 'pending' && req.status !== 'pending') return false;
    if (activeTab === 'prayed' && req.status !== 'prayed') return false;

    // Category filter
    if (selectedCategory !== 'All' && req.category !== selectedCategory) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = req.title.toLowerCase().includes(q);
      const matchDetails = req.details.toLowerCase().includes(q);
      const matchCategory = req.category.toLowerCase().includes(q);
      const matchAuthor = req.user_name?.toLowerCase().includes(q);
      return matchTitle || matchDetails || matchCategory || matchAuthor;
    }

    return true;
  });

  const totalCount = requests.length;
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const prayedCount = requests.filter(r => r.status === 'prayed').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-900 to-stone-900 text-white p-6 sm:p-8 shadow-xl border border-emerald-800/40">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
              <span>Intercessory Prayer Ministry</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              Prayer Requests & Intercessions
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
              Share your confidential burdens and prayer needs. Our dedicated Office Bearer (OB) intercessors stand in agreement with you in prayer.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setFormError(null);
                setSubmitSuccess(false);
                setIsSubmitModalOpen(true);
              }}
              className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs sm:text-sm rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all cursor-pointer flex items-center gap-2 shrink-0 uppercase tracking-wider"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Post Prayer Request</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Controls & Search Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              All Requests ({totalCount})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'pending' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setActiveTab('prayed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'prayed' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Prayed For ({prayedCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search by title, topic or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Category:
          </span>
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'All'
                ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
            }`}
          >
            All
          </button>
          {PRAYER_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Prayer Requests List */}
      {isLoading ? (
        <div className="p-12 text-center bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">Loading prayer requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Heart className="w-6 h-6 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-white">No prayer requests found</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'All' 
              ? 'Try adjusting your search or category filters.'
              : isOB 
                ? 'No prayer requests have been submitted yet.'
                : 'You have not submitted any prayer requests yet. Click "Post Prayer Request" above to share your need.'}
          </p>
          <button
            onClick={() => setIsSubmitModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5 mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>Post Prayer Request</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRequests.map(req => {
            const isPrayed = req.status === 'prayed';
            const isOwner = req.user_id === currentUser.id || (req.user_email && currentUser.email && req.user_email.toLowerCase() === currentUser.email.toLowerCase());

            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-stone-900 rounded-2xl p-5 border transition-all shadow-xs hover:shadow-md flex flex-col justify-between relative overflow-hidden ${
                  isPrayed 
                    ? 'border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/20 via-transparent to-transparent' 
                    : 'border-stone-200/80 dark:border-stone-800'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Badges & Meta */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        req.category === 'Urgent'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60'
                          : req.category === 'Health & Healing'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}>
                        {req.category}
                      </span>

                      {/* Status Badge */}
                      {isPrayed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold shadow-2xs">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Prayed For</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold border border-amber-200 dark:border-amber-800">
                          <Clock className="w-3 h-3 animate-spin" />
                          <span>Pending Intercessions</span>
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] font-mono text-stone-400 shrink-0">
                      {new Date(req.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Title & Body */}
                  <div>
                    <h3 className="text-base font-extrabold text-stone-900 dark:text-white leading-snug">
                      {req.title}
                    </h3>
                    <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed mt-1.5 line-clamp-3">
                      {req.details}
                    </p>
                  </div>

                  {/* OB Prayer Note (if prayed for) */}
                  {req.ob_note && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 fill-emerald-600 text-emerald-600" /> Note from OB Intercessor ({req.prayed_by_name || 'OB Committee'}):
                        </span>
                        {req.prayed_at && (
                          <span className="font-mono text-emerald-600/80">
                            {new Date(req.prayed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="italic text-emerald-800 dark:text-emerald-200">{req.ob_note}</p>
                    </div>
                  )}

                  {/* Author / Anonymous Indicator */}
                  <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-[11px] text-stone-500">
                    <div className="flex items-center gap-1.5">
                      {req.is_anonymous ? (
                        <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-100 dark:border-purple-900/30 text-[10px]">
                          <EyeOff className="w-3 h-3" />
                          <span>Anonymous Member</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-stone-700 dark:text-stone-300">
                          <UserCheck className="w-3 h-3 text-emerald-600" />
                          <span>{req.user_name || 'Member'}</span>
                        </span>
                      )}
                      {isOwner && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded">
                          Your Request
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => setViewDetailRequest(req)}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5 hover:underline cursor-pointer"
                    >
                      <span>View Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Footer Controls: OB Mark & Edit / Delete */}
                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isOB && (
                      isPrayed ? (
                        <button
                          onClick={() => handleMarkAsPending(req.id)}
                          className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          Mark Pending
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setPrayedModalRequest(req);
                            setObNote('');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-xs hover:shadow-emerald-600/20 transition-all cursor-pointer uppercase tracking-wider"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark as Prayed</span>
                        </button>
                      )
                    )}
                  </div>

                  {/* Edit & Delete Action Buttons (Owner or OB) */}
                  <div className="flex items-center gap-1">
                    {(isOB || isOwner) && (
                      <button
                        onClick={() => openEditModal(req)}
                        title="Edit Prayer Request"
                        className="p-1.5 text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}

                    {(isOB || isOwner) && (
                      <button
                        onClick={() => setDeletingRequest(req)}
                        title="Delete Prayer Request"
                        className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* --- MODAL: Submit New Prayer Request --- */}
      <AnimatePresence>
        {isSubmitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Heart className="w-5 h-5 fill-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-stone-900 dark:text-white">Post a Prayer Request</h2>
                  <p className="text-xs text-stone-500">Confidential request for the OB Committee intercessors</p>
                </div>
              </div>

              {submitSuccess ? (
                <div className="p-6 text-center space-y-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
                  <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-200">Prayer Request Received</h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Your prayer request has been logged confidentially. The OB Committee intercessors will pray for your need.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitRequest} className="space-y-4 pt-2">
                  {formError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
                      {formError}
                    </div>
                  )}

                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      Prayer Subject / Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Prayer for physical healing & upcoming medical test"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Category */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as PrayerCategory)}
                      className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {PRAYER_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Details */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      Prayer Details <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Share as much context as you feel comfortable with. God knows your heart!"
                      value={newDetails}
                      onChange={(e) => setNewDetails(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Anonymous Checkbox */}
                  <div className="p-3.5 bg-purple-500/5 dark:bg-purple-500/10 rounded-xl border border-purple-500/20 space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-stone-300 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                        <EyeOff className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        Post Anonymously (Hide Identity)
                      </span>
                    </label>
                    <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80 leading-relaxed pl-6">
                      {isAnonymous
                        ? 'Your name will be hidden as "Anonymous Member". OB members will see the request content without your name.'
                        : `Your request will be visible to OB members with your name (${currentUser.display_name || currentUser.name}).`}
                    </p>
                  </div>

                  {/* Privacy Banner */}
                  <div className="p-3 bg-stone-100 dark:bg-stone-850 rounded-xl text-[11px] text-stone-500 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Only authorized Office Bearers (OB Committee) can view submitted prayer requests.</span>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsSubmitModalOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 uppercase tracking-wider"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit Request</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL: Edit Prayer Request --- */}
      <AnimatePresence>
        {editingRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setEditingRequest(null)}
                className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Edit3 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-stone-900 dark:text-white">Edit Prayer Request</h2>
                  <p className="text-xs text-stone-500">Update request details or title</p>
                </div>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4 pt-2">
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    Prayer Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as PrayerCategory)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {PRAYER_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Details */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    Prayer Details
                  </label>
                  <textarea
                    rows={4}
                    value={editDetails}
                    onChange={(e) => setEditDetails(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Anonymous Checkbox */}
                <div className="p-3 bg-purple-500/5 dark:bg-purple-500/10 rounded-xl border border-purple-500/20">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editIsAnonymous}
                      onChange={(e) => setEditIsAnonymous(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-stone-300 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                      <EyeOff className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      Post Anonymously
                    </span>
                  </label>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingRequest(null)}
                    className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 uppercase tracking-wider"
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL: OB Mark as Prayed For --- */}
      <AnimatePresence>
        {prayedModalRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-stone-900 rounded-2xl max-w-md w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl relative space-y-4"
            >
              <button
                onClick={() => setPrayedModalRequest(null)}
                className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-black text-stone-900 dark:text-white">Mark as Prayed For</h2>
                  <p className="text-xs text-stone-500">OB Committee Intercession Confirmation</p>
                </div>
              </div>

              <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200 dark:border-stone-800 text-xs space-y-1">
                <p className="font-bold text-stone-900 dark:text-white">{prayedModalRequest.title}</p>
                <p className="text-stone-500 line-clamp-2 text-[11px]">{prayedModalRequest.details}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  Optional OB Prayer Note / Encouragement
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. The OB Committee interceded for you during our prayer gathering today. God bless you!"
                  value={obNote}
                  onChange={(e) => setObNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-xl text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-stone-400">This note will be attached to the request so the member knows OBs prayed for them.</p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPrayedModalRequest(null)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMarkAsPrayed}
                  disabled={isMarkingPrayed}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 uppercase tracking-wider"
                >
                  {isMarkingPrayed ? 'Updating...' : 'Confirm Prayed For'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL: View Full Request Details --- */}
      <AnimatePresence>
        {viewDetailRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setViewDetailRequest(null)}
                className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {viewDetailRequest.category}
                  </span>
                  {viewDetailRequest.status === 'prayed' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-white">
                      Prayed For
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Pending Intercessions
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-black text-stone-900 dark:text-white leading-snug">
                  {viewDetailRequest.title}
                </h2>

                <div className="text-xs text-stone-400 flex items-center gap-3">
                  <span>Posted: {new Date(viewDetailRequest.created_at).toLocaleString()}</span>
                  <span>•</span>
                  <span>{viewDetailRequest.is_anonymous ? 'Anonymous Member' : viewDetailRequest.user_name}</span>
                </div>
              </div>

              <div className="p-4 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200 dark:border-stone-800 text-xs sm:text-sm text-stone-800 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">
                {viewDetailRequest.details}
              </div>

              {viewDetailRequest.ob_note && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                  <p className="font-extrabold text-[10px] uppercase text-emerald-700 dark:text-emerald-400">
                    OB Intercessor Note ({viewDetailRequest.prayed_by_name}):
                  </p>
                  <p className="italic">{viewDetailRequest.ob_note}</p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                {(isOB || viewDetailRequest.user_id === currentUser.id || (viewDetailRequest.user_email && currentUser.email && viewDetailRequest.user_email.toLowerCase() === currentUser.email.toLowerCase())) && (
                  <button
                    onClick={() => setDeletingRequest(viewDetailRequest)}
                    className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Request</span>
                  </button>
                )}

                <button
                  onClick={() => setViewDetailRequest(null)}
                  className="px-4 py-2 bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-bold text-xs rounded-xl cursor-pointer ml-auto"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL: Delete Confirmation Modal --- */}
      <AnimatePresence>
        {deletingRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-stone-900 rounded-2xl max-w-md w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl relative space-y-4"
            >
              <button
                onClick={() => setDeletingRequest(null)}
                className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-stone-900 dark:text-white">Delete Prayer Request?</h2>
                  <p className="text-xs text-stone-500">This action cannot be undone.</p>
                </div>
              </div>

              <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200 dark:border-stone-800 text-xs space-y-1">
                <p className="font-bold text-stone-900 dark:text-white">{deletingRequest.title}</p>
                <p className="text-stone-500 line-clamp-2 text-[11px]">{deletingRequest.details}</p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingRequest(null)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 uppercase tracking-wider"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Request'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

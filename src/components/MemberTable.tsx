/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Member, UserRole, ALL_ROLES, OB_ROLES, isOBUser, DEFAULT_ADMIN_EMAIL, formatMemberName, getDefaultAvatar, getCleanAvatar } from '../types';
import { RoleBadge } from './RoleBadge';
import { CallButtons } from './calling/CallButtons';
import { 
  Search, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Grid, 
  List, 
  Trash2, 
  Edit2, 
  Check, 
  ArrowUpDown,
  FileText,
  X,
  AlertTriangle,
  ShieldCheck,
  IdCard,
  Sparkles
} from 'lucide-react';
import { financialsDb, BialConfig } from '../lib/financials';
import { useAuth } from '../lib/auth';
import { MemberIDCardModal } from './MemberIDCardModal';

interface MemberTableProps {
  members: Member[];
  onUpdateRoleAndStatus: (id: string, role: UserRole, status: 'approved' | 'pending' | 'rejected') => void;
  onDeleteMember: (id: string) => void;
  onBatchApproveMembers?: (ids: string[]) => void;
  onBatchDeleteMembers?: (ids: string[]) => void;
  onBulkAssignBial?: (ids: string[], bial: string) => Promise<void>;
  onOpenProfile: (member: Member, editMode?: boolean) => void;
  isCurrentUserAdmin: boolean;
  onlineUserIds?: string[];
  initialStatusFilter?: 'All' | 'pending' | 'approved' | 'rejected';
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.02
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      type: "spring", 
      stiffness: 110, 
      damping: 15 
    } 
  }
};

export const MemberTable: React.FC<MemberTableProps> = ({
  members,
  onUpdateRoleAndStatus,
  onDeleteMember,
  onBatchApproveMembers,
  onBatchDeleteMembers,
  onBulkAssignBial,
  onOpenProfile,
  isCurrentUserAdmin,
  onlineUserIds = [],
  initialStatusFilter
}) => {
  const { user: currentUser } = useAuth();
  const canChangeRole = currentUser?.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'pending' | 'approved' | 'rejected'>(initialStatusFilter || 'All');

  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
    }
  }, [initialStatusFilter]);
  const [roleGroupFilter, setRoleGroupFilter] = useState<'All' | 'standard' | 'ECM' | 'OB'>('All');
  const [sortBy, setSortBy] = useState<'name' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [updateConfirm, setUpdateConfirm] = useState<{
    memberId: string;
    memberName: string;
    currentRole: UserRole;
    currentStatus: 'approved' | 'pending' | 'rejected';
    targetRole: UserRole;
    targetStatus: 'approved' | 'pending' | 'rejected';
    type: 'role' | 'status';
  } | null>(null);

  // Batch selection and action states
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isBatchApproveConfirmOpen, setIsBatchApproveConfirmOpen] = useState(false);
  const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);
  const [idCardMember, setIdCardMember] = useState<Member | null>(null);

  // PDF & Bial States
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'filtered' | 'full'>('filtered');
  const [financialRecords, setFinancialRecords] = useState<any[]>([]);
  const [bialConfigs, setBialConfigs] = useState<BialConfig[]>([]);

  const animKey = `${currentPage}_${viewMode}_${searchTerm}_${statusFilter}_${roleGroupFilter}`;

  const AVAILABLE_COLUMNS = [
    { id: 'name', label: 'Name' },
    { id: 'email', label: 'Email Address' },
    { id: 'phone', label: 'Phone Number' },
    { id: 'bial', label: 'Bial Area' },
    { id: 'blood_group', label: 'Blood' },
    { id: 'address', label: 'Residential Address' },
    { id: 'role', label: 'Role' },
    { id: 'status', label: 'Status' }
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'name', 'email', 'phone', 'bial', 'blood_group', 'address'
  ]);

  // Load Bial settings and financial records for resolving member Bials
  useEffect(() => {
    const loadData = async () => {
      try {
        const [recs, configs] = await Promise.all([
          financialsDb.getFinancialRecords(),
          financialsDb.getBialConfigs()
        ]);
        setFinancialRecords(recs);
        setBialConfigs(configs);
      } catch (err) {
        console.warn('Error loading financial or Bial data for directory resolver:', err);
      }
    };
    loadData();
  }, [members]);

  const getMemberBial = (member: Member): string => {
    if (member.bial) {
      return member.bial;
    }
    const memberName = member.name;
    const memberAddress = member.address;
    const normalizedName = memberName.trim().toLowerCase();
    
    const stripPrefix = (s: string) => {
      return s
        .replace(/^(tg\.|tg\s+|lia\s+|lia\.|pa\s+|pa\.|sia\s+|sia\.)/gi, '')
        .trim();
    };
    const strippedMember = stripPrefix(normalizedName);
    
    // First, try matching exactly by name or prefix-stripped name in the financial records
    const recordMatch = financialRecords.find(r => {
      const rName = r.name.trim().toLowerCase();
      return rName === normalizedName || stripPrefix(rName) === strippedMember;
    });
    if (recordMatch) {
      return recordMatch.area; // e.g. "Bial 1"
    }

    // Second, check if the member's address mentions a Bial area or ID (e.g., "Bial 1", "Bial 2")
    if (memberAddress) {
      const addrLower = memberAddress.toLowerCase();
      const matchBialPattern = addrLower.match(/bial\s*(\d+)/i);
      if (matchBialPattern && matchBialPattern[1]) {
        return `Bial ${matchBialPattern[1]}`;
      }
      
      const configMatch = bialConfigs.find(config => {
        if (!config.area || config.area === 'TBD') return false;
        const areaWords = config.area.toLowerCase().split(/[\s,-]+/);
        return areaWords.some(word => word.length > 4 && addrLower.includes(word));
      });
      if (configMatch) {
        return configMatch.id;
      }
    }

    return 'Not Assigned';
  };

  const generateMembersPdf = (scope: 'filtered' | 'full') => {
    if (!currentUser || !isOBUser(currentUser.role)) {
      alert('You do not have permission to download the report.');
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const listToExport = scope === 'filtered' ? filteredMembers : members;
      
      // Order alphabetically in ascending order by name
      const sortedList = [...listToExport].sort((a, b) => {
        const nameA = a.display_name || a.name;
        const nameB = b.display_name || b.name;
        return nameA.localeCompare(nameB);
      });

      const primaryColor = [16, 185, 129]; // Emerald-600
      const secondaryColor = [30, 41, 59]; // Slate-800
      const grayColor = [100, 116, 139]; // Slate-500

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('SHALOM YOUTH CORE', 14, 20);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('MEMBERS DIRECTORY REGISTER', 14, 27);

      // Metadata block
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text('Scope: ', 14, 34);
      doc.setFont('helvetica', 'normal');
      doc.text(scope === 'filtered' ? 'Filtered List' : 'Full Directory', 26, 34);

      doc.setFont('helvetica', 'bold');
      doc.text('Total Records: ', 14, 39);
      doc.setFont('helvetica', 'normal');
      doc.text(`${sortedList.length} registered members`, 38, 39);

      // Date Generated
      doc.setFont('helvetica', 'bold');
      doc.text('Generated: ', 140, 34);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date().toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }), 158, 34);

      doc.setFont('helvetica', 'bold');
      doc.text('Order: ', 140, 39);
      doc.setFont('helvetica', 'normal');
      doc.text('Alphabetical (A-Z) [Ascending]', 151, 39);

      // Divider Line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(14, 43, 196, 43);

      // Table prep with dynamic columns
      const headers = ['#'];
      AVAILABLE_COLUMNS.forEach(col => {
        if (selectedColumns.includes(col.id)) {
          headers.push(col.label);
        }
      });
      
      const rows = sortedList.map((m, idx) => {
        const bial = getMemberBial(m);
        const row = [(idx + 1).toString()];
        AVAILABLE_COLUMNS.forEach(col => {
          if (selectedColumns.includes(col.id)) {
            if (col.id === 'name') row.push(formatMemberName(m.display_name || m.name, m.gender, m.marital_status));
            else if (col.id === 'email') row.push(m.email);
            else if (col.id === 'phone') row.push(m.phone || 'N/A');
            else if (col.id === 'bial') row.push(bial);
            else if (col.id === 'blood_group') row.push(m.blood_group || 'N/A');
            else if (col.id === 'address') row.push(m.address || 'N/A');
            else if (col.id === 'role') row.push(m.role);
            else if (col.id === 'status') row.push(m.status.toUpperCase());
          }
        });
        return row;
      });

      // Dynamic column styles mapping
      const columnStyles: { [key: number]: any } = {
        0: { cellWidth: 8, halign: 'center' }
      };
      let colIdx = 1;
      AVAILABLE_COLUMNS.forEach(col => {
        if (selectedColumns.includes(col.id)) {
          if (col.id === 'name') {
            columnStyles[colIdx] = { fontStyle: 'bold' };
          } else if (col.id === 'blood_group' || col.id === 'status') {
            columnStyles[colIdx] = { halign: 'center' };
          }
          colIdx++;
        }
      });

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 48,
        theme: 'striped',
        headStyles: {
          fillColor: [16, 185, 129], // Emerald-600
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'left'
        },
        columnStyles,
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          valign: 'middle',
          overflow: 'linebreak'
        },
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(148, 163, 184); // Slate-400
          
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            14,
            doc.internal.pageSize.height - 10
          );
          
          doc.text(
            `Shalom Youth Core Directory • Confidential Administrative Document`,
            doc.internal.pageSize.width - 14,
            doc.internal.pageSize.height - 10,
            { align: 'right' }
          );
        }
      });

      doc.save(`shalom_youth_members_directory_${scope}_${new Date().toISOString().split('T')[0]}.pdf`);
      setIsPdfModalOpen(false);
    } catch (e) {
      console.error('Error generating members list PDF:', e);
      alert('An error occurred while generating the PDF. Please try again.');
    }
  };

  // Reset page and clear selection when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedMemberIds([]);
  }, [searchTerm, statusFilter, roleGroupFilter, sortBy, sortOrder]);

  // Clear batch selection when page changes
  useEffect(() => {
    setSelectedMemberIds([]);
  }, [currentPage]);

  // Multi-tier filtering
  const filteredMembers = members.filter(member => {
    // Search filter
    const matchesSearch = 
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.display_name && member.display_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (member.username && member.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.phone && member.phone.includes(searchTerm)) ||
      (member.blood_group && member.blood_group.toLowerCase().includes(searchTerm.toLowerCase()));

    // Status filter
    const matchesStatus = statusFilter === 'All' || member.status === statusFilter;

    // Role Group filter
    let matchesRoleGroup = true;
    if (roleGroupFilter === 'standard') {
      matchesRoleGroup = member.role === 'standard';
    } else if (roleGroupFilter === 'ECM') {
      matchesRoleGroup = member.role === 'ECM';
    } else if (roleGroupFilter === 'OB') {
      matchesRoleGroup = OB_ROLES.includes(member.role);
    }

    return matchesSearch && matchesStatus && matchesRoleGroup;
  }).sort((a, b) => {
    let checkA = sortBy === 'name' ? (a.display_name || a.name).toLowerCase() : a.created_at;
    let checkB = sortBy === 'name' ? (b.display_name || b.name).toLowerCase() : b.created_at;

    if (checkA < checkB) return sortOrder === 'asc' ? -1 : 1;
    if (checkA > checkB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const paginatedMembers = filteredMembers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSort = (field: 'name' | 'created_at') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleQuickApprove = (id: string, currentRole: UserRole) => {
    const member = members.find(m => m.id === id);
    if (!member) return;
    setUpdateConfirm({
      memberId: id,
      memberName: member.name,
      currentRole: currentRole,
      currentStatus: member.status,
      targetRole: currentRole,
      targetStatus: 'approved',
      type: 'status'
    });
  };

  const handleQuickReject = (id: string, currentRole: UserRole) => {
    const member = members.find(m => m.id === id);
    if (!member) return;
    setUpdateConfirm({
      memberId: id,
      memberName: member.name,
      currentRole: currentRole,
      currentStatus: member.status,
      targetRole: currentRole,
      targetStatus: 'rejected',
      type: 'status'
    });
  };

  const isAllOnPageSelected = paginatedMembers.length > 0 && paginatedMembers.every(m => m.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || selectedMemberIds.includes(m.id));

  const handleToggleSelectAllPage = () => {
    if (isAllOnPageSelected) {
      const pageIds = paginatedMembers.map(m => m.id);
      setSelectedMemberIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      const selectableIds = paginatedMembers
        .filter(m => m.email.toLowerCase() !== DEFAULT_ADMIN_EMAIL.toLowerCase())
        .map(m => m.id);
      setSelectedMemberIds(prev => {
        const unique = new Set([...prev, ...selectableIds]);
        return Array.from(unique);
      });
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Filtering Header Card */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-150 dark:border-stone-850 shadow-xs space-y-4">
        
        {/* Search bar & View toggle */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-stone-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search members by name, email, phone, blood group..."
              className="w-full pl-9 pr-4 py-2.5 text-xs bg-stone-50 dark:bg-stone-950/20 text-stone-900 border border-stone-200 dark:border-stone-850 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
            />
          </div>
          
          <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
            {currentUser && isOBUser(currentUser.role) && (
              <button
                onClick={() => {
                  setExportScope('filtered');
                  setIsPdfModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-800 text-white font-extrabold rounded-xl text-[11px] uppercase tracking-wider transition-all shadow-xs hover:shadow-md cursor-pointer select-none focus:outline-hidden focus:ring-2 focus:ring-rose-500/30"
                title="Generate customized Members Directory PDF"
              >
                <FileText className="w-4 h-4" />
                <span>Download PDF Report</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-850 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white transition-all cursor-pointer ${
                  viewMode === 'list' ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs' : ''
                }`}
                title="Spreadsheet View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs' : ''
                }`}
                title="Card Grid View"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Categories Tab selectors */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1 text-xs">
          
          {/* Status filter */}
          <div className="space-y-1.5">
            <span className="font-bold text-[10px] text-stone-400 uppercase tracking-wider">Approval Status</span>
            <div className="flex flex-wrap gap-1.5">
              {(['All', 'approved', 'pending', 'rejected'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition-all uppercase tracking-wide text-[10px] cursor-pointer ${
                    statusFilter === status
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {status === 'All' ? 'All Members' : status}
                </button>
              ))}
            </div>
          </div>

          {/* Group Category filter */}
          <div className="space-y-1.5">
            <span className="font-bold text-[10px] text-stone-400 uppercase tracking-wider">Role Groups</span>
            <div className="flex flex-wrap gap-1.5">
              {(['All', 'standard', 'ECM', 'OB'] as const).map(group => (
                <button
                  key={group}
                  onClick={() => setRoleGroupFilter(group)}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition-all uppercase tracking-wide text-[10px] cursor-pointer ${
                    roleGroupFilter === group
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {group === 'All' ? 'All Roles' : group === 'standard' ? 'Standard Only' : group === 'ECM' ? 'ECM Committee' : 'OB Officers'}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Query count indicator */}
      <div className="flex items-center justify-between px-1 text-xs text-stone-500">
        <span>Found <strong>{filteredMembers.length}</strong> youth register records</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleSort('name')}
            className="hover:text-stone-800 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            Name <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toggleSort('created_at')}
            className="hover:text-stone-800 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            Date Registered <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Batch Action Banner */}
      {isCurrentUserAdmin && selectedMemberIds.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 text-white rounded-xl">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-stone-900 dark:text-white text-xs">
                Batch Admin Control Mode
              </p>
              <p className="text-[10px] text-emerald-800 dark:text-emerald-350 font-bold">
                {selectedMemberIds.length} {selectedMemberIds.length === 1 ? 'member' : 'members'} selected
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setSelectedMemberIds([])}
              className="px-3 py-1.5 bg-white dark:bg-stone-900 border border-stone-250 dark:border-stone-800 text-stone-700 dark:text-stone-300 font-bold text-[11px] rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer transition-all uppercase tracking-wide"
            >
              Deselect All
            </button>

            {onBulkAssignBial && (
              <div className="flex items-center gap-1.5 bg-white dark:bg-stone-900 border border-stone-250 dark:border-stone-800 rounded-xl px-2.5 py-1.5 shadow-xs">
                <span className="text-[9px] font-black uppercase text-stone-500 tracking-wider">Assign Bial:</span>
                <select
                  onChange={async (e) => {
                    const targetBial = e.target.value;
                    if (!targetBial) return;
                    if (confirm(`Are you sure you want to assign the ${selectedMemberIds.length} selected members to "${targetBial}"?`)) {
                      await onBulkAssignBial(selectedMemberIds, targetBial);
                      setSelectedMemberIds([]);
                    }
                    e.target.value = '';
                  }}
                  className="bg-transparent border-0 p-0 pr-6 text-[11px] font-extrabold text-stone-700 dark:text-stone-300 focus:ring-0 cursor-pointer focus:outline-none"
                >
                  <option value="">Select Bial...</option>
                  {bialConfigs.length > 0 ? (
                    bialConfigs.map(b => (
                      <option key={b.id} value={b.id}>{b.area || b.id}</option>
                    ))
                  ) : (
                    Array.from({ length: 10 }).map((_, i) => (
                      <option key={`Bial ${i+1}`} value={`Bial ${i+1}`}>Bial {i+1}</option>
                    ))
                  )}
                </select>
              </div>
            )}
            
            {onBatchApproveMembers && (
              <button
                onClick={() => setIsBatchApproveConfirmOpen(true)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-xl cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1 shadow-xs hover:shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve Selected</span>
              </button>
            )}

            {onBatchDeleteMembers && (
              <button
                onClick={() => setIsBatchDeleteConfirmOpen(true)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] rounded-xl cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1 shadow-xs hover:shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty States */}
      {filteredMembers.length === 0 && (
        <div className="p-12 text-center bg-white border border-stone-150 rounded-2xl space-y-3">
          <ShieldAlert className="w-8 h-8 text-stone-300 mx-auto" />
          <div>
            <p className="font-bold text-stone-800 text-sm">No Members Match the Criteria</p>
            <p className="text-xs text-stone-500">Try loosening your search filters or check pending applications</p>
          </div>
        </div>
      )}

      {/* View layouts */}
      {viewMode === 'list' && filteredMembers.length > 0 ? (
        
        // SPREADSHEET LIST VIEW
        <div className="bg-white dark:bg-stone-900 border border-stone-150 dark:border-stone-850 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 dark:bg-stone-950/20 text-stone-400 font-extrabold uppercase tracking-wider border-b border-stone-150 dark:border-stone-850">
                  {isCurrentUserAdmin && (
                    <th className="py-2.5 sm:py-3 px-2 sm:px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllOnPageSelected}
                        onChange={handleToggleSelectAllPage}
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-stone-300 dark:border-stone-750 text-emerald-600 focus:ring-emerald-500/30 accent-emerald-600 cursor-pointer"
                        title="Select/deselect all on this page"
                      />
                    </th>
                  )}
                  <th className="py-2.5 sm:py-3 px-2 sm:px-4">Member Info</th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-4">Approval Status</th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-4">Assigned Role</th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-4">Bial Area</th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-4 hidden md:table-cell">Address Details</th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-4 text-right">Actions</th>
                </tr>
              </thead>
              <motion.tbody 
                key={animKey}
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="divide-y divide-stone-100 dark:divide-stone-850 text-stone-700"
              >
                {paginatedMembers.map(member => {
                  const isDefaultAdmin = member.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase();

                  return (
                    <motion.tr 
                      variants={itemVariants}
                      whileHover={{ scale: 1.002, x: 2, backgroundColor: "rgba(16, 185, 129, 0.04)" }}
                      transition={{ type: "tween", ease: "easeOut", duration: 0.12 }}
                      key={member.id} 
                      className={`hover:bg-emerald-50/20 dark:hover:bg-stone-850/40 transition-colors ${selectedMemberIds.includes(member.id) ? 'bg-emerald-50/10 dark:bg-emerald-950/10' : ''}`}
                    >
                      {isCurrentUserAdmin && (
                        <td className="py-2 sm:py-3.5 px-2 sm:px-4 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedMemberIds.includes(member.id)}
                            disabled={isDefaultAdmin}
                            onChange={() => {
                              if (selectedMemberIds.includes(member.id)) {
                                setSelectedMemberIds(prev => prev.filter(id => id !== member.id));
                              } else {
                                setSelectedMemberIds(prev => [...prev, member.id]);
                              }
                            }}
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-stone-300 dark:border-stone-750 text-emerald-600 focus:ring-emerald-500/30 accent-emerald-600 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </td>
                      )}
                      {/* Member Identifiers */}
                      <td className="py-2 sm:py-3.5 px-2 sm:px-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div 
                            onClick={() => onOpenProfile(member)}
                            className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full overflow-hidden bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 ${getCleanAvatar(member.avatar) || getDefaultAvatar(member.gender) ? '' : 'p-1.5 sm:p-2.5'} font-bold flex items-center justify-center text-xs sm:text-sm cursor-pointer select-none`}
                          >
                            {getCleanAvatar(member.avatar) || getDefaultAvatar(member.gender) ? (
                              <img src={getCleanAvatar(member.avatar) || getDefaultAvatar(member.gender)} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              member.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                              <button
                                onClick={() => onOpenProfile(member)}
                                className="font-bold text-stone-900 dark:text-white hover:text-emerald-600 block text-left text-[11px] sm:text-xs truncate max-w-[100px] sm:max-w-none"
                              >
                                {formatMemberName(member.display_name || member.name, member.gender, member.marital_status)}
                              </button>
                              <span 
                                className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${
                                  onlineUserIds.includes(member.id) 
                                    ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' 
                                    : 'bg-stone-300 dark:bg-stone-700'
                                }`} 
                                title={onlineUserIds.includes(member.id) ? "Online" : "Offline"}
                              />
                            </div>
                            <span className="text-stone-400 block break-words text-[9px] sm:text-[11px]">
                              {member.email} {member.phone ? `• ${member.phone}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Approval Status */}
                      <td className="py-2 sm:py-3.5 px-2 sm:px-4">
                        <div className="flex items-center gap-1">
                          {member.status === 'approved' ? (
                            <span className="inline-flex items-center gap-0.5 sm:gap-1 text-emerald-600 font-bold text-[9px] sm:text-[10px] uppercase tracking-wide bg-emerald-50 dark:bg-emerald-950/20 px-1 sm:px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Approved
                            </span>
                          ) : member.status === 'rejected' ? (
                            <span className="inline-flex items-center gap-0.5 sm:gap-1 text-rose-600 font-bold text-[9px] sm:text-[10px] uppercase tracking-wide bg-rose-50 dark:bg-rose-950/20 px-1 sm:px-2 py-0.5 rounded-md">
                              <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 sm:gap-1 text-amber-600 font-bold text-[9px] sm:text-[10px] uppercase tracking-wide bg-amber-50 dark:bg-amber-950/20 px-1 sm:px-2 py-0.5 rounded-md">
                              <ShieldAlert className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Pending Review</span><span className="sm:inline">Pending</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Role selection Dropdown for Admin */}
                      <td className="py-2 sm:py-3.5 px-2 sm:px-4">
                        {canChangeRole && !isDefaultAdmin ? (
                          <div className="flex flex-col gap-1 items-start">
                            <select
                              value={member.role}
                              onChange={(e) => {
                                const targetRole = e.target.value as UserRole;
                                if (targetRole !== member.role) {
                                  setUpdateConfirm({
                                    memberId: member.id,
                                    memberName: member.name,
                                    currentRole: member.role,
                                    currentStatus: member.status,
                                    targetRole: targetRole,
                                    targetStatus: member.status,
                                    type: 'role'
                                  });
                                }
                              }}
                              className="bg-stone-50 border border-stone-200 rounded-lg p-0.5 sm:p-1 text-[10px] sm:text-[11px] font-medium text-stone-700 hover:bg-stone-100 transition-colors focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                            >
                              {ALL_ROLES.map(r => (
                                <option key={r} value={r}>
                                  {r === 'standard' ? 'standard (Member)' : r}
                                </option>
                              ))}
                            </select>
                            {member.custom_title && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.25 rounded-md text-[9px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-100 dark:border-amber-900/30 uppercase tracking-wide">
                                <Sparkles className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                                <span>{member.custom_title}</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 items-start">
                            <RoleBadge role={member.role} />
                            {member.custom_title && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.25 rounded-md text-[9px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-100 dark:border-amber-900/30 uppercase tracking-wide">
                                <Sparkles className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                                <span>{member.custom_title}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Bial Area info */}
                      <td className="py-2 sm:py-3.5 px-2 sm:px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                          {getMemberBial(member)}
                        </span>
                      </td>

                      {/* Address info */}
                      <td className="py-2 sm:py-3.5 px-2 sm:px-4 text-stone-500 text-[11px] max-w-xs truncate hidden md:table-cell">
                        {member.address || <span className="italic text-stone-300">No Address Provided</span>}
                      </td>

                      {/* Immediate action triggers */}
                      <td className="py-2 sm:py-3.5 px-2 sm:px-4 text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                          {isCurrentUserAdmin && member.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleQuickApprove(member.id, member.role)}
                                className="p-1 px-1.5 sm:px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[9px] sm:text-[10px] uppercase tracking-wide flex items-center gap-0.5 sm:gap-1 transition-all cursor-pointer whitespace-nowrap"
                                title="Approve Membership"
                              >
                                <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Approve
                              </button>
                              <button
                                onClick={() => handleQuickReject(member.id, member.role)}
                                className="p-1 px-1 sm:px-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg text-[9px] sm:text-[10px] hover:text-stone-900 transition-colors cursor-pointer"
                                title="Reject Membership"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {currentUser && (isCurrentUserAdmin || currentUser.id === member.id || currentUser.email.toLowerCase() === member.email.toLowerCase()) && (
                            <button
                              onClick={() => onOpenProfile(member, true)}
                              className="p-1 sm:p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                              title="Detailed Member profile card"
                            >
                              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                          )}

                          {member.status === 'approved' && currentUser && currentUser.id !== member.id && (
                            <CallButtons member={member} size="sm" />
                          )}

                          {member.status === 'approved' && (
                            <button
                              type="button"
                              onClick={() => setIdCardMember(member)}
                              className="p-1 sm:p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-all cursor-pointer"
                              title="View & Print Member ID Card"
                            >
                              <IdCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                          )}

                          {isCurrentUserAdmin && !isDefaultAdmin && (
                            deleteConfirmId === member.id ? (
                              <div className="inline-flex items-center gap-0.5 sm:gap-1">
                                <button
                                  onClick={() => {
                                    onDeleteMember(member.id);
                                    setDeleteConfirmId(null);
                                  }}
                                  className="px-1.5 py-0.5 bg-rose-600 text-white font-bold rounded-lg text-[8px] sm:text-[9px] uppercase tracking-wide cursor-pointer"
                                  title="Confirm Delete"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-605 font-bold rounded-lg text-[8px] sm:text-[9px] uppercase tracking-wide cursor-pointer"
                                  title="Cancel"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(member.id)}
                                className="p-1 sm:p-1.5 text-stone-450 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                            )
                          )}
                        </div>
                      </td>

                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </table>
          </div>
        </div>

      ) : (

        // GRID CARD BOX VIEW
        <motion.div 
          key={animKey}
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
        >
          {paginatedMembers.map(member => {
            const isDefaultAdmin = member.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase();

            return (
              <motion.div 
                variants={itemVariants}
                whileHover={{ y: -4, scale: 1.015, boxShadow: "0 12px 20px -8px rgba(0, 0, 0, 0.08)" }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                key={member.id}
                className={`bg-white dark:bg-stone-900 border rounded-2xl p-5 hover:border-emerald-250 dark:hover:border-emerald-900 hover:shadow-md transition-all flex flex-col justify-between space-y-4 ${selectedMemberIds.includes(member.id) ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-stone-150 dark:border-stone-850'}`}
              >
                {/* Header Profile Identity */}
                <div className="flex items-start gap-3.5">
                  {isCurrentUserAdmin && (
                    <div className="pt-1 select-none shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(member.id)}
                        disabled={isDefaultAdmin}
                        onChange={() => {
                          if (selectedMemberIds.includes(member.id)) {
                            setSelectedMemberIds(prev => prev.filter(id => id !== member.id));
                          } else {
                            setSelectedMemberIds(prev => [...prev, member.id]);
                          }
                        }}
                        className="w-4 h-4 rounded border-stone-300 dark:border-stone-750 text-emerald-600 focus:ring-emerald-500/30 accent-emerald-600 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </div>
                  )}
                  <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden bg-emerald-50 text-emerald-800 font-extrabold flex items-center justify-center text-lg shadow-inner select-none">
                    {getCleanAvatar(member.avatar) || getDefaultAvatar(member.gender) ? (
                      <img src={getCleanAvatar(member.avatar) || getDefaultAvatar(member.gender)} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      member.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-1.5 w-full min-w-0">
                      <button
                        onClick={() => onOpenProfile(member)}
                        className="font-extrabold text-stone-900 dark:text-white hover:text-emerald-600 text-sm truncate text-left block"
                      >
                        {formatMemberName(member.display_name || member.name, member.gender, member.marital_status)}
                      </button>
                      <span 
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          onlineUserIds.includes(member.id) 
                            ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' 
                            : 'bg-stone-300 dark:bg-stone-700'
                        }`} 
                        title={onlineUserIds.includes(member.id) ? "Online" : "Offline"}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-stone-400 block truncate">{member.email}</span>
                    <span className="text-[10px] text-stone-400 block">{member.phone || 'No Phone'}</span>
                  </div>
                </div>

                {/* Badging indicator */}
                <div className="space-y-1.5">
                  <div className="flex flex-col gap-1 items-start">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-stone-300 uppercase">Role:</span>
                      <RoleBadge role={member.role} />
                    </div>
                    {member.custom_title && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-stone-300 uppercase">Title:</span>
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.25 rounded-md text-[9px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-100 dark:border-amber-900/30 uppercase tracking-wide">
                          <Sparkles className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                          <span>{member.custom_title}</span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-stone-300 uppercase">Status:</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      member.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : member.status === 'rejected'
                        ? 'bg-rose-50 text-rose-700 border border-rose-100'
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      {member.status}
                    </span>
                  </div>
                </div>

                {/* Quick actions row */}
                <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenProfile(member)}
                      className="text-stone-500 hover:text-stone-800 font-bold cursor-pointer whitespace-nowrap"
                    >
                      View Card
                    </button>
                    {member.status === 'approved' && (
                      <>
                        <span className="text-stone-300 dark:text-stone-700">|</span>
                        <button
                          type="button"
                          onClick={() => setIdCardMember(member)}
                          className="text-emerald-650 hover:text-emerald-800 font-black cursor-pointer flex items-center gap-0.5 whitespace-nowrap"
                        >
                          <IdCard className="w-3 h-3 text-emerald-600 shrink-0" /> ID Badge
                        </button>
                      </>
                    )}
                  </div>
                  
                  <div className="flex gap-1.5 items-center">
                    {member.status === 'approved' && currentUser && currentUser.id !== member.id && (
                      <CallButtons member={member} size="sm" />
                    )}

                    {isCurrentUserAdmin && member.status === 'pending' && (
                      <button
                        onClick={() => handleQuickApprove(member.id, member.role)}
                        className="bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wide px-2 py-1 rounded-md cursor-pointer"
                      >
                        Approve
                      </button>
                    )}

                    {isCurrentUserAdmin && !isDefaultAdmin && (
                      deleteConfirmId === member.id ? (
                        <div className="inline-flex items-center gap-1 animate-fade-in">
                          <button
                            onClick={() => {
                              onDeleteMember(member.id);
                              setDeleteConfirmId(null);
                            }}
                            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-md text-[9px] uppercase tracking-wide cursor-pointer"
                            title="Confirm Delete"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-605 font-bold rounded-md text-[9px] uppercase tracking-wide cursor-pointer"
                            title="Cancel"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(member.id)}
                          className="p-1 hover:bg-rose-50 hover:text-rose-600 rounded-md text-stone-450 cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Pagination Controls */}
      {(filteredMembers.length > 10 || totalPages > 1) && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-stone-150 dark:border-stone-800 bg-white dark:bg-stone-900 px-4 py-3.5 sm:px-6 rounded-2xl shadow-xxs gap-4">
          <div className="flex w-full items-center justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-xl border border-stone-250 dark:border-stone-700 bg-white dark:bg-stone-850 px-3 py-1.5 text-xs font-bold text-stone-700 dark:text-stone-350 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Previous
            </button>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400">
                Page {currentPage} of {Math.max(1, totalPages)}
              </span>
              <span className="text-stone-300 dark:text-stone-700">|</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="text-[11px] font-bold text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-lg px-1.5 py-0.5 focus:outline-hidden cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages <= 1}
              className="relative inline-flex items-center rounded-xl border border-stone-250 dark:border-stone-700 bg-white dark:bg-stone-850 px-3 py-1.5 text-xs font-bold text-stone-700 dark:text-stone-350 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>

          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between w-full">
            <div className="flex items-center gap-4">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Showing <span className="font-extrabold text-stone-800 dark:text-stone-200">{filteredMembers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                <span className="font-extrabold text-stone-800 dark:text-stone-200">{Math.min(currentPage * itemsPerPage, filteredMembers.length)}</span> of{' '}
                <span className="font-extrabold text-stone-800 dark:text-stone-200">{filteredMembers.length}</span> members
              </p>

              <div className="flex items-center gap-1.5 border-l border-stone-200 dark:border-stone-800 pl-4">
                <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">Per Page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="text-xs font-bold text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-lg px-2 py-1 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && (
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
            )}
          </div>
        </div>
      )}

      {/* EXPORT DIRECTORY PDF MODAL */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 bg-stone-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-md w-full flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800 p-6 space-y-5 animate-scale-up">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 dark:text-white text-base">
                    Generate Directory PDF
                  </h3>
                  <p className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">
                    Shalom Youth Core Report
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-750 dark:hover:text-stone-200 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector Options */}
            <div className="space-y-4 text-xs">
              
              <div className="space-y-2">
                <label className="block text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                  Select Export Scope
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setExportScope('filtered')}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      exportScope === 'filtered'
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-500/10'
                        : 'bg-white dark:bg-stone-950 border-stone-200 dark:border-stone-850 text-stone-700 dark:text-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    <span className="font-extrabold text-xs">Filtered Members</span>
                    <span className="text-[10px] text-stone-400 dark:text-stone-500 font-medium">
                      Exports {filteredMembers.length} currently filtered records
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportScope('full')}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      exportScope === 'full'
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-500/10'
                        : 'bg-white dark:bg-stone-950 border-stone-200 dark:border-stone-850 text-stone-700 dark:text-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    <span className="font-extrabold text-xs">All Members</span>
                    <span className="text-[10px] text-stone-400 dark:text-stone-500 font-medium">
                      Exports all {members.length} youth directory records
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                  Customize Columns to Include
                </label>
                <div className="grid grid-cols-2 gap-2 bg-stone-50 dark:bg-stone-950/40 p-3 rounded-2xl border border-stone-150 dark:border-stone-850">
                  {AVAILABLE_COLUMNS.map(col => {
                    const isSelected = selectedColumns.includes(col.id);
                    return (
                      <label
                        key={col.id}
                        className="flex items-center gap-2 text-stone-750 dark:text-stone-300 font-bold text-xs cursor-pointer select-none py-1 px-1.5 rounded-lg hover:bg-stone-150/40 dark:hover:bg-stone-900 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              if (selectedColumns.length > 1) {
                                setSelectedColumns(prev => prev.filter(c => c !== col.id));
                              }
                            } else {
                              setSelectedColumns(prev => [...prev, col.id]);
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500/30 accent-emerald-600 cursor-pointer"
                        />
                        <span>{col.id === 'blood_group' ? 'Blood Group' : col.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Informative alert box explaining layout/specifications */}
              <div className="p-3 bg-stone-50 dark:bg-stone-950/40 rounded-2xl border border-stone-150 dark:border-stone-850 text-stone-650 dark:text-stone-400 leading-relaxed text-[11px] space-y-1">
                <p className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  ✨ PDF Layout & Format Specs
                </p>
                <ul className="list-disc list-inside space-y-1 text-stone-500 dark:text-stone-400 text-[10.5px]">
                  <li>Ordered <strong>alphabetically ascending (A to Z)</strong> by member name</li>
                  <li>Includes <strong>official Bial Area</strong> lookup based on contribution registries</li>
                  <li>Formatted cleanly with full cell tables using <strong>jsPDF autoTable</strong></li>
                  <li>Predefined branding, pagination, and administrative tags</li>
                </ul>
              </div>

            </div>

            {/* Action Triggers */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(false)}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => generateMembersPdf(exportScope)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-sm hover:shadow-md cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONFIRM STATUS OR ROLE UPDATE MODAL */}
      {updateConfirm && (
        <div className="fixed inset-0 bg-stone-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-md w-full flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800 p-6 space-y-5 animate-scale-up">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-stone-900 dark:text-white text-base">
                  Confirm Modification
                </h3>
                <p className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">
                  Administrative Action Guard
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="text-xs text-stone-600 dark:text-stone-300 space-y-3">
              <p className="leading-relaxed">
                You are about to modify the registration details for <strong>{updateConfirm.memberName}</strong>.
              </p>
              
              <div className="p-3 bg-stone-50 dark:bg-stone-950/30 rounded-2xl border border-stone-150 dark:border-stone-850 space-y-2">
                {updateConfirm.type === 'role' ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-stone-400 dark:text-stone-500 font-extrabold uppercase tracking-wider">Role update:</span>
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <span className="px-2 py-0.5 bg-stone-200 dark:bg-stone-800 rounded-md text-stone-700 dark:text-stone-300">
                        {updateConfirm.currentRole}
                      </span>
                      <span className="text-stone-400">➔</span>
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 rounded-md">
                        {updateConfirm.targetRole}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-stone-400 dark:text-stone-500 font-extrabold uppercase tracking-wider">Membership status update:</span>
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] uppercase font-bold ${
                        updateConfirm.currentStatus === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : updateConfirm.currentStatus === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border border-rose-100'
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {updateConfirm.currentStatus}
                      </span>
                      <span className="text-stone-400">➔</span>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] uppercase font-bold ${
                        updateConfirm.targetStatus === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : updateConfirm.targetStatus === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border border-rose-100'
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {updateConfirm.targetStatus}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[10.5px] text-stone-450 dark:text-stone-500 italic">
                This modification will immediately update the database, reconfigure their system access scope, and log a permanent security audit record.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUpdateConfirm(null)}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateRoleAndStatus(
                    updateConfirm.memberId,
                    updateConfirm.targetRole,
                    updateConfirm.targetStatus
                  );
                  setUpdateConfirm(null);
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-sm hover:shadow-md cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Change</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM BATCH APPROVE MODAL */}
      {isBatchApproveConfirmOpen && (
        <div className="fixed inset-0 bg-stone-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-md w-full flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800 p-6 space-y-5 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-stone-900 dark:text-white text-base">
                  Confirm Batch Approval
                </h3>
                <p className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">
                  Administrative Batch Action
                </p>
              </div>
            </div>

            <div className="text-xs text-stone-600 dark:text-stone-300 space-y-3">
              <p className="leading-relaxed">
                You are about to approve the membership registration for <strong>{selectedMemberIds.length}</strong> selected members.
              </p>
              <p className="text-[10.5px] text-stone-450 dark:text-stone-500 italic">
                This modification will immediately grant system access scope, update registration statuses to "Approved", and log permanent security audit records.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsBatchApproveConfirmOpen(false)}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onBatchApproveMembers) {
                    onBatchApproveMembers(selectedMemberIds);
                  }
                  setSelectedMemberIds([]);
                  setIsBatchApproveConfirmOpen(false);
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-sm hover:shadow-md cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Approve All ({selectedMemberIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM BATCH DELETE MODAL */}
      {isBatchDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-stone-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-md w-full flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800 p-6 space-y-5 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl">
                <AlertTriangle className="w-5 h-5 text-rose-600 animate-bounce" />
              </div>
              <div>
                <h3 className="font-extrabold text-stone-900 dark:text-white text-base">
                  Confirm Batch Deletion
                </h3>
                <p className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">
                  Critical Destructive Action
                </p>
              </div>
            </div>

            <div className="text-xs text-stone-600 dark:text-stone-300 space-y-3">
              <p className="leading-relaxed">
                Are you absolutely sure you want to permanently delete the registration records for <strong>{selectedMemberIds.length}</strong> selected members?
              </p>
              <p className="p-3 bg-rose-50/40 dark:bg-rose-950/20 text-rose-700 dark:text-rose-350 rounded-2xl font-bold border border-rose-100/30 text-[11px]">
                ⚠️ WARNING: This operation is permanent and completely irreversible. All selected profile records, details, and access tokens will be deleted.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsBatchDeleteConfirmOpen(false)}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onBatchDeleteMembers) {
                    onBatchDeleteMembers(selectedMemberIds);
                  }
                  setSelectedMemberIds([]);
                  setIsBatchDeleteConfirmOpen(false);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-sm hover:shadow-md cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete All ({selectedMemberIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Member ID Card Overlay */}
      {idCardMember && (
        <MemberIDCardModal
          member={idCardMember}
          isOpen={idCardMember !== null}
          onClose={() => setIdCardMember(null)}
        />
      )}

    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Member, UserRole, isOBUser } from '../types';
import { db } from '../lib/supabase';
import { 
  FinancialRecord, 
  BialConfig, 
  MONTHS, 
  BIAL_IDS, 
  financialsDb 
} from '../lib/financials';
import { 
  Plus, 
  Trash2, 
  Search, 
  TrendingUp, 
  Coins, 
  Users, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Check, 
  X, 
  FileText, 
  ArrowUpRight, 
  Settings, 
  Save,
  Lock,
  Unlock,
  Filter,
  CheckCircle,
  HelpCircle,
  Info,
  AlertTriangle,
  Trophy,
  Medal,
  Crown,
  ChevronDown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { AnimatePresence, motion } from 'motion/react';

interface FinancialRecordsPageProps {
  currentUser: Member;
  onAddLog: (action: string, details: string) => void;
}

export function FinancialRecordsPage({ currentUser, onAddLog }: FinancialRecordsPageProps) {
  const [activeTab, setActiveTab] = useState<string>('Overall'); // 'Overall' | 'Bial 1' ... 'Bial 12'
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [bialConfigs, setBialConfigs] = useState<BialConfig[]>([]);

  // CRUD State
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formArea, setFormArea] = useState('Bial 1');
  const [formMonth, setFormMonth] = useState('January');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Bulk actions states
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkEditAmount, setBulkEditAmount] = useState<number | ''>('');
  const [bulkEditMonth, setBulkEditMonth] = useState<string>('');
  const [bulkEditDate, setBulkEditDate] = useState<string>('');

  // Bulk add states
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkEntries, setBulkEntries] = useState<{ [month: string]: { selected: boolean; amount: number | ''; date: string } }>(() => {
    const initial: { [month: string]: { selected: boolean; amount: number | ''; date: string } } = {};
    MONTHS.forEach(m => {
      initial[m] = { selected: false, amount: '', date: new Date().toISOString().split('T')[0] };
    });
    return initial;
  });

  // Bial Editable configuration states
  const [isEditingBialConfig, setIsEditingBialConfig] = useState(false);
  const [bialLeadersInput, setBialLeadersInput] = useState('');
  const [bialAreaInput, setBialAreaInput] = useState('');

  // States for editing BIALs in Overall panel
  const [editingBialId, setEditingBialId] = useState<string | null>(null);
  const [editingBialLeaders, setEditingBialLeaders] = useState('');
  const [editingBialArea, setEditingBialArea] = useState('');

  // Overall page filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBial, setFilterBial] = useState('All');
  const [filterMonth, setFilterMonth] = useState('All');
  const [expandedUserKeys, setExpandedUserKeys] = useState<string[]>([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // PDF Report Customization States
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [pdfIncludeSummary, setPdfIncludeSummary] = useState(true);
  const [pdfIncludeTopDonors, setPdfIncludeTopDonors] = useState(true);
  const [pdfIncludeDetails, setPdfIncludeDetails] = useState(true);
  const [pdfSelectedBials, setPdfSelectedBials] = useState<string[]>(BIAL_IDS);
  const [pdfMonthMode, setPdfMonthMode] = useState<'all' | 'current' | 'custom'>('all');
  const [pdfSelectedMonths, setPdfSelectedMonths] = useState<string[]>(MONTHS);

  // Reset page when tab or filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRecordIds([]);
  }, [activeTab, searchTerm, filterBial, filterMonth]);

  // Role Permissions
  const canManageFinance = 
    currentUser.role === 'Treasurer' || 
    currentUser.role === 'Financial Secretary' || 
    currentUser.role === 'Founder' || 
    currentUser.role === 'Admin';
  const canViewFinance = currentUser.role === 'ECM' || currentUser.role !== 'standard'; // OB roles and ECM can view

  // Load backend states
  useEffect(() => {
    const load = async () => {
      const recs = await financialsDb.getFinancialRecords();
      const confs = await financialsDb.getBialConfigs();
      setRecords(recs);
      setBialConfigs(confs);
      try {
        const mems = await db.getMembers();
        setMembers(mems.filter(m => m.status === 'approved'));
      } catch (err) {
        console.warn('Could not load members in financials page:', err);
      }
    };
    load();
  }, []);

  // Update form date when modal opens
  useEffect(() => {
    if (isAddFormOpen && !editingRecord) {
      setFormDate(new Date().toISOString().split('T')[0]);
    }
  }, [isAddFormOpen, editingRecord]);

  // Sync edit values
  const setupEditMode = (rec: FinancialRecord) => {
    setEditingRecord(rec);
    setFormName(rec.name);
    setFormAddress(rec.address);
    setFormAmount(rec.amount);
    setFormArea(rec.area);
    setFormMonth(rec.payment_month);
    setFormDate(rec.payment_date);
    setIsAddFormOpen(true);
  };

  const closeForm = () => {
    setIsAddFormOpen(false);
    setEditingRecord(null);
    setFormName('');
    setFormAddress('');
    setFormAmount('');
    setFormError(null);
    setIsBulkMode(false);
    setBulkEntries(() => {
      const initial: { [month: string]: { selected: boolean; amount: number | ''; date: string } } = {};
      MONTHS.forEach(m => {
        initial[m] = { selected: false, amount: '', date: new Date().toISOString().split('T')[0] };
      });
      return initial;
    });
  };

  // Submit record helper
  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim() || !formAddress.trim()) {
      setFormError('Please fill in all required fields.');
      return;
    }

    const assignedBial = getMemberBial(formName, formAddress, editingRecord?.id);
    if (assignedBial && assignedBial !== formArea) {
      setFormError(`User "${formName.trim()}" is already assigned to ${assignedBial}. They are not allowed to be assigned to other Bials.`);
      return;
    }

    try {
      if (editingRecord) {
        if (formAmount === '') {
          setFormError('Please enter an amount.');
          return;
        }
        if (Number(formAmount) <= 0) {
          setFormError('Amount must be greater than 0.');
          return;
        }
        // Edit flow
        const updated = await financialsDb.updateFinancialRecord(editingRecord.id, {
          name: formName.trim(),
          address: formAddress.trim(),
          amount: Number(formAmount),
          area: formArea,
          payment_month: formMonth,
          payment_date: formDate
        });
        
        onAddLog(
          'Edit Financial Record', 
          `Updated payment of ₹${updated.amount} for "${updated.name}" (${updated.area}, ${updated.payment_month})`
        );
      } else if (isBulkMode) {
        // Bulk add flow
        const selectedBulkMonths = (Object.entries(bulkEntries) as [string, { selected: boolean; amount: number | ''; date: string }][]).filter(([_, val]) => val.selected);
        if (selectedBulkMonths.length === 0) {
          setFormError('Please select at least one month for bulk adding.');
          return;
        }

        const recordsToAdd = selectedBulkMonths.map(([month, data]) => {
          const amountVal = data.amount !== '' ? Number(data.amount) : Number(formAmount);
          if (isNaN(amountVal) || amountVal <= 0) {
            throw new Error(`Please specify a valid amount greater than 0 for ${month}.`);
          }
          const dateVal = data.date || formDate;
          return {
            name: formName.trim(),
            address: formAddress.trim(),
            amount: amountVal,
            area: formArea,
            payment_month: month,
            payment_date: dateVal
          };
        });

        const createdList = await financialsDb.bulkAddFinancialRecords(
          recordsToAdd, 
          currentUser.email, 
          currentUser.name
        );

        onAddLog(
          'Bulk Add Financial Records', 
          `Registered bulk payments (${createdList.length} records) for "${formName.trim()}" (${formArea})`
        );
      } else {
        if (formAmount === '') {
          setFormError('Please enter an amount.');
          return;
        }
        if (Number(formAmount) <= 0) {
          setFormError('Amount must be greater than 0.');
          return;
        }
        // Add flow
        const created = await financialsDb.addFinancialRecord({
          name: formName.trim(),
          address: formAddress.trim(),
          amount: Number(formAmount),
          area: formArea,
          payment_month: formMonth,
          payment_date: formDate
        }, currentUser.email, currentUser.name);

        onAddLog(
          'Add Financial Record', 
          `Registered payment of ₹${created.amount} for "${created.name}" (${created.area}, ${created.payment_month})`
        );
      }

      // Reload
      const recs = await financialsDb.getFinancialRecords();
      setRecords(recs);
      try {
        const mems = await db.getMembers();
        setMembers(mems.filter(m => m.status === 'approved'));
      } catch (err) {
        console.warn('Could not reload members after record update:', err);
      }
      closeForm();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed');
    }
  };

  const handleRecordDelete = async (id: string) => {
    const recordToDelete = records.find(r => r.id === id);
    if (!recordToDelete) return;

    await financialsDb.deleteFinancialRecord(id);
    onAddLog(
      'Delete Financial Record', 
      `Removed payment record of ₹${recordToDelete.amount} for "${recordToDelete.name}" (${recordToDelete.area}, ${recordToDelete.payment_month})`
    );
    const recs = await financialsDb.getFinancialRecords();
    setRecords(recs);
  };

  const handleBulkDelete = async () => {
    if (selectedRecordIds.length === 0) return;
    try {
      const recordsToDelete = records.filter(r => selectedRecordIds.includes(r.id));
      for (const record of recordsToDelete) {
        await financialsDb.deleteFinancialRecord(record.id);
      }
      
      onAddLog(
        'Bulk Delete Financial Records', 
        `Removed ${recordsToDelete.length} payment records in bulk for ${activeTab}`
      );
      
      const recs = await financialsDb.getFinancialRecords();
      setRecords(recs);
      setSelectedRecordIds([]);
      setIsBulkDeleteConfirmOpen(false);
    } catch (err: any) {
      console.error('Failed to perform bulk delete:', err);
    }
  };

  const handleBulkEdit = async () => {
    if (selectedRecordIds.length === 0) return;
    try {
      const updates: Partial<FinancialRecord> = {};
      if (bulkEditAmount !== '') {
        updates.amount = Number(bulkEditAmount);
      }
      if (bulkEditMonth !== '') {
        updates.payment_month = bulkEditMonth;
      }
      if (bulkEditDate !== '') {
        updates.payment_date = bulkEditDate;
      }

      if (Object.keys(updates).length === 0) {
        alert('Please specify at least one field to update.');
        return;
      }

      for (const id of selectedRecordIds) {
        await financialsDb.updateFinancialRecord(id, updates);
      }
      
      onAddLog(
        'Bulk Edit Financial Records', 
        `Updated ${selectedRecordIds.length} payment records in bulk for ${activeTab}: ${JSON.stringify(updates)}`
      );
      
      const recs = await financialsDb.getFinancialRecords();
      setRecords(recs);
      setSelectedRecordIds([]);
      setIsBulkEditModalOpen(false);
      
      // Reset
      setBulkEditAmount('');
      setBulkEditMonth('');
      setBulkEditDate('');
    } catch (err: any) {
      console.error('Failed to perform bulk edit:', err);
    }
  };

  // Bial configuration edit helpers
  const startBialConfigEdit = (conf: BialConfig) => {
    setBialLeadersInput(conf.leaders);
    setBialAreaInput(conf.area);
    setIsEditingBialConfig(true);
  };

  const saveBialConfigSubmit = async (bialId: string) => {
    const updatedConfigs = await financialsDb.saveBialConfig({
      id: bialId,
      leaders: bialLeadersInput.trim() || 'TBD',
      area: bialAreaInput.trim() || 'TBD'
    });
    setBialConfigs(updatedConfigs);
    setIsEditingBialConfig(false);
    onAddLog('Modify Bial Settings', `Updated leadership and area parameters for ${bialId}`);
  };

  const saveBialConfigFromOverall = async (bialId: string) => {
    const updatedConfigs = await financialsDb.saveBialConfig({
      id: bialId,
      leaders: editingBialLeaders.trim() || 'TBD',
      area: editingBialArea.trim() || 'TBD'
    });
    setBialConfigs(updatedConfigs);
    setEditingBialId(null);
    onAddLog('Modify Bial Settings', `Updated leadership and area parameters for ${bialId} from Overall Panel`);
  };

  // Compute calculated values
  const totalFinancialCollection = records.reduce((sum, r) => sum + r.amount, 0);
  const countOfTransactions = records.length;
  const uniqueContributors = new Set(records.map(r => r.name.toLowerCase().trim())).size;

  // Helper to determine if a member/name is already assigned to a Bial
  const getMemberBial = (memberName: string, memberAddress?: string, excludeRecordId?: string): string | null => {
    const normalizedName = memberName.trim().toLowerCase();
    
    const stripPrefix = (s: string) => {
      return s
        .replace(/^(tg\.|tg\s+|lia\s+|lia\.|pa\s+|pa\.|sia\s+|sia\.)/gi, '')
        .trim();
    };
    const strippedMember = stripPrefix(normalizedName);
    
    // First, check if there is a registered approved member with this name and they have an assigned bial
    const registeredMember = members.find(m => {
      const mName = m.name.trim().toLowerCase();
      return mName === normalizedName || stripPrefix(mName) === strippedMember;
    });

    if (registeredMember && registeredMember.bial) {
      return registeredMember.bial;
    }

    // Second, try matching exactly by name in the financial records (excluding the current edited record)
    const recordMatch = records.find(r => {
      if (excludeRecordId && r.id === excludeRecordId) return false;
      const rName = r.name.trim().toLowerCase();
      return rName === normalizedName || stripPrefix(rName) === strippedMember;
    });
    
    if (recordMatch) {
      return recordMatch.area;
    }

    // Third, fall back to checking if there is a registered approved member with this name and parsing their address/area
    if (registeredMember && registeredMember.address) {
      const addrLower = registeredMember.address.toLowerCase();
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

    return null;
  };

  const selectedUserAssignedBial = formName ? getMemberBial(formName, formAddress, editingRecord?.id) : null;
  const isBialMismatched = selectedUserAssignedBial !== null && selectedUserAssignedBial !== formArea;

  const filteredMembersForDropdown = members
    .filter(member => {
      if (!formName.trim()) return true;
      return member.name.toLowerCase().includes(formName.toLowerCase()) || 
             member.email.toLowerCase().includes(formName.toLowerCase());
    })
    .slice(0, 15);

  // Filter records dynamically for overall view
  const filteredRecords = records.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBial = filterBial === 'All' || r.area === filterBial;
    const matchesMonth = filterMonth === 'All' || r.payment_month === filterMonth;
    return matchesSearch && matchesBial && matchesMonth;
  });

  interface AggregatedUserRecord {
    name: string;
    bial: string;
    address: string;
    records: FinancialRecord[];
    totalAmount: number;
    paymentPeriod: string;
    registeredByNames: string[];
    registeredByEmails: string[];
    latestRecord: FinancialRecord;
  }

  // Group and aggregate records by contributor name and area (Bial)
  const getAggregatedRecords = (recordsList: FinancialRecord[]) => {
    const groups: { [key: string]: AggregatedUserRecord } = {};

    recordsList.forEach(r => {
      const key = `${r.name.trim().toLowerCase()}||${r.area.trim().toLowerCase()}`;
      if (!groups[key]) {
        groups[key] = {
          name: r.name,
          bial: r.area,
          address: r.address || '',
          records: [],
          totalAmount: 0,
          paymentPeriod: '',
          registeredByNames: [],
          registeredByEmails: [],
          latestRecord: r
        };
      }
      const g = groups[key];
      g.records.push(r);
      g.totalAmount += r.amount;
      
      if (r.created_by_name && !g.registeredByNames.includes(r.created_by_name)) {
        g.registeredByNames.push(r.created_by_name);
      }
      if (r.created_by_email && !g.registeredByEmails.includes(r.created_by_email)) {
        g.registeredByEmails.push(r.created_by_email);
      }
      
      const rDate = new Date(r.payment_date || r.created_at);
      const gDate = new Date(g.latestRecord.payment_date || g.latestRecord.created_at);
      if (rDate > gDate) {
        g.latestRecord = r;
        if (r.address) g.address = r.address;
      }
    });

    return Object.values(groups).map(g => {
      // Sort individual records chronologically by month
      g.records.sort((a, b) => {
        const indexA = MONTHS.indexOf(a.payment_month);
        const indexB = MONTHS.indexOf(b.payment_month);
        if (indexA !== indexB) return indexA - indexB;
        return new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime();
      });

      if (g.records.length > 0) {
        const uniqueMonths = Array.from(new Set(g.records.map(r => r.payment_month)));
        uniqueMonths.sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
        
        if (uniqueMonths.length === 1) {
          g.paymentPeriod = uniqueMonths[0];
        } else if (uniqueMonths.length > 1) {
          g.paymentPeriod = `${uniqueMonths[0]} - ${uniqueMonths[uniqueMonths.length - 1]}`;
        }
      }

      return g;
    });
  };

  const aggregatedRecords = getAggregatedRecords(filteredRecords);
  const totalPagesOverall = Math.ceil(aggregatedRecords.length / itemsPerPage);
  const paginatedOverallRecords = aggregatedRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Organize cell matrix for Bials vs Months
  // rows: Bial 1 to 12
  // cols: Jan to Dec
  const matrixData = BIAL_IDS.map(bial => {
    const rowObj: { [key: string]: any } = { label: bial };
    let rowTotal = 0;
    MONTHS.forEach(mon => {
      const sum = records
        .filter(r => r.area === bial && r.payment_month === mon)
        .reduce((s, r) => s + r.amount, 0);
      rowObj[mon] = sum;
      rowTotal += sum;
    });
    rowObj.total = rowTotal;
    return rowObj;
  });

  // Calculate monthly overall sums for Chart serialization
  const chartMonthlyData = MONTHS.map(mon => {
    const amount = records
      .filter(r => r.payment_month === mon)
      .reduce((sum, r) => sum + r.amount, 0);
    return { name: mon.slice(0, 3), amount };
  });

  // Calculate bial-wise overall sums for Chart serialization
  const chartBialData = BIAL_IDS.map(bial => {
    const amount = records
      .filter(r => r.area === bial)
      .reduce((sum, r) => sum + r.amount, 0);
    return { name: bial, amount };
  });

  // Calculate top 10 donors/contributors during the current year
  const topDonorsOfYear = React.useMemo(() => {
    const contributorMap = new Map<string, { name: string; area: string; total: number; count: number }>();
    records.forEach(r => {
      const key = r.name.toLowerCase().trim();
      const existing = contributorMap.get(key);
      if (existing) {
        existing.total += r.amount;
        existing.count += 1;
      } else {
        contributorMap.set(key, {
          name: r.name.trim(),
          area: r.area,
          total: r.amount,
          count: 1
        });
      }
    });

    return Array.from(contributorMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [records]);

  // Active Bial Specific Scope values
  const currentBialConfig = bialConfigs.find(c => c.id === activeTab);
  const currentBialRecords = records.filter(r => r.area === activeTab);
  const aggregatedBialRecords = React.useMemo(() => {
    return getAggregatedRecords(currentBialRecords);
  }, [currentBialRecords]);
  const totalPagesBial = Math.ceil(aggregatedBialRecords.length / itemsPerPage);
  const paginatedBialRecords = React.useMemo(() => {
    return aggregatedBialRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [aggregatedBialRecords, currentPage, itemsPerPage]);
  const currentBialCollection = currentBialRecords.reduce((s, r) => s + r.amount, 0);
  const currentBialContributorsCount = new Set(currentBialRecords.map(r => r.name.toLowerCase().trim())).size;

  const generatePDFReport = () => {
    if (!isOBUser(currentUser.role)) {
      alert('You do not have permission to generate reports.');
      return;
    }

    if (!pdfIncludeSummary && !pdfIncludeTopDonors && (!pdfIncludeDetails || pdfSelectedBials.length === 0)) {
      alert('Please include at least the Overall Summary, Top 10 Contributors, or select at least one Bial to generate a report.');
      return;
    }

    const pdfSelectedMonthsList = pdfMonthMode === 'all'
      ? MONTHS
      : pdfMonthMode === 'current'
        ? [MONTHS[new Date().getMonth()]]
        : pdfSelectedMonths;

    if (pdfSelectedMonthsList.length === 0) {
      alert('Please select at least one month to include in the report.');
      return;
    }

    try {
      // Create new PDF in landscape mode
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Colors
      const primaryColor = [6, 78, 59]; // dark emerald #064e3b
      const secondaryColor = [30, 41, 59]; // slate #1e293b
      const accentColor = [16, 185, 129]; // light emerald #10b981
      const grayColor = [100, 116, 139]; // slate-400

      let isFirstPage = true;

      // Filter records according to selected months
      const pdfRecords = records.filter(r => pdfSelectedMonthsList.includes(r.payment_month));
      const pdfTotalCollection = pdfRecords.reduce((sum, r) => sum + r.amount, 0);
      const pdfCountOfTransactions = pdfRecords.length;
      const pdfUniqueContributors = new Set(pdfRecords.map(r => r.name.toLowerCase().trim())).size;

      // 1. OVERALL SUMMARY PAGE
      if (pdfIncludeSummary) {
        isFirstPage = false;
        // Brand Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('SHALOM YOUTH CORE', 14, 18);

        // Subtitle
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text('Bial-wise Monthly Contribution Report (Fundbawm)', 14, 25);

        // Meta info
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        const dateString = new Date().toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short'
        });

        let monthsSubtitle = 'All Months';
        if (pdfMonthMode === 'current') {
          monthsSubtitle = `${MONTHS[new Date().getMonth()]}`;
        } else if (pdfMonthMode === 'custom') {
          monthsSubtitle = pdfSelectedMonthsList.map(m => m.slice(0, 3)).join(', ');
        }

        doc.text(`Financial Year: 2026  |  Months: ${monthsSubtitle}  |  Report Generated: ${dateString}`, 14, 31);
        doc.text(`Generated By: ${currentUser.name} (${currentUser.role})`, 14, 36);

        // Draw a sleek divider line
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.5);
        doc.line(14, 40, 283, 40);

        // Summary Cards (Draw custom rectangles for key stats)
        const cardWidth = 80;
        const cardHeight = 22;
        const startY = 45;

        // Card 1: Total Funds
        doc.setFillColor(240, 253, 250); // emerald-50/20
        doc.roundedRect(14, startY, cardWidth, cardHeight, 3, 3, 'F');
        doc.setDrawColor(209, 250, 229); // emerald-100
        doc.roundedRect(14, startY, cardWidth, cardHeight, 3, 3, 'S');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('TOTAL FUNDBAWM COLLECTION', 18, startY + 6);
        doc.setFontSize(14);
        doc.text(`INR ${pdfTotalCollection.toLocaleString('en-IN')}`, 18, startY + 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('Sum accumulated over selected months', 18, startY + 19);

        // Card 2: Contributors
        doc.setFillColor(240, 249, 255); // sky-50
        doc.roundedRect(14 + cardWidth + 10, startY, cardWidth, cardHeight, 3, 3, 'F');
        doc.setDrawColor(224, 242, 254); // sky-100
        doc.roundedRect(14 + cardWidth + 10, startY, cardWidth, cardHeight, 3, 3, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(14, 116, 144); // sky-700
        doc.text('ACTIVE CONTRIBUTORS', 14 + cardWidth + 14, startY + 6);
        doc.setFontSize(14);
        doc.text(`${pdfUniqueContributors}`, 14 + cardWidth + 14, startY + 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('Unique member accounts contributing', 14 + cardWidth + 14, startY + 19);

        // Card 3: Transactions / Registry
        doc.setFillColor(254, 252, 243); // warm amber-50
        doc.roundedRect(14 + (cardWidth * 2) + 20, startY, cardWidth, cardHeight, 3, 3, 'F');
        doc.setDrawColor(254, 243, 199); // amber-100
        doc.roundedRect(14 + (cardWidth * 2) + 20, startY, cardWidth, cardHeight, 3, 3, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(180, 83, 9); // amber-700
        doc.text('AUDIT REGISTRY LENGTH', 14 + (cardWidth * 2) + 24, startY + 6);
        doc.setFontSize(14);
        doc.text(`${pdfCountOfTransactions}`, 14 + (cardWidth * 2) + 24, startY + 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('Chronological receipt records verified', 14 + (cardWidth * 2) + 24, startY + 19);

        // Prepare Table Headers
        const headers = ['Bial Area Name', ...pdfSelectedMonthsList.map(m => m.slice(0, 3)), 'Total'];

        // Prepare Table Rows
        const rows = BIAL_IDS.map(bial => {
          const rowVals: any[] = [bial];
          let rowSelectedTotal = 0;
          pdfSelectedMonthsList.forEach(mon => {
            const sumVal = records
              .filter(r => r.area === bial && r.payment_month === mon)
              .reduce((s, r) => s + r.amount, 0);
            rowVals.push(sumVal > 0 ? `INR ${sumVal}` : '-');
            rowSelectedTotal += sumVal;
          });
          rowVals.push(`INR ${rowSelectedTotal}`);
          return rowVals;
        });

        // Prepare Table Footer row
        const monthlyTotals = pdfSelectedMonthsList.map(mon => {
          return records
            .filter(r => r.payment_month === mon)
            .reduce((sum, r) => sum + r.amount, 0);
        });
        const selectedTotalSum = monthlyTotals.reduce((sum, val) => sum + val, 0);
        const totalsRow = [
          'Total',
          ...monthlyTotals.map(sum => sum > 0 ? `INR ${sum}` : '-'),
          `INR ${selectedTotalSum}`
        ];
        rows.push(totalsRow);

        // Generate Table using autotable
        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: startY + cardHeight + 8,
          theme: 'striped',
          headStyles: {
            fillColor: primaryColor as [number, number, number],
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            valign: 'middle'
          },
          columnStyles: {
            0: { fontStyle: 'bold', halign: 'left', cellWidth: 'auto' }, // Area name
            [headers.length - 1]: { fontStyle: 'bold', halign: 'right', fillColor: [248, 250, 252] } // Row Total
          },
          bodyStyles: {
            fontSize: 7.5,
            textColor: [51, 65, 85],
            halign: 'center'
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252] // light slate-50
          },
          // Apply special styling to the Totals row at the bottom
          didParseCell: (data) => {
            if (data.row.index === rows.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [220, 252, 231]; // light emerald-100
              data.cell.styles.textColor = [6, 78, 59]; // dark emerald-900
              if (data.column.index === 0) {
                data.cell.styles.halign = 'left';
              }
              if (data.column.index === headers.length - 1) {
                data.cell.styles.halign = 'right';
              }
            } else {
              // Right align row totals
              if (data.column.index === headers.length - 1) {
                data.cell.styles.halign = 'right';
              }
            }
          },
          margin: { left: 14, right: 14 }
        });
      }

      // 1.5. TOP 10 CONTRIBUTORS SECTION
      if (pdfIncludeTopDonors) {
        if (!isFirstPage) {
          doc.addPage();
        }
        isFirstPage = false;

        // Group pdfRecords by name (case-insensitive) and sum amounts
        const contributorMap = new Map<string, { name: string; area: string; total: number; count: number }>();
        pdfRecords.forEach(r => {
          const key = r.name.toLowerCase().trim();
          const existing = contributorMap.get(key);
          if (existing) {
            existing.total += r.amount;
            existing.count += 1;
          } else {
            contributorMap.set(key, {
              name: r.name.trim(),
              area: r.area,
              total: r.amount,
              count: 1
            });
          }
        });

        const sortedPdfContributors = Array.from(contributorMap.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 10);

        // Header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('SHALOM YOUTH CORE', 14, 18);

        // Subtitle
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text('Top 10 Donors & Contributors Leaderboard', 14, 25);

        // Meta info
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        const dateString = new Date().toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short'
        });

        let monthsSubtitle = 'All Months';
        if (pdfMonthMode === 'current') {
          monthsSubtitle = `${MONTHS[new Date().getMonth()]}`;
        } else if (pdfMonthMode === 'custom') {
          monthsSubtitle = pdfSelectedMonthsList.map(m => m.slice(0, 3)).join(', ');
        }
        doc.text(`Financial Year: 2026  |  Scope: ${monthsSubtitle}  |  Report Generated: ${dateString}`, 14, 31);

        // Sleek divider line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(14, 36, 283, 36);

        // Info box / callout
        doc.setFillColor(240, 253, 250); // emerald-50
        doc.roundedRect(14, 41, 269, 14, 2, 2, 'F');
        doc.setDrawColor(209, 250, 229); // emerald-100
        doc.roundedRect(14, 41, 269, 14, 2, 2, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('HONOUR ROLL & ACKNOWLEDGEMENT', 18, 47);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text('We express our profound gratitude to our top contributors and donors for their deep spiritual commitment and active community support.', 18, 51);

        // Generate Table
        const donorHeaders = ['Rank', 'Contributor/Donor Name', 'Assigned Bial Area', 'Contribution Count', 'Total Contribution Amount'];
        const donorRows = sortedPdfContributors.map((contrib, index) => {
          const rankText = `Rank ${index + 1}`;

          return [
            rankText,
            contrib.name,
            contrib.area,
            `${contrib.count} times`,
            `INR ${contrib.total.toLocaleString('en-IN')}`
          ];
        });

        autoTable(doc, {
          head: [donorHeaders],
          body: donorRows,
          startY: 61,
          theme: 'striped',
          headStyles: {
            fillColor: [15, 118, 110], // Teal-700
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: 'bold'
          },
          columnStyles: {
            0: { fontStyle: 'bold', halign: 'left', cellWidth: 40 },
            1: { fontStyle: 'bold', halign: 'left', cellWidth: 'auto' },
            2: { halign: 'left', cellWidth: 50 },
            3: { halign: 'center', cellWidth: 45 },
            4: { fontStyle: 'bold', halign: 'right', cellWidth: 55 }
          },
          bodyStyles: {
            fontSize: 8.5,
            textColor: [51, 65, 85],
            valign: 'middle'
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          margin: { left: 14, right: 14 }
        });
      }

      // 2. DETAILED BIAL SHEETS (Bial 1 - Bial 12 Contributors)
      if (pdfIncludeDetails && pdfSelectedBials.length > 0) {
        // Sort the selected Bials to be in correct chronological order
        const sortedSelectedBials = [...pdfSelectedBials].sort((a, b) => {
          const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
          const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
          return numA - numB;
        });

        sortedSelectedBials.forEach(bialId => {
          // Add new page if this is not the absolute first item we are putting on the PDF
          if (!isFirstPage) {
            doc.addPage();
          }
          isFirstPage = false;

          const config = bialConfigs.find(c => c.id === bialId);
          const areaName = config?.area || 'General';
          const leaders = config?.leaders || 'TBD Leaders';

          const bialRecords = pdfRecords.filter(r => r.area === bialId);
          const aggregatedBial = getAggregatedRecords(bialRecords);
          const sortedBialContributors = [...aggregatedBial].sort((a, b) => a.name.localeCompare(b.name));

          const totalBialCollection = bialRecords.reduce((sum, r) => sum + r.amount, 0);
          const countBialContributors = sortedBialContributors.length;

          // Header
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(20);
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.text('SHALOM YOUTH CORE', 14, 18);

          // Title
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
          doc.text(`${bialId.toUpperCase()} CONTRIBUTION REGISTER - Year: 2026`, 14, 25);

          // Metadata Info Bar
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
          doc.text(`Bial Area: `, 14, 32);
          doc.setFont('helvetica', 'normal');
          doc.text(`${areaName}`, 30, 32);

          doc.setFont('helvetica', 'bold');
          doc.text(`Bial Leaders: `, 14, 37);
          doc.setFont('helvetica', 'normal');
          doc.text(`${leaders}`, 34, 37);

          // Right Metadata Stats
          doc.setFont('helvetica', 'bold');
          doc.text(`Total Fundbawm: `, 150, 32);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.text(`INR ${totalBialCollection.toLocaleString('en-IN')}`, 178, 32);

          doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
          doc.setFont('helvetica', 'bold');
          doc.text(`Contributors: `, 150, 37);
          doc.setFont('helvetica', 'normal');
          doc.text(`${countBialContributors} Active Members (${bialRecords.length} receipts)`, 174, 37);

          // Divider Line
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.5);
          doc.line(14, 41, 283, 41);

          // Determine active months from January up to current month (e.g. Jan to Jul)
          const currentMonthIndex = new Date().getMonth(); // 0-11
          const activeMonths = MONTHS.slice(0, currentMonthIndex + 1);

          // Headers
          const detailHeaders = [
            '#', 
            'Username', 
            ...activeMonths.map(m => m.slice(0, 3)), 
            'Total Amount'
          ];
          
          // Rows
          const detailRows = sortedBialContributors.map((rec, idx) => {
            const row: any[] = [
              (idx + 1).toString(),
              rec.name
            ];

            // Add amount for each month
            activeMonths.forEach(m => {
              const recordsForMonth = rec.records.filter(r => r.payment_month === m);
              const totalForMonth = recordsForMonth.reduce((sum, r) => sum + r.amount, 0);
              row.push(totalForMonth > 0 ? `INR ${totalForMonth.toLocaleString('en-IN')}` : '-');
            });

            // Add Total Amount
            row.push(`INR ${rec.totalAmount.toLocaleString('en-IN')}`);
            return row;
          });

          if (detailRows.length === 0) {
            const emptyRow = ['-', 'No contributor records found in this Bial area.', ...activeMonths.map(() => '-'), 'INR 0'];
            detailRows.push(emptyRow);
          } else {
            // Add a grand total row at the bottom of the table
            const totalRow: any[] = [
              'Total',
              'Grand Total Sum'
            ];

            activeMonths.forEach(m => {
              const sumForMonth = bialRecords
                .filter(r => r.payment_month === m)
                .reduce((sum, r) => sum + r.amount, 0);
              totalRow.push(sumForMonth > 0 ? `INR ${sumForMonth.toLocaleString('en-IN')}` : '-');
            });

            totalRow.push(`INR ${totalBialCollection.toLocaleString('en-IN')}`);
            detailRows.push(totalRow);
          }

          // Build dynamic column styles
          const columnStyles: any = {
            0: { cellWidth: 12, halign: 'center' },
            1: { fontStyle: 'bold', cellWidth: 70, halign: 'left' }
          };
          
          activeMonths.forEach((_, mIdx) => {
            columnStyles[2 + mIdx] = { halign: 'center', cellWidth: 'auto' };
          });

          columnStyles[detailHeaders.length - 1] = { fontStyle: 'bold', halign: 'right', cellWidth: 32 };

          // Render Autotable for Bial
          autoTable(doc, {
            head: [detailHeaders],
            body: detailRows,
            startY: 46,
            theme: 'striped',
            headStyles: {
              fillColor: primaryColor as [number, number, number],
              textColor: [255, 255, 255],
              fontSize: 8.5,
              fontStyle: 'bold'
            },
            columnStyles: columnStyles,
            bodyStyles: {
              fontSize: 8,
              textColor: [51, 65, 85]
            },
            alternateRowStyles: {
              fillColor: [248, 250, 252]
            },
            didParseCell: (data) => {
              if (sortedBialContributors.length > 0 && data.row.index === detailRows.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [220, 252, 231]; // light emerald-100
                data.cell.styles.textColor = [6, 78, 59]; // dark emerald-900
                if (data.column.index === 1) {
                  data.cell.styles.halign = 'left';
                }
                if (data.column.index === detailHeaders.length - 1) {
                  data.cell.styles.halign = 'right';
                }
              } else {
                if (data.column.index === detailHeaders.length - 1) {
                  data.cell.styles.halign = 'right';
                }
              }
            },
            margin: { left: 14, right: 14 }
          });
        });
      }

      // 3. SIGNATURE & AUDIT BLOCK (Appended to the final generated page)
      let finalY = (doc as any).lastAutoTable.finalY + 12;

      // Check space
      if (finalY > 170) {
        doc.addPage();
        finalY = 20;
      }

      // Add signature section
      doc.setDrawColor(226, 232, 240);
      doc.line(14, finalY, 283, finalY);

      finalY += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('AUDITED & VERIFIED BY SHALOM YOUTH FINANCE COMMITTEE', 14, finalY);

      finalY += 15;
      
      // Signature Line 1
      doc.setDrawColor(148, 163, 184); // slate-400
      doc.line(14, finalY, 74, finalY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text('Financial Secretary', 14, finalY + 4);
      doc.text('Shalom Youth Executive Board', 14, finalY + 8);

      // Signature Line 2
      doc.line(114, finalY, 174, finalY);
      doc.text('Treasurer', 114, finalY + 4);
      doc.text('Shalom Youth Board', 114, finalY + 8);

      // Signature Line 3
      doc.line(214, finalY, 274, finalY);
      doc.text('Youth President / Advisor', 214, finalY + 4);
      doc.text('Shalom Youth Core Approval', 214, finalY + 8);

      // Save PDF with unique timestamp
      doc.save(`Shalom_Youth_Custom_Fundbawm_Report_2026_${Date.now()}.pdf`);

      // Log action
      onAddLog(
        'Generate Financial Report',
        `Generated and downloaded a customized PDF monthly contributions report. Summary: ${pdfIncludeSummary ? 'Yes' : 'No'}, Bial Details: ${pdfIncludeDetails ? `${pdfSelectedBials.length} Bials` : 'No'}`
      );

      setIsPDFModalOpen(false);
    } catch (e) {
      console.error('Error generating PDF Report:', e);
      alert('Failed to generate PDF Report. Please check the console for details.');
    }
  };

  const generateContributorPDF = (rec: AggregatedUserRecord) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Branding Colors
      const primaryColor = [6, 78, 59]; // dark emerald #064e3b
      const secondaryColor = [30, 41, 59]; // slate #1e293b
      const accentColor = [16, 185, 129]; // light emerald #10b981
      const lightBg = [248, 250, 252]; // bg-slate-50

      // Add elegant border
      doc.setDrawColor(226, 232, 240); // border-slate-200
      doc.setLineWidth(0.5);
      doc.rect(5, 5, 200, 287);

      // Header block
      doc.setFillColor(6, 78, 59);
      doc.rect(5, 5, 200, 35, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('SHALOM YOUTH UNION', 15, 20);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(167, 243, 208); // emerald-200
      doc.text('OFFICIAL CONTRIBUTION STATEMENT', 15, 26);
      doc.text('FINANCIAL YEAR: 2026', 15, 32);

      // User Information block
      doc.setTextColor(30, 41, 59);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('CONTRIBUTOR PROFILE', 15, 52);
      
      doc.setDrawColor(6, 78, 59);
      doc.setLineWidth(0.3);
      doc.line(15, 54, 70, 54);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Name:', 15, 62);
      doc.setFont('Helvetica', 'bold');
      doc.text(rec.name, 45, 62);

      doc.setFont('Helvetica', 'normal');
      doc.text('Geographic Area (Bial):', 15, 68);
      doc.setFont('Helvetica', 'bold');
      doc.text(rec.bial, 45, 68);

      doc.setFont('Helvetica', 'normal');
      doc.text('Primary Address:', 15, 74);
      doc.setFont('Helvetica', 'bold');
      doc.text(rec.address || 'N/A', 45, 74);

      doc.setFont('Helvetica', 'normal');
      doc.text('Statement Period:', 115, 62);
      doc.setFont('Helvetica', 'bold');
      doc.text(rec.paymentPeriod || 'January - December', 145, 62);

      doc.setFont('Helvetica', 'normal');
      doc.text('Total Contributed:', 115, 68);
      doc.setFont('Helvetica', 'bold');
      doc.text(`INR ${rec.totalAmount.toLocaleString('en-IN')}/-`, 145, 68);

      doc.setFont('Helvetica', 'normal');
      doc.text('Status:', 115, 74);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(5, 150, 105); // emerald green
      doc.text('VERIFIED RECORD', 145, 74);

      // Create Matrix columns and rows
      const tableHeaders = [['Month', 'Receipt Date', 'Recorded By', 'Amount (INR)']];
      const tableRows: any[] = [];

      MONTHS.forEach(m => {
        const recordsForMonth = rec.records.filter(r => r.payment_month === m);
        const amount = recordsForMonth.reduce((sum, r) => sum + r.amount, 0);
        const dates = recordsForMonth.map(r => r.payment_date).join(', ');
        const recordedBy = recordsForMonth.map(r => r.created_by_name).filter(Boolean).join(', ');

        tableRows.push([
          m,
          amount > 0 ? (dates || 'N/A') : '-',
          amount > 0 ? (recordedBy || 'N/A') : '-',
          amount > 0 ? `INR ${amount.toLocaleString('en-IN')}` : 'Not Paid'
        ]);
      });

      // Add Total Row
      tableRows.push([
        { content: 'TOTAL ACCUMULATED FUNDBAWM', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 253, 250] } },
        { content: `INR ${rec.totalAmount.toLocaleString('en-IN')}`, styles: { fontStyle: 'bold', fillColor: [240, 253, 250], textColor: [6, 78, 59] } }
      ]);

      autoTable(doc, {
        startY: 85,
        head: tableHeaders,
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: [6, 78, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 35, fontStyle: 'bold' },
          1: { cellWidth: 45 },
          2: { cellWidth: 65 },
          3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 2.5,
          valign: 'middle'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        didParseCell: function (data) {
          if (data.cell.text[0] === 'Not Paid') {
            data.cell.styles.textColor = [156, 163, 175]; // light gray text for non-payments
          }
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY || 190;

      // Add a nice note
      doc.setTextColor(100, 116, 139);
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.text('Note: This document serves as an official receipt of contributions submitted under Shalom Youth Union.', 15, finalY + 12);
      doc.text('For any queries or discrepancies, please contact your local Bial representative or the Shalom Audit Board.', 15, finalY + 16);

      // Signatures
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(15, finalY + 45, 75, finalY + 45);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text('Contributor Signature', 15, finalY + 49);

      doc.line(135, finalY + 45, 195, finalY + 45);
      doc.text('Finance Secretary / Advisor', 135, finalY + 49);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Shalom Youth Audit Committee', 135, finalY + 53);

      // Save PDF
      const fileName = `${rec.name.replace(/\s+/g, '_')}_Contributions_Statement_2026.pdf`;
      doc.save(fileName);

      onAddLog(
        'Generate Individual PDF',
        `Generated individual contributions statement PDF for member: ${rec.name} (Bial: ${rec.bial}, Total: ₹${rec.totalAmount})`
      );
    } catch (e) {
      console.error('Error generating individual PDF:', e);
      alert('Failed to generate statement PDF.');
    }
  };

  return (
    <div className="space-y-6" id="finance_records_root">
      
      {/* Access Permission Block Header */}
      <div className="bg-white p-4.5 rounded-2xl border border-stone-150 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${canManageFinance ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-amber-50 text-amber-800 border border-amber-100'}`}>
            {canManageFinance ? <Unlock className="w-5 h-5 animate-pulse" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-stone-900 uppercase tracking-widest leading-none">Financial Record System (Fundbawm)</h2>
              <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase border ${canManageFinance ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                {canManageFinance ? 'Administrator Access' : 'Read-Only Clearance'}
              </span>
            </div>
            <p className="text-[11px] text-stone-450 mt-1">
              {canManageFinance 
                ? 'Authorized as Admin/Founder or Treasurer/Financial Secretary. You possess complete CRUD access over Bial configurations, monthly record additions, and ledger alterations.'
                : 'Officer Bearer / Executive Committee view clearance. Transaction editing, addition, or deletions are deactivated.'
              }
            </p>
          </div>
        </div>

        {canManageFinance && (
          <button 
            onClick={() => {
              setEditingRecord(null);
              setFormName('');
              const targetBial = activeTab === 'Overall' ? 'Bial 1' : activeTab;
              const config = bialConfigs.find(c => c.id === targetBial);
              setFormAddress(config && config.area && config.area !== 'TBD' ? config.area : '');
              setFormAmount('');
              setFormArea(targetBial);
              setFormMonth('January');
              setIsAddFormOpen(true);
            }}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Record</span>
          </button>
        )}
      </div>

      {/* Main Bial-wise + Overall Tab list switcher */}
      <div className="bg-white p-1 rounded-2xl border border-stone-150 shadow-xs overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          <button
            onClick={() => {
              setActiveTab('Overall');
              setIsEditingBialConfig(false);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${activeTab === 'Overall' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'}`}
          >
            Overall Status
          </button>
          {BIAL_IDS.map(bialId => (
            <button
              key={bialId}
              onClick={() => {
                setActiveTab(bialId);
                setIsEditingBialConfig(false);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${activeTab === bialId ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'}`}
            >
              {bialId}
            </button>
          ))}
        </div>
      </div>

      {/* OVERALL TAB RENDER PANEL */}
      {activeTab === 'Overall' ? (
        <div className="space-y-6 animate-fade-in">
          
          {/* Quick Metrics */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-stone-150 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] text-stone-400 font-extrabold uppercase tracking-widest">Total Fundbawm Collection</span>
                <div className="text-2xl font-black text-stone-900">₹{totalFinancialCollection.toLocaleString('en-IN')}</div>
                <p className="text-[10px] text-emerald-600 font-bold">Sum accumulated over all bials</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                <Coins className="w-6 h-6 animate-pulse" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-150 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] text-stone-400 font-extrabold uppercase tracking-widest">Active Contributors</span>
                <div className="text-2xl font-black text-stone-900">{uniqueContributors}</div>
                <p className="text-[10px] text-stone-450 font-bold">Unique member accounts donating</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-150 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] text-stone-400 font-extrabold uppercase tracking-widest">Audit Registry Length</span>
                <div className="text-2xl font-black text-stone-900">{countOfTransactions}</div>
                <p className="text-[10px] text-stone-450 font-bold">Chronological receipts stored</p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </section>

          {/* SPREADSHEET MATRIX VIEW: "how bials are doing every month" */}
          <section className="bg-white p-5 rounded-2xl border border-stone-150 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-stone-100">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900 uppercase tracking-wider">Bial Monthly Collection Sheet</h3>
                <p className="text-xs text-stone-450">Comprehensive matrix layout tracking receipts across all 12 Bials</p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                {isOBUser(currentUser.role) && (
                  <button
                    onClick={() => setIsPDFModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-[10px] transition-all shadow-xs cursor-pointer focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    title="Generate and download customized PDF report"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Download PDF Report</span>
                  </button>
                )}
                <span className="bg-stone-50 border border-stone-200 text-stone-500 font-mono text-[9px] font-bold px-2.5 py-1.5 rounded-lg">
                  Financial Year: 2026
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-stone-100 bg-stone-50">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100 text-stone-700 uppercase font-black text-[9px] tracking-wider border-b border-stone-200">
                    <th className="p-3.5 sticky left-0 bg-stone-100 z-10 border-r border-stone-200 shadow-sm">Bial Area Name</th>
                    {MONTHS.map(mon => (
                      <th key={mon} className="p-3 text-center min-w-20 font-bold">{mon.slice(0, 3)}</th>
                    ))}
                    <th className="p-3.5 text-right font-black border-l border-stone-200 bg-stone-150">Bial Sum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {matrixData.map(row => (
                    <tr key={row.label} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-3.5 font-extrabold text-stone-800 sticky left-0 bg-white border-r border-stone-150 shadow-xs">
                        {row.label}
                      </td>
                      {MONTHS.map(mon => {
                        const cellVal = row[mon] || 0;
                        return (
                          <td key={mon} className="p-3 text-center font-mono">
                            {cellVal > 0 ? (
                              <span className="font-bold text-emerald-85 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md text-[11px]">
                                ₹{cellVal}
                              </span>
                            ) : (
                              <span className="text-stone-300">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3.5 text-right font-extrabold font-mono text-stone-900 border-l border-stone-150 bg-stone-50/50">
                        ₹{row.total.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-stone-50 font-black text-stone-900 uppercase text-[9px] tracking-wider border-t-2 border-stone-200">
                    <td className="p-3.5 sticky left-0 bg-stone-50 border-r border-stone-200 shadow-sm">Overall Monthly Total</td>
                    {MONTHS.map(mon => {
                      const colSum = records
                        .filter(r => r.payment_month === mon)
                        .reduce((sum, r) => sum + r.amount, 0);
                      return (
                        <td key={mon} className="p-3 text-center font-mono">
                          {colSum > 0 ? (
                            <span className="text-stone-900 font-extrabold text-[11px]">₹{colSum}</span>
                          ) : (
                            <span className="text-stone-400">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-3.5 text-right font-black text-emerald-700 bg-stone-100/80 border-l border-stone-200 text-[11px]">
                      ₹{totalFinancialCollection.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Graphical Analytics Charts */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="bg-white p-5 rounded-2xl border border-stone-150 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider">Monthly Progress Trend</h4>
                <p className="text-[10px] text-stone-400">Funds aggregated chronologically over calendar months</p>
              </div>
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartMonthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#888888" />
                    <YAxis tick={{ fontSize: 9 }} stroke="#888888" />
                    <ChartTooltip 
                      formatter={(val: any) => [`₹${val}`, 'Collected']}
                      contentStyle={{ fontSize: '10px', borderRadius: '8px' }} 
                    />
                    <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAmount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-150 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider">Bial Share Comparison</h4>
                <p className="text-[10px] text-stone-400">Total fund contribution allocated per administrative Bial</p>
              </div>
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartBialData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 8 }} stroke="#888888" />
                    <YAxis tick={{ fontSize: 9 }} stroke="#888888" />
                    <ChartTooltip 
                      formatter={(val: any) => [`₹${val}`, 'Collected']}
                      contentStyle={{ fontSize: '10px', borderRadius: '8px' }} 
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </section>

          {/* Top Donors / Contributors Leaderboard of the Year */}
          <section className="bg-white p-6 rounded-2xl border border-stone-150 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Trophy className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-stone-900 uppercase tracking-wider flex items-center gap-2">
                    Top 10 Contributors of the Year
                    <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-100">Jan - Dec 2026</span>
                  </h3>
                  <p className="text-xs text-stone-450 mt-0.5">Honour roll recognizing members with the highest cumulative contributions across all 12 Bials</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-auto bg-stone-50 border border-stone-150 px-3 py-1.5 rounded-xl">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] font-bold text-stone-600 font-mono">Community Honour Roll</span>
              </div>
            </div>

            {topDonorsOfYear.length === 0 ? (
              <div className="text-center py-8 text-stone-400 text-xs">
                No financial records registered yet for the current year.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topDonorsOfYear.map((donor, index) => {
                  const maxTotal = topDonorsOfYear[0]?.total || 1;
                  const relativePercentage = Math.round((donor.total / maxTotal) * 100);
                  
                  // Rank badge design
                  let rankIcon = null;
                  let rankBg = 'bg-stone-100 text-stone-600 border-stone-200';
                  let rankLabel = `${index + 1}`;
                  
                  if (index === 0) {
                    rankIcon = <Crown className="w-3 h-3 text-amber-500" />;
                    rankBg = 'bg-amber-50 text-amber-700 border-amber-200 font-black shadow-xs';
                  } else if (index === 1) {
                    rankIcon = <Medal className="w-3 h-3 text-stone-400" />;
                    rankBg = 'bg-slate-50 text-slate-700 border-slate-200 font-black';
                  } else if (index === 2) {
                    rankIcon = <Medal className="w-3 h-3 text-amber-600" />;
                    rankBg = 'bg-amber-50/55 text-amber-800 border-amber-100 font-black';
                  }

                  return (
                    <div 
                      key={donor.name} 
                      className="p-3.5 rounded-2xl bg-stone-50/50 hover:bg-stone-50 border border-stone-100 hover:border-stone-200 transition-all flex items-center justify-between gap-4 group"
                    >
                      {/* Left: Rank & Member Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 shrink-0 rounded-xl border flex items-center justify-center text-xs ${rankBg}`}>
                          {rankIcon ? (
                            <div className="flex flex-col items-center leading-none">
                              {rankIcon}
                              <span className="text-[9px] mt-0.5">{rankLabel}</span>
                            </div>
                          ) : (
                            <span className="font-bold">{rankLabel}</span>
                          )}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <span className="block text-xs font-black text-stone-800 truncate group-hover:text-emerald-700 transition-colors">
                            {donor.name}
                          </span>
                          <span className="inline-flex items-center gap-1 bg-white border border-stone-150 text-[9px] text-stone-500 px-1.5 py-0.5 rounded-md font-medium">
                            <MapPin className="w-2.5 h-2.5 text-stone-400" />
                            {donor.area}
                          </span>
                        </div>
                      </div>

                      {/* Right: Stats & Progress Bar */}
                      <div className="text-right shrink-0 space-y-1.5 w-32">
                        <div>
                          <span className="block text-xs font-black text-emerald-700 font-mono">
                            ₹{donor.total.toLocaleString('en-IN')}
                          </span>
                          <span className="block text-[9px] text-stone-400 font-bold uppercase tracking-wider">
                            {donor.count} {donor.count === 1 ? 'Contribution' : 'Contributions'}
                          </span>
                        </div>
                        {/* Relative donation bar */}
                        <div className="w-full bg-stone-200/60 h-1 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${relativePercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Bial Directory & Leaders Configuration (1-12) */}
          <section className="bg-white p-5 rounded-2xl border border-stone-150 shadow-xs space-y-4" id="bial_directory_panel">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-stone-100">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-extrabold text-stone-900 uppercase tracking-wider">Bial Leaders & Area Locations Directory (1-12)</h3>
                  <p className="text-xs text-stone-450">Administrative panel for updating leaders, assigned organizers, and geographic boundaries</p>
                </div>
              </div>
              <span className="self-start sm:self-center bg-stone-50 border border-stone-200 text-stone-550 font-mono text-[9px] font-bold px-2.5 py-1 rounded-lg">
                Founder / Admin Permissions Required to Edit
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {BIAL_IDS.map(bialId => {
                const conf = bialConfigs.find(c => c.id === bialId) || { id: bialId, leaders: 'TBD', area: 'TBD' };
                const isEditingThis = editingBialId === bialId;

                return (
                  <div key={bialId} className="p-4 bg-stone-50/60 border border-stone-150 rounded-xl space-y-3.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b pb-1.5 border-stone-200/60 mb-2">
                        <span className="font-extrabold text-stone-900 text-xs flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          {bialId}
                        </span>
                        {!isEditingThis && canManageFinance && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBialId(bialId);
                              setEditingBialLeaders(conf.leaders);
                              setEditingBialArea(conf.area);
                            }}
                            className="px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 border border-stone-250 hover:border-emerald-200 rounded-md text-[10px] font-bold transition-all cursor-pointer shadow-3xs"
                          >
                            Edit Config
                          </button>
                        )}
                      </div>

                      {isEditingThis ? (
                        <div className="space-y-2.5 text-xs">
                          <div>
                            <label className="block text-[9px] font-bold text-stone-450 uppercase mb-0.5">Leaders / Organizers</label>
                            <input
                              type="text"
                              value={editingBialLeaders}
                              onChange={e => setEditingBialLeaders(e.target.value)}
                              placeholder="Leaders"
                              className="w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 bg-white font-medium text-stone-800"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-stone-450 uppercase mb-0.5">Geographic Location Area</label>
                            <input
                              type="text"
                              value={editingBialArea}
                              onChange={e => setEditingBialArea(e.target.value)}
                              placeholder="Geographic scope"
                              className="w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 bg-white font-medium text-stone-800"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="block text-[9px] text-stone-400 font-bold uppercase tracking-wider">Bial Organizers (Leaders):</span>
                            <span className="font-extrabold text-stone-750">{conf.leaders || 'TBD'}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-stone-400 font-bold uppercase tracking-wider">Geographic Area Location:</span>
                            <span className="font-semibold text-stone-600">{conf.area || 'TBD'}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {isEditingThis && (
                      <div className="flex items-center gap-1.5 pt-1 border-t border-stone-200/50">
                        <button
                          type="button"
                          onClick={() => saveBialConfigFromOverall(bialId)}
                          className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBialId(null)}
                          className="py-1 px-2.5 border border-stone-250 hover:bg-stone-100 text-stone-500 font-bold rounded-lg text-[10px] transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* FULL HISTORY TRANSACTION TABLE */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-extrabold text-stone-900">Comprehensive Transactions Audit</h4>
                <p className="text-xs text-stone-450">Search, filter, and audit all transaction entries chronologically</p>
              </div>
            </div>

            {/* Filter Control Board */}
            <div className="bg-white p-4 rounded-xl border border-stone-150 shadow-2xs grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-5">
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1.5">Search Name / Location</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search by contributor name or address details..."
                    className="w-full text-xs pl-9 pr-3.5 py-2.5 border rounded-xl bg-stone-50 focus:outline-hidden focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all font-medium text-stone-800"
                  />
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1.5">Filter Area (Bial)</label>
                <select
                  value={filterBial}
                  onChange={e => setFilterBial(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 border rounded-xl bg-stone-50 focus:outline-hidden focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all font-semibold text-stone-750"
                >
                  <option value="All">All Bials (1 to 12)</option>
                  {BIAL_IDS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1.5">Filter Month</label>
                <select
                  value={filterMonth}
                  onChange={e => setFilterMonth(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 border rounded-xl bg-stone-50 focus:outline-hidden focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all font-semibold text-stone-750"
                >
                  <option value="All">All Months (Jan - Dec)</option>
                  {MONTHS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterBial('All');
                    setFilterMonth('All');
                  }}
                  className="w-full py-2.5 border border-stone-200 hover:bg-stone-50 text-stone-500 rounded-xl cursor-pointer text-xs font-bold leading-tight"
                  title="Reset Filter Form"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* List Table */}
            <div className="bg-white rounded-2xl border border-stone-150 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-50 text-stone-400 uppercase font-bold text-[10px] border-b border-stone-100">
                      <th className="p-4">Paid Contributor</th>
                      <th className="p-4">Geographic Area</th>
                      <th className="p-4">Payment Period</th>
                      <th className="p-4">Total Amount</th>
                      <th className="p-4">Registered By</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {paginatedOverallRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-stone-400 italic">
                          No financial records match the current filter selection.
                        </td>
                      </tr>
                    ) : (
                      paginatedOverallRecords.map(rec => {
                        const key = `${rec.name.trim().toLowerCase()}||${rec.bial.trim().toLowerCase()}`;
                        const isExpanded = expandedUserKeys.includes(key);
                        
                        return (
                          <React.Fragment key={key}>
                            <tr 
                              onClick={() => {
                                if (isExpanded) {
                                  setExpandedUserKeys(prev => prev.filter(k => k !== key));
                                } else {
                                  setExpandedUserKeys(prev => [...prev, key]);
                                }
                              }}
                              className="hover:bg-stone-50/50 active:bg-stone-100/40 transition-colors border-b border-stone-100 cursor-pointer select-none"
                            >
                              <td className="p-4">
                                <span className="block font-bold text-stone-900 leading-tight">{rec.name}</span>
                                <span className="block text-[10px] text-stone-400 mt-0.5">{rec.address}</span>
                              </td>
                              <td className="p-4 font-bold text-stone-700">
                                {rec.bial}
                              </td>
                              <td className="p-4">
                                <span className="px-2 py-0.5 bg-stone-100 text-stone-700 border border-stone-200/80 rounded-md text-[10px] font-bold uppercase">
                                  {rec.paymentPeriod || 'None'}
                                </span>
                              </td>
                              <td className="p-4 font-black text-stone-800 font-mono text-[13px]">
                                ₹{rec.totalAmount.toLocaleString('en-IN')}
                              </td>
                              <td className="p-4 text-stone-400">
                                <span className="block font-medium text-stone-550 leading-none">{rec.latestRecord.created_by_name}</span>
                                <span className="block text-[9px] mt-0.5">{rec.latestRecord.created_by_email}</span>
                              </td>
                              <td className="p-4 text-center">
                                <div className="inline-flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                  {/* Download Statement PDF Button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      generateContributorPDF(rec);
                                    }}
                                    className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg font-bold transition-all text-[11px] cursor-pointer inline-flex items-center justify-center border border-rose-100/30 bg-rose-50/10"
                                    title="Download Contributor Statement PDF"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>

                                  {canManageFinance && (
                                    <>
                                      {deleteConfirmId === rec.latestRecord.id ? (
                                        <div className="inline-flex items-center gap-1 animate-fade-in" onClick={e => e.stopPropagation()}>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRecordDelete(rec.latestRecord.id);
                                              setDeleteConfirmId(null);
                                            }}
                                            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-lg text-[9px] transition-all cursor-pointer shadow-3xs"
                                            title="Confirm Deletion"
                                          >
                                            Confirm
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeleteConfirmId(null);
                                            }}
                                            className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg font-bold transition-all text-[9px] cursor-pointer"
                                            title="Cancel Deletion"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setupEditMode(rec.latestRecord);
                                            }}
                                            className="p-1 px-2 hover:bg-stone-100 rounded-lg text-emerald-65 hover:text-emerald-800 font-extrabold transition-all text-[11px] cursor-pointer border border-stone-100"
                                            title="Edit latest payment"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeleteConfirmId(rec.latestRecord.id);
                                            }}
                                            className="p-1 px-2 hover:bg-rose-50 rounded-lg text-stone-400 hover:text-rose-605 font-medium transition-all text-[11px] cursor-pointer border border-stone-100"
                                            title="Delete latest payment"
                                          >
                                            Delete
                                          </button>
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                            
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={6} className="p-0 bg-stone-50/20">
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.25, ease: "easeInOut" }}
                                      className="overflow-hidden"
                                    >
                                      <div className="p-4 bg-stone-50/60 border-b border-stone-150/80 space-y-4">
                                        {/* 12-Month Payment Matrix Grid */}
                                        <div className="space-y-1.5">
                                          <h5 className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider pl-1 border-l-2 border-emerald-600 flex items-center gap-1">
                                            🗓️ Monthly Contributions Matrix
                                          </h5>
                                          <div className="overflow-x-auto rounded-xl border border-stone-150 shadow-3xs bg-white p-3">
                                            <div className="min-w-[800px]">
                                              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
                                                {/* Headers */}
                                                {MONTHS.map(m => (
                                                  <div key={m} className="p-1.5 bg-stone-50 rounded-lg text-center border border-stone-100">
                                                    <span className="block text-[10px] font-black text-stone-400 uppercase">{m.slice(0, 3)}</span>
                                                  </div>
                                                ))}
                                                <div className="p-1.5 bg-emerald-50 rounded-lg text-center border border-emerald-100">
                                                  <span className="block text-[10px] font-black text-emerald-600 uppercase">Total Sum</span>
                                                </div>

                                                {/* Values */}
                                                {MONTHS.map(m => {
                                                  const recordsForMonth = rec.records.filter(r => r.payment_month === m);
                                                  const totalForMonth = recordsForMonth.reduce((sum, r) => sum + r.amount, 0);
                                                  return (
                                                    <div key={m} className="p-2 flex flex-col items-center justify-center min-h-[48px] text-center border border-dashed border-stone-100 rounded-lg">
                                                      {totalForMonth > 0 ? (
                                                        <>
                                                          <span className="text-xs font-extrabold text-stone-800 font-mono">
                                                            ₹{totalForMonth.toLocaleString('en-IN')}
                                                          </span>
                                                          {recordsForMonth.length > 1 && (
                                                            <span className="text-[8px] px-1 py-0.2 bg-stone-100 text-stone-500 rounded font-bold mt-0.5">
                                                              {recordsForMonth.length} recs
                                                            </span>
                                                          )}
                                                        </>
                                                      ) : (
                                                        <span className="text-xs text-stone-300 font-bold">-</span>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                                <div className="p-2 flex items-center justify-center bg-emerald-50/50 rounded-lg border border-emerald-100/50 font-mono text-center">
                                                  <span className="text-xs font-black text-emerald-700">
                                                    ₹{rec.totalAmount.toLocaleString('en-IN')}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Individual Receipts Breakdown list */}
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between">
                                            <h5 className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider pl-1 border-l-2 border-emerald-600 flex items-center gap-1">
                                              📄 Detailed Transaction Receipts ({rec.records.length})
                                            </h5>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                generateContributorPDF(rec);
                                              }}
                                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer border border-rose-100 shadow-3xs"
                                              title="Download Contributor Statement PDF"
                                            >
                                              <FileText className="w-3.5 h-3.5" />
                                              <span>Download Statement PDF</span>
                                            </button>
                                          </div>
                                          <div className="divide-y divide-stone-150/60 rounded-xl border border-stone-200 bg-white overflow-hidden shadow-3xs">
                                            {rec.records.map((item, idx) => (
                                              <div key={item.id} className="p-3.5 flex flex-wrap items-center justify-between gap-4 hover:bg-stone-50/30 transition-colors">
                                                <div className="flex items-center gap-3">
                                                  <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center text-[10px] font-extrabold font-mono">
                                                    {idx + 1}
                                                  </span>
                                                  <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-750 border border-emerald-100 rounded-md font-bold text-[9px] uppercase">
                                                        {item.payment_month}
                                                      </span>
                                                      <span className="text-xs font-bold text-stone-700">
                                                        Paid on {item.payment_date}
                                                      </span>
                                                    </div>
                                                    <p className="text-[10px] text-stone-400 mt-0.5">
                                                      Registered by: <span className="font-semibold text-stone-500">{item.created_by_name}</span> ({item.created_by_email})
                                                    </p>
                                                  </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                  <span className="text-sm font-black text-stone-800 font-mono">
                                                    ₹{item.amount.toLocaleString('en-IN')}
                                                  </span>

                                                  {canManageFinance && (
                                                    <div className="inline-flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                                      {deleteConfirmId === item.id ? (
                                                        <div className="inline-flex items-center gap-1.5 animate-fade-in">
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleRecordDelete(item.id);
                                                              setDeleteConfirmId(null);
                                                            }}
                                                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-[10px] cursor-pointer shadow-2xs"
                                                            title="Confirm Deletion"
                                                          >
                                                            Confirm
                                                          </button>
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setDeleteConfirmId(null);
                                                            }}
                                                            className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg font-bold text-[10px] cursor-pointer"
                                                            title="Cancel Deletion"
                                                          >
                                                            Cancel
                                                          </button>
                                                        </div>
                                                      ) : (
                                                        <>
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setupEditMode(item);
                                                            }}
                                                            className="px-2 py-1.5 hover:bg-stone-100 text-stone-500 hover:text-emerald-700 font-bold text-[10px] rounded-lg transition-all cursor-pointer"
                                                          >
                                                            Edit
                                                          </button>
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setDeleteConfirmId(item.id);
                                                            }}
                                                            className="px-2 py-1.5 hover:bg-rose-50 text-stone-400 hover:text-rose-600 font-bold text-[10px] rounded-lg transition-all cursor-pointer"
                                                          >
                                                            Delete
                                                          </button>
                                                        </>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  </td>
                                </tr>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPagesOverall > 1 && (
                <div className="flex items-center justify-between border-t border-stone-150 bg-stone-50 px-4 py-3.5 sm:px-6">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-xl border border-stone-250 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPagesOverall))}
                      disabled={currentPage === totalPagesOverall}
                      className="relative ml-3 inline-flex items-center rounded-xl border border-stone-250 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-stone-500">
                        Showing <span className="font-extrabold text-stone-800">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                        <span className="font-extrabold text-stone-800">{Math.min(currentPage * itemsPerPage, filteredRecords.length)}</span> of{' '}
                        <span className="font-extrabold text-stone-800">{filteredRecords.length}</span> records
                      </p>
                    </div>
                    <div>
                      <nav className="isolate inline-flex -space-x-px rounded-xl gap-1" aria-label="Pagination">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-extrabold text-stone-555 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          First
                        </button>
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-extrabold text-stone-555 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Prev
                        </button>
                        
                        {Array.from({ length: Math.min(5, totalPagesOverall) }, (_, i) => {
                          let pageNum = currentPage;
                          if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPagesOverall - 2) {
                            pageNum = totalPagesOverall - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          if (pageNum < 1 || pageNum > totalPagesOverall) return null;
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`relative inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${
                                currentPage === pageNum
                                  ? 'z-10 bg-emerald-600 text-white shadow-xs'
                                  : 'text-stone-700 hover:bg-stone-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPagesOverall))}
                          disabled={currentPage === totalPagesOverall}
                          className="relative inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-extrabold text-stone-555 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Next
                        </button>
                        <button
                          onClick={() => setCurrentPage(totalPagesOverall)}
                          disabled={currentPage === totalPagesOverall}
                          className="relative inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-extrabold text-stone-555 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Last
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

        </div>
      ) : (
        /* SPECIFIC BIAL TAB RENDER PANEL */
        <div className="space-y-6 animate-fade-in">
          
          {/* Bial Core Configurations Info Card */}
          <section className="bg-white p-5 rounded-2xl border border-stone-150 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3 border-stone-100">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-65" />
                <div>
                  <h3 className="text-base font-extrabold text-stone-900">{activeTab} Administration Board</h3>
                  <p className="text-xs text-stone-450">Configure headers and track specific contributors parameters</p>
                </div>
              </div>

              {canManageFinance && !isEditingBialConfig && (
                <button
                  onClick={() => startBialConfigEdit(currentBialConfig || { id: activeTab, leaders: 'TBD', area: 'TBD' })}
                  className="self-start sm:self-center inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold border border-emerald-500/15 cursor-pointer transition-all shadow-xs active:translate-y-[1px]"
                >
                  <Settings className="w-3.5 h-3.5 animate-spin-slow" />
                  <span>Modify Leaders & Area</span>
                </button>
              )}
            </div>

            {/* Bial Metadata Display / Edit form */}
            {isEditingBialConfig ? (
              <form onSubmit={(e) => { e.preventDefault(); saveBialConfigSubmit(activeTab); }} className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3.5">
                <h4 className="text-xs font-black text-stone-700 uppercase tracking-widest">Edit {activeTab} Leaders & Area parameters</h4>
                
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-450 uppercase mb-1">Administrative Bial Leaders List</label>
                    <input
                      type="text"
                      required
                      value={bialLeadersInput}
                      onChange={e => setBialLeadersInput(e.target.value)}
                      placeholder="e.g. Pastor Jospeh, Tg. Kapa, Lia Elizabeth te"
                      className="w-full text-xs px-3.5 py-2 border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500 bg-white text-stone-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-450 uppercase mb-1">Assigned Geographic Area coverage</label>
                    <input
                      type="text"
                      required
                      value={bialAreaInput}
                      onChange={e => setBialAreaInput(e.target.value)}
                      placeholder="e.g. Zemabawk Sector B, near church building"
                      className="w-full text-xs px-3.5 py-2 border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500 bg-white text-stone-800"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1.5">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg text-xs cursor-pointer shadow-2xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Parameters</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingBialConfig(false)}
                    className="px-4 py-2 border hover:bg-stone-100 text-stone-500 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4.5 bg-stone-50 border border-stone-100 rounded-xl space-y-1">
                  <span className="block text-[10px] text-stone-400 font-extrabold uppercase tracking-widest leading-none">Bial Organizers (Leaders)</span>
                  <p className="text-xs font-extrabold text-stone-800 leading-snug">{currentBialConfig?.leaders || 'TBD'}</p>
                </div>

                <div className="p-4.5 bg-stone-50 border border-stone-100 rounded-xl space-y-1">
                  <span className="block text-[10px] text-stone-400 font-extrabold uppercase tracking-widest leading-none">Geographic Scope (Area Location)</span>
                  <p className="text-xs font-semibold text-stone-650 leading-snug">{currentBialConfig?.area || 'TBD'}</p>
                </div>
              </div>
            )}
          </section>

          {/* Specific Bial Mini Stats Cards */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4.5 rounded-xl border border-stone-150 shadow-xs space-y-1">
              <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">Total Collection</span>
              <div className="text-xl font-extrabold text-emerald-800">₹{currentBialCollection.toLocaleString('en-IN')}</div>
            </div>

            <div className="bg-white p-4.5 rounded-xl border border-stone-150 shadow-xs space-y-1">
              <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">Records count</span>
              <div className="text-xl font-extrabold text-stone-800">{currentBialRecords.length} entries</div>
            </div>

            <div className="bg-white p-4.5 rounded-xl border border-stone-150 shadow-xs space-y-1">
              <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">Contributors</span>
              <div className="text-xl font-extrabold text-stone-800">{currentBialContributorsCount} accounts</div>
            </div>

            <div className="bg-white p-4.5 rounded-xl border border-stone-150 shadow-xs space-y-1">
              <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">Bial Area No.</span>
              <div className="text-xl font-extrabold text-stone-800">{activeTab}</div>
            </div>
          </section>

          {/* Specific Bial Records Listing */}
          <section className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-stone-900 uppercase tracking-wide">Stored receipts for {activeTab}</h4>
                <p className="text-xs text-stone-450">Filtered catalog specifically registered inside {activeTab}</p>
              </div>

              {canManageFinance && (
                <button
                  onClick={() => {
                    setEditingRecord(null);
                    setFormName('');
                    const config = bialConfigs.find(c => c.id === activeTab);
                    setFormAddress(config && config.area && config.area !== 'TBD' ? config.area : '');
                    setFormAmount('');
                    setFormArea(activeTab);
                    setFormMonth('January');
                    setIsAddFormOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold hover:shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add {activeTab} Entry</span>
                </button>
              )}
            </div>

            {/* Bulk Actions Header Alert / Utility Bar */}
            {canManageFinance && selectedRecordIds.length > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3.5 animate-slide-down">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-black">
                    {selectedRecordIds.length}
                  </span>
                  <span className="text-xs font-bold text-stone-700">
                    Selected {selectedRecordIds.length} payment {selectedRecordIds.length === 1 ? 'record' : 'records'} from {activeTab}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => {
                      setBulkEditAmount('');
                      setBulkEditMonth('');
                      setBulkEditDate('');
                      setIsBulkEditModalOpen(true);
                    }}
                    className="flex-1 sm:flex-initial px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
                  >
                    Bulk Edit
                  </button>
                  <button
                    onClick={() => setIsBulkDeleteConfirmOpen(true)}
                    className="flex-1 sm:flex-initial px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
                  >
                    Bulk Delete
                  </button>
                  <button
                    onClick={() => setSelectedRecordIds([])}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-stone-150 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-50 text-stone-400 uppercase font-bold text-[10px] border-b border-stone-100">
                      {canManageFinance && (
                        <th className="p-4 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={
                              currentBialRecords.length > 0 &&
                              currentBialRecords.every(r => selectedRecordIds.includes(r.id))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRecordIds(currentBialRecords.map(r => r.id));
                              } else {
                                setSelectedRecordIds([]);
                              }
                            }}
                            className="w-3.5 h-3.5 rounded-md text-emerald-600 border-stone-300 focus:ring-emerald-500 cursor-pointer"
                          />
                        </th>
                      )}
                      <th className="p-4">Paid Contributor</th>
                      <th className="p-4">Payment Period</th>
                      <th className="p-4 font-bold text-stone-400">Total Amount</th>
                      <th className="p-4 font-bold text-stone-400">Registered By</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {currentBialRecords.length === 0 ? (
                      <tr>
                        <td colSpan={canManageFinance ? 6 : 5} className="text-center py-12 text-stone-400 italic bg-stone-50/20">
                          No financial records stored yet for {activeTab}. Click "Add {activeTab} Entry" to save a new record.
                        </td>
                      </tr>
                    ) : (
                      paginatedBialRecords.map(rec => {
                        const key = `${rec.name.trim().toLowerCase()}||${rec.bial.trim().toLowerCase()}||bial-tab`;
                        const isExpanded = expandedUserKeys.includes(key);

                        return (
                          <React.Fragment key={key}>
                            <tr 
                              onClick={() => {
                                if (isExpanded) {
                                  setExpandedUserKeys(prev => prev.filter(k => k !== key));
                                } else {
                                  setExpandedUserKeys(prev => [...prev, key]);
                                }
                              }}
                              className="hover:bg-stone-50/50 active:bg-stone-100/40 transition-colors border-b border-stone-100 cursor-pointer select-none"
                            >
                              {canManageFinance && (
                                <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={rec.records.map(r => r.id).every(id => selectedRecordIds.includes(id))}
                                    onChange={(e) => {
                                      const allUserRecordIds = rec.records.map(r => r.id);
                                      if (e.target.checked) {
                                        setSelectedRecordIds(prev => {
                                          const union = new Set([...prev, ...allUserRecordIds]);
                                          return Array.from(union);
                                        });
                                      } else {
                                        setSelectedRecordIds(prev => prev.filter(id => !allUserRecordIds.includes(id)));
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded-md text-emerald-600 border-stone-300 focus:ring-emerald-500 cursor-pointer"
                                  />
                                </td>
                              )}
                              <td className="p-4">
                                <span className="block font-bold text-stone-900 leading-tight">{rec.name}</span>
                                <span className="block text-[10px] text-stone-400 mt-0.5">{rec.address}</span>
                              </td>
                              <td className="p-4">
                                <span className="px-2 py-0.5 bg-stone-100 text-stone-700 border border-stone-200/80 rounded-md text-[10px] font-bold uppercase">
                                  {rec.paymentPeriod || 'None'}
                                </span>
                              </td>
                              <td className="p-4 font-black text-stone-850 font-mono text-[13px]">
                                ₹{rec.totalAmount.toLocaleString('en-IN')}
                              </td>
                              <td className="p-4 text-stone-450">
                                <span className="block font-medium text-stone-700 leading-none">{rec.latestRecord.created_by_name}</span>
                                <span className="block text-[9px] mt-0.5">{rec.latestRecord.created_by_email}</span>
                              </td>
                              <td className="p-4 text-center">
                                <div className="inline-flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                  {/* Download Statement PDF Button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      generateContributorPDF(rec);
                                    }}
                                    className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg font-bold transition-all text-[11px] cursor-pointer inline-flex items-center justify-center border border-rose-100/30 bg-rose-50/10"
                                    title="Download Contributor Statement PDF"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>

                                  {canManageFinance && (
                                    <>
                                      {deleteConfirmId === rec.latestRecord.id ? (
                                        <div className="inline-flex items-center gap-1 animate-fade-in" onClick={e => e.stopPropagation()}>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRecordDelete(rec.latestRecord.id);
                                              setDeleteConfirmId(null);
                                            }}
                                            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-lg text-[9px] transition-all cursor-pointer shadow-3xs"
                                            title="Confirm Deletion"
                                          >
                                            Confirm
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeleteConfirmId(null);
                                            }}
                                            className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg font-bold transition-all text-[9px] cursor-pointer"
                                            title="Cancel Deletion"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setupEditMode(rec.latestRecord);
                                            }}
                                            className="p-1 px-2 hover:bg-stone-100 rounded-lg text-emerald-65 hover:text-emerald-800 font-extrabold transition-all text-[11px] cursor-pointer border border-stone-100"
                                            title="Edit latest payment"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeleteConfirmId(rec.latestRecord.id);
                                            }}
                                            className="p-1 px-2 hover:bg-rose-50 rounded-lg text-stone-400 hover:text-rose-605 font-medium transition-all text-[11px] cursor-pointer border border-stone-100"
                                            title="Delete latest payment"
                                          >
                                            Delete
                                          </button>
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>

                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={canManageFinance ? 6 : 5} className="p-0 bg-stone-50/20">
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.25, ease: "easeInOut" }}
                                      className="overflow-hidden"
                                    >
                                      <div className="p-4 bg-stone-50/60 border-b border-stone-150/80 space-y-4">
                                        {/* 12-Month Payment Matrix Grid */}
                                        <div className="space-y-1.5">
                                          <h5 className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider pl-1 border-l-2 border-emerald-600 flex items-center gap-1">
                                            🗓️ Monthly Contributions Matrix
                                          </h5>
                                          <div className="overflow-x-auto rounded-xl border border-stone-150 shadow-3xs bg-white p-3">
                                            <div className="min-w-[800px]">
                                              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
                                                {/* Headers */}
                                                {MONTHS.map(m => (
                                                  <div key={m} className="p-1.5 bg-stone-50 rounded-lg text-center border border-stone-100">
                                                    <span className="block text-[10px] font-black text-stone-400 uppercase">{m.slice(0, 3)}</span>
                                                  </div>
                                                ))}
                                                <div className="p-1.5 bg-emerald-50 rounded-lg text-center border border-emerald-100">
                                                  <span className="block text-[10px] font-black text-emerald-600 uppercase">Total Sum</span>
                                                </div>

                                                {/* Values */}
                                                {MONTHS.map(m => {
                                                  const recordsForMonth = rec.records.filter(r => r.payment_month === m);
                                                  const totalForMonth = recordsForMonth.reduce((sum, r) => sum + r.amount, 0);
                                                  return (
                                                    <div key={m} className="p-2 flex flex-col items-center justify-center min-h-[48px] text-center border border-dashed border-stone-100 rounded-lg">
                                                      {totalForMonth > 0 ? (
                                                        <>
                                                          <span className="text-xs font-extrabold text-stone-800 font-mono">
                                                            ₹{totalForMonth.toLocaleString('en-IN')}
                                                          </span>
                                                          {recordsForMonth.length > 1 && (
                                                            <span className="text-[8px] px-1 py-0.2 bg-stone-100 text-stone-500 rounded font-bold mt-0.5">
                                                              {recordsForMonth.length} recs
                                                            </span>
                                                          )}
                                                        </>
                                                      ) : (
                                                        <span className="text-xs text-stone-300 font-bold">-</span>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                                <div className="p-2 flex items-center justify-center bg-emerald-50/50 rounded-lg border border-emerald-100/50 font-mono text-center">
                                                  <span className="text-xs font-black text-emerald-700">
                                                    ₹{rec.totalAmount.toLocaleString('en-IN')}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Individual Receipts Breakdown list */}
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between">
                                            <h5 className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider pl-1 border-l-2 border-emerald-600 flex items-center gap-1">
                                              📄 Detailed Transaction Receipts ({rec.records.length})
                                            </h5>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                generateContributorPDF(rec);
                                              }}
                                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer border border-rose-100 shadow-3xs"
                                              title="Download Contributor Statement PDF"
                                            >
                                              <FileText className="w-3.5 h-3.5" />
                                              <span>Download Statement PDF</span>
                                            </button>
                                          </div>
                                          <div className="divide-y divide-stone-150/60 rounded-xl border border-stone-200 bg-white overflow-hidden shadow-3xs">
                                            {rec.records.map((item, idx) => (
                                              <div key={item.id} className="p-3.5 flex flex-wrap items-center justify-between gap-4 hover:bg-stone-50/30 transition-colors">
                                                <div className="flex items-center gap-3">
                                                  <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center text-[10px] font-extrabold font-mono">
                                                    {idx + 1}
                                                  </span>
                                                  <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-750 border border-emerald-100 rounded-md font-bold text-[9px] uppercase">
                                                        {item.payment_month}
                                                      </span>
                                                      <span className="text-xs font-bold text-stone-700">
                                                        Paid on {item.payment_date}
                                                      </span>
                                                    </div>
                                                    <p className="text-[10px] text-stone-400 mt-0.5">
                                                      Registered by: <span className="font-semibold text-stone-500">{item.created_by_name}</span> ({item.created_by_email})
                                                    </p>
                                                  </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                  <span className="text-sm font-black text-stone-800 font-mono">
                                                    ₹{item.amount.toLocaleString('en-IN')}
                                                  </span>

                                                  {canManageFinance && (
                                                    <div className="inline-flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                                      {deleteConfirmId === item.id ? (
                                                        <div className="inline-flex items-center gap-1.5 animate-fade-in">
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleRecordDelete(item.id);
                                                              setDeleteConfirmId(null);
                                                            }}
                                                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-[10px] cursor-pointer shadow-2xs"
                                                            title="Confirm Deletion"
                                                          >
                                                            Confirm
                                                          </button>
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setDeleteConfirmId(null);
                                                            }}
                                                            className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg font-bold text-[10px] cursor-pointer"
                                                            title="Cancel Deletion"
                                                          >
                                                            Cancel
                                                          </button>
                                                        </div>
                                                      ) : (
                                                        <>
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setupEditMode(item);
                                                            }}
                                                            className="px-2 py-1.5 hover:bg-stone-100 text-stone-500 hover:text-emerald-700 font-bold text-[10px] rounded-lg transition-all cursor-pointer"
                                                          >
                                                            Edit
                                                          </button>
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setDeleteConfirmId(item.id);
                                                            }}
                                                            className="px-2 py-1.5 hover:bg-rose-50 text-stone-400 hover:text-rose-600 font-bold text-[10px] rounded-lg transition-all cursor-pointer"
                                                          >
                                                            Delete
                                                          </button>
                                                        </>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  </td>
                                </tr>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPagesBial > 1 && (
                <div className="flex items-center justify-between border-t border-stone-150 bg-stone-50 px-4 py-3.5 sm:px-6">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-xl border border-stone-250 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPagesBial))}
                      disabled={currentPage === totalPagesBial}
                      className="relative ml-3 inline-flex items-center rounded-xl border border-stone-250 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-stone-500">
                        Showing <span className="font-extrabold text-stone-800">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                        <span className="font-extrabold text-stone-800">{Math.min(currentPage * itemsPerPage, currentBialRecords.length)}</span> of{' '}
                        <span className="font-extrabold text-stone-800">{currentBialRecords.length}</span> records
                      </p>
                    </div>
                    <div>
                      <nav className="isolate inline-flex -space-x-px rounded-xl gap-1" aria-label="Pagination">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-extrabold text-stone-555 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          First
                        </button>
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-extrabold text-stone-555 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Prev
                        </button>
                        
                        {Array.from({ length: Math.min(5, totalPagesBial) }, (_, i) => {
                          let pageNum = currentPage;
                          if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPagesBial - 2) {
                            pageNum = totalPagesBial - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          if (pageNum < 1 || pageNum > totalPagesBial) return null;
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`relative inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${
                                currentPage === pageNum
                                  ? 'z-10 bg-emerald-600 text-white shadow-xs'
                                  : 'text-stone-700 hover:bg-stone-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPagesBial))}
                          disabled={currentPage === totalPagesBial}
                          className="relative inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-extrabold text-stone-555 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Next
                        </button>
                        <button
                          onClick={() => setCurrentPage(totalPagesBial)}
                          disabled={currentPage === totalPagesBial}
                          className="relative inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-extrabold text-stone-555 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Last
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

        </div>
      )}

      {/* DYNAMIC RECORD MODAL DIALOG (ADD / EDIT FORM) */}
      {isAddFormOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="record_dialog_stage">
          <div className="bg-white rounded-3xl border border-stone-150 max-w-lg w-full overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[90vh]">
            
            <header className="p-5 bg-gradient-to-r from-stone-900 to-stone-950 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold uppercase tracking-widest">
                  {editingRecord ? 'Update Payment Audit Log' : 'Create New Payment Audit Entry'}
                </h3>
                <p className="text-[10px] text-stone-400 leading-none">
                  {editingRecord ? 'Modify the existing physical financial entry parameters' : 'Insert a new physical contribution receipt into the database'}
                </p>
              </div>
              <button 
                onClick={closeForm}
                className="p-1 bg-white/10 hover:bg-white/20 rounded-lg text-stone-200 hover:text-white transition-colors cursor-pointer"
                title="Dismiss Form"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </header>

            <form onSubmit={handleRecordSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-medium animate-fade-in">
                    <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
                    <span>{formError}</span>
                  </div>
                )}

                {isBialMismatched && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center justify-between gap-3 font-semibold">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 animate-pulse" />
                      <span>
                        <strong>{formName}</strong> is associated with <strong>{selectedUserAssignedBial}</strong>. You can still save this record under <strong>{formArea}</strong>, but please double check if this is correct.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedUserAssignedBial) {
                          setFormArea(selectedUserAssignedBial);
                          const config = bialConfigs.find(c => c.id === selectedUserAssignedBial);
                          if (config && config.area && config.area !== 'TBD') {
                            setFormAddress(config.area);
                          }
                        }
                      }}
                      className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 text-amber-950 font-bold rounded-lg text-[10px] uppercase tracking-wider shrink-0 transition-colors cursor-pointer border border-amber-200"
                    >
                      Use Profile Bial
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="sm:col-span-2 relative">
                  <label className="block text-[10px] font-bold text-stone-450 uppercase mb-1">Paid Donor / User Name *</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={e => {
                        setFormName(e.target.value);
                        setShowUserDropdown(true);
                      }}
                      onFocus={() => setShowUserDropdown(true)}
                      onBlur={() => setTimeout(() => setShowUserDropdown(false), 250)}
                      placeholder="Enter or search donor's full name"
                      className="w-full text-xs px-3.5 py-2.5 border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500 bg-stone-50 font-medium animate-transition"
                    />
                    
                    {showUserDropdown && filteredMembersForDropdown.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-stone-250 rounded-xl shadow-xl z-50 divide-y divide-stone-100">
                        <div className="p-2 bg-stone-50 text-[9px] font-bold text-stone-400 uppercase tracking-wider sticky top-0 border-b border-stone-150">
                          Select from registered approved members:
                        </div>
                        {filteredMembersForDropdown.map(member => {
                          const assignedBial = getMemberBial(member.name, member.address, editingRecord?.id);
                          return (
                            <button
                              key={member.id}
                              type="button"
                              onMouseDown={() => {
                                setFormName(member.name);
                                setShowUserDropdown(false);
                                if (assignedBial) {
                                  setFormArea(assignedBial);
                                  const config = bialConfigs.find(c => c.id === assignedBial);
                                  if (config && config.area && config.area !== 'TBD') {
                                    setFormAddress(config.area);
                                  }
                                } else {
                                  const config = bialConfigs.find(c => c.id === formArea);
                                  if (config && config.area && config.area !== 'TBD') {
                                    setFormAddress(config.area);
                                  }
                                }
                              }}
                              className="w-full text-left px-3.5 py-2.5 hover:bg-stone-50 transition-colors flex items-center justify-between text-xs cursor-pointer"
                            >
                              <div>
                                <span className="font-extrabold text-stone-850 block">
                                  {member.name}
                                </span>
                                <span className="text-[10px] text-stone-450 block">
                                  {member.email} {member.phone ? `• ${member.phone}` : ''}
                                </span>
                              </div>
                              {assignedBial ? (
                                <span className="text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md">
                                  {assignedBial}
                                </span>
                              ) : (
                                <span className="text-[9px] font-semibold text-stone-400">
                                  No Bial Assigned
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-stone-450 uppercase mb-1">Donor Physical Address (Geographic Area Location) *</label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={formAddress}
                    placeholder="Bial configured area location"
                    className="w-full text-xs px-3.5 py-2.5 border rounded-xl bg-stone-100 text-stone-600 font-semibold border-stone-200 cursor-not-allowed focus:outline-hidden"
                    title="Automatically pre-filled and locked using the selected Bial's Geographic Scope."
                  />
                  <p className="text-[9px] text-stone-400 mt-1 font-medium">
                    Locked to the selected Bial's configured Area Location. Modify Bial leadership parameters to change.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-stone-450 uppercase mb-1">
                    {isBulkMode ? 'Default Monthly Amount *' : 'Receipt Valuation (Amount in ₹) *'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs text-stone-400 font-bold">₹</span>
                    <input
                      type="number"
                      required={!isBulkMode}
                      min="1"
                      value={formAmount}
                      onChange={e => setFormAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={isBulkMode ? "e.g. 1000 (applies to selected months)" : "e.g. 1500"}
                      className="w-full text-xs pl-8 pr-3.5 py-2.5 border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500 bg-stone-50 font-bold font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-stone-450 uppercase mb-1">Assigned Administrative Bial *</label>
                  <select
                    value={formArea}
                    onChange={e => {
                      const selectedBial = e.target.value;
                      setFormArea(selectedBial);
                      const config = bialConfigs.find(c => c.id === selectedBial);
                      if (config && config.area && config.area !== 'TBD') {
                        setFormAddress(config.area);
                      }
                    }}
                    className="w-full text-xs px-3.5 py-2.5 border rounded-xl bg-stone-50 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-bold"
                  >
                    {BIAL_IDS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                {!editingRecord && (
                  <div className="sm:col-span-2 p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-emerald-950 block">Bulk Payment Mode</span>
                      <span className="text-[10px] text-emerald-700 block">Record multiple months for this contributor in a single form submit</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsBulkMode(!isBulkMode)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        isBulkMode ? 'bg-emerald-600' : 'bg-stone-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          isBulkMode ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )}

                {isBulkMode && !editingRecord ? (
                  <div className="sm:col-span-2 space-y-3 pt-2">
                    <label className="block text-[10px] font-bold text-stone-450 uppercase">Select Months & Customize Amounts *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1 border border-stone-150 p-2.5 rounded-2xl bg-stone-50">
                      {MONTHS.map(month => {
                        const entry = bulkEntries[month];
                        return (
                          <div 
                            key={month} 
                            className={`p-2 rounded-xl border flex flex-col gap-1.5 transition-all ${
                              entry.selected 
                                ? 'bg-white border-emerald-300 shadow-xs opacity-100' 
                                : 'bg-stone-50/50 border-stone-200/60 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`bulk-month-${month}`}
                                checked={entry.selected}
                                onChange={e => {
                                  setBulkEntries(prev => ({
                                    ...prev,
                                    [month]: { ...prev[month], selected: e.target.checked }
                                  }));
                                }}
                                className="w-3.5 h-3.5 rounded-sm text-emerald-600 border-stone-300 focus:ring-emerald-500 cursor-pointer"
                              />
                              <label 
                                htmlFor={`bulk-month-${month}`}
                                className="text-xs font-black text-stone-800 cursor-pointer select-none"
                              >
                                {month}
                              </label>
                            </div>

                            {entry.selected && (
                              <div className="grid grid-cols-2 gap-1.5 pl-5 animate-slide-down">
                                <div>
                                  <label className="block text-[9px] font-semibold text-stone-400">Amount (₹)</label>
                                  <input
                                    type="number"
                                    placeholder={formAmount ? `${formAmount}` : "e.g. 1000"}
                                    value={entry.amount}
                                    onChange={e => {
                                      const val = e.target.value === '' ? '' : Number(e.target.value);
                                      setBulkEntries(prev => ({
                                        ...prev,
                                        [month]: { ...prev[month], amount: val }
                                      }));
                                    }}
                                    className="w-full text-[11px] px-2 py-1 border rounded-lg bg-white font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-semibold text-stone-400">Date</label>
                                  <input
                                    type="date"
                                    value={entry.date}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setBulkEntries(prev => ({
                                        ...prev,
                                        [month]: { ...prev[month], date: val }
                                      }));
                                    }}
                                    className="w-full text-[11px] px-2 py-1 border rounded-lg bg-white font-bold"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-450 uppercase mb-1">Donation Period (Month) *</label>
                      <select
                        value={formMonth}
                        onChange={e => setFormMonth(e.target.value)}
                        className="w-full text-xs px-3.5 py-2.5 border rounded-xl bg-stone-50 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-bold"
                      >
                        {MONTHS.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-stone-450 uppercase mb-1">Payment Date *</label>
                      <input
                        type="date"
                        required
                        value={formDate}
                        onChange={e => setFormDate(e.target.value)}
                        className="w-full text-xs px-3.5 py-2.5 border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500 bg-stone-50 font-bold"
                      />
                    </div>
                  </>
                )}

              </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 p-5 border-t border-stone-150 bg-stone-50/50 shrink-0">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2.5 border hover:bg-stone-50 text-stone-605 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close Panel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 font-black rounded-xl text-xs shadow-xs inline-flex items-center gap-1 transition-all bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm active:translate-y-[1px]"
                >
                  <span>{editingRecord ? 'Save Audit Row' : 'Submit Receipt'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF REPORT CUSTOMIZATION DIALOG */}
      {isPDFModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="pdf_customization_modal">
          <div className="bg-white rounded-3xl border border-stone-150 max-w-xl w-full overflow-hidden shadow-2xl animate-scale-up">
            
            <header className="p-5 bg-stone-900 text-white flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-rose-500" />
                  <span>Customize Financial Report PDF</span>
                </h3>
                <p className="text-[10px] text-stone-400 leading-none">
                  Choose which sections and Bial contributor sheets to include in your generated PDF report
                </p>
              </div>
              <button 
                onClick={() => setIsPDFModalOpen(false)}
                className="p-1 bg-white/10 hover:bg-white/20 rounded-lg text-stone-200 hover:text-white transition-colors cursor-pointer"
                title="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
              
              {/* Overall options */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-stone-400">Report Contents</h4>
                
                <label className="flex items-start gap-3 p-3.5 bg-stone-50 hover:bg-stone-100/70 rounded-2xl border border-stone-150 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={pdfIncludeSummary}
                    onChange={e => setPdfIncludeSummary(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="block text-xs font-extrabold text-stone-900">Include Overall Monthly Summary Sheet</span>
                    <span className="block text-[10px] text-stone-450 mt-0.5 leading-tight">
                      A beautiful landscape matrix summarizing Bial-wise monthly totals, total active contributors count, and general audit statistics.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 bg-stone-50 hover:bg-stone-100/70 rounded-2xl border border-stone-150 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={pdfIncludeTopDonors}
                    onChange={e => setPdfIncludeTopDonors(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="block text-xs font-extrabold text-stone-900">Include Top 10 Contributors Leaderboard</span>
                    <span className="block text-[10px] text-stone-450 mt-0.5 leading-tight">
                      A beautiful leaderboard honoring the top 10 contributors and donors of the selected time period with custom ranking badges.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 bg-stone-50 hover:bg-stone-100/70 rounded-2xl border border-stone-150 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={pdfIncludeDetails}
                    onChange={e => setPdfIncludeDetails(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="block text-xs font-extrabold text-stone-900">Include Detailed Contributor Registers</span>
                    <span className="block text-[10px] text-stone-450 mt-0.5 leading-tight">
                      Append individual, formatted list tables showing member contributions, payments, and payment dates for selected Bial areas.
                    </span>
                  </div>
                </label>
              </div>

              {/* Month Selector Panel */}
              <div className="space-y-3 border-t border-stone-100 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-stone-400">Select Months to Include</h4>
                  <div className="flex bg-stone-100 p-0.5 rounded-lg text-[9px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPdfMonthMode('all')}
                      className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${pdfMonthMode === 'all' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                      All Months
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfMonthMode('current')}
                      className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${pdfMonthMode === 'current' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                      Current Month
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfMonthMode('custom')}
                      className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${pdfMonthMode === 'custom' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                      Custom Selected
                    </button>
                  </div>
                </div>

                {pdfMonthMode === 'custom' && (
                  <div className="space-y-3 animate-fade-in pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-stone-450 font-bold">Check/uncheck months below:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPdfSelectedMonths(MONTHS)}
                          className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md cursor-pointer"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setPdfSelectedMonths([])}
                          className="text-[9px] font-bold text-stone-500 hover:text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {MONTHS.map(month => {
                        const isSelected = pdfSelectedMonths.includes(month);
                        const count = records.filter(r => r.payment_month === month).length;
                        return (
                          <button
                            key={month}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setPdfSelectedMonths(prev => prev.filter(m => m !== month));
                              } else {
                                setPdfSelectedMonths(prev => [...prev, month]);
                              }
                            }}
                            className={`flex flex-col items-start p-2 rounded-xl border transition-all text-left relative cursor-pointer ${
                              isSelected 
                                ? 'bg-emerald-50/50 border-emerald-500/30 ring-1 ring-emerald-500/20' 
                                : 'bg-white border-stone-150 hover:bg-stone-50'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] font-extrabold text-stone-900">{month.slice(0, 3)}</span>
                              <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${
                                isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-stone-300 bg-white'
                              }`}>
                                {isSelected && <Check className="w-2 h-2 stroke-[4]" />}
                              </div>
                            </div>
                            <span className="text-[8px] text-stone-450 font-mono font-bold mt-1 bg-stone-100 px-1 py-0.2 rounded leading-none">
                              {count} {count === 1 ? 'record' : 'records'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {pdfMonthMode === 'current' && (
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-150 flex items-center justify-between text-xs font-bold text-stone-700 animate-fade-in">
                    <span>Only records assigned to:</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-extrabold">{MONTHS[new Date().getMonth()]} (Current Month)</span>
                  </div>
                )}
              </div>

              {/* Bial Selector Panel - only visible when pdfIncludeDetails is true */}
              {pdfIncludeDetails && (
                <div className="space-y-3 border-t border-stone-100 pt-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-stone-400">Select Bial Areas ({pdfSelectedBials.length}/12)</h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPdfSelectedBials(BIAL_IDS)}
                        className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md cursor-pointer"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setPdfSelectedBials([])}
                        className="text-[9px] font-bold text-stone-500 hover:text-stone-700 bg-stone-100 px-2 py-1 rounded-md cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {BIAL_IDS.map(bialId => {
                      const config = bialConfigs.find(c => c.id === bialId);
                      const areaName = config?.area || 'General';
                      const count = records.filter(r => r.area === bialId).length;
                      const isSelected = pdfSelectedBials.includes(bialId);
                      
                      return (
                        <button
                          key={bialId}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setPdfSelectedBials(prev => prev.filter(b => b !== bialId));
                            } else {
                              setPdfSelectedBials(prev => [...prev, bialId]);
                            }
                          }}
                          className={`flex flex-col items-start p-2.5 rounded-xl border transition-all text-left relative cursor-pointer ${
                            isSelected 
                              ? 'bg-emerald-50/50 border-emerald-500/30 ring-1 ring-emerald-500/20' 
                              : 'bg-white border-stone-150 hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[11px] font-extrabold text-stone-900">{bialId}</span>
                            <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
                              isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-stone-300 bg-white'
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[4]" />}
                            </div>
                          </div>
                          <span className="text-[9px] text-stone-450 font-medium truncate max-w-[130px] mt-0.5">{areaName}</span>
                          <span className="text-[8px] mt-1 font-mono font-bold text-stone-500 px-1.5 py-0.5 bg-stone-100 rounded">
                            {count} {count === 1 ? 'receipt' : 'receipts'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            <footer className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
              <span className="text-[9px] text-stone-450 font-bold font-mono">
                A4 Landscape format. Consistent Style.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPDFModalOpen(false)}
                  className="px-4 py-2.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-605 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={generatePDFReport}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5 hover:shadow-xs transition-all animate-pulse"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Download Report PDF</span>
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-150 shadow-xl max-w-md w-full overflow-hidden animate-fade-in">
            <header className="px-5 py-4 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900 uppercase tracking-wide">Bulk Edit {selectedRecordIds.length} Entries</h3>
                <p className="text-[10px] text-stone-450 mt-0.5">Updating selected contributions in {activeTab}</p>
              </div>
              <button
                onClick={() => setIsBulkEditModalOpen(false)}
                className="p-1 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="p-5 space-y-4">
              <p className="text-xs text-stone-500 bg-stone-50 p-3 rounded-xl border border-stone-100">
                Only filled-out values below will be applied to the {selectedRecordIds.length} selected records. Empty fields will remain unmodified.
              </p>

              <div className="space-y-4">
                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] text-stone-450 font-bold uppercase tracking-wider">
                    New Monthly Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2 text-xs font-bold text-stone-400">₹</span>
                    <input
                      type="number"
                      placeholder="Leave blank to keep existing amount"
                      value={bulkEditAmount}
                      onChange={(e) => setBulkEditAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full pl-8 pr-3.5 py-2 text-xs border border-stone-250 rounded-xl focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Period */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] text-stone-450 font-bold uppercase tracking-wider">
                    New Payment Month
                  </label>
                  <select
                    value={bulkEditMonth}
                    onChange={(e) => setBulkEditMonth(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-250 rounded-xl focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- Keep Existing Months --</option>
                    {MONTHS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Payment Date */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] text-stone-450 font-bold uppercase tracking-wider">
                    New Payment Date
                  </label>
                  <input
                    type="date"
                    value={bulkEditDate}
                    onChange={(e) => setBulkEditDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-250 rounded-xl focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <footer className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkEditModalOpen(false)}
                className="px-4 py-2 bg-white border border-stone-200 hover:bg-stone-50 text-stone-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkEdit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer hover:shadow-xs transition-all"
              >
                Apply Bulk Updates
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm Modal */}
      {isBulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-150 shadow-xl max-w-md w-full overflow-hidden animate-fade-in">
            <header className="px-5 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-rose-900 uppercase tracking-wide">Confirm Bulk Deletion</h3>
                <p className="text-[10px] text-rose-700 mt-0.5">Destructive action for {selectedRecordIds.length} entries</p>
              </div>
              <button
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                className="p-1 hover:bg-rose-100 rounded-lg text-rose-500 hover:text-rose-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="p-5 space-y-3">
              <p className="text-xs text-stone-600 font-medium leading-relaxed">
                Are you sure you want to permanently delete these <strong className="text-stone-900">{selectedRecordIds.length}</strong> financial records in {activeTab}?
              </p>
              <p className="text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100 font-bold">
                ⚠️ This process is completely irreversible and will remove these receipts permanently from the central database.
              </p>
            </div>

            <footer className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                className="px-4 py-2 bg-white border border-stone-200 hover:bg-stone-50 text-stone-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-xs cursor-pointer hover:shadow-xs transition-all"
              >
                Delete Permanently ({selectedRecordIds.length})
              </button>
            </footer>
          </div>
        </div>
      )}

    </div>
  );
}

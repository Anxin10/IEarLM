
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Patient, UserRole, Language, EarExamRecord, User } from '../types';
import { Search, Plus, Trash2, Edit, Info, ArrowUpDown, ArrowDown, ArrowUp, ListFilter, User as UserIcon, Calendar, Stethoscope, Hash, Activity, CheckCircle2, CircleDashed, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, Check, Lock, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { translations, getDiseaseDisplayName } from '../services/translations';
import { login } from '../services/authService';

interface PatientListProps {
  patients: Patient[];
  role: UserRole;
  currentUser: User;
  onDelete: (id: string) => void;
  onEdit: (patient: Patient) => void;
  onCreate: () => void;
  lang: Language;
}

type SortKey = 'id' | 'date'; 
type SortDirection = 'asc' | 'desc';
type ProcessStatus = 'pending' | 'diagnosing' | 'completed';

const ITEMS_PER_PAGE = 10;

// --- Helper: Status Definitions ---
const getStatusConfig = (status: ProcessStatus, lang: Language) => {
    const t = translations[lang] as any;
    switch (status) {
        case 'completed':
            return {
                label: t.filterCompleted,
                icon: CheckCircle2,
                className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30'
            };
        case 'diagnosing':
            return {
                label: t.filterDiagnosing,
                icon: Activity,
                className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30'
            };
        default: // pending
            return {
                label: t.filterPending,
                icon: CircleDashed,
                className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            };
    }
};

// --- Stable Tooltip Components ---

const ActionTooltip = ({ content, children }: { content: string, children?: React.ReactNode }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    
    const handleEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({ top: rect.top - 10, left: rect.left + rect.width / 2 });
            setIsVisible(true);
        }
    };
    
    return (
        <div ref={triggerRef} onMouseEnter={handleEnter} onMouseLeave={() => setIsVisible(false)} className="relative inline-flex">
            {children}
            {isVisible && createPortal(
                <div className="fixed z-[9999] -translate-x-1/2 -translate-y-full px-2 pointer-events-none" style={{ top: coords.top, left: coords.left }}>
                    <motion.div 
                        initial={{ opacity: 0, y: 5, scale: 0.9 }} 
                        animate={{ opacity: 1, y: 0, scale: 1 }} 
                        exit={{ opacity: 0, scale: 0.9 }}
                        // Forced "Light Mode" style for tooltip
                        className="bg-white text-slate-800 border border-slate-200 text-[10px] font-black uppercase tracking-widest py-1.5 px-3 rounded-lg shadow-xl whitespace-nowrap"
                    >
                        {content}
                        <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-slate-200 rotate-45" />
                    </motion.div>
                </div>, document.body
            )}
        </div>
    );
};

const DiagnosisTooltip = ({ children, content }: { children?: React.ReactNode, content: React.ReactNode }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, align: 'bottom' });
    const triggerRef = useRef<HTMLDivElement>(null);
    
    const handleEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const showAbove = spaceBelow < 280; 
            setCoords({ 
                top: showAbove ? rect.top - 10 : rect.bottom + 10, 
                left: rect.left + rect.width / 2, 
                align: showAbove ? 'top' : 'bottom' 
            });
            setIsVisible(true);
        }
    };
    
    return (
        <div ref={triggerRef} onMouseEnter={handleEnter} onMouseLeave={() => setIsVisible(false)} className="w-full h-full cursor-help relative flex items-center">
            {children}
            {isVisible && createPortal(
                <div className={`fixed z-[9999] -translate-x-1/2 pointer-events-none ${coords.align === 'top' ? '-translate-y-full' : ''}`} style={{ top: coords.top, left: coords.left }}>
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        className="bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-4 w-[320px] text-left relative"
                    >
                        {content}
                        <div className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-[#0b1120] border-l border-t border-slate-200 dark:border-slate-700 rotate-45 ${coords.align === 'top' ? 'bottom-[-7px] border-l-0 border-t-0 border-r border-b' : 'top-[-7px]'}`} />
                    </motion.div>
                </div>, document.body
            )}
        </div>
    );
};

const PatientList: React.FC<PatientListProps> = ({ patients, role, currentUser, onDelete, onEdit, onCreate, lang }) => {
  const t = translations[lang] as any;
  
  // 防護檢查：如果 currentUser 不存在，返回錯誤訊息並重定向
  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-red-500 font-bold text-lg">{lang === 'zh' ? '用戶信息未加載' : 'User information not loaded'}</p>
        <p className="text-slate-500 text-sm">{lang === 'zh' ? '請重新登錄' : 'Please log in again'}</p>
      </div>
    );
  }
  
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'id', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProcessStatus | 'all'>('all');
  
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false); // New State for Filter Menu
  
  const [currentPage, setCurrentPage] = useState(1);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter Menu Ref for click outside
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
              setIsFilterMenuOpen(false);
          }
          if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
              setIsSortMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to determine status from exams data
  const deriveStatus = (patient: Patient): ProcessStatus => {
      if (!patient.exams) return 'pending';
      const { left, right } = patient.exams;
      const isComplete = left.status === 'completed' && right.status === 'completed';
      if (isComplete) return 'completed';
      const hasData = (rec: EarExamRecord) => {
          const findingsCount = (rec.detailedFindings?.EAC?.length || 0) + (rec.detailedFindings?.TM?.length || 0);
          const hasNotes = !!rec.notes?.trim();
          return findingsCount > 0 || hasNotes;
      };
      if (left.status === 'completed' || right.status === 'completed' || hasData(left) || hasData(right)) {
          return 'diagnosing';
      }
      return 'pending';
  };

  const sortedPatients = useMemo(() => {
    let sortableItems = [...patients];
    
    // 1. Text Search
    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        sortableItems = sortableItems.filter(p => 
            p.name.toLowerCase().includes(lowerTerm) || 
            p.id.toLowerCase().includes(lowerTerm) || 
            p.diagnosis.toLowerCase().includes(lowerTerm)
        );
    }

    // 2. Status Filter
    if (statusFilter !== 'all') {
        sortableItems = sortableItems.filter(p => deriveStatus(p) === statusFilter);
    }

    // 3. Sorting
    sortableItems.sort((a, b) => {
      let aValue: any = ''; let bValue: any = '';
      if (sortConfig.key === 'id') { aValue = a.id.replace(/\D/g, ''); bValue = b.id.replace(/\D/g, ''); } 
      else if (sortConfig.key === 'date') { aValue = new Date(a.visitDate).getTime(); bValue = new Date(b.visitDate).getTime(); }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortableItems;
  }, [patients, sortConfig, searchTerm, statusFilter]);

  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, sortConfig, statusFilter]);

  const totalPages = Math.ceil(sortedPatients.length / ITEMS_PER_PAGE);
  const paginatedPatients = sortedPatients.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
  );

  const handleSort = (key: SortKey) => { 
      setSortConfig(current => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' })); 
  };

  const CheckIcon = () => (
      <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm shadow-blue-500/30">
          <Check size={10} strokeWidth={4} />
      </div>
  );

  const SortIcon = ({ colKey }: { colKey: SortKey }) => { 
      if (sortConfig.key !== colKey) return <ArrowUpDown size={12} className="opacity-30" />; 
      return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-600" /> : <ArrowDown size={12} className="text-blue-600" />; 
  };

  // Helper for filter option translation
  const getFilterLabel = (val: string) => {
      if (val === 'all') return t.filterAll;
      if (val === 'pending') return t.filterPending;
      if (val === 'diagnosing') return t.filterDiagnosing;
      if (val === 'completed') return t.filterCompleted;
      return val;
  };

  const DiagnosisCell = ({ patient }: { patient: Patient }) => {
    const leftDx = patient.exams?.left.diagnosis ? getDiseaseDisplayName(patient.exams.left.diagnosis, lang) : (lang === 'zh' ? '未檢查' : 'Pending');
    const rightDx = patient.exams?.right.diagnosis ? getDiseaseDisplayName(patient.exams.right.diagnosis, lang) : (lang === 'zh' ? '未檢查' : 'Pending');
    
    const tooltipContent = (
        <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                <Info size={14} className="text-blue-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.diagnosisSummary}</span>
            </div>
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-black text-white bg-blue-600 px-1.5 py-0.5 rounded uppercase">L</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.leftEar}</span>
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200 pl-7 leading-relaxed">{leftDx}</div>
            </div>
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-black text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded uppercase">R</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.rightEar}</span>
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200 pl-7 leading-relaxed">{rightDx}</div>
            </div>
        </div>
    );

    return (
        <DiagnosisTooltip content={tooltipContent}>
            <div className="flex flex-col justify-center gap-1.5 w-full pl-2 min-w-0">
                <div className="flex items-center gap-2 w-full min-w-0">
                    <div className="w-4 h-4 rounded-md bg-blue-600 text-white flex items-center justify-center text-[9px] font-black shrink-0 shadow-sm shadow-blue-500/30">L</div>
                    <span className={`text-xs font-bold truncate flex-1 ${leftDx === 'Normal' || leftDx === '正常' ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{leftDx}</span>
                </div>
                <div className="flex items-center gap-2 w-full min-w-0">
                    <div className="w-4 h-4 rounded-md bg-slate-400 text-white flex items-center justify-center text-[9px] font-black shrink-0">R</div>
                    <span className={`text-xs font-bold truncate flex-1 ${rightDx === 'Normal' || rightDx === '正常' ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{rightDx}</span>
                </div>
            </div>
        </DiagnosisTooltip>
    );
  };

  // --- Optimized Grid Layout Constants ---
  const gridTemplate = "minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) minmax(120px, 0.8fr)";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col w-full bg-white dark:bg-[#0b1120] overflow-hidden">
      
      {/* 1. Fixed Header Section */}
      <div className="h-20 bg-white dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 md:px-8 shrink-0 z-30 transition-colors">
        <div className="flex items-center min-w-0 mr-4">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase whitespace-nowrap">{t.patients}</h1>
            <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-4 shrink-0"></div>
            <p className="hidden xl:block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap truncate">{t.clinicalDatabaseSub}</p>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
            {/* Search Box */}
            <div className="relative w-48 lg:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder={t.searchPlaceholder} 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-xs dark:text-white placeholder:font-medium shadow-inner h-10" 
                />
            </div>

            {/* Redesigned Filter Dropdown */}
            <div className="relative" ref={filterRef}>
                <button 
                    onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)} 
                    className={`h-10 bg-slate-50 dark:bg-[#1e293b] border hover:border-blue-500 dark:hover:border-blue-600 text-slate-600 dark:text-slate-300 px-4 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-sm min-w-[130px] justify-between whitespace-nowrap ${
                        isFilterMenuOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-800'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <Filter size={14} className={statusFilter !== 'all' ? 'text-blue-600' : 'text-slate-400'} /> 
                        {getFilterLabel(statusFilter)}
                    </span>
                    <ArrowDown size={12} className={`transition-transform duration-300 ${isFilterMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                    {isFilterMenuOpen && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden" onClick={() => setIsFilterMenuOpen(false)}>
                            <div className="p-2 space-y-1">
                                {['all', 'completed', 'diagnosing', 'pending'].map((s) => (
                                    <button 
                                        key={s}
                                        onClick={() => setStatusFilter(s as ProcessStatus | 'all')} 
                                        className={`w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black flex items-center justify-between transition-colors uppercase tracking-widest ${
                                            statusFilter === s 
                                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                                        }`}
                                    >
                                        {getFilterLabel(s)} 
                                        {statusFilter === s && <CheckIcon />}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            
            {/* Sort Dropdown */}
            <div className="relative" ref={sortRef}>
                <button onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} className="h-10 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-600 text-slate-600 dark:text-slate-300 px-4 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-sm min-w-[100px] justify-between whitespace-nowrap">
                    <span className="flex items-center gap-2"><ListFilter size={14} /> {lang === 'zh' ? '排序' : 'Sort'}</span>
                    <ArrowDown size={12} className={`transition-transform duration-300 ${isSortMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                    {isSortMenuOpen && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden" onClick={() => setIsSortMenuOpen(false)}>
                            <div className="p-2 space-y-1">
                                <button onClick={() => setSortConfig({ key: 'id', direction: 'desc' })} className="w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-widest">{lang === 'zh' ? '最新 (編號)' : 'Newest (ID)'} {sortConfig.key === 'id' && sortConfig.direction === 'desc' && <CheckIcon />}</button>
                                <button onClick={() => setSortConfig({ key: 'date', direction: 'desc' })} className="w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-widest">{lang === 'zh' ? '看診日期' : 'Visit Date'} {sortConfig.key === 'date' && <CheckIcon />}</button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Add Button */}
            <button onClick={onCreate} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white h-10 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/20 font-black uppercase text-[10px] tracking-widest whitespace-nowrap">
                <Plus size={14} /> {t.register}
            </button>
        </div>
      </div>
      
      {/* 
          Main Scroll Container:
          This div handles BOTH x and y scrolling if content overflows.
          It prevents the "runaway layout" by containing the wide grid.
      */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-[#0b1120] w-full relative">
          
          {/* Sticky Header Row */}
          <div className="bg-slate-50 dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-20 min-w-[1100px]">
              <div className="grid gap-4 px-6 py-4 items-center" style={{ gridTemplateColumns: gridTemplate }}>
                    {/* ID */}
                    <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer hover:text-blue-500 transition-colors" onClick={() => handleSort('id')}>
                        <Hash size={14} /> {t.idLabel} <SortIcon colKey="id" />
                    </div>
                    {/* Profile */}
                    <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 border-l border-slate-200 dark:border-slate-800">
                        <UserIcon size={14} /> {t.profileLabel}
                    </div>
                    {/* Diagnosis */}
                    <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 border-l border-slate-200 dark:border-slate-800">
                        <Stethoscope size={14} /> {t.diagnosisLabel}
                    </div>
                    {/* Status */}
                    <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 border-l border-slate-200 dark:border-slate-800">
                        <Activity size={14} /> {lang === 'zh' ? '狀態' : 'Status'}
                    </div>
                    {/* Date */}
                    <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 border-l border-slate-200 dark:border-slate-800 cursor-pointer hover:text-blue-500 transition-colors" onClick={() => handleSort('date')}>
                        <Calendar size={14} /> {t.dateLabel} <SortIcon colKey="date" />
                    </div>
                    {/* Actions */}
                    <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-l border-slate-200 dark:border-slate-800 text-center">
                        {t.actionsLabel}
                    </div>
              </div>
          </div>

          {/* List Content */}
          <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 min-w-[1100px]">
              {paginatedPatients.map((patient, index) => {
                const status = deriveStatus(patient);
                const statusConfig = getStatusConfig(status, lang);
                
                return (
                <motion.div 
                    key={patient.id} 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: index * 0.03 }} 
                    className="grid gap-4 px-6 py-4 items-center group hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors min-h-[88px]"
                    style={{ gridTemplateColumns: gridTemplate }}
                >
                  {/* ID */}
                  <div className="flex justify-center min-w-0">
                      <div className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg inline-block truncate max-w-full shadow-sm border border-slate-200 dark:border-slate-700/50" title={patient.id}>
                          {patient.id}
                      </div>
                  </div>

                  {/* Profile */}
                  <div className="flex justify-center h-full min-w-0 pl-2">
                      <div className="flex items-center gap-4 overflow-hidden w-full max-w-[180px]">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 shadow-sm border border-slate-200 dark:border-slate-700 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              {patient.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col justify-center gap-1.5 min-w-0 flex-1">
                              <div className="font-[800] text-slate-900 dark:text-white text-sm truncate" title={patient.name}>
                                  {patient.name}
                              </div>
                              <div className="flex items-center truncate min-w-0">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1.5 truncate ${
                                      patient.gender === 'Male' 
                                      ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30' 
                                      : 'bg-pink-50 text-pink-700 border-pink-100 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-900/30'
                                  }`}>
                                      <span className="uppercase tracking-wide">{patient.gender === 'Male' ? (lang === 'zh' ? '男' : 'Male') : (lang === 'zh' ? '女' : 'Female')}</span>
                                      <span className="w-px h-2.5 bg-current opacity-20"></span>
                                      <span>{patient.age} {lang === 'zh' ? '歲' : 'Y'}</span>
                                  </span>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Diagnosis */}
                  <div className="overflow-hidden min-w-0 h-full flex items-center">
                      <DiagnosisCell patient={patient} />
                  </div>

                  {/* Status */}
                  <div className="flex justify-center min-w-0">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${statusConfig.className}`}>
                          <statusConfig.icon size={12} />
                          <span>{statusConfig.label}</span>
                      </div>
                  </div>

                  {/* Date */}
                  <div className="flex justify-center min-w-0">
                      <span className="font-bold text-xs text-slate-500 dark:text-slate-400 font-mono tracking-tight whitespace-nowrap bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                          {patient.visitDate}
                      </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-center gap-3 shrink-0 min-w-0">
                      <ActionTooltip content={lang === 'zh' ? '編輯' : 'Edit'}>
                          <button onClick={() => onEdit(patient)} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all shadow-sm">
                              <Edit size={16} />
                          </button>
                      </ActionTooltip>
                      
                      <ActionTooltip content={lang === 'zh' ? '診斷' : 'Diagnose'}>
                          <Link to={`/patients/${patient.id}`} className="block p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all shadow-sm">
                              <Stethoscope size={16} />
                          </Link>
                      </ActionTooltip>

                      <ActionTooltip content={lang === 'zh' ? '刪除' : 'Delete'}>
                          <button onClick={() => {
                              setDeleteTarget(patient);
                              setDeletePassword('');
                              setDeleteError('');
                          }} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all shadow-sm">
                              <Trash2 size={16} />
                          </button>
                      </ActionTooltip>
                  </div>
                </motion.div>
              )})}
              
              {sortedPatients.length === 0 && (
                  <div className="py-32 flex flex-col items-center justify-center text-center opacity-50">
                      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                          <Info size={40} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{lang === 'zh' ? '查無資料' : 'No Records Found'}</p>
                      <p className="text-xs text-slate-300 mt-1">Try adjusting your filters</p>
                  </div>
              )}
          </div>
      </div>

      {/* 4. Pagination Footer */}
      {sortedPatients.length > 0 && (
          <div className="h-14 bg-white dark:bg-[#0b1120] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-30 transition-colors">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {lang === 'zh' 
                    ? `顯示 ${(currentPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, sortedPatients.length)} 筆，共 ${sortedPatients.length} 筆`
                    : `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, sortedPatients.length)} of ${sortedPatients.length}`
                  }
              </div>

              <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronsLeft size={16} /></button>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /></button>
                  <div className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-black text-slate-700 dark:text-slate-300 min-w-[3rem] text-center">{currentPage} / {totalPages}</div>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={16} /></button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronsRight size={16} /></button>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setDeleteTarget(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
              <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }} 
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-md bg-white dark:bg-[#0b1120] rounded-[2.5rem] p-8 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
              >
                      <div className="flex flex-col items-center text-center gap-4 mb-6">
                          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full text-red-500">
                              <Lock size={24} />
                          </div>
                          <div>
                              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                  {lang === 'zh' ? '確認刪除病患記錄' : 'Confirm Delete Patient Record'}
                              </h3>
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                                  {lang === 'zh' 
                                    ? `即將永久刪除病患記錄「${deleteTarget.name} (${deleteTarget.id})」，此操作無法復原。請輸入您的登錄密碼以確認。` 
                                    : `You are about to permanently delete patient record "${deleteTarget.name} (${deleteTarget.id})". This action cannot be undone. Please enter your login password to confirm.`
                                  }
                              </p>
                          </div>
                      </div>

                      <form onSubmit={async (e) => {
                          e.preventDefault();
                          if (!deletePassword) {
                              setDeleteError('required');
                              return;
                          }
                          
                          setIsDeleting(true);
                          setDeleteError('');
                          
                          try {
                              // Verify admin password using login check
                              if (!currentUser || !currentUser.username) {
                                  setDeleteError('systemError');
                                  setIsDeleting(false);
                                  return;
                              }
                              const verified = await login(currentUser.username, deletePassword);
                              
                              if (!verified) {
                                  setDeleteError('invalid');
                                  setIsDeleting(false);
                                  return;
                              }

                              // Delete the patient
                              onDelete(deleteTarget.id);
                              
                              // Clear state after successful deletion
                              setDeleteTarget(null);
                              setDeletePassword('');
                              setDeleteError('');
                              setIsDeleting(false);
                          } catch (err) {
                              console.error('刪除病患時發生錯誤:', err);
                              setDeleteError('systemError');
                              setIsDeleting(false);
                          }
                      }} className="space-y-6">
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">
                                  {lang === 'zh' ? `請輸入您的登錄密碼 (用戶名: ${currentUser.username})` : `Enter Your Login Password (Username: ${currentUser.username})`}
                              </label>
                              <div className="relative">
                                  <input 
                                      type="password" 
                                      autoFocus
                                      value={deletePassword}
                                      onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(''); }}
                                      className={`w-full px-5 py-3.5 bg-white dark:bg-slate-900 border-2 rounded-2xl font-bold text-sm outline-none transition-all text-slate-800 dark:text-white ${
                                          deleteError 
                                          ? 'border-red-500 focus:border-red-500' 
                                          : 'border-blue-600 dark:border-blue-500 focus:border-blue-700 dark:focus:border-blue-600'
                                      }`}
                                      placeholder="********"
                                  />
                              </div>
                              {deleteError && (
                                  <p className="text-[10px] font-bold text-red-500 ml-2">
                                      {deleteError === 'invalid' 
                                        ? (lang === 'zh' ? '密碼錯誤' : 'Invalid Password')
                                        : deleteError === 'required'
                                        ? (lang === 'zh' ? '請輸入密碼' : 'Password Required')
                                        : (lang === 'zh' ? '系統錯誤，請稍後再試' : 'System Error, Please Try Again')
                                      }
                                  </p>
                              )}
                          </div>

                          <div className="flex gap-3">
                              <button 
                                  type="button" 
                                  onClick={() => {
                                      setDeleteTarget(null);
                                      setDeletePassword('');
                                      setDeleteError('');
                                  }} 
                                  className="flex-1 py-3.5 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                              >
                                  {lang === 'zh' ? '取消' : 'Cancel'}
                              </button>
                              <button 
                                  type="submit" 
                                  disabled={isDeleting || !deletePassword}
                                  className="flex-1 py-3.5 text-xs font-black uppercase tracking-widest text-white bg-red-600 rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : null}
                                  {lang === 'zh' ? '確認刪除' : 'Confirm Delete'}
                              </button>
                          </div>
                      </form>
                  </motion.div>
              </div>, document.body
      )}
    </motion.div>
  );
};
export default PatientList;

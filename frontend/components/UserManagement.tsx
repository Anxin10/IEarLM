
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, UserRole, Language, UserStatus } from '../types';
import { translations } from '../services/translations';
import { getUsers, addUser, updateUser, deleteUser, login } from '../services/authService';
import { 
  Trash2, UserPlus, Shield, X, Check, Edit, AlertCircle, 
  Power, Lock, Crown, Stethoscope, UserCog, Search,
  Users, UserCheck, ChevronDown, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserManagementProps {
  lang: Language;
  currentUser: User;
}

const ROOT_ADMIN_ID = '1';

// --- Shared UI Components ---
const FloatingInput = ({ 
    label, value, onChange, type = "text", error 
}: { 
    label: string, value: string, onChange: (val: string) => void, type?: string, error?: boolean 
}) => (
  <div className="relative group">
      <input 
          type={type} 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder=" " 
          className={`peer w-full h-[50px] px-4 bg-transparent border-2 rounded-xl outline-none font-bold text-sm text-slate-900 dark:text-white transition-all
              ${error ? 'border-red-500' : 'border-slate-200 dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-500'}
          `}
      />
      <div className="absolute left-3 -top-2.5 px-1 bg-white dark:bg-[#0b1120] z-10">
           <label className={`text-[10px] font-black uppercase tracking-wider transition-colors cursor-text ${error ? 'text-red-500' : 'text-slate-400 peer-focus:text-blue-600'}`}>
              {label}
           </label>
      </div>
  </div>
);

const FloatingSelect = ({
    label, value, options, isOpen, setIsOpen, onSelect, disabled
}: {
    label: string, value: string, options: {value: string, label: string}[], isOpen: boolean, setIsOpen: (v: boolean) => void, onSelect: (v: string) => void, disabled?: boolean
}) => (
    <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full h-[50px] px-4 border-2 rounded-xl outline-none font-bold text-sm text-left flex items-center justify-between transition-all bg-transparent relative
              ${isOpen
                  ? 'border-blue-600 dark:border-blue-500 text-slate-900 dark:text-white'
                  : 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-600'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
            <span className={!value ? 'text-transparent' : ''}>
                {options.find(o => o.value === value)?.label || value}
            </span>
            <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : 'text-slate-400'}`} />

            {/* Floating Label */}
            <div className="absolute left-3 -top-2.5 px-1 bg-white dark:bg-[#0b1120] z-10">
              <label className={`text-[10px] font-black uppercase tracking-wider transition-colors
                  ${isOpen
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-400'
                  }
              `}>
                  {label}
              </label>
            </div>
        </button>

        {/* Dropdown Menu */}
        <AnimatePresence>
            {isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.98 }}
                  transition={{ duration: 0.1 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1"
                >
                    {options.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => { onSelect(opt.value); setIsOpen(false); }}
                          className={`w-full px-4 py-3 text-left text-xs font-bold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors
                              ${value === opt.value
                                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                  : 'text-slate-700 dark:text-slate-300'
                              }
                          `}
                        >
                            {opt.label}
                            {value === opt.value && <Check size={14} />}
                        </button>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

// Tooltip Component
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
        <div ref={triggerRef} onMouseEnter={handleEnter} onMouseLeave={() => setIsVisible(false)} className="relative inline-flex shrink-0">
            {children}
            {isVisible && createPortal(
                <div className="fixed z-[9999] -translate-x-1/2 -translate-y-full px-2 pointer-events-none" style={{ top: coords.top, left: coords.left }}>
                    <motion.div 
                        initial={{ opacity: 0, y: 5, scale: 0.9 }} 
                        animate={{ opacity: 1, y: 0, scale: 1 }} 
                        className="bg-white dark:bg-white text-slate-800 text-[10px] font-black uppercase tracking-wider py-2 px-3 rounded-xl shadow-xl border border-slate-100 whitespace-nowrap"
                    >
                        {content}
                        <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-r border-b border-slate-100 rotate-45" />
                    </motion.div>
                </div>, document.body
            )}
        </div>
    );
};

const UserManagement: React.FC<UserManagementProps> = ({ lang, currentUser }) => {
  const t = translations[lang] as any;
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
      name: '', username: '', email: '', department: '', 
      password: '', confirmPassword: '', 
      role: UserRole.USER as UserRole, status: 'active' as UserStatus
  });
  const [errorKey, setErrorKey] = useState<string>('');
  
  // Dropdown State
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const roleRef = useRef<HTMLDivElement>(null);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  // Handle click outside for role dropdown
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (roleRef.current && !roleRef.current.contains(event.target as Node)) {
              setIsRoleOpen(false);
          }
      };
      if (isModalOpen) {
          document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModalOpen]);

  const loadUsers = async () => {
    const data = await getUsers();
    setUsers(data);
  };

  // --- Statistics ---
  const stats = useMemo(() => ({
      total: users.length,
      active: users.filter(u => u.status === 'active').length,
      admins: users.filter(u => u.role === UserRole.OWNER || u.role === UserRole.MANAGER).length
  }), [users]);

  // --- Filtering ---
  const filteredUsers = useMemo(() => {
      if (!searchQuery) return users;
      const q = searchQuery.toLowerCase();
      return users.filter(u => 
          u.name.toLowerCase().includes(q) || 
          u.username.toLowerCase().includes(q)
      );
  }, [users, searchQuery]);

  // --- Permissions ---
  const isRootAdmin = (user: User) => user.id === ROOT_ADMIN_ID;
  const canEdit = (targetUser: User) => {
    if (isRootAdmin(targetUser)) return false; 
    if (currentUser.role === UserRole.OWNER) return true;
    if (currentUser.role === UserRole.MANAGER) return targetUser.role === UserRole.USER;
    return false;
  };
  const canDelete = (targetUser: User) => {
    if (isRootAdmin(targetUser)) return false;
    if (targetUser.id === currentUser.id) return false;
    if (currentUser.role === UserRole.OWNER) return true;
    if (currentUser.role === UserRole.MANAGER) return targetUser.role === UserRole.USER;
    return false;
  };

  // --- Handlers ---
  const promptDelete = (user: User) => {
    if (!canDelete(user)) return;
    setDeleteTarget(user);
    setDeletePassword('');
    setDeleteError('');
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) {
        setDeleteError('required');
        return;
    }
    
    setIsDeleting(true);
    setDeleteError('');
    
    try {
        // Verify admin password using login check
        const verified = await login(currentUser.username, deletePassword);
        
        if (!verified) {
            setDeleteError('invalid');
            setIsDeleting(false);
            return;
        }

        if (deleteTarget) {
            await deleteUser(deleteTarget.id);
            await loadUsers();
            setDeleteTarget(null);
        }
    } catch (err) {
        setDeleteError('systemError');
    } finally {
        setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (isRootAdmin(user) || !canEdit(user) || user.id === currentUser.id) return;
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    await updateUser(user.id, { status: newStatus });
    await loadUsers();
  };

  const openModal = (user?: User) => {
    setErrorKey('');
    setIsRoleOpen(false); // Reset dropdown
    if (user) {
      if (!canEdit(user)) return;
      setEditingId(user.id);
      setFormData({
          name: user.name, username: user.username, email: user.email, 
          department: user.department || '', password: '', confirmPassword: '', 
          role: user.role, status: user.status
      });
    } else {
      setEditingId(null);
      setFormData({
          name: '', username: '', email: '', department: '', 
          password: '', confirmPassword: '', 
          role: UserRole.USER, status: 'active'
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.username || !formData.email || (!editingId && !formData.password)) { 
        setErrorKey('requiredFields'); return; 
    }
    if (formData.password && formData.password !== formData.confirmPassword) {
        setErrorKey('passwordsDoNotMatch'); return; 
    }
    
    // Safety check
    if (formData.role === UserRole.OWNER && currentUser.role !== UserRole.OWNER) {
        setErrorKey('systemError'); return;
    }

    const payload = { 
        name: formData.name, username: formData.username, email: formData.email, 
        department: formData.department, role: formData.role, status: formData.status, 
        ...(formData.password ? { password: formData.password } : {}) 
    };

    if (editingId) await updateUser(editingId, payload);
    else await addUser({ ...payload, avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=${formData.username}` });
    
    setIsModalOpen(false); 
    await loadUsers();
  };

  // --- Render Helpers ---
  const getRoleBadge = (r: UserRole) => {
      switch(r) {
          case UserRole.OWNER: 
            return <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg border border-amber-100 dark:border-amber-900/30 w-fit"><Crown size={12} /> {t.rootProtected}</span>;
          case UserRole.MANAGER: 
            return <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg border border-blue-100 dark:border-blue-900/30 w-fit"><Shield size={12} /> {lang === 'zh' ? '部門主管' : 'Manager'}</span>;
          default: 
            return <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 w-fit"><Stethoscope size={12} /> {lang === 'zh' ? '醫護人員' : 'Staff'}</span>;
      }
  };

  // Role Options
  const roleOptions = [
      ...(currentUser.role === UserRole.OWNER ? [{ value: UserRole.OWNER, label: lang === 'zh' ? '系統管理員' : 'System Admin' }] : []),
      { value: UserRole.MANAGER, label: lang === 'zh' ? '部門主管' : 'Manager' },
      { value: UserRole.USER, label: lang === 'zh' ? '醫護人員' : 'Staff' }
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#020617] transition-colors duration-500 overflow-hidden">
      
      {/* 1. Header & Stats */}
      <div className="shrink-0 bg-white dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 p-6 md:px-10 z-30 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase whitespace-nowrap">{t.userManagement}</h1>
                <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-4 shrink-0"></div>
                <p className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.staffManageSub}</p>
            </div>
            <div className="flex items-center gap-4">
                <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white h-10 px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 font-black uppercase text-[10px] tracking-widest">
                    <UserPlus size={14} /> <span className="hidden sm:inline">{t.addUser}</span>
                </button>
            </div>
          </div>
          
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
               <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex items-center gap-3">
                   <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg"><Users size={16} /></div>
                   <div><div className="text-xl font-black text-slate-900 dark:text-white leading-none">{stats.total}</div><div className="text-[10px] font-bold text-slate-400 uppercase">{t.totalUsersLabel}</div></div>
               </div>
               <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex items-center gap-3">
                   <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg"><UserCheck size={16} /></div>
                   <div><div className="text-xl font-black text-slate-900 dark:text-white leading-none">{stats.active}</div><div className="text-[10px] font-bold text-slate-400 uppercase">{t.activeUsersLabel}</div></div>
               </div>
               <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex items-center gap-3">
                   <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg"><Shield size={16} /></div>
                   <div><div className="text-xl font-black text-slate-900 dark:text-white leading-none">{stats.admins}</div><div className="text-[10px] font-bold text-slate-400 uppercase">{t.adminsLabel}</div></div>
               </div>
          </div>
      </div>

      {/* 2. Main Content (Card Grid) */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-[#020617] overflow-hidden">
          {/* Search Bar */}
          <div className="px-6 py-6 md:px-10 flex justify-end">
              <div className="relative w-full max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                      type="text" 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={lang === 'zh' ? "搜尋姓名、ID..." : "Search staff..."}
                      className="w-full pl-9 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
                  />
              </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 md:px-10 pb-20 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredUsers.map((user) => {
                    const isRoot = isRootAdmin(user);
                    const editable = canEdit(user);
                    const deletable = canDelete(user);
                    const isSuspended = user.status === 'suspended';

                    return (
                        <motion.div 
                            key={user.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`relative bg-white dark:bg-[#0b1120] rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden ${isSuspended ? 'grayscale' : ''}`}
                        >
                            {/* Suspended Overlay */}
                            {isSuspended && (
                                <div className="absolute inset-0 bg-slate-900/10 dark:bg-black/60 z-10 pointer-events-none" />
                            )}

                            <div className="relative z-0">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-800 shadow-inner bg-white dark:bg-slate-900">
                                            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight">{user.name}</h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">@{user.username}</p>
                                        </div>
                                    </div>
                                    {getRoleBadge(user.role)}
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${user.status === 'active' ? 'text-slate-400' : 'text-red-500'}`}>
                                            {user.status === 'active' ? t.statusActive : t.statusSuspended}
                                        </span>
                                    </div>

                                    <div className="flex gap-1 relative z-20">
                                        {isRoot ? (
                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest py-2 px-3">
                                                {lang === 'zh' ? '受保護' : 'Protected'}
                                            </span>
                                        ) : (
                                            <>
                                                <ActionTooltip content={user.status === 'active' ? t.suspendAccount : t.activateAccount}>
                                                    <button 
                                                        onClick={() => handleToggleStatus(user)}
                                                        disabled={!editable}
                                                        className={`p-2 rounded-xl transition-colors ${
                                                            isSuspended 
                                                            ? 'bg-red-600 text-white shadow-lg shadow-red-500/30 hover:bg-red-700' 
                                                            : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                                        }`}
                                                    >
                                                        <Power size={16} />
                                                    </button>
                                                </ActionTooltip>
                                                
                                                {editable && (
                                                    <ActionTooltip content={t.editLabel}>
                                                        <button 
                                                            onClick={() => openModal(user)} 
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                    </ActionTooltip>
                                                )}
                                                
                                                {deletable && (
                                                    <ActionTooltip content={t.removeAccount}>
                                                        <button 
                                                            onClick={() => promptDelete(user)} 
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </ActionTooltip>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
          </div>
      </div>

      {/* --- Add/Edit Modal --- */}
      {isModalOpen && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="relative w-full max-w-lg bg-white dark:bg-[#0b1120] rounded-[2.5rem] p-8 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                      {editingId ? <UserCog className="text-blue-600" /> : <UserPlus className="text-blue-600" />} 
                      <span className="dark:text-white">
                        {editingId ? (lang === 'zh' ? '編輯人員' : 'Edit Staff') : (lang === 'zh' ? '新增人員' : 'Add Staff')}
                      </span>
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400"><X size={20} /></button>
              </div>
              
              <form onSubmit={handleSaveUser} className="space-y-5">
                <FloatingInput label={t.fullName} value={formData.name} onChange={v => setFormData({...formData, name: v})} />
                
                <div className="grid grid-cols-2 gap-4">
                    <FloatingInput label={t.idPlaceholder} value={formData.username} onChange={v => setFormData({...formData, username: v})} />
                    
                    {/* Custom Floating Role Select */}
                    <div className="relative group" ref={roleRef}>
                         <FloatingSelect 
                             label={t.roleLabel}
                             value={formData.role}
                             options={roleOptions}
                             isOpen={isRoleOpen}
                             setIsOpen={setIsRoleOpen}
                             onSelect={(v) => setFormData({...formData, role: v as UserRole})}
                             disabled={currentUser.role !== UserRole.OWNER}
                         />
                    </div>
                </div>

                <FloatingInput label={t.email} value={formData.email} onChange={v => setFormData({...formData, email: v})} type="email" />
                {/* Department Input Removed as requested */}

                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Lock size={10} /> {lang === 'zh' ? '安全設定' : 'Security'}</div>
                    <div className="grid grid-cols-2 gap-4">
                        <FloatingInput label={t.securityKey} value={formData.password} onChange={v => setFormData({...formData, password: v})} type="password" />
                        <FloatingInput label={t.confirmKey} value={formData.confirmPassword} onChange={v => setFormData({...formData, confirmPassword: v})} type="password" />
                    </div>
                </div>

                {errorKey && <div className="text-red-500 text-xs font-bold text-center flex items-center justify-center gap-2"><AlertCircle size={14} /> {t[errorKey] || errorKey}</div>}

                <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">{t.cancel}</button>
                    <button type="submit" className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20">{t.saveChanges}</button>
                </div>
              </form>
            </motion.div>
          </div>, document.body
      )}

      {/* --- Delete Confirmation Modal (Redesigned) --- */}
      {deleteTarget && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setDeleteTarget(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl border border-slate-100">
                  <div className="flex flex-col items-center text-center gap-4 mb-6">
                      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                          <Lock size={24} />
                      </div>
                      <div>
                          <h3 className="text-xl font-black text-slate-900">
                              {t.userDelTitle}
                          </h3>
                          <p className="text-xs font-bold text-slate-500 mt-2 leading-relaxed">
                              {t.userDelMsg}
                          </p>
                      </div>
                  </div>

                  <form onSubmit={handleConfirmDelete} className="space-y-6">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                              {t.kbPasswordLabel}
                          </label>
                          <div className="relative">
                              <input 
                                  type="password" 
                                  autoFocus
                                  value={deletePassword}
                                  onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(''); }}
                                  className={`w-full px-5 py-3.5 bg-white border-2 rounded-2xl font-bold text-sm outline-none transition-all text-slate-800 ${
                                      deleteError 
                                      ? 'border-red-500 focus:border-red-500' 
                                      : 'border-blue-600 focus:border-blue-700'
                                  }`}
                                  placeholder="********"
                              />
                          </div>
                          {deleteError && (
                              <p className="text-[10px] font-bold text-red-500 ml-2">
                                  {deleteError === 'invalid' 
                                    ? t.kbWrongPwd 
                                    : (lang === 'zh' ? '請輸入密碼' : 'Password Required')
                                  }
                              </p>
                          )}
                      </div>

                      <div className="flex gap-3">
                          <button 
                              type="button" 
                              onClick={() => setDeleteTarget(null)} 
                              className="flex-1 py-3.5 text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                          >
                              {t.cancel}
                          </button>
                          <button 
                              type="submit" 
                              disabled={isDeleting || !deletePassword}
                              className="flex-1 py-3.5 text-xs font-black uppercase tracking-widest text-white bg-red-600 rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : null}
                              {t.kbConfirm}
                          </button>
                      </div>
                  </form>
              </motion.div>
          </div>, document.body
      )}
    </div>
  );
};
export default UserManagement;

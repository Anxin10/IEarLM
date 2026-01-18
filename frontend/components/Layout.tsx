
import React, { useState, useRef, useEffect } from 'react';
import { User, UserRole, Language } from '../types';
import { translations } from '../services/translations';
import {
  LayoutDashboard,
  Users,
  Menu,
  LogOut,
  Stethoscope,
  UserCheck,
  Languages,
  Moon,
  Sun,
  X,
  Camera,
  Check,
  Settings,
  Database,
  ChevronRight,
  HelpCircle,
  MessageSquare,
  Zap,
  Server,
  Cpu,
  Info,
  Mail,
  ShieldCheck,
  Glasses
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  onUpdateUser: (updatedUser: User) => void;
  lang: Language;
  setLang: (l: Language) => void;
  isDarkMode: boolean;
  setIsDarkMode: (d: boolean) => void;
}

// System Status Type
interface SystemServiceStatus {
  id: string;
  nameKey: string;
  status: 'connected' | 'disconnected' | 'unstable';
  ping: string;
  icon: any;
}

const Layout: React.FC<LayoutProps> = ({
  children, user, onLogout, onUpdateUser,
  lang, setLang, isDarkMode, setIsDarkMode
}) => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const [editName, setEditName] = useState(user.name);

  const [systemStatuses, setSystemStatuses] = useState<SystemServiceStatus[]>([
    { id: 'ai', nameKey: 'serviceAI', status: 'connected', ping: '150ms', icon: Cpu },
    { id: 'db', nameKey: 'serviceDatabase', status: 'connected', ping: '12ms', icon: Server },
  ]);

  const location = useLocation();
  const navigate = useNavigate();
  const t = translations[lang] as any;

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // 檢查服務狀態
  const checkServiceStatus = async (serviceId: string): Promise<{ status: 'connected' | 'disconnected' | 'unstable', ping: string }> => {
    try {
      const startTime = performance.now();
      let url = '';

      if (serviceId === 'db') {
        // 檢查雲端數據庫（RAG API）
        url = '/api/rag/files';
      } else if (serviceId === 'ai') {
        // 檢查推論引擎（YOLOv7-seg）
        // Proxy rewrites /api/detection/health -> /api/health
        url = '/api/detection/health';
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000)
      });

      const endTime = performance.now();
      const ping = Math.round(endTime - startTime);

      if (response.ok || response.status === 405) { // 405 Method Not Allowed 也算連線成功
        return { status: 'connected', ping: `${ping}ms` };
      } else {
        return { status: 'disconnected', ping: '-' };
      }
    } catch (error) {
      return { status: 'disconnected', ping: '-' };
    }
  };

  // 計算整體系統狀態
  const getOverallStatus = (statuses: SystemServiceStatus[]): 'online' | 'warning' | 'error' => {
    const disconnectedCount = statuses.filter(s => s.status === 'disconnected').length;
    if (disconnectedCount === 0) return 'online';
    if (disconnectedCount === 1) return 'warning';
    return 'error';
  };

  useEffect(() => {
    let reconnectInterval: NodeJS.Timeout | null = null;
    let normalInterval: NodeJS.Timeout | null = null;

    const checkAllServices = async () => {
      if (!navigator.onLine) {
        setSystemStatuses(prev => prev.map(s => ({ ...s, status: 'disconnected', ping: '-' })));
        return;
      }

      const [dbStatus, aiStatus] = await Promise.all([
        checkServiceStatus('db'),
        checkServiceStatus('ai')
      ]);

      const newStatuses = [
        { id: 'ai', nameKey: 'serviceAI', status: aiStatus.status, ping: aiStatus.ping, icon: Cpu },
        { id: 'db', nameKey: 'serviceDatabase', status: dbStatus.status, ping: dbStatus.ping, icon: Server },
      ];

      setSystemStatuses(newStatuses);

      // 檢查是否有斷線的服務
      const overallStatus = getOverallStatus(newStatuses);
      const hasDisconnected = newStatuses.some(s => s.status === 'disconnected');

      // 如果有斷線，清除正常間隔，啟動快速重連檢查（每秒）
      if (hasDisconnected && overallStatus !== 'online') {
        if (normalInterval) {
          clearInterval(normalInterval);
          normalInterval = null;
        }
        if (!reconnectInterval) {
          reconnectInterval = setInterval(checkAllServices, 1000);
        }
      } else {
        // 如果全部連線，清除快速重連，啟動正常檢查（每30秒）
        if (reconnectInterval) {
          clearInterval(reconnectInterval);
          reconnectInterval = null;
        }
        if (!normalInterval) {
          normalInterval = setInterval(checkAllServices, 30000);
        }
      }
    };

    const handleOnline = () => {
      checkAllServices();
    };

    const handleOffline = () => {
      setSystemStatuses(prev => prev.map(s => ({ ...s, status: 'disconnected', ping: '-' })));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 初始檢查
    checkAllServices();

    // 啟動正常檢查間隔（如果沒有斷線，會繼續使用）
    normalInterval = setInterval(checkAllServices, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectInterval) clearInterval(reconnectInterval);
      if (normalInterval) clearInterval(normalInterval);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isActive = (path: string) => {
    if (path === '/patients' && location.pathname.startsWith('/patients')) return true;
    return location.pathname === path;
  };

  const handleSaveSettings = () => {
    onUpdateUser({ ...user, name: editName });
    setIsSettingsOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'disconnected': return 'bg-red-500';
      case 'unstable': return 'bg-amber-500';
      default: return 'bg-slate-400';
    }
  };

  const BrandLogo = ({ className = "text-3xl" }: { className?: string }) => (
    <div className={`${className} font-[900] tracking-tighter whitespace-nowrap flex items-center justify-center logo-container`}>
      <div className="relative flex items-center">
        <Glasses className="w-[1.2em] h-[1.2em] mr-[0.15em] glasses-icon" style={{ strokeWidth: 2.5 }} />
        <span className="gemini-gradient-text logo-main">iEar</span>
      </div>
      <span className="brand-sup">LM</span>
    </div>
  );

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all mb-2 relative group ${isActive(to)
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 font-bold'
          : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
        } ${!isSidebarOpen ? 'justify-center' : ''}`}
    >
      <Icon size={24} className="shrink-0" />
      {isSidebarOpen && (
        <span className="text-sm tracking-wide font-semibold whitespace-nowrap overflow-hidden">
          {label}
        </span>
      )}
      {!isSidebarOpen && (
        <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">
          {label}
        </div>
      )}
    </Link>
  );

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-all duration-500 ${isDarkMode ? 'bg-[#020617] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <aside
        className={`flex-shrink-0 border-r transition-all duration-500 flex flex-col z-40 bg-white border-slate-300 dark:bg-[#0b1120] dark:border-slate-800 ${isSidebarOpen ? 'w-72' : 'w-24'
          }`}
      >
        <div className={`h-24 flex items-center border-b border-transparent transition-all ${isSidebarOpen ? 'px-6' : 'justify-center'}`}>
          <div className={`flex items-center gap-3 w-full ${!isSidebarOpen ? 'justify-center' : ''}`}>
            <div className={`flex flex-col leading-none pt-2 ${!isSidebarOpen ? 'items-center' : ''}`}>
              <BrandLogo className={isSidebarOpen ? "text-3xl" : "text-xl"} />
              {isSidebarOpen && (
                <span className="gemini-gradient-text text-[10px] font-black uppercase tracking-[0.25em] mt-0.5 whitespace-nowrap opacity-90 pl-1">
                  Medical AI
                </span>
              )}
            </div>
          </div>
        </div>

        <nav className="flex-1 py-8 px-4 overflow-y-auto overflow-x-hidden">
          {isSidebarOpen ? (
            <div className="mb-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{t.clinicalWorkspace}</div>
          ) : (
            <div className="mb-4 flex justify-center"><div className="w-8 h-1 bg-slate-200 dark:bg-slate-800 rounded-full"></div></div>
          )}

          <NavItem to="/dashboard" icon={LayoutDashboard} label={t.dashboard} />
          <NavItem to="/patients" icon={Users} label={t.patients} />
          <NavItem to="/diagnosis" icon={Stethoscope} label={t.aiDiagnosis} />

          {user.role === UserRole.OWNER && (
            <>
              {isSidebarOpen ? (
                <div className="mt-8 mb-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{t.systemEngine}</div>
              ) : (
                <div className="mt-8 mb-4 flex justify-center"><div className="w-8 h-1 bg-slate-200 dark:bg-slate-800 rounded-full"></div></div>
              )}
              <NavItem to="/users" icon={UserCheck} label={t.userManagement} />
              <NavItem to="/rag-config" icon={Database} label={t.ragConfig} />
            </>
          )}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 flex items-center justify-between px-6 md:px-10 shrink-0 border-b bg-white border-slate-300 dark:bg-[#020617] dark:border-slate-800 transition-colors duration-500 z-50">
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="p-2.5 rounded-xl transition-colors hover:bg-slate-100 text-slate-400 dark:hover:bg-slate-800"
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Zap size={20} className={navigator.onLine ? "text-blue-500 fill-blue-500/20" : "text-red-500"} />
                <span className={`absolute top-2 right-2 w-2.5 h-2.5 border-2 border-white dark:border-[#020617] rounded-full ${navigator.onLine ? 'bg-green-500' : 'bg-red-500'}`}>
                  {navigator.onLine && (
                    <span className="absolute inset-0 rounded-full bg-green-500 animate-pulse"></span>
                  )}
                </span>
              </button>

              <AnimatePresence>
                {isNotifOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[100] overflow-hidden ring-1 ring-black/5"
                  >
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 backdrop-blur-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t.notificationsLabel}</span>
                        {(() => {
                          const overallStatus = getOverallStatus(systemStatuses);
                          const statusConfig = {
                            online: {
                              bg: 'bg-white dark:bg-slate-800',
                              border: 'border-slate-200 dark:border-slate-700',
                              dot: 'bg-green-500 animate-pulse',
                              text: 'text-green-600 dark:text-green-400',
                              label: 'ONLINE'
                            },
                            warning: {
                              bg: 'bg-amber-50 dark:bg-amber-900/20',
                              border: 'border-amber-200 dark:border-amber-800',
                              dot: 'bg-amber-500 animate-pulse',
                              text: 'text-amber-600 dark:text-amber-400',
                              label: 'WARNING'
                            },
                            error: {
                              bg: 'bg-red-50 dark:bg-red-900/20',
                              border: 'border-red-200 dark:border-red-800',
                              dot: 'bg-red-500 animate-pulse',
                              text: 'text-red-600 dark:text-red-400',
                              label: 'ERROR'
                            }
                          };
                          const config = statusConfig[overallStatus];
                          return (
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border shadow-sm ${config.bg} ${config.border}`}>
                              <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                              <span className={`text-[10px] font-bold ${config.text}`}>
                                {config.label}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="p-2 space-y-1 bg-white dark:bg-[#0b1120]">
                      {systemStatuses.map((sys, index) => (
                        <motion.div
                          key={sys.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400`}>
                              <sys.icon size={18} />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{t[sys.nameKey]}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <div className={`relative w-2 h-2 rounded-full ${getStatusColor(sys.status)}`}>
                                  {sys.status === 'connected' && (
                                    <div className={`absolute inset-0 rounded-full ${getStatusColor(sys.status)} animate-ping opacity-75`}></div>
                                  )}
                                </div>
                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                  {sys.status === 'connected' ? t.statusConnected : t.statusDisconnected}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border ${sys.status === 'connected'
                              ? 'text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700/50'
                              : 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'
                            }`}>
                            {sys.ping}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative" ref={userMenuRef}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="relative group shrink-0 ml-2 outline-none"
              >
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-sm hover:ring-2 hover:ring-slate-200 dark:hover:ring-slate-700 transition-all border border-slate-200 dark:border-slate-700">
                  <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                </div>
              </motion.button>

              <AnimatePresence>
                {isUserMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10, x: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 top-full mt-3 w-80 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-[100] overflow-hidden ring-1 ring-black/5"
                  >
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100">
                          <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 dark:text-white truncate">{user.name}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setIsSettingsOpen(true); setIsUserMenuOpen(false); }}
                        className="mt-4 w-full py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        {t.personalSettings}
                      </button>
                    </div>

                    <div className="p-2">
                      <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                      >
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                          <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 group-hover:bg-white dark:group-hover:bg-slate-600 transition-colors">
                            {isDarkMode ? <Moon size={16} /> : <Sun size={16} />}
                          </div>
                          <span className="text-sm font-bold">{lang === 'zh' ? '外觀' : 'Appearance'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-400">{isDarkMode ? t.darkMode : t.lightMode}</span>
                          <ChevronRight size={14} className="text-slate-400" />
                        </div>
                      </button>
                      <button
                        onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                      >
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                          <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 group-hover:bg-white dark:group-hover:bg-slate-600 transition-colors">
                            <Languages size={16} />
                          </div>
                          <span className="text-sm font-bold">{lang === 'zh' ? '語言' : 'Language'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-400">{lang === 'en' ? 'English' : '繁體中文'}</span>
                          <ChevronRight size={14} className="text-slate-400" />
                        </div>
                      </button>
                      <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                      <button
                        onClick={() => { setIsHelpOpen(true); setIsUserMenuOpen(false); }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-slate-600 dark:text-slate-300"
                      >
                        <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 group-hover:bg-white dark:group-hover:bg-slate-600 transition-colors">
                          <HelpCircle size={16} />
                        </div>
                        <span className="text-sm font-bold">{lang === 'zh' ? '說明與支援' : 'Help & Support'}</span>
                      </button>
                      <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                      <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 group-hover:bg-white dark:group-hover:bg-slate-900 transition-colors">
                          <LogOut size={16} />
                        </div>
                        <span className="text-sm font-bold">{t.signOut}</span>
                      </button>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 text-center border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400">
                        iEarLM v1.0.1 • Medical AI
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-hidden relative bg-transparent">
          {children}
        </main>
      </div>
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-[#0b1120] rounded-[3rem] p-10 shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black tracking-tight dark:text-white flex items-center gap-3"><Settings size={24} className="text-blue-600" /> {t.personalSettings}</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400"><X size={24} /></button>
              </div>
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-4 mb-4">
                  <div className="relative group">
                    <img src={user.avatar} alt="Avatar" className="w-24 h-24 rounded-3xl border-4 border-white dark:border-slate-800 shadow-xl object-cover" />
                    <button className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><Camera size={20} /></button>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.editAvatar}</span>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{t.fullName}</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold dark:text-white" />
                </div>
                <button onClick={handleSaveSettings} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 transition-all"><Check size={18} /> {t.saveChanges}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHelpOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-[#0b1120] rounded-[3rem] p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-32 bg-slate-50 dark:bg-slate-900/50 -z-10 rounded-t-[3rem]" />
              <div className="flex justify-end mb-4">
                <button onClick={() => setIsHelpOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"><X size={20} /></button>
              </div>
              <div className="flex flex-col items-center">
                <div className="mb-4">
                  <BrandLogo className="text-4xl" />
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest mb-6">
                  v1.0.1 Stable Build
                </div>
                <div className="w-full space-y-4 mb-8">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center gap-3 text-left">
                    <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl text-slate-400 shadow-sm"><Info size={18} /></div>
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">About</div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">iEarLM</div>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center gap-3 text-left">
                    <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl text-slate-400 shadow-sm"><Mail size={18} /></div>
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Support</div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">support@iearlm.sys</div>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center gap-3 text-left">
                    <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl text-green-500 shadow-sm"><ShieldCheck size={18} /></div>
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">License</div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Enterprise Edition</div>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  © 2026 iEarLM. All rights reserved.<br />
                  Powered by LLM + YOLOv7-seg
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Layout;

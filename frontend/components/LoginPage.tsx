
import React, { useState, useEffect } from 'react';
import { login, register } from '../services/authService';
import { User, Language } from '../types';
import { translations } from '../services/translations';
import { 
  Loader2, Moon, Sun, Languages, 
  Cpu, ShieldCheck, ChevronRight, Glasses
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoginPageProps {
  onLogin: (user: User) => void;
  lang: Language;
  setLang: (l: Language) => void;
  isDarkMode: boolean;
  setIsDarkMode: (d: boolean) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ 
  onLogin, lang, setLang, isDarkMode, setIsDarkMode 
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorKey, setErrorKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [showIntro, setShowIntro] = useState(true);
  const [showCard, setShowCard] = useState(false);

  const t = translations[lang] as any;

  const slogans = lang === 'zh' ? [
    "建立標準化診斷流程",
    "智慧化影像識別技術",
    "自動化臨床報告生成",
    "精準化耳道病灶分析",
    "跨平台醫療管理系統"
  ] : [
    "Standardized Diagnostic Flow",
    "Smart Image Recognition",
    "Automated Clinical Reports",
    "Precision Ear Canal Analysis",
    "Multi-Platform Management"
  ];

  const [sloganIndex, setSloganIndex] = useState(0);

  useEffect(() => {
    const introTimer = setTimeout(() => setShowIntro(false), 5500);
    const cardTimer = setTimeout(() => setShowCard(true), 5300);
    
    const sloganTimer = setInterval(() => {
      setSloganIndex((prev) => (prev + 1) % slogans.length);
    }, 3500);

    return () => { 
      clearTimeout(introTimer); 
      clearTimeout(cardTimer); 
      clearInterval(sloganTimer);
    };
  }, [slogans.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorKey('');
    
    // Manual Validation
    if (isSignUp) {
        if (!username || !password || !fullName || !confirmPassword) {
            setErrorKey('requiredFields');
            return;
        }
        if (password !== confirmPassword) { 
          setErrorKey('passwordsDoNotMatch'); 
          return; 
        }
    } else {
        if (!username || !password) {
            setErrorKey('requiredFields');
            return;
        }
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        const newUser = await register(username, password, fullName);
        if (newUser) {
          window.location.hash = '/dashboard';
          onLogin(newUser);
        }
        else setErrorKey('usernameTaken');
      } else {
        const user = await login(username, password);
        if (user) {
          window.location.hash = '/dashboard';
          onLogin(user);
        }
        else setErrorKey('authFailed');
      }
    } catch (err) { 
      setErrorKey('systemError'); 
    } finally { 
      setIsLoading(false); 
    }
  };

  // Switch mode and CLEAR all form data
  const toggleMode = () => {
      setErrorKey('');
      setIsSignUp(!isSignUp);
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setFullName('');
  };

  const getErrorMessage = () => {
    if (!errorKey) return '';
    return t[errorKey] || errorKey;
  };

  const UnifiedLogo = ({ size = "text-3xl" }: { size?: string }) => (
    <div className={`select-none ${size} flex items-center justify-center tracking-tighter logo-container`}>
        <div className="relative flex items-center">
            <Glasses className="w-[1.2em] h-[1.2em] mr-[0.15em] glasses-icon" style={{ strokeWidth: 2.5 }} />
            <span className="gemini-gradient-text logo-main">iEar</span>
        </div>
        <span className="brand-sup">LM</span>
    </div>
  );

  return (
    <div className={`min-h-screen relative flex items-center justify-center overflow-hidden font-sans transition-colors duration-700 ${isDarkMode ? 'bg-[#020617]' : 'bg-slate-50'}`}>
      
      {/* Top Right Controls */}
      <AnimatePresence>
        {showCard && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0 }}
            className="absolute top-6 right-6 z-[60] flex items-center p-1.5 rounded-full bg-white/80 dark:bg-[#0b1120]/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 shadow-2xl gap-1"
          >
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
              title={isDarkMode ? t.lightMode : t.darkMode}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>

            <button 
              onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} 
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group min-w-[110px]"
            >
              <Languages size={16} className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                {lang === 'en' ? 'English' : '繁體中文'}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Intro Animation */}
      <AnimatePresence>
        {showIntro && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ 
              opacity: [0, 1, 1, 0], 
              scale: [0.9, 1, 1, 1.1],
              filter: ['blur(10px)', 'blur(0px)', 'blur(0px)', 'blur(20px)']
            }}
            transition={{ duration: 5.5, times: [0, 0.2, 0.8, 1], ease: "easeInOut" }}
            className="absolute z-[100] flex flex-col items-center justify-center text-center max-w-4xl px-4"
          >
            <UnifiedLogo size="text-[8rem]" />
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 1 }}
              className={`text-lg font-bold tracking-[0.6em] uppercase mt-8 ${isDarkMode ? 'text-white/40' : 'text-slate-900/40'}`}
            >
              Diagnostic Intelligence
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Card */}
      <AnimatePresence>
        {showCard && (
          <motion.div 
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-[900px] px-4"
          >
            <div className={`grid grid-cols-1 lg:grid-cols-12 rounded-[3.5rem] shadow-2xl border overflow-hidden transition-all duration-500 ${
              isDarkMode ? 'bg-[#0b1120]/80 backdrop-blur-2xl border-white/5' : 'bg-white border-slate-100'
            }`}>
              
              {/* Left Panel */}
              <div className={`hidden lg:flex lg:col-span-5 p-12 flex-col justify-between relative border-r overflow-hidden bg-blue-600 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent animate-pulse" />
                </div>
                
                <motion.div 
                  animate={{ y: ['0%', '100%', '0%'] }} 
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-[2px] bg-white/20 z-20 blur-sm pointer-events-none" 
                />
                
                <div className="relative z-10 pt-12">
                   <UnifiedLogo size="text-6xl" />
                   <div className="mt-16 h-32">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={sloganIndex}
                          initial={{ opacity: 0, x: -30, filter: 'blur(10px)' }}
                          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                          exit={{ opacity: 0, x: 30, filter: 'blur(10px)' }}
                          transition={{ duration: 0.8, ease: "anticipate" }}
                        >
                          <h2 className="text-3xl font-[900] leading-tight tracking-tight text-white mb-4">
                            {slogans[sloganIndex]}
                          </h2>
                          <div className={`flex items-center gap-2 text-sm font-bold text-white/70`}>
                             <ChevronRight size={16} /> {lang === 'zh' ? '智慧輔助診斷' : 'Smart AI Diagnosis'}
                          </div>
                        </motion.div>
                      </AnimatePresence>
                   </div>
                </div>

                <div className="relative z-10 space-y-6">
                   <div className="flex gap-1.5 items-end h-12">
                      {[...Array(5)].map((_, i) => {
                        const heights = [
                           [12, 24, 12],
                           [12, 40, 12],
                           [12, 56, 12],
                           [12, 40, 12],
                           [12, 24, 12]
                        ][i];
                        
                        return (
                          <motion.div 
                            key={i}
                            animate={{ height: heights }}
                            transition={{ 
                                duration: 1.2, 
                                repeat: Infinity, 
                                ease: "easeInOut",
                                delay: i * 0.1
                            }}
                            className="w-1.5 bg-white/40 rounded-full"
                          />
                        );
                      })}
                   </div>
                   <div className={`inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/50`}>
                      <Cpu size={12} className="text-white/80" /> {t.neuralProcessing}
                   </div>
                </div>
              </div>

              {/* Right Panel: Login Form */}
              <div className="lg:col-span-7 p-10 md:p-14 relative flex flex-col justify-center">
                <div className="mb-10">
                  <h1 className={`text-4xl font-[900] tracking-tighter mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {isSignUp ? t.createAccount : t.accessDatabase}
                  </h1>
                  <p className={`text-[11px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t.loginSub}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <AnimatePresence mode="wait">
                    {isSignUp && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-1.5 overflow-hidden p-1" 
                      >
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{t.fullName}</label>
                        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} 
                          className={`w-full px-7 py-4 rounded-[1.8rem] border transition-all font-bold focus:ring-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-700 text-white focus:ring-blue-600/10' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-600/5'}`} placeholder={t.fullNamePlaceholder} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {/* Persistent Identity Field */}
                  <div className="space-y-1.5 p-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{t.identityCode}</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} 
                      className={`w-full px-7 py-4 rounded-[1.8rem] border transition-all font-bold focus:ring-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-700 text-white focus:ring-blue-600/10' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-600/5'}`} 
                      placeholder={t.idPlaceholder} 
                    />
                  </div>

                  {/* Persistent Password Field */}
                  <div className="space-y-1.5 p-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{t.securityKey}</label>
                    <input 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      className={`w-full px-7 py-4 rounded-[1.8rem] border transition-all font-bold focus:ring-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-700 text-white focus:ring-blue-600/10' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-600/5'}`} 
                      placeholder={t.passwordPlaceholder} 
                    />
                  </div>

                  {/* Confirm Password - Only in Sign Up */}
                  <AnimatePresence mode="wait">
                    {isSignUp && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-1.5 overflow-hidden p-1"
                      >
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{t.confirmKey}</label>
                        <input 
                          type="password" 
                          value={confirmPassword} 
                          onChange={(e) => setConfirmPassword(e.target.value)} 
                          className={`w-full px-7 py-4 rounded-[1.8rem] border transition-all font-bold focus:ring-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-700 text-white focus:ring-blue-600/10' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-600/5'}`} 
                          placeholder={t.confirmKeyPlaceholder} 
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {errorKey && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 dark:text-red-400 text-[10px] font-black uppercase text-center">{getErrorMessage()}</motion.div>
                  )}

                  <button type="submit" disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[2rem] transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-500/30 uppercase tracking-[0.3em] text-[11px] active:scale-95">
                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : (isSignUp ? t.signUp : t.signIn)}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <button onClick={toggleMode} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-blue-600'}`}>
                    {isSignUp ? t.alreadyHaveAccount : t.dontHaveAccount}
                  </button>
                  <div className="flex items-center gap-2">
                     <ShieldCheck size={14} className="text-green-500" />
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.secureAccess}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoginPage;

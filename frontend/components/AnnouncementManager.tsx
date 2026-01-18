
import React, { useState } from 'react';
import { Language } from '../types';
import { translations } from '../services/translations';
import { Megaphone, Send, Trash2, Clock, Users, ShieldAlert, Info, AlertTriangle, Eye, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnnouncementManagerProps {
  lang: Language;
}

type Priority = 'normal' | 'high' | 'maintenance';
type Audience = 'all' | 'doctors' | 'admins';

interface Announcement {
    id: string;
    title: string;
    content: string;
    priority: Priority;
    audience: Audience;
    date: string;
    views: number;
}

const AnnouncementManager: React.FC<AnnouncementManagerProps> = ({ lang }) => {
  const t = (translations[lang] as any);
  
  // Mock Data
  const [announcements, setAnnouncements] = useState<Announcement[]>([
      { id: '1', title: 'System Maintenance Scheduled', content: 'The server will be down for maintenance on Sunday at 02:00 AM UTC.', priority: 'maintenance', audience: 'all', date: '2023-11-15', views: 45 },
      { id: '2', title: 'New AI Model Deployed', content: 'iEarLM v2.3 is now live with improved accuracy for otitis media detection.', priority: 'normal', audience: 'doctors', date: '2023-11-10', views: 120 },
      { id: '3', title: 'Urgent Security Patch', content: 'Mandatory security update applied. Please re-login if you experience issues.', priority: 'high', audience: 'all', date: '2023-11-05', views: 200 },
  ]);

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [audience, setAudience] = useState<Audience>('all');
  const [isPosting, setIsPosting] = useState(false);
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');

  const handlePost = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTitle || !newContent) return;

      setIsPosting(true);
      // Simulate API call
      setTimeout(() => {
          const newAnnouncement: Announcement = {
              id: Date.now().toString(),
              title: newTitle,
              content: newContent,
              priority,
              audience,
              date: new Date().toISOString().split('T')[0],
              views: 0
          };
          setAnnouncements([newAnnouncement, ...announcements]);
          setNewTitle('');
          setNewContent('');
          setPriority('normal');
          setAudience('all');
          setIsPosting(false);
      }, 800);
  };

  const handleDelete = (id: string) => {
      if (confirm('Delete this announcement?')) {
          setAnnouncements(prev => prev.filter(a => a.id !== id));
      }
  };

  const filteredAnnouncements = filterPriority === 'all' 
      ? announcements 
      : announcements.filter(a => a.priority === filterPriority);

  const getPriorityIcon = (p: Priority) => {
      switch(p) {
          case 'high': return <AlertTriangle size={14} className="text-red-500" />;
          case 'maintenance': return <ShieldAlert size={14} className="text-amber-500" />;
          default: return <Info size={14} className="text-blue-500" />;
      }
  };

  const getPriorityLabel = (p: Priority) => {
      switch(p) {
          case 'high': return t.priorityHigh;
          case 'maintenance': return t.priorityMaintenance;
          default: return t.priorityNormal;
      }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-[1600px] mx-auto pb-10">
        
        {/* Header */}
        <div className="flex-shrink-0">
            <h1 className="text-3xl font-[900] text-slate-900 dark:text-white tracking-tighter uppercase flex items-center gap-3">
                <Megaphone className="text-blue-600" />
                {t.systemAnnouncements}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium ml-1">
                {lang === 'zh' ? '管理系統公告與全站通知推送。' : 'Manage system-wide announcements and notifications.'}
            </p>
        </div>

        <div className="flex flex-col xl:flex-row gap-8">
            
            {/* Left: Create Form (Consistent layout with BugReport) */}
            <div className="xl:w-1/3">
                <div className="bg-white dark:bg-[#0b1120] rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-xl sticky top-6">
                    <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Send size={20} className="text-blue-600" /> {t.createAnnouncement}
                    </h2>
                    
                    <form onSubmit={handlePost} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t.announcementTitle}</label>
                            <input 
                                type="text" 
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white transition-all"
                                placeholder={lang === 'zh' ? '輸入公告標題...' : 'Enter title...'}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t.announcementContent}</label>
                            <textarea 
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                rows={5}
                                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-medium text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white transition-all resize-none"
                                placeholder={lang === 'zh' ? '輸入公告內容...' : 'Enter content...'}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t.priority}</label>
                                <select 
                                    value={priority} 
                                    onChange={(e) => setPriority(e.target.value as Priority)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs outline-none text-slate-700 dark:text-slate-300"
                                >
                                    <option value="normal">{t.priorityNormal}</option>
                                    <option value="high">{t.priorityHigh}</option>
                                    <option value="maintenance">{t.priorityMaintenance}</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t.audience}</label>
                                <select 
                                    value={audience} 
                                    onChange={(e) => setAudience(e.target.value as Audience)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs outline-none text-slate-700 dark:text-slate-300"
                                >
                                    <option value="all">{t.audienceAll}</option>
                                    <option value="doctors">{t.audienceDoctors}</option>
                                    <option value="admins">{t.audienceAdmins}</option>
                                </select>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isPosting || !newTitle || !newContent}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                        >
                            {isPosting ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span> : <Send size={16} />}
                            {t.postAnnouncement}
                        </button>
                    </form>
                </div>
            </div>

            {/* Right: History List */}
            <div className="xl:w-2/3 space-y-4">
                 <div className="flex items-center justify-between px-2">
                     <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         <Clock size={14} /> {t.announcementHistory}
                     </h3>
                     
                     {/* Filter */}
                     <div className="flex items-center gap-2">
                         <div className="flex items-center gap-2 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
                             <Filter size={12} className="text-slate-400" />
                             <select 
                                value={filterPriority}
                                onChange={(e) => setFilterPriority(e.target.value as Priority | 'all')}
                                className="bg-transparent text-[10px] font-bold text-slate-600 dark:text-slate-300 outline-none uppercase tracking-wide cursor-pointer"
                             >
                                 <option value="all">{t.allPriorities}</option>
                                 <option value="normal">{t.priorityNormal}</option>
                                 <option value="high">{t.priorityHigh}</option>
                                 <option value="maintenance">{t.priorityMaintenance}</option>
                             </select>
                         </div>
                         <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                             {filteredAnnouncements.length}
                         </span>
                     </div>
                 </div>

                 <div className="grid gap-4">
                     <AnimatePresence>
                         {filteredAnnouncements.length > 0 ? filteredAnnouncements.map((item) => (
                             <motion.div 
                                key={item.id}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-white dark:bg-[#0b1120] p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
                             >
                                 <div className="flex justify-between items-start mb-4">
                                     <div className="flex flex-col gap-1">
                                         <div className="flex items-center gap-3 mb-1">
                                             <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                                 item.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30' :
                                                 item.priority === 'maintenance' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30' :
                                                 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30'
                                             }`}>
                                                 {getPriorityIcon(item.priority)}
                                                 {getPriorityLabel(item.priority)}
                                             </span>
                                             <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                 <Users size={12} /> {item.audience === 'all' ? t.audienceAll : item.audience === 'doctors' ? t.audienceDoctors : t.audienceAdmins}
                                             </span>
                                         </div>
                                         <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">{item.title}</h3>
                                     </div>
                                     <div className="flex items-center gap-2">
                                         <span className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                             {item.date}
                                         </span>
                                         <button 
                                            onClick={() => handleDelete(item.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                         >
                                             <Trash2 size={16} />
                                         </button>
                                     </div>
                                 </div>
                                 
                                 <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                     {item.content}
                                 </p>

                                 <div className="mt-4 flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 dark:border-slate-800 pt-3">
                                     <span className="flex items-center gap-1.5 hover:text-blue-500 transition-colors cursor-default">
                                         <Eye size={12} /> {item.views} {t.views}
                                     </span>
                                     <span>•</span>
                                     <span>ID: {item.id}</span>
                                 </div>
                             </motion.div>
                         )) : (
                             <div className="text-center py-10 text-slate-400 text-xs font-bold uppercase tracking-widest">
                                 No announcements found
                             </div>
                         )}
                     </AnimatePresence>
                 </div>
            </div>

        </div>

    </motion.div>
  );
};

export default AnnouncementManager;


import React, { useState } from 'react';
import { Language } from '../types';
import { translations } from '../services/translations';
import { Bug, Send, Clock, AlertOctagon, CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BugReportProps {
  lang: Language;
}

type Severity = 'low' | 'medium' | 'high' | 'critical';
type ReportStatus = 'open' | 'investigating' | 'resolved' | 'closed';

interface Report {
    id: string;
    title: string;
    description: string;
    severity: Severity;
    status: ReportStatus;
    date: string;
}

const BugReport: React.FC<BugReportProps> = ({ lang }) => {
  const t = (translations[lang] as any);
  
  // Mock Data
  const [reports, setReports] = useState<Report[]>([
      { id: 'BUG-102', title: 'Image Upload Failed', description: 'Getting 500 error when uploading PNG larger than 5MB.', severity: 'high', status: 'investigating', date: '2023-11-20' },
      { id: 'BUG-099', title: 'Typos in diagnosis report', description: 'Analysis report shows "Otitis" as "Otitiss".', severity: 'low', status: 'resolved', date: '2023-11-15' },
  ]);

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [steps, setSteps] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!title || !desc) return;

      setIsSubmitting(true);
      // Simulate API call
      setTimeout(() => {
          const newReport: Report = {
              id: `BUG-${Math.floor(Math.random() * 1000)}`,
              title,
              description: desc + (steps ? `\n\nSteps:\n${steps}` : ''),
              severity,
              status: 'open',
              date: new Date().toISOString().split('T')[0]
          };
          setReports([newReport, ...reports]);
          setTitle('');
          setDesc('');
          setSteps('');
          setSeverity('medium');
          setIsSubmitting(false);
      }, 800);
  };

  const getSeverityColor = (s: Severity) => {
      switch(s) {
          case 'critical': return 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900';
          case 'high': return 'bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-900';
          case 'medium': return 'bg-yellow-100 text-yellow-600 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-900';
          default: return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
      }
  };

  const getStatusIcon = (s: ReportStatus) => {
      switch(s) {
          case 'resolved': return <CheckCircle2 size={16} className="text-green-500" />;
          case 'investigating': return <CircleDashed size={16} className="text-blue-500 animate-spin-slow" />;
          case 'closed': return <XCircle size={16} className="text-slate-400" />;
          default: return <AlertOctagon size={16} className="text-amber-500" />;
      }
  };

  const getStatusLabel = (s: ReportStatus) => {
      switch(s) {
          case 'resolved': return t.statusResolved;
          case 'investigating': return t.statusInvestigating;
          case 'closed': return t.statusClosed;
          default: return t.statusOpen;
      }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-[1600px] mx-auto pb-10">
        
        {/* Header */}
        <div className="flex-shrink-0">
            <h1 className="text-3xl font-[900] text-slate-900 dark:text-white tracking-tighter uppercase flex items-center gap-3">
                <Bug className="text-red-600" />
                {t.bugReport}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium ml-1">
                {t.bugReportSub}
            </p>
        </div>

        <div className="flex flex-col xl:flex-row gap-8">
            
            {/* Left: Create Form */}
            <div className="xl:w-1/3">
                <div className="bg-white dark:bg-[#0b1120] rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-xl sticky top-6">
                    <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Send size={20} className="text-blue-600" /> {t.submitReport}
                    </h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t.issueTitle}</label>
                            <input 
                                type="text" 
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white transition-all"
                                placeholder={lang === 'zh' ? '簡述問題...' : 'Brief summary...'}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t.severity}</label>
                            <div className="grid grid-cols-4 gap-2">
                                {(['low', 'medium', 'high', 'critical'] as Severity[]).map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setSeverity(s)}
                                        className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${
                                            severity === s 
                                            ? getSeverityColor(s)
                                            : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-800'
                                        }`}
                                    >
                                        {s === 'low' ? t.severityLow : s === 'medium' ? t.severityMedium : s === 'high' ? t.severityHigh : t.severityCritical}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t.issueDesc}</label>
                            <textarea 
                                value={desc}
                                onChange={(e) => setDesc(e.target.value)}
                                rows={4}
                                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-medium text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white transition-all resize-none"
                                placeholder={lang === 'zh' ? '發生了什麼問題...' : 'What happened...'}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t.stepsToReproduce}</label>
                            <textarea 
                                value={steps}
                                onChange={(e) => setSteps(e.target.value)}
                                rows={3}
                                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-medium text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white transition-all resize-none"
                                placeholder={lang === 'zh' ? '1. 登入系統\n2. 點擊...' : '1. Login\n2. Click...'}
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={isSubmitting || !title || !desc}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                        >
                            {isSubmitting ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span> : <Send size={16} />}
                            {t.submitReport}
                        </button>
                    </form>
                </div>
            </div>

            {/* Right: History List */}
            <div className="xl:w-2/3 space-y-4">
                 <div className="flex items-center justify-between px-2">
                     <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         <Clock size={14} /> {t.myReports}
                     </h3>
                     <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-lg">
                         {reports.length}
                     </span>
                 </div>

                 <div className="grid gap-4">
                     <AnimatePresence>
                         {reports.map((item) => (
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
                                             <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getSeverityColor(item.severity)}`}>
                                                 <AlertOctagon size={10} />
                                                 {item.severity === 'low' ? t.severityLow : item.severity === 'medium' ? t.severityMedium : item.severity === 'high' ? t.severityHigh : t.severityCritical}
                                             </span>
                                             <span className="text-[10px] font-bold text-slate-400">
                                                 {item.id}
                                             </span>
                                         </div>
                                         <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">{item.title}</h3>
                                     </div>
                                     <div className="flex flex-col items-end gap-2">
                                         <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                             item.status === 'resolved' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' :
                                             item.status === 'closed' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' :
                                             'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                         }`}>
                                             {getStatusIcon(item.status)}
                                             {getStatusLabel(item.status)}
                                         </div>
                                         <span className="text-[10px] font-bold text-slate-400">
                                             {item.date}
                                         </span>
                                     </div>
                                 </div>
                                 
                                 <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50 whitespace-pre-wrap">
                                     {item.description}
                                 </p>
                             </motion.div>
                         ))}
                     </AnimatePresence>
                 </div>
            </div>

        </div>

    </motion.div>
  );
};

export default BugReport;


import React, { useState, useEffect } from 'react';
import { ReportData, Language } from '../types';
import { translations } from '../services/translations';
import { 
  Printer, Save, X, RotateCcw, FileText, AlertTriangle, 
  ChevronRight, Edit3, LayoutTemplate, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReportEditorProps {
  initialData: ReportData;
  lang: Language;
  onSave: (data: ReportData) => void;
  onExit: () => void;
}

const ReportEditor: React.FC<ReportEditorProps> = ({ initialData, lang, onSave, onExit }) => {
  const t = (translations[lang] as any);
  
  const [data, setData] = useState<ReportData>(initialData);
  const [committedData, setCommittedData] = useState<ReportData>(initialData);
  const [isDirty, setIsDirty] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  // Compare draft data with committed data to detect changes
  useEffect(() => {
    const isChanged = JSON.stringify(data) !== JSON.stringify(committedData);
    setIsDirty(isChanged);
  }, [data, committedData]);

  const handleApply = () => {
    setCommittedData(data);
    onSave(data);
    setIsDirty(false);
  };

  const handleCancel = () => {
    if (confirm(lang === 'zh' ? '確定要捨棄目前的變更嗎？' : 'Are you sure you want to discard changes?')) {
        setData(committedData);
    }
  };

  const handleExitRequest = () => {
      if (isDirty) {
          setShowExitDialog(true);
      } else {
          onExit();
      }
  };

  // Mock downloads - In real app, these would call the backend API
  const handleDownloadWord = () => {
      alert("Downloading .docx (Mock API Call)");
  };

  const handleDownloadPDF = () => {
       alert("Downloading .pdf (Mock API Call)");
  };

  const updateField = (key: keyof ReportData, value: string) => {
      setData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-950 flex flex-col h-screen overflow-hidden">
      
      {/* --- Toolbar (Sticky Top) --- */}
      <div className="h-16 bg-white dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 print:hidden shadow-sm z-40">
        <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-600 rounded-lg text-white">
                 <LayoutTemplate size={20} />
             </div>
             <div>
                <h2 className="font-[900] text-slate-800 dark:text-white uppercase tracking-tighter text-lg">{t.clinicalReport}</h2>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>v1.0</span> <ChevronRight size={10} /> <span>{t.editorMode}</span>
                </div>
             </div>
        </div>

        <div className="flex items-center gap-3">
             {isDirty && (
                <div className="flex items-center gap-2 mr-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-500 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide animate-pulse">
                    <AlertTriangle size={14} /> Unsaved Changes
                </div>
             )}

             {/* Download Actions */}
             <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                 <button onClick={handleDownloadWord} className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all" title="Download Word">
                    <FileText size={14} /> Word
                 </button>
                 <div className="w-px h-4 bg-slate-300 dark:bg-slate-700" />
                 <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all" title="Download PDF">
                    <Download size={14} /> PDF
                 </button>
             </div>

             <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-2" />

             <button onClick={handleApply} disabled={!isDirty} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95">
                 <Save size={16} /> {t.applyChanges}
             </button>

             <button onClick={handleExitRequest} className="ml-2 p-2.5 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-all">
                 <X size={20} />
             </button>
        </div>
      </div>

      {/* --- Main Workspace (Split View) --- */}
      <div className="flex-1 flex min-h-0 relative">
          
          {/* LEFT: Editor Form (Scrollable) */}
          <div className="w-96 shrink-0 bg-white dark:bg-[#0b1120] border-r border-slate-200 dark:border-slate-800 flex flex-col print:hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Edit3 size={14} /> {t.editFields}
                  </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  
                  {/* Basic Info Group */}
                  <div className="space-y-4">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1 mb-2">Basic Information</div>
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Patient Name</label>
                          <input type="text" value={data.patient_name} onChange={(e) => updateField('patient_name', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">ID</label>
                            <input type="text" value={data.patient_id} onChange={(e) => updateField('patient_id', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Doctor</label>
                            <input type="text" value={data.doctor_name} onChange={(e) => updateField('doctor_name', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                          <input type="text" value={data.visit_year} onChange={(e) => updateField('visit_year', e.target.value)} className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center text-sm font-bold" placeholder="Year" />
                          <input type="text" value={data.visit_month} onChange={(e) => updateField('visit_month', e.target.value)} className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center text-sm font-bold" placeholder="Month" />
                          <input type="text" value={data.visit_day} onChange={(e) => updateField('visit_day', e.target.value)} className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center text-sm font-bold" placeholder="Day" />
                      </div>
                  </div>

                  {/* Findings Group - Layout follows visual Order Left then Right */}
                  <div className="space-y-4">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1 mb-2">Findings (Left Ear)</div>
                      <textarea rows={3} value={data.left_ear_eac} onChange={(e) => updateField('left_ear_eac', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium outline-none resize-none" placeholder="EAC Findings" />
                      <div className="flex gap-2">
                          <textarea rows={2} value={data.left_ear_tm} onChange={(e) => updateField('left_ear_tm', e.target.value)} className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium outline-none resize-none" placeholder="TM Findings" />
                          <input type="text" value={data.left_tm_percent} onChange={(e) => updateField('left_tm_percent', e.target.value)} className="w-16 text-center p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold" placeholder="%" />
                      </div>
                  </div>

                  <div className="space-y-4">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1 mb-2">Findings (Right Ear)</div>
                      <textarea rows={3} value={data.right_ear_eac} onChange={(e) => updateField('right_ear_eac', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium outline-none resize-none" placeholder="EAC Findings" />
                      <div className="flex gap-2">
                          <textarea rows={2} value={data.right_ear_tm} onChange={(e) => updateField('right_ear_tm', e.target.value)} className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium outline-none resize-none" placeholder="TM Findings" />
                          <input type="text" value={data.right_tm_percent} onChange={(e) => updateField('right_tm_percent', e.target.value)} className="w-16 text-center p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold" placeholder="%" />
                      </div>
                  </div>

                  {/* Diagnosis & Orders */}
                  <div className="space-y-4">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1 mb-2">Clinical Assessment</div>
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Diagnosis</label>
                          <textarea rows={4} value={data.diagnosis} onChange={(e) => updateField('diagnosis', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium outline-none resize-none" />
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Orders</label>
                          <textarea rows={4} value={data.orders} onChange={(e) => updateField('orders', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium outline-none resize-none" />
                      </div>
                  </div>
              </div>
          </div>

          {/* RIGHT: A4 Preview (Scrollable Area) */}
          <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-900 p-8 flex justify-center print:p-0 print:overflow-visible print:block print:bg-white">
              
              {/* THE A4 PAPER */}
              <div 
                  className="bg-white text-black shadow-xl print:shadow-none box-border relative transition-transform origin-top scale-95"
                  style={{
                      width: '210mm',
                      minHeight: '297mm',
                      padding: '20mm',
                  }}
              >
                  {/* Header */}
                  <div className="text-center mb-8">
                      <div className="flex items-center justify-center gap-2 mb-2">
                         <span className="text-3xl font-black text-[#C493FF] tracking-tighter" style={{ fontFamily: 'Inter, sans-serif' }}>iEar</span>
                         <span className="text-xs font-black text-[#C493FF] relative -top-3">LM</span>
                      </div>
                      <h1 className="text-2xl font-bold tracking-wide" style={{ fontFamily: '"Noto Serif TC", serif' }}>耳鼻喉科門診檢查紀錄</h1>
                      <h2 className="text-sm font-bold uppercase tracking-widest mt-1">ENT CLINIC EXAMINATION RECORD</h2>
                  </div>

                  <hr className="border-t-2 border-black mb-6" />

                  {/* Patient Info Table */}
                  <table className="w-full mb-8 text-sm" style={{ borderCollapse: 'collapse' }}>
                      <tbody>
                          <tr>
                              <td className="w-24 font-bold pb-2" style={{ borderBottom: '1px solid #ddd' }}>病歷號碼</td>
                              <td className="pb-2 font-mono" style={{ borderBottom: '1px solid #ddd' }}>{data.patient_id || '—'}</td>
                              <td className="w-24 font-bold pb-2 pl-4" style={{ borderBottom: '1px solid #ddd' }}>姓 名</td>
                              <td className="pb-2" style={{ borderBottom: '1px solid #ddd' }}>{data.patient_name || '—'}</td>
                          </tr>
                          <tr>
                              <td className="w-24 font-bold py-3" style={{ borderBottom: '1px solid #ddd' }}>就診日期</td>
                              <td className="py-3" style={{ borderBottom: '1px solid #ddd' }}>
                                  {data.visit_year} 年 {data.visit_month} 月 {data.visit_day} 日
                              </td>
                              <td className="w-24 font-bold py-3 pl-4" style={{ borderBottom: '1px solid #ddd' }}>主治醫師</td>
                              <td className="py-3" style={{ borderBottom: '1px solid #ddd' }}>{data.doctor_name || '—'}</td>
                          </tr>
                      </tbody>
                  </table>

                  {/* Ear Exam Table - Strict Layout */}
                  <div className="mb-8">
                      <table className="w-full" style={{ tableLayout: 'fixed' }}>
                          <thead>
                              <tr>
                                  {/* SWAPPED: Left on Left, Right on Right */}
                                  <th className="w-1/2 text-left text-lg font-bold pb-2 border-b-2 border-dotted border-gray-300 pr-4">左耳(Left Ear)</th>
                                  <th className="w-1/2 text-left text-lg font-bold pb-2 border-b-2 border-dotted border-gray-300 pl-4">右耳(Right Ear)</th>
                              </tr>
                          </thead>
                          <tbody className="align-top">
                              {/* Row 1: EAC - SWAPPED MAPPING */}
                              <tr>
                                  <td className="pr-4 py-4 border-b border-dotted border-gray-300">
                                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">耳道(External Auditory Canal)</div>
                                      <div className="min-h-[40px] whitespace-pre-wrap break-words">{data.left_ear_eac || '—'}</div>
                                  </td>
                                  <td className="pl-4 py-4 border-b border-dotted border-gray-300 border-l border-gray-200">
                                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">耳道(External Auditory Canal)</div>
                                      <div className="min-h-[40px] whitespace-pre-wrap break-words">{data.right_ear_eac || '—'}</div>
                                  </td>
                              </tr>
                              {/* Row 2: TM - SWAPPED MAPPING */}
                              <tr>
                                  <td className="pr-4 py-4">
                                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">耳膜(Tympanic Membrane)</div>
                                      <div className="flex justify-between items-start">
                                          <div className="whitespace-pre-wrap break-words flex-1">{data.left_ear_tm || '—'}</div>
                                          {data.left_tm_percent && <div className="font-mono font-bold ml-2">{data.left_tm_percent}%</div>}
                                      </div>
                                  </td>
                                  <td className="pl-4 py-4 border-l border-gray-200">
                                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">耳膜(Tympanic Membrane)</div>
                                      <div className="flex justify-between items-start">
                                          <div className="whitespace-pre-wrap break-words flex-1">{data.right_ear_tm || '—'}</div>
                                          {data.right_tm_percent && <div className="font-mono font-bold ml-2">{data.right_tm_percent}%</div>}
                                      </div>
                                  </td>
                              </tr>
                          </tbody>
                      </table>
                  </div>

                  <hr className="border-t-2 border-black mb-6" />

                  {/* Diagnosis & Orders */}
                  <div className="mb-auto">
                      <h3 className="text-lg font-bold mb-4">綜合診斷 / 醫囑(Impression / Orders)</h3>
                      
                      <div className="mb-6">
                          <div className="whitespace-pre-wrap break-words leading-relaxed" style={{ overflowWrap: 'anywhere' }}>
                              {data.diagnosis || 'No Diagnosis Recorded'}
                          </div>
                      </div>

                      <div>
                          <div className="whitespace-pre-wrap break-words leading-relaxed text-gray-800" style={{ overflowWrap: 'anywhere' }}>
                              {data.orders}
                          </div>
                      </div>
                  </div>

                  {/* Footer - Pushed to bottom via margin-top-auto if needed, but relative placement is safer for flow */}
                  <div className="mt-20 pt-4 border-t border-gray-300 text-[10px] text-gray-500 flex flex-col gap-1">
                      <div className="flex justify-between uppercase tracking-widest font-bold">
                          <span>生成式 AI 輔助報告 | AI-assisted Report (Human-reviewed)</span>
                          <span>iEarLM System</span>
                      </div>
                      <div className="flex justify-between font-mono">
                          <span>版本：v1.0</span>
                          <span>日期：{data.visit_year}-{data.visit_month}-{data.visit_day}</span>
                          <span>文件類型：生成式報告</span>
                      </div>
                  </div>

              </div>
          </div>
      </div>

      {/* Exit Confirmation Dialog */}
      <AnimatePresence>
        {showExitDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 print:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowExitDialog(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-[#0b1120] rounded-3xl p-8 shadow-2xl max-w-sm w-full border dark:border-slate-800">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center text-yellow-600 dark:text-yellow-500 mb-2">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">{t.unsavedChangesTitle}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        {t.unsavedChangesMsg}
                    </p>
                    <div className="flex gap-3 w-full mt-4">
                        <button onClick={onExit} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors">
                            {t.exitEditor}
                        </button>
                        <button onClick={() => { handleApply(); onExit(); }} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all">
                            {t.applyChanges}
                        </button>
                    </div>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReportEditor;

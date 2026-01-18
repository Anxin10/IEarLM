
import React, { useState } from 'react';
import { EarExamRecord, EarSide, Language } from '../../types';
import { translations } from '../../services/translations';
import { StickyNote, Stethoscope, Sparkles } from 'lucide-react';
import { AIDiagnosisForm, AIResult, DiagnosisData, BilateralSelections } from '../AIDiagnosisForm';
import { chatWithMedicalAssistant } from '../../services/geminiService';

interface ClinicalPanelProps {
    leftExam: EarExamRecord;
    rightExam: EarExamRecord;
    activeSide: EarSide;
    onSwitchSide: (side: EarSide) => void;
    lang: Language;
    aiResult: AIResult | null;
    onUpdate: (updates: Partial<EarExamRecord>, side: EarSide) => void;
    sharedNotes: string;
    onNotesChange: (notes: string) => void;
    isLocked: boolean;
}

export const ClinicalPanel: React.FC<ClinicalPanelProps> = ({ 
    leftExam, rightExam, activeSide, onSwitchSide, lang, aiResult, onUpdate,
    sharedNotes, onNotesChange, isLocked
}) => {
    const t = (translations[lang] as any);
    const [isAiProcessing, setIsAiProcessing] = useState(false);

    // Save diagnosis findings to parent state (Handling Bilateral Data)
    const handleDiagnosisSave = (data: BilateralSelections) => {
        // We receive full state for left and right. Update both via the callback.
        
        // Helper to format summary string
        const formatSummary = (findings: any) => {
            const all = [...findings.EAC, ...findings.TM];
            return all.length > 0 
                ? all.map((f: any) => lang === 'zh' ? f.label_zh : f.label_en).join(', ') 
                : (lang === 'zh' ? '正常' : 'Normal');
        };

        // Update LEFT
        onUpdate({ 
            diagnosis: formatSummary(data.left), 
            detailedFindings: data.left,
            status: (leftExam.status === 'pending') ? 'draft' : leftExam.status
        }, 'left');

        // Update RIGHT
        onUpdate({ 
            diagnosis: formatSummary(data.right), 
            detailedFindings: data.right,
            status: (rightExam.status === 'pending') ? 'draft' : rightExam.status
        }, 'right');
    };

    // AI Auto-Generation for Notes (Impression & Orders)
    const handleAutoGenerate = async () => {
        if (isAiProcessing) return;
        setIsAiProcessing(true);
        try {
            // Build prompt context from current findings of BOTH ears
            const leftStr = leftExam.detailedFindings 
                ? `Left Ear: [EAC: ${leftExam.detailedFindings.EAC.map(f=>f.label_en).join(', ')}], [TM: ${leftExam.detailedFindings.TM.map(f=>`${f.label_en}${f.percentage ? `(${f.percentage}%)` : ''}`).join(', ')}]` 
                : 'Left Ear: No findings';
            
            const rightStr = rightExam.detailedFindings 
                ? `Right Ear: [EAC: ${rightExam.detailedFindings.EAC.map(f=>f.label_en).join(', ')}], [TM: ${rightExam.detailedFindings.TM.map(f=>`${f.label_en}${f.percentage ? `(${f.percentage}%)` : ''}`).join(', ')}]` 
                : 'Right Ear: No findings';

            const context = `Findings: ${leftStr}. ${rightStr}. Current Notes: ${sharedNotes}.`;
            const prompt = lang === 'zh' 
                ? "請根據目前的雙耳診斷結果與病理發現，為我撰寫一份簡潔、專業的臨床綜合發現與醫囑建議 (Impression & Orders)。請使用列點格式，並明確區分左右耳（如適用）。" 
                : "Please generate concise, professional clinical impression and orders based on the bilateral findings. Use bullet points and separate Impression from Orders.";
                
            const response = await chatWithMedicalAssistant(prompt, [], context);
            
            const newNotes = sharedNotes ? sharedNotes + '\n\n' + response : response;
            onNotesChange(newNotes);
        } catch (e) { 
            console.error(e); 
        } finally { 
            setIsAiProcessing(false); 
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-white dark:bg-[#0b1120]">
            
            {/* 1. Panel Header */}
            <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0 bg-white dark:bg-[#0b1120] z-20">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                        <Stethoscope size={16} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                        {t.pathologyOrders}
                    </span>
                </div>
                
                {/* Removed Editing Badge as requested */}
            </div>

            {/* 2. Main Content Area - SPLIT VIEW */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                
                {/* TOP SECTION: Findings (Bilateral Form) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar relative border-b border-slate-200 dark:border-slate-800">
                     <AIDiagnosisForm 
                        activeSide={activeSide} // To highlight which side is active in the form UI
                        onSwitchSide={onSwitchSide} // Pass down switcher
                        selections={{
                            left: leftExam.detailedFindings || { EAC: [], TM: [] },
                            right: rightExam.detailedFindings || { EAC: [], TM: [] }
                        }}
                        aiResult={aiResult}
                        readOnly={isLocked}
                        lang={lang}
                        onSave={handleDiagnosisSave}
                    />
                </div>

                {/* BOTTOM SECTION: Notes */}
                <div className="h-[35%] min-h-[200px] flex flex-col bg-slate-50 dark:bg-[#0f172a] shadow-inner z-10">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                         <div className="flex items-center gap-2">
                             <StickyNote size={14} className="text-slate-400" />
                             <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                 {t.notesHeader}
                             </span>
                         </div>
                         <button 
                            onClick={handleAutoGenerate} 
                            disabled={isAiProcessing || isLocked} 
                            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white rounded-md text-[9px] font-bold uppercase hover:bg-indigo-50 disabled:opacity-50 disabled:bg-slate-500 shadow-sm transition-all"
                         >
                             <Sparkles size={10} /> {t.autoGen}
                         </button>
                    </div>
                    
                    <div className="flex-1 relative">
                        <textarea 
                            value={sharedNotes}
                            onChange={(e) => onNotesChange(e.target.value)}
                            disabled={isLocked || isAiProcessing}
                            className="w-full h-full bg-transparent p-4 resize-none outline-none text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed disabled:opacity-60 placeholder:text-slate-400"
                            placeholder={lang === 'zh' ? "在此輸入綜合醫囑與建議..." : "Enter shared clinical notes and orders here..."}
                        />
                        {isAiProcessing && (
                            <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-20">
                                <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 border border-slate-100 dark:border-slate-700">
                                    <Sparkles size={14} className="text-indigo-600 animate-spin" />
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">AI Writing...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

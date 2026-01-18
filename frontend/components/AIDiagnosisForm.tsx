
import React, { useState, useEffect, useMemo } from 'react';
import { translations } from '../services/translations';
import { Language, EarSide as EarSideType } from '../types';
import { 
  X, Percent, Plus, Search, CheckCircle2, Circle, Stethoscope, Ear, ArrowRight, Lock
} from 'lucide-react';

// --- Types & Interfaces ---

export type Region = 'EAC' | 'TM';
export type AIStatus = 'SUCCESS' | 'LOW_CONFIDENCE' | 'FAILED';

export interface Lesion {
  region: Region;
  code: string;
  label_zh: string;
  label_en: string;
  is_normal: boolean;
  is_custom?: boolean;
  percentage?: number; 
}

export interface AIFinding {
  code: string;
  label_zh: string;
  label_en: string;
  confidence: number;
}

export interface AIResult {
  ear_side: 'LEFT' | 'RIGHT';
  ai_status: AIStatus;
  fail_reason?: string;
  model_version: string;
  timestamp: number;
  region_results: {
    EAC: { findings: AIFinding[]; needs_review: boolean };
    TM: { findings: AIFinding[]; needs_review: boolean };
  };
}

export interface FindingsSet {
    EAC: Lesion[];
    TM: Lesion[];
}

export interface BilateralSelections {
    left: FindingsSet;
    right: FindingsSet;
}

// New export type for the parent to use
export type DiagnosisData = BilateralSelections; 

interface DiagnosisFormProps {
  activeSide: EarSideType; // 'left' or 'right' - to know where to add items
  onSwitchSide: (side: EarSideType) => void; // New callback
  selections: BilateralSelections;
  aiResult?: AIResult | null;
  readOnly?: boolean;
  lang: Language;
  onSave: (data: BilateralSelections) => void;
}

// --- Data Constants ---

const DEFAULT_CATALOG: Lesion[] = [
  // TM Items (Removed TM_NORMAL)
  { region: 'TM', code: 'TM_OTITIS_MEDIA', label_zh: '中耳炎', label_en: 'Otitis media', is_normal: false },
  { region: 'TM', code: 'TM_MIDDLE_EAR_EFFUSION', label_zh: '中耳積水', label_en: 'Middle ear effusion', is_normal: false },
  { region: 'TM', code: 'TM_EARDRUM_PERFORATION', label_zh: '耳膜破洞', label_en: 'Eardrum perforation', is_normal: false },
  { region: 'TM', code: 'TM_MYRINGITIS', label_zh: '耳膜炎', label_en: 'Myringitis', is_normal: false },
  { region: 'TM', code: 'TM_TYMPANOSCLEROSIS', label_zh: '耳膜硬化', label_en: 'Tympanosclerosis', is_normal: false },
  { region: 'TM', code: 'TM_RETRACTION', label_zh: '耳膜內縮', label_en: 'Retraction', is_normal: false },
  { region: 'TM', code: 'TM_ATROPHIC_SCAR', label_zh: '萎縮性疤痕', label_en: 'Atrophic scar', is_normal: false },
  { region: 'TM', code: 'TM_MIDDLE_EAR_TUMOR', label_zh: '中耳腫瘤', label_en: 'Middle ear tumor', is_normal: false },
  { region: 'TM', code: 'TM_VENTILATION_TUBE', label_zh: '中耳通氣管', label_en: 'Ventilation tube', is_normal: false },
  { region: 'TM', code: 'TM_TYMPANOPLASTY', label_zh: '耳膜修補', label_en: 'Tympanoplasty', is_normal: false },
  
  // EAC Items (Removed EAC_NORMAL)
  { region: 'EAC', code: 'EAC_CERUMEN', label_zh: '外耳道耳垢', label_en: 'Cerumen', is_normal: false },
  { region: 'EAC', code: 'EAC_OTITIS_EXTERNA', label_zh: '外耳道炎', label_en: 'Otitis externa', is_normal: false },
  { region: 'EAC', code: 'EAC_OTOMYCOSIS', label_zh: '耳黴菌', label_en: 'Otomycosis', is_normal: false },
  { region: 'EAC', code: 'EAC_FOREIGN_BODY', label_zh: '耳異物', label_en: 'Foreign body', is_normal: false },
  { region: 'EAC', code: 'EAC_BLOOD_CLOT', label_zh: '外耳道血塊', label_en: 'Blood clot', is_normal: false },
  { region: 'EAC', code: 'EAC_ATRESIA', label_zh: '外耳道閉鎖', label_en: 'Atresia', is_normal: false },
  { region: 'EAC', code: 'EAC_TUMOR', label_zh: '外耳道腫瘤', label_en: 'EAC tumor', is_normal: false },
];

export const AIDiagnosisForm: React.FC<DiagnosisFormProps> = ({
    activeSide,
    onSwitchSide,
    selections,
    aiResult,
    readOnly,
    lang,
    onSave,
}) => {
    const t = (translations[lang] as any);
    
    // --- State ---
    const [activeLibraryTab, setActiveLibraryTab] = useState<Region>('TM');
    const [catalog, setCatalog] = useState<Lesion[]>(DEFAULT_CATALOG);
    const [searchQuery, setSearchQuery] = useState('');

    // --- AI Result Sync ---
    useEffect(() => {
        if (aiResult && aiResult.ai_status === 'SUCCESS') {
            const sideKey = aiResult.ear_side === 'LEFT' ? 'left' : 'right';
            const currentSideSelections = selections[sideKey];
            const nextSideSelections = { EAC: [...currentSideSelections.EAC], TM: [...currentSideSelections.TM] };
            let hasChanges = false;

            ['EAC', 'TM'].forEach((region) => {
                const r = region as Region;
                const findings = aiResult.region_results[r].findings;
                findings.forEach(f => {
                    const exists = nextSideSelections[r].some(s => s.code === f.code);
                    if (!exists) {
                        const match = catalog.find(c => c.code === f.code) || DEFAULT_CATALOG.find(c => c.code === f.code);
                        if (match) {
                            nextSideSelections[r].push({ ...match, percentage: 0 });
                            hasChanges = true;
                        }
                    }
                });
            });

            if (hasChanges) {
                onSave({
                    ...selections,
                    [sideKey]: nextSideSelections
                });
            }
        }
    }, [aiResult]);

    // --- Computed ---
    const filteredCatalog = useMemo(() => {
        let items = catalog.filter(i => i.region === activeLibraryTab && !i.is_normal);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter(i => 
                i.label_zh.toLowerCase().includes(q) || 
                i.label_en.toLowerCase().includes(q)
            );
        }
        return items;
    }, [catalog, activeLibraryTab, searchQuery]);

    // --- Handlers ---

    // 1. Toggle Item: Adds/Removes from the *Active Side*
    const handleToggleLesion = (lesion: Lesion) => {
        if (readOnly) return;
        const sideKey = activeSide; // 'left' or 'right'
        const region = lesion.region;
        const currentList = selections[sideKey][region];
        
        const exists = currentList.find(l => l.code === lesion.code);
        let newList;

        if (exists) {
            newList = currentList.filter(l => l.code !== lesion.code);
        } else {
            newList = [...currentList, { ...lesion, percentage: 0 }];
        }

        const newSideData = { ...selections[sideKey], [region]: newList };
        onSave({ ...selections, [sideKey]: newSideData });
    };

    // 2. Remove Item: Removes from specific side (clicked 'X')
    const handleRemove = (side: 'left' | 'right', region: Region, code: string) => {
        if (readOnly) return;
        const newList = selections[side][region].filter(l => l.code !== code);
        onSave({
            ...selections,
            [side]: { ...selections[side], [region]: newList }
        });
    };

    // 3. Percentage Change: INSTANT LOCK (Max 100)
    const handlePercentageChange = (side: 'left' | 'right', code: string, val: string) => {
        if (readOnly) return;
        
        // Allow clearing to empty string
        if (val === '') {
             updatePercentage(side, code, 0); 
             return;
        }

        // Only allow digits
        if (!/^\d*$/.test(val)) return;

        let numVal = parseInt(val, 10);
        
        // INSTANTLY CLAMP
        if (numVal > 100) numVal = 100;
        
        updatePercentage(side, code, numVal);
    };

    const updatePercentage = (side: 'left' | 'right', code: string, numVal: number) => {
        const region = 'TM'; // Only TM has percentage
        const newList = selections[side][region].map(l => l.code === code ? { ...l, percentage: numVal } : l);
        onSave({
            ...selections,
            [side]: { ...selections[side], [region]: newList }
        });
    };

    // --- Renderers ---

    const renderCard = (side: 'left' | 'right', item: Lesion) => {
        const isTM = item.region === 'TM';
        // Ensure value is not NaN
        const displayVal = (item.percentage !== undefined && !isNaN(item.percentage)) ? item.percentage.toString() : '';

        return (
            <div 
                key={`${side}-${item.code}`}
                className="flex items-center justify-between p-2.5 rounded-xl border bg-white dark:bg-slate-800 shadow-sm animate-in zoom-in-95 duration-200 border-slate-200 dark:border-slate-700 mb-2"
            >
                 <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0 mr-2">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${side === 'left' ? 'bg-blue-500' : 'bg-red-500'}`} />
                    <div className="flex flex-col truncate">
                        <span className="font-bold text-[11px] truncate leading-tight text-slate-800 dark:text-slate-200">
                            {lang === 'zh' ? `${item.label_zh} (${item.label_en})` : item.label_en}
                        </span>
                        <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 truncate leading-tight mt-0.5">
                            {item.region}
                        </span>
                    </div>
                 </div>

                 <div className="flex items-center gap-1 shrink-0">
                    {/* Percentage Input */}
                    {isTM && (
                         <div className="flex items-center rounded-lg px-1.5 py-1 border bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                             <input 
                                type="text"
                                inputMode="numeric"
                                value={displayVal === '0' ? '' : displayVal} // Show empty if 0 for cleaner look, or '0' if preferred. Let's use standard value.
                                onChange={(e) => handlePercentageChange(side, item.code, e.target.value)}
                                disabled={readOnly}
                                placeholder="0"
                                className="w-8 bg-transparent text-[10px] font-black text-right outline-none appearance-none m-0 text-slate-700 dark:text-slate-300 focus:text-blue-600 disabled:opacity-50"
                             />
                             <Percent size={8} className="text-slate-400" />
                         </div>
                    )}

                    {readOnly ? (
                        <div className="p-1.5 text-slate-300 dark:text-slate-600">
                            <Lock size={12} />
                        </div>
                    ) : (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleRemove(side, item.region, item.code); }} 
                            className="p-1.5 text-slate-300 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <X size={12} />
                        </button>
                    )}
                 </div>
            </div>
        );
    };

    const renderColumn = (side: 'left' | 'right', title: string, colorClass: string) => {
        const items = [...selections[side].TM, ...selections[side].EAC];
        const isActive = activeSide === side;

        return (
            <div 
                onClick={() => !readOnly && onSwitchSide(side)}
                className={`flex-1 flex flex-col bg-white dark:bg-[#0b1120] border rounded-xl overflow-hidden shadow-sm transition-all cursor-pointer hover:shadow-md ${
                    isActive 
                    ? `border-${side === 'left' ? 'blue' : 'red'}-500 ring-2 ring-${side === 'left' ? 'blue' : 'red'}-500/20` 
                    : 'border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
                }`}
            >
                 <div className={`px-3 py-2 border-b flex items-center gap-2 ${
                     isActive 
                     ? (side === 'left' ? 'bg-blue-50/80 dark:bg-blue-900/30' : 'bg-red-50/80 dark:bg-red-900/30') 
                     : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
                 }`}>
                     <span className={`text-[10px] font-black uppercase tracking-wider ${colorClass}`}>{title}</span>
                     <span className="ml-auto bg-white dark:bg-slate-800 text-slate-500 px-1.5 rounded text-[9px] font-bold shadow-sm">{items.length}</span>
                 </div>
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-slate-50/30 dark:bg-[#0f172a]">
                     {items.length > 0 ? (
                         items.map(item => renderCard(side, item))
                     ) : (
                         <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 opacity-60">
                             <span className="text-[10px] font-bold uppercase tracking-widest">{t.noSelection}</span>
                         </div>
                     )}
                 </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-[#0b1120] text-slate-900 dark:text-slate-100">
            
            {/* 1. SELECTED FINDINGS (SPLIT VIEW) */}
            <div className="h-[260px] shrink-0 border-b border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-[#0f172a] pt-3">
                <div className="flex-1 flex overflow-hidden px-2 pb-3 gap-3">
                    {renderColumn('left', t.leftEar, 'text-blue-600 dark:text-blue-400')}
                    {renderColumn('right', t.rightEar, 'text-red-600 dark:text-red-400')}
                </div>
            </div>

            {/* 2. CANDIDATE LIBRARY (Adds to Active Side) */}
            {/* Logic: Show Library ONLY if not ReadOnly. If ReadOnly, show Locked state */}
            {readOnly ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 dark:bg-[#0b1120] p-6 text-slate-400">
                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3 text-slate-400">
                        <Lock size={20} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">
                        {lang === 'zh' ? '檢查已鎖定' : 'Examination Locked'}
                    </span>
                    <p className="text-[10px] font-medium mt-1 opacity-70">
                        {lang === 'zh' ? '請解鎖以新增或修改病灶' : 'Unlock to add or modify findings'}
                    </p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0b1120]">
                    <div className="px-3 py-2 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                         {/* Region Tabs */}
                         <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg shrink-0">
                            {(['TM', 'EAC'] as Region[]).map(r => (
                                <button
                                    key={r}
                                    onClick={() => { setActiveLibraryTab(r); setSearchQuery(''); }}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                                        activeLibraryTab === r 
                                        ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' 
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                    }`}
                                >
                                    {t[`region${r}` as any]}
                                </button>
                            ))}
                        </div>

                        <div className="relative flex-1">
                            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={lang === 'zh' ? `搜尋並加入至 ${activeSide === 'left' ? '左耳' : '右耳'}...` : `Add to ${activeSide} ear...`}
                                className="w-full pl-8 pr-4 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-indigo-500/50 dark:text-white transition-all placeholder:text-slate-400"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 auto-rows-min">
                            {filteredCatalog.length > 0 ? (
                                filteredCatalog.map(item => {
                                    const isSelected = selections[activeSide][activeLibraryTab].some(s => s.code === item.code);
                                    return (
                                        <button
                                            key={item.code}
                                            onClick={() => handleToggleLesion(item)}
                                            disabled={isSelected}
                                            className={`flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all active:scale-95 group relative h-[42px]
                                                ${isSelected 
                                                    ? 'opacity-40 cursor-default bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800' 
                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm'
                                                }
                                            `}
                                        >
                                            <span className={`text-[10px] font-bold truncate pr-2 ${isSelected ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {lang === 'zh' ? `${item.label_zh} (${item.label_en})` : item.label_en}
                                            </span>
                                            {!isSelected && (
                                                <div className={`text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${activeSide === 'left' ? 'text-blue-500' : 'text-red-500'}`}>
                                                    ADD <ArrowRight size={8} />
                                                </div>
                                            )}
                                            {isSelected && <CheckCircle2 size={12} className="text-slate-300 shrink-0" />}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="col-span-full py-8 text-center flex flex-col items-center">
                                    <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{t.noSelection}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

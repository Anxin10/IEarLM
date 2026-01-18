
import React, { useReducer, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Patient, UserRole, Language, EarExamRecord, EarSide, ReportData, Lesion } from '../types';
import { translations } from '../services/translations';
import { 
  ArrowLeft, FileText, CheckCircle2, Unlock, Lock,
  AlertTriangle, Check, Download
} from 'lucide-react';
import { MediaConsole } from './patient_detail/MediaConsole';
import { ClinicalPanel } from './patient_detail/ClinicalPanel';
import { SideAssistant } from './patient_detail/SideAssistant';
import { AIResult } from './AIDiagnosisForm';

interface PatientDetailProps {
  patients: Patient[];
  role: UserRole;
  onEdit: (patient: Patient) => void;
  onDelete: (id: string) => void;
  lang: Language;
}

// --- Reducer Types & Logic ---
type DetailState = {
  activeSide: EarSide;
  left: EarExamRecord;
  right: EarExamRecord;
  sharedNotes: string;
  aiResult: AIResult | null; // Transient AI result for the active side
};

type Action = 
  | { type: 'INIT_DATA'; payload: { left: EarExamRecord; right: EarExamRecord; notes: string } }
  | { type: 'SWITCH_SIDE'; payload: EarSide }
  | { type: 'UPDATE_EXAM'; payload: { side: EarSide; updates: Partial<EarExamRecord> } }
  | { type: 'UPDATE_NOTES'; payload: string }
  | { type: 'SET_AI_RESULT'; payload: AIResult | null }
  | { type: 'TOGGLE_GLOBAL_LOCK'; payload: boolean };

const initialState: DetailState = {
  activeSide: 'right', // Default to right ear as per standard convention
  left: { status: 'pending', diagnosis: '', notes: '', segmentationData: [] },
  right: { status: 'pending', diagnosis: '', notes: '', segmentationData: [] },
  sharedNotes: '',
  aiResult: null
};

function detailReducer(state: DetailState, action: Action): DetailState {
  switch (action.type) {
    case 'INIT_DATA':
      return {
        ...state,
        left: action.payload.left,
        right: action.payload.right,
        sharedNotes: action.payload.notes
      };
    case 'SWITCH_SIDE':
      return {
        ...state,
        activeSide: action.payload,
        aiResult: null // Clear AI result on side switch to avoid confusion
      };
    case 'UPDATE_EXAM':
      const { side, updates } = action.payload;
      const currentExam = state[side];
      
      // Determine new status logic:
      // 1. If 'status' is explicitly provided in updates (e.g., reset to 'pending'), use it.
      // 2. If currently 'pending' and we are adding data (image or findings), switch to 'draft'.
      let newStatus = updates.status !== undefined ? updates.status : currentExam.status;
      
      // Auto-promote to draft if adding content
      if (currentExam.status === 'pending' && !updates.status) {
          const hasContent = updates.imageUrl || (updates.detailedFindings && (updates.detailedFindings.EAC.length > 0 || updates.detailedFindings.TM.length > 0));
          if (hasContent) {
              newStatus = 'draft';
          }
      }

      return {
        ...state,
        [side]: {
          ...currentExam,
          ...updates, // CRITICAL: This will correctly overwrite imageUrl with null if passed
          status: newStatus
        }
      };
    case 'UPDATE_NOTES':
      return { ...state, sharedNotes: action.payload };
    case 'SET_AI_RESULT':
      return { ...state, aiResult: action.payload };
    case 'TOGGLE_GLOBAL_LOCK':
      const targetStatus = action.payload ? 'completed' : 'draft';
      // When locking/unlocking, we update BOTH sides to the target status
      return {
        ...state,
        left: { ...state.left, status: targetStatus },
        right: { ...state.right, status: targetStatus }
      };
    default:
      return state;
  }
}

const PatientDetail: React.FC<PatientDetailProps> = ({ patients, role, onEdit, onDelete, lang }) => {
  const t = (translations[lang] as any);
  const { id } = useParams<{ id: string }>();
  
  const patient = patients.find(p => p.id === id);
  const [state, dispatch] = useReducer(detailReducer, initialState);

  // --- Initialization ---
  useEffect(() => {
    if (patient) {
      if (patient.exams) {
        dispatch({ 
          type: 'INIT_DATA', 
          payload: { 
            left: patient.exams.left, 
            right: patient.exams.right, 
            notes: patient.notes 
          } 
        });
      } else {
        // Fallback for legacy data structure (migration)
        dispatch({ 
          type: 'INIT_DATA', 
          payload: { 
            left: { 
              status: patient.diagnosis !== 'Normal' ? 'completed' : 'pending',
              diagnosis: patient.diagnosis,
              notes: patient.notes,
              imageUrl: patient.imageUrl,
              segmentationData: patient.segmentationData
            },
            right: { status: 'pending', diagnosis: '', notes: '', segmentationData: [] },
            notes: patient.notes
          } 
        });
      }
    }
  }, [patient?.id]);

  // --- Auto-Save Sync ---
  // Syncs local reducer state back to the global App state whenever it changes
  const syncToGlobal = useCallback((newState: DetailState) => {
    if (!patient) return;
    
    // Construct summarized diagnosis string for the list view
    const leftDx = newState.left.diagnosis || (lang === 'zh' ? '未檢查' : 'Pending');
    const rightDx = newState.right.diagnosis || (lang === 'zh' ? '未檢查' : 'Pending');
    const summaryDiagnosis = `L: ${leftDx} / R: ${rightDx}`;

    const updatedPatient: Patient = {
        ...patient,
        exams: {
            left: newState.left,
            right: newState.right,
            shared: { impression: newState.sharedNotes, orders: [], generalNotes: '' }
        },
        notes: newState.sharedNotes,
        diagnosis: summaryDiagnosis // Update summary for PatientList
    };
    onEdit(updatedPatient);
  }, [patient, onEdit, lang]);

  // Skip first render sync, then sync on changes
  const isFirstRender = React.useRef(true);
  useEffect(() => {
      if (isFirstRender.current) {
          isFirstRender.current = false;
          return;
      }
      syncToGlobal(state);
  }, [state.left, state.right, state.sharedNotes]);


  // --- Handlers ---
  // Updated to accept side argument to update specific ear from ClinicalPanel
  const handleUpdateExam = (updates: Partial<EarExamRecord>, side?: EarSide) => {
    const targetSide = side || state.activeSide;
    dispatch({ type: 'UPDATE_EXAM', payload: { side: targetSide, updates } });
  };

  const handleNotesChange = (text: string) => {
    dispatch({ type: 'UPDATE_NOTES', payload: text });
  };

  // Lock Logic: Exams are considered "Locked" if status is 'completed'
  const isGlobalLocked = state.left.status === 'completed' && state.right.status === 'completed';

  const handleToggleGlobalLock = () => {
    // Toggle between 'completed' (Locked) and 'draft' (Editable)
    dispatch({ 
        type: 'TOGGLE_GLOBAL_LOCK', 
        payload: !isGlobalLocked 
    });
  };

  const handleSwitchSide = (side: EarSide) => {
      dispatch({ type: 'SWITCH_SIDE', payload: side });
  };

  const handleDownload = (format: 'word' | 'pdf') => {
      if (!patient) return;
      const data = getReportData();
      const filename = `Report_${data.patient_id}_${data.visit_year}${data.visit_month}${data.visit_day}.${format === 'word' ? 'docx' : 'pdf'}`;
      // In a real app, you would fetch/generate the actual binary file here
      const content = `Mock ${format.toUpperCase()} Report for ${data.patient_name}\n\nDiagnosis: ${data.diagnosis}`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  if (!patient) return null;

  const currentExam = state[state.activeSide];

  // Helper to format report data for the modal
  const getReportData = (): ReportData => {
      const formatLesions = (l: Lesion[] | undefined) => l?.map(i => lang === 'zh' ? i.label_zh : i.label_en).join(', ') || (lang === 'zh' ? '無異常發現' : 'No findings');
      return {
          patient_id: patient.id,
          patient_name: patient.name,
          visit_year: new Date().getFullYear().toString(),
          visit_month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
          visit_day: new Date().getDate().toString().padStart(2, '0'),
          doctor_name: "Dr. Medical", // In a real app, get from 'user' context
          right_ear_eac: formatLesions(state.right.detailedFindings?.EAC),
          left_ear_eac: formatLesions(state.left.detailedFindings?.EAC),
          right_ear_tm: formatLesions(state.right.detailedFindings?.TM),
          left_ear_tm: formatLesions(state.left.detailedFindings?.TM),
          // Extract percentage if available from the first TM lesion (simplification for report)
          right_tm_percent: state.right.detailedFindings?.TM?.[0]?.percentage?.toString() || "",
          left_tm_percent: state.left.detailedFindings?.TM?.[0]?.percentage?.toString() || "",
          diagnosis: state.sharedNotes || `${state.left.diagnosis} / ${state.right.diagnosis}`,
          orders: lang === 'zh' ? "建議兩週後回診追蹤。" : "Follow up in 2 weeks."
      };
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#020617] overflow-hidden">
        
        {/* --- Header --- */}
        <div className="h-16 flex items-center justify-between px-6 bg-white dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 shrink-0 z-30">
            <div className="flex items-center gap-4 min-w-0">
                <Link to="/patients" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors">
                    <ArrowLeft size={18} />
                </Link>
                <div className="flex flex-col">
                    <h1 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{patient.name}</h1>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>{patient.id}</span>
                        <span>•</span>
                        <span className={patient.gender === 'Male' ? 'text-blue-500' : 'text-pink-500'}>
                            {patient.gender === 'Male' ? (lang === 'zh' ? '男' : 'Male') : (lang === 'zh' ? '女' : 'Female')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions (Global Lock & Report) */}
            <div className="flex items-center gap-3">
                {!isGlobalLocked && (
                   <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded animate-pulse">
                      <AlertTriangle size={10} /> 
                      {lang === 'zh' ? '檢查完成後可生成報告' : 'Complete exam to report'}
                   </span>
                )}
                
                <button 
                    onClick={handleToggleGlobalLock}
                    className={`h-9 px-4 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 border ${
                        isGlobalLocked
                        ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700 shadow-lg shadow-blue-500/20' // CHANGED TO BLUE
                        : 'bg-green-600 text-white border-green-500 hover:bg-green-700 shadow-lg shadow-green-500/20'
                    }`}
                    title={isGlobalLocked ? (lang === 'zh' ? '點擊解鎖以編輯' : 'Click to unlock') : ''}
                >
                    {isGlobalLocked ? (
                        <>
                            <Lock size={14} /> 
                            <span>{lang === 'zh' ? '已鎖定' : 'Locked'}</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle2 size={14} />
                            <span>{t.completeExam}</span>
                        </>
                    )}
                </button>

                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                {/* Direct Download Buttons - Visual match for screenshot */}
                <div className={`flex items-center bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-300 ${!isGlobalLocked ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                    <button 
                        onClick={() => handleDownload('word')} 
                        disabled={!isGlobalLocked}
                        className="px-4 py-2 flex items-center gap-2 text-[10px] font-black text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-r border-slate-200 dark:border-slate-700 disabled:cursor-not-allowed"
                    >
                        <FileText size={14} /> WORD
                    </button>
                    <button 
                        onClick={() => handleDownload('pdf')} 
                        disabled={!isGlobalLocked}
                        className="px-4 py-2 flex items-center gap-2 text-[10px] font-black text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:cursor-not-allowed"
                    >
                        <Download size={14} /> PDF
                    </button>
                </div>
            </div>
        </div>

        {/* --- Main Workspace (Responsive Grid Layout) --- */}
        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 overflow-hidden">
            
            {/* Left Col: Media Console (5/12 on LG, Full height split on Mobile) */}
            <div className="w-full h-[500px] lg:h-full lg:col-span-5 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-black overflow-hidden relative shrink-0">
                <MediaConsole 
                    examData={currentExam}
                    activeSide={state.activeSide}
                    onSwitchSide={handleSwitchSide}
                    lang={lang}
                    onUpdate={(updates) => handleUpdateExam(updates)}
                    onAiResult={(res) => dispatch({ type: 'SET_AI_RESULT', payload: res })}
                    aiResult={state.aiResult}
                    readOnly={isGlobalLocked}
                />
            </div>

            {/* Right Col: Clinical Panel (7/12 on LG, remaining space on Mobile) */}
            <div className="w-full flex-1 lg:h-full lg:col-span-7 flex flex-col bg-white dark:bg-[#0b1120] relative overflow-hidden">
                <ClinicalPanel 
                    leftExam={state.left}
                    rightExam={state.right}
                    activeSide={state.activeSide}
                    onSwitchSide={handleSwitchSide}
                    lang={lang}
                    aiResult={state.aiResult}
                    onUpdate={handleUpdateExam}
                    sharedNotes={state.sharedNotes}
                    onNotesChange={handleNotesChange}
                    isLocked={isGlobalLocked}
                />
                
                {/* Floating Assistant Dock */}
                <SideAssistant 
                    patient={patient}
                    isOpen={true} // It handles its own collapsed state
                    lang={lang}
                    currentExam={currentExam}
                    activeSide={state.activeSide}
                />
            </div>
        </div>
    </div>
  );
};

export default PatientDetail;

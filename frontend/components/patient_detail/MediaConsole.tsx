
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { EarExamRecord, EarSide, Language } from '../../types';
import { translations } from '../../services/translations';
import { analyzeEarImage } from '../../services/apiService';
import {
    Video, CloudUpload, Sparkles, Loader2, Trash2, Camera,
    Ear, ScanEye, VideoOff, WifiOff, RefreshCw
} from 'lucide-react';
import { AIResult, AIFinding } from '../AIDiagnosisForm';
import { motion, AnimatePresence } from 'framer-motion';

// --- MAPPING LOGIC ---
const BACKEND_TO_FRONTEND_CODE_MAP: Record<string, string> = {
    // TM
    'Otitis media': 'TM_OTITIS_MEDIA',
    'AOM': 'TM_OTITIS_MEDIA',
    'OME': 'TM_MIDDLE_EAR_EFFUSION',
    'Middle ear effusion': 'TM_MIDDLE_EAR_EFFUSION',
    'Perforation': 'TM_EARDRUM_PERFORATION',
    'Eardrum perforation': 'TM_EARDRUM_PERFORATION',
    'Myringitis': 'TM_MYRINGITIS',
    'Tympanosclerosis': 'TM_TYMPANOSCLEROSIS',
    'Retraction': 'TM_RETRACTION',
    'Atrophic scar': 'TM_ATROPHIC_SCAR',
    'Tumor': 'TM_MIDDLE_EAR_TUMOR',
    'Ventilation tube': 'TM_VENTILATION_TUBE',
    'Grommet': 'TM_VENTILATION_TUBE',
    'Tympanoplasty': 'TM_TYMPANOPLASTY',

    // EAC
    'Cerumen': 'EAC_CERUMEN',
    'Impacted cerumen': 'EAC_CERUMEN',
    'Otitis externa': 'EAC_OTITIS_EXTERNA',
    'Otomycosis': 'EAC_OTOMYCOSIS',
    'Foreign body': 'EAC_FOREIGN_BODY',
    'Blood clot': 'EAC_BLOOD_CLOT',
    'Atresia': 'EAC_ATRESIA',
    'EAC Tumor': 'EAC_TUMOR'
};

const mapApiToUiResult = (apiResult: any, side: EarSide): AIResult => {
    // Helper to map a list of API detections to UI Findings
    const mapDetections = (detections: any[]): AIFinding[] => {
        return detections
            .map(d => {
                // Try to find a code match based on English class name
                // Checking raw class, normalized class, or class_name_en
                const key = d.class || d.class_name_en || d.normalized_class;
                const code = BACKEND_TO_FRONTEND_CODE_MAP[key] || BACKEND_TO_FRONTEND_CODE_MAP[d.class_name_en];

                if (!code) return null; // Skip unknown classes (e.g. Normal)

                return {
                    code: code,
                    label_zh: d.class_name_zh || d.class,
                    label_en: d.class_name_en || d.class,
                    confidence: d.confidence
                };
            })
            .filter((f): f is AIFinding => f !== null);
    };

    return {
        ear_side: side === 'left' ? 'LEFT' : 'RIGHT',
        ai_status: 'SUCCESS',
        model_version: 'v2.0-yolo',
        timestamp: Date.now(),
        region_results: {
            EAC: {
                findings: mapDetections(apiResult.eac_detections || []),
                needs_review: false
            },
            TM: {
                findings: mapDetections(apiResult.tm_detections || []),
                needs_review: false
            }
        }
    };
};

interface MediaConsoleProps {
    examData: EarExamRecord;
    activeSide: EarSide;
    onSwitchSide: (side: EarSide) => void;
    lang: Language;
    onUpdate: (updates: Partial<EarExamRecord>) => void;
    onAiResult: (res: AIResult | null) => void;
    aiResult: AIResult | null;
    readOnly?: boolean;
}

// Reused ActionTooltip for consistency
const ActionTooltip = ({ content, children, side = 'bottom' }: { content: string, children?: React.ReactNode, side?: 'top' | 'bottom' }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const handleEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            if (side === 'top') {
                setCoords({ top: rect.top - 10, left: rect.left + rect.width / 2 });
            } else {
                setCoords({ top: rect.bottom + 12, left: rect.left + rect.width / 2 });
            }
            setIsVisible(true);
        }
    };
    return (
        <div ref={triggerRef} onMouseEnter={handleEnter} onMouseLeave={() => setIsVisible(false)} className="relative inline-flex items-center justify-center">
            {children}
            {isVisible && createPortal(
                <div className={`fixed z-[9999] -translate-x-1/2 px-2 pointer-events-none ${side === 'top' ? '-translate-y-full' : ''}`} style={{ top: coords.top, left: coords.left }}>
                    <motion.div
                        initial={{ opacity: 0, y: side === 'top' ? 5 : -5, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest py-2 px-3 rounded-xl shadow-xl relative whitespace-nowrap"
                    >
                        {content}
                        <div className={`absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white dark:bg-slate-800 border-l border-t border-slate-200 dark:border-slate-700 rotate-45 ${side === 'top' ? 'bottom-[-5px] border-l-0 border-t-0 border-r border-b' : 'top-[-5px]'}`} />
                    </motion.div>
                </div>, document.body
            )}
        </div>
    );
};

export const MediaConsole: React.FC<MediaConsoleProps> = ({
    examData, activeSide, onSwitchSide, lang,
    onUpdate, onAiResult, aiResult, readOnly
}) => {
    const t = (translations[lang] as any);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showSegmentation, setShowSegmentation] = useState(false);

    // Connection State Steps: 0:Idle, 1:Connecting, 2:Failed, 3:Reconnecting, 4:Connected
    const [connectionStep, setConnectionStep] = useState<0 | 1 | 2 | 3 | 4>(0);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const clearAllTimers = () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    };

    const startConnectionSequence = () => {
        clearAllTimers();
        setConnectionStep(1); // Connecting...
        const t1 = setTimeout(() => {
            setConnectionStep(2); // Fail after 1.5s (Simulate realism)
        }, 1500);
        timersRef.current.push(t1);
    };

    const retryConnection = () => {
        clearAllTimers();
        setConnectionStep(3); // Reconnecting...
        const t1 = setTimeout(() => {
            setConnectionStep(4); // Success
        }, 1500);
        timersRef.current.push(t1);
    };

    // Reset when side changes
    useEffect(() => {
        setIsStreaming(false);
        setConnectionStep(0);
        clearAllTimers();
        setShowSegmentation(false);
    }, [activeSide]);

    // Auto-enable mask if AI result comes in
    useEffect(() => {
        if (aiResult && aiResult.ai_status === 'SUCCESS') {
            setShowSegmentation(true);
        }
    }, [aiResult]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => clearAllTimers();
    }, []);

    const handleCapture = () => {
        if (!isStreaming || connectionStep !== 4) return;
        const capturedImage = `https://placehold.co/800x600/1e293b/FFFFFF?text=${activeSide === 'left' ? 'Left' : 'Right'}+Ear+Capture`;
        onUpdate({ imageUrl: capturedImage, status: 'draft' });
        setIsStreaming(false);
        setConnectionStep(0);
        clearAllTimers();
    };

    // --- COMPLETE RESET HANDLER (BUG FIX) ---
    const handleDeleteImage = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (readOnly || isGenerating) return;
        if (!examData.imageUrl) return;

        const confirmMsg = lang === 'zh'
            ? '確定要移除此影像嗎？這將會一併重置此耳的診斷與標記，回復至「未檢查」狀態。'
            : 'Remove this image? This will reset diagnosis and findings, reverting to "Pending" status.';

        if (window.confirm(confirmMsg)) {
            // FIX: Explicitly send null for imageUrl to ensure it overrides any previous string value
            // Also reset findings and status to ensure consistency.
            onUpdate({
                imageUrl: null,
                segmentationData: [],
                detailedFindings: { EAC: [], TM: [] }, // Clear findings
                diagnosis: '', // Clear summary
                status: 'pending' // Reset status
            });

            // Clear local component state
            onAiResult(null);
            setShowSegmentation(false);

            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleImageUpload = (file: File) => {
        if (readOnly) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                onAiResult(null);
                setShowSegmentation(false);
                onUpdate({ imageUrl: ev.target.result as string, status: 'draft' });
                setIsStreaming(false);
                setConnectionStep(0);
                clearAllTimers();
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        reader.readAsDataURL(file);
    };

    const handleToggleStream = () => {
        if (readOnly) return;
        if (isStreaming) {
            setIsStreaming(false);
            setConnectionStep(0);
            clearAllTimers();
        } else {
            // If image exists, must delete first (enforced by disabled prop, but safety check here)
            if (examData.imageUrl) {
                return;
            }
            onAiResult(null);
            setShowSegmentation(false);
            setIsStreaming(true);
            startConnectionSequence();
        }
    };

    const handleAIDetect = async () => {
        if (readOnly || !examData.imageUrl) return;
        setIsGenerating(true);

        try {
            // Call real backend API
            // Note: analyzeEarImage(image, conf_thres, iou_thres)
            // We only pass image here, using default thresholds.
            // activeSide is not sent to backend for analysis (backend analyzes the image itself)
            const result = await analyzeEarImage(examData.imageUrl);

            // Map the API result structure to the UI structure expected by AIDiagnosisForm
            const uiResult = mapApiToUiResult(result, activeSide);

            // The backend returns the result, we need to pass it to the parent component
            onAiResult(uiResult);
        } catch (error) {
            console.error("AI Detection failed:", error);
            alert(lang === 'zh' ? "AI 檢測失敗，請檢查後端連線" : "AI Detection failed, please check backend connection");
            onAiResult(null);
        } finally {
            setIsGenerating(false);
        }
    };

    // Shared UI style
    const UIContainerStyle = "bg-white/80 dark:bg-black/60 backdrop-blur-xl p-1 rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl";
    const UIButtonActive = "bg-blue-600 text-white shadow-lg shadow-blue-500/30";
    const UIButtonIdle = "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200";

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-[#020617] relative group overflow-hidden">

            {/* 1. Main Viewport */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-[#020617]">

                {/* Floating Controls Layer */}
                <div className="absolute inset-0 pointer-events-none z-40">
                    <AnimatePresence>
                        {/* Top Left: Ear Switcher */}
                        {!isStreaming && (
                            <motion.div key="ear-switcher" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className={`absolute top-4 left-4 pointer-events-auto flex ${UIContainerStyle}`}>
                                <button
                                    onClick={() => onSwitchSide('left')}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${activeSide === 'left' ? UIButtonActive : UIButtonIdle}`}
                                >
                                    <Ear size={14} className="-scale-x-100" /> {t.leftEar}
                                </button>
                                <button
                                    onClick={() => onSwitchSide('right')}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${activeSide === 'right' ? UIButtonActive : UIButtonIdle}`}
                                >
                                    <Ear size={14} /> {t.rightEar}
                                </button>
                            </motion.div>
                        )}

                        {/* Top Right: Mask & Delete */}
                        {examData.imageUrl && (
                            <motion.div key="image-controls" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className={`absolute top-4 right-4 pointer-events-auto flex flex-row gap-2 ${UIContainerStyle}`}>
                                <ActionTooltip content={!aiResult ? t.notAnalyzed : (showSegmentation ? t.disableMask : t.enableMask)}>
                                    <button
                                        onClick={() => aiResult && setShowSegmentation(!showSegmentation)}
                                        disabled={!aiResult}
                                        className={`p-3 rounded-xl transition-all flex items-center justify-center disabled:opacity-100 ${!aiResult
                                            ? 'text-slate-400 cursor-not-allowed'
                                            : showSegmentation
                                                ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                : 'text-slate-400 hover:text-blue-500'
                                            }`}
                                    >
                                        <ScanEye size={18} />
                                    </button>
                                </ActionTooltip>

                                {/* DELETE BUTTON - Correctly configured */}
                                <ActionTooltip content={readOnly ? (lang === 'zh' ? '唯讀模式無法刪除' : 'Action disabled in Read-Only') : (isGenerating ? t.processing : t.deleteImage)}>
                                    <button
                                        onClick={handleDeleteImage}
                                        disabled={isGenerating || readOnly}
                                        className={`p-3 rounded-xl transition-all flex items-center justify-center disabled:opacity-100 ${(isGenerating || readOnly)
                                            ? 'text-slate-400 cursor-not-allowed opacity-50'
                                            : 'text-slate-400 hover:text-red-600 hover:bg-red-500/10'
                                            }`}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </ActionTooltip>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {examData.imageUrl ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-slate-50 dark:bg-black">
                        <img src={examData.imageUrl} alt="Exam" className="w-full h-full object-contain" />

                        {/* AI Mask Overlay */}
                        {showSegmentation && aiResult && (
                            <div className="absolute inset-0 pointer-events-none z-10 animate-in fade-in duration-500">
                                <svg viewBox="0 0 800 600" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                                    <path d="M 350 220 Q 450 170 550 220 T 600 350 T 450 420 T 250 350 T 350 220 Z"
                                        fill="rgba(239, 68, 68, 0.2)"
                                        stroke="rgba(239, 68, 68, 0.8)"
                                        strokeWidth="2"
                                        style={{ filter: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.6))' }}
                                    />
                                </svg>
                            </div>
                        )}
                        {/* Loading Overlay */}
                        {isGenerating && (
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
                                <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
                                <span className="text-white text-xs font-black uppercase tracking-widest">{t.processing}...</span>
                            </div>
                        )}
                    </div>
                ) : isStreaming ? (
                    // Solid black background for streaming
                    <div className="absolute inset-0 w-full h-full z-20 flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'black' }}>

                        {/* Step 1 & 3: Connecting */}
                        {(connectionStep === 1 || connectionStep === 3) && (
                            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                                <Loader2 size={48} className="text-yellow-500 animate-spin" />
                                <span className="text-yellow-500 font-black uppercase tracking-[0.2em] text-xs">
                                    {lang === 'zh' ? '正在建立安全連線...' : 'Establishing Secure Connection...'}
                                </span>
                            </div>
                        )}

                        {/* Step 2: Failed */}
                        {connectionStep === 2 && (
                            <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300 z-50">
                                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center border-2 border-red-500 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                                    <WifiOff size={32} />
                                </div>
                                <div className="text-center space-y-1">
                                    <h3 className="text-red-500 font-black uppercase tracking-widest text-sm">{lang === 'zh' ? '連線失敗' : 'Connection Failed'}</h3>
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{lang === 'zh' ? '無法連接至耳鏡裝置' : 'Unable to reach otoscope device'}</p>
                                </div>
                                <button onClick={retryConnection} className="group relative px-8 py-3 bg-white text-slate-900 rounded-full font-black text-xs uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-3">
                                    <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                                    {lang === 'zh' ? '重試連線' : 'Retry Connection'}
                                </button>
                            </div>
                        )}

                        {/* Step 4: Live Viewfinder */}
                        {connectionStep === 4 && (
                            <>
                                <div className="absolute top-6 left-6 flex items-center gap-2 z-30">
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>
                                    <span className="text-green-500 text-[10px] font-black uppercase tracking-[0.2em] drop-shadow-md">LIVE SIGNAL</span>
                                </div>
                                <div className="absolute inset-0 border-[40px] border-black/30 pointer-events-none rounded-[3rem]"></div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] border border-white/10 rounded-[2rem]"></div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-white/20">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-white/30"></div>
                                    <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-[1px] bg-white/30"></div>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500 gap-6">
                        <div className="w-24 h-24 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
                            <Camera size={32} className="opacity-30 text-slate-400" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{t.waitingForImage}</p>
                    </div>
                )}
            </div>

            {/* 3. Bottom Controls Toolbar */}
            <div className="h-20 bg-white dark:bg-[#0b1120] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-30 relative">

                {/* Left Controls */}
                <div className="flex items-center gap-2">
                    <ActionTooltip side="top" content={isStreaming ? t.stopCamera : (examData.imageUrl ? (lang === 'zh' ? '請先移除影像' : 'Remove image first') : t.startCamera)}>
                        <button
                            onClick={handleToggleStream}
                            disabled={readOnly || !!examData.imageUrl}
                            className={`p-3 rounded-2xl transition-all ${isStreaming
                                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                : !!examData.imageUrl
                                    ? 'bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-60'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            {isStreaming ? <VideoOff size={20} /> : <Video size={20} />}
                        </button>
                    </ActionTooltip>

                    <ActionTooltip side="top" content={!!examData.imageUrl ? (lang === 'zh' ? '請先移除影像' : 'Remove image first') : t.uploadImage}>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={readOnly || isStreaming || !!examData.imageUrl}
                            className={`p-3 rounded-2xl transition-all ${(isStreaming || !!examData.imageUrl)
                                ? 'bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-60'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            <CloudUpload size={20} />
                        </button>
                    </ActionTooltip>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                </div>

                {/* Center Control: Capture Button (Prominent Shutter) */}
                {isStreaming && connectionStep === 4 && (
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60]">
                        <ActionTooltip side="top" content="Capture">
                            <button
                                onClick={handleCapture}
                                className="relative group transition-transform active:scale-95"
                            >
                                <div className="w-16 h-16 rounded-full border-4 border-slate-200 dark:border-slate-700 flex items-center justify-center bg-white dark:bg-[#0b1120] shadow-lg">
                                    <div className="w-12 h-12 bg-red-500 rounded-full group-hover:bg-red-600 transition-colors shadow-inner" />
                                </div>
                            </button>
                        </ActionTooltip>
                    </div>
                )}

                {/* Right Controls: AI */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleAIDetect}
                        disabled={isGenerating || readOnly || !examData.imageUrl}
                        className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Sparkles size={16} /> <span className="hidden sm:inline">{t.aiDetect}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

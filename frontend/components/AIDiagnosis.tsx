
import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { 
  Upload, Send, 
  Cpu, X, BrainCircuit, 
  FileText, 
  MoreVertical, MessageSquarePlus, AlertTriangle, Download, Square,
  Ear, Bot, Loader2, Trash2, ScanEye,
  Video, CloudUpload, Sparkles, Camera, VideoOff, CircleDot, Circle, WifiOff, RefreshCw, Power
} from 'lucide-react';
import { chatWithMedicalAssistant, generateMedicalReport } from '../services/geminiService';
import { analyzeEarImage } from '../services/apiService';
import { Language, User } from '../types';
import { translations, getDiseaseDisplayName } from '../services/translations';
import { motion, AnimatePresence } from 'framer-motion';

// --- Interfaces ---

interface ChatMessage { 
    id: string; 
    role: 'user' | 'ai'; 
    text: string | ReactNode | null; 
    type: 'text' | 'report-file' | 'error'; 
    fileData?: { blob: Blob; name: string; url: string; }; 
}

interface AIDiagnosisProps {
  lang: Language;
  user: User;
}

// --- Constants ---

const DISEASE_KEYS = [
  "Eardrum perforation", "Atrophic scar", "Middle ear effusion", "Middle ear tumor", 
  "Retraction", "Tympanosclerosis", "Ventilation tube", "Otitis media", 
  "Tympanoplasty", "Myringitis", "Normal", "Atresia", "Blood clot", 
  "Cerumen", "Foreign body", "Otitis externa", "Otomycosis", "EAC tumor"
];

// --- Helper Components ---

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
                <div 
                    className={`fixed z-[9999] -translate-x-1/2 px-2 pointer-events-none ${side === 'top' ? '-translate-y-full' : ''}`} 
                    style={{ top: coords.top, left: coords.left }}
                >
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

const QuotaErrorCard = ({ lang }: { lang: Language }) => {
    const t = (translations[lang] as any);
    return (
        <div className="bg-red-50 dark:bg-red-900/10 border-l-4 border-red-50 p-4 space-y-2 rounded-r-lg">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle size={18} />
                <h4 className="font-black uppercase tracking-widest text-xs">{t.quotaExceeded}</h4>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                {t.quotaExceededSub}
            </p>
        </div>
    );
};

const DocxReportCard = ({ fileData, lang }: { fileData: { blob: Blob, name: string, url: string }, lang: Language }) => {
    return (
        <div className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
            <div className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center shrink-0">
                    <FileText size={20} />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate mb-0.5">
                        {fileData.name}
                    </h4>
                    <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                         <span>DOCX</span>
                         <span className="w-0.5 h-0.5 bg-slate-400 rounded-full" />
                         <span>{(fileData.blob.size / 1024).toFixed(1)} KB</span>
                    </div>
                </div>
                <a href={fileData.url} download={fileData.name} className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    <Download size={18} />
                </a>
            </div>
        </div>
    );
};

// --- Main Component ---

export const AIDiagnosis: React.FC<AIDiagnosisProps> = ({ lang, user }) => {
  const t = (translations[lang] as any);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    label: string;
    conf: number;
    class_name_en?: string;
    class_name_zh?: string;
    category?: 'EAC' | 'TM' | 'NORMAL' | 'UNKNOWN';
    normalized_class?: string;
  } | null>(null);
  const [fullAnalysisData, setFullAnalysisData] = useState<any>(null);
  const [earSide, setEarSide] = useState<'Left' | 'Right'>('Left');
  const [showMask, setShowMask] = useState(false);
  const [segmentationData, setSegmentationData] = useState<Array<{mask?: number[][], maskMatrix?: number[][], color: {r: number, g: number, b: number}, bbox?: number[] | null, class_name?: string}>>([]);
  const [imageSize, setImageSize] = useState<{width: number, height: number} | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isReportGenerating, setIsReportGenerating] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  
  // Computed state for busy actions
  const isBusy = isAnalyzing || isTyping || isReportGenerating;
  
  // Connection State Steps:
  // 0: Off/Idle
  // 1: Connecting (Yellow)
  // 2: Failed (Red + Button)
  // 3: Reconnecting (Yellow)
  // 4: Connected (Green/Live)
  const [connectionStep, setConnectionStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const menuRef = useRef<HTMLDivElement>(null); 
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Clear timers utility
  const clearAllTimers = () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
  };

  // Start the "Fail First" Sequence
  const startConnectionSequence = () => {
      clearAllTimers();
      setConnectionStep(1); // Connecting...

      const t1 = setTimeout(() => {
          setConnectionStep(2); // Fail after 2s
      }, 2000);

      timersRef.current.push(t1);
  };

  // Start the "Retry -> Success" Sequence
  const retryConnection = () => {
      clearAllTimers();
      setConnectionStep(3); // Reconnecting...

      const t1 = setTimeout(() => {
          setConnectionStep(4); // Success after 1.5s
      }, 1500);

      timersRef.current.push(t1);
  };

  // 不再自動啟動耳鏡連接
  useEffect(() => {
      return () => clearAllTimers();
  }, []);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const getWelcomeMsg = (currentLang: Language) => (
    <div className="space-y-1">
      <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
        {currentLang === 'zh' ? '醫生您好，我是您的 AI 臨床助理。' : 'Hello Doctor, I am your AI Clinical Assistant.'}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {currentLang === 'zh' ? '您可以上傳耳鏡影像進行即時分析，或直接與我對話。' : 'Upload otoscopy images for real-time analysis or chat with me.'}
      </div>
    </div>
  );

  const [messages, setMessages] = useState<ChatMessage[]>([{ id: '1', role: 'ai', text: getWelcomeMsg(lang), type: 'text' }]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMoreMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { 
      setMessages(prev => {
          if (prev.length === 1 && prev[0].id === '1') return [{ ...prev[0], text: getWelcomeMsg(lang) }];
          return prev;
      }); 
  }, [lang]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping, isReportGenerating]);

  const addMessage = (role: 'user' | 'ai', text: any, type: 'text' | 'report-file' | 'error' = 'text', fileData?: any) => { 
    setMessages(prev => [...prev, { id: Date.now().toString(), role, text, type, fileData }]); 
  };

  const handleSendMessage = async () => {
    if (isReportGenerating || isTyping || !inputValue.trim()) return;
    const userMsg = inputValue; setInputValue(''); addMessage('user', userMsg); setIsTyping(true);
    const controller = new AbortController(); abortControllerRef.current = controller;
    try {
      const diagnosisContext = analysisResult 
        ? `Diagnosis: ${analysisResult.class_name_en || analysisResult.label}, Side: ${earSide}`
        : "";
      const aiResponse = await chatWithMedicalAssistant(userMsg, [], diagnosisContext, controller.signal);
      if (!controller.signal.aborted) {
          if (aiResponse === "ERROR_CODE_429") addMessage('ai', null, 'error');
          else addMessage('ai', aiResponse);
      }
    } finally { setIsTyping(false); }
  };

  const handleQuickConsult = async () => {
    if (!analysisResult || isTyping || isReportGenerating) return;
    const displayLabel = getDiseaseDisplayName(analysisResult.class_name_en || analysisResult.label, lang);
    const sideLabel = earSide === 'Left' ? t.leftEar : t.rightEar;
    addMessage('user', lang === 'zh' 
        ? `針對${sideLabel}「${displayLabel}」的臨床諮詢` 
        : `Clinical consultation regarding ${earSide} Ear "${analysisResult.class_name_en || analysisResult.label}"`);
    setIsTyping(true);
    const controller = new AbortController(); abortControllerRef.current = controller;
    try {
      const diagnosisInfo = analysisResult.class_name_en 
          ? `${analysisResult.class_name_en} (${analysisResult.class_name_zh || ''}) [Category: ${analysisResult.category || 'UNKNOWN'}]`
          : `${analysisResult.label}`;
      const aiResponse = await chatWithMedicalAssistant(
          `${t.consultAI} ${analysisResult.class_name_en || analysisResult.label} (${earSide} Ear)`, 
          [], 
          `Diagnosis: ${diagnosisInfo}, Side: ${earSide}`, 
          controller.signal
      );
      if (!controller.signal.aborted) {
          if (aiResponse === "ERROR_CODE_429") addMessage('ai', null, 'error');
          else addMessage('ai', aiResponse);
      }
    } finally { setIsTyping(false); }
  };

  const handleGenerateReport = async () => {
    if (!analysisResult || isTyping || isReportGenerating) return;
    setIsMoreMenuOpen(false); 
    addMessage('user', t.generateReportRequest); 
    setIsReportGenerating(true); 
    const controller = new AbortController(); abortControllerRef.current = controller;
    try {
      const patientData: any = {
        id: "GUEST-001", 
        name: "Guest Patient", 
        age: 0, 
        gender: "Unspecified",
        visitDate: new Date().toISOString().split('T')[0], 
        diagnosis: `${earSide} Ear: ${analysisResult.class_name_en || analysisResult.label}`,
        notes: "Automated analysis.",
        diagnosis_zh: analysisResult.class_name_zh,
        diagnosis_en: analysisResult.class_name_en || analysisResult.label,
        diagnosis_category: analysisResult.category,
        normalized_class: analysisResult.normalized_class,
        earSide: earSide
      };
      
      if (fullAnalysisData) {
        patientData.eac_detections = fullAnalysisData.eac_detections || [];
        patientData.tm_detections = fullAnalysisData.tm_detections || [];
        patientData.summary = fullAnalysisData.summary || {};
      }
      
      const response = await generateMedicalReport(patientData, controller.signal);
      if (!controller.signal.aborted) {
         if (response === "ERROR_CODE_429" || response === "ERROR_CODE_TIMEOUT" || response === "ERROR_CODE_GENERIC") {
            addMessage('ai', null, 'error');
         } else if (typeof response === 'string' && response.startsWith('REPORT_DOWNLOAD:')) {
            try {
              const reportInfoJson = response.replace('REPORT_DOWNLOAD:', '');
              const reportInfo = JSON.parse(reportInfoJson);
              const { downloadReport } = await import('../services/apiService');
              const blob = await downloadReport(reportInfo.reportId);
              const url = URL.createObjectURL(blob);
              const fileName = reportInfo.fileName || `Clinical_Report_GUEST-${reportInfo.patientRecordId || reportInfo.patientId || Date.now()}.docx`;
              addMessage('ai', null, 'report-file', { blob, name: fileName, url });
            } catch (downloadError) {
              console.error('下載報告失敗:', downloadError);
              addMessage('ai', lang === 'zh' ? '報告生成成功，但下載失敗。請稍後再試。' : 'Report generated but download failed. Please try again.');
            }
         } else {
             // 處理其他類型的響應（包括可能的 Blob）
             const nonNullResponse = response;
             if (nonNullResponse !== null && typeof nonNullResponse === 'object' && nonNullResponse.constructor === Blob) {
               const blobResponse = nonNullResponse as unknown as Blob;
               const url = URL.createObjectURL(blobResponse);
               addMessage('ai', null, 'report-file', { blob: blobResponse, name: `Clinical_Report_${Date.now()}.docx`, url });
             } else {
               addMessage('ai', response);
             }
         }
      }
    } catch (err: any) { 
      console.error('報告生成錯誤:', err);
      addMessage('ai', err?.message || t.systemError); 
    } finally { 
      setIsReportGenerating(false); 
    }
  };

  const handleClearImage = () => { 
      if (isReportGenerating || isTyping) {
          handleStop();
          setIsReportGenerating(false);
          setIsTyping(false);
      }
      // 釋放之前創建的 Object URL
      if (selectedImage && selectedImage.startsWith('blob:')) {
          URL.revokeObjectURL(selectedImage);
      }
      setSelectedImage(null);
      setSelectedFile(null);
      setAnalysisResult(null);
      setShowMask(false);
      setSegmentationData([]);
      setFullAnalysisData(null);
      setImageSize(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
      if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
      }
  };

  const handleResetChat = () => { setIsMoreMenuOpen(false); setMessages([{ id: '1', role: 'ai', text: getWelcomeMsg(lang), type: 'text' }]); };
  
  const handleImageUpload = (file: File) => {
      if (isStreaming) {
          setIsStreaming(false);
          setConnectionStep(0);
          clearAllTimers();
      }
      setSelectedFile(file);
      setAnalysisResult(null); 
      setShowMask(false);
      setSegmentationData([]);
      setFullAnalysisData(null);

      const r = new FileReader();
      r.onload = (ev) => { 
          setSelectedImage(ev.target?.result as string); 
          if (fileInputRef.current) {
              fileInputRef.current.value = '';
          }
      };
      r.readAsDataURL(file);
  };

  const handleCapture = async () => {
      // 創建一個簡單的測試圖片（實際應用中應該從攝像頭獲取真實圖片）
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          // 繪製一個簡單的測試圖像
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, 0, 800, 600);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`${earSide} Ear Capture`, 400, 300);
      }
      
      // 將 canvas 轉換為 Blob，然後轉換為 File
      canvas.toBlob((blob) => {
          if (blob) {
              const file = new File([blob], `capture_${earSide}_${Date.now()}.jpg`, { type: 'image/jpeg' });
              const imageUrl = URL.createObjectURL(blob);
              
              setSelectedFile(file);
              setSelectedImage(imageUrl);
              setAnalysisResult(null);
              setShowMask(false);
              setSegmentationData([]);
              setFullAnalysisData(null);
              setIsStreaming(false);
              setConnectionStep(0);
              clearAllTimers();
          }
      }, 'image/jpeg', 0.95);
  };

  const handleStopStream = () => {
    setIsStreaming(false);
    setConnectionStep(0); // Go to Idle
    clearAllTimers();
  };

  const handleToggleStream = () => {
    if (isStreaming) {
        handleStopStream();
    } else {
        setSelectedImage(null);
        setSelectedFile(null);
        setAnalysisResult(null);
        setShowMask(false);
        setSegmentationData([]);
        setFullAnalysisData(null);
        setIsStreaming(true);
        startConnectionSequence();
    }
  };

  // 生成遮罩顏色（RGB 格式，用於半透明遮罩疊加）
  // 使用淡藍紫色作為主要遮罩顏色（符合圖片中的樣式）
  const getMaskColor = (index: number) => {
    const colors = [
      { r: 147, g: 197, b: 253 },   // 淡藍色 (light blue) - 主要顏色
      { r: 165, g: 180, b: 252 },  // 淡藍紫色 (light blue-purple)
      { r: 196, g: 181, b: 253 },   // 淡紫色 (light purple)
      { r: 129, g: 140, b: 248 },  // 中等藍紫色
      { r: 167, g: 139, b: 250 },  // 淡紫藍色
      { r: 139, g: 92, b: 246 },   // 較深的紫色（備用）
    ];
    return colors[index % colors.length];
  };


  // 繪製遮罩到 Canvas（像素填充方式，參考先前 YOLOv7-seg 的實現）
  const drawMasksToCanvas = React.useCallback((masks: Array<{mask?: number[][], maskMatrix?: number[][], color: {r: number, g: number, b: number}, bbox?: number[] | null, class_name?: string}>) => {
    if (!canvasRef.current || !imageRef.current || !imageSize) {
      console.log('[遮罩繪製] 缺少必要元素:', { canvas: !!canvasRef.current, image: !!imageRef.current, imageSize });
      return;
    }
    
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      console.log('[遮罩繪製] 無法獲取 Canvas 上下文');
      return;
    }
    
    const rect = img.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.log('[遮罩繪製] 圖像尺寸為 0');
      return;
    }
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    // 啟用抗鋸齒，使遮罩邊緣更平滑
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // 設置混合模式為 source-over（默認），確保半透明疊加效果
    // 這允許 alpha 通道正確混合，創造半透明效果
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0; // 確保 alpha 值不被全局設置覆蓋
    
    // 清除 canvas（確保透明背景）
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    // 計算圖像實際顯示尺寸（考慮 object-contain）
    const imgAspect = imageSize.width / imageSize.height;
    const containerAspect = rect.width / rect.height;
    
    let displayWidth = rect.width;
    let displayHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;
    
    if (imgAspect > containerAspect) {
      displayHeight = rect.width / imgAspect;
      offsetY = (rect.height - displayHeight) / 2;
    } else {
      displayWidth = rect.height * imgAspect;
      offsetX = (rect.width - displayWidth) / 2;
    }
    
    const scaleX = displayWidth / imageSize.width;
    const scaleY = displayHeight / imageSize.height;
    
    console.log('[遮罩繪製] 開始繪製:', {
      masksCount: masks.length,
      imageSize,
      displaySize: { displayWidth, displayHeight },
      offset: { offsetX, offsetY },
      scale: { scaleX, scaleY }
    });
    
    // 參考 YOLOv7-seg 的標註方式：只繪製輪廓，外圍實體線，中間可選填充
    const fillAlpha = 0.0; // 中間部分：0 = 完全不填充（最絲滑，不遮擋），> 0 = 輕微填充提示
    const strokeAlpha = 1.0; // 輪廓線完全不透明，實體線
    const strokeWidth = Math.max(3, Math.max(scaleX, scaleY) * 2.0); // 輪廓線寬度，根據縮放調整，加粗以確保清晰
    
    masks.forEach((seg, index) => {
      const color = seg.color || getMaskColor(index);
      // 中間填充顏色（高透明度）
      const fillColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${fillAlpha})`;
      // 輪廓線顏色（實體，不透明）
      const strokeColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${strokeAlpha})`;
      
      // 如果有 maskMatrix，提取輪廓並繪製
      if (seg.maskMatrix && seg.maskMatrix.length > 0) {
        const maskMatrix = seg.maskMatrix;
        const maskHeight = maskMatrix.length;
        const maskWidth = maskMatrix[0]?.length || 0;
        
        if (maskWidth === 0 || maskHeight === 0) return;
        
        // 中間填充：使用極低透明度，或者完全移除（根據需要）
        // 為了更絲滑的效果，可以選擇完全不填充，只保留輪廓
        // 如果需要輕微的填充提示，使用極低透明度
        if (fillAlpha > 0) {
          // 使用 ImageData 和 putImageData 來實現更平滑的填充
          // 但為了性能，我們使用簡化的方法
          ctx.fillStyle = fillColor;
          ctx.globalCompositeOperation = 'source-over';
          
          // 批量繪製，減少繪製次數，提高性能和平滑度
          const batchSize = Math.max(10, Math.floor(maskWidth / 20));
          for (let y = 0; y < maskHeight; y += batchSize) {
            for (let x = 0; x < maskWidth; x += batchSize) {
              // 檢查這個批次區域是否有 mask
              let hasMask = false;
              for (let dy = 0; dy < batchSize && y + dy < maskHeight; dy++) {
                for (let dx = 0; dx < batchSize && x + dx < maskWidth; dx++) {
                  if (maskMatrix[y + dy] && maskMatrix[y + dy][x + dx] > 0) {
                    hasMask = true;
                    break;
                  }
                }
                if (hasMask) break;
              }
              
              if (hasMask) {
                const canvasX = offsetX + x * scaleX;
                const canvasY = offsetY + y * scaleY;
                const batchW = Math.min(batchSize * scaleX, (maskWidth - x) * scaleX);
                const batchH = Math.min(batchSize * scaleY, (maskHeight - y) * scaleY);
                
                if (canvasX >= 0 && canvasX < rect.width && canvasY >= 0 && canvasY < rect.height) {
                  ctx.fillRect(canvasX, canvasY, batchW, batchH);
                }
              }
            }
          }
        }
        
        // 提取並繪製輪廓線（參考 YOLOv7-seg：只繪製輪廓，實體線）
        // 使用連續的輪廓線，而不是點，更平滑
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';
        
        // 收集所有邊緣像素
        const edgePoints: Array<{x: number, y: number}> = [];
        
        for (let y = 0; y < maskHeight; y++) {
          for (let x = 0; x < maskWidth; x++) {
            if (maskMatrix[y] && maskMatrix[y][x] > 0) {
              // 檢查是否為邊緣像素（4 鄰域檢查）
              const isEdge = 
                (y === 0 || !maskMatrix[y - 1] || !maskMatrix[y - 1][x] || maskMatrix[y - 1][x] === 0) ||
                (y === maskHeight - 1 || !maskMatrix[y + 1] || !maskMatrix[y + 1][x] || maskMatrix[y + 1][x] === 0) ||
                (x === 0 || !maskMatrix[y][x - 1] || maskMatrix[y][x - 1] === 0) ||
                (x === maskWidth - 1 || !maskMatrix[y][x + 1] || maskMatrix[y][x + 1] === 0);
              
              if (isEdge) {
                edgePoints.push({
                  x: offsetX + x * scaleX + scaleX * 0.5,
                  y: offsetY + y * scaleY + scaleY * 0.5
                });
              }
            }
          }
        }
        
        // 繪製連續的輪廓線（使用路徑連接邊緣點，形成平滑的輪廓）
        if (edgePoints.length > 2) {
          // 方法1：直接繪製所有邊緣點（最簡單，確保完整）
          // 使用較大的點，形成連續的輪廓線效果
          ctx.fillStyle = strokeColor;
          const pointRadius = Math.max(2, strokeWidth * 0.6); // 稍微增大點半徑，確保輪廓清晰
          
          // 優化：批量繪製圓形，減少 beginPath 調用
          for (const point of edgePoints) {
            if (point.x >= 0 && point.x < rect.width && point.y >= 0 && point.y < rect.height) {
              ctx.beginPath();
              ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          
          // 方法2：嘗試連接相鄰的邊緣點，形成連續線條（可選，提高平滑度）
          // 如果邊緣點較多，使用路徑連接
          if (edgePoints.length > 20) {
            // 按距離連接最近的點
            const connectedPoints: Array<{x: number, y: number}> = [];
            const used = new Set<number>();
            
            // 找到起始點（最左上的點）
            let startIdx = 0;
            let minDist = Infinity;
            for (let i = 0; i < edgePoints.length; i++) {
              const dist = edgePoints[i].x + edgePoints[i].y;
              if (dist < minDist) {
                minDist = dist;
                startIdx = i;
              }
            }
            
            connectedPoints.push(edgePoints[startIdx]);
            used.add(startIdx);
            
            // 貪心算法：每次找最近的未使用點
            let currentIdx = startIdx;
            while (connectedPoints.length < edgePoints.length && used.size < edgePoints.length) {
              let nearestIdx = -1;
              let nearestDist = Infinity;
              
              for (let i = 0; i < edgePoints.length; i++) {
                if (used.has(i)) continue;
                const dx = edgePoints[i].x - edgePoints[currentIdx].x;
                const dy = edgePoints[i].y - edgePoints[currentIdx].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < nearestDist && dist < strokeWidth * 3) { // 只連接附近的點
                  nearestDist = dist;
                  nearestIdx = i;
                }
              }
              
              if (nearestIdx >= 0) {
                connectedPoints.push(edgePoints[nearestIdx]);
                used.add(nearestIdx);
                currentIdx = nearestIdx;
              } else {
                break; // 沒有更多可連接的點
              }
            }
            
            // 如果成功連接了足夠的點，繪製連續線條
            if (connectedPoints.length > 10) {
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = strokeWidth;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.beginPath();
              ctx.moveTo(connectedPoints[0].x, connectedPoints[0].y);
              
              // 簡化點集
              const step = Math.max(1, Math.floor(connectedPoints.length / 150));
              for (let i = step; i < connectedPoints.length; i += step) {
                ctx.lineTo(connectedPoints[i].x, connectedPoints[i].y);
              }
              
              // 嘗試閉合
              if (connectedPoints.length > 2) {
                ctx.closePath();
              }
              ctx.stroke();
            }
          }
        }
      } else if (seg.bbox && seg.bbox.length >= 4) {
        // 使用 bbox 作為後備（只繪製邊框）
        const [x1, y1, x2, y2] = seg.bbox;
        const bboxX = offsetX + x1 * scaleX;
        const bboxY = offsetY + y1 * scaleY;
        const bboxW = (x2 - x1) * scaleX;
        const bboxH = (y2 - y1) * scaleY;
        
        // 可選：繪製高透明度的中間填充
        if (fillAlpha > 0) {
          ctx.fillStyle = fillColor;
          ctx.fillRect(bboxX, bboxY, bboxW, bboxH);
        }
        
        // 繪製實體輪廓線
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeRect(bboxX, bboxY, bboxW, bboxH);
      }
    });
    
    console.log('[遮罩繪製] 完成');
  }, [imageSize]);

  // 當遮罩數據或顯示狀態改變時，重新繪製遮罩
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current) return;
    
    if (showMask && segmentationData.length > 0 && imageSize) {
      // 使用 setTimeout 確保圖像已渲染
      const timer = setTimeout(() => {
        drawMasksToCanvas(segmentationData);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // 清除 canvas
      const ctx = canvasRef.current.getContext('2d', { alpha: true });
      if (ctx && imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const dpr = window.devicePixelRatio || 1;
          canvasRef.current.width = rect.width * dpr;
          canvasRef.current.height = rect.height * dpr;
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, rect.width, rect.height);
        }
      }
    }
  }, [showMask, segmentationData, imageSize, drawMasksToCanvas]);

  const UIContainerStyle = "bg-white/80 dark:bg-black/60 backdrop-blur-xl p-1 rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl";
  const UIButtonActive = "bg-blue-600 text-white shadow-lg shadow-blue-500/30";
  const UIButtonIdle = "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200";

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#020617] overflow-hidden">
        <div className="h-20 bg-white dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 md:px-10 shrink-0 z-30 transition-colors">
            <div className="flex items-center">
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase whitespace-nowrap">{t.aiDiagnosis}</h1>
                <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-4 shrink-0"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">{t.aiDiagnosisSub}</p>
            </div>
            <div className="flex items-center gap-3">
                 {/* Connection Status Badge REMOVED */}
            </div>
        </div>

        <div className="flex-1 flex min-h-0">
            <div className="flex-[3] flex flex-col bg-slate-50 dark:bg-[#020617] relative border-r border-slate-200 dark:border-slate-800">
                <div className={`flex-1 relative flex items-center justify-center overflow-hidden group bg-slate-50 dark:bg-[#020617]`}>
                     <div className="absolute inset-0 pointer-events-none z-40">
                        <AnimatePresence>
                            {/* Ear Switcher (Top Left) */}
                            {!isStreaming && (
                                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className={`absolute top-4 left-4 pointer-events-auto flex ${UIContainerStyle}`}>
                                    <button onClick={() => setEarSide('Left')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${earSide === 'Left' ? UIButtonActive : UIButtonIdle}`}>
                                        <Ear size={14} className="-scale-x-100" /> {t.leftEar}
                                    </button>
                                    <button onClick={() => setEarSide('Right')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${earSide === 'Right' ? UIButtonActive : UIButtonIdle}`}>
                                        <Ear size={14} /> {t.rightEar}
                                    </button>
                                </motion.div>
                            )}

                            {/* Mask & Delete Buttons (Top Right Overlay - RESTORED) */}
                            {selectedImage && (
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className={`absolute top-4 right-4 pointer-events-auto flex flex-row gap-2 ${UIContainerStyle}`}>
                                    <ActionTooltip content={!analysisResult ? t.notAnalyzed : (showMask ? t.disableMask : t.enableMask)}>
                                        <button 
                                            onClick={() => analysisResult && setShowMask(!showMask)}
                                            disabled={!analysisResult}
                                            className={`p-3 rounded-xl transition-all flex items-center justify-center disabled:opacity-100 ${
                                                !analysisResult 
                                                    ? 'text-slate-400 cursor-not-allowed' // Match color of delete button, force opacity
                                                    : showMask 
                                                        ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                                        : 'text-slate-400 hover:text-blue-500'
                                            }`}
                                        >
                                            <ScanEye size={18} />
                                        </button>
                                    </ActionTooltip>
                                    <ActionTooltip content={isBusy ? t.processing : t.deleteImage}>
                                        <button 
                                            onClick={handleClearImage} 
                                            disabled={isBusy}
                                            className={`p-3 rounded-xl transition-all flex items-center justify-center ${
                                                isBusy 
                                                ? 'text-slate-400 cursor-not-allowed opacity-50' 
                                                : 'text-slate-400 hover:text-red-500 hover:bg-red-500/10'
                                            }`}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </ActionTooltip>
                                </motion.div>
                            )}
                        </AnimatePresence>
                     </div>

                     {selectedImage ? (
                        <div className="relative w-full h-full bg-slate-50 dark:bg-black flex items-center justify-center overflow-hidden">
                            <img 
                                ref={imageRef}
                                src={selectedImage} 
                                alt="Otoscopy" 
                                className="w-full h-full object-contain"
                                onLoad={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                                        setImageSize({
                                            width: img.naturalWidth,
                                            height: img.naturalHeight
                                        });
                                    }
                                }}
                            />
                            {/* Canvas 用於繪製遮罩疊加層（半透明藍紫色疊加，符合圖片樣式） */}
                            <canvas
                                ref={canvasRef}
                                className="absolute pointer-events-none"
                                style={{ 
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    zIndex: 10,
                                    mixBlendMode: 'normal' // 確保正常疊加模式
                                }}
                            />
                            {isAnalyzing && (
                                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
                                    <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
                                    <span className="text-white text-xs font-black uppercase tracking-widest">{t.processing}...</span>
                                </div>
                            )}
                        </div>
                     ) : isStreaming ? (
                        // Force solid black background with absolute full coverage z-50 to hide ALL scratches/borders
                        <div className="absolute inset-0 w-full h-full z-50 flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'black' }}>
                            
                            {/* Step 1 & 3: Connecting */}
                            {(connectionStep === 1 || connectionStep === 3) && (
                                <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                                    <Loader2 size={48} className="text-yellow-500 animate-spin" />
                                    <span className="text-yellow-500 font-black uppercase tracking-[0.2em] text-xs">
                                        {lang === 'zh' ? '正在建立安全連線...' : 'Establishing Secure Connection...'}
                                    </span>
                                </div>
                            )}

                            {/* Step 2: Connection Failed -> Retry Button */}
                            {connectionStep === 2 && (
                                <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300 z-50">
                                    <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center border-2 border-red-500 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                                        <WifiOff size={32} />
                                    </div>
                                    <div className="text-center space-y-1">
                                        <h3 className="text-red-500 font-black uppercase tracking-widest text-sm">
                                            {lang === 'zh' ? '連線失敗' : 'Connection Failed'}
                                        </h3>
                                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                            {lang === 'zh' ? '無法連接至耳鏡裝置' : 'Unable to reach otoscope device'}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={retryConnection}
                                        className="group relative px-8 py-3 bg-white text-slate-900 rounded-full font-black text-xs uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] flex items-center gap-3"
                                    >
                                        <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                                        {lang === 'zh' ? '重試連線' : 'Retry Connection'}
                                    </button>
                                </div>
                            )}

                            {/* Step 4: Live Connected - GREEN SIGNAL */}
                            {connectionStep === 4 && (
                                <>
                                    {/* Green LIVE indicator */}
                                    <div className="absolute top-6 left-6 flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>
                                        <span className="text-green-500 text-[10px] font-black uppercase tracking-[0.2em] drop-shadow-md">LIVE SIGNAL</span>
                                    </div>
                                    
                                    {/* Simulated Viewfinder overlay to make it look "Real" */}
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
                        <div className="flex flex-col items-center justify-center text-slate-500 gap-4">
                           <div className="w-24 h-24 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
                                <Camera size={32} className="opacity-50 text-slate-400" />
                           </div>
                           <span className="text-xs font-black uppercase tracking-widest text-slate-400 opacity-60">{t.waitingForImage}</span>
                        </div>
                     )}
                </div>

                <div className="h-16 bg-white dark:bg-[#0b1120] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 relative">
                    
                    {/* Left Controls: Stream & Upload */}
                    <div className="flex items-center gap-2">
                        <ActionTooltip side="top" content={isStreaming ? t.stopCamera : (selectedImage ? (lang === 'zh' ? '請先移除影像' : 'Remove image first') : t.startCamera)}>
                            <button 
                                onClick={handleToggleStream}
                                disabled={!!selectedImage}
                                className={`p-3 rounded-2xl transition-all ${
                                    isStreaming 
                                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' 
                                    : !!selectedImage
                                        ? 'bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-60'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                {isStreaming ? <VideoOff size={20} /> : <Video size={20} />}
                            </button>
                        </ActionTooltip>
                        
                        <ActionTooltip side="top" content={!!selectedImage ? (lang === 'zh' ? '請先移除影像' : 'Remove image first') : t.uploadImage}>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isStreaming || !!selectedImage} // Disabled when streaming or image exists
                                className={`p-3 rounded-2xl transition-all ${
                                    (isStreaming || !!selectedImage)
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
                                    <div className="w-12 h-12 rounded-full border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center bg-white dark:bg-[#0b1120] shadow-lg">
                                        <div className="w-8 h-8 bg-red-500 rounded-full group-hover:bg-red-600 transition-colors shadow-inner" />
                                    </div>
                                </button>
                            </ActionTooltip>
                        </div>
                    )}

                    {/* Right Controls: Analysis & Diagnosis Info */}
                    <div className="flex items-center gap-6">
                         {analysisResult && (
                             <div className="flex flex-col justify-center min-w-[120px] text-right">
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5">{t.diagnosisLabel}</span>
                                <div className="flex items-center justify-end gap-3 flex-wrap">
                                     <span className="text-base font-black text-slate-800 dark:text-white leading-tight break-words max-w-[300px]" title={
                                         lang === 'zh' 
                                             ? `${analysisResult.class_name_zh || analysisResult.label}(${analysisResult.class_name_en || analysisResult.label})`
                                             : (analysisResult.class_name_en || analysisResult.label)
                                     }>
                                         {lang === 'zh' 
                                             ? `${analysisResult.class_name_zh || analysisResult.label}(${analysisResult.class_name_en || analysisResult.label})`
                                             : (analysisResult.class_name_en || analysisResult.label)}
                                     </span>
                                     <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs font-black shrink-0">{(analysisResult.conf * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                         )}
                         <div className="flex gap-2">
                            <button 
                                onClick={async () => {
                                    if (!selectedFile || isAnalyzing) return;
                                    setIsAnalyzing(true);
                                    try {
                                        const result = await analyzeEarImage(selectedFile);
                                        console.log('[AI 診斷] 分析結果:', result);
                                        
                                        setFullAnalysisData(result);
                                        
                                        // 處理遮罩數據（使用 Canvas 像素填充方式，參考先前 YOLOv7-seg）
                                        if (result.detections && result.detections.length > 0) {
                                            const masks = result.detections
                                                .map((det: any, index: number) => {
                                                    const color = getMaskColor(index);
                                                    
                                                    // 如果有 mask 矩陣，直接使用（用於 Canvas 像素填充）
                                                    if (det.mask && Array.isArray(det.mask) && det.mask.length > 0) {
                                                        if (Array.isArray(det.mask[0])) {
                                                            // 2D 矩陣
                                                            return {
                                                                maskMatrix: det.mask,
                                                                bbox: det.bbox || null,
                                                                color: color,
                                                                class_name: det.class_name_en || det.class_name || 'unknown'
                                                            };
                                                        }
                                                    }
                                                    
                                                    // 只有 bbox
                                                    if (det.bbox && Array.isArray(det.bbox) && det.bbox.length >= 4) {
                                                        return {
                                                            bbox: det.bbox,
                                                            color: color,
                                                            class_name: det.class_name_en || det.class_name || 'unknown'
                                                        };
                                                    }
                                                    
                                                    return null;
                                                })
                                                .filter((item: any) => item !== null);
                                            
                                            setSegmentationData(masks);
                                            if (masks.length > 0) {
                                                setShowMask(true);
                                            }
                                        }
                                        
                                        // 設置診斷結果
                                        if (result.primary_diagnosis) {
                                            setAnalysisResult({
                                                label: result.primary_diagnosis.class_name_en || result.primary_diagnosis.normalized_class || 'Unknown',
                                                conf: result.primary_diagnosis.confidence || 0,
                                                class_name_en: result.primary_diagnosis.class_name_en,
                                                class_name_zh: result.primary_diagnosis.class_name_zh,
                                                category: result.primary_diagnosis.category,
                                                normalized_class: result.primary_diagnosis.normalized_class
                                            });
                                        } else if (result.detections && result.detections.length > 0) {
                                            const firstDet = result.detections[0];
                                            setAnalysisResult({
                                                label: firstDet.class_name_en || firstDet.normalized_class || 'Unknown',
                                                conf: firstDet.confidence || 0,
                                                class_name_en: firstDet.class_name_en,
                                                class_name_zh: firstDet.class_name_zh,
                                                category: firstDet.category,
                                                normalized_class: firstDet.normalized_class
                                            });
                                        } else {
                                            setAnalysisResult({
                                                label: 'Normal',
                                                conf: 1.0,
                                                class_name_en: 'Normal',
                                                class_name_zh: '正常',
                                                category: 'NORMAL',
                                                normalized_class: 'normal'
                                            });
                                        }
                                    } catch (error: any) {
                                        console.error('[AI 診斷] 分析失敗:', error);
                                        alert(lang === 'zh' 
                                            ? `分析失敗: ${error.message || '未知錯誤'}` 
                                            : `Analysis failed: ${error.message || 'Unknown error'}`);
                                    } finally {
                                        setIsAnalyzing(false);
                                    }
                                }}
                                disabled={!selectedFile || isAnalyzing} 
                                className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Sparkles size={16} className={isAnalyzing ? 'animate-spin' : ''} /> 
                                <span className="hidden sm:inline">{isAnalyzing ? t.processing : t.execAnalysis}</span>
                            </button>
                            <button 
                                onClick={handleQuickConsult} 
                                disabled={!analysisResult || isTyping || isReportGenerating} 
                                className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <MessageSquarePlus size={16} /> <span className="hidden sm:inline">{t.consultAIButton}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-[2] flex flex-col bg-white dark:bg-[#0b1120] relative min-w-[320px]">
                <div className="h-10 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 bg-slate-50/50 dark:bg-[#0b1120]">
                    <div className="flex items-center gap-2">
                        <BrainCircuit size={14} className="text-indigo-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t.clinicalBrain}</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700 ${msg.role === 'ai' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-200'}`}>
                                {msg.role === 'ai' ? <Bot size={16} /> : <img src={user.avatar} alt="User" className="w-full h-full object-cover" />}
                            </div>
                            <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`px-4 py-3 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' : msg.type === 'error' ? 'p-0 bg-transparent shadow-none w-full' : msg.type === 'report-file' ? 'p-0 bg-transparent shadow-none w-full' : 'bg-slate-100 dark:bg-[#1e293b] text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-sm border border-slate-200 dark:border-slate-700'}`}>
                                    {msg.type === 'error' ? <QuotaErrorCard lang={lang} /> : msg.type === 'report-file' ? <DocxReportCard fileData={msg.fileData!} lang={lang} /> : <div className="whitespace-pre-wrap">{msg.text}</div>}
                                </div>
                            </div>
                        </div>
                    ))}
                    {(isTyping || isReportGenerating) && (
                        <div className="flex gap-3">
                             <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0"><Bot size={16} /></div>
                             <div className="px-4 py-3 bg-slate-100 dark:bg-[#1e293b] rounded-2xl rounded-tl-sm border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" /><div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75" /><div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150" /></div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="h-16 bg-white dark:bg-[#0b1120] border-t border-slate-200 dark:border-slate-800 flex items-center px-4 shrink-0">
                    <div className="relative flex items-center gap-2 w-full">
                        <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={(isTyping || isReportGenerating) ? t.sync : t.askQuestion} disabled={isTyping || isReportGenerating} className="flex-1 pl-4 pr-4 py-3 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white disabled:opacity-50 transition-all" />
                        <button onClick={(isTyping || isReportGenerating) ? handleStop : handleSendMessage} disabled={(!isTyping && !isReportGenerating) && !inputValue.trim()} className={`p-3 rounded-xl transition-all ${inputValue.trim() ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700' : (isTyping || isReportGenerating) ? 'bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>{(isTyping || isReportGenerating) ? <Square size={18} fill="currentColor" /> : <Send size={18} />}</button>
                        <div className="relative" ref={menuRef}>
                            <button onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} disabled={isTyping || isReportGenerating} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"><MoreVertical size={18} /></button>
                            <AnimatePresence>
                                {isMoreMenuOpen && (
                                    <motion.div initial={{ opacity: 0, scale: 0.95, y: 5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 5 }} className="absolute right-0 bottom-full mb-3 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                                        <button onClick={handleGenerateReport} disabled={!analysisResult} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50 text-xs font-bold"><FileText size={14} className="text-blue-600" /> {t.generateReport}</button>
                                        <div className="h-px bg-slate-100 dark:bg-slate-800" />
                                        <button onClick={handleResetChat} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors text-xs font-bold"><X size={14} /> {lang === 'zh' ? '重置對話' : 'Reset Chat'}</button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    );
};
export default AIDiagnosis;

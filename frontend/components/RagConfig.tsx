
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Language } from '../types';
import { translations } from '../services/translations';
import { listRagFiles, getKBFolders, createKBFolder, updateKBFolder, deleteKBFolder, moveFileToFolder, getKBStats, deleteRagFile, KBFolder as ApiKBFolder } from '../services/apiService';
import { 
  Search, Folder, FileText, Trash2, Plus, Upload, 
  Database, Check, X, 
  ToggleLeft, ToggleRight, BrainCircuit,
  RefreshCw, Layers, FolderInput, Lock, AlertTriangle, Edit2, PenLine, FolderOpen, Copy, CheckCircle2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Hash, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RagConfigProps {
  lang: Language;
}

interface KBFolder {
  id: string;
  name: string;
  type: 'system' | 'custom';
  created_at: string;
}

interface KBDocument {
  id: string;
  name: string;
  folderId: string; // 'root' for root directory
  status: 'active' | 'indexing' | 'error';
  size: number; // in KB
  tokens: number; // Estimated tokens
  vectorSizeGB?: number; // Vector size in GB
  category?: string; // File category (PDF, TXT, etc.)
  updatedAt: string;
  sourceUrl: string;
}

const INITIAL_FOLDERS: KBFolder[] = [
    { id: 'root', name: 'Uncategorized', type: 'system', created_at: '2025-01-01' },
    { id: 'f1', name: 'Clinical Guidelines', type: 'custom', created_at: '2025-01-10' },
    { id: 'f2', name: 'Research Papers', type: 'custom', created_at: '2025-02-15' },
    { id: 'f3', name: 'Drug Safety', type: 'custom', created_at: '2025-03-01' },
];

// Empty initial docs as requested
const INITIAL_DOCS: KBDocument[] = [];

const ITEMS_PER_PAGE = 10;

// --- Helper: Get File Type from Extension ---
const getFileType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext.toUpperCase();
};

// --- File Name Component with Left-click Copy ---
const FileNameCell = ({ name, lang }: { name: string, lang: Language }) => {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const t = translations[lang] as any;

  const copyToClipboard = async (text: string) => {
    try {
      // 優先使用 Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // 降級方案：使用傳統方法
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          return successful;
        } catch (err) {
          document.body.removeChild(textArea);
          console.error('複製失敗:', err);
          return false;
        }
      }
    } catch (err) {
      console.error('複製失敗:', err);
      return false;
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const success = await copyToClipboard(name);
    if (success) {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowTooltip(false);
      }, 2000);
    }
  };

  const copyText = lang === 'zh' ? '點擊複製' : 'Click to copy';

  return (
    <div 
      ref={cellRef}
      className="relative group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={(e) => {
        // 如果滑鼠移動到 tooltip 上，不要隱藏
        if (tooltipRef.current && tooltipRef.current.contains(e.relatedTarget as Node)) {
          return;
        }
        setShowTooltip(false);
      }}
    >
      <button
        onClick={handleClick}
        className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[400px] block cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 text-left w-full active:scale-95"
        type="button"
      >
        {name}
      </button>
      
      {/* Tooltip with copy button - Light/Dark mode adapted */}
      {showTooltip && (
        <div 
          ref={tooltipRef}
          className="absolute z-50 bottom-full left-0 mb-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-1 duration-200"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <button
            onClick={handleClick}
            className="w-full px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-t-lg transition-colors text-left"
            type="button"
          >
            <Copy size={12} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="text-blue-600 dark:text-blue-400 font-semibold">{copyText}</span>
          </button>
          <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 whitespace-nowrap">
            {name}
          </div>
          {/* Arrow pointing down */}
          <div className="absolute top-full left-4">
            <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-transparent border-t-slate-200 dark:border-t-slate-700"></div>
            <div className="absolute top-0 left-0 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-transparent border-t-white dark:border-t-slate-800 -mt-[1px] ml-[1px]"></div>
          </div>
        </div>
      )}

      {/* Copy Success Toast */}
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 right-4 z-[60] bg-gradient-to-r from-green-500 to-emerald-500 dark:from-green-600 dark:to-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 backdrop-blur-sm border border-green-400/20 dark:border-green-500/30"
          >
            <CheckCircle2 size={18} className="flex-shrink-0" />
            <span className="text-sm font-bold">{lang === 'zh' ? '已複製到剪貼板' : 'Copied to clipboard'}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Components ---

const StatusBadge = ({ status, lang }: { status: string, lang: Language }) => {
    const t = translations[lang] as any;
    switch (status) {
        case 'active': return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider bg-green-50 text-green-600 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30"><Check size={10} /> {t.kbActive}</span>;
        case 'indexing': return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30"><RefreshCw size={10} className="animate-spin" /> {t.kbIndexing}</span>;
        case 'error': return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30"><X size={10} /> {t.kbFailed}</span>;
        default: return null;
    }
};

const StorageWidget = ({ 
    docs, 
    lang, 
    vectorSizeGB
}: { 
    docs: KBDocument[], 
    lang: Language,
    vectorSizeGB: number
}) => {
    const t = translations[lang] as any;
    const totalTokens = docs.reduce((acc, d) => acc + d.tokens, 0);
    
    return (
        <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl p-4 mt-auto border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <BrainCircuit size={16} className="text-blue-500 dark:text-blue-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{t.kbVectorIndex}</span>
                </div>
            </div>
            <div className="space-y-3">
                <div>
                    <div className="text-lg font-black text-blue-600 dark:text-blue-400 mb-1">
                        {vectorSizeGB.toFixed(3)} GB
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 font-mono">
                        {lang === 'zh' ? '向量索引使用量' : 'Vector Index Usage'}
                    </div>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="text-lg font-black text-slate-700 dark:text-slate-300 mb-1">
                        {totalTokens.toLocaleString()} {t.kbTokens}
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 font-mono">
                        {lang === 'zh' ? '總 Token 使用量' : 'Total Tokens Usage'}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Action Types ---
type PendingAction = 
    | { type: 'delete_doc'; id: string }
    | { type: 'delete_folder_move'; id: string }
    | { type: 'delete_folder_all'; id: string };

const RagConfig: React.FC<RagConfigProps> = ({ lang }) => {
  const t = translations[lang] as any;
  const [folders, setFolders] = useState<KBFolder[]>(INITIAL_FOLDERS);
  const [docs, setDocs] = useState<KBDocument[]>(INITIAL_DOCS);
  const [activeFolderId, setActiveFolderId] = useState<string>('root');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'indexing' | 'error'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [ragFiles, setRagFiles] = useState<string[]>([]); // 從後端獲取的 RAG 檔案列表
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [vectorSizeGB, setVectorSizeGB] = useState<number>(0); // 向量索引使用量（GB）
  
  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteFolderChoiceId, setDeleteFolderChoiceId] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [moveDocId, setMoveDocId] = useState<string | null>(null);
  
  // Rename State - Folders Only
  const [renameTarget, setRenameTarget] = useState<{ id: string, name: string } | null>(null);
  
  const [newFolderName, setNewFolderName] = useState('');
  
  // Pending Action for Password Confirmation
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Computed
  const activeFolder = folders.find(f => f.id === activeFolderId) || folders[0];
  
  const filteredDocs = useMemo(() => {
      let filtered = docs.filter(d => d.folderId === activeFolderId);
      if (statusFilter !== 'all') {
          filtered = filtered.filter(d => d.status === statusFilter);
      }
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(d => d.name.toLowerCase().includes(q));
      }
      return filtered;
  }, [docs, activeFolderId, searchQuery, statusFilter]);

  // Reset to first page when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [searchQuery, statusFilter, activeFolderId]);

  // Pagination
  const totalPages = Math.ceil(filteredDocs.length / ITEMS_PER_PAGE);
  const paginatedDocs = filteredDocs.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
  );

  const folderCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      folders.forEach(f => {
          counts[f.id] = docs.filter(d => d.folderId === f.id).length;
      });
      return counts;
  }, [docs, folders]);

  // Grid template for table columns
  const gridTemplate = "minmax(300px, 2fr) minmax(150px, 1fr) minmax(200px, 1.5fr) minmax(150px, 1fr)";


  // 載入資料夾列表
  const loadFolders = React.useCallback(async () => {
    setIsLoadingFolders(true);
    try {
      const apiFolders = await getKBFolders();
      // 轉換為前端格式
      const convertedFolders: KBFolder[] = apiFolders.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        created_at: f.created_at
      }));
      setFolders(convertedFolders);
    } catch (error) {
      console.error('[知識庫] 載入資料夾失敗:', error);
    } finally {
      setIsLoadingFolders(false);
    }
  }, []);

  // 使用 useCallback 避免依賴問題
  const loadRagFilesCallback = React.useCallback(async () => {
    setIsLoadingFiles(true);
    try {
      const result = await listRagFiles();
      const files = result.files;
      const filesWithFolders = result.files_with_folders || [];
      
      setRagFiles(files);
      
      // 創建文件名到 folder_id 的映射
      const fileFolderMap = new Map<string, string>();
      filesWithFolders.forEach(item => {
        fileFolderMap.set(item.filename, item.folder_id);
      });
      
      // 將後端的檔案列表轉換為 docs（如果檔案不在 docs 中，添加到對應資料夾）
      setDocs(prev => {
        const existingFileNames = new Set(prev.map(d => d.name));
        const newFiles = files.filter(f => !existingFileNames.has(f));
        
        if (newFiles.length > 0) {
          // 從後端獲取實際的 Token 數量、GB 大小和分類類別
          const newDocs: KBDocument[] = newFiles.map((filename, idx) => {
            const fileInfo = filesWithFolders.find(f => f.filename === filename);
            const folderId = fileInfo?.folder_id || fileFolderMap.get(filename) || 'root';
            const tokens = fileInfo?.estimated_tokens || 0;
            const vectorSizeGB = fileInfo?.vector_size_gb || 0;
            const category = fileInfo?.category || 'UNKNOWN';
            return {
              id: `rag_${Date.now()}_${idx}`,
              name: filename,
              folderId: folderId,
              status: 'active' as const,
              size: 0, // 大小未知
              tokens: tokens,
              vectorSizeGB: vectorSizeGB,
              category: category,
              updatedAt: new Date().toISOString().split('T')[0],
              sourceUrl: '#'
            };
          });
          return [...newDocs, ...prev];
        }
        
        // 更新現有文件的 folderId、tokens、GB 大小和分類類別
        return prev.map(doc => {
          const fileInfo = filesWithFolders.find(f => f.filename === doc.name);
          if (fileInfo) {
            const folderId = fileInfo.folder_id;
            const tokens = fileInfo.estimated_tokens || doc.tokens;
            const vectorSizeGB = fileInfo.vector_size_gb || doc.vectorSizeGB || 0;
            const category = fileInfo.category || doc.category || 'UNKNOWN';
            return { 
              ...doc, 
              folderId: folderId || doc.folderId,
              tokens: tokens,
              vectorSizeGB: vectorSizeGB,
              category: category
            };
          }
          return doc;
        });
      });
    } catch (error) {
      console.error('[知識庫] 載入 RAG 檔案失敗:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  // 載入向量索引統計信息
  const loadVectorStats = React.useCallback(async () => {
    try {
      const stats = await getKBStats();
      setVectorSizeGB(stats.total_vector_gb);
    } catch (error) {
      console.error('[知識庫] 載入向量統計信息失敗:', error);
    }
  }, []);

  useEffect(() => {
    // 初始載入資料夾、文件和統計信息
    loadFolders();
    loadRagFilesCallback();
    loadVectorStats();
    // 每30秒刷新一次
    const interval = setInterval(() => {
      loadFolders();
      loadRagFilesCallback();
      loadVectorStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadFolders, loadRagFilesCallback, loadVectorStats]);

  // Handlers - Creation
  const handleCreateFolder = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newFolderName.trim()) return;
      
      const folderName = newFolderName.trim();
      setCreateModalOpen(false);
      setNewFolderName('');
      
      // 同步到後端
      try {
          const newFolder = await createKBFolder(folderName, 'custom');
          // 更新本地狀態
          setFolders(prev => [...prev, {
              id: newFolder.id,
              name: newFolder.name,
              type: newFolder.type,
              created_at: newFolder.created_at
          }]);
          setActiveFolderId(newFolder.id);
          console.log('[知識庫] 資料夾創建成功:', newFolder);
      } catch (error) {
          console.error('[知識庫] 資料夾創建失敗:', error);
          // 重新載入資料夾列表
          loadFolders();
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const files = Array.from(e.target.files);
          const newDocs = files.map((f: File) => ({
              id: `d_${Date.now()}_${Math.random()}`, 
              name: f.name, 
              folderId: activeFolderId, 
              status: 'indexing' as const,
              size: f.size / 1024, 
              tokens: 0,
              updatedAt: new Date().toISOString().split('T')[0], 
              sourceUrl: '#'
          }));
          setDocs(prev => [...newDocs, ...prev]);
          
          // 上傳檔案到後端
          try {
              const { uploadRagFile } = await import('../services/apiService');
              for (const file of files) {
                  await uploadRagFile(file, activeFolderId);
              }
              
              // 上傳成功後更新狀態
              setTimeout(() => {
                 setDocs(current => current.map(d => {
                     const isNew = newDocs.find(nd => nd.id === d.id);
                     return isNew ? { ...d, status: 'active', tokens: Math.floor(d.size * 200) } : d;
                 }));
                 // 重新載入檔案列表
                 loadRagFilesCallback();
              }, 2500);
          } catch (error) {
              console.error('[知識庫] 上傳檔案失敗:', error);
              // 標記為錯誤狀態
              setDocs(current => current.map(d => {
                  const isNew = newDocs.find(nd => nd.id === d.id);
                  return isNew ? { ...d, status: 'error' as const } : d;
              }));
          }
      }
  };

  // Handlers - Move
  const handleMoveDoc = async (docId: string, targetFolderId: string) => {
      const doc = docs.find(d => d.id === docId);
      if (!doc) return;
      
      // 更新本地狀態
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, folderId: targetFolderId } : d));
      setMoveDocId(null);
      
      // 同步到後端
      try {
          await moveFileToFolder(doc.name, targetFolderId);
          console.log('[知識庫] 文件移動成功:', doc.name, targetFolderId);
      } catch (error) {
          console.error('[知識庫] 文件移動失敗:', error);
          // 回滾本地狀態
          setDocs(prev => prev.map(d => d.id === docId ? { ...d, folderId: doc.folderId } : d));
      }
  };

  // Handlers - Rename (Folder Only)
  const handleRenameSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!renameTarget || !renameTarget.name.trim()) return;
      
      const folderId = renameTarget.id;
      const newName = renameTarget.name.trim();
      
      // 更新本地狀態
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: newName } : f));
      setRenameTarget(null);
      
      // 同步到後端
      try {
          await updateKBFolder(folderId, newName);
          console.log('[知識庫] 資料夾重命名成功:', folderId, newName);
      } catch (error) {
          console.error('[知識庫] 資料夾重命名失敗:', error);
          // 重新載入資料夾列表以回滾
          loadFolders();
      }
  };

  // Handlers - Delete & Password
  const initiateDeleteDoc = (id: string) => {
      setPendingAction({ type: 'delete_doc', id });
      setPasswordInput('');
      setPasswordError(false);
      setPasswordModalOpen(true);
  };

  const initiateDeleteFolder = (id: string) => {
      setDeleteFolderChoiceId(id);
  };

  const proceedWithFolderDelete = (type: 'delete_folder_move' | 'delete_folder_all') => {
      if (!deleteFolderChoiceId) return;
      setDeleteFolderChoiceId(null);
      setPendingAction({ type, id: deleteFolderChoiceId });
      setPasswordInput('');
      setPasswordError(false);
      setPasswordModalOpen(true);
  };

  const executeAction = async () => {
      if (!passwordInput.trim()) { setPasswordError(true); return; }
      if (!pendingAction) return;

      try {
          switch (pendingAction.type) {
              case 'delete_doc':
                  // 找到要刪除的文件
                  const docToDelete = docs.find(d => d.id === pendingAction.id);
                  if (!docToDelete) {
                      console.error('[知識庫] 找不到要刪除的文件:', pendingAction.id);
                      return;
                  }
                  
                  // 調用後端 API 刪除文件
                  try {
                      await deleteRagFile(docToDelete.name);
                      // 更新本地狀態
                      setDocs(prev => prev.filter(d => d.id !== pendingAction.id));
                      // 重新載入文件列表以確保同步
                      loadRagFilesCallback();
                      console.log('[知識庫] 文件刪除成功:', docToDelete.name);
                  } catch (deleteError) {
                      console.error('[知識庫] 文件刪除失敗:', deleteError);
                      // 不更新本地狀態，保持原樣
                      throw deleteError; // 重新拋出錯誤，讓外層 catch 處理
                  }
                  break;
              case 'delete_folder_move':
                  // 同步到後端（後端會自動將文件移動到 root）
                  await deleteKBFolder(pendingAction.id);
                  // 更新本地狀態
                  setDocs(prev => prev.map(d => d.folderId === pendingAction.id ? { ...d, folderId: 'root' } : d));
                  setFolders(prev => prev.filter(f => f.id !== pendingAction.id));
                  if (activeFolderId === pendingAction.id) setActiveFolderId('root');
                  console.log('[知識庫] 資料夾刪除成功（文件已移動到 root）:', pendingAction.id);
                  break;
              case 'delete_folder_all':
                  // 同步到後端（後端會自動將文件移動到 root）
                  await deleteKBFolder(pendingAction.id);
                  // 更新本地狀態（刪除該資料夾中的文件）
                  setDocs(prev => prev.filter(d => d.folderId !== pendingAction.id));
                  setFolders(prev => prev.filter(f => f.id !== pendingAction.id));
                  if (activeFolderId === pendingAction.id) setActiveFolderId('root');
                  console.log('[知識庫] 資料夾刪除成功（文件已刪除）:', pendingAction.id);
                  break;
          }
      } catch (error) {
          console.error('[知識庫] 執行操作失敗:', error);
          // 重新載入資料夾列表以回滾
          loadFolders();
      } finally {
          setPasswordModalOpen(false);
          setPendingAction(null);
          setPasswordInput('');
          setPasswordError(false);
      }
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-[#020617] overflow-hidden transition-colors duration-500">
      
      {/* 1. Header (Global) */}
      <div className="h-20 bg-white dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 md:px-10 shrink-0 z-30 transition-colors">
        <div className="flex items-center">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase whitespace-nowrap">{t.ragConfig}</h1>
            <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-4 shrink-0"></div>
            <p className="hidden lg:block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">{t.ragSub}</p>
        </div>
      </div>

      {/* 2. Main Layout */}
      <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT Sidebar: Collections */}
          <div className="w-72 bg-white dark:bg-[#0b1120] border-r border-slate-200 dark:border-slate-800 flex flex-col">
              <div className="p-4 flex flex-col gap-1 overflow-y-auto flex-1 custom-scrollbar">
                  <div className="flex items-center justify-between px-2 mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.folders}</span>
                      <button onClick={() => setCreateModalOpen(true)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
                          <Plus size={14} />
                      </button>
                  </div>
                  
                  {folders.map(f => (
                      <button 
                        key={f.id} 
                        onClick={() => setActiveFolderId(f.id)} 
                        className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all relative ${
                            activeFolderId === f.id 
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold shadow-sm ring-1 ring-blue-500/10' 
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 font-medium'
                        }`}
                      >
                          <div className="flex items-center gap-3 truncate min-w-0 flex-1">
                              {f.id === 'root' ? <Layers size={16} className="shrink-0" /> : <Folder size={16} className="shrink-0" />}
                              <span className="text-sm truncate">
                                  {f.id === 'root' ? t.kbRoot : f.name}
                              </span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                              {/* Rename Trigger for Folder (Only Custom) */}
                              {f.type === 'custom' && (
                                  <div 
                                    role="button"
                                    onClick={(e) => { e.stopPropagation(); setRenameTarget({ id: f.id, name: f.name }); }}
                                    className="p-1 text-slate-400 hover:text-blue-600 transition-opacity"
                                  >
                                      <Edit2 size={12} />
                                  </div>
                              )}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  activeFolderId === f.id ? 'bg-white dark:bg-slate-900/50 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                              }`}>
                                  {folderCounts[f.id] || 0}
                              </span>
                          </div>
                      </button>
                  ))}
              </div>
              <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                  <StorageWidget 
                      docs={docs} 
                      lang={lang} 
                      vectorSizeGB={vectorSizeGB}
                  />
              </div>
          </div>

          {/* RIGHT Content: Documents Table */}
          <div className="flex-1 bg-slate-50 dark:bg-[#020617] flex flex-col overflow-hidden relative">
              
              {/* Collection Header */}
              <div className="h-20 bg-white dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 shrink-0">
                  <div>
                      <div className="flex items-center gap-3 group">
                          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">
                              {activeFolder.id === 'root' ? t.kbRoot : activeFolder.name}
                          </h2>
                          {activeFolder.type === 'custom' && (
                              <div className="flex items-center gap-1 transition-opacity">
                                <button 
                                    onClick={() => setRenameTarget({ id: activeFolder.id, name: activeFolder.name })}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                    title={t.kbRename}
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button 
                                    onClick={() => initiateDeleteFolder(activeFolder.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title={t.kbDelete}
                                >
                                    <Trash2 size={16} />
                                </button>
                              </div>
                          )}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1.5"><FileText size={14} /> {filteredDocs.length} {t.kbTotalDocs}</span>
                          <span className="w-1 h-1 bg-slate-300 rounded-full" />
                          <span className="flex items-center gap-1.5"><BrainCircuit size={14} /> {filteredDocs.reduce((a,b)=>a+b.tokens,0).toLocaleString()} {t.kbTotalTokens}</span>
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                      <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text" 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            placeholder={t.kbSearch} 
                            className="pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-slate-900 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 w-56 transition-all" 
                          />
                      </div>
                      <button onClick={() => fileInputRef.current?.click()} className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                          <Upload size={14} /> {t.kbUpload}
                      </button>
                      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                  </div>
              </div>

              {/* Status Filter Bar - Blue Theme */}
              <div className="px-8 py-3 flex gap-2 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0b1120]/50 backdrop-blur-sm sticky top-0 z-10">
                  {(['all', 'active', 'indexing', 'error'] as const).map(s => {
                      let label = s as string;
                      if(s === 'active') label = t.kbActive;
                      if(s === 'indexing') label = t.kbIndexing;
                      if(s === 'error') label = t.kbFailed;
                      if(s === 'all') label = 'ALL';

                      return (
                          <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                statusFilter === s 
                                ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md shadow-blue-500/20' 
                                : 'text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400'
                            }`}
                          >
                              {label} ({s === 'all' ? docs.filter(d => d.folderId === activeFolderId).length : docs.filter(d => d.folderId === activeFolderId && d.status === s).length})
                          </button>
                      )
                  })}
              </div>

              {/* Main Scroll Container */}
              <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-[#0b1120] w-full relative">
                  
                  {/* Sticky Header Row - Like PatientList */}
                  <div className="bg-slate-50 dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-20 min-w-[800px]">
                      <div className="grid gap-4 px-6 py-4 items-center" style={{ gridTemplateColumns: gridTemplate }}>
                          {/* Source Name */}
                          <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                              <FileText size={14} /> {t.kbName}
                          </div>
                          {/* Status */}
                          <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 border-l border-slate-200 dark:border-slate-800">
                              <Activity size={14} /> {t.kbStatus}
                          </div>
                          {/* Metadata */}
                          <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 border-l border-slate-200 dark:border-slate-800">
                              <Database size={14} /> {lang === 'zh' ? '元數據' : 'Metadata'}
                          </div>
                          {/* Actions */}
                          <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-l border-slate-200 dark:border-slate-800 text-center">
                              {t.kbActions}
                          </div>
                      </div>
                  </div>

                  {/* List Content */}
                  {filteredDocs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl mt-8 mx-6">
                          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-400">
                              <Upload size={24} />
                          </div>
                          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.kbEmptyDesc}</p>
                      </div>
                  ) : (
                      <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 min-w-[800px]">
                          {paginatedDocs.map((doc, index) => (
                              <motion.div 
                                  key={doc.id} 
                                  initial={{ opacity: 0, y: 10 }} 
                                  animate={{ opacity: 1, y: 0 }} 
                                  transition={{ delay: index * 0.03 }} 
                                  className="grid gap-4 px-6 py-4 items-center group hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors min-h-[88px]"
                                  style={{ gridTemplateColumns: gridTemplate }}
                              >
                                  {/* Source Name */}
                                  <div className="flex items-center gap-4 min-w-0">
                                      <div className="relative flex-shrink-0">
                                          <div className="p-2.5 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 text-blue-600 dark:text-blue-400 rounded-lg shadow-sm">
                                              <FileText size={18} />
                                          </div>
                                          <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] font-black px-1 py-0.5 rounded uppercase">
                                              {getFileType(doc.name)}
                                          </div>
                                      </div>
                                      <div className="flex flex-col justify-center min-w-0 flex-1">
                                          <FileNameCell name={doc.name} lang={lang} />
                                      </div>
                                  </div>

                                  {/* Status */}
                                  <div className="flex justify-center min-w-0 border-l border-slate-200 dark:border-slate-800 pl-4">
                                      <StatusBadge status={doc.status} lang={lang} />
                                  </div>

                                  {/* Metadata */}
                                  <div className="flex flex-col gap-1.5 min-w-0 border-l border-slate-200 dark:border-slate-800 pl-4">
                                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 font-mono">
                                          {doc.vectorSizeGB ? `${(doc.vectorSizeGB * 1024).toFixed(2)} MB` : '0 MB'}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-bold">{doc.tokens.toLocaleString()} tokens</span>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center justify-center gap-2 transition-opacity border-l border-slate-200 dark:border-slate-800 pl-4">
                                      <button onClick={() => setMoveDocId(doc.id)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title={t.kbMove}>
                                          <FolderInput size={16} />
                                      </button>
                                      <button onClick={() => initiateDeleteDoc(doc.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title={t.kbDelete}>
                                          <Trash2 size={16} />
                                      </button>
                                  </div>
                              </motion.div>
                          ))}
                      </div>
                  )}

                  {/* Pagination Controls */}
                  {filteredDocs.length > 0 && (
                      <div className="sticky bottom-0 bg-white dark:bg-[#0b1120] border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {lang === 'zh' 
                                ? `顯示 ${(currentPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, filteredDocs.length)} 筆，共 ${filteredDocs.length} 筆`
                                : `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, filteredDocs.length)} of ${filteredDocs.length}`
                              }
                          </div>
                          
                          <div className="flex items-center gap-2">
                              <button 
                                  onClick={() => setCurrentPage(1)} 
                                  disabled={currentPage === 1} 
                                  className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  title={lang === 'zh' ? '第一頁' : 'First page'}
                              >
                                  <ChevronsLeft size={16} />
                              </button>
                              <button 
                                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                  disabled={currentPage === 1} 
                                  className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  title={lang === 'zh' ? '上一頁' : 'Previous page'}
                              >
                                  <ChevronLeft size={16} />
                              </button>
                              <div className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-black text-slate-700 dark:text-slate-300 min-w-[3rem] text-center">
                                  {currentPage} / {totalPages}
                              </div>
                              <button 
                                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                                  disabled={currentPage === totalPages} 
                                  className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  title={lang === 'zh' ? '下一頁' : 'Next page'}
                              >
                                  <ChevronRight size={16} />
                              </button>
                              <button 
                                  onClick={() => setCurrentPage(totalPages)} 
                                  disabled={currentPage === totalPages} 
                                  className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  title={lang === 'zh' ? '最後一頁' : 'Last page'}
                              >
                                  <ChevronsRight size={16} />
                              </button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* Rename Modal (Folder Only) */}
      <AnimatePresence>
          {renameTarget && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#1e293b] rounded-[2rem] p-8 w-full max-w-sm shadow-2xl border dark:border-slate-800">
                      <div className="flex items-center gap-3 mb-6 text-blue-600 dark:text-blue-400">
                          <PenLine size={24} />
                          <h3 className="text-lg font-black text-slate-900 dark:text-white">
                              {t.kbRenameFolderTitle}
                          </h3>
                      </div>
                      
                      <form onSubmit={handleRenameSubmit}>
                          <input 
                              autoFocus
                              type="text" 
                              value={renameTarget.name}
                              onChange={(e) => setRenameTarget({ ...renameTarget, name: e.target.value })}
                              className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl mb-6 font-bold text-sm outline-none focus:border-blue-500 dark:text-white transition-colors" 
                              placeholder={t.kbNewName}
                          />
                          <div className="flex gap-3">
                              <button type="button" onClick={() => setRenameTarget(null)} className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200">{t.cancel}</button>
                              <button type="submit" disabled={!renameTarget.name.trim()} className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-white bg-blue-600 dark:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 dark:hover:bg-blue-600 transition-all">{t.saveChanges}</button>
                          </div>
                      </form>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* Delete Folder CHOICE Modal */}
      <AnimatePresence>
          {deleteFolderChoiceId && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#1e293b] rounded-[2rem] p-8 w-full max-w-md shadow-2xl border dark:border-slate-800">
                      <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-500">
                          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full"><Trash2 size={24} /></div>
                          <h3 className="text-xl font-black">{t.kbDelFolderTitle}</h3>
                      </div>
                      <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                          {t.kbDelFolderMsg}
                      </p>
                      <div className="space-y-3">
                          <button onClick={() => proceedWithFolderDelete('delete_folder_move')} className="w-full p-4 text-left border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-blue-500 dark:hover:border-blue-500 group transition-all">
                              <div className="font-black text-sm text-slate-800 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                  {lang === 'zh' ? '僅刪除資料夾' : 'Delete Folder Only'}
                              </div>
                              <div className="text-xs font-medium text-slate-500">
                                  {lang === 'zh' ? '文件將移動至「未分類檔案」' : 'Move documents to Uncategorized Files'}
                              </div>
                          </button>
                          <button onClick={() => proceedWithFolderDelete('delete_folder_all')} className="w-full p-4 text-left border border-red-100 dark:border-red-900/30 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 hover:border-red-500 group transition-all">
                              <div className="font-black text-sm text-red-700 dark:text-red-400 mb-1">
                                  {lang === 'zh' ? '全部刪除' : 'Delete Everything'}
                              </div>
                              <div className="text-xs font-medium text-red-600/70 dark:text-red-400/70">
                                  {lang === 'zh' ? '刪除資料夾與其所有文件 (不可復原)' : 'Delete folder AND all documents (Irreversible)'}
                              </div>
                          </button>
                      </div>
                      <button onClick={() => setDeleteFolderChoiceId(null)} className="w-full mt-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                          {t.cancel}
                      </button>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* Password Confirmation Modal */}
      <AnimatePresence>
          {passwordModalOpen && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md">
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white dark:bg-[#1e293b] rounded-[2rem] p-8 w-full max-w-sm shadow-2xl border border-red-100 dark:border-red-900/30">
                      <div className="flex flex-col items-center text-center gap-4 mb-6">
                          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full text-red-500">
                              <Lock size={24} />
                          </div>
                          <div>
                              <h3 className="text-lg font-black text-slate-900 dark:text-white">{t.kbEnterPwd}</h3>
                              <p className="text-xs font-medium text-slate-500 mt-1">{t.kbDelFileMsg}</p>
                          </div>
                      </div>
                      
                      <form onSubmit={(e) => { e.preventDefault(); executeAction(); }} className="space-y-4">
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t.kbPasswordLabel}</label>
                              <input 
                                  type="password" 
                                  autoFocus
                                  value={passwordInput} 
                                  onChange={(e) => setPasswordInput(e.target.value)} 
                                  onKeyDown={(e) => e.key === 'Enter' && executeAction()}
                                  className={`w-full px-5 py-3 bg-slate-50 dark:bg-slate-900 border-2 rounded-2xl font-bold text-sm outline-none transition-all ${
                                      passwordError ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-700 focus:border-blue-500'
                                  }`} 
                                  placeholder="********"
                              />
                              {passwordError && <p className="text-[10px] font-bold text-red-500 ml-2 flex items-center gap-1"><AlertTriangle size={10} /> {t.kbWrongPwd}</p>}
                          </div>
                          
                          <div className="flex gap-3">
                              <button type="button" onClick={() => setPasswordModalOpen(false)} className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200">{t.cancel}</button>
                              <button type="submit" className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-white bg-red-600 rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-700">{t.kbConfirm}</button>
                          </div>
                      </form>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* Move Document Modal */}
      <AnimatePresence>
          {moveDocId && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#1e293b] rounded-[2rem] p-8 w-full max-w-sm shadow-2xl border dark:border-slate-800 flex flex-col max-h-[80vh]">
                      <div className="flex items-center gap-3 mb-6 text-blue-600 dark:text-blue-400 shrink-0">
                          <FolderInput size={24} />
                          <h3 className="text-xl font-black text-slate-900 dark:text-white">{t.kbMoveDocTitle}</h3>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 mb-6">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">{t.kbSelectFolder}</p>
                          {folders.filter(f => f.id !== docs.find(d => d.id === moveDocId)?.folderId).map(f => (
                              <button 
                                key={f.id} 
                                onClick={() => handleMoveDoc(moveDocId, f.id)}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-all group"
                              >
                                  <Folder size={18} className="text-slate-400 group-hover:text-blue-500" />
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                                      {f.id === 'root' ? t.kbRoot : f.name}
                                  </span>
                              </button>
                          ))}
                      </div>

                      <button onClick={() => setMoveDocId(null)} className="w-full py-3 text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 shrink-0">
                          {t.cancel}
                      </button>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* Create Folder Modal */}
      <AnimatePresence>
        {createModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="bg-white dark:bg-[#1e293b] rounded-[2rem] p-8 w-full max-w-sm shadow-2xl border dark:border-slate-800">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2"><FolderOpen className="text-blue-600 dark:text-blue-400" /> {t.kbCreateFolderTitle}</h3>
                    <form onSubmit={handleCreateFolder}>
                        <input autoFocus type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl mb-6 font-bold text-sm outline-none focus:border-blue-500 dark:text-white transition-colors" placeholder={t.kbFolderName} />
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setCreateModalOpen(false)} className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200">{t.cancel}</button>
                            <button type="submit" disabled={!newFolderName.trim()} className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-white bg-blue-600 dark:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 dark:hover:bg-blue-600 transition-all">{lang === 'zh' ? '建立' : 'Create'}</button>
                        </div>
                    </form>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default RagConfig;

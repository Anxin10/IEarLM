/**
 * 後端 API 服務
 * 統一管理所有後端 API 調用
 */

// ==========================================================
// 類型定義 (Type Definitions)
// ==========================================================

/**
 * 耳疾病灶檢測結果類型
 */
export interface EarDetectionResult {
  detections: Array<{
    class: string;
    class_name_en: string;
    class_name_zh: string;
    category: 'EAC' | 'TM' | 'NORMAL' | 'UNKNOWN';
    confidence: number;
    bbox: number[];
    mask?: number[][];
    class_id?: number;
    normalized_class: string;
  }>;
  primary_diagnosis: {
    class_name_en: string;
    class_name_zh: string;
    category: 'EAC' | 'TM' | 'NORMAL' | 'UNKNOWN';
    confidence: number;
    normalized_class: string;
  } | null;
  eac_detections: Array<any>;
  tm_detections: Array<any>;
  summary: {
    total: number;
    eac_count: number;
    tm_count: number;
    normal_count: number;
  };
  coordinate_type?: string;
  crop_info?: any;
}

/**
 * RAG 問答請求參數
 */
export interface RagAskRequest {
  question: string;
  top_k?: number;
}

/**
 * RAG 問答響應
 */
export interface RagAskResponse {
  answer: string;
  contexts: string[];
}

/**
 * RAG 問答響應（帶上下文）
 */
export interface RagAskWithContextsResponse {
  answer: string;
  contexts: string[];
}

/**
 * RAG 文件列表響應
 */
export interface RagFilesListResponse {
  files: string[];
}

/**
 * RAG 文件上傳響應
 */
export interface RagFileUploadResponse {
  message: string;
  len: number;
}

/**
 * RAG 文件刪除請求
 */
export interface RagFileDeleteRequest {
  filename: string;
}

/**
 * RAG 文件刪除響應
 */
export interface RagFileDeleteResponse {
  message: string;
}

/**
 * 報告生成請求參數
 */
export interface ReportGenerateRequest {
  template_name: string;
  data: Record<string, any>;
  output_format?: 'docx' | 'pdf' | 'both';
}

/**
 * 報告生成響應
 */
export interface ReportGenerateResponse {
  status: string;
  docx?: {
    report_id: string;
    file_id: string;
    download_url: string;
    edit_url: string;
    format: string;
  };
  pdf?: {
    report_id: string;
    download_url: string;
    format: string;
  };
  expires_in?: string;
}

/**
 * API 錯誤響應
 */
export interface ApiErrorResponse {
  error: string;
  detail?: string;
  where?: string;
}

// ==========================================================
// API 基礎配置
// ==========================================================

// YOLOv7 檢測 API (端口 5000)
// 在開發環境中使用代理（/api/detection）以解決 CORS 問題
// 在生產環境中使用完整 URL 或環境變量中指定的 URL
const DETECTION_API_BASE_URL = import.meta.env.DEV
  ? '/api/detection'  // 開發環境使用代理路徑
  : (import.meta.env.VITE_DETECTION_API_BASE_URL || 'http://localhost:5000/api');

// RAG API (端口 9000，根據實際部署調整)
// 在開發環境中使用直接連接 (Direct Connection) 以避免 Proxy 問題，配合後端 CORS 設定
const getRagApiBaseUrl = () => {
  if (import.meta.env.DEV) {
    // 如果是開發環境，嘗試自動檢測 Hostname + Port 9000
    // 這能解決 WSL/LAN 存取時 localhost Proxy 失效的問題
    const hostname = window.location.hostname;
    return `http://${hostname}:9000`;
  }
  return import.meta.env.VITE_RAG_API_BASE_URL || 'http://localhost:9000';
};
const RAG_API_BASE_URL = getRagApiBaseUrl();

/**
 * 耳疾病灶識別 API（通過 Ollama API）
 * 調用 ollama API 的 /api/v1/analyze_ear 端點，返回包含中英文名稱和 EAC/TM 分類的結果
 * 
 * @param imageFile - 圖像文件
 * @param conf_thres - 置信度閾值（默認 0.25）
 * @param iou_thres - IoU 閾值（默認 0.45）
 * @returns Promise<EarDetectionResult> - 檢測結果
 */
export const analyzeEarImage = async (
  imageFile: File,
  conf_thres: number = 0.25,
  iou_thres: number = 0.45
): Promise<EarDetectionResult> => {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('conf_thres', conf_thres.toString());
    formData.append('iou_thres', iou_thres.toString());

    const response = await fetch(`${RAG_API_BASE_URL}/api/v1/analyze_ear`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: '耳疾病灶識別失敗' }));
      throw new Error(error.detail || error.error || '耳疾病灶識別失敗');
    }

    const data = await response.json();

    // 轉換為前端期望的格式
    return {
      detections: data.detections.map((det: any) => ({
        class: det.class_name || det.class_name_en || 'unknown',
        class_name_en: det.class_name_en || det.class_name || 'Unknown',
        class_name_zh: det.class_name_zh || '未知',
        category: det.category || 'UNKNOWN',
        confidence: det.confidence || 0,
        bbox: det.bbox || [],
        mask: det.mask || undefined,
        class_id: det.class_id,
        normalized_class: det.normalized_class || det.class_name || 'unknown',
      })),
      primary_diagnosis: data.primary_diagnosis || null,
      eac_detections: data.eac_detections || [],
      tm_detections: data.tm_detections || [],
      summary: data.summary || {
        total: 0,
        eac_count: 0,
        tm_count: 0,
        normal_count: 0,
      },
      coordinate_type: data.coordinate_type,
      crop_info: data.crop_info,
    };
  } catch (error) {
    console.error('[耳疾病灶識別 API] 請求異常:', error);
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        throw new Error('無法連接到後端服務，請確認服務是否運行中');
      }
    }
    throw error;
  }
};

/**
 * 圖像分析 API（舊版，直接調用 YOLOv7 API）
 * 後端期望接收 JSON 格式，包含 base64 編碼的圖片數據
 */
export const analyzeImage = async (imageFile: File, includeMask: boolean = true): Promise<{
  detections: Array<{
    class: string;
    confidence: number;
    bbox: number[];
    mask?: number[][];  // 二維數組，mask 數據
    class_id?: number;
  }>;
  primary_diagnosis?: string;
  confidence?: number;
  coordinate_type?: string;
  crop_info?: any;
}> => {
  // 將文件轉換為 base64
  const base64Image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 保留完整 base64 數據 URL（包含 data:image/...;base64, 前綴）
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });

  try {
    const response = await fetch(`${DETECTION_API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        conf_thres: 0.9,
        iou_thres: 0.5,
        include_crop_coords: includeMask,
        coordinate_type: 'original',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '圖像分析失敗' }));
      throw new Error(error.error || '圖像分析失敗');
    }

    const data = await response.json();

    // 轉換後端響應格式為前端期望的格式
    // 後端返回: { detections: [{ class_name, confidence, bbox, mask, ... }], ... }
    // 前端期望: { detections: [{ class, confidence, bbox, mask, ... }], primary_diagnosis, confidence }

    // 找出置信度最高的檢測結果作為主要診斷
    let primaryDiagnosis = 'Normal';
    let maxConfidence = 0;

    if (data.detections && data.detections.length > 0) {
      const topDetection = data.detections.reduce((max: any, det: any) =>
        det.confidence > max.confidence ? det : max
      );
      primaryDiagnosis = topDetection.class_name || 'Normal';
      maxConfidence = topDetection.confidence || 0;
    }

    return {
      detections: data.detections.map((det: any) => ({
        class: det.class_name || det.class || 'unknown',
        confidence: det.confidence || 0,
        bbox: det.bbox || [],
        mask: det.mask || undefined,
        class_id: det.class_id,
      })),
      primary_diagnosis: primaryDiagnosis,
      confidence: maxConfidence,
      coordinate_type: data.coordinate_type,
      crop_info: data.crop_info,
    };
  } catch (error) {
    console.error('[圖像分析 API] 請求異常:', error);
    // 處理網絡錯誤或其他異常
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        throw new Error(`無法連接到圖像分析服務 (${DETECTION_API_BASE_URL})。請確認後端服務是否運行中，並檢查瀏覽器控制台是否有 CORS 錯誤。`);
      }
    }
    // 如果是已經包裝過的錯誤，直接拋出
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('圖像分析失敗：未知錯誤');
  }
};

/**
 * RAG 問答 API
 * 後端端點: POST /ask
 * 請求格式: { question: string, top_k: number }
 * 響應格式: { answer: string, contexts: string[] }
 */
export const ragAsk = async (question: string, topK: number = 3): Promise<string> => {
  const apiUrl = `${RAG_API_BASE_URL}/ask`;
  console.log('[RAG API] 請求 URL:', apiUrl);
  console.log('[RAG API] 請求參數:', { question: question.substring(0, 50) + '...', top_k: topK });

  try {
    // 創建帶超時控制的 fetch 請求（60秒超時）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超時

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        top_k: topK,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('[RAG API] 響應狀態:', response.status, response.statusText);

    if (!response.ok) {
      let errorMessage = `RAG API 請求失敗 (狀態碼: ${response.status})`;
      try {
        const errorData = await response.json();
        console.error('[RAG API] 錯誤響應:', errorData);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        const text = await response.text();
        console.error('[RAG API] 錯誤響應文本:', text);
        errorMessage = text || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('[RAG API] 成功響應:', data);
    // 後端返回格式: { answer: string, contexts: string[] }
    return data.answer || '無法獲取答案';
  } catch (error) {
    console.error('[RAG API] 請求異常:', error);
    // 處理超時錯誤
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('請求超時（60秒）。請稍後再試或簡化問題。');
    }
    // 處理網絡錯誤或其他異常
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        throw new Error(`無法連接到 RAG API (${RAG_API_BASE_URL})。請確認服務是否運行中，並檢查瀏覽器控制台是否有 CORS 錯誤。`);
      }
    }
    throw error;
  }
};

/**
 * RAG 問答 API（返回完整響應，包含 contexts）
 * 
 * @param question - 問題字符串
 * @param topK - 檢索的知識片段數量（默認 3）
 * @returns Promise<RagAskWithContextsResponse> - AI 回答和上下文
 */
export const ragAskWithContexts = async (
  question: string,
  topK: number = 3
): Promise<RagAskWithContextsResponse> => {
  const apiUrl = `${RAG_API_BASE_URL}/ask`;
  console.log('[RAG API] 請求 URL:', apiUrl);
  console.log('[RAG API] 請求參數:', { question: question.substring(0, 50) + '...', top_k: topK });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超時

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        top_k: topK,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('[RAG API] 響應狀態:', response.status, response.statusText);

    if (!response.ok) {
      let errorMessage = `RAG API 請求失敗 (狀態碼: ${response.status})`;
      try {
        const errorData = await response.json();
        console.error('[RAG API] 錯誤響應:', errorData);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        const text = await response.text();
        console.error('[RAG API] 錯誤響應文本:', text);
        errorMessage = text || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('[RAG API] 成功響應:', data);
    // 後端返回格式: { answer: string, contexts: string[] }
    return {
      answer: data.answer || '無法獲取答案',
      contexts: data.contexts || []
    };
  } catch (error) {
    console.error('[RAG API] 請求異常:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('請求超時（60秒）。請稍後再試或簡化問題。');
    }
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        throw new Error(`無法連接到 RAG API (${RAG_API_BASE_URL})。請確認服務是否運行中，並檢查瀏覽器控制台是否有 CORS 錯誤。`);
      }
    }
    throw error;
  }
};

/**
 * 生成醫療報告 API（使用 Word 模板）
 * 調用報告生成 API，使用 Word 模板生成報告
 */
/**
 * 使用模板生成報告
 * 
 * @param templateName - 模板名稱
 * @param data - 報告數據
 * @param outputFormat - 輸出格式（默認 'both'）
 * @returns Promise<ReportGenerateResponse> - 報告生成響應
 */
export const generateReportWithTemplate = async (
  templateName: string,
  data: Record<string, any>,
  outputFormat: 'docx' | 'pdf' | 'both' = 'both'
): Promise<ReportGenerateResponse> => {
  const apiUrl = `${RAG_API_BASE_URL}/api/v1/generate-report`;
  console.log('[報告生成 API] 請求 URL:', apiUrl);
  console.log('[報告生成 API] 請求參數:', { template_name: templateName, output_format: outputFormat });

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_name: templateName,
        data: data,
        output_format: outputFormat,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: '報告生成失敗' }));
      throw new Error(error.detail || '報告生成失敗');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[報告生成 API] 請求異常:', error);
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        throw new Error(`無法連接到報告生成服務 (${apiUrl})。請確認後端服務是否運行中，並檢查瀏覽器控制台是否有 CORS 錯誤。`);
      }
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('報告生成失敗：未知錯誤');
  }
};

/**
 * 下載報告 API
 * 
 * @param reportId - 報告 ID
 * @param format - 文件格式（可選：'docx' 或 'pdf'）
 * @returns Promise<Blob> - 報告文件 Blob
 */
export const downloadReport = async (reportId: string, format?: 'docx' | 'pdf'): Promise<Blob> => {
  const formatParam = format ? `?format=${format}` : '';
  const apiUrl = `${RAG_API_BASE_URL}/api/v1/download/${reportId}${formatParam}`;
  console.log('[下載報告 API] 請求 URL:', apiUrl);

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const error = await response.text().catch(() => '下載失敗');
      throw new Error(error || '下載失敗');
    }

    return await response.blob();
  } catch (error) {
    console.error('[下載報告 API] 請求異常:', error);
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        throw new Error(`無法連接到報告服務 (${apiUrl})。請確認後端服務是否運行中，並檢查瀏覽器控制台是否有 CORS 錯誤。`);
      }
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('下載報告失敗：未知錯誤');
  }
};

/**
 * 獲取 RAG 知識庫文件列表
 * 
 * @returns Promise<{files: string[], files_with_folders: Array<{filename: string, folder_id: string, chunk_count: number, estimated_tokens: number, vector_size_gb: number, category: string}>}> - 文件名列表和文件-資料夾映射
 */
export const listRagFiles = async (): Promise<{ files: string[], files_with_folders: Array<{ filename: string, folder_id: string, chunk_count: number, estimated_tokens: number, vector_size_gb: number, category: string }> }> => {
  const apiUrl = `${RAG_API_BASE_URL}/files`;
  console.log('[RAG API] 獲取文件列表:', apiUrl);

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const error = await response.text().catch(() => '獲取文件列表失敗');
      throw new Error(error || '獲取文件列表失敗');
    }

    const data = await response.json();
    console.log('[RAG API] 文件列表響應:', data);
    return {
      files: data.files || [],
      files_with_folders: data.files_with_folders || []
    };
  } catch (error) {
    console.error('[RAG API] 獲取文件列表異常:', error);
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        throw new Error(`無法連接到 RAG API (${RAG_API_BASE_URL})。請確認服務是否運行中，並檢查瀏覽器控制台是否有 CORS 錯誤。`);
      }
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('獲取文件列表失敗：未知錯誤');
  }
};

/**
 * 上傳文件到 RAG 知識庫
 * 
 * @param file - 要上傳的文件
 * @returns Promise<RagFileUploadResponse> - 上傳響應
 */
export const uploadRagFile = async (file: File, folderId?: string): Promise<RagFileUploadResponse> => {
  const apiUrl = `${RAG_API_BASE_URL}/ingest_pdf${folderId ? `?folder_id=${encodeURIComponent(folderId)}` : ''}`;
  console.log('[RAG API] 上傳文件:', apiUrl, file.name, folderId);

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => '上傳失敗');
      throw new Error(error || '上傳失敗');
    }

    const data = await response.json();
    console.log('[RAG API] 上傳響應:', data);
    return data;
  } catch (error) {
    console.error('[RAG API] 上傳異常:', error);
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        throw new Error(`無法連接到 RAG API (${RAG_API_BASE_URL})。請確認服務是否運行中，並檢查瀏覽器控制台是否有 CORS 錯誤。`);
      }
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('上傳文件失敗：未知錯誤');
  }
};

/**
 * 從 RAG 知識庫刪除文件
 * 
 * @param filename - 要刪除的文件名
 * @returns Promise<RagFileDeleteResponse> - 刪除響應
 */
export const deleteRagFile = async (filename: string): Promise<RagFileDeleteResponse> => {
  const apiUrl = `${RAG_API_BASE_URL}/delete_pdf`;
  console.log('[RAG API] 刪除文件:', apiUrl, filename);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => '刪除失敗');
      throw new Error(error || '刪除失敗');
    }

    const data = await response.json();
    console.log('[RAG API] 刪除響應:', data);
    return data;
  } catch (error) {
    console.error('[RAG API] 刪除異常:', error);
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        throw new Error(`無法連接到 RAG API (${RAG_API_BASE_URL})。請確認服務是否運行中，並檢查瀏覽器控制台是否有 CORS 錯誤。`);
      }
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('刪除文件失敗：未知錯誤');
  }
};

// ==========================================================
// 知識庫資料夾管理 API
// ==========================================================

/**
 * 資料夾接口
 */
export interface KBFolder {
  id: string;
  name: string;
  type: 'system' | 'custom';
  created_at: string;
}

/**
 * 獲取所有資料夾
 * 
 * @returns Promise<KBFolder[]> - 資料夾列表
 */
export const getKBFolders = async (): Promise<KBFolder[]> => {
  const apiUrl = `${RAG_API_BASE_URL}/api/v1/kb/folders`;
  console.log('[KB API] 獲取資料夾列表:', apiUrl);

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const error = await response.text().catch(() => '獲取資料夾列表失敗');
      throw new Error(error || '獲取資料夾列表失敗');
    }

    const data = await response.json();
    console.log('[KB API] 資料夾列表響應:', data);
    return data.folders || [];
  } catch (error) {
    console.error('[KB API] 獲取資料夾列表異常:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('獲取資料夾列表失敗：未知錯誤');
  }
};

/**
 * 創建新資料夾
 * 
 * @param name - 資料夾名稱
 * @param type - 資料夾類型（'system' 或 'custom'）
 * @returns Promise<KBFolder> - 創建的資料夾
 */
export const createKBFolder = async (name: string, type: 'system' | 'custom' = 'custom'): Promise<KBFolder> => {
  const apiUrl = `${RAG_API_BASE_URL}/api/v1/kb/folders`;
  console.log('[KB API] 創建資料夾:', apiUrl, { name, type });

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, type }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => '創建資料夾失敗');
      throw new Error(error || '創建資料夾失敗');
    }

    const data = await response.json();
    console.log('[KB API] 創建資料夾響應:', data);
    return data.folder;
  } catch (error) {
    console.error('[KB API] 創建資料夾異常:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('創建資料夾失敗：未知錯誤');
  }
};

/**
 * 更新資料夾名稱
 * 
 * @param folderId - 資料夾 ID
 * @param name - 新名稱
 * @returns Promise<KBFolder> - 更新後的資料夾
 */
export const updateKBFolder = async (folderId: string, name: string): Promise<KBFolder> => {
  const apiUrl = `${RAG_API_BASE_URL}/api/v1/kb/folders/${folderId}`;
  console.log('[KB API] 更新資料夾:', apiUrl, { name });

  try {
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => '更新資料夾失敗');
      throw new Error(error || '更新資料夾失敗');
    }

    const data = await response.json();
    console.log('[KB API] 更新資料夾響應:', data);
    return data.folder;
  } catch (error) {
    console.error('[KB API] 更新資料夾異常:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('更新資料夾失敗：未知錯誤');
  }
};

/**
 * 刪除資料夾
 * 
 * @param folderId - 資料夾 ID
 * @returns Promise<void>
 */
export const deleteKBFolder = async (folderId: string): Promise<void> => {
  const apiUrl = `${RAG_API_BASE_URL}/api/v1/kb/folders/${folderId}`;
  console.log('[KB API] 刪除資料夾:', apiUrl);

  try {
    const response = await fetch(apiUrl, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.text().catch(() => '刪除資料夾失敗');
      throw new Error(error || '刪除資料夾失敗');
    }

    console.log('[KB API] 刪除資料夾成功');
  } catch (error) {
    console.error('[KB API] 刪除資料夾異常:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('刪除資料夾失敗：未知錯誤');
  }
};

// ==========================================================
// SQL Integration APIs (Patient Management & Dashboard)
// ==========================================================

import { Patient, DashboardStats } from '../types';

/**
 * 獲取儀表板統計數據 (SQL Backed)
 */
export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const apiUrl = `${RAG_API_BASE_URL}/api/v1/dashboard/stats`;
  console.log('[Dashboard API] 獲取統計數據:', apiUrl);

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`獲取統計數據失敗: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[Dashboard API] error:', error);
    throw error;
  }
};

/**
 * 獲取病患列表 (SQL Backed)
 * 暫時映射後端返回的簡單格式到前端 Patient 類型
 */
export const fetchPatients = async (skip: number = 0, limit: number = 100): Promise<Patient[]> => {
  const apiUrl = `${RAG_API_BASE_URL}/api/v1/patients?skip=${skip}&limit=${limit}`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`獲取病患列表失敗: ${response.status}`);
    }
    const data = await response.json();

    // Map backend DB model to frontend Patient interface
    // Note: Backend might return slightly different fields, we need to map them.
    // Based on models_sql.py: id, medical_record_number, name, gender, birth_date
    return data.map((p: any) => ({
      id: p.medical_record_number, // User frontend uses string ID, backend has int ID and MRN. Let's use MRN as frontend ID for now? Or keep string ID.
      // Frontend expects ID like "IEAR-LM-..." which corresponds to medical_record_number in SQL
      dbId: p.id, // Keep internal DB ID if needed
      name: p.name,
      gender: p.gender,
      age: p.birth_date ? new Date().getFullYear() - new Date(p.birth_date).getFullYear() : 0,
      visitDate: p.created_at ? p.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      diagnosis: "Loading...", // Case specific
      status: "Stable", // Default
      imageUrl: "https://picsum.photos/200", // Placeholder
      notes: "",
      exams: { left: { status: 'pending' }, right: { status: 'pending' } } // Placeholder
    }));
  } catch (error) {
    console.error('[Patient API] error:', error);
    return []; // Return empty on error to avoid crash
  }
};

/**
 * 創建新病患 (SQL Backed)
 */
export const createPatient = async (patientData: Partial<Patient>): Promise<any> => {
  // Backend API expects: name, mrn, gender, birth_date
  const apiUrl = `${RAG_API_BASE_URL}/api/v1/patients`;

  // Simple ID generation for MRN if not provided
  const mrn = patientData.id || `TEMP-${Date.now()}`;
  const queryParams = new URLSearchParams({
    name: patientData.name || 'Unknown',
    mrn: mrn,
    gender: patientData.gender || 'Male',
    birth_date: patientData.birthDate || '1980-01-01'
  });

  try {
    const response = await fetch(`${apiUrl}?${queryParams.toString()}`, {
      method: 'POST'
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `創建病患失敗: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[Patient API] Create error:', error);
    throw error;
  }
};

//JX新增
/**
 * 刪除病患
 * 對應後端: @app.delete("/api/v1/patients")
 * 修改重點: 網址不帶 ID，改由 Body 傳送 JSON
 */
export const deletePatient = async (dbId: number | string): Promise<void> => {
  // 1. 修改網址：結尾移除 /${dbId}，保持乾淨的 /api/v1/patients
  // (這裡使用 RAG_API_BASE_URL 變數，通常就是指向 http://localhost:9000)
  const apiUrl = `${RAG_API_BASE_URL}/api/v1/patients`;

  console.log('[apiService] 正在刪除病患 (Body模式), ID:', dbId);

  try {
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json' // 必填：告訴後端我傳的是 JSON
      },
      // 2. 新增 Body：將 ID 包在物件裡傳送
      // 對應後端的 class DeleteRequest(BaseModel): id: int
      body: JSON.stringify({
        id: dbId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[apiService] 刪除失敗:', response.status, errorText);
      throw new Error(`刪除失敗: ${response.status}`);
    }

    console.log('[apiService] 刪除成功');
  } catch (error) {
    console.error('[apiService] 連線異常:', error);
    throw error;
  }
};


/**
 * 移動文件到指定資料夾
 * 
 * @param filename - 文件名
 * @param folderId - 目標資料夾 ID
 * @returns Promise<void>
 */
export const moveFileToFolder = async (filename: string, folderId: string): Promise<void> => {
  const apiUrl = `${RAG_API_BASE_URL}/api/v1/kb/files/${encodeURIComponent(filename)}/folder`;
  console.log('[KB API] 移動文件:', apiUrl, { folderId });

  try {
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ folder_id: folderId }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => '移動文件失敗');
      throw new Error(error || '移動文件失敗');
    }

    console.log('[KB API] 移動文件成功');
  } catch (error) {
    console.error('[KB API] 移動文件異常:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('移動文件失敗：未知錯誤');
  }
};

/**
 * 獲取知識庫統計信息
 * 
 * @returns Promise<{points_count: number, vector_size: number, total_vector_bytes: number, total_vector_gb: number}> - 統計信息
 */
export const getKBStats = async (): Promise<{ points_count: number, vector_size: number, total_vector_bytes: number, total_vector_gb: number }> => {
  const apiUrl = `${RAG_API_BASE_URL}/api/v1/kb/stats`;
  console.log('[KB API] 獲取統計信息:', apiUrl);

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const error = await response.text().catch(() => '獲取統計信息失敗');
      throw new Error(error || '獲取統計信息失敗');
    }

    const data = await response.json();
    console.log('[KB API] 統計信息響應:', data);
    return data;
  } catch (error) {
    console.error('[KB API] 獲取統計信息異常:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('獲取統計信息失敗：未知錯誤');
  }
};

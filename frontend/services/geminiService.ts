/**
 * Gemini/LLM 服務
 * 使用 RAG API 實現醫療助手和報告生成功能
 */

import { ragAskWithContexts, ragAsk, generateReportWithTemplate, downloadReport } from './apiService';

interface PatientData {
  id: string;
  name: string;
  age: number;
  gender: string;
  visitDate: string;
  diagnosis: string;
  notes: string;
  segmentationData?: Array<{
    label: string;
    confidence: number;
    path?: string;
    color?: string;
  }>;
  doctorName?: string; // 主治醫師名稱（可選）
}

const withTimeoutAndSignal = async <T>(
  promise: Promise<T>, 
  signal?: AbortSignal
): Promise<T> => {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }

  return new Promise((resolve, reject) => {
    const abortHandler = () => {
      reject(new DOMException('Aborted', 'AbortError'));
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler);
    }

    promise.then(
      (res) => {
        if (signal) signal.removeEventListener('abort', abortHandler);
        resolve(res);
      },
      (err) => {
        if (signal) signal.removeEventListener('abort', abortHandler);
        reject(err);
      }
    );
  });
};

// Explicitly handle the 429/Resource Exhausted error
const handleGeminiError = (error: any): string => {
  const errorStr = JSON.stringify(error);
  if (errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("429")) {
    return "ERROR_CODE_429";
  }
  if (errorStr.includes("timeout") || errorStr.includes("Timeout") || errorStr.includes("超時")) {
    return "ERROR_CODE_TIMEOUT";
  }
  return "ERROR_CODE_GENERIC";
};

/**
 * 生成醫療報告 - 使用 Word 模板和 RAG API
 * 先通過 RAG API 獲取報告內容，然後使用 Word 模板生成報告
 */
export const generateMedicalReport = async (
  patient: PatientData | string,
  signal?: AbortSignal
): Promise<string> => {
  try {
    let prompt: string;
    let patientData: PatientData;
    
    // 支持舊的 API 格式（向後兼容）
    if (typeof patient === 'string') {
      // 舊格式：generateMedicalReport(patientNotes, diagnosis)
      const [patientNotes, diagnosis] = arguments as any;
      patientData = {
        id: 'UNKNOWN',
        name: 'Unknown Patient',
        age: 0,
        gender: 'Unspecified',
        visitDate: new Date().toISOString().split('T')[0],
        diagnosis: diagnosis,
        notes: patientNotes
      };
      prompt = `作為一位耳鼻喉科醫療 AI 助手，請分析以下患者資訊並生成報告。

診斷: ${diagnosis}
病歷註記: ${patientNotes}

請提供：
1. 簡化版的患者說明
2. 建議的後續步驟或治療方案（僅為一般性指導）
3. 需要關注的潛在危險信號

請以清晰的文本格式輸出。`;
    } else {
      // 新格式：generateMedicalReport({ id, name, age, ... })
      patientData = patient;
      
      // 生成病歷號碼（在 prompt 生成之前，確保 prompt 和報告使用同一個病歷號）
      const generatePatientIdForPrompt = (): string => {
        const today = new Date();
        const dateStr = today.getFullYear().toString() + 
                       String(today.getMonth() + 1).padStart(2, '0') + 
                       String(today.getDate()).padStart(2, '0');
        const dateKey = `report_count_${dateStr}`;
        const count = parseInt(sessionStorage.getItem(dateKey) || '0', 10) + 1;
        sessionStorage.setItem(dateKey, count.toString());
        return `${dateStr}-${String(count).padStart(3, '0')}`;
      };
      
      const patientRecordId = generatePatientIdForPrompt();
      // 將病歷號保存到 patientData，以便後續使用
      (patientData as any).generatedPatientId = patientRecordId;
      
      prompt = `作為一位耳鼻喉科醫療 AI 助手，請分析以下患者資訊並生成報告。

病歷號碼: GUEST-${patientRecordId}
患者編號: ${patient.id}
姓名: ${patient.name}
年齡: ${patient.age}
性別: ${patient.gender}
就診日期: ${patient.visitDate}
診斷: ${patient.diagnosis}
病歷註記: ${patient.notes}

請提供：
1. 簡化版的患者說明
2. 建議的後續步驟或治療方案（僅為一般性指導）
3. 需要關注的潛在危險信號

請在報告開頭使用以下格式：**患者報告：GUEST-${patientRecordId}**

請以清晰的文本格式輸出。`;
    }

    // 先通過 RAG API 獲取報告內容和上下文
    const ragResponse = await withTimeoutAndSignal(ragAskWithContexts(prompt, 5), signal);
    const answer = ragResponse.answer;
    const contexts = ragResponse.contexts || [];
    
    // 使用報告生成 API 生成 Word 文檔（在後台進行，不阻塞 UI）
    // 保存報告 ID 到 sessionStorage，供下載功能使用
    try {
      const templateName = 'ENT_Clinic_Record_Design_Portrait_Fixed';
      
      // 格式化就診日期為 "年 月 日" 格式
      const formatVisitDate = (dateStr: string) => {
        try {
          const date = new Date(dateStr);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const day = date.getDate();
          return { year, month, day };
        } catch (e) {
          const today = new Date();
          return { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() };
        }
      };
      
      const visitDateParts = formatVisitDate(patientData.visitDate);
      
      // 使用之前生成的病歷號（如果有的話），否則重新生成
      const patientId = (patientData as any).generatedPatientId || (() => {
        const today = new Date();
        const dateStr = today.getFullYear().toString() + 
                       String(today.getMonth() + 1).padStart(2, '0') + 
                       String(today.getDate()).padStart(2, '0');
        const dateKey = `report_count_${dateStr}`;
        const count = parseInt(sessionStorage.getItem(dateKey) || '0', 10) + 1;
        sessionStorage.setItem(dateKey, count.toString());
        return `${dateStr}-${String(count).padStart(3, '0')}`;
      })();
      
      // 判斷病灶類型（耳膜或耳道）
      const isTympanicMembraneDisease = (diagnosis: string): boolean => {
        const tmKeywords = ['Otitis media', 'Myringitis', 'Perforation', 'Tympanic', 'Eardrum', 
                           '中耳炎', '耳膜炎', '穿孔', '耳膜'];
        return tmKeywords.some(keyword => diagnosis.includes(keyword));
      };
      
      const isEarCanalDisease = (diagnosis: string): boolean => {
        const eacKeywords = ['Otitis externa', 'Cerumen', 'External', 'Canal', 
                            '外耳炎', '耳垢', '耳道'];
        return eacKeywords.some(keyword => diagnosis.includes(keyword));
      };
      
      // 處理病灶數據 - 使用新的分類信息（EAC/TM）
      const primaryDiagnosis = patientData.diagnosis || 'Normal';
      const diagnosisCategory = patientData.diagnosis_category; // 'EAC', 'TM', 'NORMAL', 'UNKNOWN'
      const diagnosisZh = patientData.diagnosis_zh; // 中文名稱
      const diagnosisEn = patientData.diagnosis_en || primaryDiagnosis; // 英文名稱
      
      // 如果有完整的分析數據，使用 EAC/TM 分類
      let rightEarEAC = '正常';
      let rightEarTM = '正常';
      let leftEarEAC = '正常';
      let leftEarTM = '正常';
      
      // 獲取選擇的耳側（默認為右耳）
      const earSide = patientData.earSide || 'Right';
      const isLeftEar = earSide === 'Left';
      
      console.log('[報告生成] 診斷信息:', {
        primaryDiagnosis,
        diagnosisCategory,
        diagnosisZh,
        diagnosisEn,
        earSide,
        isLeftEar,
        eac_detections: patientData.eac_detections,
        tm_detections: patientData.tm_detections
      });
      
      // 根據選擇的耳側填充對應欄位
      // 優先使用分類信息
      if (diagnosisCategory === 'EAC' && primaryDiagnosis !== 'Normal' && primaryDiagnosis !== 'normal') {
        // 耳道疾病
        const diagnosisValue = diagnosisZh || diagnosisEn || primaryDiagnosis;
        if (isLeftEar) {
          leftEarEAC = diagnosisValue;
          console.log('[報告生成] 設置左耳耳道:', leftEarEAC);
        } else {
          rightEarEAC = diagnosisValue;
          console.log('[報告生成] 設置右耳耳道:', rightEarEAC);
        }
      } else if (diagnosisCategory === 'TM' && primaryDiagnosis !== 'Normal' && primaryDiagnosis !== 'normal') {
        // 耳膜疾病
        const diagnosisValue = diagnosisZh || diagnosisEn || primaryDiagnosis;
        if (isLeftEar) {
          leftEarTM = diagnosisValue;
          console.log('[報告生成] 設置左耳耳膜:', leftEarTM);
        } else {
          rightEarTM = diagnosisValue;
          console.log('[報告生成] 設置右耳耳膜:', rightEarTM);
        }
      } else if (diagnosisCategory === 'NORMAL' || primaryDiagnosis === 'Normal' || primaryDiagnosis === 'normal') {
        // 正常 - 保持默認值「正常」
        if (isLeftEar) {
          leftEarEAC = '正常';
          leftEarTM = '正常';
        } else {
          rightEarEAC = '正常';
          rightEarTM = '正常';
        }
      } else if (diagnosisCategory) {
        // 如果有分類但不在上述情況，嘗試使用中文名稱
        if (diagnosisZh) {
          if (diagnosisCategory === 'EAC') {
            if (isLeftEar) {
              leftEarEAC = diagnosisZh;
            } else {
              rightEarEAC = diagnosisZh;
            }
          } else if (diagnosisCategory === 'TM') {
            if (isLeftEar) {
              leftEarTM = diagnosisZh;
            } else {
              rightEarTM = diagnosisZh;
            }
          }
        }
      } else {
        // 如果沒有分類信息，使用舊的判斷邏輯（向後兼容）
        const hasSegmentation = patientData.segmentationData && patientData.segmentationData.length > 0;
        const diagnosisLabel = hasSegmentation ? patientData.segmentationData![0].label : primaryDiagnosis;
        const isTM = isTympanicMembraneDisease(diagnosisLabel);
        const isEAC = isEarCanalDisease(diagnosisLabel);
        
        const getDisplayName = (label: string): string => {
          if (label === 'Normal' || label === 'Background') return '正常';
          // 簡單的翻譯映射（如果需要可以擴展）
          const translations: Record<string, string> = {
            "Eardrum perforation": "耳膜破洞",
            "Atrophic scar": "萎縮性疤痕",
            "Middle ear effusion": "中耳積液",
            "Normal": "正常"
          };
          const key = Object.keys(translations).find(k => k.toLowerCase() === label.toLowerCase());
          return key ? translations[key] : label;
        };
        
        const diagnosisValue = (isEAC || isTM) && diagnosisLabel !== 'Normal' ? getDisplayName(diagnosisLabel) : '正常';
        if (isLeftEar) {
          leftEarEAC = isEAC ? diagnosisValue : '正常';
          leftEarTM = isTM ? diagnosisValue : '正常';
        } else {
          rightEarEAC = isEAC ? diagnosisValue : '正常';
          rightEarTM = isTM ? diagnosisValue : '正常';
        }
      }
      
      // 綜合診斷：使用中文名稱（如果有的話）
      const diagnosisDisplay = (diagnosisZh && primaryDiagnosis !== 'Normal') 
        ? diagnosisZh 
        : (primaryDiagnosis !== 'Normal' ? primaryDiagnosis : '正常');
      
      // 新模板格式的報告數據（僅包含模板需要的變數）
      const reportData: Record<string, any> = {
        // 基本信息區域
        patient_id: patientId, // 病歷號碼（今日日期+序號，格式：YYYYMMDD-XXX）
        patient_name: patientData.name, // 姓名
        visit_year: visitDateParts.year, // 就診日期 - 年
        visit_month: visitDateParts.month, // 就診日期 - 月
        visit_day: visitDateParts.day, // 就診日期 - 日
        doctor_name: patientData.doctorName || 'Dr.AI', // 主治醫師
        
        // 右耳區域
        right_ear_eac: rightEarEAC, // 右耳耳道 (External Auditory Canal)
        right_ear_tm: rightEarTM, // 右耳耳膜 (Tympanic Membrane)
        // right_ear_tm_percent: 0,  // 右耳耳膜百分比（可選，如果需要可以添加）
        
        // 左耳區域
        left_ear_eac: leftEarEAC, // 左耳耳道 (External Auditory Canal)
        left_ear_tm: leftEarTM, // 左耳耳膜 (Tympanic Membrane)
        // left_ear_tm_percent: 0,   // 左耳耳膜百分比（可選，如果需要可以添加）
        
        // 診斷區域
        diagnosis: diagnosisDisplay, // 綜合診斷 / 醫囑 (Impression / Orders)
        orders: answer || patientData.notes || '', // 醫囑內容
      };

      // 生成 Word 和 PDF 版本（PDF 用於前端預覽）
      const reportResult = await generateReportWithTemplate(templateName, reportData, 'both');
      if (reportResult.docx) {
        // 生成文件名：Clinical_Report_GUEST-{病例號}.docx（病例號就是 patientId）
        const fileName = `Clinical_Report_GUEST-${patientId}.docx`;
        
        // 保存報告 ID 供下載使用
        const reportInfo = {
          reportId: reportResult.docx.report_id,
          downloadUrl: reportResult.docx.download_url,
          fileId: reportResult.docx.file_id,
          patientId: patientData.id, // 原始 patient ID
          patientRecordId: patientId, // 病例號（報告中使用的 ID，格式：YYYYMMDD-XXX）
          patientName: patientData.name,
          fileName: fileName, // 自定義文件名
          pdfDownloadUrl: reportResult.pdf?.download_url || null, // PDF 下載 URL（用於預覽）
          pdfReportId: reportResult.pdf?.report_id || null
        };
        sessionStorage.setItem(`report_${patientData.id}_${Date.now()}`, JSON.stringify(reportInfo));
        // 同時保存到 lastGeneratedReport 供快速訪問
        sessionStorage.setItem('lastGeneratedReport', JSON.stringify(reportInfo));
      }
    } catch (reportError) {
      console.warn('Word 報告生成失敗，僅返回文本內容:', reportError);
      // 如果報告生成失敗，繼續返回文本內容
    }
    
    // 檢查報告是否成功生成
    const lastReportInfo = sessionStorage.getItem('lastGeneratedReport');
    if (lastReportInfo) {
      try {
        const reportInfo = JSON.parse(lastReportInfo);
        if (reportInfo.downloadUrl) {
          // 返回報告下載資訊（用於下載 Word 文件）
          return `REPORT_DOWNLOAD:${JSON.stringify(reportInfo)}`;
        }
      } catch (e) {
        console.warn('無法解析報告信息:', e);
      }
    }
    
    // 如果報告生成失敗，返回錯誤信息
    throw new Error('報告生成失敗，請稍後再試');
  } catch (error: any) {
    if (error.name === 'AbortError') throw error;
    console.error("報告生成錯誤:", error);
    return handleGeminiError(error);
  }
};

/**
 * 與醫療助手聊天 - 使用 RAG API
 */
export const chatWithMedicalAssistant = async (
  message: string, 
  history: { role: string, text: string }[],
  context?: string,
  signal?: AbortSignal
): Promise<string> => {
  try {
    // 構建包含上下文和歷史記錄的查詢
    let fullQuestion = "作為一位專業的耳鼻喉科醫療 AI 助手，請回答以下問題。\n\n";
    
    if (context) {
      fullQuestion += `[系統上下文/診斷結果]:\n${context}\n\n`;
    }

    // 添加對話歷史（最近的幾條）
    if (history.length > 1) {
      const recentHistory = history.slice(-4); // 只使用最近的 4 條消息
      fullQuestion += "對話歷史:\n";
      recentHistory.forEach(msg => {
        if (typeof msg.text === 'string') {
          fullQuestion += `${msg.role === 'user' ? '醫生' : 'AI'}: ${msg.text}\n`;
        }
      });
      fullQuestion += "\n";
    }
    
    fullQuestion += `問題: ${message}`;

    const answer = await withTimeoutAndSignal(ragAsk(fullQuestion, 3), signal);
    return answer || "抱歉，我無法生成回應。";
  } catch (error: any) {
    if (error.name === 'AbortError') return "[Stopped]";
    console.error("RAG Chat Error:", error);
    return handleGeminiError(error);
  }
};

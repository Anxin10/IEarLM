# IEAR-LM 前端應用 (Frontend)

本目錄包含 **IEAR-LM (Intelligent Ear Analysis and Learning Management)** 系統的 Web 前端應用，提供耳鼻喉科專用之現代化醫療輔助診斷介面。

---

## 核心功能與頁面

- **病患管理系統 (Patient Management)**：病歷清單、新增/編輯病患資料、過往就醫記錄檢視。
- **耳鏡即時串流 (Otoscope Stream)**：即時接收數位耳鏡影像畫面、自動拍照截圖與多視角耳鏡影像比對。
- **AI 輔助診斷介面 (AI Diagnosis)**：
  - 耳鏡圖像上傳與自動裁切（外耳道 EAC / 耳膜 TM 分割檢測）
  - 整合 YOLOv7-seg API 即時標註病灶區域與信心分數
  - 診斷病徵自動儲存至後端資料庫（SQL Persistence）
- **RAG 知識問答與臨床助理 (Clinical Assistant)**：
  - 結合向量資料庫檢索醫學文獻，輔助醫師解答耳科臨床疑難雜症
- **語音輸入輔助 (Speech-to-Text)**：
  - 支援以語音快速錄入病歷診斷描述與醫囑
- **專業醫療診斷報告編輯 (Report Editor)**：
  - 富文本醫療報告編輯、病灶影像插入、格式化排版與匯出

---

## 技術棧

- **核心框架**: React 19, TypeScript
- **建置工具**: Vite 6
- **樣式庫**: Tailwind CSS, PostCSS, Lucide React (Icons)
- **動畫與圖表**: Framer Motion, Recharts
- **通訊協議**: REST API, MQTT, WebSocket / UDP Stream

---

## 本地開發與運行

### 1. 安裝依賴

```bash
cd frontend
npm install
```

### 2. 環境變數配置

在 `frontend` 目錄下建立 `.env.local` 檔案（若尚未建立）：

```env
# YOLOv7 圖像分析 API 位置 (預設 5000)
VITE_DETECTION_API_BASE_URL=http://localhost:5000/api

# RAG 知識庫與個案管理 API 位置 (預設 9000)
VITE_RAG_API_BASE_URL=http://localhost:9000
```

### 3. 啟動開發伺服器

```bash
npm run dev
```

開發伺服器啟動後，開啟瀏覽器造訪：`http://localhost:3000`

### 4. 生產環境建置與預覽

```bash
# 建置打包
npm run build

# 本地預覽生產版本
npm run preview
```

---

## 目錄結構說明

```
frontend/
├── components/                  # React UI 組件
│   ├── AIDiagnosis.tsx          # AI 診斷主介面
│   ├── AIDiagnosisForm.tsx      # 診斷病理紀錄表單
│   ├── PatientList.tsx          # 病患列表清單
│   ├── PatientDetail.tsx        # 病患詳細資料與歷程
│   ├── ReportEditor.tsx         # 報告編輯器組件
│   ├── UserManagement.tsx       # 帳號權限管理
│   └── patient_detail/          # 病患詳情子面板（串流、多媒體、臨床數據）
├── services/                    # 前端服務模組
│   ├── apiService.ts            # 後端 API 通訊服務
│   ├── authService.ts           # 認證與登入服務
│   ├── geminiService.ts         # LLM 輔助生成服務
│   └── translations.ts          # 系統多語系對照
├── types.ts                     # TypeScript 型別定義
├── index.html                   # HTML 入口
├── index.tsx                    # React 掛載入口
├── App.tsx                      # 路由與主排版
└── vite.config.ts               # Vite 建置配置
```

---

## 授權 (License)

本專案採用 [MIT License](../LICENSE) 開源授權。

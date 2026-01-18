# IEAR-LM (Intelligent Ear Analysis and Learning Management)

耳科疾病智能診斷系統 - 整合圖像檢測和 RAG 問答的完整解決方案

## 項目簡介

IEAR-LM 是一個完整的耳科疾病診斷系統，包含：
- **前端界面**: React + TypeScript 構建的現代化 Web 應用
- **圖像檢測 API**: 基於 YOLOv7-seg 的耳鏡圖像分割檢測
- **RAG 問答 API**: 基於 Ollama 和 Qdrant 的知識庫問答系統

## 項目結構

```
web-server/
├── frontend/                    # 前端應用（npm 部署）
│   ├── components/             # React 組件
│   ├── services/               # API 服務
│   ├── package.json           # 前端依賴配置
│   └── README.md              # 前端說明
│
├── backend/                    # 後端服務
│   ├── api-server-yolov7seg/  # YOLOv7 圖像檢測 API
│   │   ├── server/            # API 服務器代碼
│   │   ├── weights/           # 模型權重文件
│   │   └── docs/              # API 文檔
│   │
│   └── api-server-ollama2rag/  # RAG 問答 API
│       ├── server/            # API 服務器代碼
│       └── qdrant_storage/    # Qdrant 數據存儲
│
├── docs/                       # 說明文件資料夾
│   ├── README.md              # 本文件（完整專案說明）
│   ├── QUICK_START.md         # 快速開始指南
│   └── ...
│
├── deploy/                     # 快速部署資料夾
│   └── (部署相關文件)
│
├── logs/                       # 日誌文件
└── README.md                  # 專案入口說明
```

## 快速開始

### 部署架構

- **前端**: 使用 npm 本地部署（開發模式或生產構建）
- **後端**: 手動啟動後端服務

### 前置需求

- **Node.js 18+** - 前端開發和構建
- **Python 3.9+** - 後端服務
- **CUDA** (可選) - GPU 加速

### 1. 部署後端服務

請參考各後端服務的 README 文檔進行手動部署：
- [RAG API README](backend/api-server-ollama2rag/README.md)
- [YOLOv7 API 文檔](backend/api-server-yolov7seg/docs/API.md)

### 2. 部署前端服務（npm）

```bash
# 進入前端目錄
cd frontend

# 安裝依賴
npm install

# 開發模式啟動（端口 3000）
npm run dev

# 或構建生產版本
npm run build
npm run preview
```

詳細說明請參考 [QUICK_START.md](QUICK_START.md)（本目錄）

## 服務端口

| 服務 | 端口 | 說明 |
|------|------|------|
| 前端 | 3000 | React 開發服務器 |
| YOLOv7 API | 5000 | 圖像檢測 API |
| RAG API | 9000 | 知識庫問答 API |
| Qdrant | 6333 | 向量資料庫 |
| Ollama | 11434 | LLM 服務 |

## 功能特性

### 前端 (Frontend)

- ✅ 現代化 React + TypeScript 界面
- ✅ 患者管理系統
- ✅ AI 診斷界面（圖像上傳和檢測）
- ✅ RAG 知識庫問答
- ✅ 開機自動啟動支援（Windows/Linux）
- ✅ 快速啟動/停止腳本

### YOLOv7 檢測 API

- ✅ 耳鏡圖像自動裁切（基於圓形檢測）
- ✅ YOLOv7-seg 目標檢測和分割
- ✅ 座標轉換（裁切座標 ↔ 原始座標）
- ✅ GPU/CPU 自動檢測
- ✅ 可配置的置信度和 IoU 閾值
- ✅ Docker 容器化支援

### RAG 問答 API

- ✅ 基於 Ollama 的 LLM 問答
- ✅ Qdrant 向量資料庫
- ✅ PDF 文檔批量導入
- ✅ 知識庫管理

## 文檔

- 🚀 [快速開始指南](QUICK_START.md) - 快速部署和啟動說明（本目錄）
- 📝 [前端 README](../frontend/README.md) - 前端開發指南
- 📖 [專案入口說明](../README.md) - 專案結構導航

### API 文檔

- [YOLOv7 API 文檔](../backend/api-server-yolov7seg/docs/API.md) - 圖像檢測 API
- [RAG API 文檔](../backend/api-server-ollama2rag/docs/API.md) - 知識庫問答 API（詳細端點說明）

## 環境變數配置

### 前端環境變數

創建 `frontend/.env.local`:

```env
VITE_DETECTION_API_BASE_URL=http://localhost:5000/api
VITE_RAG_API_BASE_URL=http://localhost:9000
```

### 後端環境變數

請參考各後端服務的 README 文檔進行環境變數配置。

## 開機自動啟動

請根據您的部署方式配置相應的開機自動啟動服務。

## 快速操作命令

### 前端服務（npm）

```bash
cd frontend

# 開發模式
npm run dev

# 構建生產版本
npm run build

# 預覽生產版本
npm run preview
```

## 開發指南

### 前端開發

```bash
cd frontend
npm install          # 安裝依賴
npm run dev         # 啟動開發服務器（端口 3000）
npm run build       # 構建生產版本
```

### 後端開發

請參考各後端服務的 README 文檔進行開發。

## 故障排除

詳細的故障排除指南請參考 [QUICK_START.md](QUICK_START.md)（本目錄）

### 常見問題

1. **端口被占用**: 檢查端口占用情況，修改配置
2. **前端無法連接後端**: 檢查環境變數配置和服務狀態
3. **GPU 不可用**: 檢查 NVIDIA 驅動和 GPU 支持

## 技術棧

### 前端
- React 19
- TypeScript
- Vite
- React Router
- Framer Motion
- Recharts

### 後端
- Python 3.9
- Flask
- PyTorch
- YOLOv7-seg
- Ollama
- Qdrant

### 部署
- npm (前端)
- Systemd (Linux)
- Task Scheduler (Windows)

## 許可證

[根據項目實際情況填寫]

## 貢獻

歡迎提交 Issue 和 Pull Request。

## 聯繫方式

[根據項目實際情況填寫]


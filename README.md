# IEAR-LM (Intelligent Ear Analysis and Learning Management)

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Python](https://img.shields.io/badge/Python-3.9%2B-blue.svg)
![Node](https://img.shields.io/badge/Node-18%2B-green.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg)

**耳科疾病智能診斷系統 - 整合圖像檢測和 RAG 問答的完整解決方案**

[系統完整文檔](docs/README.md) • [快速開始指南](docs/QUICK_START.md) • [問題回報](https://github.com/Anxin10/IEarLM/issues)

</div>

---

## 專案簡介

**IEAR-LM** 是一套專為耳鼻喉科（ENT）診所與醫療人員設計的智慧輔助診斷系統。透過整合高精準度的電腦視覺模型與檢索增強生成（RAG）知識庫，為臨床醫師提供全方位的耳鏡影像分析、即時問答輔助、病歷管理與自動化診斷報告產生。

### 核心功能

- **AI 影像分割與檢測**：基於 YOLOv7-seg 模型，具備耳鏡動態圓形自動裁切與外耳道 (EAC) / 耳膜 (TM) 病徵精準辨識。
- **RAG 醫療知識問答**：基於 Ollama 本地 LLM 與 Qdrant 向量檢索資料庫，提供專業耳科文獻依據與診療建議。
- **病患與個案管理**：以 SQLModel (SQLite) 完整記錄病患歷史、檢測影像與病理特徵（SQL Persistence for EAC/TM Findings）。
- **即時耳鏡串流**：支援數位耳鏡 UDP 串流即時接收與畫面擷取。
- **語音輸入與報告生成**：整合 STT 語音輔助輸入及富文本診斷報告編輯器，支援一鍵匯出醫療報告。

> **Latest Update (2026-01-21):**
> - **SQL Persistence for Findings**: Implemented full database storage for pathological findings (EAC/TM).
> - **New API Endpoints**: Added `PUT /api/v1/cases/{id}` and `POST /api/v1/cases/{id}/diagnosis` for saving diagnosis results.
> - **Documentation**: Fully translated `models_sql.py` comments to Traditional Chinese and added detailed field descriptions.

---

## 專案架構

```
web-server/
├── frontend/                     # 前端 Web 應用（React 19 + TypeScript + Vite）
│   ├── components/               # UI 組件（病患管理、AI 診斷、報告編輯）
│   ├── services/                 # 後端 API 服務與串流調用模組
│   └── package.json              # 前端依賴配置
│
├── backend/                      # 後端微服務
│   ├── api-server-yolov7seg/     # YOLOv7-seg 圖像分割檢測 API (Port 5000)
│   │   ├── server/               # Flask 核心推論程式
│   │   └── weights/              # 模型權重檔案 (best.pt)
│   │
│   └── api-server-ollama2rag/    # RAG 知識庫與個案管理 API (Port 9000)
│       ├── server/               # FastAPI 核心服務（個案管理、RAG 管線、耳鏡控制）
│       └── qdrant_storage/       # Qdrant 向量索引儲存
│
├── deploy/                       # 部署與服務管理腳本
│   ├── quick-deploy.sh          # 一鍵啟動後端腳本
│   ├── stop-services.sh         # 服務停止腳本
│   └── status.sh                # 服務狀態查詢腳本
│
├── docs/                         # 說明文件庫
│   ├── README.md                 # 系統完整技術說明
│   ├── QUICK_START.md            # 快速入門指南
│   └── SQL_SCHEMA.md             # 資料庫架構與 ER 圖
│
├── .github/                      # GitHub 協作範本
│   ├── ISSUE_TEMPLATE/           # Bug 報告與新功能提案範本
│   └── pull_request_template.md  # PR 檢查清單
│
├── CONTRIBUTING.md               # 開源協作與貢獻指南
├── LICENSE                       # MIT 開源授權條款
└── README.md                     # 本檔案（專案總覽）
```

---

## 快速開始

### 1. 環境前置需求

- **Node.js**: 18.0 或更高版本
- **Python**: 3.9 或更高版本（建議搭配 Anaconda 或 Python venv）
- **Ollama**: 本地 LLM 服務已啟動（預設埠號 11434）
- **Qdrant**: 向量資料庫（預設埠號 6333）

### 2. 後端服務啟動

使用快速部署腳本一鍵啟動後端服務（包含 RAG 與 YOLOv7-seg）：

```bash
# 賦予執行權限並啟動
chmod +x deploy/*.sh
./deploy/quick-deploy.sh
```

或手動分別啟動：
- **RAG API (Port 9000)**: 請參閱 [RAG API README](backend/api-server-ollama2rag/README.md)
- **YOLOv7 API (Port 5000)**: 請參閱 [YOLOv7 API 文檔](backend/api-server-yolov7seg/docs/API.md)

### 3. 前端應用啟動

```bash
cd frontend

# 安裝依賴
npm install

# 啟動開發伺服器（預設 http://localhost:3000）
npm run dev
```

詳細操作說明請參閱 [快速開始指南](docs/QUICK_START.md) 與 [前端開發文檔](frontend/README.md)。

---

## 服務埠號對照表

| 服務模組 | 連接埠 (Port) | 說明 |
| :--- | :--- | :--- |
| **Frontend Web** | `3000` | React + Vite 開發伺服器 |
| **YOLOv7-seg API** | `5000` | 耳鏡影像檢測與分割服務 (Flask) |
| **RAG & Case API** | `9000` | 個案管理、知識庫問答與耳鏡串流服務 (FastAPI) |
| **Qdrant Vector DB** | `6333` | 醫學文獻向量索引資料庫 |
| **Ollama LLM** | `11434` | 本地語言模型推論服務 |

---

## 文檔導航

- 📖 [完整專案說明](docs/README.md)
- 🚀 [快速開始指南](docs/QUICK_START.md)
- 📝 [前端開發指南](frontend/README.md)
- 🧠 [RAG API 服務說明](backend/api-server-ollama2rag/README.md)
- 🔬 [YOLOv7-seg API 文檔](backend/api-server-yolov7seg/docs/API.md)
- 🗄️ [SQL 資料庫架構與 ER 圖](docs/SQL_SCHEMA.md)

---

## 貢獻指南

我們非常歡迎社群開發者參與 IEAR-LM 的改進！在提交貢獻前，請先閱讀 [CONTRIBUTING.md](CONTRIBUTING.md) 以瞭解分支命名規範、Commit Message 格式與 Pull Request 流程。

- 發現問題？歡迎提交 [Bug Report](https://github.com/Anxin10/IEarLM/issues/new?template=bug_report.md)。
- 有好點子？歡迎提交 [Feature Request](https://github.com/Anxin10/IEarLM/issues/new?template=feature_request.md)。

---

## 許可證 (License)

本專案採用 [MIT License](LICENSE) 開源授權，歡迎自由使用、學習與擴充。

---

## 聯繫方式

- **專案維護者**: Anxin10
- **GitHub 倉庫**: [https://github.com/Anxin10/IEarLM](https://github.com/Anxin10/IEarLM)
- **問題反映**: [GitHub Issues](https://github.com/Anxin10/IEarLM/issues)

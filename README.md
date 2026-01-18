# IEAR-LM (Intelligent Ear Analysis and Learning Management)

耳科疾病智能診斷系統 - 整合圖像檢測和 RAG 問答的完整解決方案

## 專案結構

```
web-server/
├── frontend/              # 前端應用（npm 部署）
│   ├── components/        # React 組件
│   ├── services/          # API 服務
│   └── ...
│
├── backend/              # 後端服務
│   ├── api-server-yolov7seg/   # YOLOv7 圖像檢測 API
│   └── api-server-ollama2rag/  # RAG 問答 API
│
├── docs/                  # 說明文件資料夾
│   ├── README.md          # 完整專案說明
│   ├── QUICK_START.md     # 快速開始指南
│   └── ...
│
├── deploy/                # 快速部署資料夾
│   ├── quick-deploy.sh   # 一鍵部署腳本
│   ├── stop-services.sh  # 停止服務腳本
│   ├── status.sh         # 查看狀態腳本
│   └── README.md         # 部署說明
│
└── README.md             # 本文件（專案入口）
```

## 快速開始

### 1. 查看完整文檔

請參考 [docs/README.md](docs/README.md) 查看完整的專案說明。

### 2. 快速部署後端服務

使用快速部署腳本一鍵啟動所有後端服務：

```bash
./deploy/quick-deploy.sh
```

詳細說明請參考 [deploy/README.md](deploy/README.md) 和 [docs/QUICK_START.md](docs/QUICK_START.md)。

## 資料夾說明

- **frontend/** - 前端應用代碼
- **backend/** - 後端服務代碼
- **docs/** - 所有說明文件（README、快速開始、技術文檔等）
- **deploy/** - 部署相關文件和腳本

## 文檔導航

- 📖 [完整專案說明](docs/README.md)
- 🚀 [快速開始指南](docs/QUICK_START.md)
- 📝 [前端 README](frontend/README.md)

### API 文檔

- [YOLOv7 API 文檔](backend/api-server-yolov7seg/docs/API.md) - 圖像檢測 API
- [RAG API 文檔](backend/api-server-ollama2rag/docs/API.md) - 知識庫問答 API（詳細端點說明）

# RAG 知識庫與臨床個案管理 API (api-server-ollama2rag)

基於 **FastAPI**、**Ollama** 與 **Qdrant** 的耳科智慧輔助診斷後端服務。提供檢索增強生成（RAG）問答、病患個案管理（SQLModel/SQLite）、耳鏡 UDP 串流接收與影像報告生成。

---

## 核心功能

- 🧠 **RAG 醫學知識庫問答**：利用 Qdrant 向量檢索耳科醫學文獻，並透過 Ollama 本地 LLM 生成專業臨床建議與診斷參考。
- 📋 **病患個案與病理特徵儲存 (SQL Persistence)**：提供個案 CRUD，支援 EAC/TM 病理特徵 (`pathological_findings`) 持久化存儲。
- 📷 **數位耳鏡串流整合**：接收耳鏡 UDP 視訊串流，提供網頁端即時預覽與拍照截圖。
- 📄 **診斷報告產出**：依據診斷紀錄自動套用範本並產出格式化醫學報告。
- 📊 **Ragas 評估模組**：內建 Ragas 評估腳本，可自動化量化 RAG 檢索精度與生成品質。

---

## 服務埠號與依賴

- **API 服務端口**: `9000`
- **Qdrant 向量資料庫**: `6333`
- **Ollama LLM 服務**: `11434`
- **耳鏡控制/串流**: `9999`

---

## 快速開始

### 方法 1：使用 Docker Compose（推薦）

專案提供完整的 `docker-compose.yml`，可一鍵啟動 API、Qdrant 與相關相依服務：

```bash
cd backend/api-server-ollama2rag

# 啟動所有後端服務
docker-compose up -d

# 查看運行日誌
docker-compose logs -f
```

### 方法 2：本機 Python 環境啟動

#### 1. 安裝相依套件

確保已安裝 Python 3.9+，建議使用虛擬環境：

```bash
cd backend/api-server-ollama2rag/server

# 安裝 Python 依賴
pip install -r requirements.txt
```

#### 2. 設定環境變數

在 `server/` 目錄建立或檢查 `.env` 檔案：

```env
OLLAMA_BASE_URL=http://localhost:11434
QDRANT_HOST=localhost
QDRANT_PORT=6333
DATABASE_URL=sqlite:///./sql_app.db
```

#### 3. 啟動 FastAPI 服務

```bash
# 在 server 目錄下啟動
uvicorn app:app --host 0.0.0.0 --port 9000 --reload
```

---

## 文檔與 API 參考

- 📖 **詳細 API 文檔**: 請參閱 [docs/API.md](docs/API.md)（涵蓋問答 `/ask`、個案管理 `/api/v1/cases` 等端點）
- 🗄️ **資料庫架構與 ER 圖**: 請參閱 [../../docs/SQL_SCHEMA.md](../../docs/SQL_SCHEMA.md)

---

## 授權 (License)

本服務模組採用 [MIT License](../../LICENSE) 開源授權。

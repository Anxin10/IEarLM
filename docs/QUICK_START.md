# iEarLM 快速開始指南

## 部署架構

- **前端**: 使用 npm 本地部署（開發模式或生產構建）
- **後端**: 手動啟動後端服務

## 快速部署步驟

### 1. 部署後端服務

請參考各後端服務的 README 文檔進行手動部署：
- [RAG API README](../backend/api-server-ollama2rag/README.md)
- [YOLOv7 API 文檔](../backend/api-server-yolov7seg/docs/API.md)

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

## 服務端口

| 服務 | 端口 | 說明 |
|------|------|------|
| 前端開發服務器 | 3000 | `npm run dev` |
| RAG API | 9000 | 知識庫問答 API |
| YOLOv7 API | 5000 | 圖像檢測 API |
| Qdrant | 6333 | 向量資料庫 |
| Ollama | 11434 | LLM 服務 |

## 驗證部署

### 檢查後端服務

```bash
# 檢查服務健康狀態
curl http://localhost:9000/health  # RAG API
curl http://localhost:5000/health  # YOLOv7 API
```

### 檢查前端服務

打開瀏覽器訪問：`http://localhost:3000`

## 常用命令

### 前端服務管理

```bash
# 開發模式
cd frontend
npm run dev

# 構建生產版本
npm run build

# 預覽生產版本
npm run preview
```

## 環境變數配置

### 前端環境變數

創建 `frontend/.env.local`:

```env
VITE_DETECTION_API_BASE_URL=http://localhost:5000/api
VITE_RAG_API_BASE_URL=http://localhost:9000
```

### 後端環境變數

請參考各後端服務的 README 文檔進行環境變數配置。

## 故障排除

### 端口被占用

```bash
# 檢查端口占用
sudo lsof -i :9000
sudo lsof -i :5000
sudo lsof -i :3000

# 修改端口（在 vite.config.ts 或後端服務配置中）
```

### 後端服務無法啟動

請參考各後端服務的 README 文檔進行故障排除。

### 前端依賴安裝失敗

```bash
# 清理並重新安裝
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## 下一步

部署完成後，請查看：
- [README.md](README.md) - 完整專案說明（本目錄）
- [../README.md](../README.md) - 專案入口說明

# 後端服務器連接問題修復指南

## 問題診斷

如果前端顯示「無法連接到後端服務器」，請檢查以下項目：

## 1. 檢查服務狀態

### Ollama API (端口 9000)
```bash
cd backend/api-server-ollama2rag
docker compose ps
```

應該看到 `iear-lm-server-api` 狀態為 `Up`。

### YOLOv7 API (端口 5000)
```bash
cd backend/api-server-yolov7seg
docker compose ps
```

應該看到 `iear-lm-yolov7-seg-api` 狀態為 `Up`。

## 2. 檢查服務健康狀態

### Ollama API
```bash
curl http://localhost:9000/health
```
應該返回：`{"status":"ok"}`

### YOLOv7 API
```bash
curl http://localhost:5000/api/health
```
應該返回：`{"detector_loaded":true,"status":"healthy"}`

## 3. 檢查網絡連接

### 從 Ollama API 容器訪問 YOLOv7 API
```bash
cd backend/api-server-ollama2rag
docker compose exec api curl http://host.docker.internal:5000/api/health
```

應該返回健康狀態。

## 4. 啟動所有服務

如果服務未運行，請啟動：

```bash
# 啟動 YOLOv7 API
cd backend/api-server-yolov7seg
docker compose up -d

# 啟動 Ollama API (包含 Qdrant 和 Ollama)
cd ../api-server-ollama2rag
docker compose up -d
```

## 5. 檢查前端配置

前端在開發環境使用代理：
- `/api/rag` → `http://localhost:9000`
- `/api/detection` → `http://localhost:5000`

確保 `vite.config.ts` 中的代理配置正確。

## 6. 檢查防火牆

確保以下端口未被防火牆阻擋：
- 3000 (前端)
- 5000 (YOLOv7 API)
- 9000 (Ollama API)

## 7. 重新構建容器（如果代碼更新）

如果更新了後端代碼，需要重新構建：

```bash
cd backend/api-server-ollama2rag
docker compose build api
docker compose up -d api
```

## 常見錯誤

### 錯誤：404 Not Found
- 檢查端點路徑是否正確
- 確認新代碼已重新構建到容器中

### 錯誤：Connection refused
- 檢查服務是否運行
- 檢查端口是否正確映射
- 檢查 Docker 網絡配置

### 錯誤：ModuleNotFoundError
- 確認新文件已複製到容器中
- 重新構建 Docker 鏡像

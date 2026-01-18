# Frontend 部署狀態

## ✅ 部署完成

**部署目錄**: `/home/icps806/hdd_1_2tb/minyu/web-server/frontend`

**服務狀態**:
- ✅ 前端服務運行中 (端口 3000)
- ✅ 依賴已安裝 (node_modules 存在)
- ✅ 配置文件已就緒

## 📋 配置信息

### 端口配置
- **前端服務**: `http://localhost:3000`
- **後端 RAG API**: `http://localhost:9000` (代理: `/api/rag`)
- **YOLOv7 API**: `http://localhost:5000` (代理: `/api/detection`)

### 代理配置
前端通過 Vite 代理連接後端服務：
- `/api/rag` → `http://localhost:9000`
- `/api/detection` → `http://localhost:5000/api`

## 🚀 啟動/停止命令

```bash
# 啟動服務
cd /home/icps806/hdd_1_2tb/minyu/web-server
./scripts/start.sh

# 停止服務
./scripts/stop.sh

# 查看狀態
./scripts/status.sh

# 查看日誌
./scripts/logs.sh frontend
```

## 📝 注意事項

1. **frontend2 已停用**: 所有部署腳本已指向 `frontend` 目錄
2. **獨立運行**: `frontend` 和 `frontend2` 互不影響
3. **環境變量**: 確保 `.env` 文件中配置了 `GEMINI_API_KEY`（如果使用）

## 🔧 故障排除

如果服務無法啟動：
1. 檢查端口 3000 是否被佔用: `lsof -i :3000`
2. 查看日誌: `./scripts/logs.sh frontend`
3. 重新安裝依賴: `cd frontend && npm install`
4. 檢查配置文件: `frontend/vite.config.ts`

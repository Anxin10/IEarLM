# 快速部署資料夾

此資料夾用於存放部署相關的文件和腳本。

## 快速部署腳本

### quick-deploy.sh

一鍵部署所有後端服務：

```bash
./deploy/quick-deploy.sh
```

功能：
- 檢查系統依賴（Python 3, pip3）
- 安裝 Python 依賴
- 啟動 RAG API (端口 9000)
- 啟動 YOLOv7 API (端口 5000)
- 檢查服務健康狀態

### stop-services.sh

停止所有後端服務：

```bash
./deploy/stop-services.sh
```

### status.sh

查看後端服務狀態：

```bash
./deploy/status.sh
```

## 服務端口

| 服務 | 端口 | 說明 |
|------|------|------|
| RAG API | 9000 | 知識庫問答 API |
| YOLOv7 API | 5000 | 圖像檢測 API |

## 日誌和 PID 文件

- **日誌文件**: `../logs/`
  - `rag_api.log` - RAG API 日誌
  - `yolov7_api.log` - YOLOv7 API 日誌

- **PID 文件**: `../pids/`
  - `rag_api.pid` - RAG API 進程 ID
  - `yolov7_api.pid` - YOLOv7 API 進程 ID

## 使用說明

### 快速部署（手動啟動）

1. **首次部署**：
   ```bash
   cd /path/to/web-server
   ./deploy/quick-deploy.sh
   ```

2. **查看服務狀態**：
   ```bash
   ./deploy/status.sh
   ```

3. **停止服務**：
   ```bash
   ./deploy/stop-services.sh
   ```

4. **查看日誌**：
   ```bash
   tail -f logs/rag_api.log
   tail -f logs/yolov7_api.log
   ```

### 開機自動啟動（systemd）

1. **安裝 systemd 服務**（設置開機自動啟動）：
   ```bash
   sudo ./deploy/install-systemd.sh
   ```

2. **啟動服務**：
   ```bash
   sudo systemctl start iear-lm-rag-api iear-lm-yolov7-api
   ```

3. **查看服務狀態**：
   ```bash
   sudo systemctl status iear-lm-rag-api
   sudo systemctl status iear-lm-yolov7-api
   ```

4. **查看日誌**：
   ```bash
   sudo journalctl -u iear-lm-rag-api -f
   sudo journalctl -u iear-lm-yolov7-api -f
   ```

5. **停止服務**：
   ```bash
   sudo systemctl stop iear-lm-rag-api iear-lm-yolov7-api
   ```

6. **卸載 systemd 服務**：
   ```bash
   sudo ./deploy/uninstall-systemd.sh
   ```

## 注意事項

- 確保 Python 3.9+ 已安裝
- 確保所需端口（5000, 9000）未被占用
- 首次運行會自動安裝 Python 依賴
- 服務以後台方式運行，日誌保存在 `logs/` 目錄

## 開機自動啟動

使用 systemd 服務可以實現開機自動啟動：

1. **安裝服務**：
   ```bash
   sudo ./deploy/install-systemd.sh
   ```

2. **服務會自動在開機時啟動**

3. **管理服務**：
   ```bash
   # 啟動
   sudo systemctl start iear-lm-rag-api iear-lm-yolov7-api
   
   # 停止
   sudo systemctl stop iear-lm-rag-api iear-lm-yolov7-api
   
   # 重啟
   sudo systemctl restart iear-lm-rag-api iear-lm-yolov7-api
   
   # 查看狀態
   sudo systemctl status iear-lm-rag-api
   ```

4. **查看日誌**：
   ```bash
   # systemd 日誌
   sudo journalctl -u iear-lm-rag-api -f
   
   # 或查看應用日誌
   tail -f logs/rag_api.log
   ```

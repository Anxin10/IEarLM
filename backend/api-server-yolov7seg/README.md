# Air YOLOv7-seg API

基於 YOLOv7-seg 的圖片檢測 API 服務器。

## 快速開始

### Docker 運行（推薦）

```bash
docker-compose up -d
```

### 本地運行

```bash
# 安裝依賴
cd server
pip install -r requirements.txt

# 啟動服務器
python api_server.py --weights ../weights/best.pt --port 5000
```

詳細文檔請參考 [docs/README.md](docs/README.md)

# Air YOLOv7-seg API

基於 YOLOv7-seg 的圖片檢測 API 服務器，整合圖片裁切和目標檢測功能。

## 功能特性

- ✅ 圖片裁切（基於圓形檢測，使用 Otsu 動態閾值）
- ✅ YOLOv7-seg 目標檢測和分割
- ✅ 座標轉換（裁切座標 ↔ 原始圖片座標）
- ✅ GPU/CPU 自動檢測
- ✅ 可配置的置信度和 IoU 閾值
- ✅ Docker 容器化支援

## 目錄結構

```
air-api-yolov7-seg/
├── server/                 # 核心服務器代碼
│   ├── api_server.py      # Flask API 服務器主程式
│   ├── crop_module.py     # 圖片裁切模組
│   ├── detect_module.py   # YOLOv7-seg 檢測模組
│   ├── draw_utils.py      # 繪圖工具模組
│   ├── requirements.txt   # Python 依賴
│   └── Dockerfile         # Docker 映像檔定義
├── docs/                  # 文檔目錄
│   └── README.md          # 本文件
├── tests/                 # 測試工具目錄
│   ├── test_gui.py        # GUI 測試工具
│   ├── start_gui.ps1      # 啟動 GUI 腳本
│   └── README.md          # 測試工具說明
├── weights/               # 模型權重文件目錄
│   └── best.pt            # YOLOv7-seg 模型權重
├── docker-compose.yml     # Docker Compose 配置
├── .dockerignore         # Docker 忽略文件
├── start_api.ps1         # 啟動 API 服務器腳本
└── README.md             # 快速開始指南
```

## 本地運行

### 1. 安裝依賴

```bash
cd server
pip install -r requirements.txt
```

### 2. 準備模型權重

將 YOLOv7-seg 模型權重文件（`best.pt`）放置在 `weights/` 目錄。

### 3. 啟動 API 服務器

#### 使用啟動腳本（推薦）

```powershell
.\start_api.ps1
```

#### 手動啟動

```bash
cd server
python api_server.py --weights ../weights/best.pt --port 5000
```

### 4. 啟動 GUI 測試工具

```powershell
cd tests
.\start_gui.ps1
```

參數說明：
- `--weights`: 模型權重文件路徑（必需）
- `--device`: 設備，`0` 表示使用 GPU，`cpu` 表示使用 CPU，不指定則自動檢測
- `--img-size`: 推理圖片尺寸（默認: `640`）
- `--port`: API 服務端口（默認: `5000`）
- `--host`: API 服務主機（默認: `0.0.0.0`）

## Docker 運行

### 快速開始

```bash
docker-compose up -d
```

### 查看日誌

```bash
docker-compose logs -f
```

### 停止服務

```bash
docker-compose down
```

## API 端點

詳細 API 文檔請參考 [API.md](API.md)

### 快速參考

**健康檢查**
```bash
GET /api/health
```

**API 資訊**
```bash
GET /api/info
```

**圖片分析**
```bash
POST /api/analyze
Content-Type: application/json

{
  "image": "base64編碼的圖片數據",
  "conf_thres": 0.25,
  "iou_thres": 0.45,
  "include_crop_coords": true,
  "coordinate_type": "original"
}
```

## 環境變數

- `DEVICE`: 設備類型（`0` for GPU, `cpu` for CPU），默認自動檢測
- `FLASK_ENV`: Flask 環境（`production` 或 `development`）

## 注意事項

1. **權重文件**: 確保權重文件路徑正確，Docker 中通過 volume 掛載
2. **YOLOv7-seg 代碼**: 需要確保 `example/sample code/yolov7-seg/` 目錄存在
3. **GPU 支援**: 如需使用 GPU，在 `docker-compose.yml` 中取消 GPU 相關註釋


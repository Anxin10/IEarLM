# API 文檔

## 基礎資訊

- **Base URL**: `http://localhost:5000`
- **Content-Type**: `application/json`

## 端點列表

### 1. 健康檢查

檢查 API 服務器狀態和檢測器是否已載入。

**請求**
```http
GET /api/health
```

**響應**
```json
{
  "status": "healthy",
  "detector_loaded": true
}
```

**響應字段說明**
- `status`: 服務器狀態（固定為 "healthy"）
- `detector_loaded`: 檢測器是否已載入（boolean）

---

### 2. API 資訊

獲取 API 的基本資訊和支援的類別列表。

**請求**
```http
GET /api/info
```

**響應**
```json
{
  "name": "YOLOv7-seg Detection API",
  "version": "1.0.0",
  "features": [
    "圖片裁切（基於圓形檢測）",
    "YOLOv7-seg 目標檢測",
    "座標轉換（裁切座標 ↔ 原始座標）",
    "GPU 加速支援"
  ],
  "detector_loaded": true,
  "classes": [
    "eardrum_perforation",
    "atresia",
    "atrophic_scar",
    "blood_clot",
    "cerumen",
    "foreign_body",
    "middle_ear_effusion",
    "middle_ear_tumor",
    "otitis_externa",
    "otomycosis",
    "retraction",
    "tympanosclerosis",
    "ventilation_tube",
    "otitis_media",
    "tympanoplasty",
    "EAC_tumor",
    "myringitis",
    "normal"
  ],
  "device": "cpu",
  "img_size": 640
}
```

**響應字段說明**
- `name`: API 名稱
- `version`: API 版本
- `features`: 功能列表
- `detector_loaded`: 檢測器是否已載入
- `classes`: 支援的類別列表（18 個類別）
- `device`: 使用的設備（"cpu" 或 "cuda:0"）
- `img_size`: 推理圖片尺寸

---

### 3. 圖片分析

對圖片進行檢測分析，返回檢測結果和座標資訊。

**請求**
```http
POST /api/analyze
Content-Type: application/json
```

**請求體**
```json
{
  "image": "base64編碼的圖片數據",
  "conf_thres": 0.25,
  "iou_thres": 0.45,
  "include_crop_coords": true,
  "coordinate_type": "original"
}
```

**請求參數說明**

| 參數 | 類型 | 必填 | 默認值 | 說明 |
|------|------|------|--------|------|
| `image` | string | 是 | - | base64 編碼的圖片數據（可包含 `data:image/...;base64,` 前綴） |
| `conf_thres` | float | 否 | 0.25 | 置信度閾值（0.0 - 1.0），只返回置信度超過此值的檢測結果 |
| `iou_thres` | float | 否 | 0.45 | IoU 閾值（0.0 - 1.0），用於 NMS（非極大值抑制） |
| `include_crop_coords` | boolean | 否 | true | 是否在響應中包含裁切座標資訊 |
| `coordinate_type` | string | 否 | "original" | 座標類型：<br>- `"original"`: 返回原始圖片座標<br>- `"cropped"`: 返回裁切後圖片座標 |

**響應**
```json
{
  "detections": [
    {
      "bbox": [100.5, 200.3, 300.7, 400.9],
      "confidence": 0.85,
      "class_id": 0,
      "class_name": "eardrum_perforation",
      "mask": [[0, 0, 1, 1, ...], [0, 1, 1, ...], ...]
    },
    {
      "bbox": [150.2, 250.1, 350.8, 450.5],
      "confidence": 0.72,
      "class_id": 5,
      "class_name": "foreign_body",
      "mask": [[0, 0, 0, ...], [0, 1, 1, ...], ...]
    }
  ],
  "coordinate_type": "original",
  "parameters": {
    "conf_thres": 0.25,
    "iou_thres": 0.45,
    "include_crop_coords": true
  },
  "crop_info": {
    "success": true,
    "center": [540, 720],
    "radius": 450,
    "crop_coords": [0, 0, 1080, 1440],
    "original_shape": [1440, 1920],
    "cropped_shape": [1440, 1080]
  }
}
```

**響應字段說明**

#### `detections` (array)
檢測結果列表，每個元素包含：

- `bbox` (array[4]): 邊界框座標 `[x1, y1, x2, y2]`
  - `x1, y1`: 左上角座標
  - `x2, y2`: 右下角座標
- `confidence` (float): 置信度（0.0 - 1.0）
- `class_id` (int): 類別 ID（0-17）
- `class_name` (string): 類別名稱
- `mask` (array, 可選): 分割 mask 數據（二維數組，0/1 值）

#### `coordinate_type` (string)
返回的座標類型（"original" 或 "cropped"）

#### `parameters` (object)
使用的檢測參數

#### `crop_info` (object, 可選)
裁切資訊（僅當 `include_crop_coords` 為 `true` 時返回）：

- `success` (boolean): 是否成功檢測到圓形並進行裁切
- `center` (array[2]): 圓心座標 `[cx, cy]`
- `radius` (int): 檢測到的圓形半徑
- `crop_coords` (array[4]): 裁切座標 `[x1, y1, x2, y2]`（在原始圖片中的位置）
- `original_shape` (array[2]): 原始圖片尺寸 `[height, width]`
- `cropped_shape` (array[2]): 裁切後圖片尺寸 `[height, width]`

**錯誤響應**

```json
{
  "error": "錯誤訊息",
  "type": "錯誤類型"
}
```

**HTTP 狀態碼**
- `200`: 成功
- `400`: 請求參數錯誤
- `500`: 服務器錯誤

---

## 使用範例

### Python 範例

```python
import requests
import base64

# 讀取圖片並編碼
with open("image.jpg", "rb") as f:
    image_data = base64.b64encode(f.read()).decode('utf-8')

# 發送請求
response = requests.post(
    "http://localhost:5000/api/analyze",
    json={
        "image": image_data,
        "conf_thres": 0.25,
        "iou_thres": 0.45,
        "include_crop_coords": True,
        "coordinate_type": "original"
    }
)

result = response.json()

# 處理檢測結果
for detection in result["detections"]:
    print(f"類別: {detection['class_name']}")
    print(f"置信度: {detection['confidence']:.2%}")
    print(f"座標: {detection['bbox']}")
    if "mask" in detection:
        print(f"有分割 mask 數據")
```

### JavaScript/TypeScript 範例

```typescript
async function analyzeImage(imageFile: File) {
  // 將圖片轉換為 base64
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 移除 data URL 前綴（API 會自動處理）
      resolve(result.split(',')[1]);
    };
    reader.readAsDataURL(imageFile);
  });

  // 發送請求
  const response = await fetch('http://localhost:5000/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: base64,
      conf_thres: 0.25,
      iou_thres: 0.45,
      include_crop_coords: true,
      coordinate_type: 'original',
    }),
  });

  const result = await response.json();

  // 處理檢測結果
  result.detections.forEach((detection: any) => {
    console.log(`類別: ${detection.class_name}`);
    console.log(`置信度: ${(detection.confidence * 100).toFixed(2)}%`);
    console.log(`座標: ${detection.bbox}`);
  });

  return result;
}
```

### cURL 範例

```bash
# 將圖片轉換為 base64（Linux/Mac）
IMAGE_BASE64=$(base64 -i image.jpg)

# 發送請求
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d "{
    \"image\": \"$IMAGE_BASE64\",
    \"conf_thres\": 0.25,
    \"iou_thres\": 0.45,
    \"include_crop_coords\": true,
    \"coordinate_type\": \"original\"
  }"
```

---

## 注意事項

1. **圖片格式**: 支援常見圖片格式（JPEG、PNG、BMP 等）
2. **座標系統**: 
   - 座標原點在左上角 (0, 0)
   - X 軸向右，Y 軸向下
   - `bbox` 格式為 `[x1, y1, x2, y2]`
3. **Mask 數據**: 
   - 如果檢測結果包含分割 mask，`mask` 字段為二維數組
   - 數組值為 0 或 1，表示該像素是否屬於檢測目標
   - Mask 尺寸與原始圖片或裁切後圖片一致（取決於 `coordinate_type`）
4. **裁切邏輯**: 
   - API 會自動嘗試檢測圖片中的圓形區域並進行裁切
   - 如果檢測失敗，會使用原始圖片進行檢測
   - 裁切資訊會在 `crop_info` 中返回
5. **性能**: 
   - 首次請求會載入模型，可能需要較長時間
   - 後續請求會使用已載入的模型，速度較快
   - 建議使用 GPU 以獲得更好的性能

---

## 錯誤處理

常見錯誤及處理方式：

| HTTP 狀態碼 | 錯誤訊息 | 原因 | 解決方法 |
|------------|---------|------|---------|
| 400 | "請求數據為空" | 請求體為空 | 檢查請求體格式 |
| 400 | "缺少 'image' 參數" | 未提供圖片數據 | 確保請求中包含 `image` 字段 |
| 400 | "無法解碼圖片數據" | 圖片數據格式錯誤 | 檢查 base64 編碼是否正確 |
| 500 | "檢測器未初始化" | 檢測器未載入 | 檢查服務器日誌，確認模型權重文件路徑正確 |
| 500 | 其他錯誤 | 服務器內部錯誤 | 查看服務器日誌獲取詳細錯誤資訊 |


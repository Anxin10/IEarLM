# 測試工具

本目錄包含 API 測試相關的工具和腳本。

## 文件說明

- `test_gui.py` - PyQt5 GUI 測試工具，用於可視化測試 API 功能
- `start_gui.ps1` - 啟動 GUI 測試工具的 PowerShell 腳本

## 使用方法

### 啟動 GUI 測試工具

```powershell
.\start_gui.ps1
```

或直接運行：

```bash
python test_gui.py
```

## 功能

- 圖片選擇和預覽
- 實時顯示檢測結果（帶分割標記）
- 可調整檢測參數（conf_thres, iou_thres）
- 顯示裁切資訊和座標
- 支援原始座標和裁切座標切換

## 依賴

GUI 測試工具需要額外的依賴：

```bash
pip install PyQt5
```

或安裝完整依賴（包含 GUI）：

```bash
pip install -r ../requirements.txt PyQt5>=5.15.0
```


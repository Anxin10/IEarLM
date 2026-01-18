# 啟動 API 服務器的 PowerShell 腳本

# 設置 UTF-8 編碼以正確顯示中文
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

$weightsPath = "weights\best.pt"

if (-not (Test-Path $weightsPath)) {
    Write-Host "錯誤: 找不到權重文件: $weightsPath" -ForegroundColor Red
    Write-Host "請確保權重文件位於: air-api-yolov7-seg\weights\best.pt" -ForegroundColor Yellow
    exit 1
}

Write-Host "啟動 YOLOv7-seg API 服務器..." -ForegroundColor Green
Write-Host "權重文件: $weightsPath" -ForegroundColor Cyan
Write-Host "設備: 自動檢測 (如有 GPU 則使用 GPU，否則使用 CPU)" -ForegroundColor Cyan
Write-Host "端口: 5000" -ForegroundColor Cyan
Write-Host ""

# 切換到 server 目錄並啟動
cd server
python api_server.py --weights ..\$weightsPath --port 5000


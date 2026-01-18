# 啟動 GUI 測試工具的 PowerShell 腳本

# 設置 UTF-8 編碼以正確顯示中文
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "啟動 YOLOv7-seg API 測試 GUI..." -ForegroundColor Green
Write-Host ""

python test_gui.py


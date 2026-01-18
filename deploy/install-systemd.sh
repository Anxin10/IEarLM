#!/bin/bash
# 安裝 systemd 服務，實現開機自動啟動

set -e

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 獲取腳本目錄
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SYSTEMD_DIR="$SCRIPT_DIR/systemd"

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 檢查是否為 root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "請使用 sudo 運行此腳本"
    fi
}

# 獲取當前用戶
get_current_user() {
    if [ -n "$SUDO_USER" ]; then
        echo "$SUDO_USER"
    else
        echo "$USER"
    fi
}

# 更新服務文件中的用戶和路徑
update_service_file() {
    local service_file=$1
    local current_user=$(get_current_user)
    local project_root=$(realpath "$PROJECT_ROOT")
    
    # 創建臨時文件
    local temp_file=$(mktemp)
    
    # 讀取服務文件並替換用戶和路徑
    sed -e "s|User=icps806|User=$current_user|g" \
        -e "s|/home/icps806/hdd_1_2tb/minyu/web-server|$project_root|g" \
        "$service_file" > "$temp_file"
    
    echo "$temp_file"
}

# 安裝服務
install_service() {
    local service_name=$1
    local service_file="$SYSTEMD_DIR/$service_name"
    
    if [ ! -f "$service_file" ]; then
        error "服務文件不存在: $service_file"
    fi
    
    log "安裝 $service_name..."
    
    # 更新服務文件
    local updated_file=$(update_service_file "$service_file")
    
    # 複製到 systemd 目錄
    cp "$updated_file" "/etc/systemd/system/$service_name"
    rm "$updated_file"
    
    # 重新加載 systemd
    systemctl daemon-reload
    
    # 啟用服務（開機自動啟動）
    systemctl enable "$service_name"
    
    success "$service_name 已安裝並啟用"
}

# 主函數
main() {
    log "========== 安裝 systemd 服務 =========="
    
    check_root
    
    # 確保日誌目錄存在
    mkdir -p "$PROJECT_ROOT/logs"
    chown -R $(get_current_user):$(get_current_user) "$PROJECT_ROOT/logs" 2>/dev/null || true
    
    # 安裝服務
    install_service "iear-lm-rag-api.service"
    install_service "iear-lm-yolov7-api.service"
    
    echo ""
    echo "=========================================="
    echo "  服務安裝完成！"
    echo "=========================================="
    echo ""
    echo "常用命令："
    echo "  啟動服務: sudo systemctl start iear-lm-rag-api iear-lm-yolov7-api"
    echo "  停止服務: sudo systemctl stop iear-lm-rag-api iear-lm-yolov7-api"
    echo "  重啟服務: sudo systemctl restart iear-lm-rag-api iear-lm-yolov7-api"
    echo "  查看狀態: sudo systemctl status iear-lm-rag-api"
    echo "  查看日誌: sudo journalctl -u iear-lm-rag-api -f"
    echo ""
    echo "服務已設置為開機自動啟動。"
    echo "如需立即啟動服務，請運行："
    echo "  sudo systemctl start iear-lm-rag-api iear-lm-yolov7-api"
    echo ""
}

# 執行主函數
main "$@"

#!/bin/bash
# 卸載 systemd 服務

set -e

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 卸載服務
uninstall_service() {
    local service_name=$1
    
    log "卸載 $service_name..."
    
    # 停止服務
    systemctl stop "$service_name" 2>/dev/null || true
    
    # 禁用服務
    systemctl disable "$service_name" 2>/dev/null || true
    
    # 刪除服務文件
    rm -f "/etc/systemd/system/$service_name"
    
    # 重新加載 systemd
    systemctl daemon-reload
    
    success "$service_name 已卸載"
}

# 主函數
main() {
    log "========== 卸載 systemd 服務 =========="
    
    check_root
    
    # 卸載服務
    uninstall_service "iear-lm-rag-api.service"
    uninstall_service "iear-lm-yolov7-api.service"
    
    success "所有服務已卸載"
}

# 執行主函數
main "$@"

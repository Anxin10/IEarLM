#!/bin/bash
# 停止後端服務腳本

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
PIDS_DIR="$PROJECT_ROOT/pids"

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 停止服務
stop_service() {
    local service_name=$1
    local pid_file="$PIDS_DIR/${service_name}.pid"
    local port=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            log "停止 $service_name (PID: $pid)..."
            kill $pid
            sleep 1
            if ! kill -0 $pid 2>/dev/null; then
                success "$service_name 已停止"
                rm -f "$pid_file"
            else
                warning "$service_name 未能正常停止，強制終止..."
                kill -9 $pid 2>/dev/null || true
                rm -f "$pid_file"
            fi
        else
            warning "$service_name PID 文件存在但進程不存在，清理 PID 文件"
            rm -f "$pid_file"
        fi
    else
        # 嘗試通過端口查找並停止
        local pid=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pid" ]; then
            log "通過端口 $port 找到 $service_name 進程 (PID: $pid)，正在停止..."
            kill $pid 2>/dev/null || true
            sleep 1
            if kill -0 $pid 2>/dev/null; then
                kill -9 $pid 2>/dev/null || true
            fi
            success "$service_name 已停止"
        else
            warning "$service_name 未運行"
        fi
    fi
}

# 主函數
main() {
    log "========== 停止後端服務 =========="
    
    stop_service "rag_api" 9000
    stop_service "yolov7_api" 5000
    
    # 清理可能的殘留進程
    log "清理殘留進程..."
    pkill -f "uvicorn app:app" 2>/dev/null || true
    pkill -f "api_server.py" 2>/dev/null || true
    
    success "所有後端服務已停止"
}

# 執行主函數
main "$@"

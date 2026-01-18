#!/bin/bash
# iEarLM 後端服務快速部署腳本
# 僅部署後端服務（前端使用 npm 單獨部署）

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
cd "$PROJECT_ROOT"

# 日誌和 PID 目錄
LOGS_DIR="$PROJECT_ROOT/logs"
PIDS_DIR="$PROJECT_ROOT/pids"
mkdir -p "$LOGS_DIR" "$PIDS_DIR"

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

# 檢查依賴
check_dependencies() {
    log "檢查系統依賴..."
    
    # 檢查 Python
    if ! command -v python3 &> /dev/null; then
        error "Python 3 未安裝，請先安裝 Python 3.9+"
    fi
    
    # 檢查 pip
    if ! command -v pip3 &> /dev/null; then
        error "pip3 未安裝，請先安裝 pip"
    fi
    
    success "依賴檢查完成"
}

# 檢查服務是否已運行
check_service_running() {
    local port=$1
    local service_name=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        warning "$service_name 已在端口 $port 運行"
        return 0
    fi
    return 1
}

# 安裝 Python 依賴
install_dependencies() {
    log "安裝 Python 依賴..."
    
    # RAG API 依賴
    if [ -f "$PROJECT_ROOT/backend/api-server-ollama2rag/server/requirements.txt" ]; then
        log "安裝 RAG API 依賴..."
        cd "$PROJECT_ROOT/backend/api-server-ollama2rag/server"
        pip3 install -r requirements.txt --quiet || warning "RAG API 依賴安裝可能不完整"
    fi
    
    # YOLOv7 API 依賴
    if [ -f "$PROJECT_ROOT/backend/api-server-yolov7seg/server/requirements.txt" ]; then
        log "安裝 YOLOv7 API 依賴..."
        cd "$PROJECT_ROOT/backend/api-server-yolov7seg/server"
        pip3 install -r requirements.txt --quiet || warning "YOLOv7 API 依賴安裝可能不完整"
    fi
    
    cd "$PROJECT_ROOT"
    success "依賴安裝完成"
}

# 啟動 RAG API 服務
start_rag_api() {
    local port=9000
    local service_name="RAG API"
    
    if check_service_running $port "$service_name"; then
        return 0
    fi
    
    log "啟動 $service_name (端口 $port)..."
    
    cd "$PROJECT_ROOT/backend/api-server-ollama2rag/server"
    
    # 檢查 app.py 是否存在
    if [ ! -f "app.py" ]; then
        error "RAG API app.py 不存在"
    fi
    
    # 啟動服務（後台運行）
    nohup python3 -m uvicorn app:app --host 0.0.0.0 --port $port > "$LOGS_DIR/rag_api.log" 2>&1 &
    local pid=$!
    echo $pid > "$PIDS_DIR/rag_api.pid"
    
    # 等待服務啟動
    sleep 3
    
    # 檢查服務是否成功啟動
    if kill -0 $pid 2>/dev/null; then
        success "$service_name 已啟動 (PID: $pid, 端口: $port)"
    else
        error "$service_name 啟動失敗，請查看日誌: $LOGS_DIR/rag_api.log"
    fi
    
    cd "$PROJECT_ROOT"
}

# 啟動 YOLOv7 API 服務
start_yolov7_api() {
    local port=5000
    local service_name="YOLOv7 API"
    
    if check_service_running $port "$service_name"; then
        return 0
    fi
    
    log "啟動 $service_name (端口 $port)..."
    
    cd "$PROJECT_ROOT/backend/api-server-yolov7seg/server"
    
    # 檢查 api_server.py 是否存在
    if [ ! -f "api_server.py" ]; then
        error "YOLOv7 API api_server.py 不存在"
    fi
    
    # 檢查權重文件
    local weights_path="$PROJECT_ROOT/backend/api-server-yolov7seg/weights/best.pt"
    if [ ! -f "$weights_path" ]; then
        warning "權重文件不存在: $weights_path"
        warning "將嘗試使用默認路徑或可能啟動失敗"
    fi
    
    # 啟動服務（後台運行）
    nohup python3 api_server.py --weights ../weights/best.pt --port $port > "$LOGS_DIR/yolov7_api.log" 2>&1 &
    local pid=$!
    echo $pid > "$PIDS_DIR/yolov7_api.pid"
    
    # 等待服務啟動
    sleep 5
    
    # 檢查服務是否成功啟動
    if kill -0 $pid 2>/dev/null; then
        success "$service_name 已啟動 (PID: $pid, 端口: $port)"
    else
        error "$service_name 啟動失敗，請查看日誌: $LOGS_DIR/yolov7_api.log"
    fi
    
    cd "$PROJECT_ROOT"
}

# 檢查服務健康狀態
check_services_health() {
    log "檢查服務健康狀態..."
    
    # 檢查 RAG API
    if curl -f http://localhost:9000/health >/dev/null 2>&1; then
        success "RAG API 服務正常"
    else
        warning "RAG API 服務未就緒或健康檢查端點不存在"
    fi
    
    # 檢查 YOLOv7 API
    if curl -f http://localhost:5000/health >/dev/null 2>&1; then
        success "YOLOv7 API 服務正常"
    else
        warning "YOLOv7 API 服務未就緒或健康檢查端點不存在"
    fi
}

# 顯示部署信息
show_info() {
    echo ""
    echo "=========================================="
    echo "  後端服務部署完成！"
    echo "=========================================="
    echo ""
    echo "後端服務地址："
    echo "  RAG API: http://localhost:9000"
    echo "  YOLOv7 API: http://localhost:5000"
    echo ""
    echo "日誌文件："
    echo "  RAG API: $LOGS_DIR/rag_api.log"
    echo "  YOLOv7 API: $LOGS_DIR/yolov7_api.log"
    echo ""
    echo "PID 文件："
    echo "  RAG API: $PIDS_DIR/rag_api.pid"
    echo "  YOLOv7 API: $PIDS_DIR/yolov7_api.pid"
    echo ""
    echo "常用命令："
    echo "  查看日誌: tail -f $LOGS_DIR/rag_api.log"
    echo "  停止服務: ./deploy/stop-services.sh"
    echo "  查看狀態: ps aux | grep -E 'uvicorn|api_server'"
    echo ""
}

# 主函數
main() {
    log "========== iEarLM 後端服務部署 =========="
    
    check_dependencies
    install_dependencies
    start_rag_api
    start_yolov7_api
    check_services_health
    show_info
    
    success "後端服務部署完成！"
}

# 執行主函數
main "$@"

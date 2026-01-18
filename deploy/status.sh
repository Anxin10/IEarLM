#!/bin/bash
# 查看後端服務狀態腳本

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
LOGS_DIR="$PROJECT_ROOT/logs"

check_service() {
    local service_name=$1
    local port=$2
    local pid_file="$PIDS_DIR/${service_name}.pid"
    
    echo -e "${BLUE}=== $service_name ===${NC}"
    
    # 檢查 PID 文件
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            echo -e "  狀態: ${GREEN}運行中${NC} (PID: $pid)"
        else
            echo -e "  狀態: ${RED}已停止${NC} (PID 文件存在但進程不存在)"
        fi
    else
        echo -e "  狀態: ${YELLOW}未知${NC} (無 PID 文件)"
    fi
    
    # 檢查端口
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "  端口: ${GREEN}$port (監聽中)${NC}"
    else
        echo -e "  端口: ${RED}$port (未監聽)${NC}"
    fi
    
    # 檢查健康狀態
    if curl -f http://localhost:$port/health >/dev/null 2>&1; then
        echo -e "  健康: ${GREEN}正常${NC}"
    else
        echo -e "  健康: ${YELLOW}未就緒或無健康檢查端點${NC}"
    fi
    
    echo ""
}

# 主函數
main() {
    echo -e "${BLUE}========== 後端服務狀態 ==========${NC}"
    echo ""
    
    check_service "rag_api" 9000
    check_service "yolov7_api" 5000
    
    echo -e "${BLUE}日誌文件位置：${NC}"
    echo "  RAG API: $LOGS_DIR/rag_api.log"
    echo "  YOLOv7 API: $LOGS_DIR/yolov7_api.log"
    echo ""
}

# 執行主函數
main "$@"

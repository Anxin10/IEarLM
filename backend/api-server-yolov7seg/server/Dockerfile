# YOLOv7-seg API Dockerfile
FROM python:3.9-slim

# 設置工作目錄
WORKDIR /app

# 安裝系統依賴
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 複製依賴文件
COPY backend/api-server-yolov7seg/server/requirements.txt .

# 升級 pip 並設置國內鏡像源（加速 PyTorch 等大型包的下載）
RUN pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple --trusted-host pypi.tuna.tsinghua.edu.cn

# 安裝 Python 依賴（使用國內鏡像源加速下載）
# 優先使用清華大學 PyPI 鏡像源，如果失敗則回退到官方源
# PyTorch 包很大（~800MB），使用鏡像源可以顯著加速
RUN pip install --no-cache-dir \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    --trusted-host pypi.tuna.tsinghua.edu.cn \
    -r requirements.txt || \
    (echo "鏡像源失敗，使用官方源..." && \
     pip install --no-cache-dir -r requirements.txt)

# 複製應用程序文件
COPY backend/api-server-yolov7seg/server/api_server.py .
COPY backend/api-server-yolov7seg/server/crop_module.py .
COPY backend/api-server-yolov7seg/server/detect_module.py .
COPY backend/api-server-yolov7seg/server/draw_utils.py .

# 創建權重文件目錄和 YOLOv7-seg 目錄結構
RUN mkdir -p /app/weights
RUN mkdir -p /app/yolov7-seg

# 複製 YOLOv7-seg 的必要模組（從 server 目錄中的本地文件）
# build context 是項目根目錄，所以可以直接訪問 backend/api-server-yolov7seg/server
COPY backend/api-server-yolov7seg/server/utils /app/yolov7-seg/utils
COPY backend/api-server-yolov7seg/server/models /app/yolov7-seg/models
COPY backend/api-server-yolov7seg/server/export.py /app/yolov7-seg/export.py

# 設置環境變量
ENV PYTHONUNBUFFERED=1
ENV FLASK_ENV=production

# 暴露端口
EXPOSE 5000

# 健康檢查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# 啟動命令（權重文件需要通過 volume 掛載）
# 注意：權重文件通過 docker-compose.yml 中的 volume 掛載
CMD ["python", "api_server.py", "--weights", "/app/weights/best.pt", "--port", "5000", "--host", "0.0.0.0"]


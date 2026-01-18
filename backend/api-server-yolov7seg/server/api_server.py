"""
YOLOv7-seg 檢測 API 服務器
整合圖片裁切和檢測功能
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
from pathlib import Path
import io
from PIL import Image
import base64
import argparse
import sys

from crop_module import crop_image_by_circle
from detect_module import YOLOv7Detector, CLASS_ORDER

app = Flask(__name__)
CORS(app)  # 允許跨域請求

# 全局變量
detector: YOLOv7Detector = None


def init_detector(weights_path: str, device: str = None, img_size: int = 640):
    """初始化檢測器"""
    global detector
    
    # 自動檢測設備：如果沒有指定或 GPU 不可用，使用 CPU
    if device is None:
        import torch
        if torch.cuda.is_available():
            device = "0"
            print("檢測到 GPU，使用 GPU 模式")
        else:
            device = "cpu"
            print("未檢測到 GPU，使用 CPU 模式")
    elif device == "0":
        # 檢查 GPU 是否真的可用
        import torch
        if not torch.cuda.is_available():
            print("警告: 指定使用 GPU 但 CUDA 不可用，自動切換到 CPU")
            device = "cpu"
    
    print(f"初始化檢測器...")
    print(f"  - 權重文件: {weights_path}")
    print(f"  - 設備: {device}")
    print(f"  - 圖片尺寸: {img_size}")
    
    detector = YOLOv7Detector(weights_path, device=device, img_size=img_size)
    print("檢測器初始化完成")


def decode_image(image_data: str) -> np.ndarray:
    """
    解碼 base64 圖片數據
    
    Args:
        image_data: base64 編碼的圖片數據（可包含 data:image/...;base64, 前綴）
    
    Returns:
        img: BGR 格式的 numpy array
    """
    # 移除可能的 data URL 前綴
    if ',' in image_data:
        image_data = image_data.split(',')[1]
    
    # 解碼 base64
    image_bytes = base64.b64decode(image_data)
    
    # 轉換為 numpy array
    nparr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise ValueError("無法解碼圖片數據")
    
    return img


def encode_image(img: np.ndarray, format: str = 'jpg') -> str:
    """
    將圖片編碼為 base64
    
    Args:
        img: BGR 格式的 numpy array
        format: 圖片格式 ('jpg', 'png')
    
    Returns:
        base64 編碼的圖片字符串
    """
    if format.lower() == 'jpg':
        ext = '.jpg'
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 90]
    else:
        ext = '.png'
        encode_param = [int(cv2.IMWRITE_PNG_COMPRESSION), 9]
    
    _, buffer = cv2.imencode(ext, img)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    return img_base64


@app.route('/api/health', methods=['GET'])
def health_check():
    """健康檢查"""
    return jsonify({
        "status": "healthy",
        "detector_loaded": detector is not None
    })


@app.route('/api/info', methods=['GET'])
def api_info():
    """API 資訊"""
    info = {
        "name": "YOLOv7-seg Detection API",
        "version": "1.0.0",
        "features": [
            "圖片裁切（基於圓形檢測）",
            "YOLOv7-seg 目標檢測",
            "座標轉換（裁切座標 ↔ 原始座標）",
            "GPU 加速支援"
        ],
        "detector_loaded": detector is not None,
        "classes": CLASS_ORDER
    }
    
    if detector:
        info["device"] = str(detector.device)
        info["img_size"] = detector.img_size
    
    return jsonify(info)


@app.route('/api/analyze', methods=['POST'])
def analyze_image():
    """
    分析圖片
    
    請求參數:
        - image: base64 編碼的圖片數據
        - conf_thres: 置信度閾值 (default: 0.25)
        - iou_thres: IoU 閾值 (default: 0.45)
        - include_crop_coords: 是否包含裁切座標 (default: True)
        - coordinate_type: 座標類型 ('original' 或 'cropped', default: 'original')
    
    返回:
        - detections: 檢測結果列表
        - crop_info: 裁切資訊（如果進行了裁切）
        - coordinate_type: 返回的座標類型
    """
    if detector is None:
        return jsonify({"error": "檢測器未初始化"}), 500
    
    try:
        # 獲取請求數據
        data = request.get_json()
        if not data:
            return jsonify({"error": "請求數據為空"}), 400
        
        image_data = data.get('image')
        if not image_data:
            return jsonify({"error": "缺少 'image' 參數"}), 400
        
        # 獲取參數
        conf_thres = float(data.get('conf_thres', 0.25))
        iou_thres = float(data.get('iou_thres', 0.45))
        include_crop_coords = data.get('include_crop_coords', True)
        coordinate_type = data.get('coordinate_type', 'original')  # 'original' 或 'cropped'
        
        # 解碼圖片
        original_img = decode_image(image_data)
        original_shape = original_img.shape[:2]
        
        # 步驟 1: 裁切圖片
        cropped_img, crop_info = crop_image_by_circle(original_img)
        
        # 如果裁切失敗，使用原始圖片
        if not crop_info.get("success") or cropped_img is None:
            print("警告: 圓形檢測失敗，使用原始圖片進行檢測")
            cropped_img = original_img
            crop_info = {
                "success": False,
                "crop_coords": None,
                "original_shape": original_shape,
                "cropped_shape": original_shape
            }
        
        # 步驟 2: 在裁切後的圖片上進行檢測
        detections = detector.detect(
            cropped_img,
            conf_thres=conf_thres,
            iou_thres=iou_thres
        )
        
        # 步驟 3: 座標轉換
        if coordinate_type == 'original' and crop_info.get("success"):
            # 轉換回原始圖片座標
            detections = detector.transform_coordinates(
                detections,
                crop_info,
                to_original=True
            )
        # else: 保持裁切座標（coordinate_type == 'cropped'）
        
        # 構建響應
        response = {
            "detections": detections,
            "coordinate_type": coordinate_type,
            "parameters": {
                "conf_thres": conf_thres,
                "iou_thres": iou_thres,
                "include_crop_coords": include_crop_coords
            }
        }
        
        # 添加裁切資訊（如果需要）
        if include_crop_coords:
            response["crop_info"] = crop_info
        
        return jsonify(response)
    
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback.print_exc()
        return jsonify({
            "error": error_msg,
            "type": type(e).__name__
        }), 500


if __name__ == '__main__':
    import os
    
    parser = argparse.ArgumentParser(description='YOLOv7-seg Detection API Server')
    parser.add_argument('--weights', type=str, required=True, help='模型權重文件路徑')
    # 從環境變數讀取設備設置，如果未設置則使用命令行參數，最後才使用默認值
    default_device = os.getenv('DEVICE', None)
    parser.add_argument('--device', type=str, default=default_device, help='設備 (0 for GPU, cpu for CPU, 不指定則自動檢測)')
    parser.add_argument('--img-size', type=int, default=640, help='推理圖片尺寸')
    parser.add_argument('--port', type=int, default=5000, help='API 服務端口')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='API 服務主機')
    
    args = parser.parse_args()
    
    # 檢查權重文件
    weights_path = Path(args.weights)
    if not weights_path.exists():
        print(f"錯誤: 權重文件不存在: {weights_path}")
        sys.exit(1)
    
    # 初始化檢測器
    try:
        init_detector(str(weights_path), device=args.device, img_size=args.img_size)
    except Exception as e:
        print(f"錯誤: 初始化檢測器失敗: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # 啟動服務器
    print(f"\n啟動 API 服務器...")
    print(f"  - 地址: http://{args.host}:{args.port}")
    print(f"  - 健康檢查: http://{args.host}:{args.port}/api/health")
    print(f"  - API 資訊: http://{args.host}:{args.port}/api/info")
    print(f"\n按 Ctrl+C 停止服務器\n")
    
    app.run(host=args.host, port=args.port, debug=False)


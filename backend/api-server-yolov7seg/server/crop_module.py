"""
圖片裁切模組
基於圓形檢測進行圖片裁切
參考: example/sample code/yolov7-seg/crop_by_circle.py
"""

import cv2
import numpy as np
from typing import Tuple, Optional

# 裁切參數
TARGET_SIZE = 1080
HALF_TARGET_SIZE = TARGET_SIZE // 2  # 540 pixels
MIN_RADIUS_FILTER = 200  # 最小有效半徑


def detect_circle_by_contours_otsu(img: np.ndarray) -> Tuple[bool, Tuple[int, int], int, np.ndarray, float]:
    """
    透過灰階直方圖和 Otsu's Method 動態確定閾值，然後進行輪廓偵測。
    
    Args:
        img: BGR 格式的圖片 (numpy array)
    
    Returns:
        success (bool): 是否成功檢測到圓形
        center (tuple): (center_x, center_y) 圓心座標
        radius (int): 半徑
        binary_display (np.ndarray): 二值化圖疊加輪廓（用於調試）
        threshold_value (float): Otsu 計算出的閾值
    """
    # 1. 轉灰階
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 2. 動態二值化 (使用 Otsu's Method 尋找最佳閾值)
    (T_dynamic, binary) = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY | cv2.THRESH_OTSU
    )
    
    # 3. 尋找輪廓
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # 複製二值化圖，準備在上面畫輪廓
    binary_display = cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
    
    if not contours:
        return False, (0, 0), 0, binary_display, T_dynamic
    
    # 4. 找到面積最大的輪廓
    largest_contour = max(contours, key=cv2.contourArea)
    
    # 5. 計算最小包圍圓
    ((x, y), radius) = cv2.minEnclosingCircle(largest_contour)
    center = (int(x), int(y))
    radius = int(radius)
    
    # 在二值化圖上繪製輪廓 (綠色)
    cv2.drawContours(binary_display, [largest_contour], -1, (0, 255, 0), 2)
    
    return True, center, radius, binary_display, T_dynamic


def crop_image_by_circle(img: np.ndarray) -> Tuple[Optional[np.ndarray], Optional[dict]]:
    """
    根據圓形檢測結果裁切圖片
    
    Args:
        img: BGR 格式的原始圖片
    
    Returns:
        cropped_img (Optional[np.ndarray]): 裁切後的圖片，如果檢測失敗則為 None
        crop_info (Optional[dict]): 裁切資訊，包含：
            - success: 是否成功
            - center: (cx, cy) 圓心座標
            - radius: 半徑
            - crop_coords: 裁切座標 (x1, y1, x2, y2) 在原始圖片中的位置
            - original_shape: (height, width) 原始圖片尺寸
            - cropped_shape: (height, width) 裁切後圖片尺寸
    """
    original_h, original_w = img.shape[:2]
    
    # 檢測圓形
    success, (cx, cy), r, _, _ = detect_circle_by_contours_otsu(img)
    
    if not success or r < MIN_RADIUS_FILTER:
        return None, {
            "success": False,
            "center": (cx, cy) if success else (0, 0),
            "radius": r,
            "crop_coords": None,
            "original_shape": (original_h, original_w),
            "cropped_shape": None
        }
    
    # 計算裁切邊界 (以圓心 X 為基準，左右各 540)
    start_x = int(cx - HALF_TARGET_SIZE)
    end_x = int(cx + HALF_TARGET_SIZE)
    
    # 防呆：確保不超出邊界
    start_x = max(0, start_x)
    end_x = min(original_w, end_x)
    
    # 執行裁切 (Y 軸取全高)
    cropped_img = img[0:original_h, start_x:end_x]
    cropped_h, cropped_w = cropped_img.shape[:2]
    
    crop_info = {
        "success": True,
        "center": (cx, cy),
        "radius": r,
        "crop_coords": (start_x, 0, end_x, original_h),  # (x1, y1, x2, y2)
        "original_shape": (original_h, original_w),
        "cropped_shape": (cropped_h, cropped_w)
    }
    
    return cropped_img, crop_info


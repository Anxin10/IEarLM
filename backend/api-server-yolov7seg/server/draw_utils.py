"""
繪圖工具模組
參考: example/sample code/yolov7-seg/yolov7_detect_tn-seg_split.py
實現分割標記的繪製功能（節點+連接線）
"""

import cv2
import numpy as np
from typing import Tuple


def _draw_nodes_and_links(
    base_img: np.ndarray,
    contour: np.ndarray,
    color: Tuple[int, int, int],
    *,
    node_step_px: int = 12,
    node_radius: int = 4,
    line_thickness: int = 4,
    outline_alpha: float = 0.8,
    glow: bool = True,
    glow_strength: float = 0.35,
    glow_thickness_mult: float = 2.2,
    glow_radius_mult: float = 1.8
) -> np.ndarray:
    """
    沿輪廓繪製圓形節點並用粗線連接（透明內部）
    
    Args:
        base_img: 基礎圖片
        contour: 輪廓點
        color: 顏色 (B, G, R)
        node_step_px: 節點間距（像素）
        node_radius: 節點半徑
        line_thickness: 線條厚度
        outline_alpha: 輪廓透明度
        glow: 是否啟用發光效果
        glow_strength: 發光強度
        glow_thickness_mult: 發光線條厚度倍數
        glow_radius_mult: 發光節點半徑倍數
    
    Returns:
        繪製後的圖片
    """
    if contour is None or len(contour) < 2:
        return base_img
    
    # 確保輪廓是 Nx1x2 int32
    c = contour.reshape(-1, 2)
    if c.shape[0] < 2:
        return base_img
    
    # 計算累積弧長距離用於重採樣
    diffs = np.diff(c.astype(np.float32), axis=0)
    seg_lens = np.sqrt((diffs ** 2).sum(1))
    total = float(seg_lens.sum())
    if total <= 1e-6:
        return base_img
    
    # 沿輪廓多邊線每隔 node_step_px 採樣點
    step = max(2, int(node_step_px))
    d = 0.0
    idx = 0
    pts = [tuple(map(int, c[0]))]
    
    while idx < len(seg_lens):
        seg = float(seg_lens[idx])
        if seg <= 1e-6:
            idx += 1
            continue
        if d + seg >= step:
            # 在當前線段上插值
            t = (step - d) / seg
            p = c[idx].astype(np.float32) * (1 - t) + c[idx + 1].astype(np.float32) * t
            pts.append((int(round(p[0])), int(round(p[1]))))
            # 從插值點繼續在同一線段內
            c[idx] = p  # 將起點移動到插值點
            diffs = c[idx + 1].astype(np.float32) - c[idx].astype(np.float32)
            seg_lens[idx] = float(np.sqrt((diffs ** 2).sum()))
            d = 0.0
        else:
            d += seg
            idx += 1
    
    if len(pts) < 2:
        return base_img
    
    # 兩層樣式：
    # - 發光層（更粗 + 更柔和的 alpha）
    # - 主層（清晰）
    overlay = base_img.copy()
    
    a = float(outline_alpha)
    a = 0.0 if a < 0 else 1.0 if a > 1 else a
    
    if glow:
        glow_overlay = base_img.copy()
        gt = max(1, int(round(line_thickness * float(glow_thickness_mult))))
        gr = max(1, int(round(node_radius * float(glow_radius_mult))))
        ga = float(glow_strength)
        ga = 0.0 if ga < 0 else 1.0 if ga > 1 else ga
        
        for p0, p1 in zip(pts, pts[1:]):
            cv2.line(glow_overlay, p0, p1, color, thickness=gt, lineType=cv2.LINE_AA)
        cv2.line(glow_overlay, pts[-1], pts[0], color, thickness=gt, lineType=cv2.LINE_AA)
        for p in pts:
            cv2.circle(glow_overlay, p, gr, color, thickness=-1, lineType=cv2.LINE_AA)
        
        base_img = cv2.addWeighted(glow_overlay, ga, base_img, 1 - ga, 0)
    
    # 主清晰層
    for p0, p1 in zip(pts, pts[1:]):
        cv2.line(overlay, p0, p1, color, thickness=int(line_thickness), lineType=cv2.LINE_AA)
    cv2.line(overlay, pts[-1], pts[0], color, thickness=int(line_thickness), lineType=cv2.LINE_AA)
    r = int(node_radius)
    for p in pts:
        cv2.circle(overlay, p, r, color, thickness=-1, lineType=cv2.LINE_AA)
    
    return cv2.addWeighted(overlay, a, base_img, 1 - a, 0)


def _draw_label(
    base_img: np.ndarray,
    text: str,
    xy: Tuple[int, int],
    color: Tuple[int, int, int],
    *,
    font_scale: float = 0.6,
    thickness: int = 2,
    pad: int = 6,
    bg_alpha: float = 0.55
) -> np.ndarray:
    """
    繪製帶有半透明背景框的標籤
    
    Args:
        base_img: 基礎圖片
        text: 標籤文字
        xy: 標籤位置 (x, y)
        color: 文字顏色 (B, G, R)
        font_scale: 字體大小
        thickness: 線條厚度
        pad: 內邊距
        bg_alpha: 背景透明度
    
    Returns:
        繪製後的圖片
    """
    x, y = int(xy[0]), int(xy[1])
    font = cv2.FONT_HERSHEY_SIMPLEX
    (tw, th), bl = cv2.getTextSize(text, font, font_scale, thickness)
    th_total = th + bl
    
    # 背景矩形（稍微圓潤的外觀，通過額外的圓圈）
    x1, y1 = x, y - th_total - pad
    x2, y2 = x + tw + pad * 2, y + pad
    x1 = max(0, x1)
    y1 = max(0, y1)
    
    overlay = base_img.copy()
    # 深色背景以提高可讀性
    bg = (0, 0, 0)
    cv2.rectangle(overlay, (x1, y1), (x2, y2), bg, thickness=-1)
    # 小圓角圓圈以軟化邊緣
    r = max(4, pad // 2)
    for cx, cy in [(x1, y1), (x2, y1), (x1, y2), (x2, y2)]:
        cv2.circle(overlay, (cx, cy), r, bg, thickness=-1, lineType=cv2.LINE_AA)
    base_img = cv2.addWeighted(overlay, bg_alpha, base_img, 1 - bg_alpha, 0)
    
    # 前景文字
    cv2.putText(base_img, text, (x1 + pad, y2 - pad), font, font_scale, color, thickness, cv2.LINE_AA)
    return base_img


def draw_segmentation_annotations(
    img: np.ndarray,
    detections: list,
    draw_conf_thres: float = 0.1,
    node_step_px: int = 12,
    node_radius: int = 4,
    line_thickness: int = 4,
    outline_alpha: float = 0.85,
    glow: bool = False,
    glow_strength: float = 0.35
) -> np.ndarray:
    """
    在圖片上繪製分割標記（節點+連接線）
    
    Args:
        img: BGR 格式的圖片
        detections: 檢測結果列表，每個包含 'bbox', 'confidence', 'class_name', 'mask' 等
        draw_conf_thres: 繪製置信度閾值
        node_step_px: 節點間距
        node_radius: 節點半徑
        line_thickness: 線條厚度
        outline_alpha: 輪廓透明度
        glow: 是否啟用發光
        glow_strength: 發光強度
    
    Returns:
        繪製後的圖片
    """
    result_img = img.copy()
    
    # 獲取顏色函數（從 utils.plots）
    try:
        import sys
        from pathlib import Path
        # 嘗試多個可能的路徑（從 server/ 目錄出發）
        possible_paths = [
            Path(__file__).parent.parent.parent / "example" / "sample code" / "yolov7-seg",
            Path(__file__).parent.parent / "example" / "sample code" / "yolov7-seg",
            Path("/app/yolov7-seg"),  # Docker 容器內的路徑
        ]
        for yolov7_path in possible_paths:
            if yolov7_path.exists():
                sys.path.insert(0, str(yolov7_path))
                break
        from utils.plots import colors
    except ImportError:
        # 如果無法導入，使用簡單的顏色生成
        def colors(cls_id: int, bgr: bool = True) -> Tuple[int, int, int]:
            """生成顏色"""
            palette = [
                (255, 56, 56), (255, 157, 151), (255, 112, 193), (255, 178, 238),
                (207, 210, 49), (72, 249, 10), (146, 204, 23), (61, 219, 134),
                (26, 147, 52), (0, 212, 187), (44, 153, 168), (0, 194, 255),
                (52, 69, 147), (100, 115, 255), (0, 24, 236), (132, 56, 255),
                (82, 0, 133), (203, 56, 255), (255, 149, 200), (255, 55, 199)
            ]
            color = palette[cls_id % len(palette)]
            return color[::-1] if bgr else color
    
    for det in detections:
        conf = det.get('confidence', 0.0)
        if conf < draw_conf_thres:
            continue
        
        cls_id = det.get('class_id', 0)
        class_name = det.get('class_name', 'unknown')
        color = colors(cls_id, True)  # BGR 格式
        
        # 處理 mask
        mask = det.get('mask')
        if mask is None:
            # 如果沒有 mask，使用 bbox 繪製簡單矩形
            bbox = det.get('bbox', [])
            if len(bbox) == 4:
                x1, y1, x2, y2 = map(int, bbox)
                cv2.rectangle(result_img, (x1, y1), (x2, y2), color, 2)
                label = f"{class_name} {conf * 100:.2f}%"
                result_img = _draw_label(result_img, label, (x1, y1), color)
            continue
        
        # 將 mask 轉換為 numpy array
        if isinstance(mask, list):
            mask = np.array(mask, dtype=np.uint8)
        
        if mask.size == 0:
            continue
        
        # 確保 mask 的尺寸與圖片匹配
        img_h, img_w = result_img.shape[:2]
        if mask.shape[0] != img_h or mask.shape[1] != img_w:
            # mask 尺寸不匹配，需要調整
            # 如果 mask 比圖片小，可能是裁切後的 mask，應該已經在正確位置
            # 如果 mask 比圖片大，需要裁剪
            if mask.shape[0] > img_h or mask.shape[1] > img_w:
                mask = mask[:img_h, :img_w]
            elif mask.shape[0] < img_h or mask.shape[1] < img_w:
                # mask 較小，創建全尺寸 mask 並放置
                full_mask = np.zeros((img_h, img_w), dtype=np.uint8)
                # 假設 mask 應該從 (0,0) 開始（如果已經轉換過座標，應該已經在正確位置）
                h, w = mask.shape
                full_mask[:min(h, img_h), :min(w, img_w)] = mask[:min(h, img_h), :min(w, img_w)]
                mask = full_mask
        
        mask_i = mask.astype(np.uint8) * 255  # 轉換為 0/255
        
        # 輕微平滑以減少鋸齒
        h, w = img.shape[:2]
        k = max(3, int(min(h, w) * 0.008) | 1)  # 奇數核
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
        mask_i = cv2.morphologyEx(mask_i, cv2.MORPH_CLOSE, kernel, iterations=1)
        mask_i = cv2.GaussianBlur(mask_i, (k, k), 0)
        _, mask_i = cv2.threshold(mask_i, 127, 255, cv2.THRESH_BINARY)
        
        # 提取輪廓
        contours, _ = cv2.findContours(mask_i, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        
        # 使用最大輪廓
        c = max(contours, key=cv2.contourArea)
        if cv2.contourArea(c) < 10:  # 太小不繪製
            continue
        
        # 繪製節點+連接線輪廓（透明內部）
        result_img = _draw_nodes_and_links(
            result_img,
            c,
            color,
            node_step_px=node_step_px,
            node_radius=node_radius,
            line_thickness=line_thickness,
            outline_alpha=outline_alpha,
            glow=glow,
            glow_strength=glow_strength,
        )
        
        # 標籤位置：最大輪廓的質心
        m = cv2.moments(c)
        if m["m00"] != 0:
            cx = int(m["m10"] / m["m00"])
            cy = int(m["m01"] / m["m00"])
        else:
            x, y, w, h = cv2.boundingRect(c)
            cx, cy = x, y
        
        # 標籤文字（分割樣式）
        label = f"{class_name} {conf * 100:.2f}%"
        result_img = _draw_label(
            result_img,
            label,
            (cx, cy),
            color,
            font_scale=0.62,
            thickness=2,
            pad=6,
            bg_alpha=0.55,
        )
    
    return result_img


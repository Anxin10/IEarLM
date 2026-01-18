"""
YOLOv7-seg 檢測模組
參考: example/sample code/yolov7-seg/yolov7_detect_tn-seg_split.py
"""

import sys
from pathlib import Path
import cv2
import numpy as np
import torch
from typing import List, Dict, Optional, Tuple

# 添加 yolov7-seg 路徑到 sys.path
# 嘗試多個可能的路徑（從 server/ 目錄出發）
possible_paths = [
    Path(__file__).parent.parent.parent / "example" / "sample code" / "yolov7-seg",
    Path(__file__).parent.parent / "example" / "sample code" / "yolov7-seg",
    Path(__file__).parent / "yolov7-seg",
    Path("/app/yolov7-seg"),  # Docker 容器內的路徑
]

yolov7_path = None
for path in possible_paths:
    if path.exists():
        yolov7_path = path
        sys.path.insert(0, str(path))
        break

try:
    from utils.general import check_img_size, non_max_suppression, scale_coords
    from utils.segment.general import process_mask, scale_masks
    from utils.torch_utils import select_device
    from utils.augmentations import letterbox
    from models.common import DetectMultiBackend
except ImportError as e:
    print(f"警告: 無法導入 YOLOv7 模組: {e}")
    print(f"請確保 yolov7-seg 路徑正確: {yolov7_path}")
    raise

# 類別順序（與參考代碼一致）
CLASS_ORDER = [
    "eardrum_perforation", "atresia", "atrophic_scar", "blood_clot", "cerumen",
    "foreign_body", "middle_ear_effusion", "middle_ear_tumor", "otitis_externa",
    "otomycosis", "retraction", "tympanosclerosis", "ventilation_tube",
    "otitis_media", "tympanoplasty", "EAC_tumor", "myringitis", "normal"
]


class YOLOv7Detector:
    """YOLOv7-seg 檢測器"""
    
    def __init__(self, weights_path: str, device: str = None, img_size: int = 640):
        """
        初始化檢測器
        
        Args:
            weights_path: 模型權重文件路徑
            device: 設備 ('0' for GPU, 'cpu' for CPU, None 則自動檢測)
            img_size: 推理圖片尺寸
        """
        # 自動檢測設備
        if device is None:
            import torch
            if torch.cuda.is_available():
                device = "0"
            else:
                device = "cpu"
        
        self.device = select_device(device)
        self.half = self.device.type != 'cpu'  # 使用 FP16 如果使用 GPU
        
        # 載入模型
        print(f"載入模型: {weights_path}")
        self.model = DetectMultiBackend(weights_path, device=self.device, fp16=self.half)
        self.stride = self.model.stride
        self.img_size = check_img_size(img_size, s=self.stride)
        print(f"模型載入完成，設備: {self.device}, 圖片尺寸: {self.img_size}")
    
    def preprocess_image(self, img: np.ndarray) -> Tuple[torch.Tensor, np.ndarray, Tuple[int, int]]:
        """
        預處理圖片（使用 letterbox）
        
        Args:
            img: BGR 格式的原始圖片
        
        Returns:
            im_tensor: 預處理後的 tensor (1, 3, H, W)
            im0s: 原始圖片（用於座標轉換）
            original_shape: (height, width) 原始圖片尺寸
        """
        im0s = img.copy()
        original_shape = im0s.shape[:2]  # (height, width)
        
        # 使用 letterbox 進行預處理
        im = letterbox(im0s, self.img_size, stride=self.stride, auto=True)[0]
        im = im.transpose((2, 0, 1))[::-1]  # HWC to CHW, BGR to RGB
        im = np.ascontiguousarray(im)
        
        # 轉換為 tensor
        im_tensor = torch.from_numpy(im).to(self.device)
        im_tensor = im_tensor.half() if self.half else im_tensor.float()
        im_tensor /= 255.0
        
        if len(im_tensor.shape) == 3:
            im_tensor = im_tensor[None]  # 添加 batch 維度
        
        return im_tensor, im0s, original_shape
    
    def detect(
        self,
        img: np.ndarray,
        conf_thres: float = 0.25,
        iou_thres: float = 0.45,
        vis_conf_thres: float = 0.001
    ) -> List[Dict]:
        """
        執行檢測
        
        Args:
            img: BGR 格式的圖片
            conf_thres: 置信度閾值
            iou_thres: IoU 閾值（NMS）
            vis_conf_thres: 可視化置信度閾值（用於統計，通常設很低）
        
        Returns:
            detections: 檢測結果列表，每個元素包含：
                - bbox: [x1, y1, x2, y2] 邊界框座標（原始圖片尺寸）
                - confidence: 置信度
                - class_id: 類別 ID
                - class_name: 類別名稱
                - mask: 可選的 mask 數據
        """
        # 預處理
        im_tensor, im0s, original_shape = self.preprocess_image(img)
        
        # 推理
        with torch.no_grad():
            pred, out = self.model(im_tensor)
            # DetectMultiBackend with seg model returns:
            #   pred: (bs, n, 6+nm)
            #   out:  (features, proto) where proto is (bs, nm, mask_h, mask_w)
            proto = out[1]
            nm = int(proto.shape[1])  # number of mask coefficients
        
        # NMS
        det = non_max_suppression(pred, vis_conf_thres, iou_thres, agnostic=True, nm=nm)[0]
        
        detections = []
        if det is not None and len(det):
            # det: (n, 6 + nm) => xyxy, conf, cls, mask_coeffs...
            # IMPORTANT:
            # - process_mask() expects bboxes in the *inference image* coordinate system
            # - but we want bboxes in the *original image* coordinate system
            det_for_mask = det.clone()  # keep inference-scale boxes for mask decoding
            det[:, :4] = scale_coords(im_tensor.shape[2:], det[:, :4], im0s.shape).round()
            
            # 處理每個檢測結果
            det_cpu = det[:, :6].detach().cpu().numpy()  # xyxy conf cls
            
            for i in range(len(det_cpu)):
                x1, y1, x2, y2, conf, cls_id = det_cpu[i]
                cls_id = int(cls_id)
                conf = float(conf)
                
                # 只保留超過 conf_thres 的檢測
                if conf < conf_thres:
                    continue
                
                # 獲取類別名稱
                if cls_id < len(CLASS_ORDER):
                    class_name = CLASS_ORDER[cls_id]
                else:
                    class_name = f"class_{cls_id}"
                
                detection = {
                    "bbox": [float(x1), float(y1), float(x2), float(y2)],
                    "confidence": conf,
                    "class_id": cls_id,
                    "class_name": class_name
                }
                
                # 處理 mask（如果有）
                if nm > 0 and i < det_for_mask.shape[0]:
                    try:
                        # 使用 inference-scale boxes 進行 mask 解碼
                        masks = process_mask(
                            proto[0],
                            det_for_mask[i:i+1, 6:],
                            det_for_mask[i:i+1, :4],
                            im_tensor.shape[2:],
                            upsample=True
                        )
                        
                        # 將 mask 縮放到原始圖片尺寸
                        masks_hwn = masks.detach().cpu().to(torch.uint8).permute(1, 2, 0).numpy()
                        masks_hwn = scale_masks(im_tensor.shape[2:], masks_hwn, im0s.shape)
                        masks_hwn = (masks_hwn > 0.5).astype(np.uint8)
                        
                        if masks_hwn.shape[2] > 0:
                            mask = masks_hwn[:, :, 0]  # 取第一個 mask
                            detection["mask"] = mask.tolist()
                    except Exception as e:
                        print(f"處理 mask 時發生錯誤: {e}")
                
                detections.append(detection)
        
        return detections
    
    def transform_coordinates(
        self,
        detections: List[Dict],
        crop_info: Dict,
        to_original: bool = True
    ) -> List[Dict]:
        """
        轉換檢測座標（包括 bbox 和 mask）
        
        Args:
            detections: 檢測結果列表（裁切後圖片的座標）
            crop_info: 裁切資訊（來自 crop_module.crop_image_by_circle）
            to_original: 如果 True，將座標轉換回原始圖片；如果 False，保持裁切座標
        
        Returns:
            transformed_detections: 轉換後的檢測結果
        """
        if not crop_info.get("success"):
            return detections
        
        crop_x1, crop_y1, crop_x2, crop_y2 = crop_info["crop_coords"]
        
        transformed = []
        for det in detections:
            new_det = det.copy()
            
            if to_original:
                # 轉換 bbox 座標
                x1, y1, x2, y2 = det["bbox"]
                new_det["bbox"] = [
                    x1 + crop_x1,  # 加上裁切偏移
                    y1 + crop_y1,
                    x2 + crop_x1,
                    y2 + crop_y1
                ]
                
                # 轉換 mask（如果有）
                if "mask" in det and det["mask"] is not None:
                    mask = det["mask"]
                    if isinstance(mask, list):
                        mask = np.array(mask, dtype=np.uint8)
                    
                    if mask.size > 0:
                        # 創建原始圖片大小的 mask
                        original_shape = crop_info.get("original_shape")
                        cropped_shape = crop_info.get("cropped_shape")
                        
                        if original_shape and cropped_shape:
                            orig_h, orig_w = original_shape
                            crop_h, crop_w = cropped_shape
                            
                            # 創建原始尺寸的 mask
                            original_mask = np.zeros((orig_h, orig_w), dtype=np.uint8)
                            
                            # 將裁切後的 mask 放置到正確位置
                            # 注意：mask 的尺寸可能與 cropped_shape 不完全一致（因為 letterbox）
                            # 需要調整 mask 尺寸以匹配裁切區域
                            if mask.shape[0] == crop_h and mask.shape[1] == crop_w:
                                # mask 尺寸正好匹配
                                original_mask[crop_y1:crop_y1+crop_h, crop_x1:crop_x1+crop_w] = mask
                            else:
                                # mask 尺寸不匹配，需要縮放
                                mask_resized = cv2.resize(mask, (crop_w, crop_h), interpolation=cv2.INTER_NEAREST)
                                original_mask[crop_y1:crop_y1+crop_h, crop_x1:crop_x1+crop_w] = mask_resized
                            
                            new_det["mask"] = original_mask.tolist()
            # else: 保持裁切座標（不需要轉換）
            
            transformed.append(new_det)
        
        return transformed


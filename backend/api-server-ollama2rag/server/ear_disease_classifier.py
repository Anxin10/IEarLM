"""
耳疾病灶分類器
將疾病分類為耳道（EAC）或耳膜（TM），並提供中英文名稱
"""

# 疾病分類字典
DISEASE_CLASSIFICATION = {
    # 耳道 (External Auditory Canal - EAC) 疾病
    "atresia": "EAC",
    "blood_clot": "EAC",
    "cerumen": "EAC",
    "foreign_body": "EAC",
    "otitis_externa": "EAC",
    "otomycosis": "EAC",
    "EAC_tumor": "EAC",
    "eac_tumor": "EAC",
    
    # 耳膜 (Tympanic Membrane - TM) 疾病
    "eardrum_perforation": "TM",
    "atrophic_scar": "TM",
    "middle_ear_effusion": "TM",
    "middle_ear_tumor": "TM",
    "retraction": "TM",
    "tympanosclerosis": "TM",
    "ventilation_tube": "TM",
    "otitis_media": "TM",
    "tympanoplasty": "TM",
    "myringitis": "TM",
    
    # 正常
    "normal": "NORMAL",
    "background": "NORMAL",
}

# 疾病中英文名稱對照表
DISEASE_NAMES = {
    # 英文名稱 -> (中文名稱, 分類)
    "eardrum_perforation": ("耳膜破洞", "TM"),
    "atrophic_scar": ("萎縮性疤痕", "TM"),
    "middle_ear_effusion": ("中耳積水", "TM"),
    "middle_ear_tumor": ("中耳腫瘤", "TM"),
    "retraction": ("耳膜內縮", "TM"),
    "tympanosclerosis": ("耳膜硬化", "TM"),
    "ventilation_tube": ("中耳通氣管", "TM"),
    "otitis_media": ("中耳炎", "TM"),
    "tympanoplasty": ("耳膜修補", "TM"),
    "myringitis": ("耳膜炎", "TM"),
    "normal": ("正常", "NORMAL"),
    "background": ("正常", "NORMAL"),
    "atresia": ("外耳道閉鎖", "EAC"),
    "blood_clot": ("外耳道血塊", "EAC"),
    "cerumen": ("外耳道耳垢", "EAC"),
    "foreign_body": ("耳異物", "EAC"),
    "otitis_externa": ("外耳道炎", "EAC"),
    "otomycosis": ("耳黴菌", "EAC"),
    "EAC_tumor": ("外耳道腫瘤", "EAC"),
    "eac_tumor": ("外耳道腫瘤", "EAC"),
}

# 顯示名稱映射（用於前端顯示）
DISPLAY_NAME_MAP = {
    "eardrum_perforation": "Eardrum perforation",
    "atrophic_scar": "Atrophic scar",
    "middle_ear_effusion": "Middle ear effusion",
    "middle_ear_tumor": "Middle ear tumor",
    "retraction": "Retraction",
    "tympanosclerosis": "Tympanosclerosis",
    "ventilation_tube": "Ventilation tube",
    "otitis_media": "Otitis media",
    "tympanoplasty": "Tympanoplasty",
    "myringitis": "Myringitis",
    "normal": "Normal",
    "background": "Normal",
    "atresia": "Atresia",
    "blood_clot": "Blood clot",
    "cerumen": "Cerumen",
    "foreign_body": "Foreign body",
    "otitis_externa": "Otitis externa",
    "otomycosis": "Otomycosis",
    "EAC_tumor": "EAC tumor",
    "eac_tumor": "EAC tumor",
}


def normalize_class_name(class_name: str) -> str:
    """
    標準化類別名稱（處理大小寫和下劃線）
    """
    if not class_name:
        return "normal"
    return class_name.lower().replace(" ", "_").replace("-", "_")


def classify_disease(class_name: str) -> str:
    """
    將疾病分類為 EAC（耳道）、TM（耳膜）或 NORMAL（正常）
    
    Args:
        class_name: 疾病類別名稱（英文）
    
    Returns:
        "EAC", "TM", 或 "NORMAL"
    """
    normalized = normalize_class_name(class_name)
    return DISEASE_CLASSIFICATION.get(normalized, "UNKNOWN")


def get_disease_info(class_name: str) -> dict:
    """
    獲取疾病的完整信息（中英文名稱和分類）
    
    Args:
        class_name: 疾病類別名稱（英文）
    
    Returns:
        {
            "class_name_en": str,  # 英文名稱（顯示用）
            "class_name_zh": str,  # 中文名稱
            "category": str,       # "EAC", "TM", 或 "NORMAL"
            "normalized": str      # 標準化的類別名稱
        }
    """
    normalized = normalize_class_name(class_name)
    
    # 獲取顯示名稱
    display_name_en = DISPLAY_NAME_MAP.get(normalized, class_name)
    
    # 獲取中文名稱和分類
    if normalized in DISEASE_NAMES:
        name_zh, category = DISEASE_NAMES[normalized]
    else:
        # 如果找不到，嘗試分類
        category = classify_disease(normalized)
        name_zh = class_name  # 使用原始名稱作為備用
    
    return {
        "class_name_en": display_name_en,
        "class_name_zh": name_zh,
        "category": category,
        "normalized": normalized
    }


def process_detections(detections: list) -> dict:
    """
    處理檢測結果，分類並添加中英文名稱
    
    Args:
        detections: YOLOv7 API 返回的檢測結果列表
    
    Returns:
        {
            "detections": [...],  # 處理後的檢測結果
            "primary_diagnosis": {...},  # 主要診斷（置信度最高）
            "eac_detections": [...],  # 耳道相關檢測
            "tm_detections": [...],  # 耳膜相關檢測
            "summary": {
                "total": int,
                "eac_count": int,
                "tm_count": int,
                "normal_count": int
            }
        }
    """
    processed_detections = []
    eac_detections = []
    tm_detections = []
    normal_detections = []
    
    for det in detections:
        class_name = det.get("class_name") or det.get("class", "normal")
        disease_info = get_disease_info(class_name)
        
        # 創建處理後的檢測結果
        processed_det = {
            **det,  # 保留原始數據
            "class_name_en": disease_info["class_name_en"],
            "class_name_zh": disease_info["class_name_zh"],
            "category": disease_info["category"],
            "normalized_class": disease_info["normalized"]
        }
        
        processed_detections.append(processed_det)
        
        # 按分類分組
        if disease_info["category"] == "EAC":
            eac_detections.append(processed_det)
        elif disease_info["category"] == "TM":
            tm_detections.append(processed_det)
        elif disease_info["category"] == "NORMAL":
            normal_detections.append(processed_det)
    
    # 找出主要診斷（置信度最高）
    primary_diagnosis = None
    if processed_detections:
        primary = max(processed_detections, key=lambda x: x.get("confidence", 0))
        primary_diagnosis = {
            "class_name_en": primary["class_name_en"],
            "class_name_zh": primary["class_name_zh"],
            "category": primary["category"],
            "confidence": primary.get("confidence", 0),
            "normalized_class": primary["normalized_class"]
        }
    
    return {
        "detections": processed_detections,
        "primary_diagnosis": primary_diagnosis,
        "eac_detections": eac_detections,
        "tm_detections": tm_detections,
        "normal_detections": normal_detections,
        "summary": {
            "total": len(processed_detections),
            "eac_count": len(eac_detections),
            "tm_count": len(tm_detections),
            "normal_count": len(normal_detections)
        }
    }
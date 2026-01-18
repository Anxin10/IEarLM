"""
知識庫資料夾和文件管理存儲模組
使用 JSON 文件存儲資料夾結構和文件分類信息
"""
import os
import json
from typing import List, Dict, Optional
from datetime import datetime

# 存儲文件路徑
STORAGE_DIR = os.path.join(os.path.dirname(__file__), "kb_storage")
FOLDERS_FILE = os.path.join(STORAGE_DIR, "folders.json")
FILES_MAPPING_FILE = os.path.join(STORAGE_DIR, "files_mapping.json")

# 確保存儲目錄存在
os.makedirs(STORAGE_DIR, exist_ok=True)


def _load_json_file(filepath: str, default: any) -> any:
    """載入 JSON 文件，如果不存在則返回默認值"""
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[KB Storage] 載入 {filepath} 失敗: {e}")
            return default
    return default


def _save_json_file(filepath: str, data: any):
    """保存 JSON 文件"""
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[KB Storage] 保存 {filepath} 失敗: {e}")
        raise


# ==========================================================
# 資料夾管理
# ==========================================================

def get_folders() -> List[Dict]:
    """獲取所有資料夾"""
    folders = _load_json_file(FOLDERS_FILE, [])
    
    # 如果文件為空，初始化默認資料夾
    if not folders:
        default_folders = [
            {"id": "root", "name": "Uncategorized", "type": "system", "created_at": "2025-01-01"}
        ]
        _save_json_file(FOLDERS_FILE, default_folders)
        return default_folders
    
    return folders


def create_folder(name: str, folder_type: str = "custom") -> Dict:
    """創建新資料夾"""
    folders = get_folders()
    
    # 生成唯一 ID
    import uuid
    folder_id = f"f_{uuid.uuid4().hex[:8]}"
    
    new_folder = {
        "id": folder_id,
        "name": name,
        "type": folder_type,
        "created_at": datetime.now().strftime("%Y-%m-%d")
    }
    
    folders.append(new_folder)
    _save_json_file(FOLDERS_FILE, folders)
    
    return new_folder


def update_folder(folder_id: str, name: str) -> Optional[Dict]:
    """更新資料夾名稱"""
    folders = get_folders()
    
    for folder in folders:
        if folder["id"] == folder_id:
            # 系統資料夾（root）不能重命名
            if folder.get("type") == "system":
                raise ValueError("Cannot rename system folder")
            
            folder["name"] = name
            _save_json_file(FOLDERS_FILE, folders)
            return folder
    
    return None


def delete_folder(folder_id: str) -> bool:
    """刪除資料夾（系統資料夾不能刪除）"""
    folders = get_folders()
    
    for folder in folders:
        if folder["id"] == folder_id:
            if folder.get("type") == "system":
                raise ValueError("Cannot delete system folder")
            
            # 將該資料夾中的文件移動到 root
            files_mapping = get_files_mapping()
            for filename in list(files_mapping.keys()):
                if files_mapping[filename] == folder_id:
                    files_mapping[filename] = "root"
            _save_json_file(FILES_MAPPING_FILE, files_mapping)
            
            # 刪除資料夾
            folders.remove(folder)
            _save_json_file(FOLDERS_FILE, folders)
            return True
    
    return False


# ==========================================================
# 文件分類管理
# ==========================================================

def get_files_mapping() -> Dict[str, str]:
    """獲取文件到資料夾的映射（filename -> folder_id）"""
    return _load_json_file(FILES_MAPPING_FILE, {})


def set_file_folder(filename: str, folder_id: str):
    """設置文件所屬的資料夾"""
    files_mapping = get_files_mapping()
    files_mapping[filename] = folder_id
    _save_json_file(FILES_MAPPING_FILE, files_mapping)
    
    # 同時更新 Qdrant 中的 payload
    try:
        from rag_pipeline import qdrant, QDRANT_COLLECTION
        from qdrant_client.http import models as qmodels
        
        # 更新所有相關的 chunks
        qdrant.set_payload(
            collection_name=QDRANT_COLLECTION,
            payload={"folder_id": folder_id},
            points=qmodels.Filter(
                must=[qmodels.FieldCondition(key="source", match=qmodels.MatchValue(value=filename))]
            )
        )
    except Exception as e:
        print(f"[KB Storage] 更新 Qdrant payload 失敗: {e}")


def get_file_folder(filename: str) -> str:
    """獲取文件所屬的資料夾 ID（默認為 root）"""
    files_mapping = get_files_mapping()
    return files_mapping.get(filename, "root")


def remove_file_mapping(filename: str):
    """從文件映射中刪除指定文件"""
    files_mapping = get_files_mapping()
    if filename in files_mapping:
        del files_mapping[filename]
        _save_json_file(FILES_MAPPING_FILE, files_mapping)
        return True
    return False


def get_files_by_folder(folder_id: str) -> List[str]:
    """獲取指定資料夾中的所有文件名"""
    files_mapping = get_files_mapping()
    return [filename for filename, fid in files_mapping.items() if fid == folder_id]

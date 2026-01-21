from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class AskRequest(BaseModel):
    question: str
    top_k: int = 2  # 預設取 2 段，降低搜尋與生成時間

class AskResponse(BaseModel):
    answer: str
    contexts: List[str]  # 我們回傳有用到哪些知識片段，方便你debug

class IngestRequest(BaseModel):
    text: str               # 你要加入的知識（可以是整頁文件）
    metadata: Optional[dict] = None


class DeleteRequest(BaseModel):
    filename: str


class ReportRequest(BaseModel):
    """報告生成請求模型"""
    template_name: str  # 模板文件名（不含 .docx 後綴）
    data: Dict[str, Any]  # 報告數據字典
    output_format: Optional[str] = "both"  # 輸出格式：'docx', 'pdf', 'both'（預設為 both，Word 版本始終生成供前端編修）


class SaveRequest(BaseModel):
    """保存報告請求模型"""
    report_id: str  # 報告 ID（文件名）
    custom_name: Optional[str] = None  # 允許使用者自定義存檔名稱


class CleanupResponse(BaseModel):
    """清理響應模型"""
    status: str
    deleted_files: List[str]
    freed_space_kb: float
    message: str


class ReportContentResponse(BaseModel):
    """報告內容響應模型"""
    file_id: str
    template_name: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    content_text: Optional[str] = None
    created_at: Optional[str] = None
    source: Optional[str] = None


class UpdateReportContentRequest(BaseModel):
    """更新報告內容請求模型"""
    data: Dict[str, Any]  # 更新後的數據字典（會與原有數據合併）
    output_format: Optional[str] = None  # 可選的輸出格式，如果不指定則使用原始格式


# ==========================================================
# 知識庫資料夾管理模型
# ==========================================================

class FolderCreateRequest(BaseModel):
    """創建資料夾請求模型"""
    name: str
    type: str = "custom"  # 'system' 或 'custom'


class FolderUpdateRequest(BaseModel):
    """更新資料夾請求模型"""
    name: str


class FileMoveRequest(BaseModel):
    """移動文件請求模型"""
    folder_id: str


# ==========================================================
# Clinical Case Management Models
# ==========================================================

class FindingCreate(BaseModel):
    region: str # 'EAC' or 'TM'
    code: str = ""
    label_zh: str
    label_en: str
    is_normal: bool = False
    percentage: float = 0.0

class ExamRecordCreate(BaseModel):
    side: str # 'left' or 'right'
    status: str = "pending"
    diagnosis: Optional[str] = None
    image_path: Optional[str] = None # Base64 or URL
    notes: Optional[str] = None
    findings: List[FindingCreate] = []

class CreateCaseRequest(BaseModel):
    patient_id: int # Database ID of the patient
    visit_date: str # YYYY-MM-DD
    diagnosis_summary: Optional[str] = None
    general_notes: Optional[str] = None
    exams: List[ExamRecordCreate] = []
    doctor_id: Optional[int] = None
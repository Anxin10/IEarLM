from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime, date
import enum

# 列舉
class UserRole(str, enum.Enum):
    """
    系統使用者角色定義
    """
    OWNER = "OWNER"       # 擁有者，最高權限
    MANAGER = "MANAGER"   # 管理者，可管理使用者與資料
    USER = "USER"         # 一般使用者，僅能操作基本功能

class AppUserStatus(str, enum.Enum): 
    """
    系統使用者帳號狀態 (AppUserStatus)
    由原先的 Status 改名，避免與病患的健康狀態 (PatientStatus) 混淆。
    """
    ACTIVE = "active"        # 啟用中
    SUSPENDED = "suspended"  # 已停權
    INVITED = "invited"      # 已邀請但尚未啟用

class PatientStatus(str, enum.Enum):
    """
    病患健康狀態
    用於標示病患目前的病情嚴重程度或恢復狀況。
    """
    CRITICAL = "Critical"   # 危急
    STABLE = "Stable"       # 穩定
    RECOVERED = "Recovered" # 已康復

class ExamStatus(str, enum.Enum):
    """
    檢查紀錄狀態
    追蹤該次檢查報告的完成度。
    """
    PENDING = "pending"     # 待處理
    DRAFT = "draft"         # 草稿階段
    COMPLETED = "completed" # 已完成 (報告已確認)

class EarSide(str, enum.Enum):
    """
    患部位置 (左耳/右耳)
    """
    LEFT = "left"   # 左耳
    RIGHT = "right" # 右耳

class RegionType(str, enum.Enum):
    EAC = "EAC"
    TM = "TM"

# 資料庫模型

class User(SQLModel, table=True):
    """
    系統使用者模型 (User)
    儲存醫生、護理師或管理員的帳號資訊。
    """
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    username: str = Field(unique=True, index=True)
    password_hash: str
    name: str
    role: UserRole = Field(default=UserRole.USER)
    email: str = Field(unique=True, index=True)
    department: str
    status: AppUserStatus = Field(default=AppUserStatus.ACTIVE)
    avatar: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # 關聯
    cases: List["MedicalCase"] = Relationship(back_populates="doctor")

class Patient(SQLModel, table=True):
    """
    病患基本資料模型 (Patient)
    儲存病人的核心身份資訊，不包含病歷資料。
    """
    __tablename__ = "patients"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    medical_record_number: str = Field(unique=True, index=True) # 病歷號 (Chart Number)，全系統唯一
    name: str = Field(index=True) # 病患姓名，建立索引以加速搜尋
    gender: str
    birth_date: Optional[date] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # 關聯：一個病患擁有多個就診紀錄 (Case)
    cases: List["MedicalCase"] = Relationship(back_populates="patient")

class MedicalCase(SQLModel, table=True):
    """
    就診/病例紀錄 (MedicalCase)
    代表病人的一次看診紀錄 (Visit)，包含診斷摘要與左右耳的檢查。
    """
    __tablename__ = "medical_cases" # 代表一次「就診」

    id: str = Field(primary_key=True, index=True) # 自定義 ID 格式，例如：IEAR-LM-2601-001
    patient_id_fk: int = Field(foreign_key="patients.id")
    doctor_id: Optional[int] = Field(default=None, foreign_key="users.id")
    
    visit_date: date
    status: PatientStatus = Field(default=PatientStatus.STABLE)
    diagnosis_summary: Optional[str] = None # 綜合診斷摘要，例如："左：中耳炎 / 右：正常"
    general_notes: Optional[str] = None
    image_url: Optional[str] = None # 主要封面圖片
    
    report_generated: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow) # 驗證通常處理預設值，但在更新時若嚴格需要可使用 sa_column_kwargs，目前手動更新即可，或是加入 sa_column=Column(DateTime, onupdate=func.now())

    # 關聯：
    # - 屬於一個病患
    # - 屬於一個醫生
    # - 包含多個檢查紀錄 (Exams)
    patient: Optional[Patient] = Relationship(back_populates="cases")
    doctor: Optional[User] = Relationship(back_populates="cases")
    exams: List["ExamRecord"] = Relationship(back_populates="case", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class ExamRecord(SQLModel, table=True):
    """
    單側耳朵檢查紀錄 (ExamRecord)
    紀錄左耳或右耳的詳細檢查結果、圖片與診斷。
    """
    __tablename__ = "exam_records"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    case_id: str = Field(foreign_key="medical_cases.id")
    side: EarSide # 左 或 右
    
    status: ExamStatus = Field(default=ExamStatus.PENDING)
    diagnosis: Optional[str] = None # 此耳的具體診斷
    image_path: Optional[str] = None
    notes: Optional[str] = None
    
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # 關聯：
    # - 屬於某次就診 (Case)
    # - 包含多個病理發現 (Findings)
    # - 包含多個圖像分割 (Segmentations)
    case: Optional[MedicalCase] = Relationship(back_populates="exams")
    findings: List["Finding"] = Relationship(back_populates="exam_record", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    segmentations: List["Segmentation"] = Relationship(back_populates="exam_record", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class Finding(SQLModel, table=True):
    """
    病理特徵發現 (Finding)
    AI 或醫生標註的具體病徵，例如 "耳膜穿孔"、"充血" 等。
    包含該特徵的信心度與是否正常。
    """
    __tablename__ = "findings"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    exam_record_id: int = Field(foreign_key="exam_records.id")
    
    region: RegionType # 部位：EAC (外耳道) 或 TM (耳膜)
    code: str
    label_zh: str
    label_en: str
    is_normal: bool = Field(default=False)
    percentage: float = Field(default=0.0) # 信心分數或嚴重程度百分比

    # 關聯
    exam_record: Optional[ExamRecord] = Relationship(back_populates="findings")

class Segmentation(SQLModel, table=True):
    """
    影像分割資料 (Segmentation)
    儲存 AI 分割出的病灶區域，通常以 SVG 路徑或多邊形座標表示。
    """
    __tablename__ = "segmentations"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    exam_record_id: int = Field(foreign_key="exam_records.id")
    
    label: str
    confidence: float
    path: str # 路徑數據，格式為 SVG Path 字串或座標點列
    color: str

    exam_record: Optional[ExamRecord] = Relationship(back_populates="segmentations")

# ==========================================
# 用於 API 回應的讀取模型 (巢狀)
# ==========================================
class FindingRead(SQLModel):
    region: RegionType
    code: str
    label_zh: str
    label_en: str
    is_normal: bool
    percentage: float

class ExamRecordRead(SQLModel):
    side: EarSide
    status: ExamStatus
    diagnosis: Optional[str]
    image_path: Optional[str]
    notes: Optional[str]
    findings: List[FindingRead] = []

class MedicalCaseRead(SQLModel):
    id: str
    visit_date: date
    status: PatientStatus
    diagnosis_summary: Optional[str]
    general_notes: Optional[str]
    image_url: Optional[str]
    report_generated: bool
    created_at: datetime
    exams: List[ExamRecordRead] = []

class PatientRead(SQLModel):
    id: int
    medical_record_number: str
    name: str
    gender: str
    birth_date: Optional[date]
    created_at: datetime
    cases: List[MedicalCaseRead] = []

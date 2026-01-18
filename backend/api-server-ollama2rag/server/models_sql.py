from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime, date
import enum

# Enums
class UserRole(str, enum.Enum):
    OWNER = "OWNER"
    MANAGER = "MANAGER"
    USER = "USER"

class AppUserStatus(str, enum.Enum): # Renamed to avoid confusion with Patient Status
    ACTIVE = "active"
    SUSPENDED = "suspended"
    INVITED = "invited"

class PatientStatus(str, enum.Enum):
    CRITICAL = "Critical"
    STABLE = "Stable"
    RECOVERED = "Recovered"

class ExamStatus(str, enum.Enum):
    PENDING = "pending"
    DRAFT = "draft"
    COMPLETED = "completed"

class EarSide(str, enum.Enum):
    LEFT = "left"
    RIGHT = "right"

class RegionType(str, enum.Enum):
    EAC = "EAC"
    TM = "TM"

# Models

class User(SQLModel, table=True):
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

    # Relationships
    cases: List["MedicalCase"] = Relationship(back_populates="doctor")

class Patient(SQLModel, table=True):
    __tablename__ = "patients"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    medical_record_number: str = Field(unique=True, index=True) # E.g. Chart Number
    name: str = Field(index=True)
    gender: str
    birth_date: Optional[date] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    cases: List["MedicalCase"] = Relationship(back_populates="patient")

class MedicalCase(SQLModel, table=True):
    __tablename__ = "medical_cases" # Represents a "Visit"

    id: str = Field(primary_key=True, index=True) # The ID like IEAR-LM-2601-...
    patient_id_fk: int = Field(foreign_key="patients.id")
    doctor_id: Optional[int] = Field(default=None, foreign_key="users.id")
    
    visit_date: date
    status: PatientStatus = Field(default=PatientStatus.STABLE)
    diagnosis_summary: Optional[str] = None # "L: Otitis / R: Normal"
    general_notes: Optional[str] = None
    image_url: Optional[str] = None # Main cover image
    
    report_generated: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow) # Validation usually handles default, but onupdate needs sa_column_kwargs if strictly needed, but manual update is fine for now or we add sa_column=Column(DateTime, onupdate=func.now())

    # Relationships
    patient: Optional[Patient] = Relationship(back_populates="cases")
    doctor: Optional[User] = Relationship(back_populates="cases")
    exams: List["ExamRecord"] = Relationship(back_populates="case", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class ExamRecord(SQLModel, table=True):
    __tablename__ = "exam_records"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    case_id: str = Field(foreign_key="medical_cases.id")
    side: EarSide # left or right
    
    status: ExamStatus = Field(default=ExamStatus.PENDING)
    diagnosis: Optional[str] = None # Specific diagnosis for this ear
    image_path: Optional[str] = None
    notes: Optional[str] = None
    
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    case: Optional[MedicalCase] = Relationship(back_populates="exams")
    findings: List["Finding"] = Relationship(back_populates="exam_record", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    segmentations: List["Segmentation"] = Relationship(back_populates="exam_record", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class Finding(SQLModel, table=True):
    __tablename__ = "findings"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    exam_record_id: int = Field(foreign_key="exam_records.id")
    
    region: RegionType # EAC or TM
    code: str
    label_zh: str
    label_en: str
    is_normal: bool = Field(default=False)
    percentage: float = Field(default=0.0)

    # Relationships
    exam_record: Optional[ExamRecord] = Relationship(back_populates="findings")

class Segmentation(SQLModel, table=True):
    __tablename__ = "segmentations"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    exam_record_id: int = Field(foreign_key="exam_records.id")
    
    label: str
    confidence: float
    path: str # Path data (SVG path or polygon points)
    color: str

    exam_record: Optional[ExamRecord] = Relationship(back_populates="segmentations")

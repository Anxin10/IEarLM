
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, desc
from sqlmodel import select
from sqlalchemy.orm import selectinload
from datetime import datetime, date
import models_sql
from models_sql import Patient, MedicalCase, ExamRecord, Finding, Segmentation, PatientStatus

# --- Patient ---

async def get_patient(db: AsyncSession, patient_id: int):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    return result.scalars().first()

async def get_patient_by_mrn(db: AsyncSession, mrn: str):
    result = await db.execute(select(Patient).where(Patient.medical_record_number == mrn))
    return result.scalars().first()

async def get_patients(db: AsyncSession, skip: int = 0, limit: int = 100):
    result = await db.execute(select(Patient).offset(skip).limit(limit))
    return result.scalars().all()

async def create_patient(db: AsyncSession, name: str, mrn: str, gender: str, birth_date: date):
    db_patient = Patient(name=name, medical_record_number=mrn, gender=gender, birth_date=birth_date)
    db.add(db_patient)
    await db.commit()
    await db.refresh(db_patient)
    return db_patient

# JX新增
async def delete_patient(db: AsyncSession, patient_id: int) -> bool:
    """
    刪除病患函式
    回傳: True (刪除成功), False (找不到人)
    """
    try:
        # 1. 查詢該 ID 的病患
        result = await db.execute(select(Patient).where(Patient.id == patient_id))
        patient = result.scalars().first()

        # 2. 如果找不到，回傳 False
        if not patient:
            return False

        # 3. 執行刪除並提交
        await db.delete(patient)
        await db.commit()
        return True
        
    except Exception as e:
        await db.rollback() # 發生錯誤時復原
        print(f"CRUD Delete Error: {e}")
        raise e


# --- Medical Case (Visit) ---

async def get_case(db: AsyncSession, case_id: str):
    # Load relationships eagerly
    stmt = (
        select(MedicalCase)
        .where(MedicalCase.id == case_id)
        .options(
            selectinload(MedicalCase.exams).selectinload(ExamRecord.findings),
            selectinload(MedicalCase.patient)
        )
    )
    result = await db.execute(stmt)
    return result.scalars().first()

async def get_cases(db: AsyncSession, skip: int = 0, limit: int = 100):
    stmt = (
        select(MedicalCase)
        .order_by(desc(MedicalCase.visit_date))
        .offset(skip)
        .limit(limit)
        .options(selectinload(MedicalCase.patient))
    )
    result = await db.execute(stmt)
    return result.scalars().all()

async def create_case(db: AsyncSession, case_data: dict, patient_id: int):
    # case_data should contain keys matching MedicalCase model
    db_case = MedicalCase(**case_data, patient_id_fk=patient_id)
    db.add(db_case)
    await db.commit()
    await db.refresh(db_case)
    return db_case

async def update_case_status(db: AsyncSession, case_id: str, status: PatientStatus):
    stmt = select(MedicalCase).where(MedicalCase.id == case_id)
    result = await db.execute(stmt)
    case = result.scalars().first()
    if case:
        case.status = status
        await db.commit()
        await db.refresh(case)
    return case

# --- Stats for Dashboard ---

async def get_dashboard_stats(db: AsyncSession):
    # Total Patients (actually total cases for now, or distinct patients?)
    # Frontend logic counts "entries" which are visits. Let's count cases.
    total_cases_result = await db.execute(select(func.count(MedicalCase.id)))
    total_patients_count = total_cases_result.scalar()

    # Critical Cases
    critical_cases_result = await db.execute(
        select(func.count(MedicalCase.id)).where(MedicalCase.status == PatientStatus.CRITICAL)
    )
    critical_count = critical_cases_result.scalar()

    # Disease Distribution (Top 7)
    
    # Aggregating from Finding label_en
    stmt = (
        select(Finding.label_en, func.count(Finding.id))
        .group_by(Finding.label_en)
        .order_by(func.count(Finding.id).desc())
        .limit(7)
    )
    dist_result = await db.execute(stmt)
    distribution = [{"name": row[0], "value": row[1]} for row in dist_result.all()]

    # Monthly Visits (Last 12 months)
    current_year = datetime.now().year
    stmt = (
        select(MedicalCase.visit_date)
        .where(MedicalCase.visit_date >= date(current_year - 1, 1, 1))
    )
    visits_result = await db.execute(stmt)
    visits_dates = visits_result.scalars().all()
    
    visits_map = {}
    for d in visits_dates:
        month_key = d.strftime("%b") # Jan, Feb...
        visits_map[month_key] = visits_map.get(month_key, 0) + 1
    
    # Ensure order? Frontend expects array.
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_visits = [{"name": m, "visits": visits_map.get(m, 0)} for m in months]

    # AI Accuracy - Mock for now or store feedback
    ai_accuracy = 95.0 

    # New Patients This Month
    first_day_this_month = date(current_year, datetime.now().month, 1)
    new_patients_result = await db.execute(
        select(func.count(MedicalCase.id)).where(MedicalCase.visit_date >= first_day_this_month)
    )
    new_patients_count = new_patients_result.scalar()

    # Generated Reports Count
    reports_result = await db.execute(
        select(func.count(MedicalCase.id)).where(MedicalCase.report_generated == True)
    )
    reports_count = reports_result.scalar()

    # Recent Cases
    recent_cases_stmt = (
        select(MedicalCase)
        .order_by(desc(MedicalCase.created_at))
        .limit(5)
        .options(selectinload(MedicalCase.patient))
    )
    recent_cases_result = await db.execute(recent_cases_stmt)
    recent_cases_list = recent_cases_result.scalars().all()
    
    recent_cases_data = []
    for c in recent_cases_list:
        recent_cases_data.append({
            "id": c.id,
            "patientName": c.patient.name if c.patient else "Unknown",
            "diagnosis": c.diagnosis_summary or "Pending",
            "date": c.visit_date.isoformat() if c.visit_date else "",
            "status": c.status.value if hasattr(c.status, 'value') else str(c.status)
        })

    return {
        "totalPatients": total_patients_count,
        "criticalCases": critical_count,
        "aiAccuracy": ai_accuracy,
        "newPatientsThisMonth": new_patients_count,
        "generatedReportsCount": reports_count,
        "monthlyVisits": monthly_visits,
        "diseaseDistribution": distribution,
        "recentCases": recent_cases_data
    }

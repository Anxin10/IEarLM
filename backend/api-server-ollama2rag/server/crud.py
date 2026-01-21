from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, desc, cast, Integer
from sqlmodel import select
from sqlalchemy.orm import selectinload
from datetime import datetime, date
import models_sql
from models_sql import Patient, MedicalCase, ExamRecord, Finding, Segmentation, PatientStatus


# --- 病患 (Patient) ---

async def get_patient(db: AsyncSession, patient_id: int):
    # 預先載入 (Eager load) 關聯資料：病歷 -> 檢查紀錄 -> 病灶發現
    stmt = (
        select(Patient)
        .where(Patient.id == patient_id)
        .options(
            selectinload(Patient.cases).selectinload(MedicalCase.exams).selectinload(ExamRecord.findings)
        )
    )
    result = await db.execute(stmt)
    return result.scalars().first()

async def get_patient_by_mrn(db: AsyncSession, mrn: str):
    result = await db.execute(select(Patient).where(Patient.medical_record_number == mrn))
    return result.scalars().first()

async def get_patients(db: AsyncSession, skip: int = 0, limit: int = 100):
    # 載入病歷以便在列表中顯示診斷摘要
    stmt = (
        select(Patient)
        .options(
            selectinload(Patient.cases)
            .selectinload(MedicalCase.exams)
            .selectinload(ExamRecord.findings)
        )
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()

async def create_patient(db: AsyncSession, name: str, gender: str, birth_date: date, mrn: str = None):
    # 如果未提供 MRN，自動產生 (Max + 1)
    if not mrn:
        # 查詢目前最大的數字型 MRN
        stmt = select(func.max(cast(Patient.medical_record_number, Integer)))
        result = await db.execute(stmt)
        max_mrn = result.scalar()
        
        if max_mrn:
            mrn = str(max_mrn + 1)
        else:
            mrn = "1000" # 預設起始號碼

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


# --- 病歷 (Medical Case / Visit) ---

async def get_case(db: AsyncSession, case_id: str):
    # 預先載入關聯資料
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
    # case_data 現在應該嚴格遵循 CreateCaseRequest 結構
    # 但因為它是從 app.py 傳來的字典 (經過 pydantic 驗證)，我們可以進行處理。
    
    # 1. 建立病歷 (MedicalCase)
    case_id = f"IEAR-LM-{datetime.now().strftime('%y%m')}-{int(datetime.now().timestamp())}" # 如果未提供，則產生備用 ID
    # 前端通常會在 case_data 中傳送 ID，或者我們自行產生。
    # 假設 case_data 可能沒有 ID 且我們需要產生，
    # 或者如果有傳送 (來自前端邏輯)，則使用它。
    

    # DEBUG LOGGING START
    import traceback
    try:
        debug_msg = f"\n[{datetime.now()}] [DEBUG] create_case called.\n"
        debug_msg += f"  patient_id: {patient_id}\n"
        debug_msg += f"  case_data keys: {list(case_data.keys())}\n"
        exams_in_data = case_data.get('exams', [])
        debug_msg += f"  exams count: {len(exams_in_data)}\n"
        for i, ex in enumerate(exams_in_data):
            fds = ex.get('findings', [])
            debug_msg += f"    Exam {i} ({ex.get('side')}): {len(fds)} findings.\n"
            if len(fds) > 0:
                debug_msg += f"    Findings content: {fds}\n"
        
        print(debug_msg) # Print to terminal
        with open("debug_create_case.txt", "a", encoding="utf-8") as f:
            f.write(debug_msg)
    except Exception as e:
        print(f"Logging failed: {e}")
        traceback.print_exc()
    # DEBUG LOGGING END

    # 取出 exams 以便分開儲存
    exams_data = case_data.pop('exams', [])
    
    # 處理 ID：如果不存在，則產生一個 (雖然前端通常會產生)
    if 'id' not in case_data:
         # 簡單產生方式：日期 + 序號 (Mock)
         pass 

    # 整理用於 MedicalCase 模型的字典
    # 我們需要將 'patient_id' (來自請求) 對應到 'patient_id_fk' (模型欄位)
    # 解析就診日期字串為日期物件
    visit_date_raw = case_data.get("visit_date")
    if isinstance(visit_date_raw, str):
        visit_date_obj = datetime.strptime(visit_date_raw, "%Y-%m-%d").date()
    else:
        visit_date_obj = visit_date_raw or datetime.now().date()

    case_db_data = {
        "id": case_data.get("id"),
        "patient_id_fk": patient_id, # 明確傳遞的參數
        "visit_date": visit_date_obj,
        "diagnosis_summary": case_data.get("diagnosis_summary"),
        "general_notes": case_data.get("general_notes"),
        "doctor_id": case_data.get("doctor_id"),
        "report_generated": False, # 預設值
        "status": "Stable" # 預設值或來自輸入
    }
    
    # 確保必要欄位
    if not case_db_data['id']:
        # 如果未提供，使用基於時間戳記的 ID
        case_db_data['id'] = f"AUTO-{int(datetime.now().timestamp())}"

    db_case = MedicalCase(**case_db_data)
    db.add(db_case)
    await db.flush() # Flush 以取得 ID (如果是自動產生的)，雖然這裡 ID 是手動設定的字串

    # 2. 儲存檢查紀錄 (Exams) 和病灶發現 (Findings)
    for exam in exams_data:
        # exam 是一個字典
        exam_db = ExamRecord(
            case_id=db_case.id,
            side=exam.get('side'),
            status=exam.get('status', 'pending'),
            diagnosis=exam.get('diagnosis'),
            image_path=exam.get('image_path'),
            notes=exam.get('notes')
        )
        db.add(exam_db)
        await db.flush() # 需要 exam_db.id 給 findings 使用

        findings_data = exam.get('findings', [])
        for fd in findings_data:
            finding_db = Finding(
                exam_record_id=exam_db.id,
                region=fd.get('region'),
                code=fd.get('code', ''),
                label_zh=fd.get('label_zh'),
                label_en=fd.get('label_en'),
                is_normal=fd.get('is_normal', False),
                percentage=fd.get('percentage', 0.0)
            )
            db.add(finding_db)

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

async def update_case(db: AsyncSession, case_id: str, case_data: dict):
    # 1. 獲取現有病例
    stmt = (
        select(MedicalCase)
        .where(MedicalCase.id == case_id)
        .options(selectinload(MedicalCase.exams).selectinload(ExamRecord.findings))
    )
    result = await db.execute(stmt)
    db_case = result.scalars().first()
    
    if not db_case:
        return None

    # 2. 更新基本欄位
    if "visit_date" in case_data:
        visit_date_raw = case_data.get("visit_date")
        if isinstance(visit_date_raw, str):
            db_case.visit_date = datetime.strptime(visit_date_raw, "%Y-%m-%d").date()
        else:
            db_case.visit_date = visit_date_raw

    if "diagnosis_summary" in case_data:
        db_case.diagnosis_summary = case_data.get("diagnosis_summary")
    
    if "general_notes" in case_data:
        db_case.general_notes = case_data.get("general_notes")
        
    if "status" in case_data:
        db_case.status = case_data.get("status")

    # 3. 更新檢查紀錄 (Exams) 與 病理發現 (Findings)
    # 策略：因為這是全量保存，最簡單且安全的方式是刪除舊的 Exams (會 Cascade 刪除 Findings)，然後重新建立。
    
    # 清除現有的 Exams
    # 注意：由於設定了 cascade="all, delete-orphan"，移除關聯應該會觸發刪除。
    # 但在 AsyncSession 中，有時需要明確操作。我們試著清空 list。
    db_case.exams.clear()
    
    # 重新建立 Exams
    exams_data = case_data.get('exams', [])
    for exam in exams_data:
        exam_db = ExamRecord(
            case_id=db_case.id, # 關聯回這個 case
            side=exam.get('side'),
            status=exam.get('status', 'pending'),
            diagnosis=exam.get('diagnosis'),
            image_path=exam.get('image_path'),
            notes=exam.get('notes')
        )
        # 注意：不直接 add 到 db，而是 append 到 db_case.exams，讓 SQLModel/SQLAlchemy 處理關聯
        db_case.exams.append(exam_db)
        
        # 處理 Findings
        findings_data = exam.get('findings', [])
        for fd in findings_data:
            finding_db = Finding(
                # exam_record_id 會在 exam_db 被 flush/save 時自動處理 (如果是透過 relationship)
                # 但這裡是透過 append 到 exam_db.findings
                region=fd.get('region'),
                code=fd.get('code', ''),
                label_zh=fd.get('label_zh'),
                label_en=fd.get('label_en'),
                is_normal=fd.get('is_normal', False),
                percentage=fd.get('percentage', 0.0)
            )
            exam_db.findings.append(finding_db)

    # 提交變更
    db.add(db_case)
    await db.commit()
    await db.refresh(db_case)
    return db_case

# --- 儀表板統計數據 (Stats for Dashboard) ---

async def get_dashboard_stats(db: AsyncSession):
    # 總病患數 (計算不重複的病患)
    total_patients_result = await db.execute(select(func.count(Patient.id)))
    total_patients_count = total_patients_result.scalar()

    # 重症案例 (Critical Cases)
    critical_cases_result = await db.execute(
        select(func.count(MedicalCase.id)).where(MedicalCase.status == PatientStatus.CRITICAL)
    )
    critical_count = critical_cases_result.scalar()

    # 疾病分佈 (前 7 名)
    
    # 從 Finding label_en 聚合
    stmt = (
        select(Finding.label_en, func.count(Finding.id))
        .group_by(Finding.label_en)
        .order_by(func.count(Finding.id).desc())
        .limit(7)
    )
    dist_result = await db.execute(stmt)
    distribution = [{"name": row[0], "value": row[1]} for row in dist_result.all()]

    # 每月看診人次 (過去 12 個月)
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
    
    # 確保順序？前端期望陣列。
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_visits = [{"name": m, "visits": visits_map.get(m, 0)} for m in months]

    # AI 準確度 - 目前為 Mock 或儲存回饋
    ai_accuracy = 95.0 

    # 本月新增病患 (基於 created_at)
    first_day_this_month = datetime(current_year, datetime.now().month, 1)
    new_patients_result = await db.execute(
        select(func.count(Patient.id)).where(Patient.created_at >= first_day_this_month)
    )
    new_patients_count = new_patients_result.scalar()

    # 已生成報告數量
    reports_result = await db.execute(
        select(func.count(MedicalCase.id)).where(MedicalCase.report_generated == True)
    )
    reports_count = reports_result.scalar()

    # 近期案例ㄣ
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

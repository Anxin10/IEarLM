
import asyncio
from sqlalchemy import select, desc
from server.database import async_session
from server.models_sql import Finding, ExamRecord, MedicalCase

async def check_findings():
    async with async_session() as session:
        # Get latest case
        stmt = select(MedicalCase).order_by(desc(MedicalCase.created_at)).limit(1)
        result = await session.execute(stmt)
        latest_case = result.scalars().first()
        
        if not latest_case:
            print("No cases found.")
            return

        print(f"Latest Case ID: {latest_case.id}")
        
        # Get exams for this case
        stmt_exams = select(ExamRecord).where(ExamRecord.case_id == latest_case.id)
        result_exams = await session.execute(stmt_exams)
        exams = result_exams.scalars().all()
        
        print(f"Exams count: {len(exams)}")
        
        for exam in exams:
            stmt_findings = select(Finding).where(Finding.exam_record_id == exam.id)
            result_findings = await session.execute(stmt_findings)
            findings = result_findings.scalars().all()
            print(f"  Exam {exam.id} ({exam.side}) Findings: {len(findings)}")
            for f in findings:
                print(f"    - {f.label_zh} ({f.region})")

if __name__ == "__main__":
    asyncio.run(check_findings())

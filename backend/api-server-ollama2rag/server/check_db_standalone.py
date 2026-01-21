
import sys
import os
import asyncio

# Ensure we can import from local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select, desc
from database import AsyncSessionLocal as async_session
from models_sql import Finding, ExamRecord, MedicalCase

async def check_findings():
    print("Connecting to DB...")
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
        
        print(f"Exams count for this case: {len(exams)}")
        
        total_findings = 0
        for exam in exams:
            stmt_findings = select(Finding).where(Finding.exam_record_id == exam.id)
            result_findings = await session.execute(stmt_findings)
            findings = result_findings.scalars().all()
            print(f"  Exam {exam.id} ({exam.side}) Findings: {len(findings)}")
            for f in findings:
                print(f"    - {f.label_zh} ({f.region}) [Saved in DB]")
            total_findings += len(findings)

        if total_findings == 0:
            print("\nWARNING: No findings found in DB for the latest case!")
        else:
            print(f"\nSUCCESS: Found {total_findings} findings stored in DB.")

if __name__ == "__main__":
    # Windows SelectorEventLoopPolicy fix if needed
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(check_findings())

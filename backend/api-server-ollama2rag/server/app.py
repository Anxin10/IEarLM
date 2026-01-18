from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, Request, BackgroundTasks, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse
from models import AskRequest, IngestRequest, DeleteRequest, ReportRequest, SaveRequest, CleanupResponse, ReportContentResponse, UpdateReportContentRequest, FolderCreateRequest, FolderUpdateRequest, FileMoveRequest
from kb_storage import get_folders, create_folder, update_folder, delete_folder, set_file_folder, get_file_folder, get_files_mapping
from rag_pipeline import rag_answer, add_document, list_sources, delete_by_source, get_file_stats, get_collection_stats
from pdf_utils import extract_pdf_text, chunk_text
from report_generator import ReportGenerator
from ear_disease_classifier import process_detections
from datetime import datetime
from typing import Optional
import sys
import traceback
import os
import requests
import base64

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from database import get_db, engine
from sqlmodel import SQLModel
import crud
from models_sql import Patient, MedicalCase 
from sqlalchemy import select, exc
import models_sql
#JX新增
# Duplicate app initialization removed

from pydantic import BaseModel
class DeleteRequest(BaseModel):
    id: int



sys.stdout.reconfigure(encoding='utf-8') # type: ignore

app = FastAPI(title="RAG-Ollama Server")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化報告生成器
template_dir = os.path.join(os.path.dirname(__file__), "templates")
output_dir = os.path.join(os.path.dirname(__file__), "output_reports")  # 暫存目錄
save_dir = os.path.join(os.path.dirname(__file__), "saved_reports")      # 永久存檔目錄

generator = ReportGenerator(
    template_dir=template_dir,
    output_dir=output_dir,
    save_dir=save_dir
)

@app.middleware("http")
async def log_exceptions(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        print("Unhandled Exception:", str(e))
        traceback.print_exc()
        raise e


@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/ask")
def ask(req: AskRequest):
    """
    問答：RAG檢索 + LLM生成
    """
    try:
        answer, ctxs = rag_answer(req.question, top_k=req.top_k)
        return JSONResponse(
            content={"answer": answer, "contexts": ctxs},
            media_type="application/json; charset=utf-8"
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "where": "ask() / rag_answer"},
            media_type="application/json; charset=utf-8"
        )

@app.post("/ingest")
def ingest(req: IngestRequest):
    """
    餵文字進向量資料庫
    """
    try:
        add_document(req.text, req.metadata or {})
        return JSONResponse(
            content={"message": "ingested", "len": len(req.text)},
            media_type="application/json; charset=utf-8"
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "where": "ingest() / add_document"},
            media_type="application/json; charset=utf-8"
        )

@app.post("/ingest_pdf")
def ingest_pdf(file: UploadFile = File(...), folder_id: Optional[str] = None):
    """
    上傳 PDF -> 分段 -> 匯入向量資料庫
    folder_id: 可選的資料夾 ID，默認為 'root'
    """
    try:
        pdf_bytes = file.file.read()
        full_text = extract_pdf_text(pdf_bytes)
        # 調整 chunk 參數：較小的 chunk_size 降低單次生成負擔，較適合中階 CPU/GPU
        chunks = chunk_text(full_text, chunk_size=400, overlap=80)

        # 使用指定的 folder_id 或默認為 'root'
        target_folder_id = folder_id or "root"
        
        count_ok = 0
        for chunk in chunks:
            add_document(chunk, metadata={"source": file.filename, "folder_id": target_folder_id})
            count_ok += 1
        
        # 更新文件映射
        from kb_storage import set_file_folder
        set_file_folder(file.filename, target_folder_id)

        return JSONResponse(
            content={
                "message": "pdf_ingested",
                "file": file.filename,
                "chunks_imported": count_ok,
                "folder_id": target_folder_id,
            },
            media_type="application/json; charset=utf-8"
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "error": str(e),
                "where": "ingest_pdf() / add_document / pdf_utils",
                "filename": file.filename,
            },
            media_type="application/json; charset=utf-8"
        )


@app.get("/files")
def list_files():
    """
    列出目前向量庫中已匯入的檔案名稱（依 payload['source']）
    返回文件列表及其所屬資料夾信息和統計信息
    """
    try:
        files = list_sources()
        files_mapping = get_files_mapping()
        
        # 為每個文件添加 folder_id 和統計信息
        files_with_folders = []
        for f in files:
            stats = get_file_stats(f)
            files_with_folders.append({
                "filename": f,
                "folder_id": files_mapping.get(f, "root"),
                "chunk_count": stats["chunk_count"],
                "estimated_tokens": stats["estimated_tokens"],
                "vector_size_gb": stats["vector_size_gb"],
                "category": stats["category"]
            })
        
        return JSONResponse(
            content={"files": files, "files_with_folders": files_with_folders},
            media_type="application/json; charset=utf-8"
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "where": "list_files() / list_sources"},
            media_type="application/json; charset=utf-8"
        )


@app.get("/api/v1/kb/stats")
def get_kb_stats():
    """
    獲取知識庫統計信息（向量索引使用量等）
    """
    try:
        stats = get_collection_stats()
        return JSONResponse(
            content=stats,
            media_type="application/json; charset=utf-8"
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "where": "get_kb_stats()"},
            media_type="application/json; charset=utf-8"
        )


@app.post("/delete_pdf")
def delete_pdf(req: DeleteRequest):
    """
    根據檔名刪除該 PDF 所有 chunks（payload['source'] = filename）
    同時刪除文件映射信息
    """
    try:
        # 從 Qdrant 向量資料庫中刪除所有相關的 chunks
        delete_by_source(req.filename)
        
        # 從文件映射中刪除該文件
        from kb_storage import remove_file_mapping
        remove_file_mapping(req.filename)
        
        return JSONResponse(
            content={"message": "deleted", "file": req.filename},
            media_type="application/json; charset=utf-8"
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "where": "delete_pdf() / delete_by_source"},
            media_type="application/json; charset=utf-8"
        )


# --- 輔助清理功能 ---
def remove_file(path: str):
    """背景任務：刪除文件"""
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        print(f"Error during file removal: {e}")

# --- 報告生成 API 端點 ---

@app.post("/api/v1/generate-report")
async def create_report(request: ReportRequest):
    """
    生成報告：根據模板和數據生成 Word 報告（可選生成 PDF）
    - Word 版本始終生成，供前端編修使用
    - PDF 版本可根據 output_format 參數生成
    """
    import uuid
    request_id = str(uuid.uuid4())[:8]
    
    try:
        output_format = request.output_format or "both"
        print(f"[API] [request_id={request_id}] POST /api/v1/generate-report: template_name={request.template_name}, output_format={output_format}")
        
        files = generator.generate(request.template_name, request.data, output_format=output_format)
        
        response_data = {
            "status": "success",
            "expires_in": "60 minutes"
        }
        
        # Word 版本（始終可用，供前端編修）
        if "docx" in files:
            docx_path = files["docx"]
            docx_filename = os.path.basename(docx_path)
            file_id = files.get("file_id", docx_filename.replace(".docx", ""))
            response_data["docx"] = {
                "report_id": docx_filename,
                "file_id": file_id,
                "download_url": f"/api/v1/download/{docx_filename}",
                "edit_url": f"/api/v1/report/{docx_filename}/content",  # 編輯內容端點
                "format": "docx"
            }
            print(f"[API] [request_id={request_id}] Word document ready: {docx_filename}")
        
        # PDF 版本（如果生成）
        if "pdf" in files:
            pdf_path = files["pdf"]
            pdf_filename = os.path.basename(pdf_path)
            response_data["pdf"] = {
                "report_id": pdf_filename,
                "download_url": f"/api/v1/download/{pdf_filename}",
                "format": "pdf"
            }
            print(f"[API] [request_id={request_id}] PDF document ready: {pdf_filename}")
        else:
            from report_generator import PDF_AVAILABLE
            print(f"[API] [request_id={request_id}] PDF not generated (output_format={output_format}, PDF_AVAILABLE={PDF_AVAILABLE})")
        
        return response_data
    except FileNotFoundError as e:
        error_detail = f"Template not found: {str(e)}. Please ensure the template file exists in {template_dir}"
        print(f"[API] [request_id={request_id}] ERROR 404: {error_detail}")
        raise HTTPException(status_code=404, detail=error_detail)
    except RuntimeError as e:
        error_detail = str(e)
        print(f"[API] [request_id={request_id}] ERROR 500 (RuntimeError): {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)
    except Exception as e:
        error_detail = f"Unexpected error: {str(e)}"
        print(f"[API] [request_id={request_id}] ERROR 500 (Exception): {error_detail}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=error_detail)


@app.get("/api/v1/download/{report_id}")
async def download_report(
    report_id: str, 
    background_tasks: BackgroundTasks,
    format: Optional[str] = Query(None, description="文件格式：docx 或 pdf（自動檢測如果未指定）")
):
    """
    下載報告：從暫存區或永久區下載報告文件
    - 支援 Word (.docx) 和 PDF (.pdf) 格式
    - Word 版本可用於前端編修
    """
    # 自動檢測文件格式
    file_ext = os.path.splitext(report_id)[1].lower()
    if not file_ext:
        # 如果沒有擴展名，嘗試兩種格式
        docx_path_tmp = os.path.join(generator.output_dir, report_id)
        pdf_path_tmp = os.path.join(generator.output_dir, report_id)
        if format == "pdf" or (format is None and os.path.exists(pdf_path_tmp + ".pdf")):
            report_id = report_id if report_id.endswith(".pdf") else report_id + ".pdf"
            file_ext = ".pdf"
        else:
            report_id = report_id if report_id.endswith(".docx") else report_id + ".docx"
            file_ext = ".docx"
    
    # 先檢查暫存區，再檢查永久區
    tmp_path = os.path.join(generator.output_dir, report_id)
    save_path = os.path.join(generator.save_dir, report_id)
    
    if os.path.exists(tmp_path):
        target_path = tmp_path
        # 延遲刪除：給用戶足夠時間下載（30分鐘後刪除）
        # 注意：這裡不立即刪除，而是設置一個延遲任務
        # 實際刪除由 cleanup_orphaned_files 處理
    elif os.path.exists(save_path):
        target_path = save_path
    else:
        # 如果文件不存在，嘗試從 report_data 目錄查找並重新生成
        # 提取 file_id（去掉 .docx 或 .pdf 後綴）
        file_id = report_id.replace('.docx', '').replace('.pdf', '')
        # 嘗試多種可能的 JSON 文件名格式
        possible_json_paths = [
            os.path.join(generator.data_dir, f"report_{file_id}.json"),
            os.path.join(generator.data_dir, f"{file_id}.json"),
        ]
        
        data_filepath = None
        for json_path in possible_json_paths:
            if os.path.exists(json_path):
                data_filepath = json_path
                break
        
        if data_filepath:
            # 讀取報告數據並重新生成
            import json
            try:
                with open(data_filepath, 'r', encoding='utf-8') as f:
                    report_metadata = json.load(f)
                # 重新生成報告
                files = generator.generate(
                    report_metadata.get('template_name', 'ENT_Clinic_Record_Design_Portrait_Fixed'),
                    report_metadata.get('data', {}),
                    report_metadata.get('output_format', 'docx')
                )
                if 'docx' in files:
                    target_path = files['docx']
                    print(f"[下載 API] 從 JSON 重新生成報告: {target_path}")
                else:
                    raise HTTPException(status_code=404, detail="File not found and regeneration failed.")
            except Exception as e:
                print(f"[下載 API] 重新生成失敗: {str(e)}")
                raise HTTPException(status_code=404, detail=f"File not found. Regeneration error: {str(e)}")
        else:
            raise HTTPException(status_code=404, detail="File not found.")
    
    # 根據副檔名自動判斷 media_type 和文件名
    media_type_map = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.txt': 'text/plain',
        '.html': 'text/html',
        '.json': 'application/json',
    }
    
    # 使用映射表判斷 media_type，如果找不到則使用默認值
    media_type = media_type_map.get(file_ext, 'application/octet-stream')
    
    # 生成文件名（保留原始文件名，如果沒有則使用時間戳）
    original_filename = os.path.basename(target_path)
    if original_filename and original_filename != report_id:
        filename = original_filename
    else:
        filename = f"Report_{datetime.now().strftime('%Y%m%d')}{file_ext}"
    
    return FileResponse(
        path=target_path,
        filename=filename,
        media_type=media_type
    )


@app.post("/api/v1/management/save")
async def save_report(request: SaveRequest):
    """
    保存接口：將報告從暫存狀態轉為永久儲存狀態
    """
    try:
        new_path = generator.save_to_permanent(request.report_id, request.custom_name)
        return {
            "status": "success",
            "message": "Report has been moved to permanent storage.",
            "saved_as": os.path.basename(new_path)
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Save failed: {str(e)}")


@app.post("/api/v1/management/cleanup", response_model=CleanupResponse)
async def manual_cleanup(max_age: int = Query(3600, description="最大檔案年齡（秒），預設 3600 秒（1小時）")):
    """
    清理接口：手動清理暫存區中的孤兒檔案
    """
    try:
        result = generator.cleanup_orphaned_files(max_age_seconds=max_age)
        return {
            "status": "success",
            "deleted_files": result["deleted_files"],
            "freed_space_kb": result["freed_space_kb"],
            "message": f"Successfully removed {result['deleted_count']} orphaned files from temporary storage."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- 報告編輯 API 端點 ---

@app.get("/api/v1/report/{report_id}/content", response_model=ReportContentResponse)
async def get_report_content(report_id: str):
    """
    獲取報告內容：用於前端編輯視窗
    - 返回報告的原始數據和文本內容
    - 可用於在編輯視窗中顯示和修改
    """
    try:
        content = generator.get_report_content(report_id)
        return content
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/v1/report/{report_id}/content")
async def update_report_content(report_id: str, request: UpdateReportContentRequest):
    """
    更新報告內容並重新生成報告
    - 接收更新後的數據
    - 重新生成 Word 和 PDF 文件
    - 返回新的報告下載鏈接
    """
    try:
        files = generator.update_report_content(
            report_id, 
            request.data, 
            output_format=request.output_format
        )
        
        response_data = {
            "status": "success",
            "message": "Report content updated and regenerated",
            "expires_in": "60 minutes"
        }
        
        # Word 版本
        if "docx" in files:
            docx_path = files["docx"]
            docx_filename = os.path.basename(docx_path)
            file_id = files.get("file_id", docx_filename.replace(".docx", ""))
            response_data["docx"] = {
                "report_id": docx_filename,
                "file_id": file_id,
                "download_url": f"/api/v1/download/{docx_filename}",
                "edit_url": f"/api/v1/report/{docx_filename}/content",
                "format": "docx"
            }
        
        # PDF 版本（如果生成）
        if "pdf" in files:
            pdf_path = files["pdf"]
            pdf_filename = os.path.basename(pdf_path)
            response_data["pdf"] = {
                "report_id": pdf_filename,
                "download_url": f"/api/v1/download/{pdf_filename}",
                "format": "pdf"
            }
        
        return response_data
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 耳疾病灶識別 API 端點 ---

@app.post("/api/v1/analyze_ear")
async def analyze_ear_image(
    image: UploadFile = File(...),
    conf_thres: float = Query(0.25, description="置信度閾值"),
    iou_thres: float = Query(0.45, description="IoU 閾值"),
    yolov7_api_url: Optional[str] = Query(None, description="YOLOv7 API URL（如果未指定則使用環境變量或默認值）")
):
    """
    耳疾病灶識別：調用 YOLOv7 API 進行圖像分析，並分類為耳道（EAC）和耳膜（TM）
    
    返回包含中英文名稱和分類的結果
    """
    try:
        # 讀取圖像文件
        image_bytes = await image.read()
        
        # 轉換為 base64（YOLOv7 API 需要完整的 data URL）
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        # YOLOv7 API 期望接收完整的 data URL 格式
        image_data = f"data:{image.content_type};base64,{image_base64}"
        
        # 獲取 YOLOv7 API URL
        if not yolov7_api_url:
            yolov7_api_url = os.getenv("YOLOV7_API_URL", "http://host.docker.internal:5000/api")
        
        # 調用 YOLOv7 API
        yolov7_url = f"{yolov7_api_url}/analyze"
        payload = {
            "image": image_data,
            "conf_thres": conf_thres,
            "iou_thres": iou_thres,
            "include_crop_coords": True,
            "coordinate_type": "original"
        }
        
        print(f"[API] Calling YOLOv7 API: {yolov7_url}")
        response = requests.post(yolov7_url, json=payload, timeout=60)
        
        if not response.ok:
            error_msg = f"YOLOv7 API error: {response.status_code} - {response.text}"
            print(f"[API] ERROR: {error_msg}")
            raise HTTPException(status_code=response.status_code, detail=error_msg)
        
        yolov7_result = response.json()
        detections = yolov7_result.get("detections", [])
        
        # 處理檢測結果，添加分類和中英文名稱
        processed_result = process_detections(detections)
        
        # 構建響應
        result = {
            "status": "success",
            "detections": processed_result["detections"],
            "primary_diagnosis": processed_result["primary_diagnosis"],
            "eac_detections": processed_result["eac_detections"],
            "tm_detections": processed_result["tm_detections"],
            "summary": processed_result["summary"],
            "coordinate_type": yolov7_result.get("coordinate_type", "original"),
            "crop_info": yolov7_result.get("crop_info")
        }
        
        return JSONResponse(
            content=result,
            media_type="application/json; charset=utf-8"
        )
        
    except requests.exceptions.RequestException as e:
        error_msg = f"Failed to connect to YOLOv7 API: {str(e)}"
        print(f"[API] ERROR: {error_msg}")
        raise HTTPException(status_code=503, detail=error_msg)
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        print(f"[API] ERROR: {error_msg}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=error_msg)


# ==========================================================
# 知識庫資料夾管理 API
# ==========================================================

@app.get("/api/v1/kb/folders")
def get_kb_folders():
    """
    獲取所有資料夾
    """
    try:
        folders = get_folders()
        return JSONResponse(
            content={"folders": folders},
            media_type="application/json; charset=utf-8"
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "where": "get_kb_folders()"},
            media_type="application/json; charset=utf-8"
        )


@app.post("/api/v1/kb/folders")
def create_kb_folder(req: FolderCreateRequest):
    """
    創建新資料夾
    """
    try:
        folder = create_folder(req.name, req.type)
        return JSONResponse(
            content={"folder": folder, "message": "Folder created successfully"},
            media_type="application/json; charset=utf-8"
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "where": "create_kb_folder()"},
            media_type="application/json; charset=utf-8"
        )


@app.put("/api/v1/kb/folders/{folder_id}")
def update_kb_folder(folder_id: str, req: FolderUpdateRequest):
    """
    更新資料夾名稱
    """
    try:
        folder = update_folder(folder_id, req.name)
        if folder:
            return JSONResponse(
                content={"folder": folder, "message": "Folder updated successfully"},
                media_type="application/json; charset=utf-8"
            )
        else:
            return JSONResponse(
                status_code=404,
                content={"error": "Folder not found"},
                media_type="application/json; charset=utf-8"
            )
    except ValueError as e:
        return JSONResponse(
            status_code=400,
            content={"error": str(e)},
            media_type="application/json; charset=utf-8"
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "where": "update_kb_folder()"},
            media_type="application/json; charset=utf-8"
        )


@app.delete("/api/v1/kb/folders/{folder_id}")
def delete_kb_folder(folder_id: str):
    """
    刪除資料夾（系統資料夾不能刪除）
    """
    try:
        success = delete_folder(folder_id)
        if success:
            return JSONResponse(
                content={"message": "Folder deleted successfully"},
                media_type="application/json; charset=utf-8"
            )
        else:
            return JSONResponse(
                status_code=404,
                content={"error": "Folder not found"},
                media_type="application/json; charset=utf-8"
            )
    except ValueError as e:
        return JSONResponse(
            status_code=400,
            content={"error": str(e)},
            media_type="application/json; charset=utf-8"
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "where": "delete_kb_folder()"},
            media_type="application/json; charset=utf-8"
        )


@app.put("/api/v1/kb/files/{filename}/folder")
def move_file_to_folder(filename: str, req: FileMoveRequest):
    """
    移動文件到指定資料夾
    """
    try:
        set_file_folder(filename, req.folder_id)
        return JSONResponse(
            content={"message": f"File '{filename}' moved to folder '{req.folder_id}' successfully"},
            media_type="application/json; charset=utf-8"
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "where": "move_file_to_folder()"},
            media_type="application/json; charset=utf-8"
        )


# ==========================================================
# SQL Integration Endpoints (Patient Management & Dashboard)
# ==========================================================

@app.on_event("startup")
async def startup():
    # Construct models
    async with engine.begin() as conn:
        # await conn.run_sync(Base.metadata.drop_all) # WARNING: DEV ONLY
        await conn.run_sync(SQLModel.metadata.create_all)

@app.get("/api/v1/dashboard/stats")
async def get_dashboard_stats_api(db: AsyncSession = Depends(get_db)):
    """
    獲取儀表板統計數據 (SQL Backed)
    """
    try:
        stats = await crud.get_dashboard_stats(db)
        return stats
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/patients")
async def read_patients(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    patients = await crud.get_patients(db, skip=skip, limit=limit)
    return patients

#JX新增
@app.get("/api/v1/patients/{patient_id}")
async def read_single_patient(patient_id: int, db: AsyncSession = Depends(get_db)):
    """
    獲取單一病患資料
    """
    # 從資料庫撈出指定 ID 的那個人
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalars().first()

    if patient is None:
        raise HTTPException(status_code=404, detail="找不到該病患")
    
    return patient

@app.post("/api/v1/patients")
async def create_patient_api(
    name: str, 
    mrn: str, 
    gender: str, 
    birth_date: str = Query(..., description="YYYY-MM-DD"), # Simple string for now
    db: AsyncSession = Depends(get_db)
):
    try:
        bdate = datetime.strptime(birth_date, "%Y-%m-%d").date()
        return await crud.create_patient(db, name, mrn, gender, bdate)
    except exc.IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="病歷號 (MRN) 已存在，請使用不同的編號。")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"日期格式錯誤 ({birth_date})，請使用 YYYY-MM-DD 格式。")
    except Exception as e:
        await db.rollback()
        print(f"[Create Patient Error]: {str(e)}")
        raise HTTPException(status_code=400, detail=f"創建失敗: {str(e)}")


@app.get("/api/v1/cases")
async def read_cases(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    cases = await crud.get_cases(db, skip=skip, limit=limit)
    # Serialize relationships? Fastapi Pydantic models usually handle this, but here we return ORM objects.
    # Ideally should use Pydantic schemas (response_model).
    # For now, let FastAPI try to serialize.
    return cases

#JX新增 
@app.delete("/api/v1/patients")
async def delete_patient_by_body(
    item: DeleteRequest,       # 接收前端的 JSON: {"id": 5}
    db: AsyncSession = Depends(get_db)
):
    print(f"後端收到刪除請求: ID={item.id}") # 加個 print 確認有收到
    
    # 查詢並刪除
    result = await db.execute(select(Patient).where(Patient.id == item.id))
    patient = result.scalars().first()

    if not patient:
        return {"status": "warning", "message": "找不到該 ID"}

    await db.delete(patient)
    await db.commit()
    
    return {"status": "success"}

@app.post("/api/v1/cases")
async def create_case_api(
    case_data: dict, # Receive raw dict for now
    patient_id: int,
    db: AsyncSession = Depends(get_db)
):
    try:
        return await crud.create_case(db, case_data, patient_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)

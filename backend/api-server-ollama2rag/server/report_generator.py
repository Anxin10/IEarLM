import os
import uuid
import time
import shutil
import json
from docxtpl import DocxTemplate
from datetime import datetime
from typing import Dict, Any, List, Optional
try:
    from docx2pdf import convert
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    print("Warning: docx2pdf not available. PDF conversion will be disabled. Install LibreOffice for PDF support.")

try:
    from docx import Document
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False
    print("Warning: python-docx not available. Text extraction from Word files will be disabled.")

try:
    from tiptap_converter import TiptapConverter
    TIPTAP_AVAILABLE = True
except ImportError:
    TIPTAP_AVAILABLE = False
    print("Warning: TiptapConverter not available. Tiptap JSON conversion will be disabled.")


class ReportGenerator:
    """
    負責處理結構化數據、報告生成、磁碟清理及持久化保存的服務
    """
    def __init__(self, template_dir: str, output_dir: str, save_dir: str):
        self.template_dir = template_dir
        self.output_dir = output_dir  # 暫存區 (會被清理)
        self.save_dir = save_dir      # 永久區 (不被清理)
        self.data_dir = os.path.join(os.path.dirname(output_dir), "report_data")  # 報告數據存儲目錄
        
        for d in [self.output_dir, self.save_dir, self.data_dir]:
            if not os.path.exists(d):
                os.makedirs(d, exist_ok=True)

    def generate(self, template_name: str, data: Dict[str, Any], output_format: str = "both") -> Dict[str, str]:
        """
        生成報告（Word 版本始終生成，PDF 版本可選）
        
        Args:
            template_name: 模板文件名（不含 .docx 後綴）
            data: 包含報告數據的字典
            output_format: 輸出格式，'docx'、'pdf' 或 'both'（預設為 'both'）
            
        Returns:
            包含生成文件路徑的字典：{'docx': '路徑', 'pdf': '路徑'}（如果生成的話）
        """
        import time
        start_time = time.time()
        request_id = str(uuid.uuid4())[:8]
        
        template_path = os.path.join(self.template_dir, f"{template_name}.docx")
        template_exists = os.path.exists(template_path)
        
        print(f"[ReportGenerator] [request_id={request_id}] Generating report: template_name={template_name}, output_format={output_format}")
        print(f"[ReportGenerator] [request_id={request_id}] Template path: {template_path}")
        print(f"[ReportGenerator] [request_id={request_id}] Template exists: {template_exists}")
        
        if not template_exists:
            error_msg = f"Template {template_name} not found in {self.template_dir}. Available templates: {os.listdir(self.template_dir) if os.path.exists(self.template_dir) else 'N/A'}"
            print(f"[ReportGenerator] [request_id={request_id}] ERROR: {error_msg}")
            raise FileNotFoundError(error_msg)
            
        # 生成 Word 版本（始終生成，供前端編修）
        doc = DocxTemplate(template_path)
        structured_context = self._process_citations(data)
        doc.render(structured_context)
        
        file_id = str(uuid.uuid4())
        docx_filename = f"report_{file_id}.docx"
        docx_filepath = os.path.join(self.output_dir, docx_filename)
        doc.save(docx_filepath)
        docx_size = os.path.getsize(docx_filepath)
        
        print(f"[ReportGenerator] [request_id={request_id}] Word document generated: {docx_filename} ({docx_size} bytes)")
        
        # 保存報告的原始數據（用於後續編輯）
        data_filepath = os.path.join(self.data_dir, f"report_{file_id}.json")
        report_metadata = {
            "file_id": file_id,
            "template_name": template_name,
            "data": data,
            "output_format": output_format,
            "created_at": datetime.now().isoformat()
        }
        with open(data_filepath, 'w', encoding='utf-8') as f:
            json.dump(report_metadata, f, ensure_ascii=False, indent=2)
        
        result = {"docx": docx_filepath, "file_id": file_id}
        
        # 根據需求生成 PDF 版本
        if output_format in ["pdf", "both"]:
            if not PDF_AVAILABLE:
                error_msg = "PDF conversion is not available. Please install LibreOffice:\nUbuntu/Debian: sudo apt-get install libreoffice\nOr install docx2pdf: pip install docx2pdf"
                print(f"[ReportGenerator] [request_id={request_id}] ERROR: {error_msg}")
                raise RuntimeError(error_msg)
            
            try:
                pdf_start_time = time.time()
                pdf_filename = f"report_{file_id}.pdf"
                pdf_filepath = os.path.join(self.output_dir, pdf_filename)
                # 使用 docx2pdf 轉換
                convert(docx_filepath, pdf_filepath)
                pdf_size = os.path.getsize(pdf_filepath)
                convert_time_ms = int((time.time() - pdf_start_time) * 1000)
                print(f"[ReportGenerator] [request_id={request_id}] PDF document generated: {pdf_filename} ({pdf_size} bytes, conversion_time={convert_time_ms}ms)")
                result["pdf"] = pdf_filepath
            except Exception as e:
                print(f"[ReportGenerator] [request_id={request_id}] WARNING: PDF conversion failed: {e}")
                import traceback
                traceback.print_exc()
                # 如果 PDF 轉換失敗，仍然返回 Word 版本
                if output_format == "pdf":
                    raise RuntimeError(f"PDF conversion failed: {str(e)}")
        
        total_time_ms = int((time.time() - start_time) * 1000)
        print(f"[ReportGenerator] [request_id={request_id}] Report generation completed in {total_time_ms}ms")
        
        return result

    def save_to_permanent(self, report_id: str, custom_name: Optional[str] = None) -> str:
        """
        將檔案從暫存區移至永久區 (來源：SWE 持久化架構設計)
        
        Args:
            report_id: 報告 ID（文件名）
            custom_name: 自定義存檔名稱（可選）
            
        Returns:
            永久區的文件路徑
        """
        source_path = os.path.join(self.output_dir, report_id)
        if not os.path.exists(source_path):
            # 檢查是否已經在永久區了
            if os.path.exists(os.path.join(self.save_dir, report_id)):
                return os.path.join(self.save_dir, report_id)
            raise FileNotFoundError(f"Source report {report_id} not found in temporary storage.")

        # 定義目標檔名
        target_filename = custom_name if custom_name else report_id
        if not target_filename.endswith(".docx"):
            target_filename += ".docx"
            
        target_path = os.path.join(self.save_dir, target_filename)
        
        # 如果目標文件已存在，添加時間戳
        if os.path.exists(target_path):
            base, ext = os.path.splitext(target_filename)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            target_filename = f"{base}_{timestamp}{ext}"
            target_path = os.path.join(self.save_dir, target_filename)
        
        # 執行移動 (Move) 而非複製，節省空間
        shutil.move(source_path, target_path)
        return target_path

    def cleanup_orphaned_files(self, max_age_seconds: int = 3600) -> Dict[str, Any]:
        """
        僅清理暫存區中的孤兒檔案
        
        Args:
            max_age_seconds: 文件最大存活時間（秒），預設 1 小時
            
        Returns:
            清理結果字典
        """
        now = time.time()
        deleted_files = []
        freed_space = 0
        
        for filename in os.listdir(self.output_dir):
            filepath = os.path.join(self.output_dir, filename)
            if not os.path.isfile(filepath):
                continue
                
            file_mtime = os.path.getmtime(filepath)
            
            if now - file_mtime > max_age_seconds:
                file_size = os.path.getsize(filepath)
                try:
                    os.remove(filepath)
                    deleted_files.append(filename)
                    freed_space += file_size
                except Exception as e:
                    print(f"Failed to delete {filename}: {e}")
        
        return {
            "deleted_count": len(deleted_files),
            "deleted_files": deleted_files,
            "freed_space_kb": round(freed_space / 1024, 2)
        }

    def _process_citations(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        處理 RAG 來源的邏輯 (跨文件整合)
        處理來源標註，將其格式化為 [來源: 文件名, p.xx] 格式
        
        Args:
            data: 原始數據字典
            
        Returns:
            處理後的結構化數據字典
        """
        processed_data = data.copy()
        
        # 處理 findings 欄位（如果存在）
        if "findings" in data and isinstance(data["findings"], list):
            for item in data["findings"]:
                if isinstance(item, dict) and ("source" not in item or not item["source"]):
                    item["source"] = "文件未載 (系統推論)"
        
        # 如果有 contexts 欄位，處理來源標註
        if "contexts" in data and isinstance(data["contexts"], list):
            citations = []
            sources_map = {}
            
            for idx, context in enumerate(data["contexts"]):
                source_info = self._extract_source_info(context, idx)
                citations.append(source_info)
                
                source_key = source_info.get("source", f"來源{idx+1}")
                if source_key not in sources_map:
                    sources_map[source_key] = []
                sources_map[source_key].append(source_info)
            
            processed_data["citations"] = citations
            processed_data["sources_map"] = sources_map
        
        # 添加生成時間
        processed_data["generated_at"] = datetime.now().strftime("%Y年%m月%d日 %H:%M:%S")
        processed_data["generated_date"] = datetime.now().strftime("%Y-%m-%d")
        processed_data["generated_datetime"] = datetime.now().isoformat()
        
        return processed_data

    def _extract_source_info(self, context: str, index: int) -> Dict[str, Any]:
        """
        從上下文中提取來源信息
        
        Args:
            context: 上下文文本
            index: 上下文索引
            
        Returns:
            來源信息字典
        """
        import re
        
        source_match = re.search(r'\[來源[:\s]+([^\]]+)\]', context)
        if source_match:
            source_text = source_match.group(1)
            page_match = re.search(r'p\.?\s*(\d+)', source_text, re.IGNORECASE)
            filename = re.sub(r',\s*p\.?\s*\d+', '', source_text).strip()
            page = page_match.group(1) if page_match else None
        else:
            filename = f"來源文件{index+1}"
            page = None
        
        return {
            "source": filename,
            "page": page,
            "text": context[:200] + "..." if len(context) > 200 else context,
            "citation": f"[來源: {filename}" + (f", p.{page}]" if page else "]")
        }

    def json_to_word(self, tiptap_json: Dict[str, Any], output_path: Optional[str] = None) -> str:
        """
        將 Tiptap JSON 格式轉換為 Word 文檔
        支援加粗文字和巢狀列表等複雜格式
        
        Args:
            tiptap_json: Tiptap JSON 格式的字典
            output_path: 輸出文件路徑（如果不指定，會在 output_dir 中生成）
            
        Returns:
            生成的 Word 文件路徑
        """
        if not TIPTAP_AVAILABLE:
            raise RuntimeError(
                "TiptapConverter not available. "
                "Please ensure tiptap_converter.py is in the same directory."
            )
        
        if output_path is None:
            file_id = str(uuid.uuid4())
            filename = f"tiptap_report_{file_id}.docx"
            output_path = os.path.join(self.output_dir, filename)
        
        # 使用 TiptapConverter 轉換
        TiptapConverter.json_to_word_doc(tiptap_json, output_path)
        
        return output_path
    
    def json_to_word_content(self, tiptap_json: Dict[str, Any]) -> str:
        """
        將 Tiptap JSON 格式轉換為純文本內容（用於模板渲染）
        
        Args:
            tiptap_json: Tiptap JSON 格式的字典
            
        Returns:
            純文本字符串
        """
        if not TIPTAP_AVAILABLE:
            # 降級處理：嘗試提取基本文本
            return json.dumps(tiptap_json, ensure_ascii=False, indent=2)
        
        return TiptapConverter.json_to_word_content(tiptap_json)

    def get_report_content(self, report_id: str) -> Dict[str, Any]:
        """
        獲取報告內容（從Word文件提取文本或從JSON數據獲取）
        
        Args:
            report_id: 報告ID（文件名，可能包含或不包含擴展名）
            
        Returns:
            包含報告內容的字典
        """
        # 提取file_id（移除擴展名）
        file_id = report_id.replace('.docx', '').replace('.pdf', '')
        if file_id.startswith('report_'):
            # 如果已經有report_前綴，直接使用
            pass
        else:
            file_id = f"report_{file_id}"
        
        # 首先嘗試從JSON數據文件獲取
        data_filepath = os.path.join(self.data_dir, f"{file_id}.json")
        if os.path.exists(data_filepath):
            with open(data_filepath, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
                # 嘗試獲取Word文件路徑以提取文本
                docx_filename = f"{file_id}.docx"
                docx_path = os.path.join(self.output_dir, docx_filename)
                if not os.path.exists(docx_path):
                    docx_path = os.path.join(self.save_dir, docx_filename)
                
                content_text = ""
                if os.path.exists(docx_path):
                    content_text = self._extract_text_from_docx(docx_path)
                
                return {
                    "file_id": metadata.get("file_id", file_id),
                    "template_name": metadata.get("template_name"),
                    "data": metadata.get("data", {}),
                    "content_text": content_text,
                    "created_at": metadata.get("created_at")
                }
        
        # 如果沒有JSON文件，嘗試從Word文件提取文本
        docx_filename = f"{file_id}.docx" if not file_id.endswith('.docx') else file_id
        docx_path = os.path.join(self.output_dir, docx_filename)
        if not os.path.exists(docx_path):
            docx_path = os.path.join(self.save_dir, docx_filename)
        
        if os.path.exists(docx_path):
            return {
                "file_id": file_id,
                "content_text": self._extract_text_from_docx(docx_path),
                "source": "docx_file"
            }
        
        raise FileNotFoundError(f"Report {report_id} not found.")

    def _extract_text_from_docx(self, docx_path_or_id: str) -> str:
        """
        從Word文件中提取純文本內容
        
        Args:
            docx_path_or_id: Word文件路徑或file_id
            
        Returns:
            提取的文本內容
        """
        if not DOCX_AVAILABLE:
            return "Text extraction not available. Install python-docx."
        
        # 如果是file_id，構建完整路徑
        if not os.path.exists(docx_path_or_id):
            if not docx_path_or_id.endswith('.docx'):
                docx_path_or_id = f"report_{docx_path_or_id}.docx"
            docx_path = os.path.join(self.output_dir, docx_path_or_id)
            if not os.path.exists(docx_path):
                docx_path = os.path.join(self.save_dir, docx_path_or_id)
            docx_path_or_id = docx_path
        
        try:
            doc = Document(docx_path_or_id)
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            return '\n\n'.join(paragraphs)
        except Exception as e:
            print(f"Error extracting text from {docx_path_or_id}: {e}")
            return ""

    def update_report_content(self, report_id: str, updated_data: Dict[str, Any], output_format: Optional[str] = None) -> Dict[str, str]:
        """
        更新報告內容並重新生成報告
        
        Args:
            report_id: 報告ID（文件名）
            updated_data: 更新後的數據字典
            output_format: 輸出格式（如果不指定，使用原始格式）
            
        Returns:
            包含新生成文件路徑的字典
        """
        # 提取file_id
        file_id = report_id.replace('.docx', '').replace('.pdf', '')
        if not file_id.startswith('report_'):
            file_id = f"report_{file_id}"
        
        # 獲取原始元數據
        data_filepath = os.path.join(self.data_dir, f"{file_id}.json")
        if not os.path.exists(data_filepath):
            raise FileNotFoundError(f"Report metadata {file_id} not found.")
        
        with open(data_filepath, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        template_name = metadata.get("template_name")
        original_format = metadata.get("output_format", "both")
        output_format = output_format or original_format
        
        # 合併更新後的數據（保留原始數據的結構，只更新提供的字段）
        original_data = metadata.get("data", {})
        merged_data = {**original_data, **updated_data}
        
        # 重新生成報告
        result = self.generate(template_name, merged_data, output_format)
        
        # 更新元數據文件
        new_file_id = result.get("file_id")
        if new_file_id:
            new_data_filepath = os.path.join(self.data_dir, f"{new_file_id}.json")
            metadata["data"] = merged_data
            metadata["updated_at"] = datetime.now().isoformat()
            metadata["previous_file_id"] = file_id
            with open(new_data_filepath, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        return result

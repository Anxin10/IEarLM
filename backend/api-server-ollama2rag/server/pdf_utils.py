from typing import List
import re
import io
import PyPDF2


def extract_pdf_text(pdf_bytes: bytes) -> str:
    """
    從 PDF (原始 bytes) 抽文字（逐頁）。
    回傳一個長字串，含 [Page X] 標記，方便追溯來源。
    """
    text_pages = []

    reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))

    for i, page in enumerate(reader.pages):
        try:
            page_text = page.extract_text() or ""
        except Exception:
            page_text = ""

        # 基本清理：壓空白
        page_text = re.sub(r"[ \t]+", " ", page_text)
        page_text = re.sub(r"\n\s*\n\s*\n+", "\n\n", page_text)

        tagged = f"[Page {i+1}]\n{page_text.strip()}"
        text_pages.append(tagged)

    return "\n\n".join(text_pages)


def chunk_text(full_text: str, chunk_size: int = 600, overlap: int = 100) -> List[str]:
    """
    把很長的全文切成多段 chunk。
    - chunk_size：每段大概幾個字元
    - overlap：前後重疊，保留上下文
    """
    # 讓換行不要太亂，但保留 Page 標記
    normalized = re.sub(r"\n+", "\n", full_text).strip()

    chunks: List[str] = []
    start = 0
    while start < len(normalized):
        end = start + chunk_size
        chunk = normalized[start:end]
        chunk = chunk.strip()
        if len(chunk) >= 20:
            chunks.append(chunk)
        start = end - overlap
        if start < 0:
            start = 0

    return chunks

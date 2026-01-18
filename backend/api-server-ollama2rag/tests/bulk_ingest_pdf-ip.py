import os
import requests
from tqdm import tqdm

API_URL = "http://192.168.50.126:9000/ingest_pdf"

def upload_pdf(file_path: str):
    """
    將單一 PDF 上傳至 RAG API。
    """
    filename = os.path.basename(file_path)
    try:
        with open(file_path, "rb") as f:
            files = {"file": (filename, f, "application/pdf")}
            res = requests.post(API_URL, files=files, timeout=6000)
        if res.status_code == 200:
            print(f"✅ 匯入成功: {filename} -> {res.json()}")
        else:
            print(f"❌ 匯入失敗: {filename} (狀態碼 {res.status_code})")
            print("回傳內容:", res.text)
    except Exception as e:
        print(f"⚠️ 上傳錯誤 {filename}: {e}")

def bulk_ingest_pdf(folder_path: str):
    """
    找出資料夾下所有 PDF，逐一上傳。
    """
    pdf_files = []
    for root, _, files in os.walk(folder_path):
        for file in files:
            if file.lower().endswith(".pdf"):
                pdf_files.append(os.path.join(root, file))

    if not pdf_files:
        print("❌ 找不到任何 PDF。請確認資料夾路徑是否正確。")
        return

    print(f"📚 找到 {len(pdf_files)} 份 PDF，開始上傳...")
    for pdf in tqdm(pdf_files, desc="處理中"):
        upload_pdf(pdf)

    print("\n✅ 所有 PDF 已處理完成！")

if __name__ == "__main__":
    # 自動找到當前腳本所在目錄的 docs 資料夾
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_docs_folder = os.path.join(script_dir, "docs")
    
    # 如果命令列有提供路徑，使用命令列參數；否則使用預設的 docs 資料夾
    import sys
    if len(sys.argv) >= 2:
        folder = sys.argv[1]
        print(f"📁 使用指定的資料夾: {folder}")
    else:
        folder = default_docs_folder
        print(f"📁 自動使用預設資料夾: {folder}")
    
    # 檢查資料夾是否存在
    if not os.path.exists(folder):
        print(f"❌ 錯誤: 找不到資料夾 '{folder}'")
        print(f"💡 提示: 請確認資料夾路徑是否正確，或使用命令列參數指定路徑")
        print(f"   用法: python {os.path.basename(__file__)} <pdf資料夾路徑>")
        sys.exit(1)
    
    if not os.path.isdir(folder):
        print(f"❌ 錯誤: '{folder}' 不是一個資料夾")
        sys.exit(1)
    
    bulk_ingest_pdf(folder)

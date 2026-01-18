import os
import sys
import time
import requests
from tqdm import tqdm

# 可透過環境變數或預設值設定 API URL
API_URL = os.getenv("RAG_API_URL", "http://localhost:9000/ingest_pdf")
# 批次處理大小：每次處理多少個檔案後暫停
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "5"))
# 批次間延遲（秒）：避免同時開啟太多檔案
BATCH_DELAY = float(os.getenv("BATCH_DELAY", "2.0"))
# 單個檔案上傳後的延遲（秒）
FILE_DELAY = float(os.getenv("FILE_DELAY", "0.5"))

def upload_pdf(file_path: str):
    """
    將單一 PDF 上傳至 RAG API。
    
    Args:
        file_path: PDF 檔案的完整路徑
        
    Returns:
        bool: 上傳成功返回 True，失敗返回 False
    """
    filename = os.path.basename(file_path)
    try:
        with open(file_path, "rb") as f:
            files = {"file": (filename, f, "application/pdf")}
            res = requests.post(API_URL, files=files, timeout=6000)
        
        if res.status_code == 200:
            result = res.json()
            chunks = result.get("chunks_imported", 0)
            print(f"✅ 匯入成功: {filename} (已匯入 {chunks} 個片段)")
            # 上傳成功後稍作延遲，避免過度負載
            time.sleep(FILE_DELAY)
            return True
        else:
            print(f"❌ 匯入失敗: {filename} (狀態碼 {res.status_code})")
            try:
                error_info = res.json()
                print(f"   錯誤訊息: {error_info.get('error', res.text)}")
            except:
                print(f"   回傳內容: {res.text[:200]}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"❌ 連線失敗: {filename} - 無法連接到 RAG API ({API_URL})")
        print("   請確認 RAG 服務是否正在運行")
        return False
    except requests.exceptions.Timeout:
        print(f"⚠️ 上傳超時: {filename} - 請求超過 6000 秒")
        return False
    except FileNotFoundError:
        print(f"❌ 檔案不存在: {file_path}")
        return False
    except Exception as e:
        print(f"⚠️ 上傳錯誤 {filename}: {type(e).__name__} - {e}")
        return False

def bulk_ingest_pdf(folder_path: str):
    """
    找出資料夾下所有 PDF（包含子資料夾），逐一上傳至 RAG API。
    
    Args:
        folder_path: 要掃描的資料夾路徑
    """
    # 檢查資料夾是否存在
    if not os.path.exists(folder_path):
        print(f"❌ 錯誤: 資料夾不存在 - {folder_path}")
        return
    
    if not os.path.isdir(folder_path):
        print(f"❌ 錯誤: 路徑不是資料夾 - {folder_path}")
        return
    
    # 掃描所有 PDF 檔案（包含子資料夾）
    pdf_files = []
    for root, _, files in os.walk(folder_path):
        for file in files:
            if file.lower().endswith(".pdf"):
                full_path = os.path.join(root, file)
                pdf_files.append(full_path)

    if not pdf_files:
        print(f"❌ 在資料夾中找不到任何 PDF 檔案: {folder_path}")
        print("   請確認資料夾路徑是否正確，且包含 .pdf 檔案")
        return

    print(f"📚 找到 {len(pdf_files)} 份 PDF 檔案")
    print(f"🔗 連接到 RAG API: {API_URL}")
    print(f"📂 資料夾路徑: {os.path.abspath(folder_path)}\n")
    
    # 統計結果
    success_count = 0
    fail_count = 0
    
    # 使用 tqdm 顯示進度，並進行批次處理以避免檔案描述符耗盡
    print(f"⚙️  批次設定: 每 {BATCH_SIZE} 個檔案為一批，批次間延遲 {BATCH_DELAY} 秒\n")
    
    for idx, pdf in enumerate(tqdm(pdf_files, desc="上傳進度", unit="檔案"), 1):
        if upload_pdf(pdf):
            success_count += 1
        else:
            fail_count += 1
        
        # 每處理 BATCH_SIZE 個檔案後暫停，讓 Qdrant 有時間關閉檔案
        if idx % BATCH_SIZE == 0 and idx < len(pdf_files):
            tqdm.write(f"⏸️  已處理 {idx}/{len(pdf_files)} 個檔案，暫停 {BATCH_DELAY} 秒讓系統釋放資源...")
            time.sleep(BATCH_DELAY)

    # 顯示總結
    print("\n" + "="*50)
    print(f"📊 處理完成統計:")
    print(f"   ✅ 成功: {success_count} 個檔案")
    print(f"   ❌ 失敗: {fail_count} 個檔案")
    print(f"   📄 總計: {len(pdf_files)} 個檔案")
    print("="*50)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("="*50)
        print("📚 PDF 批量上傳工具 - RAG Server")
        print("="*50)
        print("\n用法:")
        print(f"  python {os.path.basename(__file__)} <pdf資料夾路徑>")
        print("\n範例:")
        print(f"  python {os.path.basename(__file__)} ./documents")
        print(f"  python {os.path.basename(__file__)} /path/to/pdf/folder")
        print("\n環境變數:")
        print("  RAG_API_URL - RAG API 的 URL (預設: http://localhost:9000/ingest_pdf)")
        print("  BATCH_SIZE - 批次大小，每處理多少個檔案後暫停 (預設: 5)")
        print("  BATCH_DELAY - 批次間延遲秒數 (預設: 2.0)")
        print("  FILE_DELAY - 單個檔案上傳後的延遲秒數 (預設: 0.5)")
        print("="*50)
        sys.exit(1)

    folder = sys.argv[1]
    # 將相對路徑轉換為絕對路徑
    folder = os.path.abspath(folder)
    bulk_ingest_pdf(folder)

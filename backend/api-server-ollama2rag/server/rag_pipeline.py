import os
import uuid
import time
import requests
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels


# ==========================================================
# 環境設定（Docker / Local）
# ==========================================================
QDRANT_HOST = os.getenv("QDRANT_HOST", "qdrant")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "knowledge_base")

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "ollama")
OLLAMA_PORT = int(os.getenv("OLLAMA_PORT", "11434"))
# 預設使用 gemma3:12b 模型，如需更換可透過環境變數 LLM_MODEL 覆寫
LLM_MODEL   = os.getenv("LLM_MODEL", "gemma3:12b")
EMBED_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")

print(f"[RAG] Qdrant → {QDRANT_HOST}:{QDRANT_PORT}")
print(f"[RAG] Ollama → {OLLAMA_HOST}:{OLLAMA_PORT}")



# ==========================================================
# Qdrant
# ==========================================================
qdrant = QdrantClient(
    host=QDRANT_HOST,
    port=QDRANT_PORT,
    prefer_grpc=False,
    timeout=10,
)

# 啟動時先確保 collection 存在，避免每次請求都重複確認
def ensure_collection(vector_size: int = 768):
    collections = qdrant.get_collections().collections
    names = [c.name for c in collections]
    if QDRANT_COLLECTION not in names:
        qdrant.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=qmodels.VectorParams(
                size=vector_size,
                distance=qmodels.Distance.COSINE
            )
        )


# 啟動時先確保 collection 存在，避免每次請求都重複確認
def _ensure_on_start():
    try:
        ensure_collection()
    except Exception as e:
        print(f"[RAG] ensure_collection on start failed: {e}")

_ensure_on_start()


# ==========================================================
# Ollama Embedding
# ==========================================================
def _ollama_embed(text: str):
    """
    使用 Ollama 生成文本嵌入向量
    注意：Ollama embeddings API 使用 'prompt' 參數（不是 'input'）
    """
    url = f"http://{OLLAMA_HOST}:{OLLAMA_PORT}/api/embeddings"
    payload = {"model": EMBED_MODEL, "prompt": text}
    try:
        # 增加超時時間，因為模型首次加載可能需要較長時間
        r = requests.post(url, json=payload, timeout=120)
        r.raise_for_status()
        result = r.json()
        # 檢查響應格式：可能是 {"embedding": [...]} 或 {"embeddings": [[...]]}
        if "embedding" in result:
            return result["embedding"]
        elif "embeddings" in result and len(result["embeddings"]) > 0:
            return result["embeddings"][0]
        else:
            raise ValueError(f"無法從 Ollama 響應中提取嵌入向量: {result}")
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            raise ValueError(
                f"Ollama embeddings API 返回 404。請確認：\n"
                f"1. 模型 '{EMBED_MODEL}' 已下載（運行: docker exec {OLLAMA_HOST} ollama pull {EMBED_MODEL}）\n"
                f"2. Ollama 服務正在運行（檢查: docker ps | grep ollama）\n"
                f"3. API 端點正確: {url}"
            ) from e
        raise
    except requests.exceptions.Timeout:
        raise ValueError(
            f"Ollama embeddings API 請求超時。這可能是因為：\n"
            f"1. 模型 '{EMBED_MODEL}' 正在首次加載（需要較長時間）\n"
            f"2. Ollama 服務響應緩慢\n"
            f"請稍後再試，或檢查 Ollama 日誌: docker logs {OLLAMA_HOST}"
        )


# ==========================================================
# Ollama Generate
# ==========================================================
def _ollama_generate(prompt: str, max_retries: int = 3, base_delay: float = 1.0) -> str:
    """
    呼叫 Ollama 產生回覆，預設限制輸出長度，避免在資源較小的機器上耗時過久。
    使用指數退避（Exponential Backoff）重試機制處理偶發的連線問題。
    
    Args:
        prompt: 輸入提示詞
        max_retries: 最大重試次數（預設 3 次）
        base_delay: 基礎延遲時間（秒），預設 1 秒
        
    Returns:
        LLM 生成的回應文本
    """
    url = f"http://{OLLAMA_HOST}:{OLLAMA_PORT}/api/generate"
    payload = {
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            # 增加最大預測 token 數，允許更完整的回答
            "num_predict": 2048,  # 增加到 2048 以支持更長的回答
            # 添加溫度參數以平衡速度和質量（較低溫度 = 更快但可能更確定性）
            "temperature": 0.7,
            # 其他優化參數
            "num_ctx": 4096,  # 增加上下文窗口大小以支持更長的上下文
        },
    }
    
    last_exception = None
    for attempt in range(max_retries):
        try:
            r = requests.post(url, json=payload, timeout=120)
            r.raise_for_status()
            result = r.json()
            # 檢查響應格式
            if "response" in result:
                return result["response"].strip()
            else:
                raise ValueError(f"無法從 Ollama 響應中提取回應: {result}")
                
        except requests.exceptions.ConnectionError as e:
            last_exception = e
            if attempt < max_retries - 1:
                # 指數退避：delay = base_delay * (2 ^ attempt)
                delay = base_delay * (2 ** attempt)
                print(f"[Ollama] 連線錯誤（嘗試 {attempt + 1}/{max_retries}），{delay:.1f} 秒後重試...")
                time.sleep(delay)
            else:
                print(f"[Ollama] 連線失敗：已重試 {max_retries} 次仍無法連接")
                raise ConnectionError(
                    f"無法連接到 Ollama 服務（{OLLAMA_HOST}:{OLLAMA_PORT}）。\n"
                    f"已重試 {max_retries} 次仍失敗。請確認：\n"
                    f"1. Ollama 服務正在運行（檢查: docker ps | grep ollama）\n"
                    f"2. 服務地址正確: {url}"
                ) from e
                
        except requests.exceptions.Timeout as e:
            last_exception = e
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                print(f"[Ollama] 請求超時（嘗試 {attempt + 1}/{max_retries}），{delay:.1f} 秒後重試...")
                time.sleep(delay)
            else:
                print(f"[Ollama] 請求超時：已重試 {max_retries} 次")
                raise TimeoutError(
                    f"Ollama 服務響應超時。\n"
                    f"已重試 {max_retries} 次仍超時。這可能是因為：\n"
                    f"1. 模型正在首次加載（需要較長時間）\n"
                    f"2. 服務器負載過高\n"
                    f"請稍後再試或檢查 Ollama 日誌"
                ) from e
                
        except requests.exceptions.HTTPError as e:
            # HTTP 錯誤（如 404）通常不會因為重試而解決，直接拋出
            if e.response.status_code == 404:
                raise ValueError(
                    f"Ollama generate API 返回 404。請確認：\n"
                    f"1. 模型 '{LLM_MODEL}' 已下載（運行: docker exec {OLLAMA_HOST} ollama pull {LLM_MODEL}）\n"
                    f"2. 模型名稱正確（檢查: docker exec {OLLAMA_HOST} ollama list）\n"
                    f"3. Ollama 服務正在運行（檢查: docker ps | grep ollama）\n"
                    f"4. API 端點正確: {url}"
                ) from e
            # 其他 HTTP 錯誤也進行重試
            last_exception = e
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                print(f"[Ollama] HTTP 錯誤 {e.response.status_code}（嘗試 {attempt + 1}/{max_retries}），{delay:.1f} 秒後重試...")
                time.sleep(delay)
            else:
                raise
    
    # 如果所有重試都失敗，拋出最後一個異常
    if last_exception:
        raise last_exception
    raise RuntimeError("未知錯誤：重試機制未能處理異常")


# ==========================================================
# 新增文件
# ==========================================================
def add_document(text: str, metadata: dict):
    if isinstance(text, bytes):
        text = text.decode("utf-8", errors="ignore")

    vec = _ollama_embed(text)
    
    # 確保 metadata 包含 folder_id（如果沒有則默認為 root）
    final_metadata = metadata or {}
    if "folder_id" not in final_metadata:
        final_metadata["folder_id"] = "root"

    qdrant.upsert(
        collection_name=QDRANT_COLLECTION,
        points=[
            qmodels.PointStruct(
                id=str(uuid.uuid4()),
                vector=vec,
                payload={"text": text, **final_metadata}
            )
        ]
    )


# ==========================================================
# 列出與刪除
# ==========================================================
def list_sources(limit: int = 2000) -> list[str]:
    """列出向量庫中目前的來源檔名（payload['source']）"""
    ensure_collection()
    seen = set()
    offset = None

    while True:
        points, next_page = qdrant.scroll(
            collection_name=QDRANT_COLLECTION,
            limit=256,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for p in points:
            src = (p.payload or {}).get("source")
            if src:
                seen.add(src)
            if len(seen) >= limit:
                break

        if not next_page or len(seen) >= limit:
            break
        offset = next_page

    return sorted(seen)


def get_file_stats(filename: str) -> dict:
    """獲取文件的統計信息（chunks 數量、tokens 估算、GB 大小、分類類別）"""
    ensure_collection()
    
    # 獲取 collection 信息以獲取向量大小
    try:
        collection_info = qdrant.get_collection(QDRANT_COLLECTION)
        vector_size = collection_info.config.params.vectors.size if hasattr(collection_info.config.params, 'vectors') else 768
    except:
        vector_size = 768  # 默認值
    
    points, _ = qdrant.scroll(
        collection_name=QDRANT_COLLECTION,
        limit=10000,
        scroll_filter=qmodels.Filter(
            must=[qmodels.FieldCondition(key="source", match=qmodels.MatchValue(value=filename))]
        ),
        with_payload=True,
        with_vectors=False,
    )
    
    chunk_count = len(points)
    # 估算 tokens：每個 chunk 平均約 100 tokens（根據 chunk_size=400, overlap=80 估算）
    estimated_tokens = chunk_count * 100
    
    # 計算向量大小（GB）
    # 每個向量：vector_size * 4 bytes (float32) + payload 開銷（約 100 bytes）
    vector_bytes_per_point = vector_size * 4 + 100
    total_vector_bytes = chunk_count * vector_bytes_per_point
    total_vector_gb = total_vector_bytes / (1024 ** 3)
    
    # 從文件擴展名推斷分類類別
    file_ext = os.path.splitext(filename)[1].lower() if filename else ""
    category_map = {
        '.pdf': 'PDF',
        '.txt': 'TXT',
        '.doc': 'DOC',
        '.docx': 'DOCX',
        '.md': 'MARKDOWN',
        '.html': 'HTML',
        '.htm': 'HTML',
    }
    category = category_map.get(file_ext, 'UNKNOWN')
    
    # 嘗試從 payload 中獲取分類類別（如果有的話）
    if points and len(points) > 0:
        first_point = points[0]
        if first_point.payload and 'category' in first_point.payload:
            category = first_point.payload['category']
    
    return {
        "filename": filename,
        "chunk_count": chunk_count,
        "estimated_tokens": estimated_tokens,
        "vector_size_gb": total_vector_gb,
        "category": category
    }


def get_collection_stats() -> dict:
    """獲取 collection 的統計信息（總點數、向量大小等）"""
    ensure_collection()
    try:
        collection_info = qdrant.get_collection(QDRANT_COLLECTION)
        
        # 獲取總點數
        points_count = collection_info.points_count
        
        # 獲取向量維度（通常是 768）
        vector_size = collection_info.config.params.vectors.size if hasattr(collection_info.config.params, 'vectors') else 768
        
        # 計算向量數據大小（GB）
        # 每個向量：vector_size * 4 bytes (float32) + payload 開銷（約 100 bytes）
        vector_bytes_per_point = vector_size * 4 + 100
        total_vector_bytes = points_count * vector_bytes_per_point
        total_vector_gb = total_vector_bytes / (1024 ** 3)
        
        return {
            "points_count": points_count,
            "vector_size": vector_size,
            "total_vector_bytes": total_vector_bytes,
            "total_vector_gb": total_vector_gb
        }
    except Exception as e:
        print(f"[RAG] 獲取 collection 統計信息失敗: {e}")
        return {
            "points_count": 0,
            "vector_size": 768,
            "total_vector_bytes": 0,
            "total_vector_gb": 0.0
        }


def delete_by_source(filename: str):
    """根據 payload['source'] 刪除該檔案的所有 chunks"""
    ensure_collection()
    # 使用 FilterSelector 來正確刪除符合條件的點
    qdrant.delete(
        collection_name=QDRANT_COLLECTION,
        points_selector=qmodels.FilterSelector(
            filter=qmodels.Filter(
                must=[qmodels.FieldCondition(key="source", match=qmodels.MatchValue(value=filename))]
            )
        ),
        wait=True  # 等待刪除操作完成
    )


# ==========================================================
# 搜尋
# ==========================================================
def search_contexts(query: str, top_k: int = 5):
    """
    搜索相關知識片段
    
    Args:
        query: 查詢字符串
        top_k: 返回的結果數量（默認5，增加以提高召回率）
    
    Returns:
        知識片段列表（按相似度排序）
    """
    ensure_collection()
    q_vec = _ollama_embed(query)
    hits = qdrant.search(
        collection_name=QDRANT_COLLECTION,
        query_vector=q_vec,
        limit=top_k,
        score_threshold=0.0  # 暫時不設閾值，返回所有結果讓LLM判斷
    )
    
    # 記錄搜索結果信息用於調試
    results = []
    for hit in hits:
        if hit.payload:
            text = hit.payload.get("text", "")
            if text:  # 只返回非空文本
                results.append(text)
                # 記錄相似度分數（score越高越相似，範圍通常是0-1）
                print(f"[RAG Search] 相似度分數: {hit.score:.4f}, 文本長度: {len(text)}")
    
    print(f"[RAG Search] 查詢: '{query[:50]}...', 找到 {len(results)} 個相關片段")
    return results


# ==========================================================
# Prompt（簡短通用版）
# ==========================================================
def build_prompt(question: str, contexts: list[str]) -> str:
    context_block = "\n\n---\n\n".join(contexts) if contexts else "（無可用知識片段）"
    
    # 檢測問題語言（簡單檢測：如果包含中文字符，使用中文；否則使用英文）
    has_chinese = any('\u4e00' <= char <= '\u9fff' for char in question)
    response_lang = "繁體中文" if has_chinese else "English"
    
    return f"""你現在是一位耳鼻喉科專科醫師，也是嚴謹的醫學助理，專精於耳鼻喉學與臨床病理學知識整合。請用{response_lang}回答使用者的問題。回答必須簡潔明瞭（控制在200字以內），直接針對問題要點，不要冗長描述。

【知識片段(可能為英文)】
{context_block}

【使用者問題】
{question}

# Task Workflow(請依照此步驟思考與撰寫)：
#1. 根據問題語言使用{response_lang}回答（中文問題用中文回答，英文問題用英文回答）。
#2. 回答必須簡潔（200字以內），直接針對問題要點，不要冗長或重複。
#3. 保留醫學專有名詞的英文原文（例如 tympanic membrane, otitis media）。
#4. 僅根據題目要求的項目作答，不得加入題目未要求的診斷、原因、治療或過度延伸內容。
#5. 如果問題要求列出病因，需回答『臨床症狀』和『耳鏡下不同病因的描述』（標註主要情況、罕見情況）。
#6. 如果知識片段中沒有答案，請誠實告知。
#7. 在最後面加入「此答覆為生成式AI回答不是醫生」或 "This response is generated by AI and not a doctor"。

重要：回答必須簡潔（200字以內），直接回答問題核心，避免冗長描述。"""


# ==========================================================
# RAG 主流程
# ==========================================================
def rag_answer(question: str, top_k: int = 5):
    """
    RAG 問答主流程
    
    Args:
        question: 用戶問題
        top_k: 搜索的知識片段數量（默認5，增加以提高召回率）
    
    Returns:
        (answer, contexts) 元組
    """
    ctxs = search_contexts(question, top_k)
    
    # 如果沒有找到任何相關片段，記錄警告
    if not ctxs:
        print(f"[RAG Warning] 未找到相關知識片段，問題: '{question[:100]}'")
    
    prompt = build_prompt(question, ctxs)
    answer = _ollama_generate(prompt)
    return answer, ctxs

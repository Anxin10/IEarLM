# RAG API 文檔

## 基礎資訊

- **Base URL**: `http://localhost:9000`
- **Content-Type**: `application/json` (除文件上傳外)
- **API 框架**: FastAPI

## 端點列表

### 1. 健康檢查

檢查 API 服務器狀態。

**請求**
```http
GET /health
```

**響應**
```json
{
  "status": "ok"
}
```

---

### 2. 問答（RAG 檢索 + LLM 生成）

使用 RAG 檢索相關文檔並生成回答。

**請求**
```http
POST /ask
Content-Type: application/json
```

**請求體**
```json
{
  "question": "什麼是耳膜穿孔？",
  "top_k": 3
}
```

**請求參數說明**

| 參數 | 類型 | 必填 | 默認值 | 說明 |
|------|------|------|--------|------|
| `question` | string | 是 | - | 要詢問的問題 |
| `top_k` | integer | 否 | 3 | 檢索相關文檔的數量 |

**響應**
```json
{
  "answer": "耳膜穿孔是指...",
  "contexts": [
    "相關文檔片段 1",
    "相關文檔片段 2",
    "相關文檔片段 3"
  ]
}
```

**響應字段說明**
- `answer`: LLM 生成的回答
- `contexts`: 檢索到的相關文檔片段列表

---

### 3. 文字匯入

將文字內容匯入向量資料庫。

**請求**
```http
POST /ingest
Content-Type: application/json
```

**請求體**
```json
{
  "text": "文檔內容...",
  "metadata": {
    "source": "document.pdf",
    "folder_id": "root"
  }
}
```

**請求參數說明**

| 參數 | 類型 | 必填 | 默認值 | 說明 |
|------|------|------|--------|------|
| `text` | string | 是 | - | 要匯入的文字內容 |
| `metadata` | object | 否 | {} | 元數據，包含 `source`（文件名）等 |

**響應**
```json
{
  "message": "ingested",
  "len": 1234
}
```

---

### 4. PDF 文件上傳

上傳 PDF 文件並自動匯入向量資料庫。

**請求**
```http
POST /ingest_pdf
Content-Type: multipart/form-data
```

**請求參數**

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `file` | file | 是 | PDF 文件 |
| `folder_id` | string | 否 | 資料夾 ID，默認為 'root' |

**響應**
```json
{
  "message": "pdf_ingested",
  "file": "document.pdf",
  "chunks_imported": 45,
  "folder_id": "root"
}
```

**響應字段說明**
- `message`: 操作結果消息
- `file`: 上傳的文件名
- `chunks_imported`: 匯入的文本塊數量
- `folder_id`: 文件所屬資料夾 ID

---

### 5. 列出文件

列出向量資料庫中已匯入的所有文件。

**請求**
```http
GET /files
```

**響應**
```json
{
  "files": [
    "document1.pdf",
    "document2.pdf"
  ],
  "files_with_folders": [
    {
      "filename": "document1.pdf",
      "folder_id": "root",
      "chunk_count": 45,
      "estimated_tokens": 1234,
      "vector_size_gb": 0.001,
      "category": "PDF"
    }
  ]
}
```

**響應字段說明**
- `files`: 文件名列表
- `files_with_folders`: 文件詳細信息列表
  - `filename`: 文件名
  - `folder_id`: 所屬資料夾 ID
  - `chunk_count`: 文本塊數量
  - `estimated_tokens`: 估計的 token 數量
  - `vector_size_gb`: 向量大小（GB）
  - `category`: 文件類型

---

### 6. 刪除文件

從向量資料庫中刪除指定文件及其所有相關的 chunks，同時刪除文件映射信息。

**請求**
```http
POST /delete_pdf
Content-Type: application/json
```

**請求體**
```json
{
  "filename": "document.pdf"
}
```

**請求參數說明**

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `filename` | string | 是 | 要刪除的文件名 |

**響應**
```json
{
  "message": "deleted",
  "file": "document.pdf"
}
```

**注意事項**
- 此操作會永久刪除該文件在 Qdrant 向量資料庫中的所有 chunks
- 同時會刪除文件映射信息（files_mapping.json）
- 此操作不可恢復，請謹慎使用

---

---

### 8. 知識庫統計

獲取知識庫統計信息。

**請求**
```http
GET /api/v1/kb/stats
```

**響應**
```json
{
  "total_vector_gb": 0.123,
  "total_files": 10,
  "total_chunks": 450
}
```

---

### 9. 資料夾管理

#### 9.1 獲取資料夾列表

**請求**
```http
GET /api/v1/kb/folders
```

**響應**
```json
[
  {
    "id": "root",
    "name": "Uncategorized",
    "type": "system",
    "created_at": "2025-01-01T00:00:00"
  },
  {
    "id": "f1",
    "name": "Clinical Guidelines",
    "type": "custom",
    "created_at": "2025-01-10T00:00:00"
  }
]
```

#### 9.2 創建資料夾

**請求**
```http
POST /api/v1/kb/folders
Content-Type: application/json
```

**請求體**
```json
{
  "name": "New Folder",
  "type": "custom"
}
```

**響應**
```json
{
  "id": "f2",
  "name": "New Folder",
  "type": "custom",
  "created_at": "2025-01-15T00:00:00"
}
```

#### 9.3 更新資料夾

**請求**
```http
PUT /api/v1/kb/folders/{folder_id}
Content-Type: application/json
```

**請求體**
```json
{
  "name": "Updated Folder Name"
}
```

**響應**
```json
{
  "id": "f1",
  "name": "Updated Folder Name",
  "type": "custom",
  "created_at": "2025-01-10T00:00:00"
}
```

#### 9.4 刪除資料夾

**請求**
```http
DELETE /api/v1/kb/folders/{folder_id}
```

**響應**
```json
{
  "message": "folder_deleted",
  "folder_id": "f1"
}
```

#### 9.5 移動文件到資料夾

**請求**
```http
PUT /api/v1/kb/files/{filename}/folder
Content-Type: application/json
```

**請求體**
```json
{
  "folder_id": "f1"
}
```

**響應**
```json
{
  "message": "file_moved",
  "filename": "document.pdf",
  "folder_id": "f1"
}
```

---

### 9. 報告生成

#### 9.1 生成報告

**請求**
```http
POST /api/v1/generate-report
Content-Type: application/json
```

**請求體**
```json
{
  "template_name": "ENT_Clinic_Record_Design_Portrait_Fixed",
  "data": {
    "patient_name": "張三",
    "diagnosis": "中耳炎"
  },
  "output_format": "docx"
}
```

**響應**
```json
{
  "status": "success",
  "report_id": "report_xxx.docx",
  "download_url": "/api/v1/download/report_xxx.docx",
  "edit_url": "/api/v1/report/report_xxx.docx/content"
}
```

#### 9.2 下載報告

**請求**
```http
GET /api/v1/download/{report_id}
```

**響應**: 文件下載

#### 9.3 獲取報告內容

**請求**
```http
GET /api/v1/report/{report_id}/content
```

**響應**
```json
{
  "report_id": "report_xxx.docx",
  "content": "報告內容...",
  "template_name": "ENT_Clinic_Record_Design_Portrait_Fixed"
}
```

#### 9.4 更新報告內容

**請求**
```http
PUT /api/v1/report/{report_id}/content
Content-Type: application/json
```

**請求體**
```json
{
  "content": "更新後的報告內容..."
}
```

**響應**
```json
{
  "status": "success",
  "message": "Report content updated and regenerated",
  "report_id": "report_xxx.docx"
}
```

---

## 錯誤處理

所有端點在發生錯誤時會返回以下格式：

```json
{
  "error": "錯誤描述",
  "where": "發生錯誤的位置"
}
```

HTTP 狀態碼：
- `200`: 成功
- `400`: 請求參數錯誤
- `404`: 資源不存在
- `500`: 服務器內部錯誤

---

## 環境變數

- `QDRANT_URL`: Qdrant 向量資料庫 URL（默認: `http://qdrant:6333`）
- `OLLAMA_URL`: Ollama LLM 服務 URL（默認: `http://ollama:11434`）
- `LLM_MODEL`: LLM 模型名稱（默認: `gemma3:12b`）
- `EMBEDDING_MODEL`: 嵌入模型名稱（默認: `nomic-embed-text`）

---

## 注意事項

1. **文件上傳**: 目前僅支援 PDF 格式
2. **向量資料庫**: 使用 Qdrant 作為向量存儲
3. **LLM 服務**: 需要 Ollama 服務運行
4. **資料夾管理**: `root` 資料夾為系統預設，不可刪除
5. **報告生成**: 支援 DOCX 和 PDF 格式輸出

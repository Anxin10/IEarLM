# Word 模板目錄

請將您的 Word 模板文件（.docx）放置在此目錄中。

## 使用方法

1. 將您的 Word 模板文件（例如：`report_template.docx`）放置在 `templates/` 目錄中
2. 在 API 請求中使用模板文件名（不含 `.docx` 後綴），例如：`report_template`

## 輸出格式

API 支援以下輸出格式：
- **docx**：僅生成 Word 版本（供前端編修）
- **pdf**：僅生成 PDF 版本（需要系統安裝 LibreOffice）
- **both**：同時生成 Word 和 PDF 版本（預設）

**注意**：Word 版本始終會生成，以確保前端可以進行編修。PDF 版本是可選的。

## 模板變數

在 Word 模板中，您可以使用以下變數（使用 Jinja2 語法）：

### 基本變數
- `{{ generated_at }}` - 報告生成時間（格式：YYYY年MM月DD日 HH:MM:SS）
- `{{ generated_date }}` - 報告生成日期（格式：YYYY-MM-DD）
- `{{ generated_datetime }}` - 報告生成時間（ISO 格式）

### 數據變數
根據您在 API 請求中傳遞的 `data` 字典，您可以使用對應的變數，例如：
- `{{ question }}` - 問題
- `{{ answer }}` - 答案
- `{{ contexts }}` - 上下文列表
- `{{ citations }}` - 來源標註列表
- `{{ findings }}` - 發現列表（如果有的話）

### 來源標註（citations）
如果數據中包含 `contexts`，系統會自動生成 `citations` 列表，每個項目包含：
- `source` - 來源文件名
- `page` - 頁碼（如果有）
- `citation` - 格式化的標註（例如：[來源: 文件名, p.1]）
- `text` - 上下文文本（前200字符）

### 使用範例

在 Word 模板中：

```
標題：{{ question }}

答案：
{{ answer }}

生成時間：{{ generated_at }}

參考來源：
{% for citation in citations %}
- {{ citation.citation }}
{% endfor %}
```

## 前端編修

Word 版本（.docx）可以用於前端編修：
- 使用 `edit_url` 或 `download_url` 下載 Word 文件
- 前端可以使用 Office.js、OnlyOffice 或其他 Word 編輯器進行編修
- 編修後的文件可以重新上傳到系統

## 注意事項

1. 模板文件必須是 `.docx` 格式
2. 使用 `docxtpl` 庫支持的 Jinja2 語法
3. 可以包含圖片、表格、格式化等 Word 功能
4. 建議在模板中包含公司 Logo 和字體設定等專業格式
5. 模板文件名應與 API 請求中的 `template_name` 對應（不含 `.docx` 後綴）
6. PDF 轉換功能需要系統安裝 LibreOffice（Ubuntu/Debian: `sudo apt-get install libreoffice`）
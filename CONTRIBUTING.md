# 貢獻指南 (Contributing Guide)

感謝您對 **IEAR-LM (Intelligent Ear Analysis and Learning Management)** 專案的關注與支持！我們歡迎任何形式的貢獻，包括但不限於：問題回報、功能建議、文檔修正與代碼貢獻。

---

## 報告問題 (Bug Reports)

若您在執行或部署時發現任何異常：
1. 請先檢查 [GitHub Issues](https://github.com/Anxin10/IEarLM/issues) 是否已有相同的問題回報。
2. 若確認為新問題，請建立新的 Issue，並盡可能提供：
   - 清楚的標題與錯誤描述
   - 重現問題的步驟
   - 您的作業系統環境（如 Windows 11 / Ubuntu 22.04）
   - Python / Node.js 版本及相關軟體日誌（如 `logs/rag_api.log` 或 `logs/yolov7_api.log`）

---

## 功能建議 (Feature Requests)

若您對系統有新功能或架構改進的想法：
- 請至 [GitHub Issues](https://github.com/Anxin10/IEarLM/issues) 建立 Feature Request。
- 描述此功能的使用情境、對臨床醫師或開發者的幫助，以及初步的實現想法。

---

## 代碼貢獻流程 (Pull Requests)

### 1. Fork 與 Clone
```bash
git clone https://github.com/<your-username>/IEarLM.git
cd IEarLM
```

### 2. 建立功能分支
請從 `main` 分支建立新的功能或修復分支：
```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
```

### 3. 開發規範
- **前端開發**：
  - 請遵循 TypeScript 型別規範，避免使用 `any`。
  - 保持 Tailwind CSS 類別簡潔且一致。
  - 於提交前執行 `npm run build` 確認編譯無誤。
- **後端開發**：
  - 遵循 PEP 8 命名與編碼標準。
  - 若修改資料模型，請同步更新 `models_sql.py` 與 `SQL_SCHEMA.md` 文檔。

### 4. Commit 訊息規範
建議採用 Conventional Commits 格式：
- `feat: add otoscope snapshot multi-angle view`
- `fix: resolve CORS issue on port 9000`
- `docs: update deployment guidelines in QUICK_START.md`
- `refactor: clean up findings storage logic`

### 5. 提交 Pull Request
1. 將分支 Push 至您的 Fork 倉庫。
2. 於 GitHub 建立 Pull Request 指向本倉庫的 `main` 分支。
3. 依照 PR 範本填寫更動摘要與測試說明，等待 Review 與合併。

---

## 開源授權

提交 PR 即代表您同意將貢獻的程式碼以 [MIT License](LICENSE) 條款開源分發。

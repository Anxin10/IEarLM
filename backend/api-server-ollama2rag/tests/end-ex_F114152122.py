import sys
import os
import requests
from PyQt5.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QTextEdit, QLabel, QFileDialog, QMessageBox, QFrame,
    QListWidget
)
from PyQt5.QtCore import QThread, pyqtSignal, Qt
from PyQt5.QtGui import QKeyEvent

# API 接口設定（改為本機 localhost）
API_ASK_URL = "http://192.168.50.126:9000/ask"
API_PDF_URL = "http://192.168.50.126:9000/ingest_pdf"
# 列表與刪除
API_LIST_URL = "http://192.168.50.126:9000/files"
# 假設刪除使用檔名為參數的接口，若不同請調整 API_DELETE_URL 與 payload
API_DELETE_URL = "http://192.168.50.126:9000/delete_pdf"

# ============================================================
# 執行緒：處理 /ask 查詢 (AskWorker)
# ============================================================
class AskWorker(QThread):
    finished = pyqtSignal(str)
    progress_update = pyqtSignal(bool) 

    def __init__(self, question: str):
        super().__init__()
        self.question = question

    def run(self):
        self.progress_update.emit(True) 
        try:
            payload = {"question": self.question, "top_k": 2}
            res = requests.post(API_ASK_URL, json=payload, timeout=90) 
            res.raise_for_status()
            data = res.json()
            answer = data.get("answer", "No answer.")
        except requests.exceptions.Timeout:
            answer = "請求超時：伺服器響應時間過長，請重試。"
        except Exception as e:
            answer = f"請求錯誤 (ASK API):\n{str(e)}"

        self.progress_update.emit(False) 
        self.finished.emit(answer)


# ============================================================
# 執行緒：處理 PDF 刪除 (DeleteWorker)
# ============================================================
class DeleteWorker(QThread):
    finished = pyqtSignal(str, str)  # (訊息, 檔名)
    progress_update = pyqtSignal(bool)

    def __init__(self, filename: str):
        super().__init__()
        self.filename = filename

    def run(self):
        self.progress_update.emit(True)
        msg = ""
        try:
            payload = {"filename": self.filename}
            res = requests.post(API_DELETE_URL, json=payload, timeout=120)
            if res.status_code == 200:
                msg = f"🗑️ 已刪除：{self.filename}"
            else:
                msg = f"❌ 刪除失敗：{self.filename}\n伺服器回覆: {res.text[:100]}..."
        except Exception as e:
            msg = f"⚠️ 刪除錯誤：{str(e)}"

        self.progress_update.emit(False)
        self.finished.emit(msg, self.filename)


# ============================================================
# 執行緒：處理 PDF 上傳 (UploadWorker)
# ============================================================
class UploadWorker(QThread):
    # finished 信號現在帶有兩個參數: (成功訊息/錯誤訊息, 檔名)
    finished = pyqtSignal(str, str) 
    progress_update = pyqtSignal(bool) 

    def __init__(self, file_path: str):
        super().__init__()
        self.file_path = file_path

    def run(self):
        filename = os.path.basename(self.file_path)
        self.progress_update.emit(True) 
        msg = ""
        
        try:
            with open(self.file_path, "rb") as f:
                files = {"file": (filename, f, "application/pdf")}
                res = requests.post(API_PDF_URL, files=files, timeout=900) 
            
            if res.status_code == 200:
                msg = f"✅ 知識文件匯入成功：{filename}"
            else:
                msg = f"❌ 匯入失敗：{filename}\n伺服器回覆: {res.text[:100]}..."

        except Exception as e:
            msg = f"⚠️ 上傳錯誤：{str(e)}"
        
        self.progress_update.emit(False) 
        self.finished.emit(msg, filename) # 傳回檔名，用於 RAG_GUI 更新清單


class EnterToSendTextEdit(QTextEdit):
    """自訂輸入框：Enter 送出，Shift+Enter 換行"""

    enter_pressed = pyqtSignal()

    def keyPressEvent(self, event: QKeyEvent):
        if event.key() in (Qt.Key_Return, Qt.Key_Enter):
            if event.modifiers() & Qt.ShiftModifier:
                # Shift+Enter 仍然換行
                super().keyPressEvent(event)
            else:
                self.enter_pressed.emit()
        else:
            super().keyPressEvent(event)


# ============================================================
# 主 GUI (RAG_GUI)
# ============================================================
class RAG_GUI(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("📚 RAG 知識問答平台")
        self.resize(820, 720)
        
        # 儲存已匯入的檔名清單 (假設本機儲存，實際應向後端查詢)
        self.ingested_files = [] 
        
        self.setup_ui()
        self.apply_styles()
        self.ask_worker = None
        self.upload_worker = None
        self.delete_worker = None
        
        # 初始化文件列表
        self.refresh_file_list()

    def setup_ui(self):
        main_layout = QVBoxLayout(self)

        # ------------------- TOP: Query Area -------------------
        query_frame = QFrame()
        query_frame.setObjectName("QueryFrame")
        query_layout = QVBoxLayout(query_frame)
        
        query_layout.addWidget(QLabel("💬 RAG 問句輸入：", objectName="SectionTitle"))
        
        self.input_text = EnterToSendTextEdit()
        self.input_text.setPlaceholderText("請輸入您想查詢的問題... (Enter 直接送出，Shift+Enter 換行)")
        self.input_text.setObjectName("InputText")
        self.input_text.setMinimumHeight(100)
        self.input_text.enter_pressed.connect(self.send_query)
        query_layout.addWidget(self.input_text)

        # 查詢按鈕 (右對齊)
        self.btn_query = QPushButton("💬 送出 RAG 查詢")
        self.btn_query.clicked.connect(self.send_query)
        self.btn_query.setObjectName("QueryButton")
        self.btn_query.setFixedWidth(180) 

        h_layout_query = QHBoxLayout()
        h_layout_query.addStretch(1) 
        h_layout_query.addWidget(self.btn_query)
        query_layout.addLayout(h_layout_query)

        main_layout.addWidget(query_frame)

        # ------------------- MIDDLE: Output Area -------------------
        output_frame = QFrame()
        output_frame.setObjectName("OutputFrame")
        output_layout = QVBoxLayout(output_frame)
        
        output_layout.addWidget(QLabel("📝 系統回覆：", objectName="SectionTitle"))
        self.output_text = QTextEdit()
        self.output_text.setReadOnly(True)
        self.output_text.setObjectName("OutputText")
        output_layout.addWidget(self.output_text)

        main_layout.addWidget(output_frame)
        
        # ------------------- BOTTOM: Knowledge Base Management Area -------------------
        kb_frame = QFrame()
        kb_frame.setObjectName("KnowledgeBaseFrame")
        kb_layout = QVBoxLayout(kb_frame)
        
        # 知識庫列表
        kb_layout.addWidget(QLabel("📂 已匯入知識文件清單：", objectName="UploadLabel"))
        self.file_list_widget = QListWidget()
        self.file_list_widget.setObjectName("FileList")
        self.file_list_widget.setMinimumHeight(120)
        kb_layout.addWidget(self.file_list_widget)

        # 控制按鈕 (刷新、刪除與匯入)
        control_h_layout = QHBoxLayout()
        
        self.btn_refresh_list = QPushButton("🔄 刷新文件列表")
        self.btn_refresh_list.clicked.connect(self.refresh_file_list)
        self.btn_refresh_list.setObjectName("RefreshButton")
        self.btn_refresh_list.setFixedWidth(180)

        self.btn_delete = QPushButton("🗑️ 刪除選取文件")
        self.btn_delete.clicked.connect(self.delete_selected_file)
        self.btn_delete.setObjectName("DeleteButton")
        self.btn_delete.setFixedWidth(180)
        
        self.btn_upload = QPushButton("+ 匯入知識文件")
        self.btn_upload.clicked.connect(self.upload_pdf)
        self.btn_upload.setObjectName("UploadButton")
        self.btn_upload.setFixedWidth(180) # 與刷新按鈕對稱

        control_h_layout.addWidget(self.btn_refresh_list)
        control_h_layout.addWidget(self.btn_delete)
        control_h_layout.addStretch(1) 
        control_h_layout.addWidget(self.btn_upload)
        
        kb_layout.addLayout(control_h_layout)
        main_layout.addWidget(kb_frame)


    def apply_styles(self):
        """應用 QSS 樣式表進行視覺美化 (新增 FileList 樣式)"""
        style = """
        QWidget {
            background-color: #f8f9fa; 
            font-family: Microsoft JhengHei, Arial;
            font-size: 11pt;
            color: #333333;
        }
        #SectionTitle {
            font-size: 13pt;
            font-weight: bold;
            color: #34495e; 
            padding-bottom: 5px;
            border-bottom: 2px solid #dde1e5;
        }
        #QueryFrame, #OutputFrame, #KnowledgeBaseFrame {
            background-color: white;
            border: 1px solid #e9ecef;
            border-radius: 10px;
            padding: 15px;
            margin: 5px;
            box-shadow: 1px 1px 4px rgba(0, 0, 0, 0.05); 
        }
        QTextEdit#InputText {
            border: 1px solid #ced4da;
            border-radius: 6px;
            padding: 8px;
        }
        QTextEdit#OutputText {
            border: 1px solid #ced4da;
            border-radius: 6px;
            padding: 10px;
            background-color: #f1f3f5; 
        }
        QListWidget#FileList {
            border: 1px solid #ced4da;
            border-radius: 6px;
            padding: 5px;
            background-color: #ffffff;
        }
        QPushButton {
            background-color: #495057; 
            color: white;
            border: none;
            padding: 8px 15px; 
            border-radius: 6px;
            font-weight: bold;
            font-size: 11pt;
        }
        QPushButton:hover {
            background-color: #343a40;
        }
        QPushButton:pressed {
            background-color: #212529;
        }
        QPushButton:disabled {
            background-color: #adb5bd;
            color: #e9ecef;
        }
        #QueryButton {
            background-color: #007bff;
        }
        #QueryButton:hover {
            background-color: #0056b3;
        }
        #UploadButton {
            background-color: #28a745; 
        }
        #UploadButton:hover {
            background-color: #1e7e34;
        }
        #RefreshButton {
            background-color: #6c757d; /* 灰色作為刷新按鈕 */
        }
        #RefreshButton:hover {
            background-color: #5a6268;
        }
        #DeleteButton {
            background-color: #d9534f;
        }
        #DeleteButton:hover {
            background-color: #c9302c;
        }
        #UploadLabel {
            font-size: 11pt;
            color: #7f8c8d;
        }
        """
        self.setStyleSheet(style)


    # ------------------------------------------------------------
    # 查詢相關邏輯
    # ------------------------------------------------------------
    def send_query(self):
        question = self.input_text.toPlainText().strip()
        if not question:
            QMessageBox.warning(self, "提醒", "請先輸入問題")
            return

        self.output_text.setText("查詢中，請稍候...")
        self.set_query_ui_state(True, "💬 送出 RAG 查詢")

        self.ask_worker = AskWorker(question)
        self.ask_worker.finished.connect(self.show_answer)
        self.ask_worker.progress_update.connect(
            lambda is_loading: self.set_query_ui_state(is_loading, "💬 送出 RAG 查詢")
        )
        self.ask_worker.start()

    def set_query_ui_state(self, is_loading: bool, default_text: str):
        """設置查詢按鈕和輸入框的狀態"""
        self.btn_query.setEnabled(not is_loading)
        self.input_text.setReadOnly(is_loading)
        if is_loading:
            self.btn_query.setText("⏳ RAG 處理中...")
        else:
            self.btn_query.setText(default_text)

    def show_answer(self, answer: str):
        """顯示查詢結果"""
        self.output_text.setText(answer)


    # ------------------------------------------------------------
    # 上傳與清單相關邏輯
    # ------------------------------------------------------------
    def upload_pdf(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "選擇 PDF 檔案", "", "PDF Files (*.pdf)"
        )
        if not file_path:
            return

        filename = os.path.basename(file_path)
        self.output_text.setText(f"文件 '{filename}' 正在上傳與處理中...")
        self.set_upload_ui_state(True)

        self.upload_worker = UploadWorker(file_path)
        # 連接到新的處理函式
        self.upload_worker.finished.connect(self.handle_upload_finish) 
        self.upload_worker.progress_update.connect(self.set_upload_ui_state)
        self.upload_worker.start()

    def set_upload_ui_state(self, is_loading: bool):
        """設置上傳按鈕、刷新按鈕和查詢按鈕的狀態"""
        self.btn_upload.setEnabled(not is_loading)
        self.btn_refresh_list.setEnabled(not is_loading) # 上傳時禁用刷新
        self.btn_delete.setEnabled(not is_loading)
        
        if is_loading:
            self.btn_upload.setText("⏳ 建立索引中...")
            self.btn_query.setEnabled(False) 
        else:
            self.btn_upload.setText("+ 匯入知識文件")
            self.btn_query.setEnabled(True) 

    def handle_upload_finish(self, msg: str, filename: str):
        """處理文件上傳完成後的邏輯：顯示結果並更新列表"""
        self.output_text.setText(msg)
        
        # 檢查是否匯入成功
        if msg.startswith("✅"):
            if filename not in self.ingested_files:
                self.ingested_files.append(filename)
        
        self.refresh_file_list()

    def update_file_list_ui(self, files: list[str] | None = None):
        """更新 QListWidget 顯示已匯入的文件列表"""
        if files is None:
            files = self.ingested_files
        self.file_list_widget.clear()
        
        if not files:
            self.file_list_widget.addItem("目前知識庫中沒有文件。請點擊 '匯入知識文件'。")
            self.file_list_widget.item(0).setForeground(Qt.gray) 
            return
        
        for file_name in files:
            self.file_list_widget.addItem(f"📄 {file_name}")
            self.file_list_widget.item(self.file_list_widget.count() - 1).setForeground(Qt.darkBlue)

    def fetch_remote_file_list(self) -> list[str]:
        """向後端 /files 拉取已匯入清單"""
        try:
            res = requests.get(API_LIST_URL, timeout=15)
            res.raise_for_status()
            data = res.json()
            files = data.get("files", [])
            if isinstance(files, list):
                return [f for f in files if isinstance(f, str)]
            return []
        except Exception as e:
            self.output_text.setText(f"⚠️ 取得遠端文件列表失敗：{str(e)}")
            return []

    def set_refresh_ui_state(self, is_loading: bool):
        """刷新期間禁用刷新按鈕，避免重複請求"""
        self.btn_refresh_list.setEnabled(not is_loading)
        if is_loading:
            self.btn_refresh_list.setText("⏳ 同步中...")
        else:
            self.btn_refresh_list.setText("🔄 刷新文件列表")

    def refresh_file_list(self):
        """從後端同步文件列表並更新 UI"""
        self.set_refresh_ui_state(True)
        try:
            files = self.fetch_remote_file_list()
            self.ingested_files = files
            self.update_file_list_ui(files)
            if files:
                self.output_text.setText("已同步最新文件列表。")
            else:
                self.output_text.setText("目前遠端知識庫中沒有文件。")
        finally:
            self.set_refresh_ui_state(False)

    # ------------------------------------------------------------
    # 刪除相關邏輯
    # ------------------------------------------------------------
    def delete_selected_file(self):
        selected_items = self.file_list_widget.selectedItems()
        if not selected_items:
            QMessageBox.information(self, "提醒", "請先選取要刪除的文件。")
            return

        display_name = selected_items[0].text()
        filename = display_name.replace("📄 ", "")

        # 允許確認
        confirm = QMessageBox.question(
            self,
            "確認刪除",
            f"確定要從向量庫刪除「{filename}」嗎？此動作無法復原。",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if confirm != QMessageBox.Yes:
            return

        self.output_text.setText(f"文件 '{filename}' 正在刪除中...")
        self.set_delete_ui_state(True)

        self.delete_worker = DeleteWorker(filename)
        self.delete_worker.finished.connect(self.handle_delete_finish)
        self.delete_worker.progress_update.connect(self.set_delete_ui_state)
        self.delete_worker.start()

    def set_delete_ui_state(self, is_loading: bool):
        """刪除過程中禁用相關按鈕，避免重複操作"""
        self.btn_delete.setEnabled(not is_loading)
        self.btn_refresh_list.setEnabled(not is_loading)
        self.btn_upload.setEnabled(not is_loading)
        self.btn_query.setEnabled(not is_loading)

        if is_loading:
            self.btn_delete.setText("⏳ 刪除中...")
        else:
            self.btn_delete.setText("🗑️ 刪除選取文件")

    def handle_delete_finish(self, msg: str, filename: str):
        """處理刪除完成的 UI 更新"""
        self.output_text.setText(msg)
        if msg.startswith("🗑️") or msg.startswith("✅"):
            # 成功刪除後重新同步遠端列表，保持一致
            self.refresh_file_list()
            self.set_delete_ui_state(False)
        else:
            # 若刪除失敗，保留現有列表
            self.set_delete_ui_state(False)


# ============================================================
# Main
# ============================================================
if __name__ == "__main__":
    if hasattr(Qt, 'AA_EnableHighDpiScaling'):
        QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    if hasattr(Qt, 'AA_UseHighDpiPixmaps'):
        QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)

    app = QApplication(sys.argv)
    window = RAG_GUI()
    window.show()
    sys.exit(app.exec_())
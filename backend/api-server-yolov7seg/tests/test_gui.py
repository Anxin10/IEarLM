"""
YOLOv7-seg API 測試 GUI
使用 PyQt5 創建圖形界面進行 API 測試
"""

import sys
import os
from pathlib import Path
import cv2
import numpy as np
import requests
import base64
from typing import Optional

# 添加 server 目錄到路徑，以便導入 draw_utils
sys.path.insert(0, str(Path(__file__).parent.parent / "server"))

try:
    from PyQt5.QtWidgets import (
        QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
        QPushButton, QLabel, QFileDialog, QTextEdit, QDoubleSpinBox,
        QSpinBox, QComboBox, QGroupBox, QMessageBox, QSplitter,
        QScrollArea, QCheckBox
    )
    from PyQt5.QtCore import Qt, QThread, pyqtSignal, QSize
    from PyQt5.QtGui import QPixmap, QImage, QFont
except ImportError:
    print("錯誤: 需要安裝 PyQt5")
    print("請運行: pip install PyQt5")
    sys.exit(1)


class DetectionWorker(QThread):
    """後台檢測工作線程"""
    finished = pyqtSignal(dict)
    error = pyqtSignal(str)
    
    def __init__(self, api_url: str, image_path: str, conf_thres: float,
                 iou_thres: float, include_crop_coords: bool, coordinate_type: str):
        super().__init__()
        self.api_url = api_url
        self.image_path = image_path
        self.conf_thres = conf_thres
        self.iou_thres = iou_thres
        self.include_crop_coords = include_crop_coords
        self.coordinate_type = coordinate_type
    
    def run(self):
        """執行檢測"""
        try:
            # 讀取圖片並編碼
            with open(self.image_path, "rb") as f:
                image_data = base64.b64encode(f.read()).decode('utf-8')
            
            # 發送請求
            payload = {
                "image": image_data,
                "conf_thres": self.conf_thres,
                "iou_thres": self.iou_thres,
                "include_crop_coords": self.include_crop_coords,
                "coordinate_type": self.coordinate_type
            }
            
            response = requests.post(
                f"{self.api_url}/api/analyze",
                json=payload,
                timeout=120
            )
            
            if response.status_code == 200:
                result = response.json()
                result['image_path'] = self.image_path
                self.finished.emit(result)
            else:
                self.error.emit(f"API 錯誤: {response.status_code}\n{response.text}")
        
        except Exception as e:
            self.error.emit(f"檢測失敗: {str(e)}")


class ImageLabel(QLabel):
    """可縮放的圖片標籤"""
    def __init__(self):
        super().__init__()
        self.setAlignment(Qt.AlignCenter)
        self.setStyleSheet("border: 1px solid gray; background-color: #f0f0f0;")
        self.setMinimumSize(400, 300)
        self.original_pixmap = None
    
    def set_image(self, image_path: str):
        """設置圖片"""
        if not os.path.exists(image_path):
            self.setText("圖片不存在")
            return
        
        pixmap = QPixmap(image_path)
        if pixmap.isNull():
            self.setText("無法載入圖片")
            return
        
        self.original_pixmap = pixmap
        self.update_display()
    
    def set_cv_image(self, img: np.ndarray):
        """設置 OpenCV 圖片"""
        if img is None or img.size == 0:
            self.setText("圖片為空")
            return
        
        # 轉換 BGR 到 RGB
        if len(img.shape) == 3:
            rgb_image = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        else:
            rgb_image = img
        
        h, w = rgb_image.shape[:2]
        bytes_per_line = 3 * w if len(rgb_image.shape) == 3 else w
        
        q_image = QImage(rgb_image.data, w, h, bytes_per_line, QImage.Format_RGB888)
        self.original_pixmap = QPixmap.fromImage(q_image)
        self.update_display()
    
    def update_display(self):
        """更新顯示"""
        if self.original_pixmap is None:
            return
        
        # 縮放圖片以適應標籤大小
        scaled_pixmap = self.original_pixmap.scaled(
            self.size(),
            Qt.KeepAspectRatio,
            Qt.SmoothTransformation
        )
        self.setPixmap(scaled_pixmap)
    
    def resizeEvent(self, event):
        """重寫 resize 事件以自動縮放圖片"""
        super().resizeEvent(event)
        self.update_display()


class DetectionGUI(QMainWindow):
    """檢測 GUI 主窗口"""
    
    def __init__(self):
        super().__init__()
        self.current_image_path = None
        self.current_result = None
        self.init_ui()
    
    def init_ui(self):
        """初始化 UI"""
        self.setWindowTitle("YOLOv7-seg API 測試工具")
        self.setGeometry(100, 100, 1400, 900)
        
        # 中央部件
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # 主布局
        main_layout = QHBoxLayout(central_widget)
        
        # 左側：控制面板
        control_panel = self.create_control_panel()
        main_layout.addWidget(control_panel, 1)
        
        # 右側：圖片顯示區域
        image_area = self.create_image_area()
        main_layout.addWidget(image_area, 2)
        
        # 狀態欄
        self.statusBar().showMessage("就緒")
    
    def create_control_panel(self):
        """創建控制面板"""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        # API 設置
        api_group = QGroupBox("API 設置")
        api_layout = QVBoxLayout()
        
        self.api_url_input = QTextEdit()
        self.api_url_input.setMaximumHeight(30)
        self.api_url_input.setPlainText("http://localhost:5000")
        api_layout.addWidget(QLabel("API 地址:"))
        api_layout.addWidget(self.api_url_input)
        
        self.test_connection_btn = QPushButton("測試連接")
        self.test_connection_btn.clicked.connect(self.test_connection)
        api_layout.addWidget(self.test_connection_btn)
        
        api_group.setLayout(api_layout)
        layout.addWidget(api_group)
        
        # 圖片選擇
        image_group = QGroupBox("圖片選擇")
        image_layout = QVBoxLayout()
        
        self.select_image_btn = QPushButton("選擇圖片")
        self.select_image_btn.clicked.connect(self.select_image)
        image_layout.addWidget(self.select_image_btn)
        
        self.image_path_label = QLabel("未選擇圖片")
        self.image_path_label.setWordWrap(True)
        image_layout.addWidget(self.image_path_label)
        
        image_group.setLayout(image_layout)
        layout.addWidget(image_group)
        
        # 檢測參數
        params_group = QGroupBox("檢測參數")
        params_layout = QVBoxLayout()
        
        # Conf threshold
        conf_layout = QHBoxLayout()
        conf_layout.addWidget(QLabel("Conf Threshold:"))
        self.conf_spin = QDoubleSpinBox()
        self.conf_spin.setRange(0.0, 1.0)
        self.conf_spin.setSingleStep(0.05)
        self.conf_spin.setValue(0.25)
        self.conf_spin.setDecimals(2)
        conf_layout.addWidget(self.conf_spin)
        params_layout.addLayout(conf_layout)
        
        # IoU threshold
        iou_layout = QHBoxLayout()
        iou_layout.addWidget(QLabel("IoU Threshold:"))
        self.iou_spin = QDoubleSpinBox()
        self.iou_spin.setRange(0.0, 1.0)
        self.iou_spin.setSingleStep(0.05)
        self.iou_spin.setValue(0.45)
        self.iou_spin.setDecimals(2)
        iou_layout.addWidget(self.iou_spin)
        params_layout.addLayout(iou_layout)
        
        # Coordinate type
        coord_layout = QHBoxLayout()
        coord_layout.addWidget(QLabel("座標類型:"))
        self.coord_combo = QComboBox()
        self.coord_combo.addItems(["original", "cropped"])
        coord_layout.addWidget(self.coord_combo)
        params_layout.addLayout(coord_layout)
        
        # Include crop coords
        self.include_crop_check = QCheckBox("包含裁切座標")
        self.include_crop_check.setChecked(True)
        params_layout.addWidget(self.include_crop_check)
        
        params_group.setLayout(params_layout)
        layout.addWidget(params_group)
        
        # 執行檢測
        self.detect_btn = QPushButton("執行檢測")
        self.detect_btn.setStyleSheet("background-color: #4CAF50; color: white; font-weight: bold; padding: 10px;")
        self.detect_btn.clicked.connect(self.run_detection)
        layout.addWidget(self.detect_btn)
        
        # 結果顯示
        result_group = QGroupBox("檢測結果")
        result_layout = QVBoxLayout()
        
        self.result_text = QTextEdit()
        self.result_text.setReadOnly(True)
        self.result_text.setFont(QFont("Consolas", 9))
        result_layout.addWidget(self.result_text)
        
        result_group.setLayout(result_layout)
        layout.addWidget(result_group)
        
        layout.addStretch()
        
        return panel
    
    def create_image_area(self):
        """創建圖片顯示區域"""
        area = QWidget()
        layout = QVBoxLayout(area)
        
        # 原始圖片
        layout.addWidget(QLabel("原始圖片:"))
        self.original_image_label = ImageLabel()
        layout.addWidget(self.original_image_label)
        
        # 結果圖片（帶檢測框）
        layout.addWidget(QLabel("檢測結果:"))
        self.result_image_label = ImageLabel()
        layout.addWidget(self.result_image_label)
        
        return area
    
    def test_connection(self):
        """測試 API 連接"""
        api_url = self.api_url_input.toPlainText().strip()
        if not api_url:
            QMessageBox.warning(self, "警告", "請輸入 API 地址")
            return
        
        try:
            response = requests.get(f"{api_url}/api/health", timeout=5)
            if response.status_code == 200:
                QMessageBox.information(self, "成功", "API 連接正常")
                self.statusBar().showMessage("API 連接正常")
            else:
                QMessageBox.warning(self, "警告", f"API 響應異常: {response.status_code}")
        except Exception as e:
            QMessageBox.critical(self, "錯誤", f"無法連接到 API:\n{str(e)}")
    
    def select_image(self):
        """選擇圖片"""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "選擇圖片",
            "",
            "圖片文件 (*.jpg *.jpeg *.png *.bmp);;所有文件 (*.*)"
        )
        
        if file_path:
            self.current_image_path = file_path
            self.image_path_label.setText(f"已選擇: {Path(file_path).name}")
            self.original_image_label.set_image(file_path)
            self.statusBar().showMessage(f"已載入圖片: {Path(file_path).name}")
    
    def run_detection(self):
        """執行檢測"""
        if not self.current_image_path:
            QMessageBox.warning(self, "警告", "請先選擇圖片")
            return
        
        api_url = self.api_url_input.toPlainText().strip()
        if not api_url:
            QMessageBox.warning(self, "警告", "請輸入 API 地址")
            return
        
        # 獲取參數
        conf_thres = self.conf_spin.value()
        iou_thres = self.iou_spin.value()
        include_crop_coords = self.include_crop_check.isChecked()
        coordinate_type = self.coord_combo.currentText()
        
        # 禁用按鈕
        self.detect_btn.setEnabled(False)
        self.detect_btn.setText("檢測中...")
        self.statusBar().showMessage("正在檢測...")
        
        # 創建工作線程
        self.worker = DetectionWorker(
            api_url, self.current_image_path, conf_thres, iou_thres,
            include_crop_coords, coordinate_type
        )
        self.worker.finished.connect(self.on_detection_finished)
        self.worker.error.connect(self.on_detection_error)
        self.worker.start()
    
    def on_detection_finished(self, result: dict):
        """檢測完成"""
        self.current_result = result
        self.detect_btn.setEnabled(True)
        self.detect_btn.setText("執行檢測")
        
        # 顯示結果文本
        detections = result.get('detections', [])
        crop_info = result.get('crop_info', {})
        
        result_text = f"檢測到 {len(detections)} 個目標\n\n"
        
        for i, det in enumerate(detections, 1):
            result_text += f"[{i}] {det.get('class_name')}\n"
            result_text += f"    置信度: {det.get('confidence'):.3f}\n"
            bbox = det.get('bbox', [])
            result_text += f"    座標: [{bbox[0]:.1f}, {bbox[1]:.1f}, {bbox[2]:.1f}, {bbox[3]:.1f}]\n\n"
        
        if crop_info.get('success'):
            result_text += f"裁切資訊:\n"
            result_text += f"  圓心: {crop_info.get('center')}\n"
            result_text += f"  半徑: {crop_info.get('radius')}\n"
            crop_coords = crop_info.get('crop_coords')
            if crop_coords:
                result_text += f"  裁切座標: {crop_coords}\n"
        
        self.result_text.setPlainText(result_text)
        
        # 繪製檢測結果
        self.draw_detections()
        
        self.statusBar().showMessage(f"檢測完成，找到 {len(detections)} 個目標")
    
    def on_detection_error(self, error_msg: str):
        """檢測錯誤"""
        self.detect_btn.setEnabled(True)
        self.detect_btn.setText("執行檢測")
        QMessageBox.critical(self, "檢測失敗", error_msg)
        self.statusBar().showMessage("檢測失敗")
    
    def draw_detections(self):
        """在圖片上繪製檢測結果（使用分割標記方式）"""
        if not self.current_image_path or not self.current_result:
            return
        
        # 讀取原始圖片
        img = cv2.imread(self.current_image_path)
        if img is None:
            return
        
        # 繪製裁切區域（如果有）
        crop_info = self.current_result.get('crop_info', {})
        if crop_info.get('success'):
            crop_coords = crop_info.get('crop_coords')
            if crop_coords:
                x1, y1, x2, y2 = crop_coords
                cv2.rectangle(img, (x1, y1), (x2, y2), (255, 255, 0), 2)
                cv2.putText(img, "Crop Area", (x1, y1 - 10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
        
        # 使用分割標記方式繪製檢測結果
        try:
            from draw_utils import draw_segmentation_annotations
        except ImportError:
            # 如果無法導入，使用簡單的矩形框
            detections = self.current_result.get('detections', [])
            for det in detections:
                bbox = det.get('bbox', [])
                if len(bbox) == 4:
                    x1, y1, x2, y2 = map(int, bbox)
                    cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    label = f"{det.get('class_name')} {det.get('confidence'):.2f}"
                    cv2.putText(img, label, (x1, y1 - 10),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            self.result_image_label.set_cv_image(img)
            return
        
        detections = self.current_result.get('detections', [])
        img = draw_segmentation_annotations(
            img,
            detections,
            draw_conf_thres=0.1,  # 繪製所有超過 0.1 置信度的檢測
            node_step_px=12,
            node_radius=4,
            line_thickness=4,
            outline_alpha=0.85,
            glow=False,
            glow_strength=0.35
        )
        
        # 顯示結果圖片
        self.result_image_label.set_cv_image(img)


def main():
    app = QApplication(sys.argv)
    window = DetectionGUI()
    window.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()


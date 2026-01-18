"""
YOLOv7 export formats
Minimal implementation for model type detection
"""

import pandas as pd
from pathlib import Path


def export_formats():
    """
    Returns a DataFrame with export format information.
    Used by models/common.py to detect model file types.
    """
    # Define export formats with their suffixes
    # 注意：.xml 會在 common.py 中單獨添加，所以這裡不包含它
    formats = [
        ['PyTorch', '-', '.pt', True, True],
        ['TorchScript', 'torchscript', '.torchscript', True, True],
        ['ONNX', 'onnx', '.onnx', True, True],
        ['TensorRT', 'engine', '.engine', False, True],
        ['CoreML', 'coreml', '.mlmodel', True, False],
        ['TensorFlow SavedModel', 'saved_model', '_saved_model', True, True],
        ['TensorFlow GraphDef', 'pb', '.pb', True, True],
        ['TensorFlow Lite', 'tflite', '.tflite', True, False],
        ['TensorFlow Edge TPU', 'edgetpu', '_edgetpu.tflite', False, False],
        ['TensorFlow.js', 'tfjs', '.tfjs', False, False],
        ['OpenVINO Model', 'openvino', '_openvino_model', True, True],  # For xml2 pattern matching
    ]
    
    # Create DataFrame with columns: Format, Argument, Suffix, CPU, GPU
    df = pd.DataFrame(formats, columns=['Format', 'Argument', 'Suffix', 'CPU', 'GPU'])
    
    # Add Suffix as an attribute for easy access (used in common.py)
    class ExportFormats:
        def __init__(self, df):
            self.df = df
            self.Suffix = df['Suffix'].tolist()
        
        def iterrows(self):
            return self.df.iterrows()
    
    return ExportFormats(df)


def run(weights='', imgsz=640, batch_size=1, device='cpu', include=('onnx',), half=False, inplace=False, keras=False, optimize=False, int8=False, dynamic=False, simplify=False, opset=12, workspace=4, nms=False):
    """
    Minimal export function stub.
    This is a placeholder - actual export functionality would require full implementation.
    """
    # For now, just return the weights path if it's a .pt file
    weights_path = Path(weights)
    if weights_path.suffix == '.pt':
        return [str(weights_path)]
    return []


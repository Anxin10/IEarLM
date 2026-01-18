#!/usr/bin/env python3
"""
提取 Word 模板中的變數並生成標記版本（不使用 docxtpl）
"""
import sys
import os
import zipfile
import re
from pathlib import Path

def extract_template_variables_from_docx(docx_path: str):
    """從 Word 文件中提取所有 Jinja2 變數"""
    variables = set()
    
    try:
        with zipfile.ZipFile(docx_path, 'r') as z:
            # 讀取主文檔 XML
            doc_xml = z.read('word/document.xml').decode('utf-8')
            
            # 查找所有 {{ variable }} 格式的變數
            # 匹配 {{ variable }} 或 {{ variable.field }} 等複雜表達式
            pattern = r'\{\{([^}]+)\}\}'
            matches = re.findall(pattern, doc_xml)
            
            for match in matches:
                var = match.strip()
                # 清理變數名（移除空白和特殊字符）
                if var:
                    # 處理 Jinja2 語法，提取變數名
                    # 例如: {{ var.field }} -> var.field, {{ var|filter }} -> var
                    var_base = var.split('|')[0].split('.')[0].strip()
                    if var_base and not var_base.startswith('#'):  # 排除註釋
                        variables.add(var)
            
            # 也檢查 header 和 footer
            for name in z.namelist():
                if 'header' in name or 'footer' in name:
                    try:
                        content = z.read(name).decode('utf-8')
                        matches = re.findall(pattern, content)
                        for match in matches:
                            var = match.strip()
                            if var:
                                var_base = var.split('|')[0].split('.')[0].strip()
                                if var_base and not var_base.startswith('#'):
                                    variables.add(var)
                    except:
                        pass
    except Exception as e:
        print(f"Error reading docx file: {e}")
        return []
    
    return sorted(list(variables))

def create_marked_context(variables):
    """創建帶有編號標記的上下文字典"""
    context = {}
    for i, var in enumerate(variables, 1):
        # 為每個變數創建一個編號標記
        context[var] = f"[變數#{i}: {var}]"
    return context

def main():
    template_dir = Path(__file__).parent
    template_file = template_dir / "report_data" / "ENT_Clinic_Record_Design_Portrait_Fixed.docx"
    output_vars_file = template_dir / "report_data" / "template_variables_list.txt"
    
    if not template_file.exists():
        print(f"錯誤: 找不到模板文件: {template_file}")
        sys.exit(1)
    
    print(f"讀取模板文件: {template_file}")
    
    try:
        # 提取變數
        variables = extract_template_variables_from_docx(str(template_file))
        print(f"\n找到 {len(variables)} 個變數：\n")
        
        # 保存變數列表
        with open(output_vars_file, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("Word 模板變數列表\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"總共找到 {len(variables)} 個變數\n\n")
            f.write("變數列表（按字母順序）：\n")
            f.write("-" * 60 + "\n")
            for i, var in enumerate(variables, 1):
                f.write(f"{i:3d}. {var}\n")
        
        print("變數列表（帶編號）：")
        print("-" * 60)
        for i, var in enumerate(variables, 1):
            print(f"{i:3d}. {var}")
        
        print(f"\n✓ 變數列表已保存到: {output_vars_file}")
        print("\n提示：請告訴我每個變數對應的數據內容，我會更新代碼以正確填充。")
        
    except Exception as e:
        print(f"錯誤: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()

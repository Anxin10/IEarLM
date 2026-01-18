#!/usr/bin/env python3
"""
生成帶有編號標記的模板示例（使用現有的 ReportGenerator）
"""
import sys
import os
from pathlib import Path

# 添加當前目錄到路徑
sys.path.insert(0, os.path.dirname(__file__))

try:
    from report_generator import ReportGenerator
    from extract_template_vars import extract_template_variables_from_docx
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)

def main():
    # 檢查模板文件位置
    template_dir = Path(__file__).parent
    template_in_report_data = template_dir / "report_data" / "ENT_Clinic_Record_Design_Portrait_Fixed.docx"
    template_in_templates = template_dir / "templates" / "ENT_Clinic_Record_Design_Portrait_Fixed.docx"
    
    # 確定模板文件位置
    if template_in_report_data.exists():
        actual_template_path = template_in_report_data
        # 需要複製到 templates 目錄（如果 ReportGenerator 期望在那裡）
        if not template_in_templates.exists():
            import shutil
            template_in_templates.parent.mkdir(exist_ok=True)
            shutil.copy2(actual_template_path, template_in_templates)
            print(f"已複製模板文件到: {template_in_templates}")
    elif template_in_templates.exists():
        actual_template_path = template_in_templates
    else:
        print(f"錯誤: 找不到模板文件")
        print(f"  檢查位置 1: {template_in_report_data}")
        print(f"  檢查位置 2: {template_in_templates}")
        sys.exit(1)
    
    print(f"使用模板文件: {actual_template_path}")
    
    # 提取變數
    variables = extract_template_variables_from_docx(str(actual_template_path))
    print(f"\n找到 {len(variables)} 個變數")
    
    # 創建標記數據
    marked_data = {}
    for i, var in enumerate(sorted(variables), 1):
        marked_data[var] = f"[變數#{i}: {var}]"
    
    # 使用 ReportGenerator 生成標記版本
    output_dir = template_dir / "output_reports"
    save_dir = template_dir / "saved_reports"
    
    generator = ReportGenerator(
        template_dir=str(template_dir / "templates"),
        output_dir=str(output_dir),
        save_dir=str(save_dir)
    )
    
    try:
        # 生成標記版本
        result = generator.generate(
            template_name="ENT_Clinic_Record_Design_Portrait_Fixed",
            data=marked_data,
            output_format="both"  # 同時生成 docx 和 pdf
        )
        
        print(f"\n✓ 標記版本已生成:")
        if "docx" in result:
            print(f"  Word: {result['docx']}")
        if "pdf" in result:
            print(f"  PDF: {result['pdf']}")
        
        # 也保存變數列表
        vars_file = template_dir / "report_data" / "template_variables_list.txt"
        with open(vars_file, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("Word 模板變數列表（帶編號）\n")
            f.write("=" * 60 + "\n\n")
            for i, var in enumerate(sorted(variables), 1):
                f.write(f"{i:3d}. {var}\n")
        print(f"\n✓ 變數列表已保存: {vars_file}")
        
    except Exception as e:
        print(f"錯誤生成標記版本: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()


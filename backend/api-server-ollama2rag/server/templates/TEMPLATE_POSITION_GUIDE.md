# Word 模板位置標記指南

由於模板文件可能使用不同的格式，請按照以下步驟進行標記：

## 步驟 1: 打開 Word 模板文件

文件位置: `report_data/ENT_Clinic_Record_Design_Portrait_Fixed.docx`

## 步驟 2: 在每個需要填充的位置添加變數標記

根據您之前提到的字段，請在 Word 文件的對應位置添加以下標記：

### 基本信息區域

1. **病歷號碼** - 添加: `{{ patient_id }}`
2. **姓名** - 添加: `{{ patient_name }}`
3. **就診日期（年）** - 添加: `{{ visit_year }}`
4. **就診日期（月）** - 添加: `{{ visit_month }}`
5. **就診日期（日）** - 添加: `{{ visit_day }}`
6. **主治醫師** - 添加: `{{ doctor_name }}`

### 右耳區域

7. **右耳耳道** - 添加: `{{ right_ear_eac }}`
8. **右耳耳膜** - 添加: `{{ right_ear_tm }}`
9. **右耳耳膜百分比** - 添加: `{{ right_ear_tm_percent }}`

### 左耳區域

10. **左耳耳道** - 添加: `{{ left_ear_eac }}`
11. **左耳耳膜** - 添加: `{{ left_ear_tm }}`
12. **左耳耳膜百分比** - 添加: `{{ left_ear_tm_percent }}`

### 診斷區域

13. **綜合診斷** - 添加: `{{ diagnosis }}`
14. **醫囑** - 添加: `{{ orders }}`

## 步驟 3: 保存標記後的模板

保存後，請將文件複製到 `templates/` 目錄（如果還沒有）

## 步驟 4: 告訴我每個位置對應的數據

請告訴我每個變數應該填充什麼數據，例如：

- `patient_id` → 患者 ID（例如：P-2023-001）
- `patient_name` → 患者姓名
- `visit_year` → 就診年份（例如：2023）
- `visit_month` → 就診月份（例如：10）
- `visit_day` → 就診日期（例如：15）
- `doctor_name` → 主治醫師姓名
- `right_ear_eac` → 右耳耳道描述
- `right_ear_tm` → 右耳耳膜描述
- `right_ear_tm_percent` → 右耳耳膜百分比（數字）
- `left_ear_eac` → 左耳耳道描述
- `left_ear_tm` → 左耳耳膜描述
- `left_ear_tm_percent` → 左耳耳膜百分比（數字）
- `diagnosis` → 診斷結果
- `orders` → 醫囑內容

## 替代方案

如果模板已經有預設的變數名稱（不是 {{ variable }} 格式），請告訴我：
1. 模板中實際使用的變數名稱是什麼
2. 每個變數應該對應到哪個數據字段

這樣我就可以更新代碼來正確填充模板。


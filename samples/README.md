# Sample Files for Testing

This directory contains sample Excel files for testing the application.

## Files

### 1. sample_template.xlsx
A sample template file with the required structure:
- SURVEYOR
- VARIANT DESCRIPTION  
- QUANTITY (in M)
- Other columns (preserved during processing)

### 2. sample_sales.xlsx
A sample sales file with the required structure:
- DS Name
- Market SKU
- Invoice Qty

## How to Use

1. **Test Template Upload**:
   - Login as a user
   - Upload `sample_template.xlsx` as your template

2. **Test Sales Processing**:
   - Upload `sample_sales.xlsx` as your sales file
   - Map DS Names to SURVEYORs
   - Download the processed file

3. **Test SKU Mapping** (Admin):
   - Login as admin
   - Go to SKU Mapping tab
   - Add mappings for the Market SKUs in the sample sales file

## Creating Your Own Test Files

### Template File Requirements:
- Must be .xlsx or .xls format
- Must contain these exact column names:
  - `SURVEYOR`
  - `VARIANT DESCRIPTION`
  - `QUANTITY (in M)`
- Can contain additional columns (they will be preserved)

### Sales File Requirements:
- Must be .xlsx or .xls format
- Must contain these exact column names:
  - `DS Name`
  - `Market SKU`
  - `Invoice Qty`
- Invoice Qty must be numeric
- Blank rows and zero quantities will be ignored

## Sample Data

### Sample Template Data:
```
SURVEYOR | VARIANT DESCRIPTION | QUANTITY (in M) | Region | Territory
---------|---------------------|-----------------|--------|----------
John     | Product A           | 0               | North  | T1
John     | Product B           | 0               | North  | T1
Mary     | Product A           | 0               | South  | T2
Mary     | Product C           | 0               | South  | T2
```

### Sample Sales Data:
```
DS Name | Market SKU | Invoice Qty
--------|------------|------------
John    | SKU001     | 100
John    | SKU002     | 50
Mary    | SKU001     | 75
Mary    | SKU003     | 120
```

### Sample SKU Mappings (Admin should create):
```
Market SKU | VARIANT DESCRIPTION
-----------|--------------------
SKU001     | Product A
SKU002     | Product B
SKU003     | Product C
```

### Expected Output:
After processing with the above data and mappings:
```
SURVEYOR | VARIANT DESCRIPTION | QUANTITY (in M) | Region | Territory
---------|---------------------|-----------------|--------|----------
John     | Product A           | 100             | North  | T1
John     | Product B           | 50              | North  | T1
Mary     | Product A           | 75              | South  | T2
Mary     | Product C           | 120             | South  | T2
```

Note: Only the "QUANTITY (in M)" column is updated. All other columns remain unchanged.

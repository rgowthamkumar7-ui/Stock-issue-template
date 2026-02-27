import * as XLSX from 'xlsx';
import { SalesFileRow, TemplateRow, SalesSummaryData, DSMappingData, SKUMapping } from './types';

/**
 * Helper to normalize string (trim whitespace)
 */
const normalize = (str: any): string => String(str || '').replace(/\s+/g, ' ').trim();

/**
 * Parse sales file and return cleaned data
 */
export function parseSalesFile(file: File): Promise<SalesFileRow[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

                const rawRows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });
                const requiredColumns = ['DS Name', 'Market SKU', 'Invoice Qty'];

                // Find header row with permissive matching
                let headerRowIndex = -1;
                let headerMap: Record<string, number> = {}; // Map normalized col name to index

                for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
                    const row = rawRows[i];
                    if (!row || !Array.isArray(row)) continue;

                    const normalizedRow = row.map(cell => normalize(cell));

                    // Check if all required columns exist in this row
                    const hasAll = requiredColumns.every(req => normalizedRow.includes(req));

                    if (hasAll) {
                        headerRowIndex = i;
                        // Build index map
                        normalizedRow.forEach((name, idx) => {
                            headerMap[name] = idx;
                        });
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    throw new Error(`Could not find header row. Required columns: ${requiredColumns.join(', ')}`);
                }

                // Process data rows
                const cleanData: SalesFileRow[] = [];
                for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
                    const row = rawRows[i];
                    if (!row || row.length === 0) continue;

                    const dsName = row[headerMap['DS Name']];
                    const marketSku = row[headerMap['Market SKU']];
                    const invoiceQty = row[headerMap['Invoice Qty']];

                    if (dsName && marketSku) {
                        // Only add if we have valid identifiers
                        const qty = typeof invoiceQty === 'number' ? invoiceQty : parseFloat(invoiceQty) || 0;
                        if (qty !== 0) {
                            cleanData.push({
                                'DS Name': String(dsName).trim(),
                                'Market SKU': String(marketSku).trim(),
                                'Invoice Qty': qty
                            });
                        }
                    }
                }

                if (cleanData.length === 0 && rawRows.length > headerRowIndex + 1) {
                    console.warn("Parsed rows but filtered all out.");
                }

                resolve(cleanData);
            } catch (error) {
                reject(new Error('Failed to parse sales file: ' + (error as Error).message));
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Summarize sales data by DS Name and Market SKU
 */
export function summarizeSalesData(salesData: SalesFileRow[]): SalesSummaryData[] {
    const summaryMap = new Map<string, SalesSummaryData>();

    salesData.forEach((row) => {
        const key = `${row['DS Name']}|${row['Market SKU']}`;

        if (summaryMap.has(key)) {
            const existing = summaryMap.get(key)!;
            existing.total_qty += row['Invoice Qty'];
        } else {
            summaryMap.set(key, {
                ds_name: row['DS Name'],
                market_sku: row['Market SKU'],
                total_qty: row['Invoice Qty'],
            });
        }
    });

    return Array.from(summaryMap.values());
}

/**
 * Parse template file and extract data
 */
export function parseTemplateFile(file: File): Promise<{
    data: TemplateRow[];
    workbook: XLSX.WorkBook;
    sheetName: string;
    headers: string[];
}> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const firstSheet = workbook.Sheets[sheetName];

                const rawRows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });
                const requiredColumns = ['SURVEYOR', 'VARIANT DESCRIPTION', 'QUANTITY (in M)'];

                // Find header row
                let headerRowIndex = -1;
                for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
                    const row = rawRows[i];
                    if (!row || !Array.isArray(row)) continue;

                    const normalizedRow = row.map(cell => normalize(cell));
                    const hasAll = requiredColumns.every(req => normalizedRow.includes(req));

                    if (hasAll) {
                        headerRowIndex = i;
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    throw new Error(`Template must contain columns: ${requiredColumns.join(', ')}`);
                }

                // Extract original headers (normalized) to preserve order
                const headers = (rawRows[headerRowIndex] as any[]).map(cell => normalize(cell));

                // Parse using simple sheet_to_json with range
                // Then normalize keys
                const jsonData = XLSX.utils.sheet_to_json<any>(firstSheet, { range: headerRowIndex });

                const cleanedData: TemplateRow[] = jsonData.map(row => {
                    const newRow: any = {};
                    Object.keys(row).forEach(key => {
                        const newKey = normalize(key);
                        newRow[newKey] = row[key];
                    });
                    return newRow as TemplateRow;
                });

                resolve({ data: cleanedData, workbook, sheetName, headers });
            } catch (error) {
                reject(new Error('Failed to parse template file: ' + (error as Error).message));
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Extract unique SURVEYOR values from template
 */
export function extractSurveyors(templateData: TemplateRow[]): string[] {
    const surveyors = new Set<string>();
    templateData.forEach((row) => {
        if (row.SURVEYOR) {
            surveyors.add(String(row.SURVEYOR).trim());
        }
    });
    return Array.from(surveyors).sort();
}

/**
 * Extract unique VARIANT DESCRIPTION values from template
 */
export function extractVariantDescriptions(templateData: TemplateRow[]): string[] {
    const variants = new Set<string>();
    templateData.forEach((row) => {
        if (row['VARIANT DESCRIPTION']) {
            variants.add(String(row['VARIANT DESCRIPTION']).trim());
        }
    });
    return Array.from(variants).sort();
}

/**
 * Check for unmapped SKUs
 */
export function findUnmappedSKUs(
    salesSummary: SalesSummaryData[],
    skuMappings: SKUMapping[]
): string[] {
    const mappedSKUs = new Set(skuMappings.map((m) => String(m.market_sku).trim().toUpperCase()));
    const unmappedSKUs = new Set<string>();

    salesSummary.forEach((sale) => {
        const normalizedSaleSku = String(sale.market_sku).trim().toUpperCase();
        if (!mappedSKUs.has(normalizedSaleSku)) {
            unmappedSKUs.add(sale.market_sku);
        }
    });

    return Array.from(unmappedSKUs).sort();
}

/**
 * Update template with sales data
 */
export function updateTemplate(
    templateData: TemplateRow[],
    salesSummary: SalesSummaryData[],
    skuMappings: SKUMapping[],
    dsMapping: DSMappingData[]
): TemplateRow[] {
    // Create mapping lookup objects
    const skuMap = new Map<string, Set<string>>(); // market_sku -> Set of variant_descriptions
    skuMappings.forEach((mapping) => {
        if (!skuMap.has(mapping.market_sku)) {
            skuMap.set(mapping.market_sku, new Set());
        }
        skuMap.get(mapping.market_sku)!.add(mapping.variant_description);
    });

    const dsMap = new Map<string, string>(); // ds_name -> surveyor_name
    dsMapping.forEach((mapping) => {
        dsMap.set(mapping.ds_name, mapping.surveyor_name);
    });

    // Create sales lookup: surveyor + variant_description -> total_qty
    const salesLookup = new Map<string, number>();
    salesSummary.forEach((sale) => {
        const surveyor = dsMap.get(sale.ds_name);
        if (!surveyor) return; // Skip if DS not mapped

        const variants = skuMap.get(sale.market_sku);
        if (!variants) return; // Skip if SKU not mapped

        variants.forEach((variant) => {
            const key = `${surveyor}|${variant}`;
            const existing = salesLookup.get(key) || 0;
            salesLookup.set(key, existing + sale.total_qty);
        });
    });

    // Update template rows
    const updatedData = templateData.map((row) => {
        const surveyor = String(row.SURVEYOR || '').trim();
        const variant = String(row['VARIANT DESCRIPTION'] || '').trim();
        const key = `${surveyor}|${variant}`;

        const quantity = salesLookup.get(key) || 0;

        return {
            ...row,
            'QUANTITY (in M)': quantity,
        };
    });

    return updatedData;
}

/**
 * Generate output Excel file with updated data
 */
export function generateOutputFile(
    originalWorkbook: XLSX.WorkBook,
    sheetName: string,
    updatedData: TemplateRow[],
    outputFileName: string,
    headers?: string[]
): Blob {
    // Create a new worksheet from updated data
    // Use headers option to preserve column order
    const options = headers ? { header: headers } : undefined;
    const newSheet = XLSX.utils.json_to_sheet(updatedData, options);

    // Generate CSV string
    const csvOutput = XLSX.utils.sheet_to_csv(newSheet);

    // Return as CSV Blob
    return new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Download file to user's computer
 */
export function downloadFile(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Validate sales file structure
 */
export function validateSalesFile(data: any[]): { valid: boolean; error?: string } {
    if (!data || data.length === 0) {
        return { valid: false, error: 'Sales file is empty' };
    }

    const firstRow = data[0];
    const requiredColumns = ['DS Name', 'Market SKU', 'Invoice Qty'];
    const missingColumns = requiredColumns.filter((col) => !(col in firstRow));

    if (missingColumns.length > 0) {
        return {
            valid: false,
            error: `Missing required columns: ${missingColumns.join(', ')}`,
        };
    }

    return { valid: true };
}

/**
 * Validate template file structure
 */
export function validateTemplateFile(data: any[]): { valid: boolean; error?: string } {
    if (!data || data.length === 0) {
        return { valid: false, error: 'Template file is empty' };
    }

    const firstRow = data[0];
    const requiredColumns = ['SURVEYOR', 'VARIANT DESCRIPTION', 'QUANTITY (in M)'];
    const missingColumns = requiredColumns.filter((col) => !(col in firstRow));

    if (missingColumns.length > 0) {
        return {
            valid: false,
            error: `Missing required columns: ${missingColumns.join(', ')}`,
        };
    }

    return { valid: true };
}

// Database Types
export interface User {
    id: string;
    username: string;
    role: 'admin' | 'user';
    status: 'active' | 'disabled';
    created_at: string;
    updated_at: string;
}

export interface UserTemplate {
    id: string;
    user_id: string;
    file_name: string;
    file_path: string;
    upload_date: string;
    created_at: string;
}

export interface SKUMapping {
    id: string;
    market_sku: string;
    variant_description: string;
    created_at: string;
    created_by?: string | null;
}

export interface UploadHistory {
    id: string;
    user_id: string;
    sales_file_name: string;
    sales_file_path: string;
    template_file_name: string;
    output_file_name: string;
    output_file_path: string;
    upload_date: string;
    status: 'processing' | 'completed' | 'failed';
    error_message?: string;
}

export interface SalesSummary {
    id: string;
    upload_id: string;
    ds_name: string;
    market_sku: string;
    total_qty: number;
    created_at: string;
}

export interface SalesmanMapping {
    id: string;
    upload_id: string;
    ds_name: string;
    surveyor_name: string;
    created_at: string;
}

// Excel Processing Types
export interface SalesFileRow {
    'DS Name': string;
    'Market SKU': string;
    'Invoice Qty': number;
}

export interface TemplateRow {
    SURVEYOR: string;
    'VARIANT DESCRIPTION': string;
    'QUANTITY (in M)': number;
    [key: string]: any; // Allow other columns
}

export interface SalesSummaryData {
    ds_name: string;
    market_sku: string;
    total_qty: number;
}

export interface DSMappingData {
    ds_name: string;
    surveyor_name: string;
}

// UI Types
export interface MappingPopupData {
    unmappedSKUs: string[];
    dsNames: string[];
    surveyorOptions: string[];
}

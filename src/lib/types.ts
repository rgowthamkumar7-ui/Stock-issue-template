// Database Types
export interface UserAccessPermissions {
    stock_issue?: boolean;
    mdo?: boolean;
    qcommerce?: boolean;
}

export interface User {
    id: string;
    username: string;
    role: 'admin' | 'user' | 'manager';
    status: 'active' | 'disabled';
    created_at: string;
    updated_at: string;
    wd_code?: string;
    wd_name?: string;
    manager_id?: string;
    access_permissions?: UserAccessPermissions;
}

// Manager types
export interface ManagerWD {
    id: string;
    name: string;          // Distributor/WD name
    code: string;          // WD code
    manager_id: string;
}

export interface WDOrderSummary {
    wd_id: string;
    wd_name: string;
    wd_code: string;
    total_orders: number;
    total_qty_ms: number;
    total_amount: number;
    remitted_amount: number;
    pending_remittance: number;
    last_order_date: string | null;
    has_ordered: boolean;
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

// MDO Types
export interface MDOSkuItem {
    sku: string;
    skuLabel: string;
    quantityMs: number;
    pricePerMs: number;
}

export interface MDOOrder {
    id: string;
    user_id: string;
    items: MDOSkuItem[];
    total_qty_ms: number;
    total_amount: number;
    status: 'pending' | 'confirmed' | 'cancelled';
    remittance_confirmed: boolean;
    created_at: string;
    month: string; // YYYY-MM
}

export interface MDOSkuCatalog {
    sku: string;
    label: string;
    pricePerMs: number;
}

// Q-Commerce Types
export type POStatus = 'open' | 'delivered' | 'cancelled' | 'expired' | 'closed';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface POLineItem {
    sku_code: string;
    sku_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    delivered_quantity?: number;
    delivered_value?: number;
}

export interface PurchaseOrder {
    id: string;
    po_number: string;
    po_date: string;
    expiry_date: string;
    planned_appointment_date: string;
    po_amount: number;
    delivered_amount?: number;
    po_status: POStatus;
    payment_status: PaymentStatus;
    supplier_name: string;
    notes?: string;
    line_items: POLineItem[];
    created_by: string;
    created_at: string;
    updated_at: string;
}

// UI Types
export interface MappingPopupData {
    unmappedSKUs: string[];
    dsNames: string[];
    surveyorOptions: string[];
}

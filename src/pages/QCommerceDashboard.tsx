import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Layout } from '../components/shared/Layout';
import { useAuthStore } from '../stores/authStore';
import { useQCommerceStore, MSKUMapEntry } from '../stores/qcommerceStore';
import { PurchaseOrder, POStatus, PaymentStatus, POLineItem } from '../lib/types';
import { useNavigate } from 'react-router-dom';

// --- CSV parser for msku_match_result.csv (SkuDesc, market_sku) ---------------
const parseMSKUCSV = (text: string): MSKUMapEntry[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    const skuDescIdx = headers.findIndex(h => h.toLowerCase() === 'skudesc');
    const marketSkuIdx = headers.findIndex(h => h.toLowerCase() === 'market_sku');
    if (skuDescIdx === -1 || marketSkuIdx === -1) return [];
    const result: MSKUMapEntry[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals: string[] = [];
        let inQ = false, cur = '';
        for (let c = 0; c < line.length; c++) {
            const ch = line[c];
            if (ch === '"') { inQ = !inQ; }
            else if (ch === ',' && !inQ) { vals.push(cur); cur = ''; }
            else { cur += ch; }
        }
        vals.push(cur);
        const skuDesc = (vals[skuDescIdx] ?? '').trim();
        const marketSku = (vals[marketSkuIdx] ?? '').trim();
        if (skuDesc) result.push({ skuDesc, marketSku });
    }
    return result;
};

// --- Bill row type from Bill.xlsx (row 11 = headers, data from row 12) --------
interface BillRow {
    marketSku: string;
    itemName: string;
    invoiceQty: number;
    total: number;
}

const parseBillXLSX = (buffer: ArrayBuffer): BillRow[] => {
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    // Find header row by looking for 'Market SKU' column
    let headerRowIdx = -1;
    let colMarketSku = -1, colItemName = -1, colInvoiceQty = -1, colTotal = -1;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as string[];
        const mIdx = row.findIndex(c => String(c).trim() === 'Market SKU');
        if (mIdx !== -1) {
            headerRowIdx = i;
            colMarketSku = mIdx;
            colItemName = row.findIndex(c => String(c).trim() === 'Item Name');
            colInvoiceQty = row.findIndex(c => String(c).trim() === 'Invoice Qty');
            colTotal = row.findIndex(c => String(c).trim() === 'Total');
            break;
        }
    }
    if (headerRowIdx === -1) return [];
    const result: BillRow[] = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        const msku = String(r[colMarketSku] ?? '').trim();
        if (!msku) continue;
        result.push({
            marketSku: msku,
            itemName: String(r[colItemName] ?? '').trim(),
            invoiceQty: Number(r[colInvoiceQty]) || 0,
            total: Number(r[colTotal]) || 0,
        });
    }
    return result;
};

// Aggregate bill rows by marketSku
const aggregateBill = (rows: BillRow[]): Map<string, { qty: number; total: number; itemName: string }> => {
    const map = new Map<string, { qty: number; total: number; itemName: string }>();
    rows.forEach(r => {
        const existing = map.get(r.marketSku);
        if (existing) {
            existing.qty += r.invoiceQty;
            existing.total += r.total;
        } else {
            map.set(r.marketSku, { qty: r.invoiceQty, total: r.total, itemName: r.itemName });
        }
    });
    return map;
};

// --- Status helpers ------------------------------------------------------------
const PO_STATUS_META: Record<POStatus, { label: string; color: string }> = {
    open: { label: 'Open', color: 'bg-indigo-100 text-indigo-700' },
    delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-600' },
    expired: { label: 'Expired', color: 'bg-red-100 text-red-600' },
    closed: { label: 'Closed', color: 'bg-teal-100 text-teal-700' },
};
const PAYMENT_META: Record<PaymentStatus, { label: string; color: string }> = {
    unpaid: { label: 'Unpaid', color: 'bg-red-100 text-red-600' },
    partial: { label: 'Partial', color: 'bg-amber-100 text-amber-700' },
    paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
};

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fdate = (s: string) =>
    s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// --- Upload PO Modal -----------------------------------------------------------
/** Parse a date-time string like "2026-02-27 18:09:34" → "2026-02-27" */
const parseISODate = (raw: string): string => {
    if (!raw) return '';
    const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
};

/** Parse CSV text → array of header-keyed objects (handles simple quoted fields) */
const parseCSVRows = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    const result: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals: string[] = [];
        let inQ = false, cur = '';
        for (let c = 0; c < line.length; c++) {
            const ch = line[c];
            if (ch === '"') { inQ = !inQ; }
            else if (ch === ',' && !inQ) { vals.push(cur); cur = ''; }
            else { cur += ch; }
        }
        vals.push(cur);
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => { obj[h] = (vals[idx] ?? '').trim(); });
        result.push(obj);
    }
    return result;
};

interface UploadModalProps {
    onClose: () => void;
    onSave: (po: PurchaseOrder) => void;
    userId: string;
}

const EMPTY_LINE: POLineItem = { sku_code: '', sku_name: '', quantity: 0, unit_price: 0, total: 0 };

const UploadPOModal: React.FC<UploadModalProps> = ({ onClose, onSave, userId }) => {
    const [form, setForm] = useState({
        po_number: '',
        po_date: new Date().toISOString().split('T')[0],
        expiry_date: '',
        planned_appointment_date: '',
        supplier_name: '',
        notes: '',
        payment_status: 'unpaid' as PaymentStatus,
    });
    const [lines, setLines] = useState<POLineItem[]>([{ ...EMPTY_LINE }]);
    const [error, setError] = useState('');
    const [fileUploaded, setFileUploaded] = useState<string>('');
    const [autoFilled, setAutoFilled] = useState(false);
    const [parsedPoAmount, setParsedPoAmount] = useState<number | null>(null);

    const updateLine = (i: number, field: keyof POLineItem, val: string | number) => {
        const updated = [...lines];
        (updated[i] as any)[field] = val;
        updated[i].total = updated[i].quantity * updated[i].unit_price;
        setLines(updated);
    };

    const totalAmount = parsedPoAmount ?? lines.reduce((s, l) => s + l.total, 0);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileUploaded(file.name);
        setError('');
        setAutoFilled(false);
        setParsedPoAmount(null);

        const isCSV = file.name.toLowerCase().endsWith('.csv');

        if (isCSV) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const records = parseCSVRows(ev.target?.result as string);
                    if (records.length === 0) { setError('CSV appears empty or malformed.'); return; }
                    const first = records[0];
                    // Detect Q-Commerce / Zepto format by presence of named headers
                    const isQCom = 'PoNumber' in first && 'MaterialCode' in first;
                    if (isQCom) {
                        const poDate  = parseISODate(first['PoDate'] || '');
                        const expiry  = parseISODate(first['PoExpiryDate'] || '');
                        const vendor  = first['VendorName'] || '';
                        const store   = first['StoreName'] || '';
                        const supplier = vendor ? `${vendor} (${store})` : store;
                        const delivery = first['DeliveryLocation'] || '';
                        const poTotal  = parseFloat(first['PoTotalAmount'] || '0') || null;
                        setForm(f => ({
                            ...f,
                            po_number: first['PoNumber'] || '',
                            po_date: poDate,
                            expiry_date: expiry,
                            supplier_name: supplier,
                            notes: delivery ? `Delivery Location: ${delivery}` : '',
                        }));
                        if (poTotal) setParsedPoAmount(poTotal);
                        setAutoFilled(true);
                        const parsed = records.map(r => {
                            const qty   = parseFloat(r['Quantity'] || '0') || 0;
                            const price = parseFloat(r['LandingCost'] || '0') || 0;
                            const total = parseFloat(r['TotalAmount'] || '0') || qty * price;
                            return { sku_code: r['MaterialCode'] || '', sku_name: r['SkuDesc'] || '', quantity: qty, unit_price: price, total };
                        }).filter(l => l.sku_code || l.sku_name);
                        if (parsed.length > 0) setLines(parsed);
                    } else {
                        // Generic CSV: columns → SKU Code | SKU Name | Qty | Unit Price
                        const parsed = records.map(r => {
                            const vals = Object.values(r);
                            const qty = parseFloat(vals[2] || '0') || 0;
                            const price = parseFloat(vals[3] || '0') || 0;
                            return { sku_code: vals[0] || '', sku_name: vals[1] || '', quantity: qty, unit_price: price, total: qty * price };
                        }).filter(l => l.sku_code || l.sku_name);
                        if (parsed.length > 0) setLines(parsed);
                    }
                } catch {
                    setError('Could not parse the CSV file. Please check the format.');
                }
            };
            reader.readAsText(file);
        } else {
            // Excel file – use XLSX
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const wb = XLSX.read(ev.target?.result as ArrayBuffer, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                    const parsed: POLineItem[] = [];
                    for (let i = 1; i < rows.length; i++) {
                        const r = rows[i];
                        if (!r[0] && !r[1]) continue;
                        parsed.push({ sku_code: String(r[0] ?? ''), sku_name: String(r[1] ?? ''), quantity: Number(r[2]) || 0, unit_price: Number(r[3]) || 0, total: (Number(r[2]) || 0) * (Number(r[3]) || 0) });
                    }
                    if (parsed.length > 0) setLines(parsed);
                } catch {
                    setError('Could not parse the uploaded Excel file.');
                }
            };
            reader.readAsArrayBuffer(file);
        }
    };

    const handleSubmit = () => {
        if (!form.po_number || !form.po_date || !form.expiry_date || !form.supplier_name) {
            setError('Please fill all required fields (PO Number, PO Date, Expiry Date, Supplier).');
            return;
        }
        if (lines.every((l) => !l.sku_code && !l.sku_name)) {
            setError('Please add at least one line item.');
            return;
        }
        const po: PurchaseOrder = {
            id: `po-${Date.now()}`,
            ...form,
            po_amount: totalAmount,
            po_status: 'open',
            line_items: lines.filter((l) => l.sku_code || l.sku_name),
            created_by: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        onSave(po);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-4">
                <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-t-3xl px-6 py-5 flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-bold text-xl">New Purchase Order</h3>
                        <p className="text-violet-200 text-sm mt-0.5">Fill in PO details or upload an Excel file</p>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="border-2 border-dashed border-violet-200 rounded-2xl p-5 bg-violet-50 flex flex-col items-center gap-2 text-center">
                        <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm font-semibold text-violet-700">Upload Q-Commerce PO (CSV / Excel)</p>
                        <p className="text-xs text-violet-500 leading-relaxed max-w-sm">
                            <strong>Q-Commerce CSV</strong>: auto-fills all fields from <span className="font-mono">PoNumber, PoDate, PoExpiryDate, VendorName, MaterialCode, Quantity, LandingCost</span> columns<br/>
                            <strong>Generic Excel</strong>: columns → SKU Code | SKU Name | Qty | Unit Price
                        </p>
                        <label className="cursor-pointer mt-1">
                            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
                            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors">
                                Browse File
                            </span>
                        </label>
                        {fileUploaded && (
                            <p className="text-xs text-green-600 font-semibold mt-1">✓ {fileUploaded} loaded</p>
                        )}
                    </div>

                    {/* Auto-fill success banner */}
                    {autoFilled && (
                        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                            <svg className="w-5 h-5 text-green-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-sm font-bold text-green-800">Q-Commerce format detected — all fields auto-filled!</p>
                                <p className="text-xs text-green-700 mt-0.5">PO Number, dates, supplier and {lines.length} line items have been populated from the CSV. Review and adjust below if needed.</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { label: 'PO Number *', key: 'po_number', type: 'text', placeholder: 'e.g. PO-2026-0001' },
                            { label: 'Supplier / Platform *', key: 'supplier_name', type: 'text', placeholder: 'e.g. Blinkit, Zepto' },
                            { label: 'PO Date *', key: 'po_date', type: 'date', placeholder: '' },
                            { label: 'Expiry Date *', key: 'expiry_date', type: 'date', placeholder: '' },
                            { label: 'Planned Appointment Date', key: 'planned_appointment_date', type: 'date', placeholder: '' },
                        ].map(({ label, key, type, placeholder }) => (
                            <div key={key}>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                                <input
                                    type={type}
                                    placeholder={placeholder}
                                    value={(form as any)[key]}
                                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                                    className={`w-full px-3 py-2.5 rounded-xl border text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition-all ${autoFilled && (form as any)[key] ? 'bg-green-50 border-green-300' : 'bg-slate-50 border-slate-200'}`}
                                />
                            </div>
                        ))}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Status</label>
                            <select
                                value={form.payment_status}
                                onChange={(e) => setForm({ ...form, payment_status: e.target.value as PaymentStatus })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all"
                            >
                                <option value="unpaid">Unpaid</option>
                                <option value="partial">Partial</option>
                                <option value="paid">Paid</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                        <textarea
                            rows={2}
                            placeholder="Optional remarks..."
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all resize-none"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-bold text-slate-700">
                                Line Items
                                {lines.length > 1 && <span className="ml-2 text-xs font-semibold text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full">{lines.length} items</span>}
                            </p>
                            <button
                                onClick={() => setLines([...lines, { ...EMPTY_LINE }])}
                                className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Row
                            </button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {lines.map((line, i) => (
                                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                    <input placeholder="SKU Code" value={line.sku_code} onChange={(e) => updateLine(i, 'sku_code', e.target.value)}
                                        className="col-span-2 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-300" />
                                    <input placeholder="SKU Name" value={line.sku_name} onChange={(e) => updateLine(i, 'sku_name', e.target.value)}
                                        className="col-span-4 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-300" />
                                    <input placeholder="Qty" type="number" value={line.quantity || ''} onChange={(e) => updateLine(i, 'quantity', Number(e.target.value))}
                                        className="col-span-2 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-300" />
                                    <input placeholder="Unit ₹" type="number" value={line.unit_price || ''} onChange={(e) => updateLine(i, 'unit_price', Number(e.target.value))}
                                        className="col-span-2 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-300" />
                                    <span className="col-span-1 text-xs text-slate-500 font-semibold text-right">{fmt(line.total)}</span>
                                    <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="col-span-1 flex justify-center text-red-400 hover:text-red-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 flex justify-end items-center gap-4">
                            {parsedPoAmount !== null && (
                                <span className="text-xs text-green-700 font-semibold bg-green-50 px-2.5 py-1 rounded-lg border border-green-200">
                                    PO Total (from CSV): {fmt(parsedPoAmount)}
                                </span>
                            )}
                            <span className="text-sm font-bold text-slate-700">Total: <span className="text-violet-600">{fmt(totalAmount)}</span></span>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleSubmit}
                            className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold shadow-md shadow-violet-200 hover:shadow-lg hover:scale-[1.02] transition-all"
                        >
                            Create Purchase Order
                        </button>
                        <button onClick={onClose} className="py-3 px-6 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- PO Action Modal (unified hub) --------------------------------------------
type ActionView = 'hub' | 'detail' | 'appointment' | 'delivery';

interface POActionModalProps {
    poId: string;
    onClose: () => void;
}

// Fulfilment row built after bill upload + mSKU map matching
interface FulfilmentRow {
    skuCode: string;          // PO sku_code (market_sku of PO line)
    skuName: string;          // PO sku_name
    orderedQty: number;
    billedQty: number;        // from bill (matched via mSKU map)
    billedValue: number;
    matchedVia: string;       // marketSku used to match
    matched: boolean;
}

const POActionModal: React.FC<POActionModalProps> = ({ poId, onClose }) => {
    const { purchaseOrders, updateAppointmentDate, confirmDelivery, closePO, updatePOStatus, mskuMap, deletePO } = useQCommerceStore();
    const po = purchaseOrders.find((p) => p.id === poId);

    const [view, setView] = useState<ActionView>('hub');
    const [apptDate, setApptDate] = useState(po?.planned_appointment_date || '');
    const [deliveries, setDeliveries] = useState<Record<string, number>>(() => {
        const acc: Record<string, number> = {};
        po?.line_items.forEach((l) => (acc[l.sku_code] = l.quantity));
        return acc;
    });
    const [apptSuccess, setApptSuccess] = useState(false);

    // Bill upload state
    const [billFileName, setBillFileName] = useState('');
    const [billError, setBillError] = useState('');
    const [fulfilmentRows, setFulfilmentRows] = useState<FulfilmentRow[] | null>(null);
    const billInputRef = useRef<HTMLInputElement>(null);

    const [pendingMapping, setPendingMapping] = useState<{
        unmappedPO: POLineItem[];
        unmappedBillSkus: string[];
        billMap: Map<string, { qty: number; total: number; itemName: string }>;
    } | null>(null);
    const [tempMap, setTempMap] = useState<Record<string, string>>({});

    const { addMSKUMapping } = useQCommerceStore();

    if (!po) { onClose(); return null; }

    const { po_status, payment_status } = po;
    const isClosed = po_status === 'closed';
    const isDelivered = po_status === 'delivered' || isClosed;
    const totalOrderedQty = po.line_items.reduce((s, l) => s + l.quantity, 0);
    const totalDeliveredQty = po.line_items.reduce((s, l) => s + (l.delivered_quantity || 0), 0);
    const fillRate = isDelivered && totalOrderedQty > 0
        ? ((totalDeliveredQty / totalOrderedQty) * 100).toFixed(1) + '%' : '—';

    const statusMeta = PO_STATUS_META[po_status as POStatus] || { label: String(po_status).toUpperCase(), color: 'bg-slate-100 text-slate-600' };
    const payMeta = PAYMENT_META[payment_status] || { label: String(payment_status).toUpperCase(), color: 'bg-slate-100 text-slate-600' };

    const handleSaveAppt = () => {
        if (!apptDate) return;
        updateAppointmentDate(po.id, apptDate);
        setApptSuccess(true);
        setTimeout(() => { setApptSuccess(false); setView('hub'); }, 1200);
    };

    // Build mSKU lookup: marketSku -> skuDesc
    const mskuLookup = useMemo(() => {
        const m = new Map<string, string>();
        mskuMap.forEach(e => { if (e.marketSku) m.set(e.marketSku, e.skuDesc); });
        return m;
    }, [mskuMap]);

    const handleBillUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBillFileName(file.name);
        setBillError('');
        setFulfilmentRows(null);
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const billRows = parseBillXLSX(ev.target?.result as ArrayBuffer);
                if (billRows.length === 0) { setBillError('Could not find data in the uploaded bill. Check the format.'); return; }
                const billMap = aggregateBill(billRows);
                // For each PO line, find matching market_sku in bill
                // PO sku_code IS the market_sku (as set by Zepto CSV import)
                const rows: FulfilmentRow[] = [];
                const unmappedPO: POLineItem[] = [];

                po.line_items.forEach(line => {
                    const directHit = billMap.get(line.sku_code);
                    if (directHit) {
                        rows.push({ skuCode: line.sku_code, skuName: line.sku_name, orderedQty: line.quantity, billedQty: directHit.qty, billedValue: directHit.total, matchedVia: line.sku_code, matched: true });
                        return;
                    }
                    const altEntry = mskuMap.find(e => e.skuDesc.toLowerCase() === line.sku_name.toLowerCase() && e.marketSku);
                    if (altEntry) {
                        const altHit = billMap.get(altEntry.marketSku);
                        if (altHit) {
                            rows.push({ skuCode: line.sku_code, skuName: line.sku_name, orderedQty: line.quantity, billedQty: altHit.qty, billedValue: altHit.total, matchedVia: altEntry.marketSku, matched: true });
                            return;
                        }
                    }
                    unmappedPO.push(line);
                    rows.push({ skuCode: line.sku_code, skuName: line.sku_name, orderedQty: line.quantity, billedQty: 0, billedValue: 0, matchedVia: '—', matched: false });
                });

                const matchedBillSkus = new Set(rows.filter(r => r.matched).map(r => r.matchedVia));
                const unmappedBillSkus = Array.from(billMap.keys()).filter(k => !matchedBillSkus.has(k));

                setFulfilmentRows(rows);

                if (unmappedPO.length > 0 && unmappedBillSkus.length > 0) {
                    setPendingMapping({ unmappedPO, unmappedBillSkus, billMap });
                    return;
                }

                // Pre-fill deliveries with billed qty if no mapping needed
                const newDeliveries: Record<string, number> = {};
                rows.forEach(r => { newDeliveries[r.skuCode] = r.billedQty; });
                setDeliveries(newDeliveries);
            } catch {
                setBillError('Failed to parse the bill file. Please check the format.');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const applyMapping = () => {
        if (!pendingMapping || !fulfilmentRows) return;
        let newRows = [...fulfilmentRows];
        
        Object.entries(tempMap).forEach(([poSkuCode, billSku]) => {
            if (billSku) {
                const poLine = po.line_items.find(l => l.sku_code === poSkuCode);
                if (poLine) {
                    addMSKUMapping(poLine.sku_name, billSku);
                    const billData = pendingMapping.billMap.get(billSku);
                    if (billData) {
                        newRows = newRows.map(r => 
                            r.skuCode === poSkuCode 
                            ? { ...r, billedQty: billData.qty, billedValue: billData.total, matchedVia: billSku, matched: true }
                            : r
                        );
                    }
                }
            }
        });
        
        setFulfilmentRows(newRows);
        const newDeliveries: Record<string, number> = {};
        newRows.forEach(r => { newDeliveries[r.skuCode] = r.billedQty; });
        setDeliveries(newDeliveries);
        
        setPendingMapping(null);
        setTempMap({});
    };

    const cancelMapping = () => {
        if (fulfilmentRows) {
            const newDeliveries: Record<string, number> = {};
            fulfilmentRows.forEach(r => { newDeliveries[r.skuCode] = r.billedQty; });
            setDeliveries(newDeliveries);
        }
        setPendingMapping(null);
        setTempMap({});
    };

    const handleDeliverySubmit = () => {
        let exactBillValue: number | undefined = undefined;
        if (fulfilmentRows) {
            exactBillValue = fulfilmentRows.reduce((sum, r) => sum + r.billedValue, 0);
        }
        confirmDelivery(po.id, deliveries, exactBillValue);
        setView('hub');
    };

    const handleConfirmPayment = () => {
        closePO(po.id);
        setView('hub');
    };

    // -- Shared header --
    const Header = ({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) => (
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-t-3xl px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
                {onBack && (
                    <button onClick={onBack} className="text-white/70 hover:text-white transition-colors mr-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}
                <div>
                    <h3 className="text-white font-bold text-xl">{title}</h3>
                    {subtitle && <p className="text-violet-200 text-sm">{subtitle}</p>}
                </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-4 relative">
                
                {/* Mapping Popup */}
                {pendingMapping && (
                    <div className="absolute inset-0 z-50 bg-white rounded-3xl p-6 flex flex-col shadow-2xl">
                        <h3 className="text-xl font-black text-slate-800 mb-2">Map Missing SKUs</h3>
                        <p className="text-sm text-slate-500 mb-6 font-medium">We found {pendingMapping.unmappedPO.length} PO items that couldn't be matched automatically. Please select the corresponding item from the bill.</p>
                        
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                            {pendingMapping.unmappedPO.map(line => (
                                <div key={line.sku_code} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                    <p className="text-xs font-mono font-bold text-slate-500">{line.sku_code}</p>
                                    <p className="text-sm font-semibold text-slate-800 mb-3">{line.sku_name}</p>
                                    <select
                                        value={tempMap[line.sku_code] || ''}
                                        onChange={e => setTempMap({...tempMap, [line.sku_code]: e.target.value})}
                                        className="w-full text-sm border-2 border-indigo-200 rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 outline-none text-slate-700"
                                    >
                                        <option value="">-- Do not map (leave unfulfilled) --</option>
                                        {pendingMapping.unmappedBillSkus.map(bsku => {
                                            const item = pendingMapping.billMap.get(bsku);
                                            return (
                                                <option key={bsku} value={bsku}>{bsku} - {item?.itemName} ({item?.qty} units)</option>
                                            );
                                        })}
                                    </select>
                                </div>
                            ))}
                        </div>
                        
                        <div className="flex gap-3 pt-6 mt-auto border-t border-slate-100">
                            <button onClick={applyMapping} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors">
                                Save Mapping & Continue
                            </button>
                            <button onClick={cancelMapping} className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">
                                Skip
                            </button>
                        </div>
                    </div>
                )}

                {/* -- HUB VIEW -- */}
                {view === 'hub' && (
                    <>
                        <Header title={po.po_number} subtitle={po.supplier_name} />
                        <div className="p-6 space-y-5">
                            {/* Status row */}
                            <div className="flex flex-wrap gap-2 items-center">
                                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${statusMeta.color}`}>
                                    {statusMeta.label}
                                </span>
                                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${payMeta.color}`}>
                                    Payment: {payMeta.label}
                                </span>
                                {po.planned_appointment_date && (
                                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        Appt: {fdate(po.planned_appointment_date)}
                                    </span>
                                )}
                            </div>

                            {/* Quick KPIs */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">PO Value</p>
                                    <p className="text-sm font-black text-slate-800 mt-1">{fmt(po.po_amount)}</p>
                                </div>
                                <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 text-center">
                                    <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wide">Ord Qty</p>
                                    <p className="text-sm font-black text-indigo-800 mt-1">{totalOrderedQty}</p>
                                </div>
                                <div className={`rounded-xl p-3 border text-center ${isDelivered ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                                    <p className={`text-[10px] font-bold uppercase tracking-wide ${isDelivered ? 'text-green-500' : 'text-slate-400'}`}>Del Qty</p>
                                    <p className={`text-sm font-black mt-1 ${isDelivered ? 'text-green-800' : 'text-slate-400'}`}>
                                        {isDelivered ? totalDeliveredQty : '—'}
                                    </p>
                                </div>
                            </div>

                            {/* Delivered amount + fill rate banner */}
                            {isDelivered && (
                                <div className="flex items-center gap-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                                    <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <div>
                                        <p className="text-sm font-bold text-green-800">Delivered: {fmt(po.delivered_amount ?? 0)} · Fill Rate: {fillRate}</p>
                                        {isClosed && <p className="text-xs text-green-700 mt-0.5">Payment confirmed — PO is Closed.</p>}
                                        {!isClosed && <p className="text-xs text-green-700 mt-0.5">Awaiting payment confirmation.</p>}
                                    </div>
                                </div>
                            )}

                            {/* Action cards */}
                            <div className="space-y-2.5">
                                {/* Show PO Details — always */}
                                <button
                                    onClick={() => setView('detail')}
                                    className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center group-hover:bg-violet-200 transition-colors">
                                        <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-slate-800">Show PO Details</p>
                                        <p className="text-xs text-slate-500">View all line items and order information</p>
                                    </div>
                                    <svg className="w-4 h-4 text-slate-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>

                                {/* Book Appointment — only when open */}
                                {po_status === 'open' && (
                                    <button
                                        onClick={() => setView('appointment')}
                                        className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-blue-100 hover:border-blue-300 hover:bg-blue-50 transition-all group"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-slate-800">Book Appointment</p>
                                            <p className="text-xs text-slate-500">
                                                {po.planned_appointment_date
                                                    ? `Current: ${fdate(po.planned_appointment_date)} · Click to change`
                                                    : 'Set a planned delivery appointment date'}
                                            </p>
                                        </div>
                                        <svg className="w-4 h-4 text-slate-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                )}

                                {/* Mark as Delivered — only when open */}
                                {po_status === 'open' && (
                                    <button
                                        onClick={() => setView('delivery')}
                                        className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-amber-100 hover:border-amber-300 hover:bg-amber-50 transition-all group"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                                            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-slate-800">Mark as Delivered</p>
                                            <p className="text-xs text-slate-500">Enter delivered quantities for each SKU</p>
                                        </div>
                                        <svg className="w-4 h-4 text-slate-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                )}

                                {/* Confirm Payment — only delivered + not yet paid/closed */}
                                {po_status === 'delivered' && payment_status !== 'paid' && (
                                    <button
                                        onClick={handleConfirmPayment}
                                        className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-green-200 hover:border-green-400 hover:bg-green-50 transition-all group"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-slate-800">Confirm Payment</p>
                                            <p className="text-xs text-slate-500">Amount due: <strong className="text-green-700">{fmt(po.delivered_amount ?? po.po_amount)}</strong> · Marks PO as Closed</p>
                                        </div>
                                        <svg className="w-4 h-4 text-slate-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                )}

                                {/* Cancel PO — only open */}
                                {po_status === 'open' && (
                                    <button
                                        onClick={() => { updatePOStatus(po.id, 'cancelled'); onClose(); }}
                                        className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-red-100 hover:border-red-300 hover:bg-red-50 transition-all group"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                                            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-red-700">Cancel PO</p>
                                            <p className="text-xs text-slate-500">Mark this purchase order as cancelled</p>
                                        </div>
                                    </button>
                                )}

                                {/* Delete PO — always available */}
                                <button
                                    onClick={() => {
                                        if (window.confirm('Are you sure you want to permanently delete this PO? This cannot be undone and it will be removed from all calculations.')) {
                                            deletePO(po.id);
                                            onClose();
                                        }
                                    }}
                                    className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-red-100 hover:border-red-500 hover:bg-red-50 transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center group-hover:bg-red-500 transition-colors">
                                        <svg className="w-5 h-5 text-red-500 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-red-700">Delete Permanently</p>
                                        <p className="text-xs text-slate-500">Remove this PO entirely from all records and calculations</p>
                                    </div>
                                </button>
                            </div>

                            <div className="flex justify-end pt-1">
                                <button onClick={onClose} className="px-5 py-2 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition-colors">
                                    Close
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* -- DETAIL VIEW -- */}
                {view === 'detail' && (
                    <>
                        <Header title={po.po_number} subtitle={po.supplier_name} onBack={() => setView('hub')} />
                        <div className="p-6 space-y-5">
                            {/* Status badges */}
                            <div className="flex flex-wrap gap-2">
                                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${statusMeta.color}`}>PO Status: {statusMeta.label}</span>
                                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${payMeta.color}`}>Payment: {payMeta.label}</span>
                            </div>
                            {/* KPI row */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: 'PO Date', val: fdate(po.po_date) },
                                    { label: 'Expiry', val: fdate(po.expiry_date) },
                                    { label: 'Appointment', val: fdate(po.planned_appointment_date) || '—' },
                                    { label: 'Ordered Value', val: fmt(po.po_amount) },
                                ].map(({ label, val }) => (
                                    <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-1">{label}</p>
                                        <p className="text-sm font-bold text-slate-800">{val}</p>
                                    </div>
                                ))}
                            </div>
                            {isDelivered && (
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                                        <p className="text-[10px] text-green-600 font-bold uppercase tracking-wide mb-1">Delivered Value</p>
                                        <p className="text-sm font-black text-green-800">{fmt(po.delivered_amount ?? 0)}</p>
                                    </div>
                                    <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                                        <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wide mb-1">Ord Qty</p>
                                        <p className="text-sm font-black text-indigo-800">{totalOrderedQty}</p>
                                    </div>
                                    <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                                        <p className="text-[10px] text-green-600 font-bold uppercase tracking-wide mb-1">Del Qty · Fill Rate</p>
                                        <p className="text-sm font-black text-green-800">{totalDeliveredQty} · {fillRate}</p>
                                    </div>
                                </div>
                            )}
                            {/* Line items table */}
                            <div className="overflow-x-auto rounded-xl border border-slate-100">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Item</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Unit ₹</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-indigo-600 uppercase bg-indigo-50/50">Ord Qty</th>
                                            {isDelivered && <>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-green-600 uppercase bg-green-50/50">Del Qty</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase border-l border-slate-200">Ord Val</th>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-green-700 uppercase bg-green-50">Del Val</th>
                                            </>}
                                            {!isDelivered && <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {po.line_items.map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <p className="text-xs font-mono font-bold text-slate-500">{item.sku_code}</p>
                                                    <p className="text-sm font-semibold text-slate-800">{item.sku_name}</p>
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-500 font-medium">{fmt(item.unit_price)}</td>
                                                <td className="px-4 py-3 text-right font-black text-indigo-700 bg-indigo-50/30">{item.quantity}</td>
                                                {isDelivered && <>
                                                    <td className="px-4 py-3 text-right font-black text-green-700 bg-green-50/30">{item.delivered_quantity ?? 0}</td>
                                                    <td className="px-4 py-3 text-right text-slate-500 border-l border-slate-100 font-medium">{fmt(item.total)}</td>
                                                    <td className="px-4 py-3 text-right font-black text-green-800 bg-green-50/50">{fmt(item.delivered_value ?? 0)}</td>
                                                </>}
                                                {!isDelivered && <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(item.total)}</td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-200 bg-slate-50">
                                            <td colSpan={2} className="px-4 py-3 text-right font-bold text-slate-700 text-sm">Grand Total</td>
                                            <td className="px-4 py-3 text-right font-black text-indigo-700 text-sm bg-indigo-50/50">{totalOrderedQty}</td>
                                            {isDelivered && <>
                                                <td className="px-4 py-3 text-right font-black text-green-700 text-sm bg-green-50/50">{totalDeliveredQty}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-600 text-sm border-l border-slate-200">{fmt(po.po_amount)}</td>
                                                <td className="px-4 py-3 text-right font-black text-green-800 text-sm bg-green-100">{fmt(po.delivered_amount ?? 0)}</td>
                                            </>}
                                            {!isDelivered && <td className="px-4 py-3 text-right font-black text-violet-700 text-sm">{fmt(po.po_amount)}</td>}
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            {po.notes && <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-4 py-2 border border-slate-100"><strong>Notes:</strong> {po.notes}</p>}
                            <div className="flex justify-end pt-1">
                                <button onClick={() => setView('hub')} className="px-5 py-2 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition-colors">← Back</button>
                            </div>
                        </div>
                    </>
                )}

                {/* -- APPOINTMENT VIEW -- */}
                {view === 'appointment' && (
                    <>
                        <Header title="Book Appointment" subtitle={po.po_number} onBack={() => setView('hub')} />
                        <div className="p-6 space-y-5">
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                                <p className="text-sm font-bold text-blue-800 mb-4">Select Planned Appointment Date</p>
                                {po.planned_appointment_date && (
                                    <p className="text-xs text-blue-600 mb-3 font-medium">
                                        Current appointment: <strong>{fdate(po.planned_appointment_date)}</strong>
                                    </p>
                                )}
                                <input
                                    type="date"
                                    value={apptDate}
                                    onChange={(e) => setApptDate(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-blue-200 bg-white text-slate-800 text-sm font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                />
                            </div>
                            {apptSuccess && (
                                <div className="flex items-center gap-2 text-green-700 font-bold text-sm bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Appointment booked!
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleSaveAppt}
                                    disabled={!apptDate}
                                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold shadow-md hover:scale-[1.02] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Confirm Appointment
                                </button>
                                <button onClick={() => setView('hub')} className="py-3 px-5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* -- DELIVERY VIEW -- */}
                {view === 'delivery' && (
                    <>
                        <Header title="Mark as Delivered" subtitle={po.po_number} onBack={() => setView('hub')} />
                        <div className="p-6 space-y-4">
                            {/* Step 1 – Upload Bill */}
                            <div className="border-2 border-dashed border-amber-200 rounded-2xl p-4 bg-amber-50 flex flex-col items-center gap-2 text-center">
                                <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="text-sm font-bold text-amber-800">Upload Sales Bill (Excel)</p>
                                <p className="text-xs text-amber-600 max-w-xs leading-relaxed">
                                    Upload the <strong>Bill.xlsx</strong> — must have columns: <span className="font-mono">Market SKU, Invoice Qty, Total</span>.<br/>
                                    Quantities will be matched against the PO using the mSKU map.
                                </p>
                                <label className="cursor-pointer mt-1">
                                    <input ref={billInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleBillUpload} />
                                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-colors">
                                        Browse Bill File
                                    </span>
                                </label>
                                {billFileName && <p className="text-xs text-green-700 font-semibold">✓ {billFileName} loaded</p>}
                            </div>

                            {billError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{billError}</div>
                            )}

                            {mskuMap.length === 0 && (
                                <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-800">
                                    <svg className="w-4 h-4 mt-0.5 shrink-0 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span><strong>mSKU map not loaded.</strong> Upload the mSKU map in the <em>SKU Mapping</em> section first for best matching accuracy.</span>
                                </div>
                            )}

                            {/* Step 2 – Fulfilment table (shown after bill upload) */}
                            {fulfilmentRows && (
                                <div className="space-y-3">
                                    <p className="text-sm font-bold text-slate-700">SKU Fulfilment Summary — review and adjust if needed:</p>
                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200">
                                                    <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase tracking-wide">SKU</th>
                                                    <th className="px-3 py-2 text-right font-bold text-indigo-600 uppercase tracking-wide bg-indigo-50/40">Ordered</th>
                                                    <th className="px-3 py-2 text-right font-bold text-amber-700 uppercase tracking-wide bg-amber-50/40">Invoice Qty</th>
                                                    <th className="px-3 py-2 text-right font-bold text-green-700 uppercase tracking-wide bg-green-50/40">Fill %</th>
                                                    <th className="px-3 py-2 text-right font-bold text-slate-500 uppercase tracking-wide">Invoice Val</th>
                                                    <th className="px-3 py-2 text-center font-bold text-slate-500 uppercase tracking-wide">Match</th>
                                                    <th className="px-3 py-2 text-right font-bold text-violet-600 uppercase tracking-wide bg-violet-50/40">Confirm Qty</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {fulfilmentRows.map((row) => {
                                                    const fillPct = row.orderedQty > 0 ? Math.round((row.billedQty / row.orderedQty) * 100) : 0;
                                                    const fillColor = fillPct >= 90 ? 'text-green-700' : fillPct >= 50 ? 'text-amber-700' : 'text-red-600';
                                                    return (
                                                        <tr key={row.skuCode} className={`hover:bg-slate-50 transition-colors ${!row.matched ? 'bg-red-50/30' : ''}`}>
                                                            <td className="px-3 py-2">
                                                                <p className="font-mono font-bold text-slate-500">{row.skuCode}</p>
                                                                <p className="text-slate-700 font-semibold truncate max-w-[160px]">{row.skuName}</p>
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-black text-indigo-700 bg-indigo-50/20">{row.orderedQty}</td>
                                                            <td className="px-3 py-2 text-right font-black text-amber-700 bg-amber-50/20">{row.billedQty}</td>
                                                            <td className={`px-3 py-2 text-right font-black bg-green-50/20 ${fillColor}`}>{fillPct}%</td>
                                                            <td className="px-3 py-2 text-right text-slate-600 font-semibold">{fmt(row.billedValue)}</td>
                                                            <td className="px-3 py-2 text-center">
                                                                {row.matched ? (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold text-[10px]">✓ {row.matchedVia}</span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-bold text-[10px]">No match</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 bg-violet-50/20">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={deliveries[row.skuCode] ?? row.billedQty}
                                                                    onChange={(e) => setDeliveries({ ...deliveries, [row.skuCode]: parseFloat(e.target.value) || 0 })}
                                                                    className="w-20 ml-auto block px-2 py-1 border-2 border-violet-300 rounded-lg text-xs font-bold text-violet-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-300"
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t-2 border-slate-200 bg-slate-50">
                                                    <td className="px-3 py-2 font-bold text-slate-700 text-xs">Total</td>
                                                    <td className="px-3 py-2 text-right font-black text-indigo-700 bg-indigo-50/30">{fulfilmentRows.reduce((s, r) => s + r.orderedQty, 0)}</td>
                                                    <td className="px-3 py-2 text-right font-black text-amber-700 bg-amber-50/30">{fulfilmentRows.reduce((s, r) => s + r.billedQty, 0)}</td>
                                                    <td className="px-3 py-2 text-right font-black text-green-700 bg-green-50/30">
                                                        {(() => { const o = fulfilmentRows.reduce((s, r) => s + r.orderedQty, 0); const b = fulfilmentRows.reduce((s, r) => s + r.billedQty, 0); return o > 0 ? Math.round((b / o) * 100) + '%' : '—'; })()}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-black text-slate-700">{fmt(fulfilmentRows.reduce((s, r) => s + r.billedValue, 0))}</td>
                                                    <td></td>
                                                    <td className="px-3 py-2 text-right font-black text-violet-700 bg-violet-50/30">{Object.values(deliveries).reduce((s, v) => s + v, 0)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
                                        <p className="text-sm font-bold text-green-800">Confirmed Delivered Value</p>
                                        <p className="text-sm font-black text-green-700">
                                            {fmt(po.line_items.reduce((sum, l) => sum + (deliveries[l.sku_code] ?? 0) * l.unit_price, 0))}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Fallback manual entry (when no bill uploaded) */}
                            {!fulfilmentRows && (
                                <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-1">
                                    {po.line_items.map((l) => (
                                        <div key={l.sku_code} className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center gap-4">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-mono text-amber-600 font-bold">{l.sku_code}</p>
                                                <p className="text-sm font-bold text-slate-800 truncate">{l.sku_name}</p>
                                                <p className="text-xs text-slate-500 font-medium mt-0.5">Ordered: {l.quantity} units @ {fmt(l.unit_price)}</p>
                                            </div>
                                            <div className="w-36 shrink-0">
                                                <label className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Delivered Qty</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={l.quantity}
                                                    value={deliveries[l.sku_code] ?? 0}
                                                    onChange={(e) => setDeliveries({ ...deliveries, [l.sku_code]: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-3 py-2 border-2 border-amber-300 rounded-lg text-sm font-bold text-amber-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-300 mt-1"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
                                        <p className="text-sm font-bold text-green-800">Total Delivered Value</p>
                                        <p className="text-sm font-black text-green-700">
                                            {fmt(po.line_items.reduce((sum, l) => sum + (deliveries[l.sku_code] ?? 0) * l.unit_price, 0))}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={handleDeliverySubmit}
                                    disabled={!fulfilmentRows && po.line_items.every(l => !deliveries[l.sku_code])}
                                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold shadow-md shadow-amber-200 hover:scale-[1.02] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    ✓ Confirm Delivery
                                </button>
                                <button onClick={() => setView('hub')} className="py-3 px-5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};



// --- Main Page -----------------------------------------------------------------
export const QCommerceDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const {
        purchaseOrders,
        addPO,
        updatePOStatus,
        updatePaymentStatus,
        updateAppointmentDate,
        confirmDelivery,
        closePO,
        mskuMap,
        mskuMapFileName,
        setMSKUMap,
        clearMSKUMap,
    } = useQCommerceStore();
    const [showUpload, setShowUpload] = useState(false);
    const [selectedPO, setSelectedPO] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<POStatus | 'all'>('all');
    const [search, setSearch] = useState('');
    // SKU Mapping section state
    const [mskuUploadError, setMskuUploadError] = useState('');
    const [mskuUploading, setMskuUploading] = useState(false);
    const [showMskuTable, setShowMskuTable] = useState(false);

    const handleMSKUUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setMskuUploadError('');
        setMskuUploading(true);
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const entries = parseMSKUCSV(ev.target?.result as string);
                if (entries.length === 0) {
                    setMskuUploadError('No valid rows found. Ensure the file has SkuDesc and market_sku columns.');
                } else {
                    setMSKUMap(entries, file.name);
                    setShowMskuTable(true);
                }
            } catch {
                setMskuUploadError('Failed to parse the CSV. Please check the file format.');
            }
            setMskuUploading(false);
        };
        reader.readAsText(file);
        // Reset input so same file can be re-uploaded
        e.target.value = '';
    };


    const filteredPOs = useMemo(() => {
        return purchaseOrders.filter((po) => {
            if (statusFilter !== 'all' && po.po_status !== statusFilter) return false;
            if (search) {
                const q = search.toLowerCase();
                return (
                    po.po_number.toLowerCase().includes(q) ||
                    po.supplier_name.toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [purchaseOrders, statusFilter, search]);

    // KPI stats
    const totalPOs = purchaseOrders.length;
    const totalValue = purchaseOrders.filter(p => !['cancelled', 'expired'].includes(p.po_status)).reduce((s, p) => s + p.po_amount, 0);
    const openCount = purchaseOrders.filter(p => p.po_status === 'open').length;
    const closedCount = purchaseOrders.filter(p => p.po_status === 'closed').length;

    // Overall Fill Rate
    const fillRate = useMemo(() => {
        const deliveredPOs = purchaseOrders.filter(p => p.po_status === 'delivered' || p.po_status === 'closed');
        let ordQty = 0, delQty = 0;
        deliveredPOs.forEach(p => {
            p.line_items.forEach(l => {
                ordQty += l.quantity;
                delQty += (l.delivered_quantity || 0);
            });
        });
        return ordQty > 0 ? ((delQty / ordQty) * 100).toFixed(1) + '%' : '0%';
    }, [purchaseOrders]);

    return (
        <Layout>
            <div className="space-y-8 pb-12">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-200">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-black text-slate-800">Q-Commerce Dashboard</h2>
                        </div>
                        <p className="text-slate-500 ml-12">Purchase Orders · Overall Fill Rate: <strong className="text-violet-600">{fillRate}</strong></p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/qcommerce-mapping')}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold shadow-sm hover:bg-slate-50 transition-all duration-200"
                        >
                            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            SKU Mapping
                        </button>
                        <button
                            id="btn-new-po"
                            onClick={() => setShowUpload(true)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold shadow-lg shadow-violet-200 hover:shadow-xl hover:shadow-violet-300 hover:scale-105 transition-all duration-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New PO
                        </button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { label: 'Total POs', value: totalPOs, color: 'bg-violet-100 text-violet-600', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                        { label: 'Total Value', value: fmt(totalValue), color: 'bg-emerald-100 text-emerald-600', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { label: 'Open', value: openCount, color: 'bg-amber-100 text-amber-600', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { label: 'Closed', value: closedCount, color: 'bg-teal-100 text-teal-600', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { label: 'Fill Rate', value: fillRate, color: 'bg-pink-100 text-pink-600', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
                    ].map(({ label, value, color, icon }) => (
                        <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                                    </svg>
                                </div>
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                            </div>
                            <p className="text-2xl font-black text-slate-800">{value}</p>
                        </div>
                    ))}
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                        <h3 className="text-lg font-bold text-slate-800">Purchase Order List</h3>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    placeholder="Search PO or supplier…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all w-48"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
                            >
                                <option value="all">All Status</option>
                                {(Object.keys(PO_STATUS_META) as POStatus[]).map((s) => (
                                    <option key={s} value={s}>{PO_STATUS_META[s].label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50">
                                    {['PO Number', 'Supplier / Platform', 'PO Date', 'Expiry', 'Appointment', 'PO Amount', 'Delivered Amount', 'Ord Qty', 'Del Qty', 'PO Status', 'Payment'].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPOs.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="py-14 text-center text-slate-400">
                                            <p className="font-medium">No purchase orders found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPOs.map((po) => {
                                        const ordQty = po.line_items.reduce((s, l) => s + l.quantity, 0);
                                        const delQty = po.line_items.reduce((s, l) => s + (l.delivered_quantity || 0), 0);
                                        const hasDelivery = po.po_status === 'delivered' || po.po_status === 'closed';
                                        return (
                                            <tr
                                                key={po.id}
                                                onClick={() => setSelectedPO(po.id)}
                                                className="hover:bg-violet-50/60 cursor-pointer transition-colors"
                                            >
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-sm font-bold text-violet-700">{po.po_number}</span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-700 font-bold max-w-[160px] truncate">{po.supplier_name}</td>
                                                <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap font-medium">{fdate(po.po_date)}</td>
                                                <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap font-medium">{fdate(po.expiry_date)}</td>
                                                <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap font-medium">{fdate(po.planned_appointment_date) || <span className="text-slate-300">—</span>}</td>
                                                <td className="px-4 py-3 text-sm font-black text-slate-800 whitespace-nowrap">
                                                    {fmt(po.po_amount)}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-black text-green-700 whitespace-nowrap bg-green-50/10">
                                                    {hasDelivery && po.delivered_amount !== undefined ? fmt(po.delivered_amount) : <span className="text-slate-300 font-normal">—</span>}
                                                </td>
                                                <td className="px-4 py-3 text-center font-black text-indigo-700 bg-indigo-50/20 text-sm">
                                                    {ordQty}
                                                </td>
                                                <td className="px-4 py-3 text-center text-sm font-black bg-green-50/20">
                                                    {hasDelivery ? (
                                                        <span className="text-green-700">{delQty}</span>
                                                    ) : (
                                                        <span className="text-slate-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide ${PO_STATUS_META[po.po_status as POStatus]?.color || 'bg-slate-100 text-slate-600'}`}>
                                                        {PO_STATUS_META[po.po_status as POStatus]?.label || po.po_status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide ${PAYMENT_META[po.payment_status]?.color || 'bg-slate-100 text-slate-600'}`}>
                                                        {PAYMENT_META[po.payment_status]?.label || po.payment_status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showUpload && (
                <UploadPOModal
                    onClose={() => setShowUpload(false)}
                    onSave={addPO}
                    userId={user?.id || 'unknown'}
                />
            )}
            {selectedPO && (
                <POActionModal
                    poId={selectedPO}
                    onClose={() => setSelectedPO(null)}
                />
            )}
        </Layout>
    );
};

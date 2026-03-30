import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Layout } from '../components/shared/Layout';
import { useAuthStore } from '../stores/authStore';
import { WDOrderSummary } from '../lib/types';
import { SOHUpdate } from '../components/mdo/SOHUpdate';
import { useMDOStore } from '../stores/mdoStore';
import { useSOHStore } from '../stores/sohStore';
import { supabase } from '../lib/supabase';
import { User } from '../lib/types';

// --- Helpers -----------------------------------------------------------------

const fmt = (n: number) =>
    '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const fmtQty = (n: number) => n.toFixed(2) + ' Ms';

const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

// --- Excel Export -------------------------------------------------------------

const exportToExcel = (summaries: WDOrderSummary[], managerName: string, dateLabel?: string) => {
    const dataToExport = summaries.filter(w => w.has_ordered);
    const totalQty = dataToExport.reduce((sum, w) => sum + w.total_qty_ms, 0);

    const aoa: any[][] = [];
    
    // First row: empty cells except total quantity
    aoa.push(['', '', '', '', '', totalQty, '', '', '', '']);
    
    // Second row: Headers based on MDO Export.xlsx mapping
    aoa.push(['Circle', 'Ship to Party', 'Sold to Party', 'Brand', 'Plant', 'Quantity', 'Remarks', 'Remarks 2', 'Brand Name', 'QTY']);

    // Data rows
    dataToExport.forEach(w => {
        aoa.push([
            'MUU',                  // Circle
            w.wd_code || '',        // Ship to Party
            w.wd_code || '',        // Sold to Party
            '',                     // Brand (SKU Code)
            'CWMB',                 // Plant
            w.total_qty_ms,         // Quantity in Ms
            'Lean',                 // Remarks
            '',                     // Remarks 2
            w.wd_name || 'Consolidated Order', // Brand Name (used for WD name in summary view)
            w.total_amount          // QTY (Amount)
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths mapped to realistic data lengths
    ws['!cols'] = [
        { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
        { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 35 }, { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MDO Summary');

    const suffix = dateLabel
        ? dateLabel.replace(/-/g, '')
        : new Date().toLocaleString('default', { month: 'short', year: '2-digit' });
    XLSX.writeFile(wb, `LeanX_MDO_Report_${managerName}_${suffix}.xlsx`);
};

const exportDOsToExcel = (orders: any[], mappedWDs: User[], sohEntries: any[], managerName: string, dateLabel: string) => {
    const aoa: any[][] = [];
    
    // First row: empty cells except total quantity
    const totalQty = orders.reduce((sum, o) => sum + o.total_qty_ms, 0);
    aoa.push(['', '', '', '', '', totalQty, '', '', '', '']);
    
    // Second row: Headers based on MDO Export.xlsx mapping
    aoa.push(['Circle', 'Ship to Party', 'Sold to Party', 'Brand', 'Plant', 'Quantity', 'Remarks', 'Remarks 2', 'Brand Name', 'QTY']);

    orders.forEach(o => {
        const wd = mappedWDs.find(w => w.id === o.user_id);
        const shipTo = wd?.wd_code || 'N/A';

        o.items.forEach((item: any) => {
            if (item.quantityMs > 0) {
                const sohQty = sohEntries.find(s => s.sku === item.sku)?.stockMs || 0;
                
                aoa.push([
                    'MUU',                  // Circle
                    shipTo,                 // Ship to Party
                    shipTo,                 // Sold to Party
                    item.sku,               // Brand (SKU Code)
                    'CWMB',                 // Plant
                    item.quantityMs,        // Quantity in Ms
                    'Lean',                 // Remarks
                    '',                     // Remarks 2
                    item.skuLabel,          // Brand Name
                    sohQty                  // QTY (SOH Quantity)
                ]);
            }
        });
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths
    ws['!cols'] = [
        { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
        { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 35 }, { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Delivery Orders');

    const suffix = dateLabel.replace(/-/g, '');
    XLSX.writeFile(wb, `DO_Export_${managerName}_${suffix}.xlsx`);
};

// --- Bar chart bar ------------------------------------------------------------

const BarGroup: React.FC<{
    label: string; ordered: number; total: number;
    qty: number; amount: number; maxQty: number;
}> = ({ label, ordered, total, qty, amount, maxQty }) => {
    const pct = maxQty > 0 ? (qty / maxQty) * 100 : 0;
    const coveragePct = total > 0 ? Math.round((ordered / total) * 100) : 0;

    return (
        <div className="flex flex-col items-center gap-1.5 flex-1 group">
            <div className="relative w-full" style={{ height: '120px' }}>
                {/* Amount faint bg bar */}
                <div className="absolute bottom-0 w-full rounded-t-lg bg-slate-100" style={{ height: '100%' }} />
                {/* Qty main bar */}
                <div
                    className="absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-amber-500 to-amber-300 transition-all duration-700"
                    style={{ height: `${pct}%`, minHeight: qty > 0 ? 4 : 0 }}
                />
                {/* Hover tooltip */}
                {qty > 0 && (
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div className="bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-xl whitespace-nowrap shadow-xl">
                            <div>{ordered}/{total} WDs</div>
                            <div>{fmtQty(qty)}</div>
                            <div>{fmt(amount)}</div>
                            <div className="text-amber-300">{coveragePct}% coverage</div>
                        </div>
                    </div>
                )}
            </div>
            <span className="text-xs text-slate-400 font-medium">{label}</span>
            <span className="text-xs font-bold text-slate-600">{ordered}/{total}</span>
        </div>
    );
};

// --- Main Component -----------------------------------------------------------

export const ManagerDashboard: React.FC = () => {
    const { user } = useAuthStore();
    const { orderHistory } = useMDOStore();
    const { sohEntries, lastUpdatedAt } = useSOHStore();
    const [filter, setFilter] = useState<'all' | 'ordered' | 'not_ordered'>('all');
    const [exportLoading, setExportLoading] = useState(false);
    const [dateFilter, setDateFilter] = useState<string>('');
    const [dateExportLoading, setDateExportLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'soh'>('overview');
    const [mappedWDs, setMappedWDs] = useState<User[]>([]);

    useEffect(() => {
        if (!user) return;
        const fetchWDs = async () => {
            const { data } = await supabase
                .from('users')
                .select('*')
                .eq('manager_id', user.id)
                .eq('role', 'user')
                .eq('status', 'active');
            if (data) setMappedWDs(data);
        };
        fetchWDs();
    }, [user]);

    // Patch locally cached existing MDOs that were incorrectly recorded with 0 valuation
    const patchedOrderHistory = useMemo(() => {
        return orderHistory.map(o => {
            if (o.total_amount === 0 && o.total_qty_ms > 0) {
                return { ...o, total_amount: o.total_qty_ms * 12000 };
            }
            return o;
        });
    }, [orderHistory]);

    const currentMonth = new Date().toISOString().substring(0, 7); // e.g., '2026-03'

    const summaries: WDOrderSummary[] = useMemo(() => {
        return mappedWDs.map(wd => {
            const wdOrders = patchedOrderHistory.filter(o => o.user_id === wd.id && o.month === currentMonth);
            
            const total_orders = wdOrders.length;
            const total_qty_ms = wdOrders.reduce((sum, o) => sum + o.total_qty_ms, 0);
            const total_amount = wdOrders.reduce((sum, o) => sum + o.total_amount, 0);
            const remitted_amount = wdOrders.filter(o => o.remittance_confirmed)
                                            .reduce((sum, o) => sum + o.total_amount, 0);
            const pending_remittance = total_amount - remitted_amount;
            
            const last_order_date = wdOrders.length > 0 
                ? wdOrders.reduce((latest, o) => o.created_at > latest ? o.created_at : latest, wdOrders[0].created_at)
                : null;

            return {
                wd_id: wd.id,
                wd_name: wd.wd_name || wd.username,
                wd_code: wd.wd_code || 'N/A',
                total_orders,
                total_qty_ms,
                total_amount,
                remitted_amount,
                pending_remittance,
                last_order_date,
                has_ordered: total_orders > 0
            };
        });
    }, [mappedWDs, patchedOrderHistory, currentMonth]);

    const history = useMemo(() => {
        const mos: string[] = [];
        const ds = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(ds.getFullYear(), ds.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const lbl = d.toLocaleString('default', { month: 'short', year: '2-digit' }).replace(' ', " '");
            mos.push(`${y}-${m}|${lbl}`);
        }

        return mos.map(mStr => {
            const [yymm, lbl] = mStr.split('|');
            const monthOrders = patchedOrderHistory.filter(o => o.month === yymm && mappedWDs.some(w => w.id === o.user_id));
            
            const uniqueWDs = new Set(monthOrders.map(o => o.user_id)).size;
            const qty = monthOrders.reduce((sum, o) => sum + o.total_qty_ms, 0);
            const amount = monthOrders.reduce((sum, o) => sum + o.total_amount, 0);

            return {
                month: lbl,
                ordered: uniqueWDs,
                total: mappedWDs.length,
                qty,
                amount
            };
        });
    }, [mappedWDs, patchedOrderHistory]);

    const wds = mappedWDs;

    // Overall stats
    const totalWDs = wds.length;
    const orderedWDs = summaries.filter(s => s.has_ordered).length;
    const notOrderedWDs = totalWDs - orderedWDs;
    const totalAmount = summaries.reduce((s, w) => s + w.total_amount, 0);
    const totalRemitted = summaries.reduce((s, w) => s + w.remitted_amount, 0);
    const totalPending = summaries.reduce((s, w) => s + w.pending_remittance, 0);
    const totalQty = summaries.reduce((s, w) => s + w.total_qty_ms, 0);

    const canExport = orderedWDs > 0;
    const maxQty = useMemo(() => Math.max(...history.map(h => h.qty), 1), [history]);

    // SOH info for badge
    const stockOutCount = sohEntries.filter(e => e.stockMs === 0).length;
    const sohConfigured = sohEntries.length > 0;

    // Filtered table rows (by order status)
    const filtered = useMemo(() => {
        if (filter === 'ordered') return summaries.filter(s => s.has_ordered);
        if (filter === 'not_ordered') return summaries.filter(s => !s.has_ordered);
        return summaries;
    }, [summaries, filter]);

    // Further filtered by selected date
    const dateFiltered = useMemo(() => {
        if (!dateFilter) return filtered;
        return filtered.filter(s => {
            if (!s.last_order_date) return false;
            const d = new Date(s.last_order_date);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}` === dateFilter;
        });
    }, [filtered, dateFilter]);

    // Gather actual detailed Delivery Orders matching the selected date
    const dateFilteredDOs = useMemo(() => {
        if (!dateFilter) return [];
        return patchedOrderHistory.filter(o => {
            if (!o.created_at) return false;
            const d = new Date(o.created_at);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}` === dateFilter && mappedWDs.some(w => w.id === o.user_id);
        });
    }, [dateFilter, patchedOrderHistory, mappedWDs]);

    const handleExport = () => {
        setExportLoading(true);
        setTimeout(() => {
            exportToExcel(summaries, user?.username || 'Manager');
            setExportLoading(false);
        }, 400);
    };

    const handleDateExport = () => {
        setDateExportLoading(true);
        setTimeout(() => {
            exportDOsToExcel(dateFilteredDOs, mappedWDs, sohEntries, user?.username || 'Manager', dateFilter);
            setDateExportLoading(false);
        }, 400);
    };

    return (
        <Layout>
            <div className="space-y-8 pb-12">

                {/* -- Page Header -- */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800">Manager Dashboard</h2>
                        <p className="text-slate-500 mt-1">
                            MDO Overview · {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </p>
                    </div>

                    {activeTab === 'overview' && (
                        canExport ? (
                            <button
                                id="btn-export-excel"
                                onClick={handleExport}
                                disabled={exportLoading}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-md shadow-emerald-200 hover:shadow-lg transition-all disabled:opacity-60"
                            >
                                {exportLoading ? (
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                )}
                                Export Excel
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 text-slate-400 font-semibold text-sm cursor-not-allowed select-none">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Export Excel
                                <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-md">No orders yet</span>
                            </div>
                        )
                    )}
                </div>

                {/* -- Tab Switcher -- */}
                <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'overview'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                        </svg>
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('soh')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'soh'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        SOH Update
                        {sohConfigured && stockOutCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                                {stockOutCount}
                            </span>
                        )}
                        {!sohConfigured && (
                            <span className="bg-amber-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                                !
                            </span>
                        )}
                    </button>
                </div>

                {/* -- SOH Update Tab -- */}
                {activeTab === 'soh' && <SOHUpdate />}

                {/* -- Overview Tab -- */}
                {activeTab === 'overview' && (
                    <>
                        {/* SOH status banner */}
                        {!sohConfigured && (
                            <div
                                onClick={() => setActiveTab('soh')}
                                className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-5 py-3.5 cursor-pointer hover:bg-amber-100 transition-colors"
                            >
                                <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <p className="text-sm text-amber-800 font-semibold">
                                    SOH not configured yet — WDs can order unrestricted quantities.
                                    <span className="text-amber-600 underline ml-2">Click to update SOH →</span>
                                </p>
                            </div>
                        )}
                        {sohConfigured && lastUpdatedAt && (
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                SOH last updated: {new Date(lastUpdatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                {stockOutCount > 0 && <span className="text-red-500 font-semibold ml-1">· {stockOutCount} SKU(s) stock out</span>}
                            </div>
                        )}

                        {/* -- Summary KPI Cards -- */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {/* WDs Ordered */}
                            <div
                                id="kpi-wds-ordered"
                                onClick={() => setFilter(f => f === 'ordered' ? 'all' : 'ordered')}
                                className={`rounded-2xl border-2 p-5 cursor-pointer transition-all duration-200 hover:shadow-lg ${filter === 'ordered'
                                    ? 'border-amber-400 bg-amber-50 shadow-amber-100 shadow-md'
                                    : 'border-slate-200 bg-white hover:border-amber-300'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ordered</span>
                                </div>
                                <p className="text-3xl font-black text-slate-800">
                                    {orderedWDs}
                                    <span className="text-lg font-semibold text-slate-400">/{totalWDs}</span>
                                </p>
                                <p className="text-xs text-amber-600 font-semibold mt-0.5">
                                    {Math.round((orderedWDs / totalWDs) * 100)}% coverage
                                </p>
                                <p className="text-xs text-slate-400 mt-1">Click to filter ↓</p>
                            </div>

                            {/* Not Ordered */}
                            <div
                                id="kpi-wds-not-ordered"
                                onClick={() => setFilter(f => f === 'not_ordered' ? 'all' : 'not_ordered')}
                                className={`rounded-2xl border-2 p-5 cursor-pointer transition-all duration-200 hover:shadow-lg ${filter === 'not_ordered'
                                    ? 'border-red-400 bg-red-50 shadow-red-100 shadow-md'
                                    : 'border-slate-200 bg-white hover:border-red-300'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Not Ordered</span>
                                </div>
                                <p className="text-3xl font-black text-red-600">{notOrderedWDs}</p>
                                <p className="text-xs text-red-500 font-semibold mt-0.5">WDs pending</p>
                                <p className="text-xs text-slate-400 mt-1">Click to filter ↓</p>
                            </div>

                            {/* Total Remitted */}
                            <div className="rounded-2xl border-2 border-slate-200 bg-white p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Remitted</span>
                                </div>
                                <p className="text-2xl font-black text-green-600">{fmt(totalRemitted)}</p>
                                <p className="text-xs text-slate-400 mt-0.5">of {fmt(totalAmount)}</p>
                            </div>

                            {/* Pending Remittance */}
                            <div className="rounded-2xl border-2 border-slate-200 bg-white p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pending</span>
                                </div>
                                <p className="text-2xl font-black text-orange-500">{fmt(totalPending)}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{totalQty.toFixed(2)} Ms total qty</p>
                            </div>
                        </div>

                        {/* -- Order History Graph -- */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Order History — WD Coverage</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Number of WDs that placed orders each month</p>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 rounded bg-amber-400 inline-block" />
                                        WDs Ordered (qty bar)
                                    </span>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="flex items-end gap-4" style={{ height: '160px' }}>
                                    {history.map((h, i) => (
                                        <BarGroup
                                            key={i}
                                            label={h.month}
                                            ordered={h.ordered}
                                            total={h.total}
                                            qty={h.qty}
                                            amount={h.amount}
                                            maxQty={maxQty}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* -- WD Detail Table -- */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100 flex flex-col gap-3">
                                {/* Row 1: title + status filter buttons */}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">WD-wise Order &amp; Remittance Status</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Showing {dateFiltered.length} of {totalWDs} distributors
                                            {filter !== 'all' && <span className="ml-2 text-amber-500 font-semibold">({filter === 'ordered' ? 'Ordered only' : 'Not ordered only'})</span>}
                                            {dateFilter && <span className="ml-2 text-indigo-500 font-semibold">· Date: {new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        {(['all', 'ordered', 'not_ordered'] as const).map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setFilter(f)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === f
                                                    ? 'bg-amber-400 text-white shadow'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                    }`}
                                            >
                                                {f === 'all' ? 'All' : f === 'ordered' ? 'Ordered' : 'Not Ordered'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Row 2: date filter + export */}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-slate-100">
                                    <div className="flex items-center gap-2 flex-1">
                                        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Filter by Date</label>
                                        <input
                                            id="date-filter-wd"
                                            type="date"
                                            value={dateFilter}
                                            onChange={e => setDateFilter(e.target.value)}
                                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-slate-50 hover:bg-white"
                                        />
                                        {dateFilter && (
                                            <button
                                                onClick={() => setDateFilter('')}
                                                className="text-xs text-slate-400 hover:text-red-500 font-semibold transition-colors flex items-center gap-1"
                                                title="Clear date filter"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                Clear
                                            </button>
                                        )}
                                    </div>

                                    {/* Date-scoped export */}
                                    {dateFilter ? (
                                        dateFilteredDOs.length > 0 ? (
                                            <button
                                                id="btn-export-date-filtered"
                                                onClick={handleDateExport}
                                                disabled={dateExportLoading}
                                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm shadow-indigo-200 hover:shadow-md transition-all disabled:opacity-60 whitespace-nowrap"
                                            >
                                                {dateExportLoading ? (
                                                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                )}
                                                Download DOs ({dateFilteredDOs.length} Order{dateFilteredDOs.length !== 1 ? 's' : ''})
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed select-none whitespace-nowrap">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                Download DOs
                                                <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-md">No orders</span>
                                            </div>
                                        )
                                    ) : (
                                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed select-none whitespace-nowrap">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            Download DOs
                                            <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-md">Select date</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50">
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">WD</th>
                                            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Orders</th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty (Ms)</th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Order Amt</th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Remitted</th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending</th>
                                            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Remittance</th>
                                            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Order</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {dateFiltered.map((wd) => {
                                            const remitStatus = !wd.has_ordered ? 'none'
                                                : wd.pending_remittance === 0 ? 'full'
                                                    : 'partial';
                                            return (
                                                <tr key={wd.wd_id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${wd.has_ordered ? 'bg-green-400' : 'bg-red-400'}`} />
                                                            <div>
                                                                <p className="font-semibold text-slate-800 text-sm">{wd.wd_name}</p>
                                                                <p className="text-xs text-slate-400 font-mono">{wd.wd_code}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        {wd.has_ordered ? <span className="font-bold text-slate-700">{wd.total_orders}</span> : <span className="text-slate-300 font-semibold">—</span>}
                                                    </td>
                                                    <td className="px-5 py-4 text-right text-sm font-semibold text-slate-700">
                                                        {wd.has_ordered ? fmtQty(wd.total_qty_ms) : <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="px-5 py-4 text-right text-sm font-bold text-slate-800">
                                                        {wd.has_ordered ? fmt(wd.total_amount) : <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="px-5 py-4 text-right text-sm font-semibold text-green-600">
                                                        {wd.has_ordered ? fmt(wd.remitted_amount) : <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="px-5 py-4 text-right text-sm font-semibold">
                                                        {wd.has_ordered ? (
                                                            <span className={wd.pending_remittance > 0 ? 'text-orange-500' : 'text-slate-400'}>
                                                                {wd.pending_remittance > 0 ? fmt(wd.pending_remittance) : '—'}
                                                            </span>
                                                        ) : <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        {remitStatus === 'none' && (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-400">No Order</span>
                                                        )}
                                                        {remitStatus === 'full' && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                Fully Remitted
                                                            </span>
                                                        )}
                                                        {remitStatus === 'partial' && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-600">
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                Partial
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-center text-xs text-slate-500">
                                                        {formatDate(wd.last_order_date)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {dateFiltered.length === 0 && (
                                    <div className="py-12 text-center text-slate-400">
                                        <p className="font-medium">
                                            {dateFilter ? `No orders found on ${new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}` : 'No WDs match this filter'}
                                        </p>
                                        {dateFilter && (
                                            <p className="text-xs mt-1">Try a different date or <button onClick={() => setDateFilter('')} className="text-indigo-500 underline">clear the filter</button></p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {dateFiltered.length > 0 && (
                                <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-6 text-sm">
                                    <span className="text-slate-500">Total: <strong className="text-slate-700">{dateFiltered.reduce((s, w) => s + w.total_amount, 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</strong></span>
                                    <span className="text-slate-500">Remitted: <strong className="text-green-600">{dateFiltered.reduce((s, w) => s + w.remitted_amount, 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</strong></span>
                                    <span className="text-slate-500">Pending: <strong className="text-orange-500">{dateFiltered.reduce((s, w) => s + w.pending_remittance, 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</strong></span>
                                    <span className="text-slate-500">Total Qty: <strong className="text-slate-700">{dateFiltered.reduce((s, w) => s + w.total_qty_ms, 0).toFixed(2)} Ms</strong></span>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
};

import React, { useState, useMemo, useEffect } from 'react';
import { Layout } from '../components/shared/Layout';
import { useAuthStore } from '../stores/authStore';
import { useQCommerceStore } from '../stores/qcommerceStore';
import { supabase } from '../lib/supabase';
import { User, PurchaseOrder, POStatus, PaymentStatus } from '../lib/types';

// --- Status helpers -----------------------------------------------------------
const PO_STATUS_META: Record<POStatus, { label: string; color: string }> = {
    open:      { label: 'Open',      color: 'bg-indigo-100 text-indigo-700' },
    delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700'  },
    cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-600'  },
    expired:   { label: 'Expired',   color: 'bg-red-100 text-red-600'      },
    closed:    { label: 'Closed',    color: 'bg-teal-100 text-teal-700'    },
};
const PAYMENT_META: Record<PaymentStatus, { label: string; color: string }> = {
    unpaid:  { label: 'Unpaid',  color: 'bg-red-100 text-red-600'      },
    partial: { label: 'Partial', color: 'bg-amber-100 text-amber-700'  },
    paid:    { label: 'Paid',    color: 'bg-green-100 text-green-700'  },
};

const fmt   = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fdate = (s: string) =>
    s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// --- PO Detail Modal (read-only) ---------------------------------------------
const PODetailModal: React.FC<{ po: PurchaseOrder; onClose: () => void }> = ({ po, onClose }) => {
    const isDelivered = po.po_status === 'delivered' || po.po_status === 'closed';
    const totalOrd = po.line_items.reduce((s, l) => s + l.quantity, 0);
    const totalDel = po.line_items.reduce((s, l) => s + (l.delivered_quantity || 0), 0);
    const fillRate = isDelivered && totalOrd > 0
        ? ((totalDel / totalOrd) * 100).toFixed(1) + '%' : '—';
    const statusMeta = PO_STATUS_META[po.po_status] ?? { label: po.po_status, color: 'bg-slate-100 text-slate-600' };
    const payMeta   = PAYMENT_META[po.payment_status] ?? { label: po.payment_status, color: 'bg-slate-100 text-slate-600' };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-4">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-t-3xl px-6 py-5 flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-bold text-xl">{po.po_number}</h3>
                        <p className="text-violet-200 text-sm mt-0.5">{po.supplier_name}</p>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-5">


                    {/* Status badges */}
                    <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${statusMeta.color}`}>
                            PO Status: {statusMeta.label}
                        </span>
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${payMeta.color}`}>
                            Payment: {payMeta.label}
                        </span>
                        {po.planned_appointment_date && (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Appt: {fdate(po.planned_appointment_date)}
                            </span>
                        )}
                    </div>

                    {/* KPI Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'PO Date',     val: fdate(po.po_date) },
                            { label: 'Expiry',      val: fdate(po.expiry_date) },
                            { label: 'PO Value',    val: fmt(po.po_amount) },
                            { label: 'Ordered Qty', val: totalOrd.toString() },
                        ].map(({ label, val }) => (
                            <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-1">{label}</p>
                                <p className="text-sm font-bold text-slate-800">{val}</p>
                            </div>
                        ))}
                    </div>

                    {/* Delivery summary (if delivered) */}
                    {isDelivered && (
                        <div className="flex items-center gap-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                            <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-sm font-bold text-green-800">
                                    Delivered: {fmt(po.delivered_amount ?? 0)} · Del Qty: {totalDel} · Fill Rate: {fillRate}
                                </p>
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
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-indigo-600 uppercase bg-indigo-50/40">Ord Qty</th>
                                    {isDelivered && <>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-green-600 uppercase bg-green-50/40">Del Qty</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Del Value</th>
                                    </>}
                                    {!isDelivered && <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {po.line_items.map((item, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-mono font-bold text-slate-400">{item.sku_code}</p>
                                            <p className="text-sm font-semibold text-slate-800">{item.sku_name}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-500 font-medium">{fmt(item.unit_price)}</td>
                                        <td className="px-4 py-3 text-right font-black text-indigo-700 bg-indigo-50/20">{item.quantity}</td>
                                        {isDelivered && <>
                                            <td className="px-4 py-3 text-right font-black text-green-700 bg-green-50/20">{item.delivered_quantity ?? 0}</td>
                                            <td className="px-4 py-3 text-right font-bold text-green-800">{fmt(item.delivered_value ?? 0)}</td>
                                        </>}
                                        {!isDelivered && <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(item.total)}</td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {po.notes && (
                        <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-4 py-2 border border-slate-100">
                            <strong>Notes:</strong> {po.notes}
                        </p>
                    )}

                    <div className="flex justify-end">
                        <button onClick={onClose} className="px-5 py-2 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main Page ----------------------------------------------------------------
export const ManagerQComView: React.FC = () => {
    const { user } = useAuthStore();
    const { purchaseOrders } = useQCommerceStore();
    const [mappedWDs, setMappedWDs] = useState<User[]>([]);
    const [loadingWDs, setLoadingWDs] = useState(true);
    const [statusFilter, setStatusFilter] = useState<POStatus | 'all'>('all');
    const [search, setSearch] = useState('');
    const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
    const [wdFilter, setWdFilter] = useState<string>('all');

    // Fetch WDs mapped to this manager
    useEffect(() => {
        if (!user) return;
        const fetch = async () => {
            setLoadingWDs(true);
            const { data } = await supabase
                .from('users')
                .select('*')
                .eq('manager_id', user.id)
                .eq('role', 'user')
                .eq('status', 'active');
            if (data) setMappedWDs(data as User[]);
            setLoadingWDs(false);
        };
        fetch();
    }, [user]);

    const mappedWDIds = useMemo(() => new Set(mappedWDs.map(w => w.id)), [mappedWDs]);

    // All POs created by any mapped WD
    const allMappedPOs = useMemo(() =>
        purchaseOrders.filter(po => mappedWDIds.has(po.created_by)),
        [purchaseOrders, mappedWDIds]
    );

    // ---- KPI Stats ----
    const totalPOs     = allMappedPOs.length;
    const openCount    = allMappedPOs.filter(p => p.po_status === 'open').length;
    const closedCount  = allMappedPOs.filter(p => p.po_status === 'closed').length;
    const deliveredCount = allMappedPOs.filter(p => p.po_status === 'delivered').length;
    const totalValue   = allMappedPOs.filter(p => !['cancelled', 'expired'].includes(p.po_status)).reduce((s, p) => s + p.po_amount, 0);
    const deliveredAmt = allMappedPOs.filter(p => p.delivered_amount !== undefined).reduce((s, p) => s + (p.delivered_amount ?? 0), 0);

    const fillRate = useMemo(() => {
        const dPOs = allMappedPOs.filter(p => p.po_status === 'delivered' || p.po_status === 'closed');
        let ordQ = 0, delQ = 0;
        dPOs.forEach(p => p.line_items.forEach(l => { ordQ += l.quantity; delQ += (l.delivered_quantity || 0); }));
        return ordQ > 0 ? ((delQ / ordQ) * 100).toFixed(1) + '%' : '—';
    }, [allMappedPOs]);

    // ---- Status breakdown bar ----
    const statusBreakdown: { status: POStatus; count: number; meta: typeof PO_STATUS_META[POStatus] }[] = useMemo(() => {
        return (Object.keys(PO_STATUS_META) as POStatus[]).map(s => ({
            status: s,
            count: allMappedPOs.filter(p => p.po_status === s).length,
            meta: PO_STATUS_META[s],
        })).filter(x => x.count > 0);
    }, [allMappedPOs]);

    // ---- Filtered table ----
    const filteredPOs = useMemo(() => {
        return allMappedPOs.filter(po => {
            if (statusFilter !== 'all' && po.po_status !== statusFilter) return false;
            if (wdFilter !== 'all' && po.created_by !== wdFilter) return false;
            if (search) {
                const q = search.toLowerCase();
                return po.po_number.toLowerCase().includes(q) || po.supplier_name.toLowerCase().includes(q);
            }
            return true;
        });
    }, [allMappedPOs, statusFilter, wdFilter, search]);

    // WD name lookup
    const wdName = (id: string) => mappedWDs.find(w => w.id === id)?.wd_name || mappedWDs.find(w => w.id === id)?.username || id.slice(0, 8);

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
                            <h2 className="text-3xl font-black text-slate-800">Q-Commerce Analytics</h2>
                        </div>
                        <p className="text-slate-500 ml-12">
                            Manager View · {mappedWDs.length} distributor{mappedWDs.length !== 1 ? 's' : ''} · Fill Rate:{' '}
                            <strong className="text-violet-600">{fillRate}</strong>
                        </p>
                    </div>

                </div>

                {loadingWDs ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" />
                    </div>
                ) : (
                    <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {[
                                { label: 'Total POs',    value: totalPOs,          color: 'bg-violet-100 text-violet-700', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                                { label: 'PO Value',     value: fmt(totalValue),   color: 'bg-emerald-100 text-emerald-700', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                                { label: 'Open',         value: openCount,         color: 'bg-indigo-100 text-indigo-700', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                                { label: 'Delivered',    value: deliveredCount,    color: 'bg-amber-100 text-amber-700', icon: 'M5 13l4 4L19 7' },
                                { label: 'Closed',       value: closedCount,       color: 'bg-teal-100 text-teal-700', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                                { label: 'Del. Amount',  value: fmt(deliveredAmt), color: 'bg-green-100 text-green-700', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
                            ].map(({ label, value, color, icon }) => (
                                <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                                            </svg>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                                    </div>
                                    <p className="text-xl font-black text-slate-800">{value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Status Breakdown */}
                        {statusBreakdown.length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                <h3 className="text-base font-bold text-slate-700 mb-4">PO Status Breakdown</h3>
                                <div className="flex flex-wrap gap-3">
                                    {statusBreakdown.map(({ status, count, meta }) => (
                                        <button
                                            key={status}
                                            onClick={() => setStatusFilter(sf => sf === status ? 'all' : status)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                                                statusFilter === status
                                                    ? 'border-violet-400 bg-violet-50 text-violet-700 shadow-sm'
                                                    : 'border-slate-200 hover:border-violet-300 text-slate-600'
                                            }`}
                                        >
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${meta.color}`}>
                                                {meta.label}
                                            </span>
                                            <span className="font-black text-slate-800">{count}</span>
                                            {totalPOs > 0 && (
                                                <span className="text-xs text-slate-400">
                                                    ({((count / totalPOs) * 100).toFixed(0)}%)
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                {/* Fill-rate progress bar */}
                                {fillRate !== '—' && (
                                    <div className="mt-5">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-slate-500">Overall Fill Rate</span>
                                            <span className="text-sm font-black text-violet-600">{fillRate}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2.5">
                                            <div
                                                className="bg-gradient-to-r from-violet-500 to-purple-600 h-2.5 rounded-full transition-all duration-700"
                                                style={{ width: fillRate }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* PO Table */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Purchase Orders</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Showing {filteredPOs.length} of {allMappedPOs.length} PO{allMappedPOs.length !== 1 ? 's' : ''} · Click a row to view details
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Search */}
                                    <div className="relative">
                                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <input
                                            placeholder="Search PO or supplier…"
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            className="pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all w-44"
                                        />
                                    </div>
                                    {/* WD Filter */}
                                    <select
                                        value={wdFilter}
                                        onChange={e => setWdFilter(e.target.value)}
                                        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
                                    >
                                        <option value="all">All Distributors</option>
                                        {mappedWDs.map(w => (
                                            <option key={w.id} value={w.id}>{w.wd_name || w.username}</option>
                                        ))}
                                    </select>
                                    {/* Status filter */}
                                    <select
                                        value={statusFilter}
                                        onChange={e => setStatusFilter(e.target.value as any)}
                                        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
                                    >
                                        <option value="all">All Status</option>
                                        {(Object.keys(PO_STATUS_META) as POStatus[]).map(s => (
                                            <option key={s} value={s}>{PO_STATUS_META[s].label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50">
                                            {['PO Number', 'Distributor', 'Supplier', 'PO Date', 'Expiry', 'Appt.', 'PO Amount', 'Ord Qty', 'Del Qty', 'PO Status', 'Payment'].map(h => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredPOs.length === 0 ? (
                                            <tr>
                                                <td colSpan={11} className="py-14 text-center text-slate-400">
                                                    <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                                    </svg>
                                                    <p className="font-medium">No purchase orders found</p>
                                                    <p className="text-xs mt-1">
                                                        {allMappedPOs.length === 0
                                                            ? 'No Q-Commerce POs have been uploaded by your distributors yet'
                                                            : 'Try adjusting your filters'}
                                                    </p>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredPOs.map(po => {
                                                const ordQty = po.line_items.reduce((s, l) => s + l.quantity, 0);
                                                const delQty = po.line_items.reduce((s, l) => s + (l.delivered_quantity || 0), 0);
                                                const hasDelivery = po.po_status === 'delivered' || po.po_status === 'closed';
                                                const sMeta = PO_STATUS_META[po.po_status] ?? { label: po.po_status, color: 'bg-slate-100 text-slate-600' };
                                                const pMeta = PAYMENT_META[po.payment_status] ?? { label: po.payment_status, color: 'bg-slate-100 text-slate-600' };
                                                return (
                                                    <tr
                                                        key={po.id}
                                                        onClick={() => setSelectedPO(po)}
                                                        className="hover:bg-violet-50/60 cursor-pointer transition-colors"
                                                    >
                                                        <td className="px-4 py-3">
                                                            <span className="font-mono text-sm font-bold text-violet-700">{po.po_number}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-semibold text-slate-700 max-w-[120px] truncate">
                                                            {wdName(po.created_by)}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-slate-700 font-bold max-w-[140px] truncate">{po.supplier_name}</td>
                                                        <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap font-medium">{fdate(po.po_date)}</td>
                                                        <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap font-medium">{fdate(po.expiry_date)}</td>
                                                        <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap font-medium">
                                                            {fdate(po.planned_appointment_date) || <span className="text-slate-300">—</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-black text-slate-800 whitespace-nowrap">
                                                            {fmt(po.po_amount)}
                                                            {hasDelivery && po.delivered_amount !== undefined && (
                                                                <div className="text-[10px] text-green-600 font-semibold">Del: {fmt(po.delivered_amount)}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-center font-black text-indigo-700 bg-indigo-50/20 text-sm">{ordQty}</td>
                                                        <td className="px-4 py-3 text-center text-sm font-black bg-green-50/20">
                                                            {hasDelivery ? <span className="text-green-700">{delQty}</span> : <span className="text-slate-300">—</span>}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide ${sMeta.color}`}>
                                                                {sMeta.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide ${pMeta.color}`}>
                                                                {pMeta.label}
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
                    </>
                )}
            </div>

            {/* Read-only PO Detail Modal */}
            {selectedPO && <PODetailModal po={selectedPO} onClose={() => setSelectedPO(null)} />}
        </Layout>
    );
};

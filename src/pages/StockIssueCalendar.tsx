import React, { useState, useMemo } from 'react';
import { Layout } from '../components/shared/Layout';
import { useMDOStore } from '../stores/mdoStore';

const fdate = (s: string) =>
    s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmt = (n: number) =>
    '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

// Status badge helpers
const getStatusBadge = (order: { remittance_confirmed: boolean; status: string }) => {
    if (order.status === 'cancelled') return { label: 'Cancelled', cls: 'bg-red-100 text-red-600' };
    if (order.remittance_confirmed) return { label: 'Remitted', cls: 'bg-green-100 text-green-700' };
    return { label: 'Pending', cls: 'bg-amber-100 text-amber-700' };
};

export const StockIssueCalendar: React.FC = () => {
    const { orderHistory } = useMDOStore();
    const [selectedDate, setSelectedDate] = useState<string>('');

    // Build set of dates that have orders (for the mini dot indicator)
    const datesWithOrders = useMemo(() => {
        const s = new Set<string>();
        orderHistory.forEach(o => {
            if (o.created_at) s.add(o.created_at.slice(0, 10));
        });
        return s;
    }, [orderHistory]);

    const filteredOrders = useMemo(() => {
        if (!selectedDate) return [];
        return orderHistory.filter(o => o.created_at?.slice(0, 10) === selectedDate);
    }, [orderHistory, selectedDate]);

    const totalQty = filteredOrders.reduce((s, o) => s + o.total_qty_ms, 0);
    const totalAmt = filteredOrders.reduce((s, o) => s + o.total_amount, 0);
    const remittedAmt = filteredOrders
        .filter(o => o.remittance_confirmed)
        .reduce((s, o) => s + o.total_amount, 0);

    return (
        <Layout>
            <div className="space-y-8 pb-12">
                {/* Header */}
                <div>
                    <h2 className="text-3xl font-black text-slate-800">Stock Issue Calendar</h2>
                    <p className="text-slate-500 mt-1">View order status by date</p>
                </div>

                {/* Date Picker Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-700">Select Date</p>
                                <p className="text-xs text-slate-400">Choose a date to see stock issue status</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 sm:ml-auto">
                            <input
                                id="calendar-date-picker"
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all bg-slate-50 hover:bg-white font-semibold"
                            />
                            {selectedDate && (
                                <button
                                    onClick={() => setSelectedDate('')}
                                    className="text-xs text-slate-400 hover:text-red-500 font-semibold transition-colors flex items-center gap-1"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Results */}
                {!selectedDate ? (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="text-slate-500 font-medium">Select a date above to view stock issue status</p>
                        <p className="text-slate-400 text-sm mt-1">Order history across all WDs will be shown here</p>
                    </div>
                ) : (
                    <>
                        {/* Summary KPIs */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { label: 'Orders', val: filteredOrders.length.toString(), cls: 'text-slate-800' },
                                { label: 'Total Qty (Ms)', val: totalQty.toFixed(2), cls: 'text-indigo-700' },
                                { label: 'Total Amount', val: fmt(totalAmt), cls: 'text-slate-800' },
                                { label: 'Remitted', val: fmt(remittedAmt), cls: 'text-green-600' },
                            ].map(({ label, val, cls }) => (
                                <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
                                    <p className={`text-2xl font-black ${cls}`}>{val}</p>
                                </div>
                            ))}
                        </div>

                        {/* Orders Table */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">
                                        Orders on{' '}
                                        <span className="text-amber-600">
                                            {fdate(selectedDate + 'T00:00:00')}
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} found
                                    </p>
                                </div>
                            </div>

                            {filteredOrders.length === 0 ? (
                                <div className="py-12 text-center text-slate-400">
                                    <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="font-medium">No orders on this date</p>
                                    <p className="text-xs mt-1">Try selecting a different date</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-slate-50">
                                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Order ID</th>
                                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Month</th>
                                                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty (Ms)</th>
                                                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                                                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredOrders.map((o, i) => {
                                                const badge = getStatusBadge(o);
                                                return (
                                                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-5 py-4 text-sm text-slate-400 font-medium">{i + 1}</td>
                                                        <td className="px-5 py-4">
                                                            <p className="text-xs font-mono text-slate-500">{o.id.slice(0, 12)}…</p>
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <span className="text-sm font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
                                                                {o.month}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-4 text-right text-sm font-semibold text-slate-700">
                                                            {o.total_qty_ms.toFixed(2)} Ms
                                                        </td>
                                                        <td className="px-5 py-4 text-right text-sm font-bold text-slate-800">
                                                            {fmt(o.total_amount)}
                                                        </td>
                                                        <td className="px-5 py-4 text-center">
                                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
                                                                {badge.label}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-slate-200 bg-slate-50">
                                                <td colSpan={3} className="px-5 py-3 text-right text-sm font-bold text-slate-600">Totals</td>
                                                <td className="px-5 py-3 text-right text-sm font-black text-indigo-700">{totalQty.toFixed(2)} Ms</td>
                                                <td className="px-5 py-3 text-right text-sm font-black text-slate-800">{fmt(totalAmt)}</td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
};

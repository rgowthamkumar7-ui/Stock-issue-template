import React, { useMemo } from 'react';

interface GraphDataPoint {
    month: string;
    label: string;
    qty: number;
    amt: number;
}

interface OrderHistoryGraphProps {
    data: GraphDataPoint[];
}

export const OrderHistoryGraph: React.FC<OrderHistoryGraphProps> = ({ data }) => {
    const maxQty = useMemo(() => Math.max(...data.map(d => d.qty), 1), [data]);
    const maxAmt = useMemo(() => Math.max(...data.map(d => d.amt), 1), [data]);

    const hasData = data.some(d => d.qty > 0);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Order History</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Last 6 months</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                        Qty (Ms)
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" />
                        Amount (₹)
                    </span>
                </div>
            </div>

            <div className="p-6">
                {!hasData ? (
                    <div className="h-48 flex flex-col items-center justify-center text-slate-400">
                        <svg className="w-12 h-12 mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="font-medium">No order history yet</p>
                        <p className="text-sm text-slate-300 mt-0.5">Place your first order to see data here</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Qty Bar Chart */}
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Quantity (Ms)</p>
                            <div className="flex items-end gap-3 h-32">
                                {data.map((point, i) => {
                                    const heightPct = maxQty > 0 ? (point.qty / maxQty) * 100 : 0;
                                    return (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                                            <div className="relative w-full" style={{ height: '8rem' }}>
                                                <div
                                                    className="absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-amber-400 to-amber-300 transition-all duration-700 ease-out group-hover:from-amber-500 group-hover:to-amber-400"
                                                    style={{ height: `${heightPct}%`, minHeight: point.qty > 0 ? 4 : 0 }}
                                                />
                                                {point.qty > 0 && (
                                                    <div className="absolute bottom-full mb-1 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                                        <span className="bg-slate-800 text-white text-xs px-2 py-0.5 rounded-lg whitespace-nowrap">
                                                            {point.qty.toFixed(2)} Ms
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-xs text-slate-400 font-medium">{point.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Amount Bar Chart */}
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Amount (₹)</p>
                            <div className="flex items-end gap-3 h-32">
                                {data.map((point, i) => {
                                    const heightPct = maxAmt > 0 ? (point.amt / maxAmt) * 100 : 0;
                                    return (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                                            <div className="relative w-full" style={{ height: '8rem' }}>
                                                <div
                                                    className="absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-blue-400 to-blue-300 transition-all duration-700 ease-out group-hover:from-blue-500 group-hover:to-blue-400"
                                                    style={{ height: `${heightPct}%`, minHeight: point.amt > 0 ? 4 : 0 }}
                                                />
                                                {point.amt > 0 && (
                                                    <div className="absolute bottom-full mb-1 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                                        <span className="bg-slate-800 text-white text-xs px-2 py-0.5 rounded-lg whitespace-nowrap">
                                                            ₹{point.amt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-xs text-slate-400 font-medium">{point.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

import React from 'react';
import { MDOOrder } from '../../lib/types';

interface RemittancePopupProps {
    order: MDOOrder;
    onConfirm: () => void;
}

export const RemittancePopup: React.FC<RemittancePopupProps> = ({ order, onConfirm }) => {
    return (
        <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border border-amber-500/40 shadow-2xl overflow-hidden">
            {/* Decorative glow */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    {/* Icon + Title */}
                    <div className="flex items-center gap-4 flex-1">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/30 animate-pulse">
                            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">Remittance Required</p>
                            <p className="text-white text-2xl sm:text-3xl font-black">
                                ₹{order.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-slate-400 text-sm mt-1">
                                Order <span className="text-slate-300 font-mono">{order.id}</span> · {order.items.length} SKU(s) · {order.total_qty_ms.toFixed(2)} Ms
                            </p>
                        </div>
                    </div>

                    {/* Confirm Button */}
                    <button
                        id="btn-confirm-remittance"
                        onClick={onConfirm}
                        className="flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 hover:scale-105 transition-all duration-200 whitespace-nowrap"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Get Confirmation
                    </button>
                </div>

                {/* Order Items Summary */}
                <div className="mt-5 pt-5 border-t border-white/10">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Order Breakdown</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {order.items.map((item, i) => (
                            <div key={i} className="bg-white/5 rounded-xl px-4 py-2.5 border border-white/10">
                                <p className="text-slate-300 text-sm font-semibold truncate">{item.skuLabel}</p>
                                <div className="flex items-center justify-between mt-0.5">
                                    <p className="text-slate-400 text-xs">{item.quantityMs} Ms</p>
                                    <p className="text-amber-400 text-xs font-bold">
                                        ₹{(item.quantityMs * item.pricePerMs).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

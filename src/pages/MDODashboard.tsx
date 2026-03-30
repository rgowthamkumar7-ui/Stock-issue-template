import React, { useState, useMemo } from 'react';
import { Layout } from '../components/shared/Layout';
import { useAuthStore } from '../stores/authStore';
import { useMDOStore } from '../stores/mdoStore';
import { MDOSkuItem } from '../lib/types';
import { PlaceOrderForm } from '../components/mdo/PlaceOrderForm';
import { RemittancePopup } from '../components/mdo/RemittancePopup';
import { OrderHistoryGraph } from '../components/mdo/OrderHistoryGraph';




// Helper to get current month string YYYY-MM
const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonth = (m: string) => {
    const [year, month] = m.split('-');
    const d = new Date(Number(year), Number(month) - 1);
    return d.toLocaleString('default', { month: 'short', year: '2-digit' });
};

export const MDODashboard: React.FC = () => {
    const { user } = useAuthStore();
    const { orderHistory, addOrder, pendingOrder, confirmRemittance } = useMDOStore();
    const [showPlaceOrder, setShowPlaceOrder] = useState(false);

    const currentMonth = getCurrentMonth();

    // Monthly stats
    const monthlyStats = useMemo(() => {
        const thisMonthOrders = orderHistory.filter(o => o.month === currentMonth && o.status !== 'cancelled');
        const totalQty = thisMonthOrders.reduce((sum, o) => sum + o.total_qty_ms, 0);
        const totalAmt = thisMonthOrders.reduce((sum, o) => sum + o.total_amount, 0);
        const ordersCount = thisMonthOrders.length;
        return { totalQty, totalAmt, ordersCount };
    }, [orderHistory, currentMonth]);

    // Recent orders (last 10)
    const recentOrders = useMemo(() =>
        [...orderHistory].slice(0, 10),
        [orderHistory]
    );

    // Graph data: last 6 months
    const graphData = useMemo(() => {
        const months: string[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months.push(m);
        }
        return months.map(m => {
            const orders = orderHistory.filter(o => o.month === m && o.status !== 'cancelled');
            const qty = orders.reduce((s, o) => s + o.total_qty_ms, 0);
            const amt = orders.reduce((s, o) => s + o.total_amount, 0);
            return { month: m, label: formatMonth(m), qty, amt };
        });
    }, [orderHistory]);

    const hasPendingRemittance = pendingOrder && !pendingOrder.remittance_confirmed;

    const handleOrderPlaced = (items: MDOSkuItem[]) => {
        const totalQty = items.reduce((s, i) => s + i.quantityMs, 0);
        const totalAmt = items.reduce((s, i) => s + i.quantityMs * i.pricePerMs, 0);
        const order = {
            id: `MDO-${Date.now()}`,
            user_id: user?.id || 'demo',
            items,
            total_qty_ms: totalQty,
            total_amount: totalAmt,
            status: 'pending' as const,
            remittance_confirmed: false,
            created_at: new Date().toISOString(),
            month: getCurrentMonth(),
        };
        addOrder(order);
        setShowPlaceOrder(false);
    };

    return (
        <Layout>
            <div className="space-y-8 pb-12">
                {/* Remittance Popup */}
                {hasPendingRemittance && pendingOrder && (
                    <RemittancePopup
                        order={pendingOrder}
                        onConfirm={() => confirmRemittance(pendingOrder.id)}
                    />
                )}

                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800">Delivery Order (MDO)</h2>
                        <p className="text-slate-500 mt-1">Place and track your monthly delivery orders</p>
                    </div>
                    {!showPlaceOrder && user && (!user.wd_code || !user.wd_name) ? (
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-semibold text-red-500 mb-1 bg-red-50 px-2 py-1 rounded">Profile incomplete</span>
                            <button
                                disabled
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-200 text-slate-400 font-bold shadow-sm cursor-not-allowed"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Place Order
                            </button>
                            <p className="text-xs text-slate-400 mt-1">Please set your WD Code and Name in <strong>My Profile</strong> on the Home page</p>
                        </div>
                    ) : !showPlaceOrder && (
                        <button
                            id="btn-place-order"
                            onClick={() => setShowPlaceOrder(true)}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold shadow-lg shadow-amber-200 hover:shadow-xl hover:shadow-amber-300 hover:scale-105 transition-all duration-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Place Order
                        </button>
                    )}
                </div>

                {/* Place Order Form */}
                {showPlaceOrder && (
                    <PlaceOrderForm
                        onSubmit={handleOrderPlaced}
                        onCancel={() => setShowPlaceOrder(false)}
                    />
                )}

                {/* Monthly Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-slate-500">This Month Orders</span>
                        </div>
                        <p className="text-3xl font-black text-slate-800">{monthlyStats.ordersCount}</p>
                        <p className="text-xs text-slate-400 mt-1">orders placed</p>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-slate-500">Total Qty (Ms)</span>
                        </div>
                        <p className="text-3xl font-black text-slate-800">{monthlyStats.totalQty.toFixed(2)}</p>
                        <p className="text-xs text-slate-400 mt-1">thousand sticks</p>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-slate-500">Total Amount</span>
                        </div>
                        <p className="text-3xl font-black text-slate-800">
                            ₹{monthlyStats.totalAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">this month</p>
                    </div>
                </div>

                {/* Order History Graph */}
                <OrderHistoryGraph data={graphData} />

                {/* Recent Orders Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800">Recent Orders</h3>
                    </div>

                    {recentOrders.length === 0 ? (
                        <div className="py-16 text-center">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <p className="text-slate-400 font-medium">No orders yet</p>
                            <p className="text-slate-300 text-sm mt-1">Place your first order using the button above</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Order ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">SKUs</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty (Ms)</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {recentOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-sm text-slate-600">{order.id}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {new Date(order.created_at).toLocaleDateString('en-IN')}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{order.items.length} SKU(s)</td>
                                            <td className="px-6 py-4 text-sm text-slate-700 font-semibold text-right">
                                                {order.total_qty_ms.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-800 text-right">
                                                ₹{order.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${order.status === 'confirmed'
                                                    ? 'bg-green-100 text-green-700'
                                                    : order.status === 'cancelled'
                                                        ? 'bg-red-100 text-red-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {order.status === 'confirmed' ? '✓ Confirmed' : order.status === 'cancelled' ? 'Cancelled' : '⏳ Pending'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

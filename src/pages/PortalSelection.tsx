import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/shared/Layout';
import { useAuthStore } from '../stores/authStore';
import { useMDOStore } from '../stores/mdoStore';
import { useQCommerceStore } from '../stores/qcommerceStore';

export const PortalSelection: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { pendingOrder } = useMDOStore();
    const { getUserAccess } = useQCommerceStore();

    const hasPendingRemittance = pendingOrder && !pendingOrder.remittance_confirmed;

    // Get access permissions for current user (default: stock_issue+mdo ON, qcommerce OFF)
    const access = user ? getUserAccess(user.id) : { stock_issue: true, mdo: true, qcommerce: false };

    return (
        <Layout>
            <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center py-12 px-4">
                {/* Welcome Banner */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-slate-800 mb-2">
                        Welcome back, <span className="text-amber-500">{user?.username}</span>
                    </h1>
                    <p className="text-slate-500 text-lg">Select a module to get started</p>
                </div>

                {/* Remittance Alert Banner */}
                {hasPendingRemittance && (
                    <div
                        onClick={() => navigate('/mdo')}
                        className="mb-8 w-full max-w-3xl cursor-pointer group"
                    >
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 rounded-2xl p-5 flex items-center gap-4 shadow-lg shadow-amber-100 hover:shadow-xl hover:shadow-amber-200 transition-all duration-300 hover:scale-[1.01]">
                            <div className="w-12 h-12 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0 animate-pulse">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-amber-800 text-lg">💰 Remittance Pending</p>
                                <p className="text-amber-700">
                                    Amount to remit: <span className="font-black text-xl">₹{pendingOrder!.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </p>
                                <p className="text-amber-600 text-sm mt-0.5">Click here to confirm your order remittance →</p>
                            </div>
                            <div className="flex-shrink-0">
                                <svg className="w-6 h-6 text-amber-500 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                )}

                {/* Portal Cards */}
                <div className={`grid grid-cols-1 gap-8 w-full max-w-4xl ${access.qcommerce ? 'md:grid-cols-3' : 'md:grid-cols-2 max-w-3xl'}`}>

                    {/* Stock Issue Portal */}
                    {access.stock_issue !== false && (
                        <button
                            id="portal-stock-issue"
                            onClick={() => navigate('/dashboard')}
                            className="group relative bg-white rounded-3xl border-2 border-slate-200 hover:border-primary-400 shadow-lg hover:shadow-2xl hover:shadow-primary-100 transition-all duration-300 hover:-translate-y-2 p-8 text-left overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl" />
                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mb-6 shadow-lg shadow-primary-200 group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-primary-700 transition-colors">
                                    Update Stock Issue Portal
                                </h2>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    Upload sales files, manage templates, and generate stock issue reports for your distributor team.
                                </p>
                                <div className="mt-6 flex items-center gap-2 text-primary-600 font-semibold text-sm group-hover:gap-3 transition-all">
                                    Open Portal
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </button>
                    )}

                    {/* MDO Portal */}
                    {access.mdo !== false && (
                        <button
                            id="portal-mdo"
                            onClick={() => navigate('/mdo')}
                            className="group relative bg-white rounded-3xl border-2 border-slate-200 hover:border-amber-400 shadow-lg hover:shadow-2xl hover:shadow-amber-100 transition-all duration-300 hover:-translate-y-2 p-8 text-left overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl" />
                            {hasPendingRemittance && (
                                <span className="absolute top-4 right-4 w-3 h-3 bg-amber-400 rounded-full animate-ping" />
                            )}
                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-6 shadow-lg shadow-amber-200 group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-amber-600 transition-colors">
                                    Place Delivery Order (MDO)
                                </h2>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    Place and manage delivery orders for multiple SKUs, track monthly quantities and view your order history.
                                </p>
                                <div className="mt-6 flex items-center gap-2 text-amber-600 font-semibold text-sm group-hover:gap-3 transition-all">
                                    Open MDO
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </button>
                    )}

                    {/* Q-Commerce Portal — Only visible if admin granted access */}
                    {access.qcommerce && (
                        <button
                            id="portal-qcommerce"
                            onClick={() => navigate('/qcommerce')}
                            className="group relative bg-white rounded-3xl border-2 border-slate-200 hover:border-violet-400 shadow-lg hover:shadow-2xl hover:shadow-violet-100 transition-all duration-300 hover:-translate-y-2 p-8 text-left overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl" />
                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center mb-6 shadow-lg shadow-violet-200 group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-violet-700 transition-colors">
                                    Q-Commerce Dashboard
                                </h2>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    Manage purchase orders for Q-Commerce platforms like Blinkit, Zepto, and Swiggy Instamart.
                                </p>
                                <div className="mt-6 flex items-center gap-2 text-violet-600 font-semibold text-sm group-hover:gap-3 transition-all">
                                    Open Q-Commerce
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </button>
                    )}
                </div>
            </div>
        </Layout>
    );
};

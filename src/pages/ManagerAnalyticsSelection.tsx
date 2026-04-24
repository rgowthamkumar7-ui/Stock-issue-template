import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/shared/Layout';
import { useAuthStore } from '../stores/authStore';

const Card: React.FC<{
    id: string;
    onClick: () => void;
    borderHover: string;
    bgHover: string;
    iconGradient: string;
    iconShadow: string;
    iconPath: string;
    title: string;
    description: string;
    ctaColor: string;
    cta: string;
    badge?: string;
}> = ({ id, onClick, borderHover, bgHover, iconGradient, iconShadow, iconPath, title, description, ctaColor, cta, badge }) => (
    <button
        id={id}
        onClick={onClick}
        className={`group relative bg-white rounded-3xl border-2 border-slate-200 ${borderHover} shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 p-8 text-left overflow-hidden`}
    >
        <div className={`absolute inset-0 bg-gradient-to-br ${bgHover} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl`} />
        <div className="relative z-10 flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${iconGradient} flex items-center justify-center mb-6 shadow-lg ${iconShadow} group-hover:scale-110 transition-transform duration-300`}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
                </svg>
            </div>
            <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-bold text-slate-800 group-hover:text-slate-900 transition-colors">{title}</h2>
                {badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase tracking-wide">
                        {badge}
                    </span>
                )}
            </div>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs">{description}</p>
            <div className={`mt-6 flex items-center gap-2 ${ctaColor} font-semibold text-sm group-hover:gap-3 transition-all`}>
                {cta}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </div>
        </div>
    </button>
);

export const ManagerAnalyticsSelection: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    return (
        <Layout>
            <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center py-12 px-4">
                {/* Welcome Banner */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-slate-800 mb-2">
                        Welcome,{' '}
                        <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                            {user?.username}
                        </span>
                    </h1>
                    <p className="text-slate-500 text-lg">Select a section to manage your distributors</p>
                </div>

                {/* Cards — 3 column */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">

                    {/* MDO Overview */}
                    <Card
                        id="card-manager-mdo"
                        onClick={() => navigate('/manager-dashboard-mdo')}
                        borderHover="hover:border-amber-400"
                        bgHover="from-amber-50"
                        iconGradient="from-amber-400 to-orange-500"
                        iconShadow="shadow-amber-200"
                        iconPath="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                        title="MDO Overview"
                        description="Track delivery orders, WD coverage, remittance status, and update Stock on Hand for your distributors."
                        ctaColor="text-amber-600"
                        cta="Open MDO"
                    />

                    {/* Q-Commerce Analytics */}
                    <Card
                        id="card-manager-qcom"
                        onClick={() => navigate('/manager-qcom')}
                        borderHover="hover:border-violet-400"
                        bgHover="from-violet-50"
                        iconGradient="from-violet-600 to-purple-700"
                        iconShadow="shadow-violet-200"
                        iconPath="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                        title="Q-Commerce Analytics"
                        description="View purchase order performance, KPIs, fill rates and the complete Q-Commerce business of your distributors."
                        ctaColor="text-violet-600"
                        cta="Open Analytics"
                    />

                    {/* Stock Issue Calendar */}
                    <Card
                        id="card-manager-calendar"
                        onClick={() => navigate('/stock-calendar')}
                        borderHover="hover:border-teal-400"
                        bgHover="from-teal-50"
                        iconGradient="from-teal-400 to-emerald-600"
                        iconShadow="shadow-teal-200"
                        iconPath="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        title="Stock Issue Calendar"
                        description="View stock issue order status by date. Quickly spot stock-outs, pending orders, and remittance status across WDs."
                        ctaColor="text-teal-600"
                        cta="Open Calendar"
                    />

                </div>
            </div>
        </Layout>
    );
};

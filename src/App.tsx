import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Login } from './pages/Login';
import { PortalSelection } from './pages/PortalSelection';
import { UserDashboard } from './pages/UserDashboard';
import { MDODashboard } from './pages/MDODashboard';
import { QCommerceDashboard } from './pages/QCommerceDashboard';
import { QCommerceMapping } from './pages/QCommerceMapping';
import { AdminDashboard } from './pages/AdminDashboard';
import { ManagerAnalyticsSelection } from './pages/ManagerAnalyticsSelection';
import { ManagerQComView } from './pages/ManagerQComView';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { StockIssueCalendar } from './pages/StockIssueCalendar';

function App() {
    const { checkAuth, loading, user } = useAuthStore();

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="text-center">
                    <div className="text-4xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-4">
                        LeanX
                    </div>
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-400 mx-auto mb-3"></div>
                    <p className="text-slate-400 text-sm">Loading Distributor Central...</p>
                </div>
            </div>
        );
    }

    return (
        <BrowserRouter>
            <Routes>
                {/* Public */}
                <Route path="/login" element={<Login />} />

                {/* Portal Selection (Home) */}
                <Route
                    path="/home"
                    element={
                        <ProtectedRoute>
                            <PortalSelection />
                        </ProtectedRoute>
                    }
                />

                {/* Stock Issue Portal */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <UserDashboard />
                        </ProtectedRoute>
                    }
                />

                {/* MDO – Place Delivery Order */}
                <Route
                    path="/mdo"
                    element={
                        <ProtectedRoute>
                            <MDODashboard />
                        </ProtectedRoute>
                    }
                />

                {/* Q-Commerce Dashboard */}
                <Route
                    path="/qcommerce"
                    element={
                        <ProtectedRoute>
                            <QCommerceDashboard />
                        </ProtectedRoute>
                    }
                />
                
                {/* Q-Commerce Mapping */}
                <Route
                    path="/qcommerce-mapping"
                    element={
                        <ProtectedRoute>
                            <QCommerceMapping />
                        </ProtectedRoute>
                    }
                />

                {/* Manager */}
                <Route
                    path="/manager-home"
                    element={
                        <ProtectedRoute requireManager>
                            <ManagerAnalyticsSelection />
                        </ProtectedRoute>
                    }
                />

                {/* Manager Analytics - Stock Issue Calendar */}
                <Route
                    path="/stock-calendar"
                    element={
                        <ProtectedRoute requireManager>
                            <StockIssueCalendar />
                        </ProtectedRoute>
                    }
                />

                {/* Manager – Q-Commerce analytics (read-only) */}
                <Route
                    path="/manager-qcom"
                    element={
                        <ProtectedRoute requireManager>
                            <ManagerQComView />
                        </ProtectedRoute>
                    }
                />

                {/* Manager – MDO dashboard */}
                <Route
                    path="/manager-dashboard-mdo"
                    element={
                        <ProtectedRoute requireManager>
                            <ManagerDashboard />
                        </ProtectedRoute>
                    }
                />

                {/* Admin */}
                <Route
                    path="/admin"
                    element={
                        <ProtectedRoute requireAdmin>
                            <AdminDashboard />
                        </ProtectedRoute>
                    }
                />

                {/* Default redirect */}
                <Route
                    path="/"
                    element={
                        user ? (
                            <Navigate
                                to={
                                    user.role === 'admin' ? '/admin'
                                        : user.role === 'manager' ? '/manager-home'
                                            : '/home'
                                }
                                replace
                            />
                        ) : (
                            <Navigate to="/login" replace />
                        )
                    }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;

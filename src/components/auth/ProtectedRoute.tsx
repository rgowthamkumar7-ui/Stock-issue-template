import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
    requireManager?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    requireAdmin = false,
    requireManager = false,
}) => {
    const { user, loading } = useAuthStore();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Admin-only route — redirect non-admins to their home
    if (requireAdmin && user.role !== 'admin') {
        return <Navigate to={user.role === 'manager' ? '/manager-home' : '/home'} replace />;
    }

    // Manager-only route — allow managers AND admins (admins can view everything)
    if (requireManager && user.role !== 'manager' && user.role !== 'admin') {
        return <Navigate to="/home" replace />;
    }

    return <>{children}</>;
};

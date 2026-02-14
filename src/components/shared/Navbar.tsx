import React from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';

export const Navbar: React.FC = () => {
    const { user, signOut } = useAuthStore();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    if (!user) return null;

    return (
        <nav className="bg-white shadow-md border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                            Stock Issue Template
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600">Welcome,</span>
                            <span className="font-semibold text-slate-800">{user.username}</span>
                            <span className={`badge ${user.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
                                {user.role.toUpperCase()}
                            </span>
                        </div>

                        <button
                            onClick={handleSignOut}
                            className="btn-secondary text-sm"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
};

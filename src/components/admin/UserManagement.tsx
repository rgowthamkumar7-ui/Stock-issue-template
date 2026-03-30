import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from '../../lib/types';
import { useAuthStore } from '../../stores/authStore';

export const UserManagement: React.FC = () => {
    const { user: currentUser } = useAuthStore();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form state
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<'admin' | 'manager' | 'user'>('user');

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setUsers(data as User[]);
        }
        setLoading(false);
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            // Create auth user
            const email = newUsername; // Input is now email
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password: newPassword,
            });

            if (authError) throw authError;

            if (!authData.user) {
                throw new Error('Failed to create user');
            }

            // Update the profile's role to what was selected
            await supabase
                .from('users')
                .update({ role: newRole })
                .eq('id', authData.user.id);

            // Give trigger a moment to process before reloading
            await new Promise(resolve => setTimeout(resolve, 1000));

            setSuccess('User created successfully!');
            setShowCreateModal(false);
            setNewUsername('');
            setNewPassword('');
            setNewRole('user');
            loadUsers();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleToggleStatus = async (userId: string, currentStatus: string) => {
        try {
            const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
            const { error } = await supabase
                .from('users')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', userId);

            if (error) throw error;

            setSuccess(`User ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully!`);
            loadUsers();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleResetPassword = async (userId: string, username: string) => {
        const newPassword = prompt(`Enter new password for ${username}:`);
        if (!newPassword || newPassword.length < 6) {
            if (newPassword && newPassword.length < 6) alert("Password must be at least 6 characters.");
            return;
        }

        try {
            // Update password securely using Postgres RPC (Service Role not required)
            const { error } = await supabase.rpc('admin_reset_password', {
                target_user_id: userId,
                new_password: newPassword
            });

            if (error) throw error;

            setSuccess(`Password for ${username} reset successfully!`);
        } catch (err) {
            setError('Failed to reset password. Please run the SQL migration in Supabase to enable this feature.');
        }
    };

    const handleUpdateRole = async (userId: string, role: string) => {
        try {
            const { error } = await supabase
                .from('users')
                .update({ role, updated_at: new Date().toISOString() })
                .eq('id', userId);

            if (error) throw error;
            setSuccess('Role updated successfully!');
            loadUsers();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleUpdateManager = async (userId: string, managerId: string) => {
        try {
            const { error } = await supabase
                .from('users')
                .update({ manager_id: managerId || null, updated_at: new Date().toISOString() })
                .eq('id', userId);

            if (error) throw error;
            setSuccess('Manager mapped successfully!');
            loadUsers();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const managers = users.filter(u => u.role === 'manager' && u.status === 'active');

    return (
        <div className="space-y-6">
            {/* Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                    {success}
                </div>
            )}

            {/* Header */}
            <div className="card">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">Users & Roles</h3>
                        <p className="text-sm text-slate-600">Manage user accounts, change roles and map managers to distributors</p>
                    </div>
                    <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                        Create User
                    </button>
                </div>
            </div>

            {/* Users Table */}
            <div className="card overflow-visible">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                ) : users.length === 0 ? (
                    <p className="text-slate-600 text-center py-8">No users found</p>
                ) : (
                    <div className="overflow-x-auto min-h-[300px]">
                        <table className="table">
                            <thead className="table-header">
                                <tr>
                                    <th className="table-header-cell">Username / Email</th>
                                    <th className="table-header-cell">Role</th>
                                    <th className="table-header-cell">Manager Mapping</th>
                                    <th className="table-header-cell">Status</th>
                                    <th className="table-header-cell">Created</th>
                                    <th className="table-header-cell">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="table-body">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="table-cell font-medium text-slate-800">
                                            {user.username}
                                            {user.wd_code && <span className="block text-xs text-amber-600">{user.wd_name} ({user.wd_code})</span>}
                                        </td>
                                        <td className="table-cell">
                                            <select
                                                value={user.role}
                                                onChange={e => handleUpdateRole(user.id, e.target.value)}
                                                disabled={user.id === currentUser?.id}
                                                className={`text-xs font-bold px-3 py-1.5 rounded-full border outline-none cursor-pointer ${
                                                    user.role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200 focus:ring-purple-200'
                                                    : user.role === 'manager' ? 'bg-blue-100 text-blue-700 border-blue-200 focus:ring-blue-200'
                                                    : 'bg-emerald-100 text-emerald-700 border-emerald-200 focus:ring-emerald-200'
                                                }`}
                                            >
                                                <option value="user">USER (DISTRIBUTOR)</option>
                                                <option value="manager">MANAGER</option>
                                                <option value="admin">ADMIN</option>
                                            </select>
                                        </td>
                                        <td className="table-cell">
                                            {user.role === 'user' ? (
                                                <select
                                                    value={user.manager_id || ''}
                                                    onChange={e => handleUpdateManager(user.id, e.target.value)}
                                                    className="w-full text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-primary-200"
                                                >
                                                    <option value="">-- No Manager Assigned --</option>
                                                    {managers.map(m => (
                                                        <option key={m.id} value={m.id}>
                                                            {m.username}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Not applicable</span>
                                            )}
                                        </td>
                                        <td className="table-cell">
                                            <span className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-error'}`}>
                                                {user.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="table-cell text-sm text-slate-500">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="table-cell">
                                            <div className="flex gap-3">
                                                {user.id !== currentUser?.id && (
                                                    <>
                                                        <button
                                                            onClick={() => handleToggleStatus(user.id, user.status)}
                                                            className={`text-sm font-semibold transition-colors ${
                                                                user.status === 'active' ? 'text-orange-500 hover:text-orange-700' : 'text-emerald-500 hover:text-emerald-700'
                                                            }`}
                                                        >
                                                            {user.status === 'active' ? 'Disable' : 'Enable'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleResetPassword(user.id, user.username)}
                                                            className="text-slate-500 hover:text-slate-800 font-semibold text-sm transition-colors"
                                                        >
                                                            Reset Pass
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                            Create New Account
                        </h3>

                        <form onSubmit={handleCreateUser} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all"
                                    placeholder="Enter email address"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                    Role
                                </label>
                                <select
                                    value={newRole}
                                    onChange={e => setNewRole(e.target.value as any)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all"
                                >
                                    <option value="user">User (Distributor)</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                    Temporary Password
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all"
                                    placeholder="Enter secure password"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="submit" className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-primary-500 to-primary-700 text-white font-bold shadow-lg shadow-primary-200 hover:shadow-xl hover:shadow-primary-300 hover:scale-[1.02] transition-all">
                                    Create User
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setNewUsername('');
                                        setNewPassword('');
                                        setError('');
                                    }}
                                    className="py-3 px-6 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

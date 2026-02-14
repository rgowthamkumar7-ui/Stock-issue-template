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

            // User profile is created automatically by database trigger
            // We wait a brief moment to ensure trigger completes before reloading
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Success message handled below


            setSuccess('User created successfully!');
            setShowCreateModal(false);
            setNewUsername('');
            setNewPassword('');
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
        if (!newPassword) return;

        try {
            // Update password in Supabase auth
            const { error } = await supabase.auth.admin.updateUserById(userId, {
                password: newPassword,
            });

            if (error) throw error;

            setSuccess('Password reset successfully!');
        } catch (err) {
            setError('Failed to reset password. This requires admin API access.');
        }
    };

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
                        <h3 className="text-lg font-semibold text-slate-800">Users</h3>
                        <p className="text-sm text-slate-600">Manage user accounts and permissions</p>
                    </div>
                    <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                        Create User
                    </button>
                </div>
            </div>

            {/* Users Table */}
            <div className="card">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                ) : users.length === 0 ? (
                    <p className="text-slate-600 text-center py-8">No users found</p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead className="table-header">
                                <tr>
                                    <th className="table-header-cell">Username</th>
                                    <th className="table-header-cell">Role</th>
                                    <th className="table-header-cell">Status</th>
                                    <th className="table-header-cell">Created</th>
                                    <th className="table-header-cell">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="table-body">
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td className="table-cell font-medium">{user.username}</td>
                                        <td className="table-cell">
                                            <span className={`badge ${user.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
                                                {user.role.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="table-cell">
                                            <span className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-error'}`}>
                                                {user.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="table-cell">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="table-cell">
                                            <div className="flex gap-2">
                                                {user.id !== currentUser?.id && (
                                                    <>
                                                        <button
                                                            onClick={() => handleToggleStatus(user.id, user.status)}
                                                            className="text-primary-600 hover:text-primary-800 font-medium text-sm"
                                                        >
                                                            {user.status === 'active' ? 'Disable' : 'Enable'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleResetPassword(user.id, user.username)}
                                                            className="text-slate-600 hover:text-slate-800 font-medium text-sm"
                                                        >
                                                            Reset Password
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Create New User</h3>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    className="input-field"
                                    placeholder="Enter email address"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="input-field"
                                    placeholder="Enter password"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="submit" className="btn-primary flex-1">
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
                                    className="btn-secondary"
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

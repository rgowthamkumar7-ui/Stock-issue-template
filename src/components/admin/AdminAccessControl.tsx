import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from '../../lib/types';
import { useQCommerceStore } from '../../stores/qcommerceStore';

const PORTAL_LABELS: { key: 'stock_issue' | 'mdo' | 'qcommerce'; label: string; description: string; color: string }[] = [
    {
        key: 'stock_issue',
        label: 'Stock Issue Portal',
        description: 'Upload sales files, generate stock issue reports.',
        color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
        key: 'mdo',
        label: 'MDO – Delivery Orders',
        description: 'Place and manage monthly delivery orders.',
        color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
        key: 'qcommerce',
        label: 'Q-Commerce Dashboard',
        description: 'Manage Q-Commerce purchase orders.',
        color: 'text-violet-600 bg-violet-50 border-violet-200',
    },
];

export const AdminAccessControl: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [savedMsg, setSavedMsg] = useState<string>('');

    const { getUserAccess, setUserAccess } = useQCommerceStore();

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .in('role', ['user', 'manager'])
                .order('created_at', { ascending: false });
            if (!error && data) setUsers(data as User[]);
            setLoading(false);
        };
        fetchUsers();
    }, []);

    const handleToggle = (userId: string, key: 'stock_issue' | 'mdo' | 'qcommerce') => {
        const current = getUserAccess(userId);
        setUserAccess(userId, { [key]: !current[key] });
        setSavedMsg(`Access updated for user.`);
        setTimeout(() => setSavedMsg(''), 2500);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Section Access Control</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Control which sections each user can access.</p>
                </div>
                {savedMsg && (
                    <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-xl border border-green-200 animate-pulse">
                        ✓ {savedMsg}
                    </span>
                )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3">
                {PORTAL_LABELS.map((p) => (
                    <div key={p.key} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${p.color}`}>
                        {p.label}
                    </div>
                ))}
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
                </div>
            ) : users.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No users found.</p>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                                    {PORTAL_LABELS.map((p) => (
                                        <th key={p.key} className="px-5 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            {p.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map((u) => {
                                    const access = getUserAccess(u.id);
                                    return (
                                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-bold">
                                                        {u.username[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-800 text-sm">{u.username}</p>
                                                        <p className="text-xs text-slate-400">{u.id.slice(0, 8)}…</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                    u.role === 'manager'
                                                        ? 'bg-indigo-100 text-indigo-700'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {u.role.toUpperCase()}
                                                </span>
                                            </td>
                                            {PORTAL_LABELS.map((p) => {
                                                const enabled = access[p.key] ?? (p.key !== 'qcommerce');
                                                return (
                                                    <td key={p.key} className="px-5 py-4 text-center">
                                                        <button
                                                            onClick={() => handleToggle(u.id, p.key)}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                                                                enabled ? 'bg-violet-600' : 'bg-slate-200'
                                                            }`}
                                                        >
                                                            <span
                                                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                                                                    enabled ? 'translate-x-6' : 'translate-x-1'
                                                                }`}
                                                            />
                                                        </button>
                                                        <p className={`text-xs font-semibold mt-1 ${enabled ? 'text-violet-600' : 'text-slate-400'}`}>
                                                            {enabled ? 'On' : 'Off'}
                                                        </p>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                <span className="font-bold">Note: </span>
                Access changes take effect the next time the user visits the portal selection page.
                Stock Issue and MDO are on by default; Q-Commerce requires explicit enable.
            </div>
        </div>
    );
};

import React, { useState } from 'react';
import { Layout } from '../components/shared/Layout';
import { UserManagement } from '../components/admin/UserManagement';
import { SKUMappingManager } from '../components/admin/SKUMappingManager';
import { DistributorReports } from '../components/admin/DistributorReports';

export const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'users' | 'sku' | 'reports'>('users');

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div className="card">
                    <h2 className="card-header">Admin Dashboard</h2>
                    <p className="text-slate-600">Manage users, SKU mappings, and view distributor reports</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-6 py-3 font-medium transition-colors ${activeTab === 'users'
                            ? 'border-b-2 border-primary-600 text-primary-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        User Management
                    </button>
                    <button
                        onClick={() => setActiveTab('sku')}
                        className={`px-6 py-3 font-medium transition-colors ${activeTab === 'sku'
                            ? 'border-b-2 border-primary-600 text-primary-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        SKU Mapping
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`px-6 py-3 font-medium transition-colors ${activeTab === 'reports'
                            ? 'border-b-2 border-primary-600 text-primary-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        Distributor Reports
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'users' && <UserManagement />}
                {activeTab === 'sku' && <SKUMappingManager />}
                {activeTab === 'reports' && <DistributorReports />}
            </div>
        </Layout>
    );
};

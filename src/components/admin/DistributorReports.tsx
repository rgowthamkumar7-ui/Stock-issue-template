import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User, UploadHistory, SalesSummary, SalesmanMapping, SKUMapping } from '../../lib/types';
import * as XLSX from 'xlsx';
import { downloadFile } from '../../lib/excelProcessor';

export const DistributorReports: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [uploads, setUploads] = useState<UploadHistory[]>([]);
    const [selectedUpload, setSelectedUpload] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadUsers();
    }, []);

    useEffect(() => {
        if (selectedUser) {
            loadUploads();
        }
    }, [selectedUser]);

    const loadUsers = async () => {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'user')
            .eq('status', 'active')
            .order('username', { ascending: true });

        if (!error && data) {
            setUsers(data as User[]);
        }
    };

    const loadUploads = async () => {
        if (!selectedUser) return;

        const { data, error } = await supabase
            .from('upload_history')
            .select('*')
            .eq('user_id', selectedUser)
            .eq('status', 'completed')
            .order('upload_date', { ascending: false });

        if (!error && data) {
            setUploads(data as UploadHistory[]);
        }
    };

    const handleDownloadRawSummary = async () => {
        if (!selectedUpload) return;

        try {
            setLoading(true);
            setError('');

            // Get sales summary
            const { data: summaryData, error: summaryError } = await supabase
                .from('sales_summary')
                .select('*')
                .eq('upload_id', selectedUpload);

            if (summaryError) throw summaryError;

            // Create Excel workbook
            const worksheet = XLSX.utils.json_to_sheet(
                (summaryData as SalesSummary[]).map((s) => ({
                    'DS Name': s.ds_name,
                    'Market SKU': s.market_sku,
                    'Total Invoice Qty': s.total_qty,
                }))
            );

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Raw Summary');

            // Generate blob
            const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });
            const buf = new ArrayBuffer(wbout.length);
            const view = new Uint8Array(buf);
            for (let i = 0; i < wbout.length; i++) {
                view[i] = wbout.charCodeAt(i) & 0xff;
            }
            const blob = new Blob([buf], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });

            // Download
            const upload = uploads.find((u) => u.id === selectedUpload);
            const fileName = `raw_summary_${upload?.sales_file_name || 'report'}.xlsx`;
            downloadFile(blob, fileName);

            setSuccess('Raw summary downloaded successfully!');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadMappedSummary = async () => {
        if (!selectedUpload) return;

        try {
            setLoading(true);
            setError('');

            // Get sales summary
            const { data: summaryData, error: summaryError } = await supabase
                .from('sales_summary')
                .select('*')
                .eq('upload_id', selectedUpload);

            if (summaryError) throw summaryError;

            // Get salesman mapping
            const { data: mappingData, error: mappingError } = await supabase
                .from('salesman_mapping')
                .select('*')
                .eq('upload_id', selectedUpload);

            if (mappingError) throw mappingError;

            // Get SKU mapping
            const { data: skuMappingData, error: skuMappingError } = await supabase
                .from('sku_mapping')
                .select('*');

            if (skuMappingError) throw skuMappingError;

            // Create lookup maps
            const dsToSurveyor = new Map<string, string>();
            (mappingData as SalesmanMapping[]).forEach((m) => {
                dsToSurveyor.set(m.ds_name, m.surveyor_name);
            });

            const skuToVariants = new Map<string, string[]>();
            (skuMappingData as SKUMapping[]).forEach((m) => {
                if (!skuToVariants.has(m.market_sku)) {
                    skuToVariants.set(m.market_sku, []);
                }
                skuToVariants.get(m.market_sku)!.push(m.variant_description);
            });

            // Transform data
            const mappedData: any[] = [];
            (summaryData as SalesSummary[]).forEach((sale) => {
                const surveyor = dsToSurveyor.get(sale.ds_name);
                const variants = skuToVariants.get(sale.market_sku) || [];

                if (surveyor && variants.length > 0) {
                    variants.forEach((variant) => {
                        mappedData.push({
                            SURVEYOR: surveyor,
                            'VARIANT DESCRIPTION': variant,
                            'Total Invoice Qty': sale.total_qty,
                        });
                    });
                }
            });

            // Create Excel workbook
            const worksheet = XLSX.utils.json_to_sheet(mappedData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Mapped Summary');

            // Generate blob
            const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });
            const buf = new ArrayBuffer(wbout.length);
            const view = new Uint8Array(buf);
            for (let i = 0; i < wbout.length; i++) {
                view[i] = wbout.charCodeAt(i) & 0xff;
            }
            const blob = new Blob([buf], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });

            // Download
            const upload = uploads.find((u) => u.id === selectedUpload);
            const fileName = `mapped_summary_${upload?.sales_file_name || 'report'}.xlsx`;
            downloadFile(blob, fileName);

            setSuccess('Mapped summary downloaded successfully!');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
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
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Distributor Reports</h3>
                <p className="text-sm text-slate-600">
                    Download raw or mapped summaries for any distributor's uploads
                </p>
            </div>

            {/* Selection */}
            <div className="card">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Select Distributor
                        </label>
                        <select
                            value={selectedUser}
                            onChange={(e) => {
                                setSelectedUser(e.target.value);
                                setSelectedUpload('');
                            }}
                            className="input-field"
                        >
                            <option value="">Choose a distributor</option>
                            {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                    {user.username}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Select Upload
                        </label>
                        <select
                            value={selectedUpload}
                            onChange={(e) => setSelectedUpload(e.target.value)}
                            className="input-field"
                            disabled={!selectedUser}
                        >
                            <option value="">Choose an upload</option>
                            {uploads.map((upload) => (
                                <option key={upload.id} value={upload.id}>
                                    {new Date(upload.upload_date).toLocaleDateString()} - {upload.sales_file_name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Download Options */}
            {selectedUpload && (
                <div className="card">
                    <h4 className="font-semibold text-slate-800 mb-4">Download Reports</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-slate-200 rounded-lg p-4">
                            <h5 className="font-medium text-slate-800 mb-2">Raw Summary</h5>
                            <p className="text-sm text-slate-600 mb-4">
                                DS Name, Market SKU, and Total Invoice Qty
                            </p>
                            <button
                                onClick={handleDownloadRawSummary}
                                disabled={loading}
                                className="btn-primary w-full"
                            >
                                {loading ? 'Downloading...' : 'Download Raw Summary'}
                            </button>
                        </div>

                        <div className="border border-slate-200 rounded-lg p-4">
                            <h5 className="font-medium text-slate-800 mb-2">SKU-Mapped Summary</h5>
                            <p className="text-sm text-slate-600 mb-4">
                                SURVEYOR, VARIANT DESCRIPTION, and Total Invoice Qty
                            </p>
                            <button
                                onClick={handleDownloadMappedSummary}
                                disabled={loading}
                                className="btn-primary w-full"
                            >
                                {loading ? 'Downloading...' : 'Download Mapped Summary'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

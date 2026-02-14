import React, { useState, useEffect } from 'react';
import { supabase, STORAGE_BUCKETS } from '../../lib/supabase';
import { FileUploader } from '../shared/FileUploader';
import { SKUMapping } from '../../lib/types';
import * as XLSX from 'xlsx';

export const SKUMappingManager: React.FC = () => {
    const [skuMappings, setSkuMappings] = useState<SKUMapping[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [mappingMode, setMappingMode] = useState<'table' | 'upload'>('table');

    // Edit/Add State
    const [editingSKU, setEditingSKU] = useState<SKUMapping | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newSKU, setNewSKU] = useState({ market_sku: '', variant_description: '' });

    const isDemoMode = import.meta.env.VITE_SUPABASE_URL?.includes('your-project');

    useEffect(() => {
        loadSKUMappings();
    }, []);

    const loadSKUMappings = async () => {
        setLoading(true);
        try {
            if (isDemoMode) {
                const { DEMO_SKU_MAPPINGS } = await import('../../lib/demoData');
                // Simulate fetch delay
                await new Promise(resolve => setTimeout(resolve, 500));

                // Merge with any local modifications if we were tracking them in a real app
                // For demo, we just reset or load initial
                const stored = sessionStorage.getItem('demoSKUMappings');
                if (stored) {
                    setSkuMappings(JSON.parse(stored));
                } else {
                    setSkuMappings(DEMO_SKU_MAPPINGS);
                }
            } else {
                const { data, error } = await supabase
                    .from('sku_mapping')
                    .select('*')
                    .order('market_sku');

                if (error) throw error;
                setSkuMappings(data as SKUMapping[] || []);
            }
        } catch (err) {
            console.error('Error loading mappings:', err);
            setError('Failed to load SKU mappings');
        } finally {
            setLoading(false);
        }
    };

    const handleSKUExcelUpload = async (file: File) => {
        setLoading(true);
        setError('');
        setSuccessMessage('');

        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            const newMappings: Omit<SKUMapping, 'id' | 'created_at'>[] = [];

            // Expected columns: "Market SKU" and "Variant Description"
            // Adjust based on your actual Excel structure. Assuming simple headers.
            // If headers are different, mapping logic needs adjustment.
            // Based on earlier context, user uploads "MSKU Mapping".

            jsonData.forEach((row: any) => {
                // Try to find columns case-insensitively or by likely names
                const msku = row['Market SKU'] || row['market_sku'] || row['MSKU'] || row['sku'];
                const desc = row['Variant Description'] || row['variant_description'] || row['Description'] || row['desc'];

                if (msku && desc) {
                    newMappings.push({
                        market_sku: String(msku).trim(),
                        variant_description: String(desc).trim()
                    });
                }
            });

            if (newMappings.length === 0) {
                throw new Error('No valid mappings found in Excel. Please check columns "Market SKU" and "Variant Description".');
            }

            if (isDemoMode) {
                // In demo, we simulate full replace or append? 
                // Let's replace for simplicity in bulk upload
                const demoMappings = newMappings.map(m => ({
                    ...m,
                    id: Math.random().toString(),
                    created_at: new Date().toISOString()
                }));
                setSkuMappings(demoMappings as SKUMapping[]);
                sessionStorage.setItem('demoSKUMappings', JSON.stringify(demoMappings));
                setSuccessMessage(`Successfully uploaded ${demoMappings.length} mappings (Demo Mode)`);
            } else {
                // Production: Insert into Supabase
                // Strategy: Upsert based on market_sku? Or Delete All & Insert?
                // User said "stored to the database and stay constant until edited".
                // Bulk upload usually implies "Update everything".
                // Safest is Upsert if unique constraint on market_sku exists.
                // Currently `sku_mapping` table doesn't enforce UNIQUE on market_sku in schema (only index).
                // Schema: `market_sku TEXT NOT NULL`.
                // I should probably DELETE ALL and INSERT if it's a "Upload Mapping" file appearing to be a master list.

                // Let's ask via UI? Or assume Append?
                // Given "Upload SKU Mapping" suggests providing the master list.
                // But deleting might break references? No, references are text usually?
                // `sales_summary` stores `market_sku`. No FK.

                // I will use Upsert if possible, or Insert.
                // Supabase upsert requires unique constraint.

                // Let's go with Insert, but maybe clear old ones?
                // Risky. Let's just Insert and let user manage duplicates or better yet, check for existing.

                // Better: Delete existing mappings?
                const confirmDelete = window.confirm('This will REPLACE existing mappings. Continue?');
                if (!confirmDelete) return;

                const { error: deleteError } = await supabase.from('sku_mapping').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
                if (deleteError) throw deleteError;

                const { error: insertError } = await supabase
                    .from('sku_mapping')
                    .insert(newMappings);

                if (insertError) throw insertError;

                setSuccessMessage(`Successfully updated ${newMappings.length} mappings.`);
                loadSKUMappings();
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddSKU = async () => {
        if (!newSKU.market_sku || !newSKU.variant_description) return;
        setLoading(true);
        try {
            if (isDemoMode) {
                const newItem: SKUMapping = {
                    id: Math.random().toString(),
                    market_sku: newSKU.market_sku,
                    variant_description: newSKU.variant_description,
                    created_at: new Date().toISOString()
                };
                const updated = [...skuMappings, newItem];
                setSkuMappings(updated);
                sessionStorage.setItem('demoSKUMappings', JSON.stringify(updated));
            } else {
                const { error } = await supabase
                    .from('sku_mapping')
                    .insert([newSKU]);

                if (error) throw error;
                await loadSKUMappings();
            }
            setShowAddModal(false);
            setNewSKU({ market_sku: '', variant_description: '' });
            setSuccessMessage('SKU added successfully');
        } catch (err) {
            setError('Failed to add SKU');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSKU = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this mapping?')) return;
        setLoading(true);
        try {
            if (isDemoMode) {
                const updated = skuMappings.filter(m => m.id !== id);
                setSkuMappings(updated);
                sessionStorage.setItem('demoSKUMappings', JSON.stringify(updated));
            } else {
                const { error } = await supabase
                    .from('sku_mapping')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                await loadSKUMappings();
            }
        } catch (err) {
            setError('Failed to delete SKU');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSKU = async () => {
        if (!editingSKU) return;
        setLoading(true);
        try {
            if (isDemoMode) {
                const updated = skuMappings.map(m => m.id === editingSKU.id ? editingSKU : m);
                setSkuMappings(updated);
                sessionStorage.setItem('demoSKUMappings', JSON.stringify(updated));
            } else {
                const { error } = await supabase
                    .from('sku_mapping')
                    .update({
                        market_sku: editingSKU.market_sku,
                        variant_description: editingSKU.variant_description
                    })
                    .eq('id', editingSKU.id);

                if (error) throw error;
                await loadSKUMappings();
            }
            setEditingSKU(null);
            setSuccessMessage('SKU updated successfully');
        } catch (err) {
            setError('Failed to update SKU');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800">Manage SKU Mappings</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => setMappingMode('table')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mappingMode === 'table'
                                ? 'bg-primary-100 text-primary-700'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        Manual Edit
                    </button>
                    <button
                        onClick={() => setMappingMode('upload')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mappingMode === 'upload'
                                ? 'bg-primary-100 text-primary-700'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        Bulk Upload
                    </button>
                    {mappingMode === 'table' && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="btn-primary py-1.5 px-3 text-sm"
                        >
                            + Add New SKU
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                    {successMessage}
                </div>
            )}

            {mappingMode === 'upload' ? (
                <div className="card">
                    <h4 className="text-md font-medium text-slate-700 mb-4">Upload SKU Mapping Excel</h4>
                    <p className="text-sm text-slate-500 mb-4">
                        Upload an Excel file with columns <strong>Market SKU</strong> and <strong>Variant Description</strong>.
                        Warning: This will replace existing mappings.
                    </p>
                    <FileUploader
                        onFileSelect={handleSKUExcelUpload}
                        label="Drag and drop SKU Mapping Excel file here"
                        accept=".xlsx, .xls"
                        disabled={loading}
                    />
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto max-h-[600px]">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-700 font-medium sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 border-b">Market SKU</th>
                                    <th className="px-4 py-3 border-b">Variant Description</th>
                                    <th className="px-4 py-3 border-b text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {skuMappings.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                                            No mappings found. Upload a file or add manually.
                                        </td>
                                    </tr>
                                ) : (
                                    skuMappings.map((sku) => (
                                        <tr key={sku.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-900">
                                                {sku.market_sku}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {sku.variant_description}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => setEditingSKU(sku)}
                                                    className="text-blue-600 hover:text-blue-800 mr-3"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSKU(sku.id)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold mb-4">Add New SKU Mapping</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Market SKU</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={newSKU.market_sku}
                                    onChange={(e) => setNewSKU({ ...newSKU, market_sku: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Variant Description</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={newSKU.variant_description}
                                    onChange={(e) => setNewSKU({ ...newSKU, variant_description: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddSKU}
                                className="btn-primary"
                                disabled={!newSKU.market_sku || !newSKU.variant_description || loading}
                            >
                                {loading ? 'Adding...' : 'Add SKU'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingSKU && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold mb-4">Edit SKU Mapping</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Market SKU</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={editingSKU.market_sku}
                                    onChange={(e) => setEditingSKU({ ...editingSKU, market_sku: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Variant Description</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={editingSKU.variant_description}
                                    onChange={(e) => setEditingSKU({ ...editingSKU, variant_description: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setEditingSKU(null)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateSKU}
                                className="btn-primary"
                                disabled={!editingSKU.market_sku || !editingSKU.variant_description || loading}
                            >
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

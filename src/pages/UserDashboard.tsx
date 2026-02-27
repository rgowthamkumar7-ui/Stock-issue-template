import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Layout } from '../components/shared/Layout';
import { FileUploader } from '../components/shared/FileUploader';
import { useAuthStore } from '../stores/authStore';
import { supabase, STORAGE_BUCKETS } from '../lib/supabase';
import {
    parseSalesFile,
    parseTemplateFile,
    summarizeSalesData,
    extractSurveyors,
    findUnmappedSKUs,
    updateTemplate,
    generateOutputFile,
    downloadFile,
} from '../lib/excelProcessor';
import {
    UserTemplate,
    UploadHistory,
    SKUMapping,
    SalesSummaryData,
    DSMappingData,
} from '../lib/types';

export const UserDashboard: React.FC = () => {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'settings'>('upload');

    // Template state
    const [currentTemplate, setCurrentTemplate] = useState<UserTemplate | null>(null);
    const [templateFile, setTemplateFile] = useState<File | null>(null);

    // Sales upload state
    const [salesFile, setSalesFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Mapping state
    const [unmappedSKUs, setUnmappedSKUs] = useState<string[]>([]);
    const [showSKUWarning, setShowSKUWarning] = useState(false);
    const [showDSMapping, setShowDSMapping] = useState(false);
    const [dsNames, setDsNames] = useState<string[]>([]);
    const [surveyorOptions, setSurveyorOptions] = useState<string[]>([]);
    const [dsMapping, setDsMapping] = useState<Record<string, string>>({});

    // Processing data
    const [salesSummary, setSalesSummary] = useState<SalesSummaryData[]>([]);
    const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
    const [templateData, setTemplateData] = useState<any>(null);

    // SKU Mapping Management
    const [skuMappings, setSkuMappings] = useState<SKUMapping[]>([]);
    const [skuMappingMode, setSkuMappingMode] = useState<'upload' | 'manual'>('manual');
    const [editingSKU, setEditingSKU] = useState<SKUMapping | null>(null);
    const [newSKU, setNewSKU] = useState({ market_sku: '', variant_description: '' });
    const [showAddSKU, setShowAddSKU] = useState(false);

    // History
    const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);

    useEffect(() => {
        loadCurrentTemplate();
        loadUploadHistory();
    }, [user]);

    const loadCurrentTemplate = async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from('user_templates')
            .select('*')
            .eq('user_id', user.id)
            .order('upload_date', { ascending: false })
            .limit(1)
            .single();

        if (!error && data) {
            setCurrentTemplate(data as UserTemplate);
        }
    };

    const loadUploadHistory = async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from('upload_history')
            .select('*')
            .eq('user_id', user.id)
            .order('upload_date', { ascending: false });

        if (!error && data) {
            setUploadHistory(data as UploadHistory[]);
        }
    };

    const handleTemplateUpload = async (file: File) => {
        if (!user) return;

        try {
            setError('');
            setSuccess('');
            setProcessing(true);

            // Parse template to validate
            const { data: templateRows } = await parseTemplateFile(file);
            if (!templateRows || templateRows.length === 0) {
                throw new Error('Template file is empty or invalid');
            }

            // Check if in demo mode (invalid Supabase URL)
            const isDemoMode = import.meta.env.VITE_SUPABASE_URL?.includes('your-project');

            if (isDemoMode) {
                // Demo mode: Store file locally
                const templateData = {
                    id: Date.now().toString(),
                    user_id: user.id,
                    file_name: file.name,
                    file_path: `demo/${file.name}`,
                    upload_date: new Date().toISOString(),
                };

                setCurrentTemplate(templateData as UserTemplate);
                setTemplateFile(file);
                setSuccess('Template uploaded successfully! (Demo Mode)');
            } else {
                // Production mode: Upload to Supabase
                const filePath = `${user.id}/${Date.now()}_${file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from(STORAGE_BUCKETS.TEMPLATES)
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                // Save to database
                const { data: templateData, error: dbError } = await supabase
                    .from('user_templates')
                    .insert({
                        user_id: user.id,
                        file_name: file.name,
                        file_path: filePath,
                        upload_date: new Date().toISOString(),
                    })
                    .select()
                    .single();

                if (dbError) throw dbError;

                setCurrentTemplate(templateData as UserTemplate);
                setTemplateFile(file);
                setSuccess('Template uploaded successfully!');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setProcessing(false);
        }
    };

    // SKU Mapping Management Functions
    const loadSKUMappings = async () => {
        const isDemoMode = import.meta.env.VITE_SUPABASE_URL?.includes('your-project');

        if (isDemoMode) {
            const { DEMO_SKU_MAPPINGS } = await import('../lib/demoData');
            setSkuMappings(DEMO_SKU_MAPPINGS);
        } else {
            const { data, error } = await supabase
                .from('sku_mapping')
                .select('*')
                .order('market_sku', { ascending: true });

            if (!error && data) {
                setSkuMappings(data as SKUMapping[]);
            }
        }
    };

    const handleSKUExcelUpload = async (file: File) => {
        try {
            setProcessing(true);
            setError('');

            // Parse Excel file
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json<any>(firstSheet);

            if (data.length === 0) {
                throw new Error('Excel file is empty');
            }

            // Validate columns
            const firstRow = data[0];
            if (!('market_sku' in firstRow) || !('variant_description' in firstRow)) {
                throw new Error('Excel must contain "market_sku" and "variant_description" columns');
            }

            const isDemoMode = import.meta.env.VITE_SUPABASE_URL?.includes('your-project');

            if (isDemoMode) {
                // Demo mode: Update local state
                const newMappings = data.map((row: any, idx: number) => ({
                    id: `upload_${Date.now()}_${idx}`,
                    market_sku: String(row.market_sku || '').trim(),
                    variant_description: String(row.variant_description || '').trim(),
                    created_at: new Date().toISOString(),
                    created_by: user?.id || 'demo',
                }));
                setSkuMappings(newMappings);
                setSuccess(`Uploaded ${newMappings.length} SKU mappings successfully!`);
            } else {
                // Production mode: Upload to Supabase
                const mappings = data.map((row: any) => ({
                    market_sku: String(row.market_sku || '').trim(),
                    variant_description: String(row.variant_description || '').trim(),
                    created_by: user?.id || '',
                }));

                // Delete existing mappings and insert new ones
                await supabase.from('sku_mapping').delete().neq('id', '');
                const { error } = await supabase.from('sku_mapping').insert(mappings);

                if (error) throw error;

                await loadSKUMappings();
                setSuccess(`Uploaded ${mappings.length} SKU mappings successfully!`);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setProcessing(false);
        }
    };

    const handleAddSKU = async () => {
        if (!newSKU.market_sku || !newSKU.variant_description) {
            setError('Both Market SKU and Variant Description are required');
            return;
        }

        try {
            setProcessing(true);
            const isDemoMode = import.meta.env.VITE_SUPABASE_URL?.includes('your-project');

            if (isDemoMode) {
                const newMapping: SKUMapping = {
                    id: `new_${Date.now()}`,
                    market_sku: newSKU.market_sku.trim(),
                    variant_description: newSKU.variant_description.trim(),
                    created_at: new Date().toISOString(),
                    created_by: user?.id || 'demo',
                };
                setSkuMappings([...skuMappings, newMapping]);
                setSuccess('SKU mapping added successfully!');
            } else {
                const { error } = await supabase.from('sku_mapping').insert({
                    market_sku: newSKU.market_sku.trim(),
                    variant_description: newSKU.variant_description.trim(),
                    created_by: user?.id || '',
                });

                if (error) throw error;
                await loadSKUMappings();
                setSuccess('SKU mapping added successfully!');
            }

            setNewSKU({ market_sku: '', variant_description: '' });
            setShowAddSKU(false);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setProcessing(false);
        }
    };

    const handleUpdateSKU = async (sku: SKUMapping) => {
        try {
            setProcessing(true);
            const isDemoMode = import.meta.env.VITE_SUPABASE_URL?.includes('your-project');

            if (isDemoMode) {
                setSkuMappings(skuMappings.map(s => s.id === sku.id ? sku : s));
                setSuccess('SKU mapping updated successfully!');
            } else {
                const { error } = await supabase
                    .from('sku_mapping')
                    .update({
                        market_sku: sku.market_sku.trim(),
                        variant_description: sku.variant_description.trim(),
                    })
                    .eq('id', sku.id);

                if (error) throw error;
                await loadSKUMappings();
                setSuccess('SKU mapping updated successfully!');
            }

            setEditingSKU(null);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteSKU = async (id: string) => {
        if (!confirm('Are you sure you want to delete this SKU mapping?')) return;

        try {
            setProcessing(true);
            const isDemoMode = import.meta.env.VITE_SUPABASE_URL?.includes('your-project');

            if (isDemoMode) {
                setSkuMappings(skuMappings.filter(s => s.id !== id));
                setSuccess('SKU mapping deleted successfully!');
            } else {
                const { error } = await supabase
                    .from('sku_mapping')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                await loadSKUMappings();
                setSuccess('SKU mapping deleted successfully!');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setProcessing(false);
        }
    };

    useEffect(() => {
        loadSKUMappings();
    }, []);

    const handleSalesUpload = async (file: File) => {
        if (!user || !currentTemplate) {
            setError('Please upload a template first');
            return;
        }

        try {
            setError('');
            setSuccess('');
            setProcessing(true);
            setSalesFile(file);

            // Parse sales file
            const salesData = await parseSalesFile(file);
            if (!salesData || salesData.length === 0) {
                throw new Error('Sales file is empty or invalid');
            }

            // Summarize sales data
            const summary = summarizeSalesData(salesData);
            setSalesSummary(summary);

            // Check for unmapped SKUs using current state
            // This ensures potential manual uploads/edits are respected
            const unmapped = findUnmappedSKUs(summary, skuMappings);

            if (unmapped.length > 0) {
                setUnmappedSKUs(unmapped);
                setShowSKUWarning(true);
            }

            // Check if in demo mode
            const isDemoMode = import.meta.env.VITE_SUPABASE_URL?.includes('your-project');

            if (isDemoMode) {
                // Demo mode: Process locally without Supabase
                const uploadId = Date.now().toString();
                setCurrentUploadId(uploadId);

                // Use the template file that was uploaded in this session
                if (!templateFile) {
                    throw new Error('Template file not found. Please re-upload your template.');
                }

                const parsedTemplate = await parseTemplateFile(templateFile);
                setTemplateData(parsedTemplate);

                // Extract surveyors for DS mapping
                const surveyors = extractSurveyors(parsedTemplate.data);
                setSurveyorOptions(surveyors);

                // Get unique DS names from sales
                const uniqueDSNames = Array.from(new Set(summary.map((s) => s.ds_name))).sort();
                setDsNames(uniqueDSNames);

                // Initialize mapping
                const initialMapping: Record<string, string> = {};
                uniqueDSNames.forEach((ds) => {
                    initialMapping[ds] = '';
                });
                setDsMapping(initialMapping);

                // Show DS mapping dialog
                setShowDSMapping(true);
                setProcessing(false);
            } else {
                // Production mode: Use Supabase
                // We do NOT upload the sales file to storage as it's transient.
                // We just store a reference for record keeping.
                const salesFilePath = `skipped/${user.id}/${Date.now()}_${file.name}`;

                // Create upload history record
                const { data: uploadData, error: uploadHistoryError } = await supabase
                    .from('upload_history')
                    .insert({
                        user_id: user.id,
                        sales_file_name: file.name,
                        sales_file_path: salesFilePath,
                        template_file_name: currentTemplate.file_name,
                        output_file_name: currentTemplate.file_name.replace(/\.[^/.]+$/, "") + ".csv",
                        upload_date: new Date().toISOString(),
                        status: 'processing',
                    })
                    .select()
                    .single();

                if (uploadHistoryError) throw uploadHistoryError;
                setCurrentUploadId(uploadData.id);

                // Save sales summary to database
                const summaryRecords = summary.map((s) => ({
                    upload_id: uploadData.id,
                    ds_name: s.ds_name,
                    market_sku: s.market_sku,
                    total_qty: s.total_qty,
                }));

                const { error: summaryError } = await supabase
                    .from('sales_summary')
                    .insert(summaryRecords);

                if (summaryError) throw summaryError;

                // Load template file for processing
                const { data: templateBlob } = await supabase.storage
                    .from(STORAGE_BUCKETS.TEMPLATES)
                    .download(currentTemplate.file_path);

                if (!templateBlob) throw new Error('Failed to load template');

                const templateFileObj = new File([templateBlob], currentTemplate.file_name);
                const parsedTemplate = await parseTemplateFile(templateFileObj);
                setTemplateData(parsedTemplate);

                // Extract surveyors for DS mapping
                const surveyors = extractSurveyors(parsedTemplate.data);
                setSurveyorOptions(surveyors);

                // Get unique DS names from sales
                const uniqueDSNames = Array.from(new Set(summary.map((s) => s.ds_name))).sort();
                setDsNames(uniqueDSNames);

                // Fetch previous mappings for these DS names (to remember selection)
                try {
                    const { data: previousMappings } = await supabase
                        .from('salesman_mapping')
                        .select('ds_name, surveyor_name, created_at')
                        .in('ds_name', uniqueDSNames)
                        .order('created_at', { ascending: false });

                    const historicalMap = new Map<string, string>();
                    if (previousMappings) {
                        previousMappings.forEach((m: any) => {
                            if (!historicalMap.has(m.ds_name)) {
                                historicalMap.set(m.ds_name, m.surveyor_name);
                            }
                        });
                    }

                    // Initialize mapping with history
                    const initialMapping: Record<string, string> = {};
                    uniqueDSNames.forEach((ds) => {
                        initialMapping[ds] = historicalMap.get(ds) || '';
                    });
                    setDsMapping(initialMapping);
                } catch (err) {
                    // Fallback if fetch fails
                    console.error('Failed to fetch mapping history', err);
                    const initialMapping: Record<string, string> = {};
                    uniqueDSNames.forEach((ds) => {
                        initialMapping[ds] = '';
                    });
                    setDsMapping(initialMapping);
                }

                // Show DS mapping dialog
                setShowDSMapping(true);
                setProcessing(false);
            }
        } catch (err) {
            setError((err as Error).message);
            setProcessing(false);
        }
    };

    const handleDSMappingComplete = async () => {
        // Validate all DS names are mapped
        const allMapped = Object.values(dsMapping).every((v) => v !== '');
        if (!allMapped) {
            setError('Please map all DS Names to SURVEYOR');
            return;
        }

        try {
            setError('');
            setProcessing(true);

            // Save DS mapping to database
            const mappingRecords: DSMappingData[] = Object.entries(dsMapping).map(([ds, surveyor]) => ({
                ds_name: ds,
                surveyor_name: surveyor,
            }));

            const dbMappingRecords = mappingRecords.map((m) => ({
                upload_id: currentUploadId,
                ds_name: m.ds_name,
                surveyor_name: m.surveyor_name,
            }));

            const { error: mappingError } = await supabase
                .from('salesman_mapping')
                .insert(dbMappingRecords);

            if (mappingError) throw mappingError;

            // Get SKU mappings
            const { data: skuMappings } = await supabase
                .from('sku_mapping')
                .select('*');

            // Update template
            const updatedTemplateData = updateTemplate(
                templateData.data,
                salesSummary,
                skuMappings as SKUMapping[] || [],
                mappingRecords
            );

            // Generate output file
            const outputBlob = generateOutputFile(
                templateData.workbook,
                templateData.sheetName,
                updatedTemplateData,
                currentTemplate!.file_name.replace(/\.[^/.]+$/, "") + ".csv",
                templateData.headers
            );

            // Upload output file
            const outputFilePath = `${user!.id}/${Date.now()}_output_${currentTemplate!.file_name.replace(/\.[^/.]+$/, "") + ".csv"}`;
            const { error: outputUploadError } = await supabase.storage
                .from(STORAGE_BUCKETS.OUTPUT_FILES)
                .upload(outputFilePath, outputBlob);

            if (outputUploadError) throw outputUploadError;

            // Update upload history
            const { error: updateError } = await supabase
                .from('upload_history')
                .update({
                    output_file_path: outputFilePath,
                    status: 'completed',
                })
                .eq('id', currentUploadId);

            if (updateError) throw updateError;

            // Download file
            downloadFile(outputBlob, currentTemplate!.file_name.replace(/\.[^/.]+$/, "") + ".csv");

            setSuccess('File processed and downloaded successfully!');
            setShowDSMapping(false);
            loadUploadHistory();

            // Automatic Cleanup: Keep only the last 3 entries per user
            try {
                const { data: allUploads } = await supabase
                    .from('upload_history')
                    .select('id, output_file_path')
                    .eq('user_id', user!.id)
                    .order('upload_date', { ascending: false });

                if (allUploads && allUploads.length > 3) {
                    const toDelete = allUploads.slice(3); // Logically delete older ones (index 3 and beyond)

                    // 1. Delete associated output files from Storage
                    const outputPaths = toDelete
                        .map(u => u.output_file_path)
                        .filter(path => path && !path.startsWith('skipped/'));

                    if (outputPaths.length > 0) {
                        const { error: storageError } = await supabase.storage
                            .from(STORAGE_BUCKETS.OUTPUT_FILES)
                            .remove(outputPaths);

                        if (storageError) console.error('Failed to cleanup storage files:', storageError);
                    }

                    // 2. Delete records from Database (Cascade deletes sales_summary & salesman_mapping)
                    const deleteIds = toDelete.map(u => u.id);
                    if (deleteIds.length > 0) {
                        const { error: dbError } = await supabase
                            .from('upload_history')
                            .delete()
                            .in('id', deleteIds);

                        if (dbError) console.error('Failed to cleanup database records:', dbError);
                        else loadUploadHistory(); // Refresh UI to show shortened list
                    }
                }
            } catch (cleanupErr) {
                console.error('Cleanup process failed:', cleanupErr);
            }

            // Reset state
            setSalesFile(null);
            setSalesSummary([]);
            setDsMapping({});
            setCurrentUploadId(null);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setProcessing(false);
        }
    };

    const handleDownloadPreviousFile = async (upload: UploadHistory) => {
        try {
            const { data } = await supabase.storage
                .from(STORAGE_BUCKETS.OUTPUT_FILES)
                .download(upload.output_file_path);

            if (data) {
                downloadFile(data, upload.output_file_name);
            }
        } catch (err) {
            setError('Failed to download file');
        }
    };

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div className="card">
                    <h2 className="card-header">User Dashboard</h2>
                    <p className="text-slate-600">Upload your daily sales file to update the stock issue template.</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`px-6 py-3 font-medium transition-colors ${activeTab === 'upload'
                            ? 'border-b-2 border-primary-600 text-primary-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        Sales Upload
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-3 font-medium transition-colors ${activeTab === 'history'
                            ? 'border-b-2 border-primary-600 text-primary-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        History
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-6 py-3 font-medium transition-colors ${activeTab === 'settings'
                            ? 'border-b-2 border-primary-600 text-primary-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        Settings
                    </button>
                </div>

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

                {/* Sales Upload Tab (Default) */}
                {activeTab === 'upload' && (
                    <div className="space-y-6">
                        {!currentTemplate ? (
                            <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg text-center">
                                <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Template Found</h3>
                                <p className="text-yellow-700 mb-4">You need to upload a template file first before processing sales data.</p>
                                <button
                                    onClick={() => setActiveTab('settings')}
                                    className="btn-primary"
                                >
                                    Go to Settings to Upload Template
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                                    <h4 className="font-semibold text-blue-900 mb-1">Current Template:</h4>
                                    <p className="text-blue-800 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        {currentTemplate.file_name}
                                    </p>
                                </div>
                                <FileUploader
                                    label="Upload Sales File"
                                    description="Upload your daily sales file (Excel or CSV). The system will automatically map data to your template."
                                    onFileSelect={handleSalesUpload}
                                    accept=".xlsx,.xls,.csv"
                                    currentFileName={salesFile?.name}
                                />
                            </div>
                        )}

                        {processing && (
                            <div className="card">
                                <div className="flex items-center justify-center gap-3">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                    <span className="text-slate-700">Processing sales file...</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                    <div className="card">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Upload History</h3>

                        {uploadHistory.length === 0 ? (
                            <p className="text-slate-600 text-center py-8">No uploads yet</p>
                        ) : (
                            <div className="table-container">
                                <table className="table">
                                    <thead className="table-header">
                                        <tr>
                                            <th className="table-header-cell">Date</th>
                                            <th className="table-header-cell">Sales File</th>
                                            <th className="table-header-cell">Template</th>
                                            <th className="table-header-cell">Status</th>
                                            <th className="table-header-cell">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="table-body">
                                        {uploadHistory.map((upload) => (
                                            <tr key={upload.id}>
                                                <td className="table-cell">
                                                    {new Date(upload.upload_date).toLocaleDateString()}
                                                </td>
                                                <td className="table-cell">{upload.sales_file_name}</td>
                                                <td className="table-cell">{upload.template_file_name}</td>
                                                <td className="table-cell">
                                                    <span
                                                        className={`badge ${upload.status === 'completed'
                                                            ? 'badge-success'
                                                            : upload.status === 'failed'
                                                                ? 'badge-error'
                                                                : 'badge-warning'
                                                            }`}
                                                    >
                                                        {upload.status}
                                                    </span>
                                                </td>
                                                <td className="table-cell">
                                                    {upload.status === 'completed' && (
                                                        <button
                                                            onClick={() => handleDownloadPreviousFile(upload)}
                                                            className="text-primary-600 hover:text-primary-800 font-medium"
                                                        >
                                                            Download
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Settings Tab (Template Upload + SKU Mapping) */}
                {activeTab === 'settings' && (
                    <div className="space-y-6">
                        {/* Template Management */}
                        <div className="card">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Template Management</h3>
                            <p className="text-slate-600 mb-6">
                                Upload your output template file here. This file defines the structure of the report you want to generate.
                                You typically only need to do this once or when the format changes.
                            </p>

                            <FileUploader
                                label="Upload Template File"
                                description="Select your template file (Excel or CSV). Must contain 'SURVEYOR', 'VARIANT DESCRIPTION', and 'QUANTITY (in M)' columns."
                                onFileSelect={handleTemplateUpload}
                                accept=".xlsx,.xls,.csv"
                                currentFileName={currentTemplate?.file_name}
                            />

                            {currentTemplate && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-600">
                                        <span className="font-semibold">Last uploaded:</span> {new Date(currentTemplate.upload_date).toLocaleDateString()}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* SKU Mapping View (Read Only) */}
                        <div className="card">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Current SKU Mappings</h3>
                            <p className="text-slate-600 mb-6">
                                View only. SKU mappings are managed by the administrator.
                            </p>

                            {/* SKU Mappings Table */}
                            {skuMappings.length === 0 ? (
                                <p className="text-slate-600 text-center py-8">No SKU mappings found.</p>
                            ) : (
                                <div className="table-container">
                                    <table className="table">
                                        <thead className="table-header">
                                            <tr>
                                                <th className="table-header-cell">Market SKU</th>
                                                <th className="table-header-cell">Variant Description</th>
                                            </tr>
                                        </thead>
                                        <tbody className="table-body">
                                            {skuMappings.map((sku) => (
                                                <tr key={sku.id}>
                                                    <td className="table-cell font-medium text-slate-900">
                                                        {sku.market_sku}
                                                    </td>
                                                    <td className="table-cell text-slate-600">
                                                        {sku.variant_description}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Add New SKU Modal */}
            {showAddSKU && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Add New SKU Mapping</h3>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Market SKU
                                </label>
                                <input
                                    type="text"
                                    value={newSKU.market_sku}
                                    onChange={(e) => setNewSKU({ ...newSKU, market_sku: e.target.value })}
                                    className="input-field w-full"
                                    placeholder="e.g., BNC CHOC TWST RS10"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Variant Description
                                </label>
                                <input
                                    type="text"
                                    value={newSKU.variant_description}
                                    onChange={(e) => setNewSKU({ ...newSKU, variant_description: e.target.value })}
                                    className="input-field w-full"
                                    placeholder="e.g., Classic RT"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleAddSKU}
                                disabled={processing}
                                className="btn-primary flex-1"
                            >
                                {processing ? 'Adding...' : 'Add Mapping'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowAddSKU(false);
                                    setNewSKU({ market_sku: '', variant_description: '' });
                                }}
                                className="btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SKU Warning Modal */}
            {showSKUWarning && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Unmapped SKUs Found</h3>
                        <p className="text-slate-600 mb-4">
                            The following Market SKUs do not have mappings. They will be ignored in processing:
                        </p>
                        <ul className="list-disc list-inside mb-6 text-sm text-slate-700 max-h-40 overflow-y-auto">
                            {unmappedSKUs.map((sku) => (
                                <li key={sku}>{sku}</li>
                            ))}
                        </ul>
                        <button
                            onClick={() => setShowSKUWarning(false)}
                            className="btn-primary w-full"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            )}

            {/* DS Mapping Modal */}
            {showDSMapping && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
                    <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 my-8">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Map DS Names to SURVEYOR</h3>
                        <p className="text-slate-600 mb-6">
                            Please map each DS Name from your sales file to a SURVEYOR from your template:
                        </p>

                        <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                            {dsNames.map((dsName) => (
                                <div key={dsName} className="flex items-center gap-4">
                                    <label className="w-1/3 text-sm font-medium text-slate-700">
                                        {dsName}
                                    </label>
                                    <select
                                        value={dsMapping[dsName] || ''}
                                        onChange={(e) =>
                                            setDsMapping({ ...dsMapping, [dsName]: e.target.value })
                                        }
                                        className="input-field flex-1"
                                    >
                                        <option value="">Select SURVEYOR</option>
                                        {surveyorOptions.map((surveyor) => (
                                            <option key={surveyor} value={surveyor}>
                                                {surveyor}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleDSMappingComplete}
                                disabled={processing || !Object.values(dsMapping).every((v) => v !== '')}
                                className="btn-primary flex-1"
                            >
                                {processing ? 'Processing...' : 'Process & Download'}
                            </button>
                            <button
                                onClick={() => setShowDSMapping(false)}
                                disabled={processing}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

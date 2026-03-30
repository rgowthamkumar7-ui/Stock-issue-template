import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useSOHStore, SOHEntry } from '../../stores/sohStore';
import { useAuthStore } from '../../stores/authStore';

// --- Parser -------------------------------------------------------------------
// Reads the ITC SOH Excel format:
//   Col A (0) = Warehouse code  → filter for "CWMB"
//   Col C (2) = SKU code
//   Col E (4) = SKU name
//   Col I (8) = Available quantity in Ms

function parseSOHFile(arrayBuffer: ArrayBuffer): { entries: SOHEntry[]; warnings: string[] } {
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { entries: [], warnings: ['No sheet found in file.'] };

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const entries: SOHEntry[] = [];
    const warnings: string[] = [];
    const now = new Date().toISOString();

    for (let R = range.s.r; R <= range.e.r; R++) {
        const getCell = (col: number) => ws[XLSX.utils.encode_cell({ r: R, c: col })];

        const cellA = getCell(0);
        const warehouse = cellA ? String(cellA.v).trim() : '';
        if (warehouse !== 'CWMB') continue;

        const cellC = getCell(2);
        const cellE = getCell(4);
        const cellI = getCell(8);

        const sku = cellC ? String(cellC.v).trim() : '';
        const label = cellE ? String(cellE.v).trim() : '';
        const qty = cellI ? Number(cellI.v) || 0 : 0;

        if (!sku || !label) {
            warnings.push(`Row ${R + 1}: SKU code or name missing — skipped.`);
            continue;
        }

        entries.push({ sku, label, stockMs: qty, updatedAt: now, updatedBy: '' });
    }

    return { entries, warnings };
}

// --- Component ----------------------------------------------------------------

export const SOHUpdate: React.FC = () => {
    const { user } = useAuthStore();
    const { sohEntries, updateSOH, lastUpdatedAt } = useSOHStore();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [parsedEntries, setParsedEntries] = useState<SOHEntry[]>([]);
    const [uploadError, setUploadError] = useState('');
    const [warnings, setWarnings] = useState<string[]>([]);
    const [saved, setSaved] = useState(false);
    const [fileName, setFileName] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'qty'>('name');

    // -- File Upload Handler --------------------------------------------------
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadError('');
        setWarnings([]);
        setParsedEntries([]);
        setSaved(false);
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const result = parseSOHFile(evt.target?.result as ArrayBuffer);

                if (result.entries.length === 0) {
                    setUploadError(
                        'No CWMB rows found in the file. Make sure this is the correct SOH Excel report.'
                    );
                    return;
                }

                setParsedEntries(result.entries);
                setWarnings(result.warnings);

                // Reset file input to allow re-upload
                if (fileInputRef.current) fileInputRef.current.value = '';
            } catch {
                setUploadError('Failed to parse the file. Please upload a valid .xls/.xlsx SOH report.');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSave = () => {
        if (parsedEntries.length === 0) return;
        updateSOH(parsedEntries, user?.username || 'manager');
        setSaved(true);
    };

    const handleDiscard = () => {
        setParsedEntries([]);
        setFileName('');
        setUploadError('');
        setWarnings([]);
        setSaved(false);
    };

    // -- Computed stats -------------------------------------------------------
    const displayEntries = parsedEntries.length > 0 ? parsedEntries : sohEntries;
    const isPreview = parsedEntries.length > 0 && !saved;

    const stockOutCount = displayEntries.filter(e => e.stockMs === 0).length;
    const totalMs = displayEntries.reduce((s, e) => s + e.stockMs, 0);

    const sorted = [...displayEntries].sort((a, b) =>
        sortBy === 'qty' ? b.stockMs - a.stockMs : a.label.localeCompare(b.label)
    );

    return (
        <div className="space-y-6">
            {/* -- Info Banner -- */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="font-bold text-blue-900">Daily SOH Update</p>
                            <p className="text-xs text-blue-700 mt-0.5">
                                Upload the daily ITC SOH Excel report. Only <strong>CWMB</strong> warehouse rows are
                                extracted. SKU names and available quantities will immediately restrict WD orders.
                            </p>
                        </div>
                    </div>
                    {lastUpdatedAt && (
                        <div className="flex-shrink-0 text-xs text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap">
                            Last saved: {new Date(lastUpdatedAt).toLocaleString('en-IN', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* -- Upload Card -- */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h4 className="font-bold text-slate-800">Upload SOH Excel Report</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Accepts the standard ITC SOH .xls / .xlsx report format
                    </p>
                </div>
                <div className="p-6 space-y-4">
                    {/* Hidden input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xls,.xlsx"
                        className="hidden"
                        onChange={handleFileUpload}
                        id="soh-excel-upload"
                    />

                    {/* Drop zone */}
                    <label
                        htmlFor="soh-excel-upload"
                        className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 rounded-2xl p-10 cursor-pointer transition-all duration-200 group"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                            <svg className="w-7 h-7 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                                Click to upload SOH Excel
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Extracts CWMB rows · Col C (SKU code) · Col E (name) · Col I (stock Ms)
                            </p>
                        </div>
                    </label>

                    {/* Error */}
                    {uploadError && (
                        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                            <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p className="text-red-700 text-sm font-semibold">{uploadError}</p>
                        </div>
                    )}

                    {/* Parsed preview + Save / Discard */}
                    {parsedEntries.length > 0 && !saved && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex-1">
                                <p className="text-sm font-bold text-amber-800">
                                    ✓ Parsed {parsedEntries.length} SKUs from <span className="font-mono">{fileName}</span>
                                </p>
                                <p className="text-xs text-amber-600 mt-0.5">
                                    Review the table below and click Save to apply.
                                </p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <button
                                    id="btn-save-soh"
                                    onClick={handleSave}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                    </svg>
                                    Save SOH
                                </button>
                                <button
                                    onClick={handleDiscard}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                                >
                                    Discard
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Saved success */}
                    {saved && (
                        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-green-800 text-sm font-bold">SOH updated successfully!</p>
                                <p className="text-green-600 text-xs mt-0.5">WDs can now only order within available quantities.</p>
                            </div>
                            <button
                                onClick={handleDiscard}
                                className="ml-auto text-xs text-green-600 underline font-medium hover:text-green-800"
                            >
                                Upload new
                            </button>
                        </div>
                    )}

                    {/* Warnings */}
                    {warnings.length > 0 && (
                        <details className="text-xs text-slate-500">
                            <summary className="cursor-pointer font-semibold text-amber-600">
                                ⚠ {warnings.length} row(s) skipped — click to see details
                            </summary>
                            <ul className="mt-2 space-y-0.5 pl-4 list-disc">
                                {warnings.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                        </details>
                    )}
                </div>
            </div>

            {/* -- SOH Preview Table -- */}
            {displayEntries.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                        <div>
                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                {isPreview ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                        Preview (not saved yet)
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                        ✓ Active SOH
                                    </span>
                                )}
                                CWMB Warehouse Stock
                            </h4>
                            <div className="flex flex-wrap gap-4 mt-2">
                                <span className="text-xs text-slate-500">
                                    <strong className="text-slate-800">{displayEntries.length}</strong> SKUs
                                </span>
                                <span className="text-xs text-slate-500">
                                    Total: <strong className="text-slate-800">{totalMs.toFixed(2)} Ms</strong>
                                </span>
                                {stockOutCount > 0 && (
                                    <span className="text-xs font-bold text-red-500">
                                        ⛔ {stockOutCount} stock-out SKU{stockOutCount !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* Sort toggle */}
                        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl text-xs">
                            <button
                                onClick={() => setSortBy('name')}
                                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${sortBy === 'name' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                A–Z
                            </button>
                            <button
                                onClick={() => setSortBy('qty')}
                                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${sortBy === 'qty' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Qty ↓
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">SKU Code</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">SKU Name</th>
                                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Avail. (Ms)</th>
                                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sorted.map((entry, i) => {
                                    const isOut = entry.stockMs === 0;
                                    const isLow = entry.stockMs > 0 && entry.stockMs < 10;
                                    return (
                                        <tr
                                            key={entry.sku}
                                            className={`transition-colors ${isOut ? 'bg-red-50/50' : 'hover:bg-slate-50'}`}
                                        >
                                            <td className="px-5 py-3 text-xs text-slate-400">{i + 1}</td>
                                            <td className="px-5 py-3 font-mono text-xs text-slate-500">{entry.sku}</td>
                                            <td className="px-5 py-3 text-sm text-slate-800 max-w-xs">
                                                <p className="truncate" title={entry.label}>{entry.label}</p>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <span className={`text-sm font-bold ${isOut ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-slate-800'}`}>
                                                    {entry.stockMs.toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                {isOut ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">Stock Out</span>
                                                ) : isLow ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-600">Low Stock</span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-600">Available</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

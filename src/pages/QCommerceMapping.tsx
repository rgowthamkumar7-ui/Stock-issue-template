import React, { useRef, useState } from 'react';
import { Layout } from '../components/shared/Layout';
import { useQCommerceStore } from '../stores/qcommerceStore';
import * as XLSX from 'xlsx';

// Utility to parse CSV to string array
const parseCSV = (csvText: string) => {
    const lines = csvText.split('\n');
    const result: string[][] = [];
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        const row: string[] = [];
        let inQuotes = false;
        let currentVal = '';
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row.push(currentVal.trim());
                currentVal = '';
            } else {
                currentVal += char;
            }
        }
        row.push(currentVal.trim());
        result.push(row);
    }
    return result;
};

export const QCommerceMapping: React.FC = () => {
    const { mskuMap, mskuMapFileName, setMSKUMap, clearMSKUMap } = useQCommerceStore();
    const [uploadError, setUploadError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleMSKUUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUploadError('');
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const csvData = ev.target?.result as string;
                const rows = parseCSV(csvData);
                if (rows.length < 2) {
                    setUploadError('CSV must have a header row and at least one data row.');
                    return;
                }
                const header = rows[0].map(h => h.toLowerCase().trim());
                const idxSkuDesc = header.findIndex(h => h === 'skudesc');
                const idxMarketSku = header.findIndex(h => h === 'market_sku');

                if (idxSkuDesc === -1 || idxMarketSku === -1) {
                    setUploadError('CSV must contain "SkuDesc" and "market_sku" columns.');
                    return;
                }

                const newMap = [];
                for (let i = 1; i < rows.length; i++) {
                    const r = rows[i];
                    if (r[idxSkuDesc] && r[idxMarketSku]) {
                        newMap.push({
                            skuDesc: r[idxSkuDesc],
                            marketSku: r[idxMarketSku]
                        });
                    }
                }
                setMSKUMap(newMap, file.name);
            } catch (err) {
                setUploadError('Failed to parse CSV file.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <Layout>
            <div className="space-y-6 max-w-4xl mx-auto pb-12">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Market SKU Mapping</h2>
                        <p className="text-sm text-slate-500 font-medium mt-1">
                            Upload mapping files to automate delivery confirmation matching.
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    {mskuMap.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-green-800">Mapping Active: {mskuMapFileName}</p>
                                        <p className="text-xs text-green-600 font-medium">{mskuMap.length} SKUs mapped successfully.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={clearMSKUMap}
                                    className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                                >
                                    Clear Mapping
                                </button>
                            </div>
                            
                            <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase">PO SkuDesc (Internal)</th>
                                            <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase">Market SKU (External)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {mskuMap.map((m, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium text-slate-700">{m.skuDesc}</td>
                                                <td className="px-4 py-3 font-mono font-bold text-indigo-600">{m.marketSku}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-slate-50/50">
                            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">Upload mSKU Mapping</h3>
                            <p className="text-sm text-slate-500 max-w-md mb-6">
                                Upload the <strong>msku_match_result.csv</strong> file containing <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">SkuDesc</code> and <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">market_sku</code> columns to enable automated bill reconciliation.
                            </p>
                            
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleMSKUUpload}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-200 transition-all hover:scale-105"
                            >
                                Select CSV File
                            </button>
                            
                            {uploadError && (
                                <p className="mt-4 text-sm text-red-500 font-bold bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                                    {uploadError}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

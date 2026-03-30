import React, { useState } from 'react';
import { MDOSkuItem } from '../../lib/types';
import { useSOHStore } from '../../stores/sohStore';

interface PlaceOrderFormProps {
    onSubmit: (items: MDOSkuItem[]) => void;
    onCancel: () => void;
}

interface OrderLine {
    sku: string;
    quantityMs: string;
}

export const PlaceOrderForm: React.FC<PlaceOrderFormProps> = ({ onSubmit, onCancel }) => {
    const { sohEntries } = useSOHStore();
    const [lines, setLines] = useState<OrderLine[]>([{ sku: '', quantityMs: '' }]);
    const [lineErrors, setLineErrors] = useState<Record<number, string>>({});
    const [globalError, setGlobalError] = useState('');

    const sohConfigured = sohEntries.length > 0;

    // Build quick lookup map
    const sohMap = Object.fromEntries(sohEntries.map(e => [e.sku, e]));

    // SKUs already chosen (prevent duplicates)
    const selectedSkus = lines.map(l => l.sku).filter(Boolean);

    const updateLine = (index: number, field: keyof OrderLine, value: string) => {
        const updated = [...lines];
        updated[index] = { ...updated[index], [field]: value };
        setLines(updated);
        if (lineErrors[index]) {
            setLineErrors(prev => { const n = { ...prev }; delete n[index]; return n; });
        }
        setGlobalError('');
    };

    const addLine = () => setLines([...lines, { sku: '', quantityMs: '' }]);

    const removeLine = (index: number) => {
        setLines(lines.filter((_, i) => i !== index));
        setLineErrors(prev => { const n = { ...prev }; delete n[index]; return n; });
    };

    const handleSubmit = () => {
        setGlobalError('');
        setLineErrors({});

        const validLines = lines.filter(l => l.sku && l.quantityMs);
        if (validLines.length === 0) {
            setGlobalError('Please add at least one SKU with a quantity.');
            return;
        }

        const newLineErrors: Record<number, string> = {};

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line.sku) continue;

            if (!line.quantityMs) {
                newLineErrors[i] = 'Enter a quantity.';
                continue;
            }

            const qty = Number(line.quantityMs);
            if (isNaN(qty) || qty <= 0) {
                newLineErrors[i] = 'Quantity must be greater than 0.';
                continue;
            }

            // SOH validation
            if (sohConfigured) {
                const entry = sohMap[line.sku];
                if (!entry) {
                    newLineErrors[i] = 'SKU not found in current SOH.';
                    continue;
                }
                if (entry.stockMs === 0) {
                    newLineErrors[i] = 'Stock out — this SKU is currently unavailable.';
                    continue;
                }
                if (qty > entry.stockMs) {
                    newLineErrors[i] = `Enter lesser quantity. Available: ${entry.stockMs.toFixed(2)} Ms`;
                    continue;
                }
            }
        }

        if (Object.keys(newLineErrors).length > 0) {
            setLineErrors(newLineErrors);
            return;
        }

        const items: MDOSkuItem[] = validLines.map(line => {
            const entry = sohMap[line.sku];
            return {
                sku: line.sku,
                skuLabel: entry ? entry.label : line.sku,
                quantityMs: Number(line.quantityMs),
                pricePerMs: 12000,   // Mock pricing for template demonstration
            };
        });

        onSubmit(items);
    };

    // Preview total qty
    const previewQty = lines.reduce((s, l) => s + (Number(l.quantityMs) || 0), 0);

    // If SOH is not configured, show a notice instead of the form
    if (!sohConfigured) {
        return (
            <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-xl shadow-amber-50 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-white font-bold text-lg">Place Delivery Order</h3>
                    <button onClick={onCancel} className="text-white/80 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-10 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                        <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <p className="font-bold text-slate-700">SOH not updated yet</p>
                    <p className="text-sm text-slate-500">
                        Orders cannot be placed until your manager updates the daily Stock on Hand.
                        Please check back shortly.
                    </p>
                    <button onClick={onCancel} className="mt-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-xl shadow-amber-50 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <h3 className="text-white font-bold text-lg">Place Delivery Order</h3>
                </div>
                <button onClick={onCancel} className="text-white/80 hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="p-6 space-y-4">
                {/* Stock limit notice */}
                <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Warehouse stock limits are active. Order quantities are restricted to available stock.
                </div>

                {/* Column labels */}
                <div className="grid grid-cols-12 gap-3 px-1">
                    <div className="col-span-7 text-xs font-semibold text-slate-500 uppercase tracking-wider">SKU</div>
                    <div className="col-span-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty (Ms)</div>
                    <div className="col-span-1" />
                </div>

                {/* Order Lines */}
                <div className="space-y-3">
                    {lines.map((line, index) => {
                        const entry = line.sku ? sohMap[line.sku] : null;
                        const isStockOut = entry ? entry.stockMs === 0 : false;
                        const hasLineError = !!lineErrors[index];

                        return (
                            <div key={index} className="space-y-1">
                                <div className="grid grid-cols-12 gap-3 items-start">
                                    {/* SKU dropdown */}
                                    <div className="col-span-7">
                                        <select
                                            id={`sku-select-${index}`}
                                            value={line.sku}
                                            onChange={e => updateLine(index, 'sku', e.target.value)}
                                            className={`w-full px-3 py-2.5 rounded-xl border text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${hasLineError
                                                    ? 'border-red-300 bg-red-50 focus:ring-red-300'
                                                    : 'border-slate-200 bg-slate-50 focus:ring-amber-300 focus:border-amber-300'
                                                }`}
                                        >
                                            <option value="">— Select SKU —</option>
                                            {sohEntries.map(e => {
                                                const taken = selectedSkus.includes(e.sku) && e.sku !== line.sku;
                                                const stockOut = e.stockMs === 0;
                                                return (
                                                    <option
                                                        key={e.sku}
                                                        value={e.sku}
                                                        disabled={taken || stockOut}
                                                    >
                                                        {stockOut ? `⛔ ${e.label}` : e.label}
                                                    </option>
                                                );
                                            })}
                                        </select>

                                        {entry && !isStockOut && (
                                            <p className="text-xs text-blue-500 font-semibold mt-1 ml-1">
                                                Available: {entry.stockMs.toFixed(2)} Ms
                                            </p>
                                        )}
                                        {isStockOut && (
                                            <p className="text-xs text-red-500 font-bold mt-1 ml-1">⛔ Stock Out</p>
                                        )}
                                    </div>

                                    {/* Qty input */}
                                    <div className="col-span-4">
                                        <input
                                            id={`qty-input-${index}`}
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            max={entry && entry.stockMs > 0 ? entry.stockMs : undefined}
                                            placeholder={entry && entry.stockMs > 0 ? `max ${entry.stockMs.toFixed(2)}` : 'e.g. 2.5'}
                                            value={line.quantityMs}
                                            onChange={e => updateLine(index, 'quantityMs', e.target.value)}
                                            disabled={isStockOut}
                                            className={`w-full px-3 py-2.5 rounded-xl border text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${hasLineError
                                                    ? 'border-red-300 bg-red-50 focus:ring-red-300'
                                                    : 'border-slate-200 bg-slate-50 focus:ring-amber-300 focus:border-amber-300'
                                                }`}
                                        />
                                    </div>

                                    {/* Remove */}
                                    <div className="col-span-1 flex justify-center pt-2">
                                        {lines.length > 1 && (
                                            <button
                                                onClick={() => removeLine(index)}
                                                className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Per-line error */}
                                {hasLineError && (
                                    <p className="text-xs text-red-600 font-semibold ml-1 flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {lineErrors[index]}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Add SKU */}
                <button
                    id="btn-add-sku"
                    onClick={addLine}
                    disabled={lines.length >= sohEntries.filter(e => e.stockMs > 0).length}
                    className="flex items-center gap-2 text-sm font-semibold text-amber-600 hover:text-amber-700 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors mt-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Another SKU
                </button>

                {/* Preview */}
                {previewQty > 0 && (
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 mt-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Order Preview</p>
                                <p className="text-sm text-amber-700 mt-0.5">
                                    {lines.filter(l => l.sku).length} SKU(s) · {previewQty.toFixed(2)} Ms
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Global error */}
                {globalError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                        {globalError}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        id="btn-submit-order"
                        onClick={handleSubmit}
                        className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold shadow-md shadow-amber-200 hover:shadow-lg hover:shadow-amber-300 hover:scale-[1.02] transition-all duration-200"
                    >
                        Place Order
                    </button>
                    <button
                        id="btn-cancel-order"
                        onClick={onCancel}
                        className="py-3 px-6 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

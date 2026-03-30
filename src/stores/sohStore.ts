import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SOHEntry {
    sku: string;       // Column C — numeric code e.g. "3473"
    label: string;     // Column E — human-readable SKU name
    stockMs: number;   // Column I — available quantity in Ms
    updatedAt: string;
    updatedBy: string;
}

interface SOHState {
    sohEntries: SOHEntry[];
    lastUpdatedAt: string | null;
    lastUpdatedBy: string | null;
    updateSOH: (entries: SOHEntry[], managerName: string) => void;
    getSOHForSku: (sku: string) => SOHEntry | null;
}

export const useSOHStore = create<SOHState>()(
    persist(
        (set, get) => ({
            sohEntries: [],
            lastUpdatedAt: null,
            lastUpdatedBy: null,

            updateSOH: (entries, managerName) => {
                const now = new Date().toISOString();
                set({
                    sohEntries: entries.map(e => ({
                        ...e,
                        updatedAt: now,
                        updatedBy: managerName,
                    })),
                    lastUpdatedAt: now,
                    lastUpdatedBy: managerName,
                });
            },

            getSOHForSku: (sku) => {
                return get().sohEntries.find(e => e.sku === sku) ?? null;
            },
        }),
        { name: 'leanx-soh-store' }
    )
);

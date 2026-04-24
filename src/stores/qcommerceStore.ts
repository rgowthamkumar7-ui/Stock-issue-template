import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PurchaseOrder, POStatus, PaymentStatus } from '../lib/types';

// --- ACL store for which user IDs have qcommerce access -----------------------
interface AccessControlEntry {
    userId: string;
    qcommerce: boolean;
    mdo: boolean;
    stock_issue: boolean;
}

// --- mSKU Mapping entry -------------------------------------------------------
export interface MSKUMapEntry {
    skuDesc: string;       // SkuDesc column from msku_match_result.csv
    marketSku: string;     // market_sku column
}

interface QCommerceState {
    purchaseOrders: PurchaseOrder[];
    accessList: AccessControlEntry[];
    mskuMap: MSKUMapEntry[];           // Persisted mSKU mapping table
    mskuMapFileName: string;           // Name of last uploaded file

    // PO actions
    addPO: (po: PurchaseOrder) => void;
    updatePOStatus: (id: string, status: POStatus) => void;
    updatePaymentStatus: (id: string, status: PaymentStatus) => void;
    updateAppointmentDate: (id: string, date: string) => void;
    confirmDelivery: (id: string, deliveries: Record<string, number>, overrideAmount?: number) => void;
    closePO: (id: string) => void;
    deletePO: (id: string) => void;

    // mSKU map actions
    setMSKUMap: (entries: MSKUMapEntry[], fileName: string) => void;
    addMSKUMapping: (skuDesc: string, marketSku: string) => void;
    clearMSKUMap: () => void;

    // Access control
    setUserAccess: (userId: string, permissions: Partial<Omit<AccessControlEntry, 'userId'>>) => void;
    getUserAccess: (userId: string) => AccessControlEntry;
    hasQCommerceAccess: (userId: string) => boolean;
}

export const useQCommerceStore = create<QCommerceState>()(
    persist(
        (set, get) => ({
            purchaseOrders: [],
            accessList: [],
            mskuMap: [],
            mskuMapFileName: '',

            addPO: (po) =>
                set((state) => ({
                    purchaseOrders: [po, ...state.purchaseOrders],
                })),

            updatePOStatus: (id, status) =>
                set((state) => ({
                    purchaseOrders: state.purchaseOrders.map((po) =>
                        po.id === id ? { ...po, po_status: status, updated_at: new Date().toISOString() } : po
                    ),
                })),

            updatePaymentStatus: (id, status) =>
                set((state) => ({
                    purchaseOrders: state.purchaseOrders.map((po) =>
                        po.id === id ? { ...po, payment_status: status, updated_at: new Date().toISOString() } : po
                    ),
                })),

            updateAppointmentDate: (id, date) =>
                set((state) => ({
                    purchaseOrders: state.purchaseOrders.map((po) =>
                        po.id === id ? { ...po, planned_appointment_date: date, updated_at: new Date().toISOString() } : po
                    ),
                })),

            confirmDelivery: (id, deliveries, overrideAmount) =>
                set((state) => {
                    return {
                        purchaseOrders: state.purchaseOrders.map((po) => {
                            if (po.id !== id) return po;

                            let calculated_delivered_amount = 0;
                            const newLines = po.line_items.map((line) => {
                                const delivered_quantity = deliveries[line.sku_code] ?? 0;
                                const delivered_value = delivered_quantity * line.unit_price;
                                calculated_delivered_amount += delivered_value;
                                return {
                                    ...line,
                                    delivered_quantity,
                                    delivered_value,
                                };
                            });

                            return {
                                ...po,
                                po_status: 'delivered',
                                delivered_amount: overrideAmount !== undefined ? overrideAmount : calculated_delivered_amount,
                                line_items: newLines,
                                updated_at: new Date().toISOString(),
                            };
                        }),
                    };
                }),

            closePO: (id) =>
                set((state) => ({
                    purchaseOrders: state.purchaseOrders.map((po) =>
                        po.id === id
                            ? { ...po, po_status: 'closed', payment_status: 'paid', updated_at: new Date().toISOString() }
                            : po
                    ),
                })),

            deletePO: (id) =>
                set((state) => ({
                    purchaseOrders: state.purchaseOrders.filter((po) => po.id !== id),
                })),

            setMSKUMap: (entries, fileName) =>
                set({ mskuMap: entries, mskuMapFileName: fileName }),

            addMSKUMapping: (skuDesc, marketSku) =>
                set((state) => {
                    const exists = state.mskuMap.some(e => e.skuDesc === skuDesc && e.marketSku === marketSku);
                    if (exists) return state;
                    return { mskuMap: [...state.mskuMap, { skuDesc, marketSku }] };
                }),

            clearMSKUMap: () =>
                set({ mskuMap: [], mskuMapFileName: '' }),

            setUserAccess: (userId, permissions) =>
                set((state) => {
                    const existing = state.accessList.find((e) => e.userId === userId);
                    if (existing) {
                        return {
                            accessList: state.accessList.map((e) =>
                                e.userId === userId ? { ...e, ...permissions } : e
                            ),
                        };
                    }
                    return {
                        accessList: [
                            ...state.accessList,
                            { userId, stock_issue: true, mdo: true, qcommerce: false, ...permissions },
                        ],
                    };
                }),

            getUserAccess: (userId) => {
                const found = get().accessList.find((e) => e.userId === userId);
                // Default: stock_issue and mdo ON, qcommerce OFF
                return found ?? { userId, stock_issue: true, mdo: true, qcommerce: false };
            },

            hasQCommerceAccess: (userId) => {
                const entry = get().accessList.find((e) => e.userId === userId);
                return entry?.qcommerce ?? false;
            },
        }),
        {
            name: 'leanx-qcommerce-store',
        }
    )
);

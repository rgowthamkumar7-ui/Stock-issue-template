import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MDOOrder, MDOSkuItem } from '../lib/types';

interface MDOState {
    pendingOrder: MDOOrder | null;
    orderHistory: MDOOrder[];
    setPendingOrder: (order: MDOOrder | null) => void;
    addOrder: (order: MDOOrder) => void;
    confirmRemittance: (orderId: string) => void;
    clearPendingOrder: () => void;
}

export const useMDOStore = create<MDOState>()(
    persist(
        (set) => ({
            pendingOrder: null,
            orderHistory: [],

            setPendingOrder: (order) => set({ pendingOrder: order }),

            addOrder: (order) =>
                set((state) => ({
                    orderHistory: [order, ...state.orderHistory],
                    pendingOrder: order,
                })),

            confirmRemittance: (orderId) =>
                set((state) => ({
                    orderHistory: state.orderHistory.map((o) =>
                        o.id === orderId ? { ...o, remittance_confirmed: true, status: 'confirmed' } : o
                    ),
                    pendingOrder:
                        state.pendingOrder?.id === orderId
                            ? { ...state.pendingOrder, remittance_confirmed: true, status: 'confirmed' }
                            : state.pendingOrder,
                })),

            clearPendingOrder: () => set({ pendingOrder: null }),
        }),
        {
            name: 'leanx-mdo-store',
        }
    )
);

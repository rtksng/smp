import { create } from "zustand";

type CartState = {
  itemCount: number;
  reset: () => void;
  setSummary: (summary: { itemCount: number; totalQuantity: number }) => void;
  totalQuantity: number;
};

export const useCartStore = create<CartState>((set) => ({
  itemCount: 0,
  reset: () => set({ itemCount: 0, totalQuantity: 0 }),
  setSummary: (summary) =>
    set({
      itemCount: summary.itemCount,
      totalQuantity: summary.totalQuantity
    }),
  totalQuantity: 0
}));

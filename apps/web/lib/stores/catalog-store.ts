import { create } from "zustand";
import { z } from "zod";

export const productSearchSchema = z
  .string()
  .trim()
  .max(160, "Search must be 160 characters or fewer.");

type CatalogState = {
  searchInput: string;
  submittedSearch: string;
  setSearchInput: (value: string) => void;
  submitSearch: () => string;
};

export const useCatalogStore = create<CatalogState>((set, get) => ({
  searchInput: "",
  setSearchInput: (value) => set({ searchInput: value }),
  submitSearch: () => {
    const parsed = productSearchSchema.parse(get().searchInput);
    set({ searchInput: parsed, submittedSearch: parsed });

    return parsed;
  },
  submittedSearch: ""
}));

import { create } from 'zustand';
import { VAULT, type VaultItem } from './mockData';

interface VaultState {
  items: VaultItem[];
  addItem: (i: VaultItem) => void;
  updateItem: (id: string, patch: Partial<VaultItem>) => void;
  removeItem: (id: string) => void;
  getItem: (id: string) => VaultItem | undefined;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  items: VAULT.map((v) => ({ ...v })),
  addItem: (i) => set((s) => ({ items: [i, ...s.items] })),
  updateItem: (id, patch) =>
    set((s) => ({
      items: s.items.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    })),
  removeItem: (id) => set((s) => ({ items: s.items.filter((v) => v.id !== id) })),
  getItem: (id) => get().items.find((v) => v.id === id),
}));

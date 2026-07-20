import { create } from 'zustand';

const useFabActionStore = create((set) => ({
  pendingAction: null,

  triggerAction: (type) => {
    set({ pendingAction: { type, timestamp: Date.now() } });
  },

  clearAction: () => {
    set({ pendingAction: null });
  },
}));

export default useFabActionStore;

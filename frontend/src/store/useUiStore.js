import { create } from 'zustand';

/**
 * Zustand micro-state store for 60fps GPU-accelerated UI interactions.
 * Decouples high-frequency mouseover and highlight coordinate updates from
 * the main document React component tree, preventing re-renders of large documents.
 */
export const useUiStore = create((set, get) => ({
  activeHoverId: null,
  activeHoverCoords: null, // { x1, y1, x2, y2 }
  selectedMatchId: null,
  filterSourceId: null,
  isBezierActive: false,

  setActiveHover: (matchId, elementRect = null, targetCardRect = null) => {
    if (!matchId) {
      set({ activeHoverId: null, activeHoverCoords: null, isBezierActive: false });
      return;
    }

    let coords = null;
    if (elementRect && targetCardRect) {
      coords = {
        x1: elementRect.right,
        y1: elementRect.top + elementRect.height / 2,
        x2: targetCardRect.left,
        y2: targetCardRect.top + targetCardRect.height / 2,
      };
    }

    set({
      activeHoverId: matchId,
      activeHoverCoords: coords,
      isBezierActive: Boolean(coords),
    });
  },

  clearActiveHover: () => {
    if (get().activeHoverId !== null) {
      set({ activeHoverId: null, activeHoverCoords: null, isBezierActive: false });
    }
  },

  setSelectedMatch: (matchId) => {
    set({ selectedMatchId: matchId });
  },

  setFilterSource: (sourceId) => {
    set((state) => ({
      filterSourceId: state.filterSourceId === sourceId ? null : sourceId,
    }));
  },

  clearFilterSource: () => {
    set({ filterSourceId: null });
  },
}));

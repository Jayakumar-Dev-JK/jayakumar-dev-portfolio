// Which section is "current" (the phone header title, the highlighted nav item)? The one that fills the
// most of the visible screen. Unlike "at least 60% of the section is visible", this works for a section of
// any height: a long projects list can never be 60% visible, so it was never picked and the title stayed
// on whichever section came before (or after) it.
//
// `visibleHeights` maps a section id to how many pixels of it are on screen right now, in document order.
// Ties go to the earlier section; nothing visible returns null.
export function pickActiveSection(visibleHeights) {
  let best = null;
  let bestHeight = 0;
  visibleHeights.forEach((height, id) => {
    if (height > bestHeight) {
      best = id;
      bestHeight = height;
    }
  });
  return best;
}

// 0, 0.02, 0.04 ... 1: fine steps so the visible height is re-read often while a section scrolls past.
export const VISIBILITY_THRESHOLDS = Array.from({ length: 51 }, (_, i) => i / 50);

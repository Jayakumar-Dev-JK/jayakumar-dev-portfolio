// How far before the end of the Projects section the pinned bar lets go.
//
// The bar releases at the moment the end of the list reaches PEEK of the screen height from the top, which is
// when the next section's heading (it sits just below the list) first peeks in near the bottom of the screen.
// From then on the page simply scrolls on into the next section.
//
//   screen        = the whole visible height (the scroll area, or the window)
//   pinnedTop     = where the bar pins (0, or the height of a fixed header on phones)
//   barHeight     = height of the pinned bar
//
// While the bar is pinned its bottom edge is at pinnedTop + barHeight, and it lets go when the section's end is
// that far above `release` px. So release = (where the end of the list should be) - (the bar's bottom edge).
export const PEEK = 0.9; // the next heading appears about 10% up from the bottom of the screen

export function releaseDistance(screen, pinnedTop, barHeight) {
  if (!(screen > 0)) return 0;
  return Math.max(0, Math.round(PEEK * screen - pinnedTop - barHeight));
}

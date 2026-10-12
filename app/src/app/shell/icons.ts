/** Stroke icon paths (24×24, stroke 2). Decorative; always paired with a text label. */
export const ICONS = {
  today: 'M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 3v2M4.9 6.9l1.4 1.4M19.1 6.9l-1.4 1.4M3 20h18',
  news: 'M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM7 9h10M7 13h10M7 17h6',
  archive: 'M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5V9H3zM5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
} as const;
export type IconName = keyof typeof ICONS;

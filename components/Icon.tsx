// Line icons from the original store (same paths, same 1.8 stroke).
const ICON = {
  heart: '<path d="M12 20.5s-7.5-4.6-7.5-10.3A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z"/>',
  bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  arrow: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowr: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.7"/><circle cx="17" cy="17.5" r="1.7"/>',
  leaf: '<path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15zM5 19l8-8"/>',
  drop: '<path d="M12 3s-6 6.5-6 11a6 6 0 0 0 12 0c0-4.5-6-11-6-11z"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M12 9v11M3 9h18M12 9c-3 0-5-1-5-3s3-2.5 5 3c2-5.5 5-5 5-3s-2 3-5 3z"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  // Day 4 additions (same style)
  user: '<circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20c1.2-3.7 4-5.6 7.2-5.6s6 1.9 7.2 5.6"/>',
  logout: '<path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4"/><path d="M14 8l-4 4 4 4M10 12h10"/>',
  box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
} as const;

export type IconName = keyof typeof ICON;

export function Icon({ name, className = 'i' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON[name] }}
    />
  );
}

/** The Wasmi drop-and-ripples mark. */
export function LogoMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 4C24 4 11 18.5 11 27.5a13 13 0 0 0 26 0C37 18.5 24 4 24 4z" fill="#E58A2B" />
      <path d="M18.5 28a6 6 0 0 0 4 5.6" fill="none" stroke="#1E120B" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="24" cy="43" rx="13" ry="3" fill="none" stroke="currentColor" strokeOpacity=".55" />
      <ellipse cx="24" cy="43" rx="20" ry="4.4" fill="none" stroke="currentColor" strokeOpacity=".25" />
    </svg>
  );
}

/** Logo variant without the inner highlight (brand page swatches). */
export function LogoSwatch() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 4C24 4 11 18.5 11 27.5a13 13 0 0 0 26 0C37 18.5 24 4 24 4z" fill="#E58A2B" />
      <ellipse cx="24" cy="43" rx="13" ry="3" fill="none" stroke="currentColor" strokeOpacity=".55" />
      <ellipse cx="24" cy="43" rx="20" ry="4.4" fill="none" stroke="currentColor" strokeOpacity=".25" />
    </svg>
  );
}

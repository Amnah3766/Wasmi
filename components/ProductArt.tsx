// Product illustrations ported 1:1 from the original artJar / artBottle / artIncense string builders.
// Each instance gets unique gradient ids (useId), like the original's running counter.
import { useId } from 'react';
import type { CatalogProduct } from '@/lib/shop/types';

export type ArtProduct = Pick<CatalogProduct, 'slug' | 'name' | 'kind' | 'colors'>;

/** Splits a long name into two balanced lines and sizes it to fit the label (original `lbl`). */
export function labelLines(name: string, w: number, b: number): { parts: string[]; fs: number } {
  let parts = [name];
  if (name.length > 9 && name.indexOf(' ') > -1) {
    const ws = name.split(' ');
    let best = 1;
    let bd = 1e9;
    for (let i = 1; i < ws.length; i++) {
      const a = ws.slice(0, i).join(' ');
      const c = ws.slice(i).join(' ');
      const d = Math.abs(a.length - c.length);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    parts = [ws.slice(0, best).join(' '), ws.slice(best).join(' ')];
  }
  const longest = Math.max(...parts.map((t) => t.length));
  const fs = Math.min(b, w / (longest * 0.55));
  return { parts, fs };
}

function Label({ name, x, y, w, b }: { name: string; x: number; y: number; w: number; b: number }) {
  const { parts, fs } = labelLines(name, w, b);
  return (
    <>
      {parts.map((t, i) => (
        <text
          key={i}
          x={x}
          y={(y + (i - (parts.length - 1) / 2) * fs * 1.15).toFixed(1)}
          textAnchor="middle"
          fontFamily="Reem Kufi, sans-serif"
          fontSize={fs.toFixed(1)}
          fill="#F3E6C8"
        >
          {t}
        </text>
      ))}
    </>
  );
}

function useUid(slug: string) {
  return slug + useId().replace(/[^a-zA-Z0-9_-]/g, '');
}

function Jar({ p, className }: { p: ArtProduct; className?: string }) {
  const u = useUid(p.slug);
  return (
    <svg viewBox="0 0 200 250" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`a${u}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.colors.c1} />
          <stop offset="1" stopColor={p.colors.c2} />
        </linearGradient>
        <radialGradient id={`b${u}`}>
          <stop offset="0" stopColor="#FFD27A" stopOpacity=".85" />
          <stop offset="1" stopColor="#FFD27A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`s${u}`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".3" />
          <stop offset=".25" stopColor="#fff" stopOpacity="0" />
          <stop offset=".85" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".25" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="228" rx="64" ry="8" fill="#000" opacity=".28" />
      <circle cx="100" cy="76" r="46" fill={`url(#b${u})`} />
      <rect x="44" y="100" width="112" height="124" rx="14" fill={`url(#a${u})`} />
      <rect x="44" y="100" width="112" height="124" rx="14" fill={`url(#s${u})`} />
      <rect x="44" y="100" width="112" height="124" rx="14" fill="none" stroke="#fff" strokeOpacity=".2" />
      <path d="M56 112v96" stroke="#fff" strokeOpacity=".25" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="100" cy="102" rx="52" ry="7" fill="#fff" fillOpacity=".22" />
      <path d="M100 102V88" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
      <path className="flame" d="M100 52c7 10 9 17 0 32c-9-15-7-22 0-32z" fill="#FFC857" />
      <path d="M100 66c3 5 4 8 0 14c-4-6-3-9 0-14z" fill="#FFF2C9" />
      <rect x="58" y="142" width="84" height="56" rx="3" fill="#1E120B" fillOpacity=".62" />
      <Label name={p.name} x={100} y={166} w={78} b={17} />
      <text x="100" y="186" textAnchor="middle" fontFamily="IBM Plex Sans Arabic, sans-serif" fontSize="7.5" letterSpacing="2.5" fill="#F3E6C8" fillOpacity=".7">
        WASMI
      </text>
    </svg>
  );
}

function Bottle({ p, className }: { p: ArtProduct; className?: string }) {
  const u = useUid(p.slug);
  return (
    <svg viewBox="0 0 200 250" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`a${u}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.colors.c1} />
          <stop offset="1" stopColor={p.colors.c2} />
        </linearGradient>
        <linearGradient id={`c${u}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F2C56B" />
          <stop offset="1" stopColor="#B9832A" />
        </linearGradient>
        <linearGradient id={`s${u}`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".3" />
          <stop offset=".3" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".25" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="230" rx="56" ry="7" fill="#000" opacity=".28" />
      <rect x="58" y="108" width="84" height="118" rx="12" fill={`url(#a${u})`} />
      <rect x="58" y="108" width="84" height="118" rx="12" fill={`url(#s${u})`} />
      <rect x="58" y="108" width="84" height="118" rx="12" fill="none" stroke="#fff" strokeOpacity=".2" />
      <path d="M68 122v88" stroke="#fff" strokeOpacity=".25" strokeWidth="5" strokeLinecap="round" />
      <rect x="88" y="92" width="24" height="18" fill="#D9B25F" />
      <rect x="80" y="50" width="40" height="44" rx="6" fill={`url(#c${u})`} />
      <path d="M80 66h40" stroke="#6B4A12" strokeOpacity=".35" />
      <rect x="66" y="148" width="68" height="54" rx="3" fill="#1E120B" fillOpacity=".62" />
      <Label name={p.name} x={100} y={170} w={62} b={14} />
      <text x="100" y="190" textAnchor="middle" fontFamily="IBM Plex Sans Arabic, sans-serif" fontSize="7" letterSpacing="2.5" fill="#F3E6C8" fillOpacity=".7">
        WASMI
      </text>
    </svg>
  );
}

function Incense({ p, className }: { p: ArtProduct; className?: string }) {
  const u = useUid(p.slug);
  return (
    <svg viewBox="0 0 200 250" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`a${u}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.colors.c1} />
          <stop offset="1" stopColor={p.colors.c2} />
        </linearGradient>
        <radialGradient id={`e${u}`}>
          <stop offset="0" stopColor="#FF9A3C" stopOpacity=".8" />
          <stop offset="1" stopColor="#FF9A3C" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="234" rx="66" ry="8" fill="#000" opacity=".28" />
      <path className="smoke" d="M100 154C84 136 118 120 100 98S112 64 98 36" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" />
      <path
        className="smoke"
        d="M112 156C126 140 96 124 114 104S102 76 116 54"
        fill="none"
        stroke="#fff"
        strokeOpacity=".28"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ animationDelay: '-1.2s' }}
      />
      <rect x="82" y="222" width="36" height="8" rx="2" fill={p.colors.c2} />
      <path d="M40 166H160C160 208 132 224 100 224C68 224 40 208 40 166Z" fill={`url(#a${u})`} />
      <ellipse cx="100" cy="166" rx="60" ry="9" fill="#fff" fillOpacity=".2" stroke="#fff" strokeOpacity=".25" />
      <ellipse cx="100" cy="164" rx="34" ry="14" fill={`url(#e${u})`} />
      <ellipse cx="100" cy="164" rx="20" ry="5" fill="#FF9A3C" fillOpacity=".9" />
      <Label name={p.name} x={100} y={198} w={70} b={15} />
    </svg>
  );
}

export function ProductArt({ p, className }: { p: ArtProduct; className?: string }) {
  if (p.kind === 'jar') return <Jar p={p} className={className} />;
  if (p.kind === 'bottle') return <Bottle p={p} className={className} />;
  return <Incense p={p} className={className} />;
}

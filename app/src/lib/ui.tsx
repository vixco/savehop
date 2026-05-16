export function BookmarkIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7 5.5C7 4.67157 7.67157 4 8.5 4H23.5C24.3284 4 25 4.67157 25 5.5V27.5L16 22L7 27.5V5.5Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M11.5 13.5L14.5 16.5L20.5 10.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CopyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="4.5" y="4.5" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.5 11V3.5C3.5 2.94772 3.94772 2.5 4.5 2.5H10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SunIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 1.5V3M8 13V14.5M14.5 8H13M3 8H1.5M12.6 3.4L11.5 4.5M4.5 11.5L3.4 12.6M12.6 12.6L11.5 11.5M4.5 4.5L3.4 3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function MoonIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M13.5 9.5C12.7 11.6 10.6 13.1 8.2 13.1C5 13.1 2.4 10.5 2.4 7.3C2.4 4.9 3.9 2.9 6 2.1C5.7 2.7 5.5 3.4 5.5 4.1C5.5 6.8 7.7 9 10.4 9C11.2 9 12 8.8 12.7 8.4C12.9 8.8 13.2 9.1 13.5 9.5Z" fill="currentColor" />
    </svg>
  );
}

export function ClockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.5V8L10.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SaveIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 2.5h7.5L13 5v8.5H3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="5" y="2.5" width="5" height="3.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="5" y="9" width="6" height="4.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7.5" width="10" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 7.5V5.25C5.5 3.87 6.62 2.75 8 2.75C9.38 2.75 10.5 3.87 10.5 5.25V7.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function GearIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M16 10c0-.4-.05-.78-.13-1.15l1.7-1.32-1.7-2.94-2.04.74A6 6 0 0 0 12 4.3l-.31-2.15h-3.38L8 4.3a6 6 0 0 0-1.83 1.03l-2.04-.74-1.7 2.94 1.7 1.32A6.18 6.18 0 0 0 4 10c0 .4.05.78.13 1.15l-1.7 1.32 1.7 2.94 2.04-.74A6 6 0 0 0 8 15.7l.31 2.15h3.38L12 15.7a6 6 0 0 0 1.83-1.03l2.04.74 1.7-2.94-1.7-1.32c.08-.37.13-.75.13-1.15Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CrownIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path
        d="M1.5 4 3.5 7 7 3l3.5 4 2-3v6.5h-11V4Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <rect x="1.5" y="10.5" width="11" height="1.5" rx="0.5" fill="currentColor" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const AVATAR_PALETTE = [
  ['#a78bfa', '#7c3aed'], // violet
  ['#fbbf24', '#d97706'], // amber
  ['#f472b6', '#db2777'], // pink
  ['#34d399', '#059669'], // emerald
  ['#60a5fa', '#2563eb'], // blue
  ['#fb7185', '#e11d48'], // rose
  ['#facc15', '#ca8a04'], // yellow
  ['#22d3ee', '#0891b2'], // cyan
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function avatarColors(id: string): [string, string] {
  return AVATAR_PALETTE[hashStr(id) % AVATAR_PALETTE.length] as [string, string];
}

export function avatarInitial(name: string): string {
  return (name.trim()[0] || '?').toUpperCase();
}

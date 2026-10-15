import type { ReactElement } from 'react'
import { cn } from '@/lib/cn'

/*
  A tiny inline-SVG icon set (no icon library). Each entry is the inside of a
  24×24 stroked SVG. It has no state or server-only imports, so it works in
  Server and Client Components alike.

  `satisfies` checks every value is an element, while `keyof typeof ICONS`
  turns the keys into the IconName union: a typo is a compile error.
*/
const ICONS = {
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  pin: (
    <>
      <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z" />
      <path d="M12 14v6" />
    </>
  ),
  archive: (
    <>
      <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
      <path d="M5 8.5v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9M10 12.5h4" />
    </>
  ),
  unarchive: (
    <>
      <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
      <path d="M5 8.5v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9M12 17v-5m-2.5 2.5L12 12l2.5 2.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M10 11v6m4-6v6" />
      <path d="M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
    </>
  ),
  restore: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v3.7h3.7" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.2 6.2a1.5 1.5 0 0 1-2.1 0Z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  close: <path d="m6.5 6.5 11 11m0-11-11 11" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (
    <>
      <path d="M12 4 2.8 19.5h18.4Z" />
      <path d="M12 10v4.5m0 2.5v.01" />
    </>
  ),
  cloudOff: (
    <>
      <path d="M7 18.5h10.5a3.5 3.5 0 0 0 .6-6.95A6 6 0 0 0 7.2 9.6 4.5 4.5 0 0 0 7 18.5Z" />
      <path d="m4 4 16 16" />
    </>
  ),
  arrowLeft: <path d="M19 12H5m5-5-5 5 5 5" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />,
  note: (
    <>
      <path d="M6 3.5h8.5l4 4V20a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z" />
      <path d="M14.5 3.5v4h4M8.5 12h7m-7 4h5" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </>
  ),
} satisfies Record<string, ReactElement>

export type IconName = keyof typeof ICONS

/** Decorative by default (aria-hidden): the button or link around it carries the label. */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={cn('size-5 shrink-0', className)}
    >
      {ICONS[name]}
    </svg>
  )
}

import Link from 'next/link'
import { site } from '@/lib/site'

/**
 * The wordmark with a small mark drawn like an adire eleko motif: concentric
 * rings of resist dots around a solid centre, in indigo with a lime heart.
 */
export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5 rounded-control no-underline">
      <svg viewBox="0 0 32 32" aria-hidden className="size-8 shrink-0">
        <circle cx="16" cy="16" r="15" className="fill-indigo" />
        <circle cx="16" cy="16" r="10.5" fill="none" className="stroke-on-indigo" strokeWidth="1.6" strokeDasharray="0.1 3.2" strokeLinecap="round" />
        <circle cx="16" cy="16" r="6" fill="none" className="stroke-on-indigo" strokeWidth="1.4" />
        <circle cx="16" cy="16" r="2.6" className="fill-lime" />
      </svg>
      <span className="font-display text-2xl leading-none tracking-tight">
        {site.name}
      </span>
    </Link>
  )
}

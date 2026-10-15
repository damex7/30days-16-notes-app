// CLIENT COMPONENT: it reads the current path to mark the active link, and
// the path is only known in the browser (or per request on the server).
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

const LINKS = [
  { href: '/', label: 'Notes' },
  { href: '/archive', label: 'Archive' },
  { href: '/trash', label: 'Trash' },
  { href: '/tags', label: 'Tags' },
  { href: '/about', label: 'About' },
] as const

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/' || pathname.startsWith('/notes/')
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function NavLinks() {
  const pathname = usePathname()
  return <NavList isCurrent={(href) => isActive(pathname, href)} />
}

/** Rendered with no active link while the path is unknown (the Suspense fallback). */
export function NavList({ isCurrent = () => false }: { isCurrent?: (href: string) => boolean }) {
  return (
    <ul className="flex items-center gap-0.5 sm:gap-1">
      {LINKS.map(({ href, label }) => {
        const current = isCurrent(href)
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'block rounded-pill px-2.5 py-1.5 text-sm no-underline transition-colors sm:px-3',
                current ? 'bg-indigo-soft font-semibold text-indigo' : 'text-muted hover:bg-sunken hover:text-ink',
              )}
            >
              {label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

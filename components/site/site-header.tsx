import { Suspense } from 'react'
import { Logo } from '@/components/site/logo'
import { NavLinks, NavList } from '@/components/site/nav-links'
import { ThemeToggle } from '@/components/site/theme-toggle'

/**
 * SERVER COMPONENT shell around two small client islands: the nav links
 * (they read the path) and the theme toggle. usePathname() sits in its own
 * <Suspense> so the rest of the header is part of the static shell.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 sm:px-5 sm:py-3">
        <Logo />
        <nav aria-label="Main" className="order-last -mx-1 w-full overflow-x-auto no-scrollbar sm:order-none sm:mx-0 sm:w-auto">
          <Suspense fallback={<NavList />}>
            <NavLinks />
          </Suspense>
        </nav>
        <ThemeToggle />
      </div>
      <div className="adire-rule h-1.5 opacity-60" aria-hidden />
    </header>
  )
}

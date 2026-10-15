// CLIENT COMPONENT: it responds to clicks, reads the OS colour preference and
// writes localStorage. All three only exist in the browser.
'use client'

import { useSyncExternalStore } from 'react'
import { Icon } from '@/components/ui/icon'
import { THEME_STORAGE_KEY, type ThemeChoice } from '@/lib/theme'

const CHANGE_EVENT = 'iranti-theme-change'
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

/** The theme actually showing: a saved choice, or else the OS setting. */
function currentTheme(): ThemeChoice {
  const attr = document.documentElement.dataset.theme
  if (attr === 'light' || attr === 'dark') return attr
  return darkQuery().matches ? 'dark' : 'light'
}

function subscribe(onChange: () => void) {
  const media = darkQuery()
  media.addEventListener('change', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    media.removeEventListener('change', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

function choose(theme: ThemeChoice) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage blocked (some private modes): still switch for this visit.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/**
 * One button that switches between light and dark. The server can't know
 * the theme, so it renders a neutral button (null snapshot) and the browser
 * fills in the real state after hydration, the same trick as the cart badge.
 * The colours are already right before that: the <head> script set them.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore<ThemeChoice | null>(subscribe, currentTheme, () => null)
  const next: ThemeChoice = theme === 'dark' ? 'light' : 'dark'
  const label = theme ? `Switch to ${next} theme` : 'Switch colour theme'

  return (
    <button
      type="button"
      onClick={() => choose(next)}
      aria-label={label}
      title={label}
      className="grid size-11 place-items-center rounded-pill text-muted transition-colors hover:bg-sunken hover:text-ink"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  )
}

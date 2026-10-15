// CLIENT COMPONENT: it reacts to typing and changes the URL.
'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { SEARCH_INPUT_ID } from '@/components/site/keyboard-shortcuts'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { listQueryString } from '@/lib/list-url'
import { SEARCH_MAX } from '@/lib/schema/note'

/**
 * The search box. The query lives in the URL (?q=...), not in React state:
 * a search can be shared, bookmarked and survives a refresh, and the server
 * reads it to run the full-text query.
 *
 * Typing updates the URL 300 ms after the last key (a DEBOUNCE), with
 * router.replace so each letter doesn't become a Back-button step. The
 * update runs in a transition, so the old results stay on screen (dimmed)
 * until the new ones arrive.
 */
export function SearchBox() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const tag = searchParams.get('tag') ?? undefined

  const [value, setValue] = useState(urlQuery)
  const [pending, startTransition] = useTransition()
  const timer = useRef<number | undefined>(undefined)

  // Back/Forward changes the URL without typing: follow it.
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery)
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery)
    setValue(urlQuery)
  }

  useEffect(() => {
    return () => window.clearTimeout(timer.current)
  }, [])

  function navigate(q: string) {
    // Searching from the editor keeps the editor open and filters the list
    // beside it; anywhere else, results show on the notes list.
    const base = pathname.startsWith('/notes/') ? pathname : '/'
    startTransition(() => {
      router.replace(`${base}${listQueryString({ q: q.trim(), tag })}`, { scroll: false })
    })
  }

  function onChange(next: string) {
    setValue(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => navigate(next), 300)
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        window.clearTimeout(timer.current)
        navigate(value)
      }}
      className="relative flex-1"
    >
      <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
        Search notes
      </label>
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted" />
      <input
        id={SEARCH_INPUT_ID}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault()
            onChange('')
          }
        }}
        maxLength={SEARCH_MAX}
        placeholder="Search notes"
        aria-keyshortcuts="/"
        autoComplete="off"
        className={cn('field h-10 w-full pr-3 pl-9 text-sm', pending && 'opacity-70')}
      />
    </form>
  )
}

/** Shown in the static shell until the search params are known. */
export function SearchBoxFallback() {
  return (
    <div className="relative flex-1">
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted" />
      <input aria-label="Search notes" disabled placeholder="Search notes" className="field h-10 w-full pr-3 pl-9 text-sm" />
    </div>
  )
}

// CLIENT COMPONENT: the editor holds what you're typing, saves it in the
// background and reacts to clicks instantly.
'use client'

import Link from 'next/link'
import { useEffect, useLayoutEffect, useOptimistic, useRef, useState, useTransition, type RefObject } from 'react'
import { moveToTrashAction, saveNoteAction, setArchivedAction, setPinnedAction, type SaveResult } from '@/app/(app)/actions'
import { TagInput } from '@/components/notes/tag-input'
import { button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { longDate, shortDate, wordCount } from '@/lib/format'
import { BODY_MAX, TITLE_MAX, type Note } from '@/lib/schema/note'

/** How long after the last keystroke the note is saved. */
const AUTOSAVE_DELAY_MS = 800

type Draft = { title: string; body: string; tags: string[] }

type Status =
  | { kind: 'saved' }
  | { kind: 'saving' }
  | { kind: 'retrying'; inSeconds: number }
  | { kind: 'invalid'; message: string }
  /** Someone else saved first: autosave stops until you choose. */
  | { kind: 'conflict'; server: Note }
  | { kind: 'gone' }

const snapshot = (d: Draft) => JSON.stringify([d.title, d.body, d.tags])

type Props = {
  note: Note
  tagSuggestions: string[]
  /** Back to the list, keeping its search and filter (phones). */
  backHref: string
}

/**
 * AUTOSAVE, step by step:
 * 1. Every change updates the draft and (re)starts an 800 ms timer: a
 *    DEBOUNCE, so a burst of typing becomes one save, not one per key.
 * 2. When the timer fires, the draft is sent to saveNoteAction with the
 *    version this editor last saved (or loaded). Only one save is in flight
 *    at a time; edits made meanwhile are sent right after it returns.
 * 3. The answer decides what happens next: saved (remember the new
 *    version), conflict (stop and ask), or the database was unreachable
 *    (retry after 2, 4, 8... seconds, up to 30).
 *
 * The draft is kept in a ref as well as in state: the timer callback needs
 * the LATEST draft, and a ref always holds it, whereas state seen from an
 * old callback would be stale.
 *
 * The component's state comes from `note` only once, when it mounts (the
 * page renders it with key={note.id}). When a save makes the page re-render
 * with fresh props, what you're typing is never replaced.
 */
export function NoteEditor({ note, tagSuggestions, backHref }: Props) {
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [tags, setTags] = useState(note.tags)
  const [status, setStatus] = useState<Status>({ kind: 'saved' })
  const [savedAt, setSavedAt] = useState(note.updatedAt)

  const draft = useRef<Draft>({ title: note.title, body: note.body, tags: note.tags })
  const version = useRef(note.version)
  const lastSaved = useRef(snapshot(draft.current))
  const inFlight = useRef(false)
  /** True while a conflict (or a deleted note) is waiting for a decision. */
  const blocked = useRef(false)
  const attempts = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  function schedule(delay: number) {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), delay)
  }

  async function flush() {
    window.clearTimeout(timer.current)
    if (inFlight.current || blocked.current) return
    const sending = draft.current
    const key = snapshot(sending)
    if (key === lastSaved.current) {
      setStatus({ kind: 'saved' })
      return
    }

    inFlight.current = true
    setStatus({ kind: 'saving' })
    let result: SaveResult
    try {
      result = await saveNoteAction({ id: note.id, expectedVersion: version.current, ...sending })
    } catch {
      // The request itself failed (offline, server restarting).
      result = { ok: false, error: 'unavailable' }
    }
    inFlight.current = false

    if (result.ok) {
      version.current = result.version
      lastSaved.current = key
      attempts.current = 0
      setSavedAt(result.updatedAt)
      // Typed more while that save was on its way? Send that too.
      if (snapshot(draft.current) !== key) schedule(0)
      else setStatus({ kind: 'saved' })
      return
    }

    switch (result.error) {
      case 'conflict':
        blocked.current = true
        setStatus({ kind: 'conflict', server: result.server })
        return
      case 'gone':
        blocked.current = true
        setStatus({ kind: 'gone' })
        return
      case 'invalid':
        setStatus({ kind: 'invalid', message: result.message })
        return
      case 'unavailable': {
        attempts.current += 1
        const seconds = Math.min(30, 2 ** attempts.current)
        setStatus({ kind: 'retrying', inSeconds: seconds })
        schedule(seconds * 1000)
        return
      }
    }
  }

  function edit(patch: Partial<Draft>) {
    draft.current = { ...draft.current, ...patch }
    if (patch.title !== undefined) setTitle(patch.title)
    if (patch.body !== undefined) setBody(patch.body)
    if (patch.tags !== undefined) setTags(patch.tags)
    if (blocked.current) return
    setStatus({ kind: 'saving' })
    // Tags are a deliberate action: save them straight away.
    schedule(patch.tags ? 0 : AUTOSAVE_DELAY_MS)
  }

  /** Conflict choice 1: drop my changes and load the version saved elsewhere. */
  function reloadTheirs(server: Note) {
    draft.current = { title: server.title, body: server.body, tags: server.tags }
    setTitle(server.title)
    setBody(server.body)
    setTags(server.tags)
    version.current = server.version
    lastSaved.current = snapshot(draft.current)
    blocked.current = false
    setSavedAt(server.updatedAt)
    setStatus({ kind: 'saved' })
  }

  /** Conflict choice 2: save mine ON TOP of theirs, now that I've seen it. */
  function keepMine(server: Note) {
    version.current = server.version
    blocked.current = false
    void flush()
  }

  // Leaving the page with unsaved changes: save them (navigating within the
  // app) or ask the browser to warn (closing the tab).
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (inFlight.current || snapshot(draft.current) !== lastSaved.current) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      window.clearTimeout(timer.current)
      if (!blocked.current && snapshot(draft.current) !== lastSaved.current) void flush()
    }
    // flush reads only refs, so the first render's copy is always current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pin and archive come from the server (props). useOptimistic shows the
  // new value the moment you click, while the Server Action runs; the
  // page then re-renders with the real value.
  const [pinned, setOptimisticPinned] = useOptimistic(note.pinned)
  const [archived, setOptimisticArchived] = useOptimistic(note.archived)
  const [actionPending, startAction] = useTransition()
  const [announcement, setAnnouncement] = useState('')

  function togglePinned() {
    startAction(async () => {
      setOptimisticPinned(!pinned)
      try {
        await setPinnedAction(note.id, !pinned)
        setAnnouncement(pinned ? 'Unpinned.' : 'Pinned to the top of the list.')
      } catch {
        setAnnouncement("Couldn't reach the database. Nothing was changed.")
      }
    })
  }

  function toggleArchived() {
    startAction(async () => {
      setOptimisticArchived(!archived)
      // Archiving unpins (the database enforces it).
      if (!archived) setOptimisticPinned(false)
      try {
        await setArchivedAction(note.id, !archived)
        setAnnouncement(archived ? 'Moved back to your notes.' : 'Archived. It no longer shows in the main list.')
      } catch {
        setAnnouncement("Couldn't reach the database. Nothing was changed.")
      }
    })
  }

  function trash() {
    startAction(async () => {
      await flush()
      // Redirects to the list when done.
      await moveToTrashAction(note.id, true)
    })
  }

  const titleRef = useRef<HTMLTextAreaElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  useAutosize(titleRef, title)
  useAutosize(bodyRef, body)

  const disabled = status.kind === 'gone'

  return (
    <article
      className="mx-auto flex w-full max-w-reading flex-1 flex-col px-4 pt-3 pb-10 sm:px-6"
      onKeyDown={(e) => {
        // Ctrl/Cmd+S saves now instead of opening the browser's save dialog.
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault()
          void flush()
        }
        // Escape leaves the text field, so the n and / shortcuts work again.
        if (e.key === 'Escape' && e.target instanceof HTMLElement) e.target.blur()
      }}
    >
      <h1 className="sr-only">Edit note: {title || 'Untitled'}</h1>

      {/* Toolbar */}
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-1 border-b border-line bg-paper px-2 py-1.5 sm:-mx-6 sm:px-4">
        <Link href={backHref} className={cn(button.ghost, 'px-3 lg:hidden')}>
          <Icon name="arrowLeft" className="size-4.5" />
          Notes
        </Link>
        <SaveStatus status={status} savedAt={savedAt} />
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={togglePinned}
            disabled={archived || disabled}
            aria-pressed={pinned}
            className={cn(button.icon, pinned && 'text-ink')}
            title={archived ? 'Archived notes can’t be pinned' : pinned ? 'Unpin' : 'Pin to top'}
            aria-label={pinned ? 'Unpin this note' : 'Pin this note'}
          >
            <Icon name="pin" className={cn(pinned && 'fill-lime')} />
          </button>
          <button
            type="button"
            onClick={toggleArchived}
            disabled={disabled}
            className={button.icon}
            title={archived ? 'Unarchive' : 'Archive'}
            aria-label={archived ? 'Unarchive this note' : 'Archive this note'}
          >
            <Icon name={archived ? 'unarchive' : 'archive'} />
          </button>
          <button
            type="button"
            onClick={trash}
            disabled={actionPending || disabled}
            className={cn(button.icon, 'hover:text-danger')}
            title="Move to trash"
            aria-label="Move this note to the trash"
          >
            <Icon name="trash" />
          </button>
        </div>
      </div>

      {archived ? (
        <p className="mt-4 flex items-center gap-2 rounded-control bg-sunken px-3 py-2 text-sm text-muted">
          <Icon name="archive" className="size-4" />
          Archived: hidden from the main list. You can still edit it.
        </p>
      ) : null}

      {status.kind === 'conflict' ? (
        <ConflictBanner server={status.server} onReload={() => reloadTheirs(status.server)} onKeepMine={() => keepMine(status.server)} />
      ) : null}
      {status.kind === 'gone' ? (
        <div role="alert" className="mt-4 rounded-sheet border border-danger bg-danger-soft p-4 text-danger">
          <p className="font-semibold">This note was deleted or moved to the trash elsewhere.</p>
          <p className="mt-1 text-sm">Your latest changes here weren’t saved. Copy anything you need, then go back to your notes.</p>
          <Link href="/" className={cn(button.secondary, 'mt-3')}>
            Back to notes
          </Link>
        </div>
      ) : null}

      <label htmlFor="note-title" className="sr-only">
        Title
      </label>
      {/* A one-row textarea rather than an <input>, so a long title wraps
          onto more lines instead of scrolling out of sight on a phone. */}
      <textarea
        ref={titleRef}
        id="note-title"
        rows={1}
        value={title}
        // A title is one line: pasted line breaks become spaces.
        onChange={(e) => edit({ title: e.target.value.replace(/\r?\n/g, ' ') })}
        onKeyDown={(e) => {
          // Enter moves on to the note itself, as in most writing apps.
          if (e.key === 'Enter') {
            e.preventDefault()
            bodyRef.current?.focus()
          }
        }}
        onBlur={() => void flush()}
        maxLength={TITLE_MAX}
        placeholder="Untitled"
        disabled={disabled}
        // A brand-new note starts with the cursor in the title.
        autoFocus={note.title === '' && note.body === ''}
        className="mt-6 w-full resize-none overflow-hidden rounded-control bg-transparent font-display text-3xl leading-tight focus-visible:outline-offset-4 sm:text-4xl"
      />

      <div className="mt-3">
        <TagInput tags={tags} onChange={(next) => edit({ tags: next })} suggestions={tagSuggestions} disabled={disabled} />
      </div>

      <div className="adire-rule mt-4 h-2 opacity-50" aria-hidden />

      <label htmlFor="note-body" className="sr-only">
        Note
      </label>
      <textarea
        ref={bodyRef}
        id="note-body"
        value={body}
        onChange={(e) => edit({ body: e.target.value })}
        onBlur={() => void flush()}
        maxLength={BODY_MAX}
        placeholder="Start writing…"
        disabled={disabled}
        spellCheck
        className="mt-4 min-h-[55vh] w-full flex-1 resize-none overflow-hidden rounded-control bg-transparent text-[1.0625rem] leading-[1.8] focus-visible:outline-offset-4"
      />

      <footer className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
        <span>{wordCount(body).toLocaleString('en')} words</span>
        <span>
          Created <time dateTime={note.createdAt.toISOString()}>{longDate(note.createdAt)}</time>
        </span>
        <span>
          Edited <time dateTime={savedAt.toISOString()}>{longDate(savedAt)}</time>
        </span>
      </footer>

      <p role="status" className="sr-only">
        {announcement}
      </p>
    </article>
  )
}

/**
 * The save indicator. role="status" makes it a polite live region: screen
 * readers announce each new message when the user pauses, without
 * interrupting. Errors use words and an icon, never colour alone.
 */
function SaveStatus({ status, savedAt }: { status: Status; savedAt: Date }) {
  let icon: 'check' | 'cloudOff' | 'alert' | null = null
  let text: string
  /** Extra words shown from the sm breakpoint up (always read out). */
  let detail = ''
  let tone = 'text-muted'
  switch (status.kind) {
    case 'saved':
      icon = 'check'
      text = 'Saved'
      detail = ` ${shortDate(savedAt)}`
      break
    case 'saving':
      text = 'Saving…'
      break
    case 'retrying':
      icon = 'cloudOff'
      text = 'Couldn’t save, retrying'
      detail = ` in ${status.inSeconds}s`
      tone = 'text-danger'
      break
    case 'invalid':
      icon = 'alert'
      text = `Not saved: ${status.message}`
      tone = 'text-danger'
      break
    case 'conflict':
    case 'gone':
      icon = 'alert'
      text = 'Not saved'
      tone = 'text-danger'
      break
  }
  return (
    <p id="save-status" role="status" className={cn('flex min-w-0 items-center gap-1.5 px-2 text-sm', tone)}>
      {icon ? <Icon name={icon} className="size-4" /> : <span className="size-2 rounded-full bg-line-strong motion-safe:animate-pulse" aria-hidden />}
      <span className="truncate">
        {text}
        {detail ? <span className="max-sm:sr-only">{detail}</span> : null}
      </span>
    </p>
  )
}

/**
 * OPTIMISTIC CONCURRENCY, the visible part. The save was refused because
 * the note's version moved on: another tab or device saved since this
 * editor loaded. Nothing is overwritten until the user chooses.
 */
function ConflictBanner({ server, onReload, onKeepMine }: { server: Note; onReload: () => void; onKeepMine: () => void }) {
  return (
    <div role="alert" className="mt-4 rounded-sheet border border-danger bg-danger-soft p-4 text-danger motion-safe:animate-rise">
      <p className="flex items-center gap-2 font-semibold">
        <Icon name="alert" />
        This note changed elsewhere
      </p>
      <p className="mt-1 text-sm">
        Another tab or device saved a newer version at {longDate(server.updatedAt)}. Your changes here haven’t been saved yet. Which version do
        you want to keep?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onReload} className={button.secondary}>
          Reload the other version
        </button>
        <button type="button" onClick={onKeepMine} className={button.danger}>
          Keep mine (overwrite)
        </button>
      </div>
    </div>
  )
}

/**
 * Grows a textarea to fit its text, so the page scrolls instead of the box.
 * (CSS field-sizing: content will do this one day, but not every browser
 * supports it yet.) Runs before paint, so the height never flickers.
 */
function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [ref, value])
}

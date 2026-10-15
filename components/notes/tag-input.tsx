// CLIENT COMPONENT: chips you can add and remove while typing.
'use client'

import { useId, useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { TAGS_PER_NOTE_MAX, TagNameSchema } from '@/lib/schema/note'

type Props = {
  tags: string[]
  onChange: (tags: string[]) => void
  /** The owner's existing tags, offered as suggestions. */
  suggestions: string[]
  disabled?: boolean
}

/**
 * Type a tag and press Enter (or a comma) to add it; Backspace in the empty
 * box removes the last one. Names go through the SAME Zod schema the server
 * uses, so "JAMB Prep" becomes "jamb-prep" before it is even saved.
 */
export function TagInput({ tags, onChange, suggestions, disabled }: Props) {
  const id = useId()
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  function add(raw: string) {
    if (raw.trim() === '') return
    const parsed = TagNameSchema.safeParse(raw)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'That tag name won’t work')
      return
    }
    setText('')
    if (tags.includes(parsed.data)) {
      setError('')
      return
    }
    if (tags.length >= TAGS_PER_NOTE_MAX) {
      setError(`A note can have up to ${TAGS_PER_NOTE_MAX} tags`)
      return
    }
    setError('')
    onChange([...tags, parsed.data].sort())
  }

  function remove(name: string) {
    onChange(tags.filter((t) => t !== name))
  }

  const available = suggestions.filter((s) => !tags.includes(s))

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.length > 0 ? (
          <ul aria-label="Tags on this note" className="flex flex-wrap gap-1.5">
            {tags.map((name) => (
              <li key={name} className="flex items-center rounded-pill border border-line bg-raised pl-2.5 text-sm text-indigo">
                #{name}
                <button
                  type="button"
                  onClick={() => remove(name)}
                  disabled={disabled}
                  aria-label={`Remove tag ${name}`}
                  className="ml-0.5 grid size-7 place-items-center rounded-full text-muted hover:bg-indigo-soft hover:text-ink"
                >
                  <Icon name="close" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <label htmlFor={`${id}-input`} className="sr-only">
          Add a tag
        </label>
        <span className="flex items-center gap-1 text-muted">
          <Icon name="tag" className="size-4" />
          <input
            id={`${id}-input`}
            list={`${id}-suggestions`}
            value={text}
            disabled={disabled}
            onChange={(e) => {
              const value = e.target.value
              // A comma finishes a tag, like Enter.
              if (value.endsWith(',')) add(value.slice(0, -1))
              else setText(value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add(text)
              } else if (e.key === 'Backspace' && text === '' && tags.length > 0) {
                const last = tags.at(-1)
                if (last) remove(last)
              }
            }}
            placeholder="Add a tag"
            aria-describedby={error ? `${id}-error` : undefined}
            aria-invalid={error ? true : undefined}
            autoComplete="off"
            className="h-8 w-40 rounded-control bg-transparent px-1 text-sm text-ink outline-offset-1"
          />
        </span>
        <datalist id={`${id}-suggestions`}>
          {available.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <p id={`${id}-error`} role="alert" className="min-h-0 text-sm text-danger empty:hidden">
        {error}
      </p>
    </div>
  )
}

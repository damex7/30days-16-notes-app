// CLIENT COMPONENT: listens for key presses on the whole page.
'use client'

import { useEffect } from 'react'

/** The IDs the shortcuts look for. Listed on /about. */
export const SEARCH_INPUT_ID = 'note-search'
export const NEW_NOTE_FORM_ID = 'new-note-form'

/** True while the user is typing somewhere, so "n" stays an "n". */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Two single-key shortcuts, in the style of Gmail and GitHub:
 *   n  new note          /  focus the search box
 * They only fire when focus isn't in a text field and no modifier key is
 * held, so they never get in the way of typing or browser shortcuts.
 * Renders nothing.
 */
export function KeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return

      if (event.key === '/') {
        const search = document.getElementById(SEARCH_INPUT_ID)
        if (search instanceof HTMLInputElement) {
          event.preventDefault()
          search.focus()
          search.select()
        }
      } else if (event.key === 'n' || event.key === 'N') {
        const form = document.getElementById(NEW_NOTE_FORM_ID)
        if (form instanceof HTMLFormElement) {
          event.preventDefault()
          form.requestSubmit()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return null
}

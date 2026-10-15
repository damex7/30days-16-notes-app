// CLIENT COMPONENT: it shows a pending state while the note is created.
'use client'

import { useFormStatus } from 'react-dom'
import { createNoteAction } from '@/app/(app)/actions'
import { NEW_NOTE_FORM_ID } from '@/components/site/keyboard-shortcuts'
import { button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

/**
 * A real <form> posting to a Server Action: it works before JavaScript has
 * loaded, and the `n` shortcut submits it by its id. The action creates the
 * row and redirects to the editor.
 */
export function NewNoteButton({ className, withId = true }: { className?: string; withId?: boolean }) {
  return (
    <form id={withId ? NEW_NOTE_FORM_ID : undefined} action={createNoteAction} className={className}>
      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} aria-keyshortcuts="n" className={cn(button.primary, 'w-full whitespace-nowrap')}>
      <Icon name="plus" className="size-4.5" />
      {pending ? 'Creating…' : 'New note'}
    </button>
  )
}

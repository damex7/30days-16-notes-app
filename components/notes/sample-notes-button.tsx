// CLIENT COMPONENT: it shows a pending state while the notes are copied.
'use client'

import { useFormStatus } from 'react-dom'
import { addSampleNotesAction } from '@/app/(app)/actions'
import { button } from '@/components/ui/button'

/** Fills an empty notebook with a copy of the sample notes. */
export function SampleNotesButton() {
  return (
    <form action={addSampleNotesAction}>
      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={button.secondary}>
      {pending ? 'Adding…' : 'Add the sample notes'}
    </button>
  )
}

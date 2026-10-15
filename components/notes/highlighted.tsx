import { Fragment } from 'react'
import { MARK_END, MARK_START } from '@/lib/schema/note'

/**
 * Turns ts_headline output into React elements. PostgreSQL wraps each
 * matched word in two private-use characters (not HTML tags), and this
 * splits on them: text between a start and an end marker becomes <mark>,
 * everything else stays plain text. React escapes all of it, so a note
 * containing "<script>" is shown as those characters, never run.
 */
export function Highlighted({ text }: { text: string }) {
  const parts = text.split(MARK_START)
  return (
    <>
      {parts.map((part, i) => {
        if (i === 0) return <Fragment key={i}>{part}</Fragment>
        const [matched = '', rest = ''] = part.split(MARK_END)
        return (
          <Fragment key={i}>
            <mark>{matched}</mark>
            {rest}
          </Fragment>
        )
      })}
    </>
  )
}

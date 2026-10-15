// The "Load more" cursor as an opaque base64url string: the browser hands it
// back without needing to understand it. Server-only because it uses Node's
// Buffer, and because only lib/notes.ts should ever read one.
import 'server-only'

import { CursorSchema, type Cursor } from '@/lib/schema/note'

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

/** A tampered or garbled cursor gives null (start from the top), never a crash. */
export function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = CursorSchema.safeParse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

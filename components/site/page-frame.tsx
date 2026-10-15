import type { ReactNode } from 'react'

/** The single-column layout of /archive, /trash, /tags and /about. */
export function PageFrame({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-reading px-4 py-8 sm:px-6">
      <h1 className="text-3xl sm:text-4xl">{title}</h1>
      {intro ? <div className="mt-2 text-muted">{intro}</div> : null}
      <div className="mt-6">{children}</div>
    </div>
  )
}

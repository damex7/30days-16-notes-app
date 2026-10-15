/*
  SERVER COMPONENTS: the placeholder shapes shown while data streams in.
  Under Cache Components these fallbacks are part of the STATIC SHELL, sent
  first and replaced in place. Each is roughly the size of what it stands
  for, so nothing jumps. The wrapper is announced once; the shapes are
  hidden from screen readers.
*/

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" className="px-3 py-2">
      <span className="sr-only">Loading notes</span>
      <div aria-hidden className="flex flex-col">
        <div className="mb-3 flex gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-7 w-16 rounded-pill" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 border-b border-line py-4">
            <div className="skeleton h-5 w-3/5" />
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function EditorSkeleton() {
  return (
    <div role="status" className="mx-auto w-full max-w-reading px-5 py-6">
      <span className="sr-only">Loading the note</span>
      <div aria-hidden className="flex flex-col gap-4">
        <div className="flex justify-between">
          <div className="skeleton h-8 w-24" />
          <div className="skeleton h-8 w-40" />
        </div>
        <div className="skeleton mt-4 h-10 w-3/4" />
        <div className="skeleton h-7 w-1/3 rounded-pill" />
        <div className="mt-4 flex flex-col gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-4" style={{ width: `${70 + ((i * 37) % 30)}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function PageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="mx-auto w-full max-w-reading px-5 py-8">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="flex flex-col gap-4">
        <div className="skeleton h-9 w-48" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton h-16 w-full" />
        ))}
      </div>
    </div>
  )
}

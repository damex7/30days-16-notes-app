import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/ui/icon'

/** A calm, centred message for empty lists and missing things. */
export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center motion-safe:animate-rise">
      <span className="mb-4 grid size-14 place-items-center rounded-full border border-dashed border-line-strong text-muted">
        <Icon name={icon} className="size-6" />
      </span>
      <h2 className="text-xl">{title}</h2>
      {children ? <div className="mt-2 max-w-xs text-sm text-muted [&_a]:text-indigo [&_a]:underline">{children}</div> : null}
    </div>
  )
}

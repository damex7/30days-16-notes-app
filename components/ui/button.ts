// Button looks as class strings, so <button>, <Link> and form buttons can
// share them without a wrapper component. Every button is at least 40px
// tall (44px for icon-only ones), a comfortable touch target.

const base =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-pill px-4 text-sm font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-55'

export const button = {
  primary: `${base} bg-indigo text-on-indigo hover:bg-indigo-hover`,
  secondary: `${base} border border-line-strong bg-raised text-indigo hover:bg-indigo-soft`,
  ghost: `${base} text-indigo hover:bg-indigo-soft`,
  danger: `${base} bg-danger text-on-danger hover:bg-danger-hover`,
  icon: 'inline-grid size-11 place-items-center rounded-pill text-muted transition-colors hover:bg-indigo-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-45',
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { PageFrame } from '@/components/site/page-frame'
import { Icon } from '@/components/ui/icon'

export const metadata: Metadata = { title: 'About' }

const SHORTCUTS: [keys: string[], action: string][] = [
  [['n'], 'New note'],
  [['/'], 'Search notes'],
  [['Esc'], 'Leave the text field (then n and / work again); clears the search box'],
  [['Ctrl', 'S'], 'Save the note now (⌘ S on a Mac)'],
  [['Enter'], 'Add the tag you typed (a comma works too)'],
  [['Backspace'], 'In an empty tag box: remove the last tag'],
]

/** Fully static: no database, so it is prerendered at build time. */
export default function AboutPage() {
  return (
    <PageFrame title="About Ìrántí" intro={<p>Ìrántí means “remembrance” in Yoruba. It’s a calm place for notes worth keeping.</p>}>
      <div className="flex flex-col gap-8">
        <section aria-labelledby="demo-heading" className="rounded-sheet border border-danger bg-danger-soft p-4 text-danger">
          <h2 id="demo-heading" className="flex items-center gap-2 text-xl">
            <Icon name="alert" />
            A public demo: nothing private, please
          </h2>
          <p className="mt-2">
            There are no accounts yet, so <strong>everyone who opens this site sees and edits the same notes</strong>. Don’t write passwords,
            phone numbers, addresses or anything personal here. Accounts, and notes that are yours alone, come next.
          </p>
        </section>

        <section aria-labelledby="shortcuts-heading">
          <h2 id="shortcuts-heading" className="flex items-center gap-2 text-2xl">
            <Icon name="keyboard" />
            Keyboard shortcuts
          </h2>
          <p className="mt-1 text-sm text-muted">
            The single-letter shortcuts work when you aren’t typing in a field, so they never get in the way.
          </p>
          <table className="mt-3 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Keys
                </th>
                <th scope="col" className="py-2 font-semibold">
                  What it does
                </th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS.map(([keys, action]) => (
                <tr key={action} className="border-b border-line">
                  <td className="py-2 pr-4 align-top whitespace-nowrap">
                    {keys.map((k, i) => (
                      <span key={k}>
                        {i > 0 ? ' + ' : null}
                        <kbd className="rounded border border-line-strong bg-raised px-1.5 py-0.5 font-sans text-xs">{k}</kbd>
                      </span>
                    ))}
                  </td>
                  <td className="py-2">{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-2xl">
            How it works
          </h2>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
            <li>Notes are stored in PostgreSQL and save themselves a moment after you stop typing.</li>
            <li>
              If the same note is changed in another tab or on another device, Ìrántí won’t overwrite it silently: it asks which version to keep.
            </li>
            <li>
              Search understands phrases in quotes (<code>&quot;egusi soup&quot;</code>), <code>or</code>, and a minus to leave a word out (
              <code>beans -moi</code>).
            </li>
            <li>
              Deleting moves a note to the <Link href="/trash">Trash</Link>, where it can be restored. Archiving hides it from the main list.
            </li>
            <li>Dates are shown in Lagos time (WAT).</li>
          </ul>
        </section>
      </div>
    </PageFrame>
  )
}

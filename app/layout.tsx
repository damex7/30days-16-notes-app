// ROOT LAYOUT: only what every page needs: <html>/<body>, fonts, the
// no-flash theme script and the skip link. The header lives one level down
// in app/(app)/layout.tsx.

import type { Metadata, Viewport } from 'next'
import { Literata, Young_Serif } from 'next/font/google'
import { site } from '@/lib/site'
import { themeScript } from '@/lib/theme'
import './globals.css'

// next/font downloads the fonts at build time and serves them from this
// site: no request to Google from the reader's browser and no layout jump.
//
// GLYPH CHECK, in two parts:
// 1. The character map must contain the Yoruba letters ẹ ọ ṣ and the
//    combining tone marks. Gloock, the first idea for headings, has no ẹ or ọ.
// 2. The font must also STACK a tone mark on a dotted letter (ọ + ́ = ọ́).
//    Rendering "Ẹ̀fọ́ riro" in Chrome showed Fraunces, Newsreader and
//    Spectral print the accent beside the letter instead. Young Serif and
//    Literata stack it correctly.
// Young Serif has no ₦; the font stack in globals.css lists Literata next,
// so the browser takes that one glyph from Literata.
const youngSerif = Young_Serif({
  weight: '400',
  subsets: ['latin', 'latin-ext'],
  variable: '--font-young-serif',
})
const literata = Literata({
  subsets: ['latin', 'latin-ext', 'vietnamese', 'greek'],
  variable: '--font-literata',
  axes: ['opsz'],
})

export const metadata: Metadata = {
  title: {
    default: `${site.name}: ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f0e5' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0e1b' },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      // The <head> script sets data-theme before React loads, so the server's
      // <html> and the browser's may differ ON PURPOSE. This silences that
      // one expected warning, for this element's attributes only.
      suppressHydrationWarning
      className={`${youngSerif.variable} ${literata.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        {/* SKIP LINK: the first Tab stop on every page. */}
        <a
          href="#main"
          className="sr-only z-50 rounded-control bg-indigo px-4 py-2 font-semibold text-on-indigo focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  )
}

// The last resort: an error in the ROOT layout itself. It replaces the whole
// document, so it brings its own <html> and <body> and only inline styles
// (globals.css may not have loaded).
'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#f5f0e5', color: '#18204c', fontFamily: 'Georgia, serif' }}>
        <main style={{ maxWidth: '28rem', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.75rem' }}>Ìrántí hit a problem</h1>
          <p>Something went wrong while loading the app. Your notes are safe.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: '1rem', padding: '0.6rem 1.2rem', borderRadius: '999px', border: 0, background: '#222c6e', color: '#fbf8f1', font: 'inherit', cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}

// npm run check:contrast
//
// Reads the colour tokens from app/globals.css (both sides of every
// light-dark() pair) and checks the text/background pairs the UI actually
// uses against WCAG 2.2 contrast minimums, in light AND dark mode:
//   text  4.5:1  normal-size text
//   ui    3:1    non-text UI: focus rings, input borders, the pin marker
// Exits with code 1 if any pair fails, so it can run in CI.
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const tokens = {}
for (const m of css.matchAll(/--color-([a-z-]+):\s*(?:light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)|(#[0-9a-f]{6}))/gi)) {
  const [, name, light, dark, both] = m
  tokens[name] = { light: light ?? both, dark: dark ?? both }
}

// [foreground, background, kind, where it's used]
const PAIRS = [
  ['ink', 'paper', 'text', 'body text, note titles'],
  ['ink', 'raised', 'text', 'text in the editor sheet and inputs'],
  ['ink', 'sunken', 'text', 'text in wells'],
  ['ink', 'indigo-soft', 'text', 'the selected note in the list'],
  ['muted', 'paper', 'text', 'previews, dates, hints'],
  ['muted', 'raised', 'text', 'placeholders and hints in the editor'],
  ['muted', 'indigo-soft', 'text', 'preview of the selected note'],
  ['on-indigo', 'indigo', 'text', 'primary button label'],
  ['on-indigo', 'indigo-hover', 'text', 'primary button label (hover)'],
  ['indigo', 'paper', 'text', 'links, active nav, tag chips'],
  ['indigo', 'raised', 'text', 'links and chips in the editor'],
  ['on-lime', 'lime', 'text', 'search highlights, "Pinned" label'],
  ['danger', 'paper', 'text', 'error messages'],
  ['danger', 'raised', 'text', 'errors in the editor'],
  ['danger', 'danger-soft', 'text', 'conflict / error banner'],
  ['on-danger', 'danger', 'text', '"Delete forever" button'],
  ['on-danger', 'danger-hover', 'text', '"Delete forever" button (hover)'],
  ['line-strong', 'paper', 'ui', 'input and button borders'],
  ['line-strong', 'raised', 'ui', 'input borders in the editor'],
  ['focus', 'paper', 'ui', 'focus ring'],
  ['focus', 'raised', 'ui', 'focus ring in the editor'],
  ['focus', 'focus-halo', 'ui', 'focus ring against the halo inside it'],
  ['indigo', 'paper', 'ui', 'selected-note marker bar'],
]
const MIN = { text: 4.5, large: 3, ui: 3 }

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

let failures = 0
for (const mode of ['light', 'dark']) {
  console.log(`\n${mode.toUpperCase()} MODE`)
  for (const [fg, bg, kind, where] of PAIRS) {
    if (!tokens[fg] || !tokens[bg]) {
      console.log(`  ✗ missing token: ${!tokens[fg] ? fg : bg}`)
      failures++
      continue
    }
    const r = ratio(tokens[fg][mode], tokens[bg][mode])
    const ok = r >= MIN[kind]
    if (!ok) failures++
    console.log(`  ${ok ? '✓' : '✗'} ${r.toFixed(2).padStart(5)}:1  ${`${fg} on ${bg}`.padEnd(30)} ${kind.padEnd(5)} ${where}`)
  }
}
console.log(failures ? `\n${failures} pair(s) below the WCAG AA minimum.` : '\nEvery pair meets WCAG AA.')
process.exit(failures ? 1 : 0)

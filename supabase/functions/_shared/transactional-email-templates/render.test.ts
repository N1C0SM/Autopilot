import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { TEMPLATES, renderTemplate, interpolate } from './render.ts'

/**
 * Parity test: ensures the preview path and the real send path produce
 * exactly the same HTML for every template using its previewData. If they
 * ever diverge (e.g. someone re-introduces an inline interpolation in only
 * one of the two edge functions), this test fails before deploy.
 *
 * It also flags unsubstituted {{placeholders}} so missing previewData is
 * caught early.
 */

const PLACEHOLDER_RE = /\{\{\s*[\w.]+\s*\}\}/g

/**
 * Normalize HTML so cosmetic differences (whitespace, newlines, attribute
 * order, quote style, self-closing slashes) don't cause false positives in
 * the parity test. We only care that the *rendered content* matches.
 */
export function normalizeHtml(input: string): string {
  let s = input ?? ''
  // Strip HTML comments (often inserted by renderers conditionally)
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  // Normalize line endings
  s = s.replace(/\r\n?/g, '\n')
  // Normalize attribute quotes: single -> double
  s = s.replace(/=\s*'([^']*)'/g, '="$1"')
  // Sort attributes inside every tag for stable comparison
  s = s.replace(/<([a-zA-Z][\w:-]*)\s+([^>]*?)(\/?)>/g, (_m, tag, attrs, selfClose) => {
    const attrRe = /([\w:-]+)(?:\s*=\s*"([^"]*)")?/g
    const found: Array<[string, string | null]> = []
    let mm: RegExpExecArray | null
    while ((mm = attrRe.exec(attrs)) !== null) {
      found.push([mm[1].toLowerCase(), mm[2] ?? null])
    }
    found.sort((a, b) => a[0].localeCompare(b[0]))
    const rebuilt = found
      .map(([k, v]) => (v === null ? k : `${k}="${v}"`))
      .join(' ')
    const sc = selfClose ? ' /' : ''
    return `<${tag}${rebuilt ? ' ' + rebuilt : ''}${sc}>`
  })
  // Collapse whitespace between tags
  s = s.replace(/>\s+</g, '><')
  // Collapse runs of whitespace inside text/attrs to a single space
  s = s.replace(/[ \t\n]+/g, ' ')
  return s.trim()
}

function normalizeSubject(s: string): string {
  return (s ?? '').replace(/\s+/g, ' ').trim()
}

for (const [name, tpl] of Object.entries(TEMPLATES)) {
  Deno.test(`render parity — ${name}`, async () => {
    const previewData = tpl.previewData ?? {}

    // Preview path: merges previewData (so the admin sees a populated email)
    const preview = await renderTemplate({
      templateName: name,
      templateData: previewData,
      override: null,
      mergePreviewData: true,
    })

    // Send path: receives the SAME data from the trigger code; must produce
    // identical HTML so what the admin sees == what the user receives.
    const sent = await renderTemplate({
      templateName: name,
      templateData: previewData,
      override: null,
      mergePreviewData: false,
    })

    assert(preview.html.length > 0, `${name}: preview html empty`)
    assertEquals(
      normalizeHtml(preview.html),
      normalizeHtml(sent.html),
      `${name}: preview HTML differs from sent HTML — paths have drifted`,
    )
    assertEquals(
      normalizeSubject(preview.subject),
      normalizeSubject(sent.subject),
      `${name}: subject drift`,
    )
  })

  Deno.test(`no leftover placeholders — ${name}`, async () => {
    const { html, subject } = await renderTemplate({
      templateName: name,
      templateData: tpl.previewData ?? {},
      override: null,
      mergePreviewData: true,
    })
    const leftover = [...html.matchAll(PLACEHOLDER_RE)].map((m) => m[0])
    const leftoverSubject = [...subject.matchAll(PLACEHOLDER_RE)].map((m) => m[0])
    assertEquals(
      leftover,
      [],
      `${name}: unsubstituted placeholders in HTML — add them to previewData`,
    )
    assertEquals(
      leftoverSubject,
      [],
      `${name}: unsubstituted placeholders in subject`,
    )
  })

  Deno.test(`override path matches send for — ${name}`, async () => {
    // Simulate an admin override that wraps the rendered HTML with a
    // {{name}} placeholder. The override path must interpolate identically
    // in both preview and send.
    const overrideHtml =
      '<html><body><p>Hola {{name}}</p><p>{{missing}}</p></body></html>'
    const overrideSubject = 'Hola {{name}}'
    const override = { enabled: true, html: overrideHtml, subject: overrideSubject }
    const data = { ...(tpl.previewData ?? {}), name: 'TestUser' }

    const preview = await renderTemplate({
      templateName: name,
      templateData: data,
      override,
      mergePreviewData: true,
    })
    const sent = await renderTemplate({
      templateName: name,
      templateData: data,
      override,
      mergePreviewData: false,
    })

    assertEquals(
      normalizeHtml(preview.html),
      normalizeHtml(sent.html),
      `${name}: override drift`,
    )
    assertEquals(
      normalizeSubject(preview.subject),
      normalizeSubject(sent.subject),
      `${name}: override subject drift`,
    )
    assert(preview.html.includes('Hola TestUser'), `${name}: interpolation failed`)
    assert(
      !preview.html.includes('{{name}}'),
      `${name}: placeholder not substituted`,
    )
  })
}

Deno.test('interpolate handles missing keys as empty string', () => {
  assertEquals(interpolate('Hi {{a}} and {{b.c}}', { a: 'x' }), 'Hi x and ')
})

Deno.test('normalizeHtml ignores whitespace, attribute order and quote style', () => {
  const a = `<div  class="a"  id='x'>\n  <p>Hola   mundo</p>\n</div>`
  const b = `<div id="x" class="a"><p>Hola mundo</p></div>`
  assertEquals(normalizeHtml(a), normalizeHtml(b))
})

Deno.test('normalizeHtml strips comments but preserves content differences', () => {
  assertEquals(
    normalizeHtml('<p>hi</p><!-- comment -->'),
    normalizeHtml('<p>hi</p>'),
  )
  assert(normalizeHtml('<p>a</p>') !== normalizeHtml('<p>b</p>'))
})
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
      preview.html,
      sent.html,
      `${name}: preview HTML differs from sent HTML — paths have drifted`,
    )
    assertEquals(preview.subject, sent.subject, `${name}: subject drift`)
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

    assertEquals(preview.html, sent.html, `${name}: override drift`)
    assertEquals(preview.subject, sent.subject, `${name}: override subject drift`)
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
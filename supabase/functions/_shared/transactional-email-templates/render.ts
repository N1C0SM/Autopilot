/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { TEMPLATES } from './registry.ts'

export interface RenderedEmail {
  html: string
  subject: string
  plainText: string
  source: 'override' | 'component'
}

export interface OverrideRow {
  enabled?: boolean | null
  html?: string | null
  subject?: string | null
}

/**
 * Replace {{var}} / {{nested.path}} placeholders using values from `data`.
 * Missing keys collapse to an empty string (mirrors current behavior).
 */
export function interpolate(str: string, data: Record<string, any>): string {
  return str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const val = key.split('.').reduce((acc: any, k: string) => acc?.[k], data)
    return val == null ? '' : String(val)
  })
}

/**
 * Single source of truth used by BOTH `send-transactional-email` and
 * `render-email-template`. Guarantees the preview matches what is sent.
 *
 * Priority:
 *   1. `customHtml` (admin live editor)
 *   2. Active override from `email_template_overrides`
 *   3. React Email component
 */
export async function renderTemplate(opts: {
  templateName: string
  templateData?: Record<string, any>
  override?: OverrideRow | null
  customHtml?: string | null
  customSubject?: string | null
  /** When true, merges previewData into templateData (used by preview only). */
  mergePreviewData?: boolean
}): Promise<RenderedEmail> {
  const tpl = TEMPLATES[opts.templateName]
  if (!tpl) throw new Error(`template_not_found: ${opts.templateName}`)

  const baseData = opts.mergePreviewData
    ? { ...(tpl.previewData ?? {}), ...(opts.templateData ?? {}) }
    : (opts.templateData ?? {})

  // 1. customHtml (live editor) wins
  if (opts.customHtml) {
    const html = interpolate(opts.customHtml, baseData)
    const subject = opts.customSubject
      ? interpolate(opts.customSubject, baseData)
      : resolveSubject(tpl.subject, baseData)
    return { html, subject, plainText: htmlToPlain(html), source: 'override' }
  }

  // 2. Persisted override
  if (opts.override?.enabled && opts.override?.html) {
    const html = interpolate(opts.override.html, baseData)
    const subject = opts.override.subject
      ? interpolate(opts.override.subject, baseData)
      : resolveSubject(tpl.subject, baseData)
    return { html, subject, plainText: htmlToPlain(html), source: 'override' }
  }

  // 3. React Email component
  const html = await renderAsync(React.createElement(tpl.component, baseData))
  const plainText = await renderAsync(
    React.createElement(tpl.component, baseData),
    { plainText: true }
  )
  return {
    html,
    subject: resolveSubject(tpl.subject, baseData),
    plainText,
    source: 'component',
  }
}

function resolveSubject(
  s: TemplateEntry['subject'] extends infer T ? T : never | any,
  data: Record<string, any>
): string {
  return typeof s === 'function' ? s(data) : String(s ?? '')
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Re-export to give callers a single import surface
import type { TemplateEntry } from './registry.ts'
export { TEMPLATES }
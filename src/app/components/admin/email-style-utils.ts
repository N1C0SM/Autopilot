/**
 * Utilities to split inline-style email HTML into separate HTML + CSS for
 * editing, and re-inline the CSS back into the HTML at save/preview time so
 * the actual email stays compatible with Gmail/Outlook (which strip <style>).
 */

const STYLE_ATTR_RE = /\sstyle\s*=\s*"([^"]*)"/gi;
const STYLE_TAG_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi;
const CLASS_ATTR_RE = /\sclass\s*=\s*"([^"]*)"/i;

function normalizeStyle(s: string): string {
  return s
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(":");
      if (i === -1) return d;
      const k = d.slice(0, i).trim().toLowerCase();
      const v = d.slice(i + 1).trim().replace(/\s+/g, " ");
      return `${k}: ${v}`;
    })
    .sort()
    .join("; ");
}

/**
 * Extract every inline `style="..."` from `html`, dedupe identical declarations,
 * assign auto class names (`.s1`, `.s2`, ...) and return a clean HTML + a CSS
 * stylesheet. Existing `<style>` blocks are also moved to the CSS output.
 */
export function extractInlineStyles(html: string): { html: string; css: string } {
  if (!html) return { html: "", css: "" };

  // 1. Collect existing <style> blocks
  const styleBlocks: string[] = [];
  let stripped = html.replace(STYLE_TAG_RE, (_m, body) => {
    styleBlocks.push(String(body).trim());
    return "";
  });

  // 2. Collect every unique inline style and assign a class
  const styleToClass = new Map<string, string>();
  let counter = 1;
  stripped = stripped.replace(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g, (_m, tag, attrs) => {
    let newAttrs = attrs as string;
    let pendingClass: string | null = null;

    newAttrs = newAttrs.replace(STYLE_ATTR_RE, (_mm: string, raw: string) => {
      const norm = normalizeStyle(raw);
      if (!norm) return "";
      let cls = styleToClass.get(norm);
      if (!cls) {
        cls = `s${counter++}`;
        styleToClass.set(norm, cls);
      }
      pendingClass = cls;
      return "";
    });

    if (pendingClass) {
      const existing = CLASS_ATTR_RE.exec(newAttrs);
      if (existing) {
        const merged = `${existing[1]} ${pendingClass}`.trim();
        newAttrs = newAttrs.replace(CLASS_ATTR_RE, ` class="${merged}"`);
      } else {
        newAttrs = ` class="${pendingClass}"` + newAttrs;
      }
    }
    // collapse double spaces left after stripping style
    newAttrs = newAttrs.replace(/\s+/g, " ").replace(/\s+>/g, ">");
    return `<${tag}${newAttrs.startsWith(" ") || newAttrs === "" ? newAttrs : " " + newAttrs}>`;
  });

  // 3. Build CSS output
  const generated = Array.from(styleToClass.entries())
    .map(([style, cls]) => `.${cls} {\n  ${style.split("; ").join(";\n  ")};\n}`)
    .join("\n\n");
  const preserved = styleBlocks.filter(Boolean).join("\n\n");
  const css = [preserved, generated].filter(Boolean).join("\n\n");

  return { html: stripped, css };
}

/**
 * Parse a tiny subset of CSS (flat rule list, no media queries, no nesting)
 * into a map of selector -> declaration string ready to inline.
 */
function parseFlatCss(css: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!css) return out;
  // strip comments
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(cleaned)) !== null) {
    const selectors = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    const body = m[2]
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .join("; ");
    if (!body) continue;
    for (const sel of selectors) {
      const prev = out.get(sel);
      out.set(sel, prev ? `${prev}; ${body}` : body);
    }
  }
  return out;
}

/**
 * Re-inline CSS rules back into the HTML for email-client compatibility.
 * Supports simple `.class` and `tag` selectors (no descendant/combinators).
 * Any unsupported rules are appended as a fallback `<style>` block.
 */
export function reinlineStyles(html: string, css: string): string {
  if (!html) return html;
  const rules = parseFlatCss(css);
  if (rules.size === 0) return html;

  const classRules = new Map<string, string>();
  const tagRules = new Map<string, string>();
  const unsupported: string[] = [];

  for (const [sel, body] of rules.entries()) {
    if (/^\.[A-Za-z_][\w-]*$/.test(sel)) {
      classRules.set(sel.slice(1), body);
    } else if (/^[a-zA-Z][\w-]*$/.test(sel)) {
      tagRules.set(sel.toLowerCase(), body);
    } else {
      unsupported.push(`${sel} { ${body} }`);
    }
  }

  let out = html.replace(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g, (_m, tag, attrs) => {
    const tagLower = String(tag).toLowerCase();
    let attrStr = attrs as string;
    const collected: string[] = [];

    const tagBody = tagRules.get(tagLower);
    if (tagBody) collected.push(tagBody);

    const classMatch = CLASS_ATTR_RE.exec(attrStr);
    if (classMatch) {
      const remaining: string[] = [];
      for (const c of classMatch[1].split(/\s+/).filter(Boolean)) {
        const body = classRules.get(c);
        if (body) collected.push(body);
        else remaining.push(c);
      }
      if (remaining.length === 0) {
        attrStr = attrStr.replace(CLASS_ATTR_RE, "");
      } else {
        attrStr = attrStr.replace(CLASS_ATTR_RE, ` class="${remaining.join(" ")}"`);
      }
    }

    if (collected.length === 0) return `<${tag}${attrStr}>`;

    const existingStyle = /\sstyle\s*=\s*"([^"]*)"/i.exec(attrStr);
    const merged = [existingStyle?.[1], ...collected]
      .filter(Boolean)
      .join("; ")
      .replace(/;+\s*;+/g, "; ")
      .replace(/^\s*;\s*/, "")
      .replace(/\s*;\s*$/, "");

    if (existingStyle) {
      attrStr = attrStr.replace(/\sstyle\s*=\s*"[^"]*"/i, ` style="${merged}"`);
    } else {
      attrStr = ` style="${merged}"` + attrStr;
    }
    return `<${tag}${attrStr}>`;
  });

  if (unsupported.length > 0) {
    const block = `<style>\n${unsupported.join("\n")}\n</style>`;
    out = /<\/head>/i.test(out)
      ? out.replace(/<\/head>/i, `${block}\n</head>`)
      : `${block}\n${out}`;
  }
  return out;
}
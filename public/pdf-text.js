/**
 * PDF → plain text, shared by the browser UI and the Node test suite.
 * Glyph runs are grouped into visual lines by y-coordinate so "Label: value" pairs stay on one line.
 */

/** @param {{str: string, transform: number[]}[]} items */
export function itemsToLines(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) <= 2);
    if (!row) rows.push((row = { y, parts: [] }));
    row.parts.push({ x: it.transform[4], s: it.str });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * @param {any} pdfjs  pdfjs-dist module (browser or legacy Node build)
 * @param {ArrayBuffer | Uint8Array} data
 * @returns {Promise<{text: string, pages: number, chars: number}>}
 */
export async function pdfToText(pdfjs, data) {
  const doc = await pdfjs.getDocument({ data: data instanceof Uint8Array ? data : new Uint8Array(data) }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    out.push(...itemsToLines(content.items));
  }
  const text = out.join("\n");
  return { text, pages: doc.numPages, chars: text.replace(/\s/g, "").length };
}

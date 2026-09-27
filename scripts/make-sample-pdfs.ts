/**
 * Renders each synthetic sample in src/samples.ts to public/samples/<id>.pdf using headless Chrome.
 * Usage: CHROME=/path/to/chrome npm run samples:pdf
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SAMPLES } from "../src/samples";

const chrome = process.env.CHROME ?? "google-chrome";
const outDir = resolve("public/samples");
const tmp = mkdtempSync(join(tmpdir(), "biqa-"));
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

for (const s of SAMPLES) {
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{font:11pt/1.55 Helvetica,Arial,sans-serif;margin:48px;color:#111}
    .banner{font-size:8pt;color:#666;border-bottom:1px solid #ccc;padding-bottom:6px;margin-bottom:18px}
    p{margin:0}</style>
    <div class="banner">SYNTHETIC SAMPLE for Benefits Intake QA (independent prototype by Ayo Ahmed). Fictional data.</div>
    ${s.text.split("\n").map((l) => `<p>${esc(l) || "&nbsp;"}</p>`).join("\n")}`;
  const file = join(tmp, `${s.id}.html`);
  writeFileSync(file, html);
  execFileSync(chrome, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer",
    `--print-to-pdf=${join(outDir, `${s.id}.pdf`)}`, `file://${file}`,
  ], { stdio: "ignore" });
  console.log(`wrote public/samples/${s.id}.pdf`);
}

import { pdfToText } from "/pdf-text.js";

const $ = (s) => document.querySelector(s);
const els = {
  sample: $("#sample"),
  sampleDesc: $("#sampleDesc"),
  file: $("#file"),
  text: $("#text"),
  useAi: $("#useAi"),
  run: $("#run"),
  status: $("#status"),
  results: $("#results"),
  empty: $("#empty"),
  summary: $("#summary"),
  findings: $("#findings"),
  fields: $("#fields tbody"),
  source: $("#source"),
  raw: $("#raw"),
};

const LABELS = {
  employer_name: "Employer", carrier: "Carrier", plan_name: "Plan name", plan_type: "Plan type",
  effective_date: "Effective date", renewal_date: "Renewal date",
  deductible_individual: "Deductible (individual)", deductible_family: "Deductible (family)",
  oop_max_individual: "OOP max (individual)", oop_max_family: "OOP max (family)",
  coinsurance_pct: "Coinsurance (member %)", pcp_copay: "PCP copay", specialist_copay: "Specialist copay",
  er_copay: "ER copay", waiting_period_days: "Waiting period (days)",
  eligibility_hours_per_week: "Eligibility (hrs/week)", employer_contribution_pct: "Employer contribution (%)",
  hsa_eligible: "HSA eligible",
};

const NUMERIC = new Set([
  "deductible_individual", "deductible_family", "oop_max_individual", "oop_max_family", "coinsurance_pct",
  "pcp_copay", "specialist_copay", "er_copay", "waiting_period_days", "eligibility_hours_per_week", "employer_contribution_pct",
]);

let samples = [];
/** @type {null | {name: string, kind: "pdf" | "text", pages: string[] | null, text: string}} */
let loaded = null;
let last = null;
let docName = "pasted-text";
/** key -> {value, review_status} */
let review = {};
let reviewed = null;
let recheckSeq = 0;

async function loadSamples() {
  const res = await fetch("/api/samples");
  samples = await res.json();
  for (const s of samples) {
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.title;
    els.sample.appendChild(o);
  }
}

els.sample.addEventListener("change", () => {
  const s = samples.find((x) => x.id === els.sample.value);
  els.sampleDesc.textContent = s ? s.description : "";
  if (s) {
    els.text.value = s.text;
    loaded = { name: `${s.id}.txt`, kind: "text", pages: null, text: s.text };
  }
});

els.file.addEventListener("change", () => {
  const f = els.file.files[0];
  if (f) loadFile(f);
});

async function loadPdfjs() {
  const pdfjs = await import("/vendor/pdfjs/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
  return pdfjs;
}

async function loadFile(f, { autorun = false } = {}) {
  els.status.textContent = `Reading ${f.name}…`;
  try {
    if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
      const { text, pages, chars } = await pdfToText(await loadPdfjs(), await f.arrayBuffer());
      if (chars < 20) throw new Error("no text layer found. This looks like a scanned PDF, and OCR is out of scope for v0.1");
      els.text.value = text;
      loaded = { name: f.name, kind: "pdf", pages, text };
      els.status.textContent = `Extracted ${pages.length} page(s) from ${f.name} in your browser. Only the per-page text is sent to the API.`;
    } else {
      els.text.value = await f.text();
      loaded = { name: f.name, kind: "text", pages: null, text: els.text.value };
      els.status.textContent = `Loaded ${f.name} (${els.text.value.length} chars).`;
    }
    if (autorun) await run();
  } catch (e) {
    els.status.textContent = `Could not read ${f.name}: ${e.message}`;
  }
}

$("#drop").addEventListener("dragover", (e) => { e.preventDefault(); $("#drop").classList.add("over"); });
$("#drop").addEventListener("dragleave", () => $("#drop").classList.remove("over"));
$("#drop").addEventListener("drop", (e) => {
  e.preventDefault();
  $("#drop").classList.remove("over");
  const f = e.dataTransfer.files[0];
  if (f) loadFile(f);
});

document.querySelectorAll("[data-sample-pdf]").forEach((btn) =>
  btn.addEventListener("click", async () => {
    const id = btn.dataset.samplePdf;
    const res = await fetch(`/samples/${id}.pdf`);
    const blob = await res.blob();
    await loadFile(new File([blob], `${id}.pdf`, { type: "application/pdf" }), { autorun: true });
  }),
);

els.run.addEventListener("click", run);
$("#acceptClean").addEventListener("click", acceptUnflagged);
$("#download").addEventListener("click", download);

async function run() {
  const text = els.text.value;
  if (!text.trim()) { els.status.textContent = "Paste or load a document first."; return; }
  const fromPdf = loaded && loaded.kind === "pdf" && loaded.text === text;
  docName = loaded && loaded.text === text ? loaded.name : "pasted-text";
  els.run.disabled = true;
  els.status.textContent = "Analyzing…";
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fromPdf ? { pages: loaded.pages, use_ai: els.useAi.checked } : { text, use_ai: els.useAi.checked }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    render(data, fromPdf ? "pdf" : "text");
    els.status.textContent = `Done in ${data.meta.ms} ms (${data.meta.mode}, ${data.extraction.pages} page(s))${data.meta.ai_note ? " — " + data.meta.ai_note : ""}.`;
  } catch (e) {
    els.status.textContent = `Error: ${e.message}`;
  } finally {
    els.run.disabled = false;
  }
}

function fmt(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function parseInput(key, raw) {
  const s = raw.trim();
  if (!s) return null;
  if (key === "hsa_eligible") {
    if (/^(y|yes|true)$/i.test(s)) return true;
    if (/^(n|no|false)$/i.test(s)) return false;
  }
  if (NUMERIC.has(key)) {
    const m = s.match(/^\$?\s*([\d,]+(?:\.\d+)?)\s*%?$/);
    if (m) return Number(m[1].replace(/,/g, ""));
  }
  return s;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function flagged(key) {
  return last.findings.some((f) => f.severity !== "info" && f.fields.includes(key)) || !!last.extraction.fields[key].conflicts;
}

function render(data, inputKind) {
  last = data;
  last.inputKind = inputKind;
  review = {};
  for (const [k, f] of Object.entries(data.extraction.fields)) review[k] = { value: f.value, review_status: "pending" };
  reviewed = null;
  els.results.hidden = false;
  els.empty.hidden = true;
  renderSummary();
  renderFindings(data.findings);
  renderFields();
  renderSource(new Set());
  els.raw.textContent = JSON.stringify(data, null, 2);
}

function renderSummary() {
  const label = { ready: "Ready to load", needs_review: "Needs review", blocked: "Blocked" };
  const s = last.summary;
  const r = reviewed?.summary;
  els.summary.innerHTML = `
    <span class="pill ${s.disposition}">Extracted: <strong>${label[s.disposition]}</strong></span>
    ${r ? `<span class="pill ${r.disposition}">After review: <strong>${label[r.disposition]}</strong></span>` : ""}
    <span class="pill">${(r ?? s).required_present}/${s.required_total} required fields</span>
    <span class="pill">${(r ?? s).errors} error(s)</span>
    <span class="pill">${(r ?? s).warnings} warning(s)</span>`;
  const done = Object.values(review).filter((x) => x.review_status !== "pending").length;
  const total = Object.keys(review).length;
  $("#reviewProgress").textContent = `${done}/${total} fields reviewed${done === total ? " · review complete" : ""}`;
}

function renderFindings(findings) {
  els.findings.innerHTML = "";
  if (findings.length === 0) {
    els.findings.innerHTML = `<li class="info">No issues found. Spot-check the fields below and load.</li>`;
  }
  for (const f of findings) {
    const li = document.createElement("li");
    li.className = f.severity;
    li.innerHTML = `<span class="code">${f.code}</span> — ${esc(f.message)}<span class="action">Action: ${esc(f.action)}</span>`;
    li.addEventListener("click", () => highlight(f.fields));
    els.findings.appendChild(li);
  }
}

function evidenceHtml(key, f) {
  if (f.evidence.length === 0) return `<li>Not found in the document (value is <code>null</code>).</li>`;
  return f.evidence
    .map((e, i) => `<li><span class="pg">p.${e.page} · line ${e.page_line}</span><q>${esc(e.quote)}</q>${
      e.verified ? "" : ` <span class="bad">quote not verified</span>`}${
      f.conflicts ? ` → ${esc(fmt(e.value))}<button class="use" type="button" data-key="${key}" data-ev="${i}">Use this</button>` : ""}</li>`)
    .join("");
}

function renderFields() {
  els.fields.innerHTML = "";
  for (const key of Object.keys(LABELS)) {
    const f = last.extraction.fields[key];
    const r = review[key];
    const tr = document.createElement("tr");
    tr.className = f.value === null && r.value === null ? "missing" : f.conflicts && r.review_status === "pending" ? "conflict" : "";
    tr.dataset.key = key;
    tr.innerHTML = `<td>${LABELS[key]}<br><span class="rs ${r.review_status}">${r.review_status}</span>
        ${f.value !== null ? `<div class="muted conf">conf ${f.confidence.toFixed(2)}${f.source !== "rules" ? ` · ${f.source}` : ""}</div>` : ""}</td>
      <td><input class="fv" data-key="${key}" value="${esc(fmt(r.value))}" placeholder="null (not found)" aria-label="${LABELS[key]} value" />
        <ul class="ev-list">${evidenceHtml(key, f)}</ul></td>
      <td><button class="accept" type="button" data-key="${key}">${r.review_status === "pending" ? (r.value === null ? "Confirm missing" : "Accept") : "Undo"}</button></td>`;
    tr.addEventListener("click", (e) => { if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement)) highlight([key]); });
    els.fields.appendChild(tr);
  }
  els.fields.querySelectorAll(".fv").forEach((inp) =>
    inp.addEventListener("change", () => {
      const key = inp.dataset.key;
      const v = parseInput(key, inp.value);
      review[key] = { value: v, review_status: same(v, last.extraction.fields[key].value) ? "accepted" : "edited" };
      afterReview();
    }));
  els.fields.querySelectorAll(".accept").forEach((b) =>
    b.addEventListener("click", () => {
      const key = b.dataset.key;
      const orig = last.extraction.fields[key].value;
      review[key] = review[key].review_status === "pending"
        ? { value: review[key].value, review_status: same(review[key].value, orig) ? "accepted" : "edited" }
        : { value: orig, review_status: "pending" };
      afterReview();
    }));
  els.fields.querySelectorAll(".use").forEach((b) =>
    b.addEventListener("click", () => {
      const key = b.dataset.key;
      const ev = last.extraction.fields[key].evidence[Number(b.dataset.ev)];
      review[key] = { value: ev.value, review_status: "edited", chosen_evidence: Number(b.dataset.ev) };
      afterReview();
    }));
}

function acceptUnflagged() {
  if (!last) return;
  for (const key of Object.keys(review)) {
    const f = last.extraction.fields[key];
    if (review[key].review_status === "pending" && f.value !== null && f.source === "rules" && !flagged(key))
      review[key] = { value: f.value, review_status: "accepted" };
  }
  afterReview();
}

function reviewedPayload() {
  const out = {};
  for (const [k, f] of Object.entries(last.extraction.fields))
    out[k] = { value: review[k].value, review_status: review[k].review_status, confidence: f.confidence, conflicts: f.conflicts };
  return out;
}

async function afterReview() {
  renderFields();
  renderSummary();
  const seq = ++recheckSeq;
  try {
    const res = await fetch("/api/recheck", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fields: reviewedPayload() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    if (seq !== recheckSeq) return;
    reviewed = data;
    renderSummary();
    renderFindings(data.findings);
  } catch (e) {
    els.status.textContent = `Re-check failed: ${e.message}`;
  }
}

function evidenceOut(e) {
  return { page: e.page, page_line: e.page_line, quote: e.quote, start: e.start, end: e.end, line_text: e.snippet, value: e.value, verified: e.verified };
}

function download() {
  if (!last) return;
  const fields = {};
  for (const [k, f] of Object.entries(last.extraction.fields)) {
    const r = review[k];
    const ev = f.evidence.map(evidenceOut);
    const supporting = r.chosen_evidence !== undefined ? [ev[r.chosen_evidence]] : ev.filter((e) => same(e.value, r.value));
    fields[k] = {
      value: r.value,
      review_status: r.review_status,
      extracted_value: f.value,
      source: r.review_status === "edited" && !supporting.length ? "reviewer" : f.source,
      confidence: f.value === null ? null : f.confidence,
      page: supporting[0]?.page ?? null,
      quote: supporting[0]?.quote ?? null,
      evidence: ev,
      conflicts: f.conflicts ?? null,
    };
  }
  const done = Object.values(review).filter((x) => x.review_status !== "pending").length;
  const findings = reviewed ? reviewed.findings : last.findings;
  const out = {
    schema: "benefits-intake-qa/reviewed-plan@1",
    exported_at: new Date().toISOString(),
    disclaimer: "Independent prototype by Ayo Ahmed, not affiliated with Euphoric. Synthetic data only.",
    document: { name: docName, input: last.inputKind, pages: last.extraction.pages },
    review: {
      status: done === Object.keys(review).length ? "complete" : "in_progress",
      fields_reviewed: done,
      fields_total: Object.keys(review).length,
      extracted_disposition: last.summary.disposition,
      reviewed_disposition: reviewed ? reviewed.summary.disposition : null,
    },
    fields,
    findings,
    meta: last.meta,
  };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${docName.replace(/\.[a-z]+$/i, "")}.reviewed.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function highlight(keys) {
  const active = new Set(keys);
  document.querySelectorAll("#fields tr").forEach((tr) => tr.classList.toggle("active", active.has(tr.dataset.key)));
  renderSource(active);
  const first = els.source.querySelector(".qt");
  if (first) first.scrollIntoView({ block: "center", behavior: "smooth" });
}

function renderSource(activeKeys) {
  const spans = new Map();
  for (const [k, f] of Object.entries(last.extraction.fields))
    for (const e of f.evidence) {
      if (!spans.has(e.line)) spans.set(e.line, []);
      spans.get(e.line).push({ start: e.start, end: e.end, active: activeKeys.has(k) });
    }
  let page = 0;
  els.source.innerHTML = last.extraction.lines
    .map((l, i) => {
      const hdr = l.page !== page ? `<span class="pgh">— Page ${(page = l.page)} —</span>` : "";
      return `${hdr}<span class="ln">${l.page_line}</span> ${markSpans(l.text, spans.get(i) ?? [])}`;
    })
    .join("\n");
}

function markSpans(text, spans) {
  if (!spans.length) return esc(text);
  const cls = new Array(text.length).fill("");
  for (const s of spans) for (let i = s.start; i < s.end; i++) if (s.active || !cls[i]) cls[i] = s.active ? "qt" : "qv";
  let out = "";
  let i = 0;
  while (i < text.length) {
    let j = i;
    while (j < text.length && cls[j] === cls[i]) j++;
    const chunk = esc(text.slice(i, j));
    out += cls[i] ? `<span class="${cls[i]}">${chunk}</span>` : chunk;
    i = j;
  }
  return out;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

loadSamples().catch((e) => (els.status.textContent = `Could not load samples: ${e.message}`));

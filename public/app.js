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

let samples = [];
let lines = [];
let last = null;

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
  if (s) els.text.value = s.text;
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
      els.status.textContent = `Extracted ${pages} page(s) from ${f.name} in your browser. Only the text is sent to the API.`;
    } else {
      els.text.value = await f.text();
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

async function run() {
  const text = els.text.value;
  if (!text.trim()) { els.status.textContent = "Paste or load a document first."; return; }
  els.run.disabled = true;
  els.status.textContent = "Analyzing…";
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, use_ai: els.useAi.checked }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    render(text, data);
    els.status.textContent = `Done in ${data.meta.ms} ms (${data.meta.mode})${data.meta.ai_note ? " — " + data.meta.ai_note : ""}.`;
  } catch (e) {
    els.status.textContent = `Error: ${e.message}`;
  } finally {
    els.run.disabled = false;
  }
}

function normalize(raw) {
  return raw.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim()).filter((l) => l.length > 0);
}

function fmt(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function render(text, data) {
  last = data;
  lines = normalize(text);
  els.results.hidden = false;
  els.empty.hidden = true;

  const s = data.summary;
  const label = { ready: "Ready to load", needs_review: "Needs review", blocked: "Blocked" }[s.disposition];
  els.summary.innerHTML = `
    <span class="pill ${s.disposition}"><strong>${label}</strong></span>
    <span class="pill">${s.required_present}/${s.required_total} required fields</span>
    <span class="pill">${s.errors} error(s)</span>
    <span class="pill">${s.warnings} warning(s)</span>`;

  els.findings.innerHTML = "";
  if (data.findings.length === 0) {
    els.findings.innerHTML = `<li class="info">No issues found. Spot-check the fields below and load.</li>`;
  }
  for (const f of data.findings) {
    const li = document.createElement("li");
    li.className = f.severity;
    li.innerHTML = `<span class="code">${f.code}</span> — ${esc(f.message)}<span class="action">Action: ${esc(f.action)}</span>`;
    li.addEventListener("click", () => highlight(f.fields));
    els.findings.appendChild(li);
  }

  els.fields.innerHTML = "";
  for (const key of Object.keys(LABELS)) {
    const f = data.extraction.fields[key];
    const tr = document.createElement("tr");
    tr.className = f.value === null ? "missing" : f.conflicts ? "conflict clickable" : "clickable";
    tr.dataset.key = key;
    tr.innerHTML = `<td>${LABELS[key]}</td>
      <td>${esc(fmt(f.value))}${f.conflicts ? ` <span class="muted">(also: ${f.conflicts.filter((c) => c !== f.value).map(fmt).map(esc).join(", ")})</span>` : ""}</td>
      <td class="conf">${f.value === null ? "" : f.confidence.toFixed(2)}</td>
      <td class="muted">${f.value === null ? "not found" : f.source === "ai" ? "AI (no evidence)" : `line ${f.evidence.map((e) => e.line + 1).join(", ")}`}</td>`;
    if (f.value !== null) tr.addEventListener("click", () => highlight([key]));
    els.fields.appendChild(tr);
  }

  renderSource(new Set());
  els.raw.textContent = JSON.stringify(data, null, 2);
}

function highlight(keys) {
  const active = new Set();
  for (const k of keys) for (const e of last.extraction.fields[k]?.evidence ?? []) active.add(e.line);
  document.querySelectorAll("#fields tr").forEach((tr) => tr.classList.toggle("active", keys.includes(tr.dataset.key)));
  renderSource(active);
  const first = els.source.querySelector(".hl");
  if (first) first.scrollIntoView({ block: "center", behavior: "smooth" });
}

function renderSource(active) {
  const evidenced = new Set();
  for (const f of Object.values(last.extraction.fields)) for (const e of f.evidence) evidenced.add(e.line);
  els.source.innerHTML = lines
    .map((l, i) => `<span class="ln">${i + 1}</span> <span class="${active.has(i) ? "hl" : evidenced.has(i) ? "ev" : ""}">${esc(l)}</span>`)
    .join("\n");
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

loadSamples().catch((e) => (els.status.textContent = `Could not load samples: ${e.message}`));

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

els.file.addEventListener("change", async () => {
  const f = els.file.files[0];
  if (!f) return;
  els.status.textContent = `Reading ${f.name}…`;
  try {
    if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
      els.text.value = await pdfToText(f);
    } else {
      els.text.value = await f.text();
    }
    els.status.textContent = `Loaded ${f.name} (${els.text.value.length} chars). Text extraction happens in your browser; only the text is sent to the API.`;
  } catch (e) {
    els.status.textContent = `Could not read file: ${e.message}`;
  }
});

async function pdfToText(file) {
  const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Group glyph runs into lines by their y coordinate so label/value pairs stay together.
    const rows = new Map();
    for (const it of content.items) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5]);
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      rows.set(key, [...(rows.get(key) ?? []), { x: it.transform[4], s: it.str }]);
    }
    const ordered = [...rows.entries()].sort((a, b) => b[0] - a[0]);
    out.push(`--- page ${p} ---`);
    for (const [, items] of ordered) out.push(items.sort((a, b) => a.x - b.x).map((i) => i.s).join(" "));
  }
  return out.join("\n");
}

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

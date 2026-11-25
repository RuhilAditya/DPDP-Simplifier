"use strict";

const API = window.location.protocol === "file:" ? "http://localhost:8000" : "";
const $ = (sel, root = document) => root.querySelector(sel);
const cert = $("#cert");
let sections = [];
let current = null;          // AbortController of the request in flight

/* ---------------- helpers ---------------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sectionOf = (citation) => (citation.match(/^Section (\d+)/) || [, citation.startsWith("Schedule") ? "Schedule" : ""])[1];

// Obligation force. Law uses shall / shall not / may; plain English uses must / must not / may / can.
// "as may be prescribed", "as the case may be" are drafting formulas, not permissions: skip them.
const MOD_RE = /\b(?:as\s+the\s+case\s+may\s+be|(?:as\s+)?may\s+be\s+(?:prescribed|notified|specified|determined)|(shall\s+not|must\s+not|may\s+not|cannot|can't|can\s+not|not\s+allowed|is\s+required\s+to|are\s+required\s+to|has\s+to|have\s+to|shall|must|may|can))\b/gi;
function modType(word) {
  const w = word.toLowerCase();
  if (/not|can't|cannot/.test(w)) return "ban";
  if (/shall|must|required|has to|have to/.test(w)) return "duty";
  return "may";
}
function markModality(text) {
  return esc(text).replace(MOD_RE, (m, word) => {
    if (!word) return m;
    const t = modType(m);
    const label = { duty: "obligation (must / shall)", ban: "prohibition (must not / shall not)", may: "permission (may / can)" }[t];
    return `<mark class="mod mod--${t}" data-mod="${t}" tabindex="0" title="${label}" aria-describedby="ledger">${m}<span class="visually-hidden"> (${label})</span></mark>`;
  });
}
function countModality(text) {
  const c = { duty: 0, ban: 0, may: 0 };
  for (const m of String(text).matchAll(MOD_RE)) if (m[1]) c[modType(m[1])]++;
  return c;
}
function plainHtml(text) {
  const lines = String(text).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => /^[-•*]\s+/.test(l));
  if (bullets.length >= 2 && bullets.length === lines.length) {
    return `<ul>${lines.map((l) => `<li>${markModality(l.replace(/^[-•*]\s+/, ""))}</li>`).join("")}</ul>`;
  }
  return lines.map((l) => `<p>${markModality(l)}</p>`).join("");
}
function lawHtml(text) {
  // /ask returns "[Section 8(6)] (6) ..." blocks separated by blank lines.
  const blocks = String(text).split(/\n\s*\n(?=\[)/);
  return blocks.map((b) => {
    const m = b.match(/^\[([^\]]+)\]\s*/);
    const cite = m ? `<span class="law-block__cite">${esc(m[1])}</span>` : "";
    // Undo the Gazette's line wrapping; keep breaks before clauses, illustrations and explanations.
    const body = (m ? b.slice(m[0].length) : b).replace(/\n(?!\(|Illustration|Explanation|\.\.\.|\d+\. Breach|Penalty:)/g, " ");
    return `<div class="law-block">${cite}${markModality(body)}</div>`;
  }).join("");
}

// Chapter titles are printed in capitals; sentence-case them but keep the Act's defined terms.
const TERMS = ["Data Fiduciary", "Data Principal", "Data Protection Board of India", "Board", "India", "Appellate Tribunal"];
function sentenceCase(s) {
  let out = s.toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  for (const t of TERMS) out = out.replace(new RegExp(`\\b${t}\\b`, "gi"), t);
  return out;
}

/* ---------------- header: status ---------------- */
async function checkHealth() {
  const el = $("#status");
  try {
    const r = await fetch(`${API}/health`);
    const h = await r.json();
    el.dataset.state = h.status === "ok" ? "ok" : "degraded";
    $(".status__model", el).textContent = `${h.model}, `;
    $(".status__state", el).textContent = h.status === "ok"
      ? "ready"
      : (!h.ollama.reachable ? "Ollama not running" : !h.ollama.model_available ? "model not pulled" : "index missing");
  } catch {
    el.dataset.state = "down";
    $(".status__model", el).textContent = "";
    $(".status__state", el).textContent = "API offline";
  }
}

/* ---------------- rail ---------------- */
async function loadSections() {
  try {
    const r = await fetch(`${API}/sections`);
    sections = await r.json();
  } catch { sections = []; }
  $("#rail-count").textContent = sections.length ? `${sections.length - 1} sections + Schedule` : "";
  renderRail();
}

function renderRail(filter = "") {
  const list = $("#rail-list");
  const q = filter.trim().toLowerCase();
  if (q) {
    const hits = sections.filter((s) => s.title.toLowerCase().includes(q) || s.section === q || s.chapter.toLowerCase().includes(q));
    list.innerHTML = hits.length
      ? `<ul class="matches">${hits.map((s) => `<li><button type="button" data-section="${esc(s.section)}"><b>${s.section === "Schedule" ? "Sch" : "§" + s.section}</b><span>${esc(s.title).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), (m) => `<mark>${m}</mark>`)}</span></button></li>`).join("")}</ul>`
      : `<p class="small" style="margin-top:12px">No section title matches “${esc(filter)}”. Try asking it as a question instead.</p>`;
    return;
  }
  const chapters = [];
  for (const s of sections) {
    let ch = chapters.find((c) => c.name === s.chapter);
    if (!ch) chapters.push(ch = { name: s.chapter, items: [] });
    ch.items.push(s);
  }
  list.innerHTML = chapters.map((c) => {
    const [num, ...rest] = c.name.replace("CHAPTER ", "").split(" - ");
    const title = sentenceCase(rest.join(" - "));
    const label = c.name === "THE SCHEDULE" ? `<b>SCH</b>Penalties` : `<b>${num}</b>${esc(title)}`;
    return `<div class="chapter"><p class="chapter__name">${label}</p><div class="cells">${c.items.map((s) =>
      `<button type="button" class="cell${s.section === "Schedule" ? " cell--wide" : ""}" data-section="${esc(s.section)}" aria-label="Section ${esc(s.section)}: ${esc(s.title)}">${s.section === "Schedule" ? "Sch." : s.section}</button>`
    ).join("")}</div></div>`;
  }).join("");
}

function markRail({ current: cur = null, cited = [] } = {}) {
  const citedSet = new Set(cited.map(sectionOf));
  document.querySelectorAll(".cell").forEach((b) => {
    b.setAttribute("aria-current", String(b.dataset.section === cur));
    b.dataset.cited = String(citedSet.has(b.dataset.section));
  });
}

function peek(section) {
  const s = sections.find((x) => x.section === section);
  $("#rail-peek").innerHTML = s ? `<b>${s.section === "Schedule" ? "Sch." : "§" + s.section}</b>${esc(s.title)}` : "Pick a section to simplify it.";
}

/* ---------------- states ---------------- */
function settle(message, focusSel) {
  cert.setAttribute("aria-busy", "false");
  $("#announce").textContent = message;
  const target = focusSel && $(focusSel, cert);
  if (!target) return;
  target.focus({ preventScroll: true });
  if (narrow.matches) {   // on phones the result is below the ask box: bring it into view
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cert.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
  }
}

function renderEmpty() {
  cert.setAttribute("aria-busy", "false");
  cert.innerHTML = "";
  cert.appendChild($("#tpl-empty").content.cloneNode(true));
}

function renderLoading(label, kind) {
  const steps = kind === "ask"
    ? ["Searching all 202 clauses of the Act", "Reading the closest clauses", "Writing the answer in plain words"]
    : ["Fetching the exact text of the clause", "Rewriting it in plain words"];
  cert.setAttribute("aria-busy", "true");
  $("#announce").textContent = kind === "ask" ? "Searching the Act…" : "Simplifying…";
  cert.innerHTML = `<div class="cert__frame progress">
      <p class="progress__q">${esc(label)}</p>
      <ol class="steps">${steps.map((s, i) => `<li class="${i === 0 ? "is-active" : ""}">${s}</li>`).join("")}</ol>
      <div class="progress__foot"><span id="elapsed">0.0 s</span><span>Phi-3-mini runs on this laptop, usually 3–15 s.</span>
      <button type="button" class="btn btn--ghost" id="cancel">Cancel</button></div>
    </div>`;
  const t0 = performance.now();
  const lis = cert.querySelectorAll(".steps li");
  const timer = setInterval(() => {
    const s = (performance.now() - t0) / 1000;
    const el = $("#elapsed");
    if (!el) return clearInterval(timer);
    el.textContent = `${s.toFixed(1)} s`;
    const idx = kind === "ask" ? (s < 0.8 ? 0 : s < 2 ? 1 : 2) : (s < 0.5 ? 0 : 1);
    lis.forEach((li, i) => { li.className = i < idx ? "is-done" : i === idx ? "is-active" : ""; });
  }, 100);
  $("#cancel").addEventListener("click", () => current?.abort());
  return () => clearInterval(timer);
}

function renderError(title, body) {
  cert.setAttribute("aria-busy", "false");
  $("#announce").textContent = "";
  cert.innerHTML = `<div class="cert__frame error" role="alert"><h2>${esc(title)}</h2><p>${body}</p></div>`;
}

function ledger(plain, law) {
  const p = countModality(plain), l = countModality(law);
  const keys = [["duty", "must / shall"], ["ban", "must not / shall not"], ["may", "may / can"]];
  if (!Object.values(p).some(Boolean) && !Object.values(l).some(Boolean)) return "";  // a definition: nothing to compare
  const differs = keys.some(([k]) => (p[k] > 0) !== (l[k] > 0));
  return `<div class="ledger" id="ledger" role="group" aria-label="Obligation check: underlined words in both columns">
      ${keys.map(([k, word]) => `<button type="button" class="ledger__key" data-mod="${k}" aria-label="${word}: ${p[k]} in plain words, ${l[k]} in the Act. Highlights them."><i>${word}</i><b>plain ${p[k]} · Act ${l[k]}</b></button>`).join("")}
      <span class="ledger__flag ${differs ? "" : "ledger__flag--ok"}">${differs ? "Force differs: read both columns" : "Same kinds of obligation in both"}</span>
    </div>`;
}

function checkedList(retrieved, cited) {
  const citedSet = new Set(cited);
  return `<ul class="checked">${retrieved.map((r) => `<li class="${citedSet.has(r.citation) ? "is-cited" : ""}">
      <button type="button" data-simplify="${esc(r.citation)}" title="Simplify ${esc(r.citation)}">${esc(r.citation)}</button>
      <span class="t">${esc(r.title)}</span>
      <span class="score" title="Cosine similarity between your question and this clause"><span class="score__bar"><span style="width:${Math.max(4, Math.round(Math.max(0, r.score) * 100))}%"></span></span>${r.score.toFixed(2)}</span>
    </li>`).join("")}</ul>`;
}

function headBlock({ citation, title, chapter, kind, latency, extra = "" }) {
  const [main, rest] = citation.match(/^(Section \d+|Schedule)(.*)$/)?.slice(1) || [citation, ""];
  return `<div class="row row--head">
      <div class="row__value head">
        <div>
          <h1 class="cite" tabindex="-1">${esc(main)}<small>${esc(rest)}</small></h1>
          ${title ? `<p class="head__title">${esc(title)}</p>` : ""}
          ${chapter ? `<p class="head__chapter">${esc(chapter)}</p>` : ""}
          ${extra}
        </div>
        <p class="meta">${kind === "ask" ? "Answered" : "Simplified"} in ${latency.toFixed(1)} s</p>
      </div>
    </div>`;
}

function sectionMeta(citation) {
  const s = sections.find((x) => x.section === sectionOf(citation));
  return s ? { title: s.title, chapter: s.chapter === "THE SCHEDULE" ? "The Schedule" : s.chapter.replace(/^CHAPTER (\w+) - (.+)$/, (m, n, t) => `Chapter ${n} · ${sentenceCase(t)}`) } : { title: "", chapter: "" };
}

function renderAnswer(a) {
  cert.setAttribute("aria-busy", "false");
  if (a.fallback) return renderFallback(a);
  const lead = a.sections[0];
  const meta = sectionMeta(lead);
  const others = a.sections.slice(1);
  const extra = others.length ? `<div class="also">${others.map((c) => `<button type="button" class="cite-chip" data-simplify="${esc(c)}">also ${esc(c)}</button>`).join("")}</div>` : "";
  cert.innerHTML = `<article class="cert__frame">
      ${headBlock({ citation: lead, title: meta.title, chapter: meta.chapter, kind: "ask", latency: a.latency_s, extra })}
      <div class="row"><span class="row__label">Answer</span><p class="row__value answer">${markModality(a.answer)}</p></div>
      <div class="attest">
        <div class="attest__col"><h2 class="attest__head">In plain words <span>rewritten by Phi-3</span></h2><div class="plain">${plainHtml(a.plain_language)}</div></div>
        <div class="attest__col attest__col--law"><h2 class="attest__head">The Act says <span>verbatim</span></h2><div class="law">${lawHtml(a.original_clause)}</div></div>
      </div>
      ${ledger(a.answer + " " + a.plain_language, a.original_clause)}
      <div class="row"><span class="row__label">Clauses checked</span><div class="row__value">${checkedList(a.retrieved, a.sections)}</div></div>
      <div class="row row--note"><span class="row__label">Note</span><p class="row__value small">${esc(a.disclaimer)}</p></div>
    </article>`;
  markRail({ cited: a.sections });
  settle("Answer ready.", ".cite");   // the focused headline reads the citation
}

function renderFallback(a) {
  cert.innerHTML = `<article class="cert__frame">
      <div class="row row--head">
        <div class="row__value stamp-wrap">
          <p class="stamp" role="img" aria-label="Not covered by the DPDP Act" tabindex="-1">Not covered<small>by the DPDP Act, 2023</small></p>
          <div><p class="answer">${esc(a.answer)}</p><p class="reason">${esc(a.fallback_reason || "")}</p></div>
        </div>
      </div>
      <div class="row"><span class="row__label">Closest clauses checked</span><div class="row__value">
        <p class="small" style="margin-bottom:8px">None of these answers your question, so nothing was rewritten.</p>${checkedList(a.retrieved, [])}</div></div>
      <div class="row row--note"><span class="row__label">Note</span><p class="row__value small">${esc(a.disclaimer)}</p></div>
    </article>`;
  markRail();
  settle("", ".stamp");   // the focused stamp already says "Not covered"
}

function renderSimplified(r) {
  cert.setAttribute("aria-busy", "false");
  const meta = sectionMeta(r.section);
  const s = sections.find((x) => x.section === sectionOf(r.section));
  const subs = s && s.subsections.length > 1 && !/\)$/.test(r.section)
    ? `<div class="also">${s.subsections.map((c) => `<button type="button" class="cite-chip" data-simplify="${esc(c)}">${esc(c.replace(/^Section \d+|^Schedule, /, "") || c)}</button>`).join("")}</div>` : "";
  const long = r.original_clause.length > 1800;
  cert.innerHTML = `<article class="cert__frame">
      ${headBlock({ citation: r.section, title: r.title || meta.title, chapter: meta.chapter, kind: "simplify", latency: r.latency_s, extra: subs })}
      ${r.key_points.length ? `<div class="row"><span class="row__label">Key points</span><ul class="row__value points">${r.key_points.map((p) => `<li>${markModality(p)}</li>`).join("")}</ul></div>` : ""}
      <div class="attest">
        <div class="attest__col"><h2 class="attest__head">In plain words <span>rewritten by Phi-3</span></h2><div class="plain">${plainHtml(r.plain_language)}</div></div>
        <div class="attest__col attest__col--law"><h2 class="attest__head">The Act says <span>verbatim</span></h2><div class="law${long ? " law--scroll" : ""}" ${long ? 'tabindex="0"' : ""}>${lawHtml(r.original_clause)}</div></div>
      </div>
      ${ledger(r.plain_language + " " + r.key_points.join(" "), r.original_clause)}
      <div class="row row--note"><span class="row__label">Note</span><p class="row__value small">${esc(r.disclaimer)}</p></div>
    </article>`;
  markRail({ current: sectionOf(r.section) });
  settle("Simplified.", ".cite");
}

/* ---------------- actions ---------------- */
async function call(path, body, label, kind) {
  current?.abort();
  current = new AbortController();
  const stop = renderLoading(label, kind);
  $("#ask-btn").disabled = true;
  try {
    const r = await fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: current.signal });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const detail = Array.isArray(data.detail) ? "Please type a question of at least 3 characters." : esc(data.detail || r.statusText);
      if (r.status === 503) return renderError("The language model is not available", `${detail}<br><br>Start it with <code>ollama serve</code>, then <code>ollama pull phi3:mini</code>, and try again.`);
      if (r.status === 404) return renderError("That section was not found", detail);
      return renderError("Something went wrong", detail);
    }
    return data;
  } catch (e) {
    if (e.name === "AbortError") { renderEmpty(); return null; }
    renderError("Can't reach the API", `Is the server running? Start it with <code>uvicorn src.api:app --port 8000</code>.`);
    return null;
  } finally {
    stop();
    $("#ask-btn").disabled = false;
  }
}

async function ask(question) {
  question = question.trim();
  if (question.length < 3) return;
  $("#ask-input").value = question;
  history.replaceState(null, "", `#q=${encodeURIComponent(question)}`);
  const a = await call("/ask", { question }, question, "ask");
  if (a && a.question) renderAnswer(a);
}

async function simplify(ref) {
  history.replaceState(null, "", `#s=${encodeURIComponent(ref)}`);
  markRail({ current: sectionOf(ref.startsWith("Section") || ref.startsWith("Schedule") ? ref : "Section " + ref) });
  const label = ref === "Schedule" ? "Simplifying the Schedule of penalties" : `Simplifying ${ref.startsWith("Section") ? ref : "Section " + ref}`;
  const r = await call("/simplify", { section: ref.replace(/^Schedule, item \d+$/, "Schedule") }, label, "simplify");
  if (r && r.section) renderSimplified(r);
}

/* ---------------- wiring ---------------- */
$("#ask-form").addEventListener("submit", (e) => { e.preventDefault(); ask($("#ask-input").value); });
document.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-q]");
  if (chip) return ask(chip.dataset.q);
  const sec = e.target.closest("[data-section]");
  if (sec) return simplify(sec.dataset.section);
  const s = e.target.closest("[data-simplify]");
  if (s) return simplify(s.dataset.simplify);
});
$("#rail-list").addEventListener("mouseover", (e) => { const b = e.target.closest("[data-section]"); if (b) peek(b.dataset.section); });
$("#rail-list").addEventListener("focusin", (e) => { const b = e.target.closest("[data-section]"); if (b) peek(b.dataset.section); });
$("#rail-filter").addEventListener("input", (e) => renderRail(e.target.value));

// Signature interaction: light every mark of the same obligation force in both columns.
const lit = (e) => { const m = e.target.closest?.(".mod"); if (m) cert.dataset.attest = m.dataset.mod; };
const unlit = (e) => { if (e.target.closest?.(".mod")) delete cert.dataset.attest; };
cert.addEventListener("mouseover", lit); cert.addEventListener("focusin", lit);
cert.addEventListener("mouseout", unlit); cert.addEventListener("focusout", unlit);
for (const [on, off] of [["mouseover", "mouseout"], ["focusin", "focusout"]]) {
  cert.addEventListener(on, (e) => { const k = e.target.closest(".ledger__key"); if (k) cert.dataset.attest = k.dataset.mod; });
  cert.addEventListener(off, (e) => { if (e.target.closest(".ledger__key")) delete cert.dataset.attest; });
}

// The rail is a disclosure only on narrow screens; on wider ones it is always open.
const narrow = window.matchMedia("(max-width: 860px)");
const syncRail = () => {
  $("#rail-fold").open = !narrow.matches;
  $(".rail__summary").tabIndex = narrow.matches ? 0 : -1;
};
narrow.addEventListener("change", syncRail);
syncRail();
$(".rail__summary").addEventListener("click", (e) => { if (!narrow.matches) e.preventDefault(); });

renderEmpty();
checkHealth();
loadSections().then(() => {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith("q=")) ask(h.slice(2));
  else if (h.startsWith("s=")) simplify(h.slice(2));
});

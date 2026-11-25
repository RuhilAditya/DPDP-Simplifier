// Builds docs/deliverables/DPDP_Simplifier_Presentation.pptx: 10 slides, 5 on the business case and 5 on the
// technical solution. Structured deck (theme, layouts, sections), native charts, speaker notes.
// Numbers come from eval/results.json, data/processed/chunks.json and evidence/api/postman_replay.json.
// Usage: python -m scripts.report.make_figures   then   node docs/deliverables/build_slides.js
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const { applyTheme } = require("./apply_theme.js");

const ROOT = path.resolve(__dirname, "..", "..");
const FIG = path.join(ROOT, "docs", "figures");
const J = (...p) => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), "utf8"));
const results = J("eval", "results.json");
const S = results.summary, rows = results.rows;
const raw = Object.fromEntries(results.raw.map((r) => [r.id, r]));
const chunks = J("data", "processed", "chunks.json");
const replay = J("evidence", "api", "postman_replay.json").summary;
const n = (s) => Number(s.split("/")[0]);

const STUDENTS = ["Aditya Ruhil (23CSU015)", "Aditya Chahar (23CSU014)", "Anmole (23CSU033)"];
const GUIDE = "Prerna Singal, Assistant Professor";

// ------------------------------------------------------------------ theme: NCU maroon and orange on ink and white
const THEME = {
  name: "DPDP Simplifier",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1C1B19", lt1: "FFFFFF", dk2: "45433E", lt2: "F4F3F1",
    accent1: "87272A", // NCU maroon: the law, emphasis
    accent2: "E8712B", // NCU orange: highlights
    accent3: "2F5D3A", // correct / pass
    accent4: "6B675F", // muted
    accent5: "B5B0A4", // rules
    accent6: "3B5B7A", // technical blue-slate
    hlink: "87272A", folHlink: "6B675F",
  },
};
const HEX = { ink: "1C1B19", ink2: "45433E", muted: "6B675F", rule: "DEDAD0", maroon: "87272A", orange: "E8712B", green: "2F5D3A", wash: "F4F3F1", slate: "3B5B7A" };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "DPDP Act Simplifier";
pres.author = "Aditya Ruhil, Aditya Chahar, Anmole";
pres.company = "The NorthCap University";
const C = pres.SchemeColor;

// ------------------------------------------------------------------ layouts
pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 1.55, w: 7.6, h: 1.3, fontSize: 48, bold: true, align: "left", color: C.background1, valign: "bottom", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 3.0, w: 7.4, h: 1.1, fontSize: 20, color: "D9D4CA", valign: "top", margin: 0 }, text: "" } },
  ],
});
const contentLayout = (name, tag, tagColor) => pres.defineSlideMaster({
  title: name,
  background: { color: C.background1 },
  margin: [0.5, 0.6, 0.6, 0.6],
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.62, w: 11.0, h: 0.85, fontSize: 32, bold: true, align: "left", color: C.text1, valign: "middle", margin: 0 }, text: "" } },
    { text: { text: tag, options: { x: 0.6, y: 0.3, w: 4, h: 0.3, fontSize: 11, bold: true, charSpacing: 2, color: tagColor, margin: 0 } } },
    // NCU logo, top right (1568 x 1200 px source, aspect kept)
    { image: { path: path.join(FIG, "ncu_logo.png"), x: 11.79, y: 0.3, w: 0.94, h: 0.94 * 1200 / 1568, altText: "The NorthCap University logo" } },
    { text: { text: "DPDP Act Simplifier · CSL374 · The NorthCap University", options: { x: 0.6, y: 7.0, w: 7, h: 0.3, fontSize: 10, color: C.accent4, margin: 0 } } },
  ],
  slideNumber: { x: 12.4, y: 6.95, w: 0.6, h: 0.3, fontSize: 10, color: C.accent4 },
});
contentLayout("BUSINESS", "BUSINESS CASE", C.accent1);
contentLayout("TECHNICAL", "TECHNICAL SOLUTION", C.accent6);

// ------------------------------------------------------------------ helpers
async function icon(Comp, hex) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: `#${hex}`, size: 256 }));
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function fitImage(slide, file, x, y, maxW, maxH, name) {
  const { w, h } = pngSize(file);
  const scale = Math.min(maxW / w, maxH / h);
  const W = w * scale, H = h * scale;
  slide.addImage({ path: file, x: x + (maxW - W) / 2, y: y + (maxH - H) / 2, w: W, h: H, objectName: name, altText: name });
  return { x: x + (maxW - W) / 2, y: y + (maxH - H) / 2, w: W, h: H };
}
const text = (slide, t, o) => slide.addText(t, { isTextBox: true, margin: 0, fontSize: 16, color: C.text2, valign: "top", ...o });
function card(slide, x, y, w, h, name, fill = C.background2) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill },
    line: { color: HEX.rule, width: 0.75 }, objectName: name });
}
function stat(slide, x, y, w, value, label, color, name, size = 44) {
  text(slide, value, { x, y, w, h: 0.85, fontSize: size, bold: true, color, fontFace: THEME.headFontFace, valign: "bottom", objectName: `${name} value` });
  text(slide, label, { x, y: y + 0.92, w, h: 0.7, fontSize: 14, color: C.text2, objectName: `${name} label` });
}
const chartText = { catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt",
  titleFontFace: "+mn-lt", legendFontFace: "+mn-lt", catAxisLabelColor: HEX.ink2, valAxisLabelColor: HEX.muted,
  catAxisLabelFontSize: 12, valAxisLabelFontSize: 11, dataLabelFontSize: 12, dataLabelColor: HEX.ink,
  valGridLine: { color: "E6E3DC", size: 0.75 }, catGridLine: { style: "none" }, titleColor: HEX.ink, titleFontSize: 14 };

async function build() {
  const ic = {
    scale: await icon(fa.FaBalanceScale, HEX.maroon), user: await icon(fa.FaUserShield, HEX.maroon),
    building: await icon(fa.FaBuilding, HEX.maroon), grad: await icon(fa.FaGraduationCap, HEX.maroon),
    book: await icon(fa.FaBookOpen, HEX.ink), lawyer: await icon(fa.FaUserTie, HEX.ink), robot: await icon(fa.FaRobot, HEX.ink),
    bolt: await icon(fa.FaBolt, HEX.orange), quote: await icon(fa.FaQuoteRight, HEX.maroon), ban: await icon(fa.FaBan, HEX.maroon),
    lock: await icon(fa.FaLock, HEX.green), plug: await icon(fa.FaPlug, HEX.maroon), globe: await icon(fa.FaGlobeAsia, HEX.maroon),
    chev: await icon(fa.FaChevronRight, HEX.muted), check: await icon(fa.FaCheckCircle, HEX.green), warn: await icon(fa.FaExclamationTriangle, HEX.orange),
  };
  const iconCircle = (slide, data, x, y, d, name, fill = "FFFFFF") => {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: HEX.rule, width: 0.75 }, objectName: `${name} circle` });
    slide.addImage({ data, x: x + d * 0.24, y: y + d * 0.24, w: d * 0.52, h: d * 0.52, objectName: `${name} icon`, altText: name });
  };

  // ================================================================ BUSINESS CASE (slides 1-5)
  pres.addSection({ title: "Business case" });

  // 1. Title
  {
    const s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Business case" });
    s.addText("DPDP Act Simplifier", { placeholder: "title" });
    s.addText("Plain-language answers to India's data protection law, with the exact clause behind every answer", { placeholder: "body" });
    text(s, [
      { text: STUDENTS.join("   ·   "), options: { breakLine: true } },
      { text: `Guide: ${GUIDE}`, options: { breakLine: true } },
      { text: "CSL374 Microservice Based Applications · Project 11 · 7th Semester, 2026" },
    ], { x: 0.8, y: 4.75, w: 8.2, h: 1.2, fontSize: 15, color: "D9D4CA", paraSpaceAfter: 6, objectName: "Team and course" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 9.35, y: 1.85, w: 3.2, h: 2.95, rectRadius: 0.1, fill: { color: "FFFFFF" }, line: { color: "FFFFFF" }, objectName: "Logo card" });
    fitImage(s, path.join(FIG, "ncu_logo.png"), 9.6, 2.1, 2.7, 2.45, "The NorthCap University logo");
    s.addNotes("DPDP Act Simplifier answers questions about India's Digital Personal Data Protection Act, 2023 in plain language, and shows the exact clause each answer comes from. The first half of this talk is the business case: the problem, who has it, and why existing options fall short. The second half is how we built it and how well it works.");
  }

  // 2. The problem
  {
    const s = pres.addSlide({ masterName: "BUSINESS", sectionTitle: "Business case" });
    s.addText("Everyone must follow the DPDP Act; few can read it", { placeholder: "title" });
    stat(s, 0.6, 1.75, 3.3, "₹250 cr", "maximum penalty for failing to protect personal data (Schedule, item 1)", C.accent1, "Penalty");
    stat(s, 0.6, 3.5, 3.3, "44", "sections in 9 chapters, plus a penalty Schedule", C.accent1, "Sections");
    stat(s, 0.6, 5.25, 3.3, "21", "pages of statutory text with nested clauses and cross-references", C.accent1, "Pages");
    text(s, "Who has to understand it", { x: 4.6, y: 1.75, w: 8, h: 0.45, fontSize: 20, bold: true, color: C.text1, fontFace: THEME.headFontFace, objectName: "Affected heading" });
    const who = [
      [ic.user, "Citizens (Data Principals)", "Rights to access, correct and erase their data, withdraw consent and complain, plus duties of their own."],
      [ic.building, "Businesses and startups (Data Fiduciaries)", "Notices, valid consent, security safeguards, breach reporting, children's data rules."],
      [ic.grad, "Students and developers", "Anyone building an app that collects personal data needs to know what the law requires."],
    ];
    who.forEach(([img, h, d], i) => {
      const y = 2.45 + i * 1.45;
      iconCircle(s, img, 4.6, y, 0.85, h, HEX.wash);
      text(s, h, { x: 5.7, y, w: 7.0, h: 0.4, fontSize: 17, bold: true, color: C.text1, objectName: `${h} title` });
      text(s, d, { x: 5.7, y: y + 0.42, w: 7.0, h: 0.75, fontSize: 15, objectName: `${h} text` });
    });
    s.addNotes("The Act applies to almost every organisation that handles digital personal data in India, and gives every individual new rights. The stakes are high: up to 250 crore rupees for failing to take reasonable security safeguards. Yet the text is 21 pages of dense legal drafting, where the difference between shall and may matters.");
  }

  // 3. Why existing options fall short
  {
    const s = pres.addSlide({ masterName: "BUSINESS", sectionTitle: "Business case" });
    s.addText("Today's options are slow, costly or unreliable", { placeholder: "title" });
    const cols = [
      [ic.book, "Read the Act yourself", "Free and exact", "Dense drafting, nested sub-clauses and cross-references; easy to misread an obligation"],
      [ic.lawyer, "Ask a lawyer", "Accurate and accountable", "Costly and slow for everyday questions like “can I withdraw consent?”"],
      [ic.robot, "Ask a general AI chatbot", "Instant", "Answers from memory and can invent provisions: studies found 69–88% hallucination on legal queries for general models, and 17–33% even in commercial legal AI tools"],
    ];
    cols.forEach(([img, h, pro, con], i) => {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.75, 3.8, 4.0, `${h} card`);
      iconCircle(s, img, x + 0.3, 2.0, 0.8, h);
      text(s, h, { x: x + 0.3, y: 2.95, w: 3.2, h: 0.45, fontSize: 18, bold: true, color: C.text1, objectName: `${h} title` });
      s.addImage({ data: ic.check, x: x + 0.3, y: 3.53, w: 0.24, h: 0.24, objectName: `${h} pro icon`, altText: "Strength" });
      text(s, pro, { x: x + 0.65, y: 3.47, w: 2.9, h: 0.4, fontSize: 15, color: C.accent3, bold: true, objectName: `${h} pro` });
      s.addImage({ data: ic.warn, x: x + 0.3, y: 4.04, w: 0.24, h: 0.24, objectName: `${h} con icon`, altText: "Weakness" });
      text(s, con, { x: x + 0.65, y: 3.98, w: 2.95, h: 1.7, fontSize: 14, objectName: `${h} con` });
    });
    text(s, [
      { text: "The gap: ", options: { bold: true, color: C.accent1 } },
      { text: "instant answers in plain words that anyone can check against the law itself." },
    ], { x: 0.6, y: 6.05, w: 12.1, h: 0.45, fontSize: 18, color: C.text1, objectName: "Gap statement" });
    text(s, "Sources: Dahl et al., Journal of Legal Analysis, 2024; Magesh et al., arXiv:2405.20362, 2024.", { x: 0.6, y: 6.55, w: 12.1, h: 0.3, fontSize: 10, color: C.accent4, objectName: "Sources" });
    s.addNotes("People have three options today. Reading the Act is exact but hard. A lawyer is accurate but expensive for everyday questions. A chatbot is instant but answers from memory: published studies found general models hallucinate on most legal queries, and even commercial legal AI tools hallucinate on 17 to 33 percent. The missing option is something instant that can be checked.");
  }

  // 4. Our solution
  {
    const s = pres.addSlide({ masterName: "BUSINESS", sectionTitle: "Business case" });
    s.addText("Our answer: instant, plain and checkable", { placeholder: "title" });
    const box = fitImage(s, path.join(FIG, "ui_answer.png"), 0.6, 1.7, 6.6, 4.9, "Answer view of the web app");
    s.addShape(pres.shapes.RECTANGLE, { x: box.x, y: box.y, w: box.w, h: box.h, fill: { type: "none" }, line: { color: HEX.rule, width: 0.75 }, objectName: "Screenshot frame" });
    const pts = [
      [ic.bolt, "A plain answer in seconds", `About ${Math.round(S.mean_latency_s)} seconds per question, in everyday words.`],
      [ic.quote, "The exact clause beside it", "Citation such as Section 8(6) and the Act's own words, copied, never generated."],
      [ic.ban, "Says “not covered” instead of guessing", `All ${n(S.fallback_correct)} out-of-scope test questions were declined.`],
      [ic.lock, "Runs on a laptop", "Private, works offline, no per-question API fees."],
    ];
    pts.forEach(([img, h, d], i) => {
      const y = 1.75 + i * 1.22;
      iconCircle(s, img, 7.6, y, 0.75, h, HEX.wash);
      text(s, h, { x: 8.55, y: y - 0.02, w: 4.2, h: 0.4, fontSize: 17, bold: true, color: C.text1, objectName: `${h} title` });
      text(s, d, { x: 8.55, y: y + 0.38, w: 4.2, h: 0.7, fontSize: 14, objectName: `${h} text` });
    });
    s.addNotes("Our tool gives a direct answer and a plain-language rewrite in about four seconds, and always shows the exact clause and its citation next to it, so the user can check it. If the Act does not cover the question, it says so rather than inventing an answer. Everything runs on a laptop, so questions stay private and there is no per-query cost.");
  }

  // 5. Where it creates value
  {
    const s = pres.addSlide({ masterName: "BUSINESS", sectionTitle: "Business case" });
    s.addText("Where it creates value", { placeholder: "title" });
    const seg = [
      [ic.globe, "Citizens", "Web app", "Understand rights such as consent withdrawal, correction and grievance redressal without legal help."],
      [ic.plug, "Businesses and compliance teams", "REST API", "Embed answers in HR, onboarding or privacy portals; first-line help before escalating to counsel."],
      [ic.grad, "Universities and trainers", "Teaching aid", "Explore the Act section by section with the original text always in view."],
    ];
    seg.forEach(([img, h, ch, d], i) => {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.75, 3.8, 2.75, `${h} card`, "FFFFFF");
      iconCircle(s, img, x + 0.3, 1.98, 0.7, h, HEX.wash);
      text(s, h, { x: x + 1.15, y: 1.98, w: 2.5, h: 0.7, fontSize: 17, bold: true, color: C.text1, valign: "middle", objectName: `${h} title` });
      text(s, ch, { x: x + 0.3, y: 2.85, w: 3.2, h: 0.35, fontSize: 14, bold: true, color: C.accent2, objectName: `${h} channel` });
      text(s, d, { x: x + 0.3, y: 3.22, w: 3.25, h: 1.2, fontSize: 14, objectName: `${h} text` });
    });
    text(s, "Roadmap", { x: 0.6, y: 4.8, w: 4, h: 0.4, fontSize: 20, bold: true, color: C.text1, fontFace: THEME.headFontFace, objectName: "Roadmap heading" });
    const steps = [["Now", "The Act, 2023: answers, simplification, API"], ["Next", "Check each rewritten sentence against its clause"], ["Then", "Add the DPDP Rules and amendments; Hindi answers"]];
    steps.forEach(([k, d], i) => {
      const x = 0.6 + i * 4.1;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.35, w: 3.8, h: 1.05, rectRadius: 0.08, fill: { color: i === 0 ? HEX.maroon : C.background2 }, line: { color: i === 0 ? HEX.maroon : HEX.rule, width: 0.75 }, objectName: `Roadmap ${k}` });
      text(s, k, { x: x + 0.25, y: 5.47, w: 3.3, h: 0.35, fontSize: 15, bold: true, color: i === 0 ? C.background1 : C.accent1, objectName: `Roadmap ${k} label` });
      text(s, d, { x: x + 0.25, y: 5.82, w: 3.35, h: 0.5, fontSize: 14, color: i === 0 ? C.background1 : C.text2, objectName: `Roadmap ${k} text` });
      if (i < 2) s.addImage({ data: ic.chev, x: x + 3.85, y: 5.75, w: 0.2, h: 0.2, objectName: `Roadmap arrow ${i}`, altText: "then" });
    });
    s.addNotes("Three groups benefit: citizens through the web app, businesses through the REST API embedded in their own portals, and educators as a teaching aid. Because it runs on open models on ordinary hardware, the cost per question is close to zero. Next steps are verifying each rewritten sentence against its clause, then adding the DPDP Rules and Hindi answers.");
  }

  // ================================================================ TECHNICAL SOLUTION (slides 6-10)
  pres.addSection({ title: "Technical solution" });

  // 6. Architecture
  {
    const s = pres.addSlide({ masterName: "TECHNICAL", sectionTitle: "Technical solution" });
    s.addText("Architecture: offline ingestion, online answering", { placeholder: "title" });
    fitImage(s, path.join(FIG, "architecture.png"), 0.6, 1.65, 12.1, 4.55, "System architecture diagram");
    text(s, [
      { text: "Stack: ", options: { bold: true, color: C.text1 } },
      { text: "pdfplumber · all-MiniLM-L6-v2 · FAISS + BM25 · LangChain · Phi-3-mini (3.8B) on Ollama · FastAPI · Docker" },
    ], { x: 0.6, y: 6.35, w: 12.1, h: 0.4, fontSize: 15, objectName: "Stack line" });
    s.addNotes("Ingestion runs once: the Gazette PDF is parsed, chunked by the Act's structure, embedded with MiniLM into FAISS and indexed with BM25. At question time we retrieve with both indexes, apply a similarity gate, ask Phi-3-mini through a strict LangChain prompt, pick the citation ourselves, and attach the verbatim clause from the index.");
  }

  // 7. Data pipeline
  {
    const s = pres.addSlide({ masterName: "TECHNICAL", sectionTitle: "Technical solution" });
    s.addText("Structure-aware chunking keeps every citation", { placeholder: "title" });
    const steps = [
      ["1", "Read word coordinates", "pdfplumber separates the body column from margin titles, headers and the Hindi masthead"],
      ["2", "Split by the Act's structure", "Chapter → section → sub-section (1), (2)… → clause (a), (b)…; one chunk per Schedule row"],
      ["3", "Keep long parts readable", "Parts over 1,500 characters split by clause, each keeping its lead-in sentence"],
      ["4", "Index twice", "MiniLM embeddings in FAISS (cosine) and a BM25 keyword index"],
    ];
    steps.forEach(([k, h, d], i) => {
      const y = 1.75 + i * 1.2;
      s.addShape(pres.shapes.OVAL, { x: 0.6, y, w: 0.55, h: 0.55, fill: { color: HEX.slate }, line: { color: HEX.slate }, objectName: `Step ${k} circle` });
      text(s, k, { x: 0.6, y, w: 0.55, h: 0.55, fontSize: 18, bold: true, color: C.background1, align: "center", valign: "middle", objectName: `Step ${k} number` });
      text(s, h, { x: 1.4, y: y - 0.02, w: 4.6, h: 0.38, fontSize: 17, bold: true, color: C.text1, objectName: `Step ${k} title` });
      text(s, d, { x: 1.4, y: y + 0.36, w: 4.6, h: 0.75, fontSize: 14, objectName: `Step ${k} text` });
    });
    const order = ["CHAPTER I", "CHAPTER II", "CHAPTER III", "CHAPTER IV", "CHAPTER V", "CHAPTER VI", "CHAPTER VII", "CHAPTER VIII", "CHAPTER IX", "THE SCHEDULE"];
    const counts = order.map((p) => chunks.filter((c) => c.chapter.startsWith(p + " -") || c.chapter === p).length);
    const labels = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "Sch."];
    s.addChart(pres.charts.BAR, [{ name: "Chunks", labels, values: counts }], {
      x: 6.5, y: 1.65, w: 6.2, h: 4.0, barDir: "col", chartColors: [HEX.slate], showValue: true, dataLabelPosition: "outEnd",
      showLegend: false, showTitle: true, title: `${chunks.length} chunks per chapter of the Act`, valAxisHidden: true, barGapWidthPct: 45, ...chartText,
      objectName: "Chunks per chapter chart",
    });
    text(s, [
      { text: `${new Set(chunks.filter((c) => /^\d+$/.test(String(c.section))).map((c) => c.section)).size} sections`, options: { bold: true, color: C.accent6 } },
      { text: " parsed in order, every chunk labelled like " },
      { text: "Section 8(6)", options: { bold: true, color: C.text1 } },
      { text: " or " },
      { text: "Schedule, item 1", options: { bold: true, color: C.text1 } },
    ], { x: 6.5, y: 5.85, w: 6.2, h: 0.75, fontSize: 15, objectName: "Chunk summary" });
    s.addNotes("Fixed-size chunks cannot be cited, so we chunk by the Act's own structure. Word coordinates from pdfplumber let us separate the margin titles and noise from the body. Sub-sections and clauses become chunks, and each Schedule row is one chunk. The result is 202 chunks, each with a real citation.");
  }

  // 8. Retrieval and guardrails
  {
    const s = pres.addSlide({ masterName: "TECHNICAL", sectionTitle: "Technical solution" });
    s.addText("Retrieval and guardrails: answer only from the Act", { placeholder: "title" });
    const flow = [
      ["Hybrid retrieval", "Dense + BM25, reciprocal-rank fusion, top 6"],
      ["Similarity gate", `Best cosine below ${S.sim_threshold}: “not covered”, no model call`],
      ["Phi-3-mini", `Temperature ${S.temperature}, strict JSON prompt, in_scope flag`],
      ["Citation check", "Answer matched to the clause it came from"],
      ["Verbatim clause", "Copied from the index, never generated"],
    ];
    flow.forEach(([h, d], i) => {
      const x = 0.6 + i * 2.48;
      card(s, x, 1.7, 2.2, 1.45, `${h} card`, i === 4 ? "F7ECEC" : C.background2);
      text(s, h, { x: x + 0.15, y: 1.82, w: 1.9, h: 0.4, fontSize: 15, bold: true, color: i === 4 ? C.accent1 : C.accent6, objectName: `${h} title` });
      text(s, d, { x: x + 0.15, y: 2.24, w: 1.95, h: 1.15, fontSize: 13, objectName: `${h} text` });
      if (i < 4) s.addImage({ data: ic.chev, x: x + 2.24, y: 2.3, w: 0.2, h: 0.2, objectName: `Flow arrow ${i}`, altText: "then" });
    });
    const ids = rows.map((r) => r.id);
    const top = ids.map((i) => Math.max(...raw[i].retrieved.map((d) => d.score), 0));
    const colors = rows.map((r) => (r.type === "in-scope" ? (r.correct ? HEX.green : "8F8A80") : HEX.maroon));
    s.addChart(pres.charts.BAR, [{ name: "Best cosine", labels: ids, values: top.map((v) => Math.round(v * 100) / 100) }], {
      x: 0.6, y: 3.7, w: 7.9, h: 3.1, barDir: "col", chartColors: colors, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00",
      showLegend: false, showTitle: true, title: "Best retrieval score per test question", valAxisMinVal: 0, valAxisMaxVal: 0.8, valAxisLabelFormatCode: "0.0",
      barGapWidthPct: 40, ...chartText, objectName: "Best score chart",
    });
    text(s, [
      { text: "Why two stages", options: { bold: true, color: C.text1, fontSize: 17, breakLine: true } },
      { text: "Unrelated questions (O2 GST, O3 income tax) score 0.20 and 0.23 and stop at the gate in 0.02 s.", options: { breakLine: true } },
      { text: "The IT Act question (O1) scores 0.45, as high as real questions, because the Act mentions the IT Act; Phi-3 marks it out of scope." },
    ], { x: 8.8, y: 3.85, w: 3.9, h: 2.6, fontSize: 14, paraSpaceAfter: 8, objectName: "Two-stage note" });
    text(s, "Green: correct · grey: in scope, not strictly correct · maroon: out of scope", { x: 0.6, y: 6.75, w: 7.9, h: 0.25, fontSize: 10, color: C.accent4, objectName: "Chart key" });
    s.addNotes("Retrieval merges dense and keyword search. A low similarity gate stops obviously unrelated questions without calling the model. Phi-3-mini answers at low temperature under strict rules and can mark a question out of scope. We then choose the citation ourselves and attach the verbatim clause. The chart shows why a threshold alone is not enough: the IT Act question scores as high as genuine ones.");
  }

  // 9. API and testing
  {
    const s = pres.addSlide({ masterName: "TECHNICAL", sectionTitle: "Technical solution" });
    s.addText("A tested FastAPI microservice", { placeholder: "title" });
    const hdr = { bold: true, color: "FFFFFF", fill: { color: HEX.slate }, fontSize: 14 };
    const cell = { fontSize: 13, color: HEX.ink2 };
    const tbl = [
      [{ text: "Endpoint", options: hdr }, { text: "Purpose", options: hdr }],
      ["POST /ask", "Answer, plain-language rewrite, verbatim clause, citations, disclaimer"],
      ["POST /simplify", "Rewrite any section, e.g. “8(6)” or “Section 17(1)(a)”, with key points"],
      ["GET /sections", "All 44 sections and the Schedule with titles and chapters"],
      ["GET /health", "Model reachable and pulled, index loaded, chunk count"],
    ].map((r, i) => (i === 0 ? r : [{ text: r[0], options: { ...cell, bold: true, color: HEX.ink, fontFace: "Consolas" } }, { text: r[1], options: cell }]));
    s.addTable(tbl, { x: 0.6, y: 1.75, w: 7.4, colW: [1.9, 5.5], rowH: 0.6, border: { type: "solid", color: HEX.rule, pt: 0.75 }, valign: "middle", margin: 0.08, objectName: "Endpoints table" });
    text(s, "Errors: 422 invalid input · 404 unknown section · 503 model unavailable, with a recovery hint. Swagger UI at /docs.", { x: 0.6, y: 5.0, w: 7.4, h: 0.6, fontSize: 14, objectName: "Errors line" });
    text(s, "Packaged with a Dockerfile (model and index baked in, non-root user, health check) and a web frontend served by the same app.", { x: 0.6, y: 5.7, w: 7.4, h: 0.8, fontSize: 14, objectName: "Packaging line" });
    card(s, 8.5, 1.75, 4.2, 4.75, "Tests card");
    stat(s, 8.85, 1.95, 3.6, `${replay.assertions_passed}/${replay.assertions_total}`, `checks passed, replaying the Postman collection's ${replay.requests} requests`, C.accent3, "Postman");
    stat(s, 8.85, 3.5, 3.6, "13", "pytest tests, runnable without the model", C.accent6, "Pytest");
    stat(s, 8.85, 5.0, 3.6, "4", "endpoints, documented in Swagger", C.accent6, "Endpoints", 40);
    s.addNotes("The service exposes four endpoints with Pydantic models, so Swagger documentation is automatic. Errors are explicit. The Postman collection has nine requests with test scripts; replayed against the live service, all thirty checks passed. Thirteen pytest tests cover the parser, section resolution, the gate and the API contract without needing the model.");
  }

  // 10. Results
  {
    const s = pres.addSlide({ masterName: "TECHNICAL", sectionTitle: "Technical solution" });
    s.addText("Results: strong retrieval, honest gaps", { placeholder: "title" });
    const labels = ["Clause retrieved", "Clause cited", "Key facts present", "Strictly correct"];
    const vals = [S.retrieval_hit, S.citation_hit, S.auto_pass, S.correct_in_scope].map(n);
    s.addChart(pres.charts.BAR, [{ name: "Held-out test (of 10)", labels: [...labels].reverse(), values: [...vals].reverse() }], {
      x: 0.6, y: 1.65, w: 6.4, h: 3.6, barDir: "bar", chartColors: [HEX.maroon, HEX.slate, HEX.slate, HEX.slate], showValue: true, dataLabelPosition: "outEnd",
      showLegend: false, showTitle: true, title: "10 held-out questions, written before tuning", valAxisMinVal: 0, valAxisMaxVal: 10, valAxisMajorUnit: 2,
      barGapWidthPct: 45, ...chartText, objectName: "Results chart",
    });
    stat(s, 0.8, 5.35, 2.8, S.fallback_correct, "out-of-scope questions declined", C.accent3, "Fallback", 36);
    stat(s, 3.9, 5.35, 3.0, `${S.mean_latency_s} s`, "mean time per question", C.accent6, "Latency", 36);
    text(s, "Where it fell short (target was 8/10)", { x: 7.5, y: 1.7, w: 5.2, h: 0.45, fontSize: 18, bold: true, color: C.text1, fontFace: THEME.headFontFace, objectName: "Gaps heading" });
    const gaps = [
      ["T2", "Added “promptly”; Section 8(6) sets no deadline"],
      ["T5", "Right content, cited 6(10) instead of 5(1)"],
      ["T8", "Listed a right as a duty of the Data Principal"],
      ["T9", "Paraphrase missed Section 16; safe refusal"],
    ];
    gaps.forEach(([id, d], i) => {
      const y = 2.3 + i * 0.78;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.5, y, w: 0.65, h: 0.5, rectRadius: 0.06, fill: { color: "F7ECEC" }, line: { color: "E8C9C9", width: 0.75 }, objectName: `${id} tag` });
      text(s, id, { x: 7.5, y, w: 0.65, h: 0.5, fontSize: 14, bold: true, color: C.accent1, align: "center", valign: "middle", objectName: `${id} label` });
      text(s, d, { x: 8.35, y: y + 0.02, w: 4.35, h: 0.5, fontSize: 14, valign: "middle", objectName: `${id} text` });
    });
    card(s, 7.5, 5.5, 5.2, 1.15, "Takeaway card", "FFFFFF");
    text(s, [
      { text: "Takeaway: ", options: { bold: true, color: C.accent1 } },
      { text: "retrieval works; the risk is in generated wording, which is why the exact clause is always shown beside it." },
    ], { x: 7.75, y: 5.62, w: 4.8, h: 0.95, fontSize: 14, color: C.text1, valign: "middle", objectName: "Takeaway" });
    s.addNotes("On ten held-out questions the right clause was retrieved nine times and cited eight times; six answers were strictly correct after manual review, below our target of eight. All three out-of-scope questions were declined, and answers take about four seconds. The failures are in the wording the model generates, which is exactly what showing the verbatim clause protects against.");
  }

  const out = path.join(__dirname, "DPDP_Simplifier_Presentation.pptx");
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log(`Wrote ${out}`);
}

build().catch((e) => { console.error(e); process.exit(1); });

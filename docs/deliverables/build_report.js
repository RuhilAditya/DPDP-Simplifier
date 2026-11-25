// Builds docs/deliverables/DPDP_Simplifier_Project_Report.docx (A4, project report format, same layout as the MedAssist report).
// Evaluation tables are read from eval/results.json and data/processed/chunks.json, so the report always matches the saved run.
// Usage: python -m scripts.report.make_figures   then   node docs/deliverables/build_report.js
// Open in Word and accept "update fields" (or press F9) to fill the table of contents.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, ImageRun, PageBreak, Footer, PageNumber, NumberFormat,
  TableOfContents, LevelFormat, TabStopType,
} = require("docx");

const ROOT = path.resolve(__dirname, "..", "..");
const FIG = path.join(ROOT, "docs", "figures");
const J = (...p) => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), "utf8"));
const results = J("eval", "results.json");
const S = results.summary, rows = results.rows;
const raw = Object.fromEntries(results.raw.map((r) => [r.id, r]));
const chunks = J("data", "processed", "chunks.json");
const questions = J("eval", "questions.json");
const replay = J("evidence", "api", "postman_replay.json");
const RS = replay.summary;
const dev = J("eval", "dev_questions.json");

// ------------------------------------------------------------------ styling helpers (as in the MedAssist report)
const FONT = "Times New Roman";
const BODY = 24; // 12 pt
const PAGE_W = 11906, MARGIN_L = 2160, MARGIN_R = 1440; // A4, 1.5" binding margin, 1" right
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

let figNo = { ch: 0, n: 0 }, tabNo = { ch: 0, n: 0 };

// ------------------------------------------------------------------ people, place and dates
const STUDENTS = [["Aditya Ruhil", "23CSU015"], ["Aditya Chahar", "23CSU014"], ["Anmole", "23CSU033"]];
const GUIDE = "Prerna Singal", GUIDE_TITLE = "Assistant Professor";
const PLACE = "Gurugram";
const TERM = "7th Semester, 2026";
const TERM_LONG = "7th semester (academic year 2026–27)";
const DATE = "25/11/2026";

function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, size: BODY, ...base }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, font: FONT, size: BODY, ...base }));
    else if (t.startsWith("`")) out.push(new TextRun({ text: t.slice(1, -1), font: "Consolas", size: (base.size || BODY) - 3 }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, font: FONT, size: BODY, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, size: BODY, ...base }));
  return out;
}
const P = (text, opts = {}) =>
  new Paragraph({ children: runs(text), alignment: AlignmentType.JUSTIFIED, spacing: { after: 160, line: 360 }, ...opts });
const C = (text, opts = {}) => new Paragraph({ children: runs(text, opts.run || {}), alignment: AlignmentType.CENTER, spacing: { after: 120 }, ...opts.para });
const bullet = (text) => new Paragraph({ children: runs(text), numbering: { reference: "bullets", level: 0 }, spacing: { after: 80, line: 340 }, alignment: AlignmentType.JUSTIFIED });
const numbered = (text, instance = 1) => new Paragraph({ children: runs(text), numbering: { reference: "numbers", level: 0, instance }, spacing: { after: 80, line: 340 } });
const blank = () => new Paragraph({ children: [] });
const code = (lines) => lines.map((t) => new Paragraph({ children: [new TextRun({ text: t, font: "Consolas", size: 19 })], spacing: { after: 40 }, indent: { left: 284 } }));
const quote = (text) => new Paragraph({ children: runs(text, { size: 22, italics: true }), indent: { left: 567, right: 567 }, spacing: { after: 160, line: 320 } });

function H1(text, ch, label) {
  const key = label || ch;
  figNo = { ch: key, n: 0 }; tabNo = { ch: key, n: 0 };
  // headings carry pageBreakBefore (a separate break paragraph can leave a blank page)
  return [new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: ch !== 1,
    children: [new TextRun({ text: ch ? `Chapter ${ch}: ${text}` : text })] })];
}
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text })] });

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), data: b };
}
function figure(file, caption, widthIn = 6.0) {
  const full = path.join(FIG, file);
  if (!fs.existsSync(full)) return [P(`[Missing figure: ${file}. Run python -m scripts.report.make_figures]`)];
  const { w, h, data } = pngSize(full);
  const width = Math.round(Math.min(widthIn, 5.75) * 96), height = Math.round((width * h) / w);
  figNo.n += 1;
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true,
      children: [new ImageRun({ type: "png", data, transformation: { width, height },
        altText: { title: caption, description: caption, name: file } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
      children: [new TextRun({ text: `Figure ${figNo.ch}.${figNo.n}: `, bold: true, font: FONT, size: 22 }), new TextRun({ text: caption, font: FONT, size: 22 })] }),
  ];
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "8C96A3" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(caption, header, rws, weights, leftCols = 1) {
  const total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.floor((CONTENT_W * w) / total));
  widths[widths.length - 1] = CONTENT_W - widths.slice(0, -1).reduce((a, b) => a + b, 0);
  const cell = (text, i, head) =>
    new TableCell({
      borders, width: { size: widths[i], type: WidthType.DXA },
      shading: head ? { fill: "E3E8EE", type: ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: runs(String(text), { size: 20, bold: !!head }), alignment: i < leftCols ? AlignmentType.LEFT : AlignmentType.CENTER })],
    });
  tabNo.n += 1;
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 80 }, keepNext: true,
      children: [new TextRun({ text: `Table ${tabNo.ch}.${tabNo.n}: `, bold: true, font: FONT, size: 22 }), new TextRun({ text: caption, font: FONT, size: 22 })] }),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths,
      rows: [new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, i, true)) }),
        ...rws.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i, false)) }))],
    }),
    blank(),
  ];
}

// ------------------------------------------------------------------ numbers used in the text
const inScope = rows.filter((r) => r.type === "in-scope");
const oos = rows.filter((r) => r.type !== "in-scope");
const answeredLat = inScope.filter((r) => !r.fallback).map((r) => r.latency_s).sort((a, b) => a - b);
const median = (a) => (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2);
const warmLat = answeredLat.filter((x) => x < 10);
const lens = chunks.map((c) => c.text.length).sort((a, b) => a - b);
const nSections = new Set(chunks.filter((c) => /^\d+$/.test(String(c.section))).map((c) => c.section)).size;
const nSchedule = chunks.filter((c) => !/^\d+$/.test(String(c.section))).length;
const byChapter = {};
for (const c of chunks) byChapter[c.chapter] = (byChapter[c.chapter] || 0) + 1;
const titleCase = (s) => s.replace(/^CHAPTER ([IVX]+) - /, "Chapter $1: ").toLowerCase()
  .replace(/^chapter ([ivx]+):/, (m, r) => `Chapter ${r.toUpperCase()}:`).replace(/: (\w)/, (m, c) => `: ${c.toUpperCase()}`)
  .replace(/^the schedule$/, "The Schedule").replace(/\bboard\b/g, "Board").replace(/\bindia\b/g, "India")
  .replace(/data protection/g, "Data Protection").replace(/data principal/g, "Data Principal").replace(/data fiduciary/g, "Data Fiduciary");
const tick = (b) => (b === true ? "Yes" : b === false ? "No" : "-");

// ------------------------------------------------------------------ front matter
const TITLE = "DPDP ACT SIMPLIFIER: A LOCAL RETRIEVAL-AUGMENTED ASSISTANT FOR INDIA'S DIGITAL PERSONAL DATA PROTECTION ACT, 2023";
// University logo (rendered from the official NCU-Logo.svg by scripts/report/make_figures.py)
function logo(file, widthIn) {
  const full = path.join(FIG, file);
  if (!fs.existsSync(full)) return blank();
  const { w, h, data } = pngSize(full);
  const width = Math.round(widthIn * 96), height = Math.round((width * h) / w);
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 160 },
    children: [new ImageRun({ type: "png", data, transformation: { width, height },
      altText: { title: "The NorthCap University", description: "The NorthCap University logo", name: file } })] });
}

const title = [
  blank(),
  C(TITLE, { run: { bold: true, size: 34 } }),
  C("Plain-language answers with verbatim clauses, citations and a graceful fallback, served as a FastAPI microservice", { run: { italics: true, size: 26 } }),
  blank(),
  C("A Project Report", { run: { size: 26 } }),
  C("submitted for the course", { run: { size: 24 } }),
  C("CSL374: MICROSERVICE BASED APPLICATIONS", { run: { bold: true, size: 28 } }),
  C("Project 11: Legal/Policy Document Simplifier", { run: { size: 24 } }),
  C("in partial fulfilment of the requirements for the degree of", { run: { size: 24 } }),
  C("BACHELOR OF TECHNOLOGY", { run: { bold: true, size: 28 } }),
  C("in", { run: { size: 24 } }),
  C("Computer Science and Engineering", { run: { bold: true, size: 26 } }),
  blank(),
  C("Submitted by", { run: { size: 24 } }),
  ...STUDENTS.map(([n, r]) => C(`${n} (${r})`, { run: { bold: true, size: 26 } })),
  blank(),
  C("Under the guidance of", { run: { size: 24 } }),
  C(`${GUIDE}, ${GUIDE_TITLE}`, { run: { bold: true, size: 26 } }),
  logo("ncu_logo.png", 1.7),
  C("Department of Computer Science and Engineering", { run: { size: 24 } }),
  C("The NorthCap University, Gurugram", { run: { bold: true, size: 26 } }),
  C(TERM, { run: { size: 24 } }),
];

const sigLine = (left, right, bold = false) => new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
  children: [new TextRun({ text: `${left}\t${right}`, font: FONT, size: BODY, bold })] });

const certificate = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Certificate")] }),
  P(`This is to certify that the project report entitled **“DPDP Act Simplifier: A Local Retrieval-Augmented Assistant for India's Digital Personal Data Protection Act, 2023”** submitted by **${STUDENTS.map(([n, r]) => `${n} (${r})`).join(", ").replace(/, ([^,]*)$/, " and $1")}** for the course CSL374 Microservice Based Applications, in partial fulfilment of the requirements for the award of the degree of Bachelor of Technology in Computer Science and Engineering at The NorthCap University, Gurugram, is a record of bona fide work carried out under my supervision and guidance during the ${TERM_LONG}.`),
  blank(), blank(), blank(),
  sigLine(`Place: ${PLACE}`, GUIDE, true),
  sigLine(`Date: ${DATE}`, GUIDE_TITLE),
  sigLine("", "Department of Computer Science and Engineering"),
  sigLine("", "The NorthCap University, Gurugram"),
  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("Declaration")] }),
  P("We hereby declare that the work presented in this report is our own and has not been submitted elsewhere for the award of any degree or diploma. Wherever the work of others has been used, it has been duly acknowledged and referenced. Software tools and AI coding assistants used during development are acknowledged in the Acknowledgement."),
  blank(), blank(),
  ...STUDENTS.map(([n, r], i) => sigLine(i === 0 ? `Place: ${PLACE}` : i === 1 ? `Date: ${DATE}` : "", `${n} (${r})`)),
  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("Acknowledgement")] }),
  P(`We are grateful to our project guide, **${GUIDE}**, ${GUIDE_TITLE}, Department of Computer Science and Engineering, The NorthCap University, for the guidance, feedback and encouragement given to us throughout this project. We also thank the faculty of the Department of Computer Science and Engineering for the course CSL374 Microservice Based Applications, which gave us the foundation for this work, and our families and friends for their support.`),
  P("We also acknowledge the open-source projects this work builds on, including Microsoft Phi-3, Sentence Transformers (all-MiniLM-L6-v2), FAISS, rank_bm25, LangChain, Ollama, FastAPI and pdfplumber, and the Ministry of Electronics and Information Technology for publishing the Gazette text of the Act. An AI coding assistant (Claude Code) was used to help implement and document parts of the software; all design decisions, experiments and results were reviewed by the authors."),
];

const abstractText = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("Abstract")] }),
  P("India's Digital Personal Data Protection Act, 2023 (DPDP Act) defines what organisations must do with personal data and what rights individuals have, but it is written in dense statutory language that most people cannot read with confidence. General-purpose chatbots can explain it, yet they often answer from memory, paraphrase obligations loosely and cite sections that do not exist. This project presents **DPDP Act Simplifier**, a locally-run microservice that answers questions about the Act in plain language while always showing the exact clause each answer rests on, its citation (for example *Section 8(6)*) and a fixed “not legal advice” disclaimer, and that declines questions the Act does not cover."),
  P(`The official Gazette PDF is parsed with pdfplumber using word coordinates, which separates the body text from margin titles, running headers and the bilingual masthead. The Act is chunked by its own structure into **${chunks.length} chunks** (sub-sections, definition clauses and Schedule rows) covering all ${nSections} sections and the ${nSchedule}-row penalty Schedule, each keeping its citation. Chunks are embedded with all-MiniLM-L6-v2 into a FAISS index and also indexed with BM25; the two rankings are merged by reciprocal-rank fusion. A two-stage fallback stops clearly unrelated questions with a similarity gate (no model call) and lets Phi-3-mini, served by Ollama at temperature 0.1 through a strict LangChain JSON prompt, mark the remaining ones out of scope. The verbatim clause is always copied from the index, never generated, and the cited section is chosen by comparing the answer with the retrieved clauses. The service exposes POST /ask, POST /simplify, GET /sections and GET /health with Swagger documentation, a Postman collection, a Dockerfile and a web frontend.`),
  P(`On a held-out test set of ${inScope.length} in-scope and ${oos.length} out-of-scope questions, written before any tuning, the expected clause was retrieved for **${S.retrieval_hit}** questions and cited for **${S.citation_hit}**; **${S.correct_in_scope}** answers were strictly correct after manual review (right clause, all key facts and the legal meaning preserved), and **${S.fallback_correct}** out-of-scope questions received the graceful fallback. Mean latency was ${S.mean_latency_s} s on a laptop with a 6 GB GPU. The strict score is below the 8/10 target; the failures (an added deadline, a mis-attributed citation, a right listed as a duty and one retrieval miss) are analysed in detail.`),
  P("**Keywords:** retrieval-augmented generation, legal text simplification, small language models, Phi-3, FAISS, BM25, FastAPI, microservices, DPDP Act 2023."),
];

const toc = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("Table of Contents")] }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
];

// ------------------------------------------------------------------ chapters
const ch1 = [
  ...H1("Introduction", 1),
  H2("1.1 Background"),
  P("The Digital Personal Data Protection Act, 2023 [1] is India's first comprehensive data-protection law. It applies to almost every organisation that handles digital personal data of people in India, sets duties for those organisations (called *Data Fiduciaries*), grants rights to individuals (*Data Principals*), creates the Data Protection Board of India and prescribes penalties of up to ₹250 crore. Citizens, students and small businesses increasingly need to know what it says, but the Act is drafted in legal language: long sentences, nested sub-clauses, cross-references and modal verbs (*shall*, *shall not*, *may*) whose exact force matters."),
  P("Large language models (LLMs) can rewrite such text in plain words, but when they answer from memory they may invent provisions, merge separate clauses or weaken an obligation. Studies of legal question answering report high hallucination rates even in commercial legal tools [12], [13]. For a law, an answer that sounds right but changes *shall* to *may* is worse than no answer."),
  H2("1.2 Problem statement"),
  P("Build a microservice that answers questions about one legal document, the DPDP Act, 2023, in plain language, and for every answer returns the verbatim clause it rests on, a correct citation and a disclaimer; that responds gracefully when a question is not covered; that runs entirely on a laptop with a small language model; and that is evaluated honestly on questions not used during development."),
  H2("1.3 Objectives"),
  numbered("Load the official Gazette PDF, clean it, and **chunk it by the Act's structure** so that every chunk keeps its section, sub-section or clause number."),
  numbered("Run **Phi-3-mini** locally via Ollama and verify it with a smoke test."),
  numbered("Retrieve relevant clauses with **all-MiniLM-L6-v2** embeddings in **FAISS** (plus BM25), and generate a direct answer and a plain-language rewrite with **LangChain** at temperature 0 to 0.2."),
  numbered("Always return the **verbatim clause**, the **citation** and a fixed **disclaimer**; return a fixed **fallback** message for questions outside the Act, using a similarity threshold and a strict prompt."),
  numbered("Expose the service with **FastAPI** (POST /ask, POST /simplify, GET /health, Swagger), test it with **Postman**, and package it with a **Dockerfile**."),
  numbered("Evaluate on **10 in-scope and 3 out-of-scope** held-out questions without tuning on them, and report a failure case."),
  H2("1.4 Scope and assumptions"),
  P("The corpus is the single official text of the Act as published in the Gazette of India (21 pages). Rules made under the Act, amendments, court judgments and other laws are out of scope; questions about them should receive the fallback. All processing runs locally on a laptop with an NVIDIA RTX 4050 (6 GB). The system gives **general information, not legal advice**, and says so on every answer."),
  H2("1.5 Organisation of the report"),
  P("Chapter 2 reviews related work. Chapter 3 presents requirements and the architecture. Chapter 4 describes the implementation of each component, the API and the frontend. Chapter 5 describes the evaluation set-up and Chapter 6 reports and discusses the results, including failure cases. Chapter 7 covers safety and ethics, and Chapter 8 concludes with limitations and future work. Appendices give run instructions, the API, the test questions and the Postman collection."),
];

const ch2 = [
  ...H1("Literature Review", 2),
  H2("2.1 Retrieval-augmented generation"),
  P("Retrieval-augmented generation (RAG) [2] conditions a language model on passages retrieved from an external corpus, which improves factual accuracy and lets the system cite its sources. For a closed corpus such as a single statute, RAG turns open-ended generation into reading comprehension over a few clauses, which suits small models. HyDE [11] proposes retrieving with a hypothetical answer generated by the model rather than with the raw question; it was evaluated and rejected in this project (Section 6.3)."),
  H2("2.2 Dense and sparse retrieval"),
  P("Sentence-BERT [3] fine-tunes transformer encoders so that cosine similarity between sentence embeddings reflects meaning. all-MiniLM-L6-v2 is a 22-million-parameter model distilled with MiniLM [4] and trained on over a billion sentence pairs; it is fast on a CPU and widely used for semantic search. FAISS [5] provides efficient exact and approximate nearest-neighbour search over such embeddings. Dense retrieval handles paraphrase well but can miss exact legal terms; the probabilistic BM25 ranking function [6] matches terms directly. Reciprocal-rank fusion (RRF) [7] combines several rankings by summing 1/(k + rank) and is a simple, robust way to merge dense and sparse results."),
  H2("2.3 Small language models"),
  P("Phi-3-mini [8] is a 3.8-billion-parameter model trained largely on filtered and synthetic data; it reports performance comparable to much larger models on reasoning benchmarks while fitting in a few gigabytes when quantised. Ollama [10] serves such models locally behind an HTTP API, and LangChain [9] provides prompt templates, model wrappers and output parsers that can be composed into chains. Running locally keeps questions on the user's machine and makes the service usable offline."),
  H2("2.4 Legal NLP, simplification and hallucination"),
  P("Legal NLP benchmarks such as LexGLUE [14] show that legal text is hard for general models because of its length, structure and terminology. Plain-language rewriting of legal text is a long-standing goal of the plain-language movement, but automatic simplification risks dropping conditions or changing the force of an obligation. Dahl et al. [12] found that general LLMs hallucinate frequently on questions about legal cases, and Magesh et al. [13] found that even retrieval-based commercial legal research tools produce incorrect or mis-grounded answers in a substantial share of queries. Both results argue for showing the original text next to any rewrite and for refusing when the source does not answer."),
  H2("2.5 Research gap"),
  P("Most public demos of “chat with a PDF” chunk documents by fixed character windows, so they cannot cite a section; they let the model generate the quoted text, so the quote itself can be wrong; and they rarely measure refusal behaviour or report failures. This project addresses these points for one statute: structure-aware chunks that carry citations, a verbatim clause copied from the index, a two-stage fallback, and an evaluation on held-out questions with manual review of meaning preservation."),
];

const stack = [
  ["PDF parsing", "pdfplumber (word coordinates), pypdf"],
  ["Chunking", "Custom parser in `src/ingest.py` (regular expressions over cleaned lines)"],
  ["Embeddings", "Sentence Transformers `all-MiniLM-L6-v2` (CPU, normalised), via `langchain-huggingface`"],
  ["Indexes", "FAISS (inner product on unit vectors = cosine), rank_bm25"],
  ["Language model", "Phi-3-mini (3.8B, Q4_0) served by Ollama 0.40; LangChain `ChatOllama`, `ChatPromptTemplate`, `JsonOutputParser`"],
  ["API", "FastAPI, Pydantic, Uvicorn; Swagger UI at /docs"],
  ["Frontend", "Plain HTML, CSS and JavaScript served by FastAPI; self-hosted fonts"],
  ["Testing", "pytest (13 tests), Postman collection (9 requests with test scripts)"],
  ["Packaging", "Dockerfile (python:3.11-slim, model and index baked in, non-root user, health check)"],
];

const ch3 = [
  ...H1("System Requirements and Design", 3),
  H2("3.1 Functional requirements"),
  bullet("Accept a free-text question and return a direct answer, a plain-language rewrite, the verbatim clause(s), the citation(s) and the disclaimer."),
  bullet("Return the fixed fallback message, with no citation, when the Act does not answer the question."),
  bullet("Simplify any section, sub-section, clause or the Schedule on request (for example “8(6)”, “Section 17(1)(a)”)."),
  bullet("List the Act's sections and report service health (model reachable, model pulled, index loaded)."),
  bullet("Reject invalid input (422), unknown sections (404) and report an unavailable model (503) with a recovery hint."),
  H2("3.2 Non-functional requirements"),
  bullet("**Faithfulness:** the quoted clause must be exactly the Act's text; obligations must keep their force."),
  bullet("**Local and offline:** no external API calls at question time; runs on a 6 GB laptop GPU or CPU."),
  bullet("**Repeatability:** temperature 0.1 and a fixed seed; every reported number regenerated from saved results."),
  bullet("**Latency:** a few seconds per answer; clearly unrelated questions answered in under a second."),
  bullet("**Microservice conventions:** stateless HTTP API, health endpoint, configuration through environment variables, container image."),
  H2("3.3 Architecture"),
  P("The system has an offline ingestion stage and an online request path (Figure 3.1). Ingestion turns the Gazette PDF into structured chunks and builds a FAISS index and a BM25 index. At request time the question is retrieved against both indexes, passed through a similarity gate, answered by Phi-3-mini through a LangChain chain, and post-processed: the cited section is chosen by similarity between the answer and the retrieved clauses, and the verbatim clause is attached from the index."),
  ...figure("architecture.png", "System architecture: offline ingestion and the online /ask request path", 6.2),
  H2("3.4 Design principles"),
  numbered("**The quote is never generated.** The `original_clause` field is copied from the chunk store, so the law shown to the user cannot be hallucinated, whatever the model writes.", 2),
  numbered("**Cite only what was retrieved.** Citations are restricted to retrieved clauses and re-attributed by embedding similarity, because a small model tends to cite everything it is shown.", 2),
  numbered("**Refuse in two stages.** A cheap similarity gate stops obviously unrelated questions without calling the model; the model itself must then confirm that the clauses answer the question.", 2),
  numbered("**Tune on dev, report on test.** Prompts, k and the threshold were chosen only on a separate development set; the test set was written before tuning and never used to adjust anything.", 2),
  H2("3.5 Technology stack"),
  ...table("Technology stack by layer", ["Layer", "Technologies"], stack, [1, 3], 2),
  H2("3.6 Hardware and environment"),
  P("Development and all experiments ran on a laptop with an NVIDIA RTX 4050 (6 GB VRAM), Windows 11, Python 3.11 and Ollama 0.40.17 serving `phi3:mini` (3.8B parameters, 4-bit Q4_0). Embeddings run on the CPU with PyTorch 2.5.1 (CPU build); the language model uses the GPU through Ollama."),
];

const chapterRows = Object.entries(byChapter).map(([k, v]) => [titleCase(k), v]);
const apiRows = [
  ["GET /health", "–", "status, Ollama reachable, model pulled, index loaded, chunk count, model names"],
  ["GET /sections", "–", "44 sections + Schedule with title, chapter and sub-section citations"],
  ["POST /ask", "`{\"question\": \"...\"}`", "answer, plain_language, original_clause, sections, disclaimer, fallback, fallback_reason, retrieved[], latency_s"],
  ["POST /simplify", "`{\"section\": \"8(6)\"}`", "section, title, original_clause, plain_language, key_points, disclaimer, latency_s"],
];

const ch4 = [
  ...H1("Implementation", 4),
  H2("4.1 PDF extraction and cleaning"),
  P("The Act is downloaded from the official Gazette PDF published by MeitY. A plain text dump of this PDF mixes three things that must be separated: the body of the law, the **marginal notes** that the Gazette prints beside each section as its title (on the left of odd pages and the right of even pages), and noise such as the running header, the bilingual masthead and the signature block. pdfplumber exposes every word with its coordinates, so extraction works on positions rather than on raw text: words whose x-position lies in the body column (roughly 110 to 481 points) form the body; words outside it are grouped into marginal titles and attached to the nearest section; everything above a header cut-off at the top of each page is dropped. In the penalty Schedule, a second column (x ≥ 400) holds the penalty amount and is read separately so each row keeps its “breach” and “penalty” together."),
  P("Cleaning then normalises quotes and dashes, removes private-use glyphs and replacement characters left by the PDF fonts, strips cross-references from marginal titles, and drops the signature block below the Schedule. Several parser defects were found and fixed during development, each now covered by a test: a cross-reference glued to a section title, the Schedule column boundary placed too far right, a roman numeral “(i)” mistaken for a clause letter, a missing space in “(1)A”, and decorative glyphs."),
  H2("4.2 Structure-aware chunking"),
  P("Parsing starts at “CHAPTER I”, tracks the current chapter and splits the text at each numbered section. Within a section, a line that starts with a bracketed number such as “(1)” is treated as a new sub-section and accepted only if they continue the sequence (1), (2), (3) …, which avoids splitting on references such as “sub-section (5) of section 8” in running text. Section 2 (Definitions) is split into its lettered clauses so that each defined term is its own chunk (for example *Section 2(f)* for “child”). Each Schedule row becomes one chunk."),
  P(`Parts longer than 1,500 characters (Sections 7, 17(1) and 40(2)) are split by clause, and each clause chunk keeps the lead-in sentence of its sub-section so that it still reads as law. Each chunk stores its id, section, sub-section, citation label, title, chapter, text and pages. The result is **${chunks.length} chunks** with a median length of ${median(lens)} characters and a maximum of ${lens.at(-1)} (Figure 4.1, Table 4.1).`),
  ...figure("chunk_lengths.png", "Distribution of chunk lengths after structure-aware chunking", 5.6),
  ...table("Chunks per chapter", ["Chapter", "Chunks"], chapterRows, [4, 1]),
  P("For embedding, each chunk is prefixed with its citation, title and chapter (`embedding_text`), so a question that uses the section's own words (“grievance redressal”, “processing of children's data”) can match on the title even when the clause text is short."),
  H2("4.3 Embeddings and indexes"),
  P("Chunks are embedded with all-MiniLM-L6-v2 on the CPU with normalised vectors and stored in a FAISS index using maximum inner product, so scores are cosine similarities in [−1, 1]. A BM25 index over lower-cased word tokens is built at API start-up from the same chunks. Both are loaded once in the FastAPI lifespan handler so the first request does not pay the loading cost."),
  H2("4.4 Hybrid retrieval"),
  P("For each question, the top 20 dense results and the top 20 BM25 results are merged with reciprocal-rank fusion and the best six are kept:"),
  C("RRF(d) = Σ over rankings r of 1 / (60 + rank_r(d)),   k = 6", { run: { italics: true } }),
  P("If the question names a section explicitly (“What does Section 9 say about tracking?”), the named clauses are looked up directly and placed first. The dense cosine score of each retrieved clause is kept for the similarity gate and returned to the client for transparency."),
  H2("4.5 Similarity gate and answer prompt"),
  P(`If the best dense cosine score is below **${S.sim_threshold}**, the service returns the fallback immediately without calling the model. Otherwise the six clauses are numbered with their citation labels and passed to Phi-3-mini through a LangChain chain (\`ChatPromptTemplate | ChatOllama | JsonOutputParser\`) with \`format="json"\`, temperature ${S.temperature}, seed 42, a 4,096-token context and at most 600 output tokens. The system prompt states the rules the model must follow:`),
  quote("Use ONLY the numbered clauses in CONTEXT. Keep the legal meaning exactly. Keep every condition, exception and time limit. Keep “shall” as must, “shall not” as must not, “may” as may. If the clause says “as may be prescribed”, say the details will be set by government rules. Never add details the clause does not state. Cite only the one or two clauses that actually contain the answer. If CONTEXT does not answer the question, set “in_scope” to false."),
  P("The model must reply with four JSON keys: `in_scope`, `answer`, `plain_language` and `sections`. If `in_scope` is false, or the answer is empty, the fixed fallback message is returned:"),
  quote("I don't have information on that. It is not covered in the Digital Personal Data Protection Act, 2023."),
  H2("4.6 Citation attribution"),
  P("In early tests Phi-3-mini listed every clause it had been shown as a source. The service therefore re-attributes citations itself: the generated answer and rewrite are embedded and compared with each retrieved clause; the most similar clause becomes the primary citation, and other clauses within a margin of 0.06 are kept only if the model also cited them, up to two citations in total. The verbatim text of the chosen clauses is then attached as `original_clause`, prefixed with its citation label."),
  H2("4.7 Section simplification"),
  P("POST /simplify accepts flexible references (“8”, “8(6)”, “Section 17(1)(a)”, “Schedule”) and resolves them to one or more chunks; unknown references return 404 with a helpful message such as “Section 99 does not exist. The Act has sections 1-44.” A separate prompt asks for a plain-language rewrite and a short list of key points, explains the defined terms (Data Fiduciary, Data Principal, Board) and repeats the modality rules."),
  H2("4.8 FastAPI microservice"),
  P("The API is defined with Pydantic request and response models, so Swagger documentation at /docs is generated automatically. CORS is enabled for the frontend and for tools. Configuration is read from environment variables (`OLLAMA_BASE_URL`, `LLM_MODEL`, `TOP_K`, `SIM_THRESHOLD`, `LLM_TEMPERATURE`, `USE_HYDE`), which lets the same image run on a laptop or in a container that reaches Ollama on the host."),
  ...table("REST API", ["Method and path", "Body", "Returns"], apiRows, [1.4, 1.3, 3.2], 3),
  H2("4.9 Web frontend"),
  P("A single-page frontend is served by the same FastAPI app at `/`. It is plain HTML, CSS and JavaScript with self-hosted fonts, so it works offline. The left rail lists all 44 sections and the Schedule as numbered cells under their chapters, with a filter; clicking a cell simplifies that section. The main column has the question box and example questions (including one outside the Act). Each result shows the citation as its headline, the direct answer, and the plain-language rewrite and the Act's verbatim words side by side. Every *must / shall*, *must not / shall not* and *may / can* is underlined (solid, double or dashed) in both columns; hovering one highlights every mark of the same force, and a small ledger counts them per column, so a changed obligation is easier to notice. Fallbacks show a NOT COVERED stamp with the closest clauses that were checked. The visual style is a deliberately plain printed-reference look (warm paper, black ink, serif headings, one accent colour)."),
  ...figure("ui_answer.png", "Answer view for a data-breach question: Section 8(6) as the headline, plain words beside the verbatim clause", 6.0),
  ...figure("ui_not_covered.png", "Graceful fallback for a question about the IT Act, with the closest clauses that were checked", 6.0),
  P("On narrow screens the section rail folds into a disclosure above the question box and the two columns stack, with the plain words above the Act's text (Figure 4.4)."),
  ...figure("ui_mobile.png", "The answer to the consent-withdrawal question, Section 6(4), on a phone-sized screen", 2.6),
  H2("4.10 Testing and packaging"),
  P("Thirteen pytest tests run without Ollama: all 44 sections are parsed in order; no Gazette noise remains; the Schedule penalties are parsed; sub-section and clause chunks are correct; section references resolve (including the 404 case); the similarity gate skips the model for out-of-scope questions; an explicit section reference is retrieved; the API contract holds with a stubbed model; and the dev and test question files do not overlap. A Postman collection of nine requests with test scripts covers health, sections, three in-scope questions, the IT Act fallback, a validation error, simplification of 8(6) and an unknown section; run against the live service, all " + RS.assertions_passed + " of its " + RS.assertions_total + " checks passed (Appendix D). The Dockerfile builds on python:3.11-slim, bakes in the embedding model and rebuilds the index at build time, runs as a non-root user and defines a health check; Ollama stays on the host and is reached at `host.docker.internal`."),
];

const ch5 = [
  ...H1("Experimental Setup", 5),
  H2("5.1 Corpus"),
  P(`The only source document is the Gazette of India text of the Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023), 21 pages. Ingestion yields ${nSections} sections in 9 chapters plus the Schedule, giving ${chunks.length} chunks (Section 4.2).`),
  H2("5.2 Development and test sets"),
  P(`Two disjoint question sets were written from the Act. The **development set** (${dev.in_scope.length} in-scope and ${dev.out_of_scope.length} out-of-scope questions) was the only set used to choose the similarity threshold, k, the retrieval method and the prompt wording. The **test set** (${questions.in_scope.length} in-scope and ${questions.out_of_scope.length} out-of-scope questions, Appendix C) was written before any tuning, with the expected section(s) and the key facts each answer must contain, and was never used to change the system. Questions are phrased as a member of the public would ask them, not in the Act's wording; a pytest check enforces that the two files share no questions.`),
  H2("5.3 Protocol and metrics"),
  P("Each test question is sent to the running service once with the final configuration, and the full response is saved. Automatic metrics are computed from the saved run; each answer is then read against the Act by hand, and the manual verdict is stored with a copy of the reviewed text, so it applies only while the output is exactly what was reviewed (a re-run that changes the text shows “unreviewed”)."),
  ...table("Evaluation metrics", ["Metric", "Definition"], [
    ["Retrieval hit", "An expected clause is among the six retrieved clauses"],
    ["Citation hit", "An expected clause is among the cited sections"],
    ["Key-fact check (automatic)", "Every key fact (e.g. “eighteen”, “Appellate Tribunal”) appears in the answer or rewrite"],
    ["Meaning preserved (manual)", "The rewrite keeps the clause's conditions, actors and the force of every modal verb, and adds nothing"],
    ["Strictly correct", "Citation hit, key facts present and meaning preserved"],
    ["Fallback correct", "An out-of-scope question receives the fixed fallback with no citation"],
    ["Latency", "Wall-clock time of POST /ask, measured by the service"],
  ], [1.4, 3], 2),
  H2("5.4 Configuration"),
  P(`Final configuration: \`${S.model}\`, \`${S.embed_model}\`, hybrid retrieval with k = ${S.top_k}, similarity threshold ${S.sim_threshold}, temperature ${S.temperature}, seed 42, HyDE off. The evaluation run reported here was made on ${S.run_at.replace("T", " at ")}.`),
];

const testRows = rows.map((r) => [r.id, r.expected, r.cited || "–", tick(r.retrieval_hit), tick(r.citation_hit), r.facts || "–", tick(r.meaning_preserved), r.correct ? "Yes" : "No", `${r.latency_s < 0.1 ? r.latency_s.toFixed(2) : r.latency_s.toFixed(1)} s`]);

const sample = (id) => raw[id];
const s1 = sample("T3"), s2 = sample("T1"), s3 = sample("T4");

const ch6 = [
  ...H1("Results and Discussion", 6),
  H2("6.1 Data pipeline (DoD 1)"),
  P(`Ingestion parsed **all ${nSections} sections in order** and the **${nSchedule} Schedule rows**, producing ${chunks.length} chunks with citations; the full list of sections with their titles and pages, and sample chunks, is saved as evidence (\`evidence/dod1_ingest_output.txt\`). Every section title was recovered from the margin notes, and the tests confirm that no running headers, masthead text or signature lines remain in any chunk.`),
  H2("6.2 Language model smoke test (DoD 2)"),
  P("A smoke-test script checks that Phi-3-mini is reachable through Ollama and answers basic prompts. All three prompts passed: a one-word factual question (8.0 s, including model load), an arithmetic question (0.1 s) and a one-sentence definition of personal data (0.5 s)."),
  H2("6.3 Design decisions made on the development set"),
  ...table("Decisions taken on the development set only", ["Change", "Development-set effect", "Decision"], [
    ["Dense retrieval → hybrid (dense + BM25, RRF)", "Recall@6 5/8 → 6/8", "Adopted"],
    ["HyDE query expansion", "Recall@6 6/8 → 5/8", "Rejected (kept behind USE_HYDE=1)"],
    ["Similarity threshold alone for refusals", "An IPC question scored 0.52, above some in-scope questions", "Threshold kept low (0.25) + model in_scope check"],
    ["Model's own citations", "Listed every retrieved clause", "Replaced by embedding attribution"],
    ["Prompt rules on modality and “as may be prescribed”", "Fewer weakened obligations in rewrites", "Adopted"],
  ], [2.2, 2, 1.8], 3),
  P("The main lesson was that a similarity threshold cannot by itself separate questions about the Act from questions about neighbouring laws: a question about the Indian Penal Code shares vocabulary with the Act's penalty provisions and scores higher than some genuine questions. The threshold was therefore set low, only to stop clearly unrelated questions cheaply, and the decision for borderline questions was given to the model with an explicit `in_scope` field."),
  H2("6.4 Held-out test results (DoD 3)"),
  ...table("Held-out test set: per-question results", ["ID", "Expected", "Cited", "Retr.", "Cite", "Facts", "Meaning", "Correct", "Time"], testRows, [0.5, 1.5, 1.6, 0.55, 0.55, 0.6, 0.75, 0.75, 0.65], 3),
  ...figure("eval_funnel.png", "Held-out results from retrieval to strict correctness, against the DoD 3 target", 5.6),
  P(`The expected clause was retrieved for ${S.retrieval_hit} questions and cited for ${S.citation_hit}. The automatic key-fact check passed ${S.auto_pass}, and after manual review **${S.correct_in_scope} answers were strictly correct**. All ${S.fallback_correct} out-of-scope questions received the fallback. **The DoD 3 target of 8/10 was not met.** The stages lose one question each: one retrieval miss (T9), one wrong citation despite correct content (T5), one answer that lists the wrong facts (T8) and one rewrite that adds a detail the Act does not contain (T2).`),
  H2("6.5 Retrieval scores and the similarity gate"),
  ...figure("top_scores.png", "Best dense cosine score per test question, with the similarity gate", 5.8),
  P("Figure 6.2 shows why both fallback stages are needed. The two clearly unrelated questions (GST, income-tax filing) score 0.20 and 0.23 and are stopped by the gate in about 0.02 s. The IT Act question (O1) scores 0.45, as high as several in-scope questions, because the Act itself mentions the IT Act (Section 44 amends it) and has a penalty Schedule; the gate passes it, and Phi-3-mini correctly reports that the retrieved clauses do not answer it. The score also does not predict correctness: the two highest-scoring questions (T8 and T2) were both answered wrongly."),
  H2("6.6 Latency"),
  ...figure("latency.png", "Latency per test question", 5.8),
  P(`Mean latency over the 13 questions was ${S.mean_latency_s} s. The first request (T1, 15.7 s) includes loading Phi-3-mini into GPU memory; with the model loaded, answered questions took a median of ${median(warmLat).toFixed(1)} s (range ${warmLat[0].toFixed(1)} to ${warmLat.at(-1).toFixed(1)} s). Questions stopped by the gate return in about 20 ms.`),
  H2("6.7 Sample outputs"),
  P(`**1. “${s1.question}”** → \`${s1.sections.join(", ")}\``),
  quote(`Answer: ${s1.answer}  Plain words: ${s1.plain_language}`),
  P(`**2. “${s2.question}”** → \`${s2.sections.join(", ")}\``),
  quote(`Answer: ${s2.answer}  Plain words: ${s2.plain_language}`),
  P(`**3. “${s3.question}”** → \`${s3.sections.join(", ")}\``),
  quote(`Answer: ${s3.answer}  Plain words: ${s3.plain_language}`),
  P("In each case the response also carries the verbatim clause, the six retrieved clauses with scores and the disclaimer. All three keep the condition that matters: withdrawal must be as easy as giving consent (sample 1), “not completed eighteen years” (sample 2), and “may extend to” ₹250 crore as a maximum rather than a fixed fine (sample 3). Short rewrites do not always do this; in an earlier run of the consent question the plain-language version dropped the ease-of-withdrawal condition, which the verbatim clause beside it still carried."),
  ...figure("ui_simplify.png", "Simplifying Section 8(6): key points, plain words and the verbatim clause", 6.0),
  H2("6.8 Failure analysis"),
  P("**T2: an added deadline.** Asked what an organisation must do after a breach, the system cited the right clause, 8(6), but the rewrite said the organisation must inform the Board and affected people *promptly*. Section 8(6) sets no timing; it says intimation shall be given “in such form and manner as may be prescribed”. Adding “promptly” changes the law, so the answer was marked incorrect despite passing the automatic check."),
  P("**T5: correct content, wrong citation.** The answer listed the contents of the consent notice correctly (Section 5(1)) but was attributed to 6(10), which concerns proving that notice was given. Embedding attribution chose the clause most similar to the answer's wording rather than the clause that contains it."),
  P("**T8: a right listed as a duty.** Asked about the duties of a Data Principal (Section 15), the model listed grievance redressal, which is a right under Section 13, and omitted the duties not to impersonate and not to file false grievances."),
  P("**T9: retrieval miss, safe refusal.** “Can my personal data be sent to other countries?” is answered by Section 16(1), which uses the words “transfer … outside India”. The question shares almost no words with it and Section 16 was not in the top six. The model then correctly said the clauses did not answer the question and returned the fallback: safe, but unhelpful. Asking with the Act's wording retrieves 16(1); HyDE, tried as a fix on the development set, lowered recall overall."),
  P("**Simplifying a whole section: a meaning flip.** In one run, simplifying all of Section 6 produced a rewrite saying consent “cannot be withdrawn easily”, the opposite of 6(4). Long inputs give the small model more chances to merge clauses. This is the main reason the verbatim clause is always shown beside the rewrite, and why simplifying a sub-section is recommended over a whole section."),
  H2("6.9 Definition of Done"),
  ...table("Status against the Definition of Done", ["DoD item", "Marks", "Evidence", "Status"], [
    ["1. Data pipeline loads, cleans, chunks with section numbers", "3", "`src/ingest.py`, ingest output, tests", "Done"],
    ["2. Phi-3-mini via Ollama answers a test prompt", "3", "Smoke test, 3/3 passed", "Done"],
    ["3. ≥ 8/10 correct clause + meaning-preserving rewrite", "5", "`eval/results.md`", `Not met: ${S.correct_in_scope} strict, ${S.auto_pass} automatic`],
    ["4. FastAPI endpoint tested in Postman", "5", "`src/api.py`, Postman collection, `evidence/api/postman_replay.json`", `Done: ${RS.requests} requests, ${RS.assertions_passed}/${RS.assertions_total} checks passed (Appendix D)`],
    ["5. README + 5-minute demo + failure case with fallback", "4", "README (with demo script), screenshots, failure write-ups", "Done"],
  ], [2.6, 0.6, 1.8, 1.6], 1),
  H2("6.10 Discussion"),
  P("Three observations stand out. First, **retrieval was not the main bottleneck**: the right clause was found for 9 of 10 questions, but only 6 answers were fully faithful. The remaining errors come from the generation step, where a 3.8B model adds plausible details, confuses neighbouring provisions or picks the wrong source. Second, **refusal needs the model**: a similarity threshold separates unrelated topics but not neighbouring laws, and the model's explicit `in_scope` judgement handled the hard IT Act case. Third, **showing the verbatim clause is the most important safeguard**: every observed error (an added word, a wrong citation, a merged clause) is visible to a reader who compares the rewrite with the Act's own words beside it."),
];

const ch7 = [
  ...H1("Safety, Privacy and Ethics", 7),
  bullet("**Not legal advice:** every answer and every simplification carries a fixed disclaimer, and the interface repeats it; the system never tells a user what they should do."),
  bullet("**Verbatim source:** the law shown to the user is copied from the official text and cannot be altered by the model; users are encouraged to read it beside the rewrite."),
  bullet("**Honest refusal:** questions outside the Act get a fixed fallback with no citation, rather than an answer drawn from the model's general knowledge."),
  bullet("**Local processing:** questions are processed on the user's machine; no question or answer is sent to an external service."),
  bullet("**Known risks stated:** the evaluation reports failures that change the meaning of the law (an added deadline, a right listed as a duty) and a documented meaning flip, so users and examiners know what the system can get wrong."),
  bullet("**Scope:** only the 2023 Act is covered; rules notified later, amendments and case law are not, and answers about “prescribed” details correctly defer to government rules."),
];

const ch8 = [
  ...H1("Conclusion and Future Work", 8),
  H2("8.1 Conclusion"),
  P(`DPDP Act Simplifier shows that a small local model can explain a statute usefully when it is constrained by good retrieval and by guarantees that do not depend on the model: a verbatim clause copied from the index, citations restricted to retrieved clauses, and a two-stage fallback. The structure-aware parser gives every chunk a real citation, hybrid retrieval found the right clause for ${S.retrieval_hit} held-out questions, and all out-of-scope questions were declined gracefully. Strict correctness was ${S.correct_in_scope}, below the target, and the failures show where the remaining risk lies: in the wording the model generates, not in the law it is shown.`),
  H2("8.2 Limitations"),
  bullet("Strict correctness of 6/10 on a small test set (13 questions); the estimate is uncertain."),
  bullet("Phi-3-mini sometimes adds details, confuses rights and duties, or picks a neighbouring clause as the citation."),
  bullet("Paraphrased questions that share no words with the Act can miss the right clause (T9)."),
  bullet("The modality ledger in the interface is a coarse aid; it counts words and cannot verify meaning."),
  bullet("The Docker image was written but not built on the development machine, which has no Docker installation."),
  H2("8.3 Future work"),
  bullet("Add a verification step that checks each sentence of the rewrite against the cited clause (entailment or a second model pass) and flags added numbers, deadlines or modal changes."),
  bullet("Improve recall for paraphrases with a legal-domain query rewriter or a small synonym map (“sent to other countries” → “transfer outside India”)."),
  bullet("Attribute citations by span overlap as well as embedding similarity."),
  bullet("Extend the corpus to the DPDP Rules once notified, and to related laws, with per-document citations."),
  bullet("Evaluate on a larger question set with several reviewers, and compare larger local models within the same hardware budget."),
];

const refs = [
  "Government of India, The Digital Personal Data Protection Act, 2023 (No. 22 of 2023), The Gazette of India, Extraordinary, Part II, Section 1, 11 August 2023.",
  "P. Lewis et al., “Retrieval-augmented generation for knowledge-intensive NLP tasks,” in Proc. NeurIPS, 2020.",
  "N. Reimers and I. Gurevych, “Sentence-BERT: Sentence embeddings using Siamese BERT-networks,” in Proc. EMNLP-IJCNLP, 2019.",
  "W. Wang et al., “MiniLM: Deep self-attention distillation for task-agnostic compression of pre-trained transformers,” in Proc. NeurIPS, 2020.",
  "J. Johnson, M. Douze and H. Jégou, “Billion-scale similarity search with GPUs,” IEEE Trans. Big Data, vol. 7, no. 3, pp. 535–547, 2021.",
  "S. Robertson and H. Zaragoza, “The probabilistic relevance framework: BM25 and beyond,” Foundations and Trends in Information Retrieval, vol. 3, no. 4, pp. 333–389, 2009.",
  "G. V. Cormack, C. L. A. Clarke and S. Büttcher, “Reciprocal rank fusion outperforms Condorcet and individual rank learning methods,” in Proc. ACM SIGIR, 2009.",
  "M. Abdin et al., “Phi-3 technical report: A highly capable language model locally on your phone,” arXiv:2404.14219, 2024.",
  "LangChain, open-source framework, https://github.com/langchain-ai/langchain.",
  "Ollama, https://ollama.com.",
  "L. Gao, X. Ma, J. Lin and J. Callan, “Precise zero-shot dense retrieval without relevance labels,” in Proc. ACL, 2023.",
  "M. Dahl, V. Magesh, M. Suzgun and D. E. Ho, “Large legal fictions: Profiling legal hallucinations in large language models,” Journal of Legal Analysis, vol. 16, no. 1, pp. 64–93, 2024.",
  "V. Magesh et al., “Hallucination-free? Assessing the reliability of leading AI legal research tools,” arXiv:2405.20362, 2024.",
  "I. Chalkidis et al., “LexGLUE: A benchmark dataset for legal language understanding in English,” in Proc. ACL, 2022.",
  "S. Ramírez, FastAPI, https://fastapi.tiangolo.com.",
  "J. Singer-Vine, pdfplumber, https://github.com/jsvine/pdfplumber.",
];
const references = [
  ...H1("References", 0),
  ...refs.map((r, i) => new Paragraph({ children: runs(`[${i + 1}] ${r}`, { size: 22 }), spacing: { after: 100 }, indent: { left: 567, hanging: 567 } })),
];

const appendix = [
  ...H1("Appendix A: Running the Project", 0, "A"),
  P("Requirements: Python 3.11 and Ollama. From the repository root (on Windows, keep the virtual environment on a short path to avoid the 260-character limit when torch loads its DLLs):"),
  ...code([
    "ollama pull phi3:mini",
    "py -3.11 -m venv .venv",
    ".venv\\Scripts\\python -m pip install -r requirements.txt",
    ".venv\\Scripts\\python -m src.ingest              (chunk the Act, build the index)",
    ".venv\\Scripts\\python -m scripts.smoke_test_slm  (DoD 2)",
    ".venv\\Scripts\\python -m pytest -q               (13 tests, no Ollama needed)",
    ".venv\\Scripts\\python -m uvicorn src.api:app --port 8000",
  ]),
  P("Open http://localhost:8000 for the frontend or http://localhost:8000/docs for Swagger. Evaluation: `python -m eval.run_eval` (live) or `python -m eval.run_eval --report-only eval/results_run1.json` (re-score the saved run). Report figures: `python -m scripts.report.make_figures`, then `node docs/deliverables/build_report.js`. Docker (Ollama on the host):"),
  ...code([
    "docker build -t dpdp-simplifier .",
    "docker run --rm -p 8000:8000 --add-host=host.docker.internal:host-gateway dpdp-simplifier",
  ]),
  ...H1("Appendix B: API Errors", 0, "B"),
  ...table("Error responses", ["Status", "When", "Example message"], [
    ["422", "Question shorter than 3 characters or malformed body", "Pydantic validation detail"],
    ["404", "Unknown section in /simplify", "Section 99 does not exist. The Act has sections 1-44."],
    ["503", "Ollama not running or model not pulled", "Recovery hint: start `ollama serve`, then `ollama pull phi3:mini`"],
  ], [0.7, 2.3, 3], 3),
  ...H1("Appendix C: Test Questions", 0, "C"),
  ...table("Held-out test questions (written before tuning)", ["ID", "Question", "Expected"],
    rows.map((r) => [r.id, r.question, r.expected]), [0.5, 4, 1.5], 2),
  ...H1("Appendix D: Postman Collection", 0, "D"),
  ...table("Requests in postman/DPDP_Simplifier.postman_collection.json", ["Request", "Method and path", "Checks"], [
    ["Health", "GET /health", "200; status ok; phi3:mini available; more than 100 chunks"],
    ["Sections (table of contents)", "GET /sections", "200; 45 entries; Section 8 title"],
    ["Ask: consent withdrawal (in scope)", "POST /ask", "200; not a fallback; cites Section 6(4); verbatim clause; rewrite; disclaimer"],
    ["Ask: who is a child (in scope)", "POST /ask", "200; cites Section 2(f); mentions eighteen"],
    ["Ask: maximum penalty (in scope)", "POST /ask", "200; cites Schedule, item 1; 250 crore"],
    ["Ask: IT Act penalty (out of scope)", "POST /ask", "200; fallback; says not covered; no citations"],
    ["Ask: validation error (too short)", "POST /ask", "422"],
    ["Simplify: Section 8(6)", "POST /simplify", "200; resolved citation; verbatim clause; rewrite present"],
    ["Simplify: unknown section", "POST /simplify", "404; message names sections 1-44"],
  ], [2.4, 1.4, 2.2], 3),
  P(`The collection was executed against the running service on ${RS.run_at.replace("T", " at ")} by \`scripts/replay_postman.py\`, which sends each request of the collection and applies the same checks as its Postman test scripts. **All ${RS.assertions_passed} of ${RS.assertions_total} checks passed** across the ${RS.requests} requests (Table D.2). The raw results are saved in \`evidence/api/postman_replay.json\`.`),
  ...table("Collection run results", ["Request", "Status", "Checks passed", "Time"],
    replay.results.map((r) => [r.request.replace(" - ", ": "), r.status, `${r.tests_passed}/${r.tests_total}`, `${(r.time_ms / 1000).toFixed(1)} s`]), [3.2, 0.8, 1.1, 0.9]),
];

// ------------------------------------------------------------------ assemble
const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] });
const pageProps = (fmt, start) => ({
  page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 1440, bottom: 1440, left: MARGIN_L, right: MARGIN_R },
    pageNumbers: { start, formatType: fmt } },
});

const doc = new Document({
  creator: STUDENTS.map(([n]) => n).join(", "),
  title: "DPDP Act Simplifier: A Local Retrieval-Augmented Assistant for India's DPDP Act, 2023",
  description: "CSL374 Project 11 report",
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: BODY } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 32, bold: true, color: "14223B" },
        paragraph: { spacing: { before: 0, after: 360 }, alignment: AlignmentType.CENTER, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 28, bold: true, color: "14223B" },
        paragraph: { spacing: { before: 300, after: 140 }, keepNext: true, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 24, bold: true },
        paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 567, hanging: 283 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 567, hanging: 340 } } } }] },
    ],
  },
  sections: [
    { properties: pageProps(NumberFormat.LOWER_ROMAN, 1), children: title },
    { properties: pageProps(NumberFormat.LOWER_ROMAN, 2), footers: { default: footer },
      children: [...certificate, ...abstractText, ...toc] },
    { properties: pageProps(NumberFormat.DECIMAL, 1), footers: { default: footer },
      children: [...ch1, ...ch2, ...ch3, ...ch4, ...ch5, ...ch6, ...ch7, ...ch8, ...references, ...appendix] },
  ],
});

const out = path.join(__dirname, "DPDP_Simplifier_Project_Report.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf);
  console.log(`Wrote ${out} (${(buf.length / 1024).toFixed(0)} KB)`);
});

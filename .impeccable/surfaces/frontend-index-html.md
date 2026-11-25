---
version: 1
slug: "frontend-index-html"
primary_target: "frontend/index.html"
related_targets: []
---

# Surface brief: ask + simplify workspace (frontend/index.html)

Scope: the whole web frontend (ask, simplify-by-section, section index). Mode: Operate.
Audience/job: CSL374 examiners watching a 5-minute demo on a projector in a lit room and on a laptop, then typing their own questions; by assumption also a citizen checking what the Act says. Task: ask, read the plain answer, check it against the verbatim clause, browse/simplify any section, see honest refusals.
Constraints: answers take 3-15 s (refusals under 1 s); no brand assets exist; must work offline from the FastAPI server; light ground for lit rooms. Ruled out: chatbot bubble pane beside stat cards; dark legal-tech with italic serif.
Decided without the owner (away): world, direction and stack inferred from the brief; IMPECCABLE'S PICK (Bare Act pocket edition with margin notes) is the standing alternate if they want the familiar look.

## Direction contract

THESIS: Every answer is issued like an e-stamp certificate: a citation is its serial, the verbatim clause is attached, and the plain rewrite is attested against it field by field. Refuses the chat-bubble transcript beside metric cards.

OWN-WORLD: Cool security-paper ground (pale grey-lilac, never cream), blue-black ink, and one committed field of rubber-stamp violet owning the header band, seals and focus. Security-print green appears only as a hairline guilloche rule. Hairline labelled field grid, no cards, no shadows-as-chrome. Hind (an Indian UI face) for interface and rewrite, a serif only for the law's own words, mono only for serials, scores and timings.

STORY: The visitor asks in their own words, sees the cited section as the headline, reads a plain answer, then checks it against the Act's exact words side by side; when the Act is silent, the certificate is stamped NOT COVERED.

FIRST VIEWPORT: Violet header band (name, live model status). Left rail: the whole Act as a dense numbered cell grid (1-44 + Schedule) under chapter labels, with a filter. Main: ask field and example chips at top; below it the certificate: citation headline + title/chapter + serial/latency; answer field; two columns mirrored on a centre rule, plain language left, verbatim clause right; retrieved clauses with scores; fixed disclaimer.

FORM: Operate product shell (header band + section rail + work column), candidate 5 of 7 (e-stamp paper), seed: none (unavailable). Raises: line-form state from operate-c-emission-line-rail (modal verbs marked solid = must/shall, double = must not/shall not, dashed = may); whole-cell index from pop-culture-shelf-doujin-event-catalog (all 45 entries visible at once, no accordion); number-as-headline from brand-identity-canon-saville-catalog-sleeve (citation is the answer's headline); hairline module discipline from japanese-high-density-web; mirrored columns on one centre rule from notation-diagram-systems-labanotation. Signature interaction: Attest. Hovering or focusing a modality mark in either column lights every mark of the same force in the other column (must ⇄ shall, must not ⇄ shall not, may ⇄ may), so a changed obligation is visible at a glance. Motion grammar: state only, 160-220 ms exponential ease-out; the NOT COVERED stamp lands once with a short scale settle; reduced motion swaps instantly.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Revision, 2026-11-23: "less AI-generated"

The owner asked for the frontend to look less like it was AI-generated. The visual world above is superseded; the structure, story and Attest interaction stand.

- OWN-WORLD now: warm off-white paper (#faf8f3), near-black ink, one dark maroon accent (#7a1f1f) for links, modality underlines, the cited cell and the stamp. Noto Serif for headings and the Act's words, Hind for everything else, no mono except inline code.
- Removed: violet header band, logo mark, pill status with dot, guilloche rule, pill example chips (now underlined text links), info icon, ghost "Section —" empty skeleton (now two intro paragraphs), uppercase tracked labels, Ref/Mode serial block (now "Answered in N s"), focus halos, fade-in, pulse and stamp-bounce animations.
- Corners square or 2px; primary button and current cell are ink, not accent.
- DESIGN.md and design.json were rewritten to match; README screenshots were retaken.

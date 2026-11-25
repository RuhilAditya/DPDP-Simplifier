---
name: DPDP Act Simplifier
description: Plain answers about India's DPDP Act, 2023, laid out like a printed legal reference, with the Act's exact words beside every rewrite.
colors:
  ink: "#1c1b19"
  ink-secondary: "#45433e"
  ink-tertiary: "#6b675f"
  maroon: "#7a1f1f"
  maroon-deep: "#641818"
  maroon-wash: "#f4e8e4"
  maroon-line: "#d9b9b2"
  paper: "#faf8f3"
  paper-rail: "#f3f0e8"
  paper-deep: "#ebe7dc"
  sheet: "#ffffff"
  rule: "#dedad0"
  rule-strong: "#b5b0a4"
  match-yellow: "#f3e3a6"
  same-green: "#2f5d3a"
  green-wash: "#e3ecdf"
  caution-amber: "#7a5000"
  amber-wash: "#f4ead2"
  error-red: "#a3262b"
typography:
  citation:
    fontFamily: "Noto Serif, Georgia, serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.1
  heading:
    fontFamily: "Noto Serif, Georgia, serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.25
  brand:
    fontFamily: "Noto Serif, Georgia, serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.1
  answer:
    fontFamily: "Hind, Segoe UI, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.5
  body-large:
    fontFamily: "Hind, Segoe UI, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Hind, Segoe UI, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "tnum"
  law:
    fontFamily: "Noto Serif, Georgia, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  small:
    fontFamily: "Hind, Segoe UI, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Hind, Segoe UI, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 600
rounded:
  none: "0"
  hairline: "2px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
components:
  header:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    height: "64px"
    padding: "0 32px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.hairline}"
    padding: "0 32px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "#000000"
    textColor: "{colors.sheet}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.hairline}"
    padding: "0 12px"
    height: "36px"
  input-ask:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body-large}"
    rounded: "{rounded.hairline}"
    padding: "0 16px"
    height: "50px"
  input-filter:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.hairline}"
    padding: "0 12px"
    height: "40px"
  example-link:
    backgroundColor: "transparent"
    textColor: "{colors.maroon-deep}"
  chip-citation:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "30px"
  section-cell:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "36px"
  section-cell-current:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  result-frame:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  result-field:
    backgroundColor: "{colors.sheet}"
    padding: "24px 32px"
  law-column:
    backgroundColor: "{colors.paper}"
    typography: "{typography.law}"
    padding: "24px 32px"
  stamp-not-covered:
    backgroundColor: "transparent"
    textColor: "{colors.maroon}"
    rounded: "{rounded.hairline}"
    padding: "10px 18px 8px"
  ledger-flag-differs:
    backgroundColor: "{colors.amber-wash}"
    textColor: "{colors.caution-amber}"
    rounded: "{rounded.none}"
    padding: "1px 8px"
  ledger-flag-same:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.same-green}"
    rounded: "{rounded.none}"
    padding: "1px 8px"
---

# Design System: DPDP Act Simplifier

## Overview

**North Star: "The Printed Reference"**

The page should look like something a careful person made for reading the law, not like a chat product. That means warm off-white paper, near-black ink, serif headings, thin rules between fields, square corners, and one dark maroon accent used for links and for marking. Nothing is decorative: there is no colour band, logo badge, pill, glow, gradient or entrance animation. Every element is either text the reader needs or a rule that separates it.

The core of the page is unchanged from the first version. Each result is one ruled frame whose headline is the citation (for example "Section 8(6)"). The plain-language rewrite and the Act's verbatim text sit side by side on one centre rule, with obligation words marked by underline form. When the Act does not cover a question the frame shows a NOT COVERED stamp instead of an answer.

A 300px rail lists all 44 sections and the Schedule as numbered cells under chapter titles. The work column (up to 1180px) holds the question box and the result. Body text is 17px; nothing that carries meaning is smaller than 13px.

This version replaced an earlier purple design (violet header band, pill chips, guilloche line, monospaced serial numbers, fade-in animations) because it read as a generic AI-generated interface.

**Key Characteristics:**
- Warm paper ground (#faf8f3) and a white result sheet, separated by 1px rules, not shadows.
- Near-black ink for text, the primary button and the current section; dark maroon only for links, modality underlines, the cited section and the stamp.
- Noto Serif for headings and for the Act's own words; Hind for everything the tool itself says.
- Square or 2px corners throughout. No pills.
- Obligation force carried by underline form (solid, double, dashed), never by colour.
- No entrance animation. Only short colour and border transitions on hover.

## Colors

A warm, low-chroma paper and ink palette with one restrained accent.

### Accent
- **Maroon** (#7a1f1f): modality underlines, the border of the section cited by the latest answer, the NOT COVERED stamp, the cited row's score bar.
- **Maroon Deep** (#641818): links (example questions, citation links in "Clauses checked", the mobile Show/Hide toggle), text of lit modality marks.
- **Maroon Wash** (#f4e8e4): background behind lit modality marks during the Attest hover.
- **Maroon Line** (#d9b9b2): resting underline colour on example-question links and citation links.

### Ink
- **Ink** (#1c1b19): body text, headings, citation headline, primary button fill, current section cell, focus outline.
- **Ink Secondary** (#45433e): intro paragraphs, chapter names, retrieved clause titles.
- **Ink Tertiary** (#6b675f): labels, the model status, notes, placeholders, timings, unchosen score bars.

### Paper
- **Paper** (#faf8f3): page ground, the verbatim-law column, the obligation ledger strip.
- **Paper Rail** (#f3f0e8): the section rail.
- **Paper Deep** (#ebe7dc): the rail's sticky preview footer, score-bar tracks, filter-result hover.
- **Sheet** (#ffffff): header, result frame, inputs, section cells.
- **Rule** (#dedad0) and **Rule Strong** (#b5b0a4): field dividers and section cells; frame, inputs, header underline and the centre rule.

### Signals
- **Match Yellow** (#f3e3a6): highlighter behind matched words in the rail filter.
- **Same Green** (#2f5d3a) on **Green Wash** (#e3ecdf): only the "Same kinds of obligation in both" ledger flag.
- **Caution Amber** (#7a5000) on **Amber Wash** (#f4ead2): only the "Force differs" ledger flag.
- **Error Red** (#a3262b): error headings and a degraded or offline model status.

### Named Rules
**The Ink First Rule.** Solid fills are ink, not accent: the Ask button and the current section cell are near-black. Maroon appears as text, underline or border, never as a large fill.

**The Warm Paper Rule.** Grounds are warm off-white (#faf8f3 family), never cool grey-lilac or pure white at page level. Pure white is reserved for the sheet things are printed on.

## Typography

**Heading and Law Font:** Noto Serif (with Georgia, serif), self-hosted at 400 and 600
**Interface Font:** Hind (with Segoe UI, system-ui, sans-serif), self-hosted at 400/500/600/700
**Code Font:** JetBrains Mono, only inside inline `code` in error messages

**Character:** the serif gives the page a printed, documentary feel and is used for headings and for the Act's own words. Hind, an Indian-designed sans, carries everything the tool says: answers, rewrites, labels, controls. Section numbers, citations and scores are set in Hind with tabular figures, not in a monospace.

### Hierarchy
- **Citation** (Noto Serif 600, 32px, 1.1; 26px under 860px): the result headline, e.g. "Section 8", with the sub-reference as a 20px/400 tertiary `small`.
- **Heading** (Noto Serif 600, 23px): "Ask about the DPDP Act". The rail's "The Act" title is 600/17px.
- **Brand** (Noto Serif 600, 20px): the product name in the header, followed by the Act's full title and number in 14.5px Ink Tertiary.
- **Answer** (Hind 400, 19px, 1.5, max 62ch; 17.5px under 860px): the direct answer.
- **Body Large** (Hind 400, 18px, 1.6): the plain-words column and the ask input.
- **Body** (Hind 400, 17px, 1.6; 16px under 860px): default text, key points, intro.
- **Law** (Noto Serif 400, 16px, 1.65, max 66ch, `pre-line`): the verbatim clause. Each block is led by its citation in Hind 700/14px.
- **Small** (Hind 400, 14.5px): disclaimer, notes, chapter line.
- **Label** (Hind 600, 14.5px, sentence case, Ink Tertiary): field labels (Answer, Key points, Clauses checked, Note) in a 132px label column. No uppercase or letter-spacing.

### Named Rules
**The Two Voices Rule.** Noto Serif is for headings and the Act's words; Hind is for what the tool says. A serif sentence in body copy that is not the Act's text is a bug.

**The Citation Headline Rule.** The largest type on any result is the section reference.

## Layout

A sticky 64px white header with a 1px Rule Strong underline, then a two-column grid: a 300px rail and a fluid work column (`minmax(0, 1fr)`, capped at 1180px). The rail is sticky under the header, scrolls on its own, and ends in a sticky footer that names the hovered or focused section.

The rail shows chapter names (bold roman numeral plus title, 13.5px) over a grid of 36px cells (`auto-fill, minmax(38px, 1fr)`, 4px gaps). Typing in the filter swaps the grid for a list of matching titles with the match highlighted in Match Yellow.

The work column runs top to bottom: heading; a row with a 50px input and the Ask button (8px gap); a line of example questions as underlined links separated by middots ("For example: after a data breach · withdrawing consent · …"); the disclaimer in 14.5px Ink Tertiary; then the result 32px below. Before the first question the result area holds two short intro paragraphs explaining how the tool works.

Inside the result, each field is a row of a 132px label column and the value, 24px gap, 24px by 32px padding, separated by Rule hairlines. The side-by-side pair is a 50/50 grid with a 1px Rule Strong centre rule inset 24px top and bottom.

Spacing is a 4px scale: 4, 8, 12, 16, 24, 32, 48px.

Breakpoints:
- **1100px:** rail narrows to 260px; label column to 96px; field side padding to 24px.
- **860px:** single column. The header hides the Act subtitle and the model name (kept for screen readers). The rail becomes a disclosure above the work column with an underlined Show/Hide link; the preview footer hides; the ask row stacks with a full-width button; the side-by-side pair stacks with a hairline above the law; body drops to 16px.
- **760px:** field labels stack above values with a trailing hairline.

## Elevation & Depth

Flat. No shadows anywhere. Depth comes from paper tone (white sheet on warm paper, the rail a shade darker) and 1px rules. The only `box-shadow` is an inset 1px ink line on the focused ask input, which thickens its border to 2px.

### Named Rules
**The Paper Not Shadow Rule.** If something needs to stand forward, put it on the white sheet with a 1px rule. Never a drop shadow, glow or halo.

## Shapes

Office stationery. The result frame, section cells, citation chips and ledger flags have square corners. Inputs, buttons and the stamp use 2px. There are no pills and no circles: progress markers in the loading state are small squares. Lines carry meaning: solid hairlines divide fields and law blocks; the double border marks the NOT COVERED stamp; the double underline marks prohibitions. The stamp is the one rotated object (-2deg).

## Components

### Buttons
- **Primary (Ask):** Ink fill, white Hind 600/17px text, no icon, 50px tall, 0 32px padding, 2px corners. Hover goes to pure black; press nudges down 1px; while a request runs it turns Ink Tertiary with a progress cursor. Full width under 860px.
- **Ghost (Cancel):** 36px, transparent, Rule Strong border, Ink Secondary 15px text; border and text go to Ink on hover.

### Example questions
Plain buttons styled as links: Maroon Deep text with a Maroon Line underline that darkens to the text colour on hover, separated by middots, led by "For example:" in Ink Tertiary. One of them deliberately asks something outside the Act to show the refusal.

### Citation chips
30px, square corners, white with a Rule Strong border, Hind 14.5px Ink ("also Section 8(6)", sub-section jumps like "(1) (2) (3)"). Border goes to Ink on hover.

### Inputs
- **Ask input:** 50px, white, 1px Rule Strong, 2px corners, 18px text, Ink Tertiary placeholder. Focus: Ink border plus an inset 1px Ink line.
- **Filter:** 40px, 2px corners, inline 16px search icon in Ink Tertiary, 15px text. Focus-within: Ink border.
- **Global focus:** a 2px Ink outline at 2px offset on every focusable element.

### Navigation
- **Header:** white, product name in Noto Serif 600/20px, the Act's title and number beside it, and the model status as plain 14px text on the right ("phi3:mini, ready"). A degraded or offline status turns Error Red and bold. No logo mark, pill or status dot.
- **Section rail:** Paper Rail column. Cells are 36px white squares with a 1px Rule border and Hind 500/15px numbers. Hover darkens the border to Ink. Current: solid Ink with white text. Cited by the latest answer: 2px Maroon border, bold Maroon Deep number.
- **Mobile:** the rail is a disclosure above the work column.

### Result frame (signature)
Head field: the citation headline, the section title (18px) and chapter line (14.5px) beneath, citation chips when more than one clause applies, and a plain "Answered in 5.8 s" or "Simplified in 5.3 s" at the top right in 13.5px Ink Tertiary. Then labelled fields: Answer (or Key points for a section rewrite), the side-by-side pair, the obligation ledger, Clauses checked (citation link, clause title, a 4px score bar and two-decimal score; the cited row's bar turns Maroon and gains "· cited"), and a Note field carrying the disclaimer. Results appear without animation.

### Side-by-side pair and modality marks (signature interaction)
"In plain words" (left, Hind 18px, tagged "rewritten by Phi-3") and "The Act says" (right, Noto Serif 16px on Paper, tagged "verbatim") sit on one centre rule. Every modal verb is underlined in Maroon, 4px offset: **solid 2px** for must / shall / required to, **double 1.5px** for must not / shall not / cannot, **dashed 2px** for may / can. Drafting formulas such as "as may be prescribed" are left unmarked.

Hovering or focusing any mark lights every mark of the same force across the result with Maroon Wash and Maroon Deep text (160ms). The ledger strip below repeats the three keys with counts ("plain 2 · Act 1"); hovering a key lights the same set. It ends with a flag: green when both columns carry the same kinds of force, amber ("Force differs: read both columns") when they do not. The ledger is omitted when neither side has a modal verb.

### NOT COVERED stamp
Uppercase Hind 700/26px, 0.14em tracking, Maroon text inside a 3px double Maroon border with 2px corners, rotated -2deg, with a 12px "by the DPDP Act, 2023" line. It appears without animation. Beside it: the refusal sentence and the reason; below: the closest clauses checked with their scores and the line that nothing was rewritten.

### States
- **Empty:** two short paragraphs on how the tool works, in Ink Secondary, max 64ch.
- **Loading:** a framed checklist of the pipeline steps with small square markers: the active step is bold with an Ink outline square, done steps are filled Ink. An elapsed timer counts in tenths of a second beside a ghost Cancel button.
- **Error:** framed, `role="alert"`, a 20px Error Red heading, plain explanation, and the exact command to run in an inline `code` chip.
- **Disclaimer:** one plain line under the examples and a Note field at the foot of every result.

### Motion
Only hover and state colour changes, 160ms on `cubic-bezier(0.16, 1, 0.3, 1)`. No fade-ins, pulses or bounce. Under `prefers-reduced-motion: reduce` transitions collapse to 1ms.

## Do's and Don'ts

### Do:
- **Do** lead every result with its citation in Noto Serif 600 at 32px.
- **Do** show the Act's verbatim words in Noto Serif beside every rewrite, on one centre rule.
- **Do** mark obligation force with underline form only: solid for must/shall, double for must not/shall not, dashed for may/can.
- **Do** separate fields with 1px rules and a 132px sentence-case label column.
- **Do** keep every section reachable at once in the rail as numbered cells.
- **Do** write interface copy in plain sentences, as a person would explain the tool.
- **Do** carry the disclaimer under the question box and in every result's Note field.

### Don't:
- **Don't** use a coloured header band, logo badge, pill chips, status dots or gradient fills.
- **Don't** use drop shadows, glows or focus halos.
- **Don't** add entrance animations, pulses or bounces.
- **Don't** use uppercase letter-spaced labels or monospaced "serial" styling for numbers.
- **Don't** invent official-looking reference codes; show only real information (the citation, the time taken).
- **Don't** distinguish must, must not and may by colour; the underline form carries the meaning.
- **Don't** use maroon as a large fill or add a second accent colour.
- **Don't** render answers as chat bubbles.

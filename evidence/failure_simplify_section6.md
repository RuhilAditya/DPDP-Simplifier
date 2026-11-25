# Observed failure: meaning flip in POST /simplify {"section": "6"}

Captured 2026-11-22 from the web frontend (phi3:mini, temperature 0.1, seed 42).

Phi-3-mini's plain-language rewrite of the whole of Section 6 (Consent) contained:

> "This consent should only cover the data needed for the agreed purpose and **cannot be withdrawn easily**.
> You have the right to withdraw your consent at any time, ..."

The first sentence reverses Section 6(4): *"such Data Principal shall have the right to withdraw her consent
at any time, with the ease of doing so being comparable to the ease with which such consent was given."*
The rewrite also contradicts itself in the next sentence.

Why it matters: this is exactly the "changed legal meaning" risk DoD 3 is about. A 3.8B model compressing
a 10-sub-section clause drops or inverts conditions.

What the system does about it:
- The verbatim clause is always shown beside the rewrite (copied from the index, never generated), so
  the reader can check. The frontend underlines every "cannot / shall / may" in both columns.
- The obligation ledger did NOT catch this one: it compares the *kinds* of obligation per column, and
  Section 6 also contains "shall not", so both columns had a prohibition. It is a coarse aid, not a
  verifier.
- Simplifying the sub-section instead ({"section": "6(4)"}) is shorter and is the safer use.

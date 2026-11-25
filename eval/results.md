# Evaluation results (held-out test set)

Run 2026-11-22T20:38:05 · `phi3:mini` · `sentence-transformers/all-MiniLM-L6-v2` · hybrid top-k=6 · threshold=0.25 · temperature=0.1

**In-scope correct: 6/10** (retrieval hit 9/10, citation hit 8/10, automatic fact check 7/10) · **Out-of-scope fallback: 3/3** · mean latency 4.3 s

| ID | Question | Expected | Cited | Retrieved | Cited correctly | Key facts | Meaning kept (manual) | Correct | Notes |
|---|---|---|---|---|---|---|---|---|---|
| T1 | Who counts as a child under this law? | Section 2(f) | Section 2(f) | ✅ | ✅ | 1/1 | ✅ | ✅ | Matches 2(f): not completed eighteen years. |
| T2 | What does an organisation have to do if it suffers a personal data breach? | Section 8(6) | Section 8(6) | ✅ | ✅ | 2/2 | ❌ | ❌ | Rewrite adds 'promptly'; 8(6) sets no timing, only 'form and manner as may be prescribed'. |
| T3 | Can I take back my consent later, and how easy does that have to be? | Section 6(4) | Section 6(4) | ✅ | ✅ | 2/2 | ✅ | ✅ | Any time; ease comparable to giving consent. |
| T4 | What is the maximum fine for not taking reasonable security safeguards to prevent a data breach? | Schedule, item 1 | Schedule, item 1 | ✅ | ✅ | 1/1 | ✅ | ✅ | Up to Rs 250 crore, Schedule item 1. |
| T5 | What information must be given in the notice before my consent is asked for? | Section 5(1) | Section 6(10) | ✅ | ❌ | 3/3 | ✅ | ❌ | Content matches 5(1) but attributed to 6(10) (citation error). |
| T6 | Is targeted advertising aimed at children allowed? | Section 9(3) | Section 9(3) | ✅ | ✅ | 2/2 | ✅ | ✅ | 9(3) prohibition kept. |
| T7 | How quickly must a company reply to my grievance? | Section 13(2) | Section 13(2) | ✅ | ✅ | 1/1 | ✅ | ✅ | Period to be prescribed by rules. |
| T8 | What duties do I have as a Data Principal? | Section 15 | Section 15, Section 13(1) | ✅ | ✅ | 0/2 | ❌ | ❌ | Lists grievance redressal (a right, s.13) as a duty; omits impersonation and false-grievance duties. |
| T9 | Can my personal data be sent to other countries? | Section 16(1) / Section 16(2) | - | ❌ | ❌ | 0/2 | ❌ | ❌ | Retrieval missed s.16; model fell back. |
| T10 | How long do I have to appeal against an order of the Data Protection Board, and to whom? | Section 29(1) / Section 29(2) | Section 29(6), Section 29(2) | ✅ | ✅ | 2/2 | ✅ | ✅ | 60 days, Appellate Tribunal (29(2)); extra cite 29(6). |
| O1 | What is the penalty under the IT Act for hacking into a computer? | fallback | - |  |  |  |  | ✅ | model reported the retrieved clauses do not answer the question |
| O2 | What is the GST rate on restaurant food? | fallback | - |  |  |  |  | ✅ | best retrieval score 0.20 < threshold 0.25 |
| O3 | How do I file my income tax return online? | fallback | - |  |  |  |  | ✅ | best retrieval score 0.23 < threshold 0.25 |

Full answers, rewrites and retrieved clauses: `eval/results.json`.

# Core contract fixtures

Verbatim copies of the API repo's (gaurav-gandhi-2411/triage-iq) committed report files:

- `core-main-eval-summary.json` = `reports/eval_summary.json`
- `core-main-eval-baseline.json` = `reports/eval_baseline.json`

Snapshot taken from core `main` at commit `3b0ed94037e22f1bd4e76097b10e55bc62f2edc5`
(2026-10-07; both files last changed at `abcfa136405caed4b89410577eda2c259834b27f`).

The API's `/eval/summary` response is `eval_summary.json` plus a `current_llm_baseline` block
derived from `eval_baseline.json` (`_current_llm_baseline` in core `src/triage_iq/api/app.py`).
`src/pages/Eval.contract.test.tsx` reproduces that derivation, so these two files are all the
fixture needs. To refresh: re-copy both files from core `main` and update the SHA above.
The live test (`CORE_CONTRACT_LIVE=1`) fetches the same two files from core `main` at run time.

## Integration-branch fixtures (expand-only `resolution_served`)

- `core-integration-eval-summary.json` / `core-integration-eval-baseline.json` = verbatim
  `reports/eval_summary.json` / `reports/eval_baseline.json` from core branch
  `fix/resolution-naive-median-integration` (eval_summary last changed at
  `d31ea6a13d6ff83aff4b5f753657d71382cd63fb`; ADR-0064, D7). They add the top-level
  `resolution_served` block and `leakage.honest_metrics_status`. The contract test runs against
  both the old (core main) pair and this pair; replace with core main's files once that branch
  merges.

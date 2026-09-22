# GCV1 Runtime Shadow V1 — Integration Report

## Status

Branch: `integration/gcv1-runtime-shadow-v1`

Runtime base: `eaf0e2c834031f3f741fd234a1ef91af1412bd7a`

Runtime-code checkpoint used for parity: `2ab54af30d08177035ee6688bd47ccf115f62808`

This branch was reconstructed directly from the verified V4.6 base because the earlier Grok local commit `31b3029405a26a7e0493eafac4296ab8f57a66cd` was never present on the remote repository. The reconstruction does not claim identity with that unavailable commit.

## Runtime isolation

Frozen hashes verified in CI:
- `src/geometry.js`: `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53`
- `src/engine.js`: `f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3`
- exact Candidate V1 copy: `77f017669112a38b998a010f100ae681e7624ca864150bd592122a22422e7503`

The shadow facade returns the V4.6 runtime proposal object by identity. Candidate failures are contained. GCV1 has no adapter or ESV command path.

## V4.6 non-regression

Public GitHub Actions run `35316709287` at checkpoint `2ab54af30d08177035ee6688bd47ccf115f62808`: PASS.

Results:
- 390 tests total;
- 388 pass;
- 0 fail;
- 2 skipped because the private Natif corpus is absent in the public clean clone;
- `src/geometry.js` frozen hash: PASS;
- `src/engine.js` V4.6 baseline hash: PASS;
- exact Candidate V1 file hash: PASS.

The five additional tests are all in `tests/gcv1-shadow.test.cjs`:
1. shadow OFF returns the exact V4.6 runtime object and does not call Candidate V1;
2. Candidate V1 failure is contained and cannot replace the runtime decision;
3. the feature gate only accepts an explicit boolean and disabling clears pending telemetry;
4. S1 leaves an already-STRONG A_STAR proposal unchanged and inactive;
5. S1 selects a unique STRONG competitive cluster but abstains on spatially distinct clusters.

No historical test was removed or replaced.

## Frozen 239 rail parity

Private-data GitHub Actions run `35316768479`: PASS.

Inputs:
- data transfer source: `StoryNow30/banane-data@239f36ddcc9372bc2421c65c276d4d118d86e60a`;
- data archive SHA-256: `ae7a79ac5392e8a6a8289db4652b8bedd628cdce6002ba35b0ba1ce623e05d35`;
- scientific capsule: `2366d483b643bf8415f3d8ecba35938ac4c1d02e`;
- runtime shadow checkpoint: `2ab54af30d08177035ee6688bd47ccf115f62808`.

Rail-by-rail comparison against the frozen capsule:
- population: 239 = 63 failures + 176 controls;
- V4.6 candidates: 176;
- A_STAR candidates: 197;
- Candidate V1/NEXT candidates: 201;
- recoveries: 25 = 23 A_STAR + 2 S1;
- controls published: 176/176;
- S1 evaluated/activated: 42;
- S1 changed decision: 4;
- publishedWeak: 0;
- decision/metric divergences checked by the parity runner: 0.

This is the integration-specific proof that the reconstructed shadow scientific path reproduces the frozen Candidate V1 on the historical lock.

## External 24

The earlier Grok local report stated:
- 24 rails;
- 16 candidates / 8 unresolved;
- 6 recoveries identical;
- 0 regression;
- S1=0.

That result is retained as prior evidence only. It has NOT yet been independently rerun against remote checkpoint `2ab54af...` in this reconstruction, because the two fresh Natif exports are not part of the Git repository.

No retuning is permitted from this population.

## Browser / ESV

Browser extension load: NOT_EXECUTED on this reconstructed remote branch.

Real IndexedDB: NOT_EXECUTED.

Real ESV: NOT_EXECUTED.

No active ESV action has been authorized.

The next gate is a local Edge/Chromium smoke test on the user's workstation with the shadow enabled but still command-free.

## Verdict

`RUNTIME_SHADOW_MIXED`

Reason: offline/runtime isolation and frozen 239 parity are PASS, but browser smoke remains unexecuted and the external 24 has not yet been rerun on this exact remote checkpoint.

This verdict is not an authorization for Assisté, Pilote, merge or deployment.

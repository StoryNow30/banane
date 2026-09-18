# GCV1 Runtime Port Map — Shadow V1

## Scope

Base runtime: `v4.6-engine-state-machine@eaf0e2c834031f3f741fd234a1ef91af1412bd7a`.

Frozen scientific candidate:
- Candidate base: `0dbcb7a32825031c122a14ffc44e13dea629d785`
- Replication capsule: `2366d483b643bf8415f3d8ecba35938ac4c1d02e`
- Candidate geometry SHA-256: `77f017669112a38b998a010f100ae681e7624ca864150bd592122a22422e7503`
- A_STAR: `e46dfc2b5610bedd5052750fba054956c2b07127781f142563e0bdd4c292a58f`
- composition A_STAR + SUPPORT_FALLBACK_15: `0ea0824fb9e0b763d575ee95784475632f7fe2fd18e684b68e9f765106b6b27a`

This lot is an integration port only. No threshold, policy, fallback or scientific rule is tuned here.

## Frozen runtime files

`src/geometry.js` is unchanged from the runtime base:
`3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53`.

`src/engine.js` is unchanged from the V4.6 engine baseline:
`f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3`.

The CI gate checks both hashes on every push to the integration branch.

## Runtime mapping

| File | Role | Runtime authority |
|---|---|---|
| `src/geometry.js` | V4.6 frozen geometry | unchanged |
| `src/brain.js` + `src/geometry-brain.js` | existing V4.6 runtime composition | still decision-maker |
| `src/gcv1-shadow-bootstrap.js` | saves the complete V4.6 runtime geometry object before Candidate V1 is loaded | no ESV action |
| `src/geometry-candidate-v1.js` | byte-exact Candidate V1 geometry copy | scientific computation only |
| `src/gcv1-shadow.js` | computes Candidate V1 in parallel and records compact telemetry | always returns V4.6 proposal object |
| `background.js` | load order, internal shadow gate, persistence of shadow observation | does not replace proposal consumed by engine |
| `tests/gcv1-shadow.test.cjs` | isolation + S1 contract tests | test only |
| `tools/gcv1-shadow-parity239.cjs` | rail-by-rail parity against frozen capsule | offline test only |

## Load order

The single `importScripts(...)` call intentionally keeps the V4.6 test harness contract:

`geometry.js -> brain.js -> geometry-brain.js -> gcv1-shadow-bootstrap.js -> geometry-candidate-v1.js -> gcv1-shadow.js -> engine.js`.

The bootstrap preserves the V4.6 runtime geometry. Loading Candidate V1 temporarily uses the historical global name. The shadow wrapper then restores `BananeGeometry3` as a facade whose `proposeBoth()` always returns the V4.6 runtime object by identity.

Therefore `src/engine.js` binds the shadow facade, but the object it receives from `proposeBoth()` remains the V4.6 runtime proposal.

## Feature gate

Internal gate: `geometryCandidateV1Shadow` through `gcv1-shadow-configure`.

Default after every service-worker start: OFF.

OFF:
- no Candidate V1 computation;
- no shadow telemetry;
- V4.6 result is returned unchanged.

ON:
- V4.6 result is computed first;
- Candidate V1 is evaluated separately with its frozen scientific configuration;
- any GCV1 error is contained;
- the V4.6 result is still returned unchanged;
- a `gcv1-shadow-observed` event may be persisted after analysis.

There is no GCV1 call to adapter `apply`, `restore`, `next`, `validateAndNext`, `skipAndNext`, camera controls or navigation.

## Scientific mapping

The shadow implementation reproduces the frozen replay semantics:
- per-rail V4.6 baseline with frozen geometry;
- A_STAR median-U of all engine-local points;
- `replaceOrigin:false`;
- `recenterWindow:true`;
- `searchY=0.08`, `searchZ=0.04`;
- `grid=0.003`, `minTop=15`, `minFace=6`;
- exact reduced candidate pool rules;
- competitive loss ratio `<= 1.5`;
- S1 only when A_STAR is not already STRONG;
- spatial cluster link is strict `hypot < 0.02`;
- one STRONG competitive cluster -> min-loss;
- multiple clusters -> unresolved ambiguity;
- zero STRONG competitive cluster -> keep A_STAR;
- no S2.

No pair-support behavior from Candidate `proposeBoth()` is introduced into the scientific parity path; the frozen qualification is per rail.

## Non-goals

This branch does not:
- activate Candidate V1 in Assisté or Pilote;
- change any ESV command policy;
- change Natif;
- tune the 38 historical unresolved rails;
- tune the 8 unresolved rails from the external 17 September session;
- merge to main;
- deploy an extension.


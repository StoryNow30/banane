#!/usr/bin/env python3
"""Score an external pair-arbitration policy against the frozen benchmark.

The policy is not modified. Holdout cuts 9031–9047 are reported separately
and must not have been used to choose the policy.

Policy JSON:
{
  "format": "banane-pair-arbiter-policy-v1",
  "decisions": [
    {"part": 20, "cut": 5123, "left": "graine", "right": "alternative"},
    {"part": 20, "cut": 485, "decision": "ABSTAIN"}
  ]
}
Missing cuts count as uncovered, not as abstentions.
A choice whose types are not in that cut's exposed set is invalid.
"""
from __future__ import annotations
import argparse, json, math, sys
from collections import Counter
from pathlib import Path

HOLDOUT = set(range(9031, 9048))
BANDS = (0.005, 0.010, 0.020)

def stats(vals):
    a = [v for v in vals if v is not None and math.isfinite(v)]
    if not a:
        return {"count": 0, "mean": None, "median": None, "min": None, "max": None}
    a.sort()
    n = len(a)
    mean = sum(a) / n
    mid = n // 2
    med = a[mid] if n % 2 else 0.5 * (a[mid-1] + a[mid])
    return {"count": n, "mean": mean, "median": med, "min": a[0], "max": a[-1]}

def load_policy(path):
    doc = json.loads(Path(path).read_text())
    out = {}
    for d in doc.get("decisions") or []:
        key = (int(d["part"]), int(d["cut"]))
        if d.get("decision") == "ABSTAIN" or d.get("left") is None or d.get("right") is None:
            out[key] = {"kind": "ABSTAIN"}
        else:
            out[key] = {"kind": "CHOOSE", "left": d["left"], "right": d["right"]}
    return doc, out

def score_split(cuts, decisions):
    rows = []
    flags = Counter()
    for cut in cuts:
        key = (cut["part"], cut["cut"])
        dec = decisions.get(key)
        rec = {
            "part": cut["part"], "cut": cut["cut"], "split": cut["split"],
            "engineStatus": cut["engine"]["status"],
            "categoryBenchmark": cut["category"],
        }
        if dec is None:
            flags["uncovered"] += 1
            rec["policy"] = "UNCOVERED"
            rec["valid"] = False
            rows.append(rec)
            continue
        if dec["kind"] == "ABSTAIN":
            flags["abstain"] += 1
            rec["policy"] = "ABSTAIN"
            rec["valid"] = True
            rec["maxRailOriginError"] = None
            rows.append(rec)
            continue
        combo = next(
            (c for c in cut["combos"]
             if c["leftType"] == dec["left"] and c["rightType"] == dec["right"]),
            None,
        )
        if combo is None:
            flags["invalidChoice"] += 1
            rec["policy"] = "INVALID"
            rec["valid"] = False
            rec["requested"] = {"left": dec["left"], "right": dec["right"]}
            rec["allowed"] = [c["id"] for c in cut["combos"]]
            rows.append(rec)
            continue
        flags["validChoice"] += 1
        err = combo["oracleEvaluation"]["maxRailOriginError"]
        rec["policy"] = combo["id"]
        rec["valid"] = True
        rec["maxRailOriginError"] = err
        rec["isOracleChoice"] = combo["id"] == (cut["oracle"] or {}).get("comboId")
        rec["isEngineChoice"] = combo["isEngineChoice"]
        for b in BANDS:
            rec[f"within_{int(b*1000)}e-3"] = err <= b
            if err <= b:
                flags[f"within_{int(b*1000)}e-3"] += 1
        rows.append(rec)
    chosen_err = [r["maxRailOriginError"] for r in rows if r.get("maxRailOriginError") is not None]
    oracle_err = [c["oracle"]["maxRailOriginError"] for c in cuts if c.get("oracle")]
    engine_err = [
        c["engineError"]["maxRailOriginError"]
        for c in cuts if c.get("engineError")
    ]
    return {
        "nCuts": len(cuts),
        "uncovered": flags["uncovered"],
        "abstain": flags["abstain"],
        "validChoice": flags["validChoice"],
        "invalidChoice": flags["invalidChoice"],
        "sensitivityNonRuntime": {
            f"within_{int(b*1000)}e-3": flags[f"within_{int(b*1000)}e-3"]
            for b in BANDS
        },
        "policyErrorWhenChosen": stats(chosen_err),
        "oracleCeilingError": stats(oracle_err),
        "engineBaselineErrorWhenSuccess": stats(engine_err),
        "oracleMatchesAmongValidChoices": sum(1 for r in rows if r.get("isOracleChoice")),
        "engineMatchesAmongValidChoices": sum(1 for r in rows if r.get("isEngineChoice")),
        "rows": rows,
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--benchmark", required=True)
    ap.add_argument("--policy", required=True)
    ap.add_argument("--out", help="optional JSON report path")
    args = ap.parse_args()
    bench = json.loads(Path(args.benchmark).read_text())
    if bench.get("format") != "banane-pair-arbitration-benchmark-v1":
        sys.exit("unexpected benchmark format")
    _, decisions = load_policy(args.policy)
    cuts = bench["cuts"]
    develop = [c for c in cuts if c["split"] == "develop"]
    holdout = [c for c in cuts if c["split"] == "holdout"]
    report = {
        "format": "banane-pair-arbitration-score-v1",
        "benchmarkFormat": bench["format"],
        "benchmarkVersion": bench.get("version"),
        "holdoutUntouchedForFitting": True,
        "note": "Sensitivities 5/10/20e-3 are evaluation bands, not production thresholds. Do not convert to millimetres.",
        "develop": score_split(develop, decisions),
        "holdout": score_split(holdout, decisions),
        "all": score_split(cuts, decisions),
    }
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).write_text(text + "\n")
    summary = {
        "develop": {k: report["develop"][k] for k in report["develop"] if k != "rows"},
        "holdout": {k: report["holdout"][k] for k in report["holdout"] if k != "rows"},
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()

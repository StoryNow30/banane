"""CH-042 § 1 : effectifs, gestes, biais et dispersion de l'erreur signée par lot, par rail et par axe ; puissance."""
import sys, json, math, numpy as np
sys.path.insert(0, __import__('os').path.dirname(__file__))
from ch042lib import charger, err3d, SIDES
L = charger(sys.argv[1])
lots = sorted(set(x['nom'] for x in L))
print(f"{'lot':16} {'n':>4} {'acc':>4} {'fine':>4} {'moy':>4} {'faut':>4} | biais lat G/D (mm) | biais vert G/D (mm) | sd lat | sd vert | sd3D corrigés")
tot = {'n': 0, 'acceptation': 0, 'fine': 0, 'moyenne': 0, 'faute': 0}
for lot in lots:
    X = [x for x in L if x['nom'] == lot]
    g = {k: sum(1 for x in X if x['geste'] == k) for k in ('acceptation', 'fine', 'moyenne', 'faute')}
    cor = [x for x in X if x['geste'] != 'acceptation' and x['mm'] <= 50]  # corrigés hors fautes (les fautes sont une autre voie)
    def col(i, s): return np.array([x['err'][s][i] for x in cor])
    bl = [col(1, s).mean() if cor else float('nan') for s in SIDES]; bv = [col(2, s).mean() if cor else float('nan') for s in SIDES]
    sl = np.std(np.concatenate([col(1, s) for s in SIDES])) if cor else float('nan'); sv = np.std(np.concatenate([col(2, s) for s in SIDES])) if cor else float('nan')
    s3 = np.std([x['mm'] for x in cor]) if cor else float('nan')
    print(f"{lot:16} {len(X):4} {g['acceptation']:4} {g['fine']:4} {g['moyenne']:4} {g['faute']:4} | {bl[0]:+5.2f} {bl[1]:+5.2f} | {bv[0]:+5.2f} {bv[1]:+5.2f} | {sl:5.2f} | {sv:5.2f} | {s3:5.2f}")
    tot['n'] += len(X)
    for k in g: tot[k] += g[k]
print('total', tot)
cor = [x for x in L if x['geste'] != 'acceptation' and x['mm'] <= 50]
all3 = np.array([x['mm'] for x in L]); c3 = np.array([x['mm'] for x in cor])
print(f"jugés {len(L)} ; erreur 3D pire rail : moyenne {all3.mean():.2f} sd {all3.std():.2f} ; corrigés hors fautes {len(cor)} : moyenne {c3.mean():.2f} médiane {np.median(c3):.2f} sd {c3.std():.2f} p90 {np.quantile(c3,.9):.2f}")
# puissance : effet détectable à 80 % (bilatéral 5 %) sur la moyenne appariée, sd des différences supposée = k × sd de l'erreur (SUPPOSÉ k = 0,5 : une correction ne change qu'une part de l'erreur)
for k in (0.3, 0.5, 1.0):
    sd = all3.std() * k
    print(f"  effet détectable à 80 % sur {len(L)} cuts, sd des différences {sd:.2f} mm (k={k}) : {2.8*sd/math.sqrt(len(L)):.2f} mm")
# par axe (corrigés) : part des rails où |err| > 2 mm, par axe
for i, nom in ((1, 'latéral'), (2, 'vertical')):
    v = np.concatenate([[abs(x['err'][s][i]) for s in SIDES] for x in cor])
    print(f"  {nom} (rails des corrigés hors fautes, n={len(v)}) : moyenne |err| {v.mean():.2f}, médiane {np.median(v):.2f}, > 2 mm {100*(v>2).mean():.0f} %, > 5 mm {100*(v>5).mean():.0f} %, > 10 mm {100*(v>10).mean():.0f} %")

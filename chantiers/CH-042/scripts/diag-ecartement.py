"""CH-042 : l'écartement de la pose de la chaîne contre celui de la vérité et de la référence de la liste d'ESV (lignes valides non touchées)."""
import sys, os, numpy as np, collections
sys.path.insert(0, os.path.dirname(__file__))
from ch042lib import charger, SIDES
L = charger(sys.argv[1])
CH = ('first-pass', 'window', 'choice', 'crossing')
X = [x for x in L if x['etage'] in CH and x.get('gauges') and x['gauges']['verite'] is not None]
print(f"chaîne, cuts jugés avec écartements : {len(X)} ; avec référence de liste : {sum(1 for x in X if x['refListe'])}")
def lot_stats(Y, titre):
    gv = np.array([x['gauges']['verite'] for x in Y]); gp = np.array([x['gauges']['pose'] for x in Y])
    rf = np.array([x['refListe']['mm'] if x['refListe'] else np.nan for x in Y]); ok = ~np.isnan(rf)
    print(f"  {titre:14} n={len(Y):4} | vérité : médiane {np.median(gv):.1f} sd {gv.std():.1f} | pose−vérité : médiane |.| {np.median(abs(gp-gv)):.1f}, >10 {int((abs(gp-gv)>10).sum())} | vérité−réf liste : médiane {np.median((gv-rf)[ok]) if ok.any() else float('nan'):+.1f}, |.| médiane {np.median(abs(gv-rf)[ok]) if ok.any() else float('nan'):.1f}, >5 {int((abs(gv-rf)[ok]>5).sum())}, >10 {int((abs(gv-rf)[ok]>10).sum())} | pose−réf : |.| médiane {np.median(abs(gp-rf)[ok]) if ok.any() else float('nan'):.1f}, >10 {int((abs(gp-rf)[ok]>10).sum())}")
for lot in sorted(set(x['nom'] for x in X)): lot_stats([x for x in X if x['nom'] == lot], lot)
lot_stats(X, 'TOUS')
# Les cuts de la chaîne à plus de 10 mm en latéral : l'écartement de la pose est-il faux, et de combien ; la vérité est-elle à la référence ?
M = [x for x in X if x['mm'] > 10 and max(abs(x['err'][s][1]) for s in SIDES) > 10]
print(f"\nchaîne, > 10 mm latéral : {len(M)}")
for x in sorted(M, key=lambda x: x['gauges']['pose'] - x['gauges']['verite']):
    g = x['gauges']; r = x['refListe']
    print(f"  {x['nom']:14} {x['geste']:11} {x['etage'][:6]} errL {x['err']['left'][1]:+6.1f} errR {x['err']['right'][1]:+6.1f} | départ {g['depart']:.0f} pose {g['pose']:.1f} vérité {g['verite']:.1f} réf {r['mm'] if r else None} | appuis {x['appuis']} gaugeRef {x.get('gaugeRefMm')}")
# distribution de |pose − vérité| de l'écartement pour tous les jugés de la chaîne, et ce que la référence prédit
d = np.array([x['gauges']['pose'] - x['gauges']['verite'] for x in X])
print('\n|écartement pose − vérité| sur la chaîne : >5 mm', int((abs(d) > 5).sum()), '>10', int((abs(d) > 10).sum()), '>15', int((abs(d) > 15).sum()), 'sur', len(d))
Y = [x for x in X if x['refListe']]
dr = np.array([x['gauges']['pose'] - x['refListe']['mm'] for x in Y]); dv = np.array([x['gauges']['verite'] - x['refListe']['mm'] for x in Y])
for T in (5, 8, 10, 15):
    m = abs(dr) > T
    print(f"  anomalie |pose − réf| > {T} : {int(m.sum())} cuts ; parmi eux, vérité à moins de 5 mm de la réf : {int((abs(dv[m])<5).sum())}, à moins de 5 mm de la pose : {int((abs((dr-dv)[m])<5).sum())} ; hors anomalie, vérité à moins de 5 de la réf : {int((abs(dv[~m])<5).sum())}/{int((~m).sum())}")

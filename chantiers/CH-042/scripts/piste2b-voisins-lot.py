"""CH-042 piste 2 bis : continuité avec les POSES DU LOT LUI-MÊME (tous les posés, jugés ou non, positions de scène), rail par rail.
Prédiction du rail au cut c : droite ajustée (ou interpolation) sur les posés du même lot aux cuts c±1..c±K (K = 3), `causal` : seulement les cuts
posés AVANT (ce que le lot sait au moment de poser) ; sinon des deux côtés (relecture). Écart en travers (projection sur gauche→droite).
Oracle : le rail faux (|err| latéral > 10) est-il celui qui s'écarte des voisins ? Règle LOLO : rail à plus de T de ses voisins, l'autre à moins de T/2."""
import sys, os, json, glob, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from ch042lib import charger, appliquer, juger, texte, SIDES
CH = ('first-pass', 'window', 'choice', 'crossing')
tous = charger(sys.argv[1], juges_seulement=False)
causal = (sys.argv[2] == 'causal') if len(sys.argv) > 2 else True
K = 3
parlot = {}
for x in tous:
    if x.get('scene') and x['etage'] in CH: parlot.setdefault(x['nom'], {})[x['cut']] = x
L = [x for x in tous if x['geste'] and x.get('scene') and x.get('sensLat') and x['etage'] in CH]
lots = sorted(set(x['nom'] for x in L))
def pred(x, s):
    P = parlot[x['nom']]; c = x['cut']; rang = x['rang']
    vois = [P[j] for j in range(c - K, c + K + 1) if j != c and j in P and (not causal or (P[j]['rang'] is not None and rang is not None and P[j]['rang'] < rang))]
    if len(vois) < 2: return None
    js = np.array([v['cut'] - c for v in vois]); pts = np.array([v['scene']['pose'][s] for v in vois])
    if causal and js.max() >= 0: pass
    A = np.vstack([np.ones(len(js)), js]).T
    coef, *_ = np.linalg.lstsq(A, pts, rcond=None)
    return coef[0], len(vois), int(np.abs(js).max())
E = {}
for x in L:
    g = np.array(x['scene']['pose']['right']) - np.array(x['scene']['pose']['left']); g[2] = 0; g /= np.linalg.norm(g) or 1
    e = {}
    for s in SIDES:
        p = pred(x, s)
        if not p: e = None; break
        dp = np.array(x['scene']['pose'][s]) - p[0]; dv = np.array(x['scene']['verite'][s]) - p[0] if x['scene'].get('verite') else None
        e[s] = {'poseLat': float(dp @ g), 'veriteLat': float(dv @ g) if dv is not None else None, 'n': p[1]}
    if e: E[(x['nom'], x['cut'])] = e
X = [x for x in L if (x['nom'], x['cut']) in E]
print(f"{'causal' if causal else 'deux côtés'} : cuts jugés de la chaîne {len(L)}, avec ≥ 2 voisins posés à ±{K} : {len(X)} ({100*len(X)/len(L):.0f} %)")
pl = np.array([abs(E[(x['nom'], x['cut'])][s]['poseLat']) for x in X for s in SIDES]); vl = np.array([abs(E[(x['nom'], x['cut'])][s]['veriteLat']) for x in X for s in SIDES if E[(x['nom'], x['cut'])][s]['veriteLat'] is not None])
print(f"  |pose − voisins| travers : médiane {np.median(pl):.1f}, p90 {np.quantile(pl,.9):.1f}, > 10 {100*(pl>10).mean():.0f} % ; |vérité − voisins| : médiane {np.median(vl):.1f}, p90 {np.quantile(vl,.9):.1f}, > 10 {100*(vl>10).mean():.0f} %")
M = [x for x in X if max(abs(x['err'][s][1]) for s in SIDES) > 10 and x['mm'] <= 50]
print(f"  moyennes latérales couvertes : {len(M)} ; rail faux : |pose − voisins| médiane {np.median([abs(E[(x['nom'], x['cut'])][max(SIDES, key=lambda s: abs(x['err'][s][1]))]['poseLat']) for x in M]) if M else float('nan'):.1f}, |vérité − voisins| {np.median([abs(E[(x['nom'], x['cut'])][max(SIDES, key=lambda s: abs(x['err'][s][1]))]['veriteLat']) for x in M]) if M else float('nan'):.1f} ; autre rail : |pose − voisins| {np.median([abs(E[(x['nom'], x['cut'])][min(SIDES, key=lambda s: abs(x['err'][s][1]))]['poseLat']) for x in M]) if M else float('nan'):.1f}")
print(f"  rail faux plus loin des voisins que l'autre rail : {sum(1 for x in M if abs(E[(x['nom'], x['cut'])][max(SIDES, key=lambda s: abs(x['err'][s][1]))]['poseLat']) > abs(E[(x['nom'], x['cut'])][min(SIDES, key=lambda s: abs(x['err'][s][1]))]['poseLat']))}/{len(M)} ; de plus de 10 mm : {sum(1 for x in M if abs(E[(x['nom'], x['cut'])][max(SIDES, key=lambda s: abs(x['err'][s][1]))]['poseLat']) > 10)}")
# parmi TOUS les cuts couverts, un rail à plus de T des voisins et l'autre à moins de T/2 : combien, et combien sont des moyennes ?
for T in (8, 10, 15, 20):
    S = [x for x in X if sum(1 for s in SIDES if abs(E[(x['nom'], x['cut'])][s]['poseLat']) > T) == 1 and sum(1 for s in SIDES if abs(E[(x['nom'], x['cut'])][s]['poseLat']) <= T / 2) == 1]
    print(f"  signalés T={T} : {len(S)} cuts, dont > 10 mm latéral {sum(1 for x in S if max(abs(x['err'][s][1]) for s in SIDES) > 10)}, acceptations {sum(1 for x in S if x['geste']=='acceptation')}")
def corr_de(T):
    def f(x):
        e = E.get((x['nom'], x['cut']))
        if not e: return None
        loin = [s for s in SIDES if abs(e[s]['poseLat']) > T]; pres = [s for s in SIDES if abs(e[s]['poseLat']) <= T / 2]
        if len(loin) != 1 or len(pres) != 1: return None
        s = loin[0]; d = -e[s]['poseLat'] * (1 if s == 'right' else -1)
        return {s: [d * x['sensLat'][s], 0.0], ('right' if s == 'left' else 'left'): [0.0, 0.0]}
    return f
def score(Y, f): return float(np.mean([r[1] for r in appliquer(Y, f)]))
pool = []; choix = {}
for k in lots:
    test = [x for x in L if x['nom'] == k]; train = [x for x in L if x['nom'] != k]
    best = min((8, 10, 15, 20, 30, 99), key=lambda T: score(train, corr_de(T))); choix[k] = best
    pool += appliquer(test, corr_de(best))
print(texte(juger(pool, f"piste 2 bis : rail ramené aux poses voisines du lot ({'causal' if causal else 'deux côtés'}, ±{K}, LOLO, {len(lots)} lots)"))); print('  seuils :', choix)

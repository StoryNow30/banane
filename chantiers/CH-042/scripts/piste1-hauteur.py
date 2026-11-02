"""CH-042 piste 1 : correction verticale des rails dont le calage de convention est REFUSÉ (shift-out-of-domain, rail posé brut), et variantes,
en leave-one-lot-out strict. Population : cuts posés par la chaîne (first-pass, window, choice, crossing) et jugés ; les rails appliqués
ne sont pas touchés (biais nul mesuré). Modèles (par lot laissé de côté, paramètres choisis sur les autres lots) :
  nul ; HA-livre (correction consignée, plafond 5) ; constante (médiane de v sur les rails refusés des autres lots, plafond P) ;
  lineaire-ep (a + b×ép, HA refait) ; lineaire-dz (a + b×(dz−8)) ; pour P dans {5, 8, 10, 12, 99} choisi sur les autres lots (imbriqué)."""
import sys, os, json, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from ch042lib import charger, appliquer, juger, texte, SIDES
CH = ('first-pass', 'window', 'choice', 'crossing')
L = charger(sys.argv[1])
jeux = sys.argv[2] if len(sys.argv) > 2 else 'AB'
L = [x for x in L if x['etage'] in CH and x['nom'][0] in jeux]
lots = sorted(set(x['nom'] for x in L))
def refuses(X):
    out = []
    for x in X:
        for s in SIDES:
            r = x['rails'][s]
            if r['groupe'] == 'refuse' and r['dzMm'] is not None: out.append((x['err'][s][2], r['dzMm'], r['epaisseurMm'], r['pointsDessus']))
    return out
def cap(v, P): return float(np.sign(v) * min(abs(v), P))
def fit(X, forme):
    R = refuses(X)
    if len(R) < 5: return None
    v = np.array([r[0] for r in R]); dz = np.array([r[1] for r in R]); ep = np.array([r[2] if r[2] is not None else np.nan for r in R])
    if forme == 'constante': return {'c': float(np.median(v))}
    ok = ~np.isnan(ep)
    if forme == 'lineaire-ep' and ok.sum() >= 5:
        b = np.polyfit(ep[ok], v[ok], 1); return {'a': float(b[1]), 'b': float(b[0]), 'x': 'ep'}
    if forme == 'lineaire-dz':
        b = np.polyfit(dz - 8, v, 1); return {'a': float(b[1]), 'b': float(b[0]), 'x': 'dz'}
    return None
def corr_de(m, P, forme):
    def f(x):
        out = {}; touche = False
        for s in SIDES:
            r = x['rails'][s]; d = 0.0
            if forme == 'ha-livre': d = r['haMm'] or 0.0
            elif r['groupe'] == 'refuse' and r['dzMm'] is not None and m:
                if forme == 'constante': d = m['c']
                elif m['x'] == 'ep' and r['epaisseurMm'] is not None: d = m['a'] + m['b'] * r['epaisseurMm']
                elif m['x'] == 'dz': d = m['a'] + m['b'] * (r['dzMm'] - 8)
                d = cap(d, P)
            out[s] = [0.0, d]; touche = touche or d != 0
        return out if touche else None
    return f
def score(X, f):  # erreur moyenne 3D après (acceptations comprises)
    return float(np.mean([r[1] for r in appliquer(X, f)]))
PLAFONDS = (5, 8, 10, 12, 99)
res = {}
for forme in ('nul', 'ha-livre', 'constante', 'lineaire-ep', 'lineaire-dz'):
    pool = []; choix = {}
    for k in lots:
        test = [x for x in L if x['nom'] == k]; train = [x for x in L if x['nom'] != k]
        if forme == 'nul': f = lambda x: None
        elif forme == 'ha-livre': f = corr_de(None, 5, forme)
        else:
            m = fit(train, forme)
            if not m: f = lambda x: None
            else:
                best = min(PLAFONDS, key=lambda P: score(train, corr_de(m, P, forme)))
                choix[k] = (round(m.get('c', m.get('a', 0)), 2), round(m.get('b', 0), 3), best)
                f = corr_de(m, best, forme)
        pool += appliquer(test, f)
    s = juger(pool, f'piste 1, {forme} (jeux {jeux}, LOLO, {len(lots)} lots)')
    print(texte(s)); 
    if choix: print('  choix par pli (constante/a, b, plafond) :', choix)
    res[forme] = s
# zoom : les seuls cuts qui portent un rail refusé
Z = [x for x in L if any(x['rails'][s]['groupe'] == 'refuse' for s in SIDES)]
print(f"\ncuts portant un rail refusé : {len(Z)} sur {len(L)} ({100*len(Z)/len(L):.1f} %) ; gestes :", {g: sum(1 for x in Z if x['geste'] == g) for g in ('acceptation', 'fine', 'moyenne', 'faute')}, '; par lot', {k: sum(1 for x in Z if x['nom'] == k) for k in lots if any(x['nom'] == k for x in Z)})

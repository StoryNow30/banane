"""CH-042 piste 5 : les cellules candidates du moteur gelé (nuage du lot) contre la vérité, cuts jugés posés par la chaîne.
(1) Oracle : la vérité est-elle à moins de 3 / 5 / 10 mm d'une cellule candidate (lat, vert, calage compris) ? Quel serait le gain si l'on
    choisissait toujours la cellule la plus proche de la vérité (borne haute, PAS un gain) ?
(2) Scorer appris (LOLO) : pour chaque rail, classement des candidats par un modèle (traits : rang, perte relative, dessus, flanc, |u|, |z|,
    distance à la pose de la chaîne, distance aux cellules « publiée ») appris sur les autres lots à viser la cellule la plus proche de la vérité ;
    la pose corrigée = la cellule classée première si elle est à plus de `mort` mm de la pose ; nulle sinon."""
import sys, os, json, glob, numpy as np, warnings
sys.path.insert(0, os.path.dirname(__file__))
from ch042lib import charger, appliquer, juger, texte, SIDES
warnings.filterwarnings('ignore')
from sklearn.ensemble import GradientBoostingClassifier
T = {(x['nom'], x['cut']): x for x in charger(sys.argv[1])}
N = []
for f in sorted(glob.glob(os.path.join(sys.argv[2], '*.jsonl'))):
    for l in open(f):
        if not l.strip(): continue
        n = json.loads(l)
        if n.get('erreur') or (n['nom'], n['cut']) not in T: continue
        n['x'] = T[(n['nom'], n['cut'])]; N.append(n)
jeux = sys.argv[3] if len(sys.argv) > 3 else 'AB'
N = [n for n in N if n['nom'][0] in jeux]
lots = sorted(set(n['nom'] for n in N))
print(f"cuts avec nuage et vérité : {len(N)} ({len(lots)} lots) ; rails résolus : {sum(1 for n in N for s in SIDES if n['rails'][s]['ok'])} ; candidats par rail (médiane) : {np.median([len(n['rails'][s]['candidats']) for n in N for s in SIDES if n['rails'][s]['ok']]):.0f}")
def dist(c, v): return float(np.hypot(c['lat'] - v[0], c['vert'] - v[1]))
# (1) oracle par rail
for seuil in (3, 5, 10):
    tot = ok = 0; moy = 0
    for n in N:
        for s in SIDES:
            r = n['rails'][s]
            if not r['ok'] or not r['candidats']: continue
            tot += 1; d = min(dist(c, r['verite']) for c in r['candidats'])
            ok += d <= seuil
    print(f"  rails dont une cellule candidate est à ≤ {seuil} mm de la vérité : {ok}/{tot} ({100*ok/tot:.0f} %)")
# rails faux de plus de 10 mm : une cellule juste existe-t-elle ?
F = [(n, s) for n in N for s in SIDES if n['rails'][s]['ok'] and n['rails'][s]['candidats'] and np.hypot(*(np.array(n['rails'][s]['verite']) - np.array(n['rails'][s]['pose']))) > 10]
print(f"  rails faux de plus de 10 mm (lat/vert) avec candidats : {len(F)} ; une cellule à ≤ 5 mm de la vérité : {sum(1 for n, s in F if min(dist(c, n['rails'][s]['verite']) for c in n['rails'][s]['candidats']) <= 5)} ; rang de cette cellule (médiane) : {np.median([min(n['rails'][s]['candidats'], key=lambda c: dist(c, n['rails'][s]['verite']))['rank'] for n, s in F]):.0f}")
def corr_oracle(mort=2.0):
    def f(x):
        n = next((n for n in N if n['nom'] == x['nom'] and n['cut'] == x['cut']), None)
        if not n: return None
        out = {}; touche = False
        for s in SIDES:
            r = n['rails'][s]; d = [0.0, 0.0]
            if r['ok'] and r['candidats']:
                c = min(r['candidats'], key=lambda c: dist(c, r['verite']))
                if dist(c, r['verite']) < np.hypot(*(np.array(r['verite']) - np.array(r['pose']))) and np.hypot(c['lat'] - r['pose'][0], c['vert'] - r['pose'][1]) > mort:
                    d = [c['lat'] - r['pose'][0], c['vert'] - r['pose'][1]]; touche = True
            out[s] = d
        return out if touche else None
    return f
X = [n['x'] for n in N]
print(texte(juger(appliquer(X, corr_oracle()), f'ORACLE : cellule la plus proche de la vérité (jeux {jeux}) : borne haute, PAS un gain')))
# (2) scorer appris
def traits(r, c):
    lmin = min(k['loss'] for k in r['candidats']) or 1e-12
    dp = np.hypot(c['lat'] - r['pose'][0], c['vert'] - r['pose'][1])
    pub = r.get('publie'); dpub = np.hypot(c['lat'] - pub[0], c['vert'] - pub[1]) if pub else 99.0
    return [c['rank'], c['loss'] / lmin, np.log10(c['loss'] + 1e-12), c['top'], c['face'], abs(c['lat']), abs(c['vert']), dp, dpub, c['cal'], len(r['candidats'])]
def jeu(Ns):
    F, Y, G = [], [], []
    for n in Ns:
        for s in SIDES:
            r = n['rails'][s]
            if not r['ok'] or len(r['candidats']) < 2: continue
            best = min(r['candidats'], key=lambda c: dist(c, r['verite']))
            for c in r['candidats']: F.append(traits(r, c)); Y.append(1 if c is best and dist(c, r['verite']) <= 5 else 0)
    return np.array(F), np.array(Y)
def corr_scorer(mod, mort, Ns):
    idx = {(n['nom'], n['cut']): n for n in Ns}
    def f(x):
        n = idx.get((x['nom'], x['cut']))
        if not n: return None
        out = {}; touche = False
        for s in SIDES:
            r = n['rails'][s]; d = [0.0, 0.0]
            if r['ok'] and len(r['candidats']) >= 2:
                p = mod.predict_proba(np.array([traits(r, c) for c in r['candidats']]))[:, 1]
                c = r['candidats'][int(np.argmax(p))]
                if np.hypot(c['lat'] - r['pose'][0], c['vert'] - r['pose'][1]) > mort and p.max() >= 0.6:
                    d = [c['lat'] - r['pose'][0], c['vert'] - r['pose'][1]]; touche = True
            out[s] = d
        return out if touche else None
    return f
pool = []
for k in lots:
    train = [n for n in N if n['nom'] != k]; test = [n for n in N if n['nom'] == k]
    F, Y = jeu(train)
    if Y.sum() < 10: pool += appliquer([n['x'] for n in test], lambda x: None); continue
    mod = GradientBoostingClassifier(n_estimators=150, max_depth=3, learning_rate=0.05, min_samples_leaf=20, random_state=20261102).fit(F, Y)
    pool += appliquer([n['x'] for n in test], corr_scorer(mod, 3.0, test))
print(texte(juger(pool, f'scorer appris parmi les candidats (jeux {jeux}, LOLO, {len(lots)} lots, p ≥ 0,6, zone morte 3 mm)')))

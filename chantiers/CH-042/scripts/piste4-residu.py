"""CH-042 piste 4 : modèle de résidu appris (ridge, forêt / boosting) sur les signaux du lot, par rail et par axe, LOLO strict.
Population : poses de la chaîne jugées. Cible : erreur signée (vérité − pose) latérale et verticale de chaque rail. La correction appliquée est
la prédiction (bornée à ± plafond), avec une zone morte : si |prédiction| < seuilMort, aucune correction (l'opérateur ne voit pas 2 mm).
Modèle nul : 0. Les hyperparamètres (plafond, seuil mort, famille) sont choisis sur les lots d'apprentissage (imbriqué, score = erreur 3D moyenne)."""
import sys, os, numpy as np, warnings
sys.path.insert(0, os.path.dirname(__file__))
from ch042lib import charger, appliquer, juger, texte, SIDES
warnings.filterwarnings('ignore')
from sklearn.linear_model import Ridge
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
CH = ('first-pass', 'window', 'choice', 'crossing')
L = charger(sys.argv[1]); jeux = sys.argv[2] if len(sys.argv) > 2 else 'AB'
L = [x for x in L if x['etage'] in CH and x['nom'][0] in jeux and x.get('gauges')]
lots = sorted(set(x['nom'] for x in L))
def f0(v, d=0.0): return float(v) if v is not None and np.isfinite(v) else d
def feats(x, s):
    r = x['rails'][s]; o = x['rails']['right' if s == 'left' else 'left']; g = x['gauges']; ref = x.get('refListe')
    z = x.get('zone') or {}
    return [1.0 if r['groupe'] == 'refuse' else 0.0, 1.0 if r['groupe'] == 'applique' else 0.0, f0(r['dzMm']), f0(r['epaisseurMm']), f0(r['pointsDessus']), f0(r['pointsFlanc']),
            1.0 if o['groupe'] == 'refuse' else 0.0, f0(o['pointsFlanc']), f0(o['pointsDessus']),
            *[1.0 if x['etage'] == e else 0.0 for e in CH], f0(x['appuis']), f0(x['appuiDistance'], 99.0),
            x['deplacement'][s][1] * x['sensLat'][s] if x.get('sensLat') else 0.0, x['deplacement'][s][2], abs(x['deplacement'][s][1]),
            f0(g['pose']) - f0(g['depart']), (f0(g['pose']) - ref['mm']) if ref else 0.0, 1.0 if ref else 0.0, (f0(x.get('gaugeRefMm')) - f0(g['pose'])) if x.get('gaugeRefMm') else 0.0,
            1.0 if z.get('adv') else 0.0, 1.0 if z.get('pn') else 0.0, f0(x['flushPct']), f0(x['engineMs']) / 1000.0,
            f0(r['chosen']['rank']) if r['chosen'] else -1.0, f0(r['chosen']['lossRatio'], 1.0) if r['chosen'] else 1.0, f0(r['chosen']['fromPredictionMm']) if r['chosen'] else 0.0,
            1.0 if s == 'left' else 0.0]
def XY(X):
    F, T = [], []
    for x in X:
        for s in SIDES:
            F.append(feats(x, s)); T.append([x['err'][s][1] * x['sensLat'][s] if x.get('sensLat') else x['err'][s][1], x['err'][s][2]])  # latéral signé « vers l'extérieur »
    return np.array(F), np.array(T)
FAMILLES = {'ridge': lambda: Ridge(alpha=10.0), 'foret': lambda: RandomForestRegressor(n_estimators=200, min_samples_leaf=20, random_state=20261102), 'boost': lambda: GradientBoostingRegressor(n_estimators=150, max_depth=3, learning_rate=0.05, min_samples_leaf=20, subsample=0.8, random_state=20261102)}
def entrainer(fam, X):
    F, T = XY(X); m = {}
    for i, axe in ((0, 'lat'), (1, 'vert')):
        mod = FAMILLES[fam](); mod.fit(F, T[:, i]); m[axe] = mod
    return m
def predire(m, X):
    """Prédictions en bloc (lat, vert) pour chaque (cut, rail) de X : dict (nom, cut, side) -> (plat, pvert)."""
    F = np.array([feats(x, s) for x in X for s in SIDES]); cles = [(x['nom'], x['cut'], s) for x in X for s in SIDES]
    pl = m['lat'].predict(F); pv = m['vert'].predict(F)
    return dict(zip(cles, zip(pl, pv)))
def corr_de(P, plafond, mort, axes=('lat', 'vert')):
    def f(x):
        out = {}; touche = False
        for s in SIDES:
            pl, pv = P[(x['nom'], x['cut'], s)]; dl = dv = 0.0
            if 'lat' in axes:
                p = float(np.sign(pl) * min(abs(pl), plafond)); dl = p * (x['sensLat'][s] if x.get('sensLat') else 1) if abs(p) >= mort else 0.0
            if 'vert' in axes:
                p = float(np.sign(pv) * min(abs(pv), plafond)); dv = p if abs(p) >= mort else 0.0
            out[s] = [dl, dv]; touche = touche or dl != 0 or dv != 0
        return out if touche else None
    return f
def score(X, f): return float(np.mean([r[1] for r in appliquer(X, f)]))
GR = [(P, M) for P in (5, 10, 20) for M in (2, 3, 5)]
for fam in sys.argv[3].split(',') if len(sys.argv) > 3 else ('ridge', 'foret', 'boost'):
    for axes in (('vert',), ('lat',), ('lat', 'vert')):
        pool = []; choix = {}
        for k in lots:
            test = [x for x in L if x['nom'] == k]; train = [x for x in L if x['nom'] != k]
            # imbriqué : hyperparamètres choisis par une sous-validation (un sous-pli : les lots d'apprentissage coupés en deux par rang)
            moitie = sorted(set(x['nom'] for x in train)); A = [x for x in train if x['nom'] in moitie[::2]]; B = [x for x in train if x['nom'] in moitie[1::2]]
            PA = predire(entrainer(fam, A), B); PB = predire(entrainer(fam, B), A)
            best = min(GR, key=lambda g: score(B, corr_de(PA, *g, axes)) + score(A, corr_de(PB, *g, axes)))
            P = predire(entrainer(fam, train), test); choix[k] = best
            pool += appliquer(test, corr_de(P, *best, axes))
        s = juger(pool, f'piste 4 {fam} axes {axes} (jeux {jeux}, LOLO imbriqué, {len(lots)} lots)')
        print(texte(s)); print('  choix (plafond, zone morte) :', choix, flush=True)

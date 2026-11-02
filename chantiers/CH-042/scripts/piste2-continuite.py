"""CH-042 piste 2 : continuité de la voie comme a priori. Pour chaque cut jugé posé par la chaîne, la position de chaque rail est prédite
depuis les lignes VALIDES NON TOUCHÉES de la liste d'ESV (st 0, fl 0 : ni vues ni traitées, jamais écrites par Ariane) les plus proches de
part et d'autre (interpolation linéaire en 3D, monde), à condition d'en avoir à moins de `portee` cuts des deux côtés. Écart de la pose à la
prédiction, en travers (mm) et en hauteur, rail par rail ; même écart pour la vérité (ce que vaut l'a priori). Puis une règle LOLO :
si un rail est à plus de T mm de sa prédiction en travers et l'autre à moins de T/2, ramener ce rail à la prédiction (T choisi sur les autres lots)."""
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from ch042lib import charger, appliquer, juger, texte, SIDES
CH = ('first-pass', 'window', 'choice', 'crossing')
L = [x for x in charger(sys.argv[1]) if x['etage'] in CH and x.get('scene') and x.get('voisinage') and x.get('sensLat')]
jeux = sys.argv[2] if len(sys.argv) > 2 else 'AB'; L = [x for x in L if x['nom'][0] in jeux]
lots = sorted(set(x['nom'] for x in L))
PORTEE = int(sys.argv[3]) if len(sys.argv) > 3 else 6
def prediction(x):
    """Rails prédits (monde, mm) par interpolation des lignes saines les plus proches avant et après ; None si aucune des deux côtés dans la portée."""
    v = x['voisinage']; av = [r for r in v if r[0] < 0 and r[1] == 0 and r[2] == 0 and -r[0] <= PORTEE]; ap = [r for r in v if r[0] > 0 and r[1] == 0 and r[2] == 0 and r[0] <= PORTEE]
    if not av or not ap: return None
    a = max(av, key=lambda r: r[0]); b = min(ap, key=lambda r: r[0]); t = -a[0] / (b[0] - a[0])
    return {'left': [a[3 + i] + t * (b[3 + i] - a[3 + i]) for i in range(3)], 'right': [a[6 + i] + t * (b[6 + i] - a[6 + i]) for i in range(3)], 'portee': max(-a[0], b[0])}
def monde(x, pos_scene, s):
    """Scène → monde : translation lue sur la ligne du cut (départ ESV) = bords de la liste à l'indice 0 moins la position scène du départ."""
    r0 = next((r for r in x['voisinage'] if r[0] == 0), None)
    if not r0: return None
    d = x['scene']['depart'][s]; w = r0[3:6] if s == 'left' else r0[6:9]
    return [pos_scene[i] + (w[i] - d[i]) for i in range(3)]
def ecarts(x):
    """Pour chaque rail : écart de la pose et de la vérité à la prédiction, projeté sur l'axe latéral du rail (approché par la direction
    gauche→droite de la paire prédite, horizontale) et en hauteur (z)."""
    p = prediction(x)
    if not p or not x['scene'].get('verite'): return None
    gd = np.array(p['right']) - np.array(p['left']); gd[2] = 0; gd /= np.linalg.norm(gd) or 1
    out = {'portee': p['portee']}
    for s in SIDES:
        wp = monde(x, x['scene']['pose'][s], s); wv = monde(x, x['scene']['verite'][s], s)
        if wp is None: return None
        dp = np.array(wp) - np.array(p[s]); dv = np.array(wv) - np.array(p[s])
        out[s] = {'poseLat': float(dp @ gd), 'poseVert': float(dp[2]), 'veriteLat': float(dv @ gd), 'veriteVert': float(dv[2])}
    return out
E = {}
for x in L:
    e = ecarts(x)
    if e: E[(x['nom'], x['cut'])] = e
print(f"cuts de la chaîne jugés : {len(L)} ; avec prédiction (lignes saines à ≤ {PORTEE} cuts des deux côtés) : {len(E)} ({100*len(E)/len(L):.0f} %)")
X = [x for x in L if (x['nom'], x['cut']) in E]
vl = np.array([abs(E[(x['nom'], x['cut'])][s]['veriteLat']) for x in X for s in SIDES]); vv = np.array([abs(E[(x['nom'], x['cut'])][s]['veriteVert']) for x in X for s in SIDES])
pl = np.array([abs(E[(x['nom'], x['cut'])][s]['poseLat']) for x in X for s in SIDES])
print(f"  |vérité − prédiction| en travers : médiane {np.median(vl):.1f} mm, p90 {np.quantile(vl,.9):.1f}, > 10 mm {100*(vl>10).mean():.0f} % ; en hauteur : médiane {np.median(vv):.1f}, p90 {np.quantile(vv,.9):.1f}")
print(f"  |pose − prédiction| en travers : médiane {np.median(pl):.1f} mm, p90 {np.quantile(pl,.9):.1f}, > 10 mm {100*(pl>10).mean():.0f} %")
M = [x for x in X if x['mm'] > 10 and max(abs(x['err'][s][1]) for s in SIDES) > 10]
print(f"  cuts > 10 mm latéral avec prédiction : {len(M)} ; pour eux, |vérité − prédiction| du rail faux (médiane) : {np.median([abs(E[(x['nom'], x['cut'])][max(SIDES, key=lambda s: abs(x['err'][s][1]))]['veriteLat']) for x in M]) if M else float('nan'):.1f} mm ; |pose − prédiction| du rail faux : {np.median([abs(E[(x['nom'], x['cut'])][max(SIDES, key=lambda s: abs(x['err'][s][1]))]['poseLat']) for x in M]) if M else float('nan'):.1f}")
for lot in lots:
    Y = [x for x in X if x['nom'] == lot]
    if len(Y) < 10: continue
    a = np.array([abs(E[(x['nom'], x['cut'])][s]['veriteLat']) for x in Y for s in SIDES])
    print(f"    {lot:14} n={len(Y):4} (sur {sum(1 for x in L if x['nom']==lot)}) : |vérité − prédiction| travers médiane {np.median(a):.1f}, > 10 {100*(a>10).mean():.0f} %")
def corr_de(T):
    def f(x):
        e = E.get((x['nom'], x['cut']))
        if not e: return None
        loin = [s for s in SIDES if abs(e[s]['poseLat']) > T]; pres = [s for s in SIDES if abs(e[s]['poseLat']) <= T / 2]
        if len(loin) != 1 or len(pres) != 1: return None
        s = loin[0]
        # ramener le rail à la prédiction : déplacement latéral (monde, le long de gauche→droite) → repère profil du rail via sensLat (+ = élargit)
        d = -e[s]['poseLat'] * (1 if s == 'right' else -1)  # vers l'extérieur de la paire si positif
        return {s: [d * x['sensLat'][s], 0.0], ('right' if s == 'left' else 'left'): [0.0, 0.0]}
    return f
def score(Y, f): return float(np.mean([r[1] for r in appliquer(Y, f)]))
pool = []; choix = {}
for k in lots:
    test = [x for x in L if x['nom'] == k]; train = [x for x in L if x['nom'] != k]
    best = min((8, 10, 15, 20, 30), key=lambda T: score(train, corr_de(T))); choix[k] = best
    pool += appliquer(test, corr_de(best))
print(texte(juger(pool, f'piste 2 : rail ramené à la continuité des lignes saines (jeux {jeux}, portée {PORTEE}, LOLO, {len(lots)} lots)'))); print('  seuils choisis :', choix)
def corr_oracle(T):
    def f(x):
        e = E.get((x['nom'], x['cut']))
        if not e: return None
        s = max(SIDES, key=lambda s: abs(x['err'][s][1]))
        if abs(e[s]['poseLat']) <= T: return None
        d = -e[s]['poseLat'] * (1 if s == 'right' else -1)
        return {s: [d * x['sensLat'][s], 0.0], ('right' if s == 'left' else 'left'): [0.0, 0.0]}
    return f
print(texte(juger(appliquer(L, corr_oracle(10)), 'ORACLE (rail faux connu, seuil 10) : borne haute, PAS un gain')))

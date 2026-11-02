"""CH-042 : correction d'écartement des poses de la CHAÎNE à la référence de la liste d'ESV (lignes valides non touchées, L1-e), LOLO.
Règle candidate : si |écartement de la pose − référence| est entre Tmin et Tmax, déplacer UN rail en travers pour ramener la paire à la référence.
Choix du rail (sans nuage ici) : règle R parmi { 'flanc' : le rail au moins de points de flanc ; 'dessus' : le moins de points de dessus ;
'droit' / 'gauche' : toujours le même ; 'loin' : le rail le plus déplacé depuis le départ }. Tmin, Tmax et R choisis sur les autres lots (LOLO imbriqué).
Hors nuage : aucune vérification du soutien à la nouvelle place (à faire au banc si la piste tient). Les cuts sans référence ne sont pas touchés."""
import sys, os, numpy as np, itertools
sys.path.insert(0, os.path.dirname(__file__))
from ch042lib import charger, appliquer, juger, texte, SIDES
CH = ('first-pass', 'window', 'choice', 'crossing')
L = charger(sys.argv[1]); jeux = sys.argv[2] if len(sys.argv) > 2 else 'AB'
L = [x for x in L if x['etage'] in CH and x['nom'][0] in jeux and x.get('gauges') and x.get('sensLat')]
lots = sorted(set(x['nom'] for x in L))
def rail_de(x, R):
    r = x['rails']
    if R == 'flanc': return 'left' if (r['left']['pointsFlanc'] or 0) <= (r['right']['pointsFlanc'] or 0) else 'right'
    if R == 'dessus': return 'left' if (r['left']['pointsDessus'] or 0) <= (r['right']['pointsDessus'] or 0) else 'right'
    if R == 'loin': return 'left' if abs(x['deplacement']['left'][1]) >= abs(x['deplacement']['right'][1]) else 'right'
    return R
def corr_de(Tmin, Tmax, R):
    def f(x):
        ref = x.get('refListe')
        if not ref: return None
        e = ref['mm'] - x['gauges']['pose']  # > 0 : la paire est trop étroite, il faut élargir
        if abs(e) < Tmin or abs(e) > Tmax: return None
        s = rail_de(x, R)
        return {s: [e * x['sensLat'][s], 0.0], ('right' if s == 'left' else 'left'): [0.0, 0.0]}
    return f
def score(X, f): return float(np.mean([r[1] for r in appliquer(X, f)]))
GR = [(Tmin, Tmax, R) for Tmin in (5, 8, 10, 15) for Tmax in (30, 40, 60) for R in ('flanc', 'dessus', 'loin', 'left', 'right')]
pool = []; choix = {}
for k in lots:
    test = [x for x in L if x['nom'] == k]; train = [x for x in L if x['nom'] != k]
    best = min(GR, key=lambda g: score(train, corr_de(*g)))
    choix[k] = best
    pool += appliquer(test, corr_de(*best))
s = juger(pool, f'écartement → référence de la liste (jeux {jeux}, LOLO imbriqué, {len(lots)} lots)')
print(texte(s)); print('  choix par pli :', choix)
# en échantillon, chaque règle fixe (lecture seulement)
print('\nlecture en échantillon (pas un gain) :')
for g in GR:
    r = appliquer(L, corr_de(*g)); av = np.mean([a for a, *_ in r]); ap = np.mean([b for _, b, *_ in r])
    print(f"  Tmin {g[0]:2} Tmax {g[1]:2} rail {g[2]:6} : touchés {sum(1 for q in r if q[4]):3}, moyenne {av:.2f} -> {ap:.2f}, >10 {sum(1 for a,*_ in r if a>10)} -> {sum(1 for _,b,*_ in r if b>10)}, dégradés >5 {sum(1 for a,b,*_ in r if b-a>5)}, acceptations déplacées >2 {sum(1 for a,b,d,x,c in r if x['geste']=='acceptation' and d>2)}")

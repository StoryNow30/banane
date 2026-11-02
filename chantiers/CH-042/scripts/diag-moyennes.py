"""CH-042 : où sont les cuts à plus de 10 mm (moyennes et fautes) : axe, étage, version, lot, zone, appuis, déplacement, signaux du choix."""
import sys, os, numpy as np, collections
sys.path.insert(0, os.path.dirname(__file__))
from ch042lib import charger, SIDES
L = charger(sys.argv[1])
CH = ('first-pass', 'window', 'choice', 'crossing')
def axe(x):
    lat = max(abs(x['err'][s][1]) for s in SIDES); vert = max(abs(x['err'][s][2]) for s in SIDES)
    return 'lat' if lat > 10 and lat >= vert else 'vert' if vert > 10 else 'mixte'
def recent(x): return tuple(int(v) for v in x['version'].split('.')) >= (4, 9, 5, 21)
M = [x for x in L if x['mm'] > 10]
print(f"jugés {len(L)}, > 10 mm {len(M)} ({100*len(M)/len(L):.1f} %), dont fautes {sum(1 for x in M if x['mm']>50)}")
for titre, F in (('tous', lambda x: True), ('versions ≥ .21 (jeu A)', recent)):
    X = [x for x in M if F(x)]; T = [x for x in L if F(x)]
    print(f"\n--- {titre} : {len(X)} > 10 mm sur {len(T)} jugés")
    print('  par axe dominant :', collections.Counter(axe(x) for x in X))
    print('  par étage (>10 / jugés de l\'étage) :', {e: f"{sum(1 for x in X if x['etage']==e)}/{sum(1 for x in T if x['etage']==e)}" for e in CH + ('deferred',)})
    print('  par axe × étage chaîne/gcv2 :', collections.Counter((('gcv2' if x['etage']=='deferred' else 'chaine'), axe(x)) for x in X))
    print('  par lot :', {k: f"{sum(1 for x in X if x['nom']==k)}/{sum(1 for x in T if x['nom']==k)}" for k in sorted(set(x['nom'] for x in T))})
    print('  par appuis (chaîne) :', {a: f"{sum(1 for x in X if x['etage']!='deferred' and x['appuis']==a)}/{sum(1 for x in T if x['etage']!='deferred' and x['appuis']==a)}" for a in (0, 1, 2)})
    zone = lambda x: 'pn' if x.get('zone') and x['zone'].get('pn') else 'adv' if x.get('zone') and x['zone'].get('adv') else 'ligne'
    print('  par zone :', {z: f"{sum(1 for x in X if zone(x)==z)}/{sum(1 for x in T if zone(x)==z)}" for z in ('pn', 'adv', 'ligne')})
    dep = lambda x: max(abs(x['deplacement'][s][1]) for s in SIDES) if x['deplacement'] else None
    for lo, hi in ((0, 5), (5, 15), (15, 40), (40, 80), (80, 1e9)):
        n = sum(1 for x in T if dep(x) is not None and lo <= dep(x) < hi); k = sum(1 for x in X if dep(x) is not None and lo <= dep(x) < hi)
        print(f"  déplacement latéral depuis le départ [{lo},{hi}) : {k}/{n}")
    # chaîne : latéral > 10 : l'erreur est-elle la même sur les deux rails (translation) ou un seul rail (écartement) ?
    C = [x for x in X if x['etage'] != 'deferred' and axe(x) == 'lat']
    tr = sum(1 for x in C if abs(x['err']['left'][1] - x['err']['right'][1]) < 5)
    print(f"  chaîne, latéral > 10 : {len(C)} dont translation des deux rails (écart entre rails < 5 mm) {tr}, un seul rail {len(C)-tr}")
    V = [x for x in X if x['etage'] != 'deferred' and axe(x) == 'vert']
    print(f"  chaîne, vertical > 10 : {len(V)} ; groupes des rails fautifs :", collections.Counter(x['rails'][s]['groupe'] for x in V for s in SIDES if abs(x['err'][s][2]) > 10))
    # signaux du choix pour window/choice
    W = [x for x in T if x['etage'] in ('window', 'choice')]
    for s in SIDES:
        pass
    ch = [(x['mm'] > 10, x['rails']['left']['chosen'] or x['rails']['right']['chosen']) for x in W]
    print('  window/choice : rang du candidat choisi (rank) > 0 :', f"{sum(1 for m, c in ch if c and c['rank']>0 and m)}/{sum(1 for m, c in ch if c and c['rank']>0)} (>10/n) ; rank 0 : {sum(1 for m, c in ch if c and c['rank']==0 and m)}/{sum(1 for m, c in ch if c and c['rank']==0)}")
    # première passe : lossRatio / confiance pas consignés ; appuis

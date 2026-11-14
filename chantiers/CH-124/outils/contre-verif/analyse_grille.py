# -*- coding: utf-8 -*-
import sys, json, collections
import numpy as np
GA = [2, 3, 4, 5, 6, 7, 8, 10, 12]; GW = [1, 2, 4, 6, 8, 10, 12, 15, 18, 22]
PERTES = ['l1c30', 'l1', 'l2', 'l2c100', 'med', 'q99']
DOUBLONS = ('0511-p9-r2', '0811b-p6-r2')
ARTEFACTS = {('1211-p23-r1', 5494), ('1211-p23-r1', 5499)}      # pose finale = pose par défaut (1500,0 mm), visite sans action
def charger(f): return json.load(open(f))
def ecarts(R, choix):
    """choix : clé de lot-partie -> clé de grille. Rend la liste des cuts jugés avec fin/ari (mm)."""
    out = []
    for k, r in R.items():
        g = r['grille'][choix[k]]
        for c, axe in zip(r['cuts'], g.get('axe', [])):
            out.append(dict(cle=k, cut=c['cut'], classe=c['classe'], exclu=c['exclu'], zone=c['zone'], fin=c['qf'] - axe, ari=None if c['qa'] is None else c['qa'] - axe,
                            artefact=(k, c['cut']) in ARTEFACTS))
    return out
def resume(E, titre, detail=False):
    J = [e for e in E if e['exclu'] is None and not e['artefact']]
    f = np.array([abs(e['fin']) for e in J]); mv = [e for e in J if e['classe'] == 'mauvaise-voie']
    a = np.array([abs(e['ari']) for e in mv]); fm = np.array([abs(e['fin']) for e in mv])
    X = [e for e in E if e['exclu'] is not None]; fx = np.array([abs(e['fin']) for e in X])
    ju = np.array([abs(e['ari']) for e in J if e['classe'] in ('juste', '10-50') and e['ari'] is not None])
    s = '%s : jugés n=%d méd %.1f q90 %.1f q99 %.1f max %.1f ; >40 : %d ; >60 : %d | mauvaise-voie : Ariane>120 : %d/%d (min %.0f), désignées (et finale<40) : %d, finale plus près : %d | Ariane juste/10-50 >40 : %d/%d, >120 : %d | D-285 n=%d >40 : %d max %.0f' % (
        titre, len(f), np.median(f), np.quantile(f, .9), np.quantile(f, .99), f.max(), (f > 40).sum(), (f > 60).sum(), (a > 120).sum(), len(a), a.min() if len(a) else float('nan'),
        ((a > 120) & (fm < 40)).sum(), (fm < a).sum(), (ju > 40).sum(), len(ju), (ju > 120).sum(), len(fx), (fx > 40).sum(), fx.max() if len(fx) else float('nan'))
    print(s)
    if detail:
        J.sort(key=lambda e: -abs(e['fin']))
        print('    pires :', [(e['cle'], e['cut'], round(e['fin'], 1), e['classe'], e['zone']) for e in J[:8]])
    return dict(n=len(f), med=float(np.median(f)), max=float(f.max()), n40=int((f > 40).sum()), n60=int((f > 60).sum()), des=int(((a > 120) & (fm < 40)).sum()))
def meilleur(r, perte, sens=None, restreint=None):
    best = None
    for key, g in r['grille'].items():
        s, a, w = key.split(','); a = float(a); w = float(w)
        if a == 0: continue
        if restreint and not restreint(a, w): continue
        if best is None or g['pertes'][perte] < best[1]: best = (key, g['pertes'][perte])
    return best
if __name__ == '__main__':
    R = charger(sys.argv[1])
    temoin = {k: '1,0,10' for k in R}
    resume(ecarts(R, temoin), 'TÉMOIN a=0 (axe = trajectoire + constante locale)', True)
    print()
    for pe in PERTES:
        choix = {k: meilleur(R[k], pe)[0] for k in R}
        resume(ecarts(R, choix), 'PAR PARTIE, perte %s' % pe, pe in ('l1c30',))
        if pe in ('l1c30', 'l2'): print('    paramètres retenus (sens,a,w) :', {k: choix[k] for k in R if k not in DOUBLONS})
    print()
    # paramètres globaux : coût cumulé sur les listes (sens choisi par liste)
    for pe in PERTES:
        tab = {}
        for a in GA:
            for w in GW:
                tot = 0; choix = {}
                for k, r in R.items():
                    cs = {s: r['grille']['%d,%g,%g' % (s, a, w)]['pertes'][pe] for s in (1, -1)}
                    s = min(cs, key=cs.get); choix[k] = '%d,%g,%g' % (s, a, w)
                    if k not in DOUBLONS: tot += cs[s] * (r['n_vc'] if pe in ('l1c30', 'l1') else 1)
                tab[(a, w)] = (tot, choix)
        (a, w), (tot, choix) = min(tab.items(), key=lambda kv: kv[1][0])
        resume(ecarts(R, choix), 'GLOBAL (a=%g, w=%g), perte %s cumulée' % (a, w, pe), pe == 'l1c30')
        if pe == 'l1c30':
            print('    sens par liste :', {k: int(choix[k].split(',')[0]) for k in R if k not in DOUBLONS})
            print('    coût cumulé relatif au minimum, lignes a=%s, colonnes w=%s' % (GA, GW))
            for a2 in GA: print('     a=%4g ' % a2 + ' '.join('%5.3f' % (tab[(a2, w2)][0] / tot) for w2 in GW))
            print('    cuts jugés > 40 mm / désignées sur 30, même grille')
            for a2 in GA:
                ligne = []
                for w2 in GW:
                    E = ecarts(R, tab[(a2, w2)][1]); J = [e for e in E if e['exclu'] is None and not e['artefact']]
                    n40 = sum(1 for e in J if abs(e['fin']) > 40); des = sum(1 for e in J if e['classe'] == 'mauvaise-voie' and abs(e['ari']) > 120 and abs(e['fin']) < 40)
                    ligne.append('%3d/%2d' % (n40, des))
                print('     a=%4g ' % a2 + ' '.join(ligne))

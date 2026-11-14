# -*- coding: utf-8 -*-
import sys, json
import numpy as np
sys.path.insert(0, '/root/contre-verif')
from analyse_grille import *
def fixe(R, a, w, perte='l1c30', inverse=False):
    choix = {}
    for k, r in R.items():
        cs = {s: r['grille']['%d,%g,%g' % (s, a, w)]['pertes'][perte] for s in (1, -1)}
        s = min(cs, key=cs.get); choix[k] = '%d,%g,%g' % (-s if inverse else s, a, w)
    return choix
if __name__ == '__main__':
    ref = None
    for nom, f in (('départ (fenêtre ±200)', 'grille_depart.json'), ('exportée telle quelle (F2)', 'grille_exportee.json'), ('rangs à part (F3)', 'grille_propre_court.json'),
                   ('sans épinglage aux poses par défaut', 'grille_sansdefaut_court.json'), ('fenêtre ±50', 'grille_depart_fen50_court.json'), ('fenêtre ±100', 'grille_depart_fen100_court.json'), ('fenêtre ±400', 'grille_depart_fen400_court.json')):
        R = charger(f)
        for (a, w) in ((5, 10), (4, 15), (6, 6), (8, 2)):
            E = ecarts(R, fixe(R, a, w)); resume(E, '%s, global a=%g w=%g' % (nom, a, w))
            if (a, w) == (5, 10):
                d = {(e['cle'], e['cut']): e for e in E}
                if ref is None: ref = d
                else:
                    df = np.array([abs(d[k]['fin'] - ref[k]['fin']) for k in ref if ref[k]['exclu'] is None])
                    print('     écart à la variante de départ, par cut jugé (a=5, w=10) : méd %.2f q99 %.2f max %.2f mm' % (np.median(df), np.quantile(df, .99), df.max()))
        print()
    R = charger('grille_depart.json')
    resume(ecarts(R, fixe(R, 5, 10, inverse=True)), 'SENS INVERSÉ, global a=5 w=10', True)
    resume(ecarts(R, {k: '1,0,10' for k in R}), 'TÉMOIN', False)

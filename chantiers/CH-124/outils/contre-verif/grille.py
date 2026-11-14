# -*- coding: utf-8 -*-
"""Grille (a, w, sens) par liste : pertes sur la voie courante seule et écarts des cuts jugés à l'axe. Usage : grille.py <variante> [fen]
Sortie : /root/contre-verif/grille_<variante>[_fenN].json — numéros de cut, mm, comptes."""
import sys, json, time
sys.path.insert(0, '/root/contre-verif')
import numpy as np
import ancre
from ancre import *
GA = [2, 3, 4, 5, 6, 7, 8, 10, 12]; GW = [1, 2, 4, 6, 8, 10, 12, 15, 18, 22]
PERTES = ['l1c30', 'l1', 'l2', 'l2c100', 'med', 'q99']

def prejuger(P, lignes):
    caps = P['D']['caps']; out = []
    for l in lignes:
        j = l['cut']; c = caps[j]; t = c['t']
        def lat(pose):
            pts = []
            for side in ('left', 'right'):
                rail = c['rails'][side]; Pm = np.array(rail['P']).reshape(4, 4).T[:3, :3]
                pts.append(np.array(rail['pos']) + Pm @ (np.array(pose[side]) / 1000.0) + t)
            return float(np.sum((((pts[0] + pts[1]) / 2)[:2] - P['T'][j]) * P['e'][j]) * 1000)
        out.append(dict(cut=j, classe=l['classe'], exclu=l['exclu'], zone=l['zone'], qf=lat(l['poseFinale']), qa=lat(l['poseAriane']) if l.get('poseAriane') else None,
                        qd=lat({'left': [0, 0, 0], 'right': [0, 0, 0]})))
    return out

def main():
    variante = sys.argv[1]; court = '--court' in sys.argv
    args = [x for x in sys.argv[2:] if x != '--court']
    if args: ancre.FEN = int(args[0])
    C = corpus(); res = {}
    for k in cles():
        m = meta(k); t0 = time.time(); P = preparer(k, variante)
        lignes = [l for l in C if l['lot'] == m['lot'] and l['partie'] == m['partie'] and l['rang'] == m['rang'] and l.get('poseFinale')]
        pj = prejuger(P, lignes); cuts = np.array([x['cut'] for x in pj], dtype=int)
        G = {}
        modeles = [(0, 10, 1)] + [(a, w, s) for s in (1, -1) for a in GA for w in GW]
        if court: modeles = [(0, 10, 1)] + [(a, w, s) for s in (1, -1) for (a, w) in ((5, 10), (4, 15), (6, 6), (8, 2), (8, 1), (7, 4))]
        for (a, w, s) in modeles:
            p = P['cin'].axe(a, w, s); r = P['q'] - p
            # pertes (calage local au pas de 8)
            cib = np.arange(0, P['n'], 8); med, nb = mediane_locale(r, P['vc'], cib)
            medi = np.interp(np.arange(P['n']), cib[np.isfinite(med)], med[np.isfinite(med)])
            rv = (r - medi)[P['vc']] * 1000
            d = dict(pertes={pe: perte_de(rv, pe) for pe in PERTES})
            if len(cuts):
                c0, nvc = mediane_locale(r, P['vc'], cuts)
                d['axe'] = [round(float(x), 2) for x in (p[cuts] + c0) * 1000]
            G['%d,%g,%g' % (s, a, w)] = d
        res[k] = dict(cuts=pj, grille=G, n_vc=int(P['vc'].sum()), n_dflt=int(P['dflt'].sum()), n=P['n'])
        print(k, 'jugés', len(pj), '%.0f s' % (time.time() - t0), flush=True)
    json.dump(res, open('/root/contre-verif/grille_%s%s%s.json' % (variante, '_fen' + args[0] if args else '', '_court' if court else ''), 'w'))
if __name__ == '__main__':
    main()

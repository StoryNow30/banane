"""CH-042 : lecture des tables par cut (hors dépôt) et jugement d'un levier de correction, en leave-one-lot-out.
Erreur signée d'un rail = vérité − pose (mm, repère profil du départ : [long, lat, vert]). Une correction c = [dlat, dvert] déplace la
pose : erreur après = erreur − c. Pire rail 3D = max des normes. Gestes de juger-lot : acceptation (contrôlé, bon), fine ≤ 10, moyenne ≤ 50, faute > 50.
Aucune vérité n'entre dans une correction : les fonctions de correction ne reçoivent que les signaux du lot."""
import json, glob, os, math
import numpy as np

SIDES = ('left', 'right')
GRAINE = 20261102

def charger(dossier, motif='*.jsonl', juges_seulement=True):
    lignes = []
    for f in sorted(glob.glob(os.path.join(dossier, motif))):
        for l in open(f):
            x = json.loads(l)
            if juges_seulement and not x.get('geste'):
                continue
            if x.get('geste') == 'fine' and x['mm'] is not None and x['mm'] < 0.05: x['geste'] = 'acceptation'  # validé sans mouvement
            lignes.append(x)
    return lignes

def err3d(e):
    return max(math.hypot(*e['left']), math.hypot(*e['right']))

def geste(mm, controle):
    if controle: return 'acceptation'
    v = round(mm * 1000) / 1000
    return 'fine' if v <= 10 else 'moyenne' if v <= 50 else 'faute'

def appliquer(lignes, correction):
    """correction(ligne) -> {'left':[dlat,dvert],'right':[dlat,dvert]} ou None. Rend la liste des (avant3d, apres3d, deplacement max, ligne, corr)."""
    out = []
    for x in lignes:
        c = correction(x)
        e = x['err']
        if not c:
            out.append((err3d(e), err3d(e), 0.0, x, None)); continue
        ap = {s: [e[s][0], e[s][1] - c[s][0], e[s][2] - c[s][1]] for s in SIDES}
        dep = max(math.hypot(*c[s]) for s in SIDES)
        out.append((err3d(e), err3d(ap), dep, x, c))
    return out

def bootstrap_moyenne_diff(av, ap, lots, B=10000, graine=GRAINE):
    """IC 95 % de la différence des moyennes (après − avant), bootstrap par cut stratifié par lot."""
    rng = np.random.default_rng(graine)
    d = np.asarray(ap) - np.asarray(av); lots = np.asarray(lots)
    idx = {l: np.where(lots == l)[0] for l in np.unique(lots)}
    res = np.empty(B)
    for b in range(B):
        s = 0.0; n = 0
        for l, ii in idx.items():
            t = rng.choice(ii, size=len(ii), replace=True); s += d[t].sum(); n += len(ii)
        res[b] = s / n
    return float(d.mean()), float(np.percentile(res, 2.5)), float(np.percentile(res, 97.5))

def bootstrap_quantile_diff(av, ap, lots, q, B=4000, graine=GRAINE):
    rng = np.random.default_rng(graine + 1)
    av = np.asarray(av); ap = np.asarray(ap); lots = np.asarray(lots)
    idx = {l: np.where(lots == l)[0] for l in np.unique(lots)}
    res = np.empty(B)
    for b in range(B):
        t = np.concatenate([rng.choice(ii, size=len(ii), replace=True) for ii in idx.values()])
        res[b] = np.quantile(ap[t], q) - np.quantile(av[t], q)
    return float(np.quantile(ap, q) - np.quantile(av, q)), float(np.percentile(res, 2.5)), float(np.percentile(res, 97.5))

def juger(resultats, titre='', seuil_vis=2.0, detail=True):
    """Critères du protocole § 0.5 sur une liste de (avant, apres, dep, ligne, corr)."""
    av = [r[0] for r in resultats]; ap = [r[1] for r in resultats]; lots = [r[3]['nom'] for r in resultats]
    n = len(av)
    acc = [r for r in resultats if r[3]['geste'] == 'acceptation']
    cor = [r for r in resultats if r[3]['geste'] != 'acceptation']
    m, lo, hi = bootstrap_moyenne_diff(av, ap, lots)
    med = bootstrap_quantile_diff([r[0] for r in cor], [r[1] for r in cor], [r[3]['nom'] for r in cor], .5) if cor else (0, 0, 0)
    p90 = bootstrap_quantile_diff(av, ap, lots, .9)
    fautes_nouv = sum(1 for a, b, *_ in resultats if a <= 50 < b)
    fautes_corr = sum(1 for a, b, *_ in resultats if a > 50 >= b)
    sup10_av = sum(1 for a, *_ in resultats if a > 10); sup10_ap = sum(1 for _, b, *_ in resultats if b > 10)
    acc_dep = sum(1 for r in acc if r[2] > seuil_vis)
    acc_eq_av = sum(1 for a, *_ in resultats if a <= seuil_vis); acc_eq_ap = sum(1 for _, b, *_ in resultats if b <= seuil_vis)
    degr5 = sum(1 for a, b, *_ in resultats if b - a > 5)
    touches = sum(1 for r in resultats if r[4])
    # cohérence entre lots
    parlot = {}
    for a, b, d, x, c in resultats:
        parlot.setdefault(x['nom'], []).append(b - a)
    touches_lot = {}
    for a, b, d, x, c in resultats:
        if c: touches_lot[x['nom']] = touches_lot.get(x['nom'], 0) + 1
    gros = {k: np.mean(v) for k, v in parlot.items() if len(v) >= 20 and touches_lot.get(k, 0) > 0}
    bons = sum(1 for v in gros.values() if v < 0); pires = max(gros.values()) if gros else 0
    crit = {
        'c1_moyenne': hi < 0, 'c1_mediane_ou_p90': med[2] < 0 or p90[2] < 0,
        'c2_fautes_moyennes': fautes_nouv == 0 and sup10_ap <= sup10_av,
        'c3_acceptations': (acc_dep / n * 100 <= 0.5 if n else True) and (acc_eq_ap >= acc_eq_av - 0.005 * n),
        'c4_lots': (bons >= 2 * len(gros) / 3 if gros else False) and pires <= 1.0,
        'c5_degrades5': degr5,
    }
    s = {'titre': titre, 'n': n, 'acceptations': len(acc), 'touches': touches,
         'moyenne_avant': float(np.mean(av)), 'moyenne_apres': float(np.mean(ap)), 'diff_moyenne': (m, lo, hi),
         'mediane_corriges_avant': float(np.median([r[0] for r in cor])) if cor else None, 'diff_mediane_corriges': med,
         'p90_avant': float(np.quantile(av, .9)), 'diff_p90': p90,
         'fautes_av': sum(1 for a in av if a > 50), 'fautes_nouvelles': fautes_nouv, 'fautes_corrigees': fautes_corr,
         'sup10_av': sup10_av, 'sup10_ap': sup10_ap,
         'acc_deplacees_sup%.0f' % seuil_vis: acc_dep, 'acc_eq_av': acc_eq_av, 'acc_eq_ap': acc_eq_ap, 'degrades_sup5': degr5,
         'lots_gagnants': f'{bons}/{len(gros)}', 'pire_lot_moyenne': float(pires), 'par_lot': {k: round(float(v), 2) for k, v in gros.items()},
         'criteres': crit, 'tient': all(v for k, v in crit.items() if k != 'c5_degrades5')}
    return s

def texte(s):
    L = [f"== {s['titre']} : n={s['n']} (acceptations {s['acceptations']}), cuts touchés {s['touches']}"]
    m, lo, hi = s['diff_moyenne']
    L.append(f"  erreur moyenne (pire rail 3D) {s['moyenne_avant']:.2f} -> {s['moyenne_apres']:.2f} mm ; diff {m:+.2f} [{lo:+.2f} ; {hi:+.2f}]")
    d = s['diff_mediane_corriges']; p = s['diff_p90']
    L.append(f"  médiane des corrigés {s['mediane_corriges_avant']} mm, diff {d[0]:+.2f} [{d[1]:+.2f} ; {d[2]:+.2f}] ; p90 {s['p90_avant']:.1f}, diff {p[0]:+.2f} [{p[1]:+.2f} ; {p[2]:+.2f}]")
    L.append(f"  fautes {s['fautes_av']} : nouvelles {s['fautes_nouvelles']}, corrigées {s['fautes_corrigees']} ; >10 mm {s['sup10_av']} -> {s['sup10_ap']} ; dégradés >5 mm {s['degrades_sup5']}")
    k = [k for k in s if k.startswith('acc_deplacees')][0]
    L.append(f"  acceptations déplacées >2 mm {s[k]} ({100*s[k]/s['n']:.2f} pt) ; ≤2 mm {s['acc_eq_av']} -> {s['acc_eq_ap']} ; lots gagnants {s['lots_gagnants']}, pire lot {s['pire_lot_moyenne']:+.2f} ; par lot {s['par_lot']}")
    L.append(f"  critères {s['criteres']} -> {'TIENT' if s['tient'] else 'ne tient pas'}")
    return '\n'.join(L)

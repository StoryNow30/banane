# -*- coding: utf-8 -*-
"""Contre-vérification CH-124 : mise en œuvre indépendante (trajectoire par cheminement de plan en plan, modèle cinématique, ancre).
Aucune coordonnée n'est imprimée : seulement des numéros de cut, des millimètres, des comptes."""
import sys, json
import numpy as np
sys.path.insert(0, '/root/contre-verif')
from commun import *
from numpy.lib.stride_tricks import sliding_window_view

FEN = 200           # demi-fenêtre du calage local (cuts)
G_MIN, G_MAX = 1428.0, 1446.0

def plans(ed):
    """Plans de coupe verticaux en projection horizontale : point m (milieu des deux bords), e (unitaire, de droite vers gauche), nr (normale, vers les cuts croissants)."""
    G = ed[:, :3]; D = ed[:, 3:]
    m = ((G + D) / 2)[:, :2]
    u = (G - D)[:, :2]; e = u / np.linalg.norm(u, axis=1, keepdims=True)
    nr = np.stack([e[:, 1], -e[:, 0]], axis=1)
    d = m[1:] - m[:-1]
    sg = np.sign(np.median(np.sum(d * nr[:-1], axis=1)))
    return m, e, nr * sg

def cumul(m, e, nr):
    """Cheminement : pas du plan i au plan i+1 le long de (n_i + n_{i+1}), jusqu'au plan i+1. Le travers est conservé à un terme près alpha_i
    (bêta = 1 exactement) : y_{i+1} = y_i + alpha_i, y = travers de la courbe cheminée par rapport au milieu m_i de la ligne."""
    d = m[1:] - m[:-1]
    den = 1 + np.sum(nr[:-1] * nr[1:], axis=1)
    alpha = -np.sum(d * e[1:], axis=1) + (np.sum(d * nr[1:], axis=1) / den) * np.sum(nr[:-1] * e[1:], axis=1)
    return np.concatenate([[0.0], np.cumsum(alpha)])

def ecartement(ed):
    return np.linalg.norm(ed[:, 3:] - ed[:, :3], axis=1) * 1000

def defauts(ed):
    return np.abs(ecartement(ed) - 1500.0) <= 0.06

def trajectoire(S, dflt):
    """Travers y de la trajectoire par rapport aux milieux des lignes : nul aux poses par défaut, erreur de fermeture répartie linéairement entre deux poses par défaut."""
    idx = np.flatnonzero(dflt); n = len(S)
    if len(idx) == 0:
        return S - np.median(S)
    return S - np.interp(np.arange(n), idx, S[idx])

def mediane_locale(r, masque, cibles, fen=FEN, exclure_soi=False):
    """Médiane de r sur les lignes du masque à ±fen cuts de chaque cible."""
    n = len(r); x = np.where(masque, r, np.nan)
    pad = np.concatenate([np.full(fen, np.nan), x, np.full(fen, np.nan)])
    W = sliding_window_view(pad, 2 * fen + 1)[cibles]
    if exclure_soi:
        W = W.copy(); W[:, fen] = np.nan
    with np.errstate(all='ignore'):
        med = np.nanmedian(W, axis=1)
    return med, np.sum(np.isfinite(W), axis=1)

class Cinematique:
    """Deux pivots sur l'axe de la voie, distants de w ; point de référence R en porte-à-faux de a au-delà du pivot proche P1 :
    R = P1 + a (P1 - P2)/w, soit P1 = (w R + a P2)/(a + w), P2 étant le point de l'axe à w derrière P1 (déjà parcouru par P1).
    Série : C(s) = somme_k g_k R(s - sens k w), g_k = w/(a+w) (a/(a+w))^k ; C(s) se trouve vers l'abscisse s - sens a."""
    def __init__(self, T, m, e, nr):
        self.T = T; self.m = m; self.e = e; self.nr = nr
        ds = np.linalg.norm(np.diff(T, axis=0), axis=1); s = np.concatenate([[0], np.cumsum(ds)])
        K = 400
        t0 = (T[5] - T[0]); t0 /= np.linalg.norm(t0); t1 = (T[-1] - T[-6]); t1 /= np.linalg.norm(t1)
        av = T[0] - np.arange(K, 0, -1)[:, None] * t0; ap = T[-1] + np.arange(1, K + 1)[:, None] * t1
        self.sx = np.concatenate([s[0] - np.arange(K, 0, -1), s, s[-1] + np.arange(1, K + 1)])
        self.X = np.concatenate([av, T, ap]); self.s = s
    def R(self, s):
        return np.stack([np.interp(s, self.sx, self.X[:, 0]), np.interp(s, self.sx, self.X[:, 1])], axis=-1)
    def C(self, s, a, w, sens):
        """Somme en écarts à R(s) (les coordonnées monde sont grandes : une série tronquée en valeurs absolues perdrait des mètres)."""
        rho = a / (a + w); g = w / (a + w); R0 = self.R(s); out = np.zeros(s.shape + (2,)); k = 1; poids = rho; dern = None
        while True:
            dern = self.R(s - sens * k * w) - R0
            out += g * poids * dern
            poids *= rho; k += 1
            if abs(poids) < 1e-9 or k > 400: break
        out += (poids / (1 - rho)) * g * dern       # reste de la série géométrique, porté par le dernier terme
        return R0 + out
    def axe(self, a, w, sens):
        """Travers de l'axe prédit par rapport à la trajectoire, dans chaque plan de coupe (m), sans constante."""
        if a == 0:
            return np.zeros(len(self.s))
        s = self.s + sens * a
        for _ in range(4):
            c = self.C(s, a, w, sens)
            s = s - np.sum((c - self.m) * self.nr, axis=1)
        c = self.C(s, a, w, sens)
        return np.sum((c - self.T) * self.e, axis=1)

def preparer(cle, variante='depart'):
    """variante 'depart' : liste de départ reconstruite (cuts des lots de la partie remis à la pose de départ de la capture).
    'exportee' : liste exportée telle quelle (aucune ligne remise à son état de départ).
    'propre' : seuls les cuts du lot lui-même sont remis à leur pose de départ (rangs d'une même partie traités à part).
    'sansdefaut' : comme 'depart', mais la trajectoire n'est pas épinglée aux poses par défaut (cheminement seul, constante arbitraire).
    'lisse' : comme 'depart', orientation des plans lissée (médiane glissante du cap sur 5 lignes)."""
    D = depart(cle, seulement_propre=(variante == 'propre'))
    ed = D['ed_fin'] if variante == 'exportee' else D['ed']
    m, e, nr = plans(ed); S = cumul(m, e, nr)
    dflt = defauts(ed)
    y = trajectoire(S, dflt if variante != 'sansdefaut' else np.zeros(len(S), dtype=bool))
    T = m + y[:, None] * e
    g = ecartement(ed)
    vc = (D['st'] == 0) & (D['fl'] == 0) & (g >= G_MIN) & (g <= G_MAX)     # statut et drapeaux de la liste exportée
    q = -y                                                                 # milieu de la ligne par rapport à la trajectoire (m, + vers la gauche)
    return dict(D=D, ed=ed, m=m, e=e, nr=nr, S=S, dflt=dflt, y=y, T=T, vc=vc, q=q, n=len(S), cin=Cinematique(T, m, e, nr))

PERTE = 'l1c30'
def residus_vc(P, a, w, sens, pas=8):
    p = P['cin'].axe(a, w, sens); r = P['q'] - p
    cib = np.arange(0, P['n'], pas)
    med, nb = mediane_locale(r, P['vc'], cib)
    medi = np.interp(np.arange(P['n']), cib[np.isfinite(med)], med[np.isfinite(med)])
    return (r - medi)[P['vc']] * 1000

def perte_de(res, perte):
    x = np.abs(res)
    if perte == 'l1c30': return float(np.mean(np.minimum(x, 30.0)))
    if perte == 'l1': return float(np.mean(x))
    if perte == 'l2': return float(np.sqrt(np.mean(x ** 2)))
    if perte == 'l2c100': return float(np.sqrt(np.mean(np.minimum(x, 100.0) ** 2)))
    if perte == 'med': return float(np.median(x))
    if perte == 'q99': return float(np.quantile(x, 0.99))
    raise ValueError(perte)

def cout(P, a, w, sens, pas=8, perte=None):
    return perte_de(residus_vc(P, a, w, sens, pas), perte or PERTE)

def ajuster(P, grille_a=None, grille_w=None, perte=None, w_min=1.0, w_fixe=None):
    """Ajustement (a, w, sens) sur les seules lignes de voie courante."""
    perte = perte or PERTE
    grille_a = grille_a if grille_a is not None else [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15]
    grille_w = grille_w if grille_w is not None else [2, 3, 4, 6, 8, 10, 12, 15, 18, 22]
    if w_fixe is not None: grille_w = [w_fixe]
    grille_w = [w for w in grille_w if w >= w_min]
    f = lambda a, w, s: cout(P, a, w, s, perte=perte)
    best = (f(0, 10, 1), 0.0, 10.0, 1)
    for sens in (1, -1):
        for a in grille_a:
            for w in grille_w:
                c = f(a, w, sens)
                if c < best[0]: best = (c, a, w, sens)
    c0, a, w, sens = best
    if a > 0:   # affinage local
        pa, pw = max(a * 0.25, 0.25), (0 if w_fixe is not None else max(w * 0.25, 0.5))
        for _ in range(14):
            ame = False
            for da, dw in ((pa, 0), (-pa, 0), (0, pw), (0, -pw), (pa, -pw), (-pa, pw)):
                if da == 0 and dw == 0: continue
                a2, w2 = a + da, w + dw
                if a2 <= 0.05 or w2 < w_min or a2 > 30 or w2 > 40: continue
                c = f(a2, w2, sens)
                if c < c0 - 1e-6: c0, a, w = c, a2, w2; ame = True
            if not ame: pa /= 2; pw /= 2
    return dict(cout=c0, a=a, w=w, sens=sens, cout_temoin=f(0, 10, 1), perte=perte)

def juger(P, cle, lignes, modele):
    """Pour chaque cut jugé (ligne du corpus) : travers du milieu de la pose finale et de la pose d'Ariane par rapport à l'axe prédit (mm)."""
    a, w, sens = modele
    p = P['cin'].axe(a, w, sens); r = P['q'] - p
    caps = P['D']['caps']; out = []
    cuts = np.array([l['cut'] for l in lignes], dtype=int)
    med, nb = mediane_locale(r, P['vc'], cuts)
    for l, c0, nvc in zip(lignes, med, nb):
        j = l['cut']; c = caps[j]; t = c['t']
        def milieu(pose):
            pts = []
            for side in ('left', 'right'):
                rail = c['rails'][side]; Pm = np.array(rail['P']).reshape(4, 4).T[:3, :3]
                pts.append(np.array(rail['pos']) + Pm @ (np.array(pose[side]) / 1000.0) + t)
            return ((pts[0] + pts[1]) / 2)[:2]
        axe = p[j] + c0                                   # travers de l'axe prédit par rapport à la trajectoire
        lat = lambda pt: float(np.sum((pt - P['T'][j]) * P['e'][j]))
        o = dict(cle=cle, lot=l['lot'], partie=l['partie'], rang=l['rang'], cut=j, classe=l['classe'], exclu=l['exclu'], zone=l['zone'], nvc=int(nvc),
                 fin=(lat(milieu(l['poseFinale'])) - axe) * 1000 if l.get('poseFinale') else None,
                 ari=(lat(milieu(l['poseAriane'])) - axe) * 1000 if l.get('poseAriane') else None,
                 dep=(lat(milieu({'left': [0, 0, 0], 'right': [0, 0, 0]})) - axe) * 1000, cin=float(p[j] * 1000), cst=float(c0 * 1000))
        out.append(o)
    return out

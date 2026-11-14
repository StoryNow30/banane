# -*- coding: utf-8 -*-
"""Contre-vérification CH-124 : fonctions communes (lecture seule des données, aucune coordonnée imprimée)."""
import json, os, glob
import numpy as np

META = '/root/ch116/meta'
CORPUS = '/root/ch116/corpus.jsonl'

def cles():
    return sorted(os.path.basename(f)[:-5] for f in glob.glob(META + '/*.json'))

def meta(cle):
    return json.load(open(f'{META}/{cle}.json'))

def decompacter(snap):
    """Même lecture que src/liste-memoire.js : st, fl, ed (6 bords par ligne, dixième de mm, monde)."""
    assert snap.get('format') == 'ariane-liste-instantane-1'
    r = snap['r']; n = len(r)
    st = np.zeros(n, dtype=int); fl = np.zeros(n, dtype=int)
    ed = np.full((n, 6), np.nan)
    last = [None] * 6
    for i, row in enumerate(r):
        if not isinstance(row, list):
            st[i] = 3; continue
        sf = int(row[0] or 0)
        st[i] = sf & 3; fl[i] = (sf >> 2) & 3
        for j in range(6):
            v = row[1 + j] if len(row) > 1 + j else None
            if v is None or not isinstance(v, (int, float)) or not np.isfinite(v):
                continue
            last[j] = v if last[j] is None else last[j] + v
            ed[i, j] = last[j]
    return dict(n=n, st=st, fl=fl, ed=ed / 1e4, partie=snap.get('partie'), at=snap.get('at'))  # ed en mètres

def lire_liste(cle):
    m = meta(cle)
    return decompacter(json.load(open(m['liste'])))

def corpus():
    return [json.loads(l) for l in open(CORPUS)]

# ----------------------------------------------------------------------------- reconstruction de la liste de départ
def lire_cap(cle):
    return json.load(open(f'/root/contre-verif/cap/{cle}.json'))

def freres(cle):
    """Lots-parties qui partagent la même liste (même fichier) : rangs d'une même partie."""
    m = meta(cle)
    return [k for k in cles() if meta(k)['liste'] == m['liste']]

def depart(cle, verbeux=False, seulement_propre=False):
    """Rend la liste de DÉPART reconstruite : bords monde (m), et pour chaque cut des lots de la partie la pose de départ de la capture
    + translation scène → monde mesurée sur les lignes NON traitées (drapeau 1 absent) du lot. Les drapeaux/statuts restent ceux de la liste exportée,
    plus un masque `lot` (cut d'un lot de la partie). `seulement_propre` : ne remet à l'état de départ que les cuts du lot `cle` lui-même (rangs traités à part)."""
    L = lire_liste(cle)
    ed = L['ed'].copy(); n = L['n']
    lot = np.zeros(n, dtype=bool); lot_propre = np.zeros(n, dtype=bool)
    info = {}
    caps = {}
    for k in freres(cle):
        cap = lire_cap(k)
        T = []
        for c in cap:
            i = c['cut']
            if not (L['fl'][i] & 1):
                T.append(np.concatenate([L['ed'][i, :3] - np.array(c['rails']['left']['pos']), L['ed'][i, 3:] - np.array(c['rails']['right']['pos'])]))
        if len(T) == 0:
            raise RuntimeError(f'{k} : aucune ligne non traitée pour mesurer la translation')
        T = np.array(T)
        t = np.median(np.vstack([T[:, :3], T[:, 3:]]), axis=0)
        etendue = float(np.max(T.max(axis=0) - T.min(axis=0)) * 1000)
        info[k] = dict(n_non_traites=len(T), etendue_mm=etendue)
        for c in cap:
            i = c['cut']
            if k == cle or not seulement_propre:
                ed[i, :3] = np.array(c['rails']['left']['pos']) + t
                ed[i, 3:] = np.array(c['rails']['right']['pos']) + t
            lot[i] = True
            if k == cle:
                lot_propre[i] = True
                caps[i] = dict(c, t=t)
    L2 = dict(L, ed=ed, ed_fin=L['ed'], lot=lot, lot_propre=lot_propre, caps=caps, info=info)
    return L2

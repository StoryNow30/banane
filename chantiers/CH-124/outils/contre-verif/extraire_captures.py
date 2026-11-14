# -*- coding: utf-8 -*-
"""Réduit les captures d'un lot-partie à ce qui sert ici : par cut, pose de départ (scène relative) et matrices de profil.
Lit les fichiers un par un, un nuage à la fois (raw_decode). Sortie : /root/contre-verif/cap/<clé>.json (hors dépôt)."""
import json, sys, os, hashlib
sys.path.insert(0, '/root/contre-verif')
from commun import cles, meta

def nuages(fichier):
    s = open(fichier, encoding='utf-8').read()
    dec = json.JSONDecoder()
    i = s.index('[', s.index('"clouds"')) + 1
    n = len(s)
    while True:
        while i < n and s[i] in ' \t\r\n,':
            i += 1
        if i >= n or s[i] == ']':
            break
        obj, i = dec.raw_decode(s, i)
        yield obj

def reduire(c):
    r = {}
    for side in ('left', 'right'):
        x = c['rails'][side]
        r[side] = dict(pos=x['positionSceneRelative'], P=x['profileLocalToSceneRelative'], M=x['sceneRelativeToProfileLocal'],
                       po=x.get('profileOriginSceneRelative'), ax=x.get('profileAxisLengthsSceneUnits'), rl=x.get('railLocalToSceneRelative'))
    cb = c.get('coordinateBridge') or {}
    h = lambda v: hashlib.sha1(str(v).encode()).hexdigest()[:8] if v is not None else None
    return dict(cut=c.get('cut'), part=c.get('part'), at=c.get('capturedAt'), prov=c.get('railStateProvenance'), status=c.get('status'),
                rails=r, pont=cb.get('captureSceneRelativeToSessionSceneRelative'), cadre=h(cb.get('sceneFrameId')),
                session=h(c.get('sessionId')), n=len(c.get('pointsSceneRelative') or []), forme=c.get('shape'))

def main():
    os.makedirs('/root/contre-verif/cap', exist_ok=True)
    voulu = sys.argv[1:] or cles()
    for k in voulu:
        out = f'/root/contre-verif/cap/{k}.json'
        if os.path.exists(out):
            print(k, 'déjà fait'); continue
        m = meta(k); L = []
        for f in m['captures']:
            for c in nuages(f):
                L.append(reduire(c))
        json.dump(L, open(out, 'w'))
        print(k, len(L), 'nuages', 'cuts distincts', len(set(x['cut'] for x in L)), flush=True)

if __name__ == '__main__':
    main()

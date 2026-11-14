#!/usr/bin/env python3
"""CH-125 : range les lots d'octobre de la garde GCV2 dans BANANE_LOTS/<nom>/ (hors dépôt), d'après la base scellée
datasets/garde-gcv2/base-test18.json : pour chaque lot, le journal, les segments du corpus et la liste nommés dans la base sont tirés des
archives de la collection du lot (et de `listeSource` pour la liste), dans un clone de banane-data.
  python3 -I chantiers/CH-125/outils/ranger-oct.py CLONE_BANANE_DATA DOSSIER_BANANE_LOTS
Lecture seule sur le clone ; rien n'est écrit au dépôt. Affiche, par lot, le nombre de fichiers voulus et ceux qui manquent."""
import glob, json, os, sys, zipfile

if len(sys.argv) != 3:
    sys.exit(__doc__)
ICI = os.path.dirname(os.path.abspath(__file__))
base = json.load(open(os.path.join(ICI, '..', '..', '..', 'datasets', 'garde-gcv2', 'base-test18.json'), encoding='utf8'))
D, OUT = os.path.join(sys.argv[1], 'collections'), sys.argv[2]
for l in base['lots']:
    d = os.path.join(OUT, l['nom'])
    os.makedirs(d, exist_ok=True)
    F = l['fichiers']
    voulus = set([F['journal']] + F['corpus'] + ([F['liste']] if F.get('liste') else []))
    manquants = set(f for f in voulus if not os.path.exists(os.path.join(d, f)))
    for col in [l['collection']] + ([l['listeSource']] if l.get('listeSource') else []):
        for z in sorted(glob.glob(os.path.join(D, col, '**', '*.zip'), recursive=True)):
            if not manquants:
                break
            with zipfile.ZipFile(z) as Z:
                for n in Z.namelist():
                    if os.path.basename(n) in manquants:
                        with Z.open(n) as src, open(os.path.join(d, os.path.basename(n)), 'wb') as dst:
                            while True:
                                b = src.read(1 << 22)
                                if not b:
                                    break
                                dst.write(b)
                        manquants.discard(os.path.basename(n))
    print(l['nom'], 'fichiers', len(voulus), 'manquants', sorted(manquants))

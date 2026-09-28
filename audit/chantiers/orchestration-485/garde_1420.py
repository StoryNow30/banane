#!/usr/bin/env python3
"""Contre-calcul de la garde d'écartement bas (1 420 mm) sur les sorties du banc 4.8.5.

Relit, sans le code JavaScript, les fichiers de `tools/first-pass-signal-study.cjs`
(pp-*.json : règles « écart », pb-*.json : règles « bas ») et recalcule :
  - le faux (pire erreur > 10 mm, D-038) à partir de `worstMm`, comparé au drapeau `wrong` ;
  - la séparation par l'écartement des premiers passages sans appui appliqués ;
  - le bilan de la règle bas à 1 420 mm (faux avant / après, justes perdus) à partir
    des lignes, comparé au bilan consigné par l'outil.
Usage : python3 garde_1420.py DOSSIER_DU_BANC
"""
import json, sys, glob, os

dossier = sys.argv[1]
REGLE = 'sans-appui-ecart-bas-1420'
lignes, ecarts = [], []
for f in sorted(glob.glob(os.path.join(dossier, 'pb-[a-h].json'))):
    j = json.load(open(f))
    for s in j['sessions']:
        for r in s['base']['firstPass']:
            ft = r.get('feature') or {}
            lignes.append((s['label'], r, ft))
        v = s['variants'][REGLE]
        # Bilan recalculé depuis les lignes de la base et les listes de la variante.
        faux_base = set(s['base']['wrong'])
        apres = (faux_base - set(v['stoppedWrong'])) | set(v['newWrong'])
        if len(apres) != v['wrong']:
            ecarts.append(f"{s['label']} : faux après {len(apres)} ≠ outil {v['wrong']}")

# 1. Le drapeau « faux » suit-il la définition (> 10 mm) ?
incoherents = [(l, r['cut']) for l, r, _ in lignes
               if r.get('judged') and r.get('worstMm') is not None and (r['worstMm'] > 10) != bool(r['wrong'])]
# 2. Séparation par l'écartement, premiers passages sans appui appliqués.
sa = [(l, r, ft) for l, r, ft in lignes if ft.get('anchors') == 0 and r.get('applied')
      and isinstance(ft.get('gaugeMm'), (int, float))]
justes = sorted(ft['gaugeMm'] for _, r, ft in sa if r.get('judged') and r.get('wrong') is False)
faux = sorted((ft['gaugeMm'], l, r['cut']) for l, r, ft in sa if r.get('wrong'))
sous = [(l, r['cut'], ft['gaugeMm'], r.get('wrong')) for l, r, ft in sa if ft['gaugeMm'] < 1420]
print(f"lignes de premier passage : {len(lignes)} ; drapeaux « faux » incohérents avec > 10 mm : {len(incoherents)}")
print(f"premiers passages sans appui appliqués : {len(sa)} ; jugés justes : {len(justes)} ; faux : {len(faux)}")
print(f"  juste le plus serré : {justes[0]:.1f} mm ; faux : " + ', '.join(f'{c} ({l}) {g:.1f} mm' for g, l, c in faux))
print(f"  sous 1 420 mm : " + ', '.join(f'{c} ({l}) {g:.1f} mm {"faux" if w else "juste" if w is False else "non jugé"}' for l, c, g, w in sous))
print(f"  marge : {justes[0] - 1420:.1f} mm au-dessus du seuil, {1420 - max(g for g, _, _ in faux if g < 1420):.1f} mm en dessous")
print(f"bilans de l'outil recalculés : {'identiques' if not ecarts else '; '.join(ecarts)}")

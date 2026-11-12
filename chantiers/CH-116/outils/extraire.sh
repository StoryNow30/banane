#!/usr/bin/env bash
# CH-116 : extraction des exports de banane-data utiles au corpus (hors dépôt). Lecture seule.
#   DONNEES=<clone de banane-data, branche de documents> CH116_TRAVAIL=<dossier local> bash chantiers/CH-116/outils/extraire.sh
# Clone partiel conseillé (disque limité) : git clone --depth 1 --filter=blob:none --sparse … puis
#   git sparse-checkout set --no-cone '/collections/2026-11-0[4-8]_v5_*/raw/*' '/collections/2026-11-1[12]_*/raw/*'
# Après preparer.cjs, les segments bruts peuvent être effacés (preparer.cjs --effacer-segments) : seules restent les captures réduites.
set -euo pipefail
B="$DONNEES/collections"; X="${CH116_TRAVAIL:-$HOME/ch116}/x"
ex() { local d="$X/$1"; shift; mkdir -p "$d"; for z in "$@"; do unzip -oq "$z" -x CONTENU.txt -d "$d"; done; }
ex l0411 "$B"/2026-11-04_v5_lot-orbite-parties-6-15-et-echo/raw/*.zip
ex e0411 "$B"/2026-11-04_v5_echo-manuel-parties-10-13-14-15/raw/*.zip
ex l0511 "$B"/2026-11-05_v5_reference-avant-apprentissage/raw/*lot*.zip
ex e0511 "$B"/2026-11-05_v5_reference-avant-apprentissage/raw/*echo*.zip
ex l0611 "$B"/2026-11-06_v5_constellation-parties-13-16/raw/*lot*.zip
ex e0611 "$B"/2026-11-06_v5_constellation-parties-13-16/raw/*echo*.zip
ex l0811-16-13-46 "$B"/2026-11-08_v5_vision-echo/raw/*lot-2026-11-08T16-13-46*.zip
ex l0811-21-30-27 "$B"/2026-11-08_v5_vision-echo/raw/*lot-2026-11-08T21-30-27*.zip
ex e0811-p34 "$B"/2026-11-08_v5_vision-echo/raw/*echo-partie3-4*.zip
ex e0811-p6 "$B"/2026-11-08_v5_vision-echo/raw/*echo-partie6*.zip
ex l1111 "$B"/2026-11-11_v14_constellation-15-17/raw/*.zip
ex l1211 "$B"/2026-11-12_v15_constellations-21-23_0-4/raw/*.zip
for p in 0 1 2 15 16 17 23; do ex "e1211-p$p" "$B"/2026-11-12_v15_echo-partie$p/raw/*.zip; done
du -sh "$X"

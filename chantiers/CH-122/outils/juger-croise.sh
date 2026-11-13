#!/usr/bin/env bash
# CH-122 : rejeu de jugement en validation croisée. Chaque lot est rejoué avec le modèle de son pli (appris sans lui), puis les sorties sont réunies.
#   CH116_TRAVAIL=… bash chantiers/CH-122/outils/juger-croise.sh NOM DOSSIER_MODELES PATCH ['{"levier":valeur,…}']
#   (réglages v1 : NOM=A, modèles chantiers/CH-122/modeles/A, patch chantiers/CH-122/puce.patch)
set -euo pipefail
R=$(cd "$(dirname "$0")/../../.." && pwd); C=$1; DM=$2; PATCH=$3; EXTRA=${4:-'{}'}; W=${CH116_TRAVAIL:-$HOME/ch116}
mkdir -p "$W/rejeux/puce$C"
for L in 0411 0511 0611 0811a 0811b 1111 1211; do
  M=$(ls "$DM"/puce-*-$L.json)
  LEV=$(node -e "process.stdout.write(JSON.stringify({...JSON.parse(process.argv[1]),puce:JSON.parse(require('fs').readFileSync(process.argv[2],'utf8'))}))" "$EXTRA" "$M")
  node "$R/chantiers/CH-116/outils/banc.cjs" rejouer --nom "puce$C-$L" --lots "$L" --patch "$PATCH" --env "BANC_LEVIERS=$LEV" --jobs 3
  for f in "$W/rejeux/puce$C-$L"/*.jsonl; do ln -sf "$f" "$W/rejeux/puce$C/"; done
  rm -rf "$W/copies/puce$C-$L"
done

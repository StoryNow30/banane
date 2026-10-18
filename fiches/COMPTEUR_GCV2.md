# Compteur des cuts appris par la GCV2 (depuis le début de la 5.0)

Généré par `node tools/compteur-gcv2.cjs` (D-188). **Un cut corrigé = un cut appris** (Mic). Les SKIP ne sont pas comptés. Aucune limite : on ne s'arrête pas à 1 000 ou 1 500 cuts (Mic).

**Cuts corrigés : 1 631** (dont 1 023 de plus de 5 mm, 527 de plus de 10 mm). Avec les cuts validés tels quels (442) et les cuts visités sans action d'au moins 0,6 s (1 177) : **3 250 cuts apprenables**.

| File | Corrigés | Validés tels quels | Visités sans action | Apprenables |
|---|---:|---:|---:|---:|
| En apprentissage (en file) | 1 631 | 442 | 1 177 | 3 250 |
| Appris (GCV2 entraînée) | 0 | 0 | 0 | 0 |

| Projet | Partie | État | Cuts à l'Écho | Corrigés | dont > 5 mm | dont > 10 mm | Validés tels quels | Visités sans action | SKIP (non comptés) | Sans référence |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 24 | en-file | 263 | 180 | 154 | 106 | 14 | 20 | 0 | 49 |
| 1 | 12 | en-file | 108 | 55 | 35 | 31 | 42 | 8 | 0 | 3 |
| 1 | 13 | en-file | 224 | 74 | 38 | 29 | 57 | 75 | 1 | 17 |
| 1 | 29 | en-file | 821 | 605 | 404 | 122 | 109 | 78 | 0 | 29 |
| 2 | 1 | en-file | 765 | 340 | 232 | 166 | 87 | 192 | 6 | 140 |
| 2 | 10 | en-file | 21 | 12 | 3 | 1 | 6 | 3 | 0 | 0 |
| 2 | 11 | en-file | 546 | 77 | 40 | 25 | 26 | 224 | 3 | 216 |
| 1 (à confirmer) | 14 | en-file | 112 | 48 | 23 | 17 | 25 | 35 | 0 | 4 |
| 1 (à confirmer) | 15 | en-file | 524 | 107 | 35 | 9 | 27 | 356 | 2 | 32 |
| 1 (à confirmer) | 16 | en-file | 388 | 133 | 59 | 21 | 49 | 186 | 1 | 19 |

Une partie lue en plusieurs Échos (sessions, reprises) compte chaque cut une fois, d'après son dernier état observé.

## Comment lire ce compteur

- **Corrigé** = Mic a déplacé au moins un rail avant de valider (étiquette de l'Écho `VALIDATE_CORRECTED_*`), de quelque ampleur que ce soit : 1 023 des 1 631 dépassent 5 mm, 527 dépassent 10 mm ; les 608 autres sont des retouches de 5 mm ou moins.
- **En file / appris** : le dépôt ne sait pas quand la GCV2 est entraînée. Tout est donc « en file » (archivé, pas encore confirmé entraîné) ; on change `etat` dans `datasets/compteur-gcv2-sources.json` quand Mic confirme un entraînement, puis on relance l'outil.
- **Partie 15 : compte partiel.** L'export final n'a pas été envoyé ; les segments 11 à 18 et 32 manquent (524 cuts lus, 567 visites). Les cuts après 7601 (dont le PN 8137–8151 noté par Mic) ne sont pas dans les archives.
- **Parties 14, 15, 16 : projet 1 par déduction** (leur code de projet n'est pas celui des parties 10 et 11, du projet 2) ; à confirmer par Mic.
- **Jeu d'apprentissage d'Ariane et compteur GCV2 sont deux choses** : `datasets/manifeste-parties.json` dit quelles parties servent à régler Ariane ; ce compteur dit combien de cuts corrigés la GCV2 peut apprendre. Les parties reçues après le 16/10 restent réservées dans le manifeste (sauf la partie 11, D-187).
- Régénérer : `node tools/compteur-gcv2.cjs --donnees <banane-data> --sortie datasets/compteur-gcv2.json --md fiches/COMPTEUR_GCV2.md` (branche `claude/50-compteur-gcv2`), puis recopier la partie « Comment lire » à la main.

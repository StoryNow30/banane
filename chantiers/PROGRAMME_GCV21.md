# Programme « GCV2.1 » en continu (D-351, D-352)

Carnet tenu par l'intégrateur. Un chantier clos laisse sa place au suivant, sans attendre l'opérateur. Seuls les gains du calcul comptent (pas de rattrapage, pas d'ombre).

## Socle commun
- Corpus et banc : CH-116 (`chantiers/CH-116/outils/`, LISEZMOI ; sorties dans `banane-data/outils/analyse-lots/CH-116/`). 4 016 cuts, 25 lots-parties ; 545 posés jugés : 479 ≤ 10 mm, 36 de 10 à 50 mm, 30 mauvaises voies (toutes en ADV).
- Juge : celui de CH-113 (pire rail, 3D ; juste ≤ 10 mm ; mauvaise voie > 50 mm).
- Évaluation sans lot neuf : **validation croisée « un lot dehors »**. Tout réglage appris ou choisi l'est sur les autres lots ; le lot dehors n'est jugé qu'une fois. Puis garde de pose sur les 11 lots d'octobre (aucun recul). Puis Écho neuf.
- Tous les lots existants sont « vus » au sens de D-347 : un gain mesuré dessus reste PROBABLE jusqu'à l'Écho.
- **Examen vierge réservé (13/11)** : Échos du 12/11, parties 3 et 4 (`banane-data`, c163651). Aucun chantier de conception ne les lit ; seul le banc de CH-116 y juge, une fois, les réglages figés (C2 + C5 de CH-117 d'abord, puis ceux de CH-119 à CH-122). Ils rejoignent le corpus d'apprentissage après. **Second examen vierge (13/11)** : lot du 12/11 au soir, parties 6 à 18, et Écho du 13/11 (`banane-data`, 01e3d92), même règle.

## Examens vierges rendus
- **C2 + C5 de CH-117 (13/11, 12/11 p3 et p4, ÉTABLI)** : aucune mauvaise voie corrigée, un bon posé perdu en différé, aucune faute nouvelle. **Réglage refusé**, rien ne s'allume. Le détail par cut est réservé à l'intégrateur et au banc (`banane-data/outils/analyse-lots/CH-116/examen-vierge-1211-RESERVE/`) : ne pas le lire en conception.

- **CH-121 `aj3-final` (13/11, ÉTABLI)** : examen vierge réussi (1211v 14 → 17 justes, 1312v 144 → 147, 0 juste dégradé, 0 nouvelle mauvaise voie), MAIS **garde d'octobre ROUGE** (retour 1, 23 reculs) : le latéral de l'étage dégrade des poses GCV2 en ADV et crée une faute au-delà de 50 mm (0-2310 1372). **aj3-final écarté, non proposé à l'allumage.** Suite : `aj4`, étage vertical seul, nouveau réglage figé, à rejuger entièrement.

- **CH-121 `aj4-final`, vertical seul (13/11, ÉTABLI)** : validation croisée 95,5 % sur 7 lots (livré 93,2 %), 12 gagnés / 0 perdu. Examen vierge RÉUSSI : 1211v 14 → 17 justes, 1312v 144 → 144 (6 rapprochés, 1 éloigné resté juste) ; aucun juste dégradé, aucune nouvelle mauvaise voie. Poses de la chaîne déplacées en hauteur seule : 170 sur les examens (médiane 8-10 mm, max 12,1), 5 jugées, toutes rapprochées. **Garde d'octobre ROUGE** (retour 1, 16 reculs) : une nouvelle faute au-delà de 50 mm par ricochet (0-2310 1372, voisins ajustés), des poses GCV2 en ADV dégradées de 4 à 5 mm. **aj4 écarté.** Suite : `aj5` (poses de la chaîne seulement, voisins = pose de la décision, aucun ricochet), structure tirée de la garde d'octobre (déclaré), jugé par plis, par un examen vierge neuf et par le prochain Écho.
- **CH-119 réglage D (13/11, ÉTABLI)** : validation croisée 29 → 16 mauvaises voies, 0 nouvelle, mais **garde d'octobre ROUGE** (retour 1, 13 reculs) : 7 poses de la chaîne acceptées par l'opérateur reposées par la GCV2 à 150-230 mm (probables mauvaises voies nouvelles, même mode d'échec que C1 de CH-117), 1 juste dégradé (2-18 204, 2,0 → 11,5 mm). **D écarté.**
- **Examen vierge de D (13/11, ÉTABLI)** : aucun cut changé sur 1211v ni 1312v. Les deux seules mauvaises voies de ces examens sont hors ADV (zone `abords` au banc), là où D ne joue pas. Les examens vierges actuels ont peu de puissance pour juger un levier de voie en ADV.
- **Leçon commune (CH-117 C1, CH-119 D, CH-121 aj3)** : tout levier qui déplace ou remplace une pose de la chaîne a échoué à la garde d'octobre. Prochain réglage de voie : agir seulement quand le chemin passé est faible, et différer plutôt que reposer loin.

## Vague 2 (lancée le 13/11)
| Ticket | Levier | Cible écrite |
|---|---|---|
| CH-119 | Choix de voie global sur la zone (programmation dynamique sur le pool, continuité) | mauvaises voies 30 → ≤ 10 en validation croisée, 0 nouvelle |
| CH-120 | Pool d'hypothèses en ADV : faire entrer la bonne paire | rappel du pool mesuré, puis différés « classe C » et mauvaises voies réduits |
| CH-121 | Ajustement fin de la pose sur le profil du rail (latéral, vertical, écartement) | posés ≤ 10 mm : 90,5 % → ≥ 95 %, aucun juste dégradé au-delà de 10 mm |
| CH-122 | Puce apprise : classement des hypothèses et décision poser ou différer | à coût égal en différés, moins de fautes ; ou plus de posés justes à fautes égales |
| CH-123 | Les 17 % hors du pool, hors du terrain de CH-120 : hors ADV, filtres, repère, troncature, rail compagnon (demande de l'opérateur, 13/11) | au moins un tiers des 128 cuts passés en A, 0 nouvelle mauvaise voie |
| CH-124 | Ancre indépendante en ADV (repère du cut, trajectoire, voie amont, géométrie d'aiguillage), audit 1 | mauvaises voies 29 → ≤ 15 en validation croisée, 0 nouvelle, garde verte |
| CH-125 | Le calcul de pose à la source : gabarit du champignon, nuage de plusieurs coupes, écartement mesuré | ≤ 10 mm 93,2 % → ≥ 96 %, 0 juste dégradé, 0 ricochet, garde verte |

## Carnet (vague suivante, dans l'ordre)
1. Assemblage « GCV2.1 » : les leviers retenus ensemble, garde complète, parité, un seul réglage figé pour l'Écho.
2. Lissage de la trajectoire le long du lot (le rail est continu : courbure bornée), pour la précision et les poses isolées.
3. Écartement selon la courbure et la position dans l'aiguillage (surécartement), si CH-121 ne l'absorbe pas.
4. Calage vertical : séparateur de densité relative, figé avant le prochain Écho (CH-118 § 2).
5. Cuts non fidèles au banc en ADV (CH-113 § 3, CH-116 § 3) : comprendre l'écart rejeu / réel avant de régler dessus.

- Ordre de l'opérateur (13/11) : les chantiers difficiles se lancent au modèle le plus fort disponible, à l'effort maximal, et peuvent orchestrer plusieurs agents en parallèle.

## Suivi
| Ticket | Session | État |
|---|---|---|

## Règles communes à tous les chantiers du programme
- **Audit 1 (13/11, `chantiers/AUDIT_GCV21.md`)** : R1 la garde d'octobre AVANT la validation croisée complète ; R2 rien n'est annoncé à l'opérateur avant garde + plis + examen verts ; R3 poses de la chaîne et ricochets comptés à part ; R4 la puissance de l'examen dite ; R5 une seule définition des zones.
- Lis `CLAUDE.md`, D-222, D-347, D-351, D-352, ce fichier, puis les rapports CH-113, CH-116, CH-117, CH-118 (`chantiers/CH-1xx/rapport.md`).
- Fichiers de décision (`src/gcv2*.js`, `src/lot-decision.js`, `src/geometry*.js`, `src/engine.js`, `background.js`) : propositions en **patch éteint** (`chantiers/CH-NNN/*.patch`), clé à `false`/`null` ; à l'éteint, rejeu identique au code livré (à prouver).
- Banc de CH-116 pour tout jugement. Garde de pose (`node tools/garde-gcv2.cjs --rejouer`, lots d'octobre) et parité (`tools/parite-l1se-sw.cjs --passe`) sur le réglage final. Une tâche de fond meurt à 2 h : découpe les longues parités.
- **Cible chiffrée écrite et poussée avant le premier rejeu.** Réglage figé et poussé avant d'être jugé ; validation croisée « un lot dehors » ; un réglage retouché après jugement est un nouveau réglage.
- Pas de rattrapage, pas de fonction en ombre, pas d'interface : un gain du calcul ou rien.
- Si le levier ne donne rien, c'est un résultat : rapport court, raison mesurée, et ce qu'il faudrait tenter ensuite (l'intégrateur relance).
- Données : dépôt `StoryNow30/banane-data` (branche `claude/execute-prompt-00-18ra5a`, extraction partielle ; disque limité, efface ce qui ne sert plus). Sorties par cut (numéros et mm seulement) sous `chantiers/CH-NNN/sorties/` ; l'intégrateur les verse dans `banane-data`.
- Parle à l'intégrateur par `send_message` à `@parent`, priorité `next`, à chaque jalon (cible écrite, premier rejeu, réglage figé, jugement, rapport). Ton texte de fin de tour ne lui arrive jamais. Pas de question à l'opérateur. Pas de pull request.
| CH-119 | session_01Td4bNo4eR1qVikjgQstFMK | lancé le 13/11 |
| CH-120 | session_01Td4bNoyEG3tYZVkbFyajJh | lancé le 13/11 |
| CH-121 | session_01Td4bNk2uQhtkP6QNyX6Vtt | lancé le 13/11 |
| CH-122 | session_01Td4bNpCSzkuthJgvDsfevC | lancé le 13/11 |
| CH-123 | session_01Td4bNn28Kkosy5ce9nJTWa | lancé le 13/11 (demande de l'opérateur) |
| CH-124 | session_01Td4bNpSQ9399cdW28RY9eX | relancé le 13/11 au modèle le plus fort, effort maximal, orchestration multi-agents permise (ordres de l'opérateur ; deux sessions précédentes archivées sans rien avoir produit) |
| CH-125 | session_01Td4bNjx4xDBqL4deDLhkUV | relancé le 13/11 au modèle le plus fort, effort maximal, orchestration multi-agents permise (ordres de l'opérateur ; deux sessions précédentes archivées sans rien avoir produit) |

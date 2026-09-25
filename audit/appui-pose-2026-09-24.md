# Un appui est un cut posé — mesure (24/09)

**Origine** : relecture indépendante de la 4.7.16, constat B1
(`audit/chantiers/relecture-4716.md`), et chantier 5, question 2
(`audit/chantiers/acceptation.md`). Défaut : KI-057.

Jusqu'à la 4.7.17, la décision sur le lot proposait un appui dès qu'elle était
prise, avant la commande et quelle que soit son issue. Une reprise depuis la
voie dont la commande se repliait (cible hors de la vue d'ESV, écartement,
erreur), ou un cut repris ensuite à la main, servait quand même d'appui aux cuts
suivants. Le cahier dit pourtant « avec pour appuis les cuts déjà placés du même
lot » (amendement n°10).

**Règle 4.7.18** (`anchorRule:'placed'`, `lot-decision-v5`) : l'appui proposé
attend. Il n'entre dans la mémoire du lot qu'une fois ses positions commandées,
appliquées, et le cut validé par le Pilote (VALIDATE émis, navigation observée).
Un premier passage pose la paire du moteur ; une reprise depuis la voie n'est
posée que si sa commande est « lot » ; un choix n'est jamais appui.

**Banc** : 6 sessions Natif et 5 lots Pilote relus, règles de la 4.7.16 ; seule
la règle d'appui varie. S'y ajoute la partie 35 (4.7.12), sans relecture.

**Outils** : `tools/choice-anchor-study.cjs --option anchorRule=decided|placed`,
`tools/acceptance-report.cjs` (rejeu). Relevé : `audit/appui-pose-2026-09-24.json`.

## Comment le rejeu sait qu'un cut est posé

- **Décision rejouée identique à celle du lot, lot enregistré en « appliquer »** :
  on reprend ce que le Pilote a fait, c'est-à-dire sa commande consignée et
  l'issue de la visite (appliquée, VALIDATE accepté).
- **Sinon** (règles ou décision différentes, ou lot « observer » rejoué comme la
  version courante) : commande **simulée** (écartement admissible, cible dans la
  vue de la capture) et validation **supposée**. Ces cas sont marqués
  `anchorSimulated`.
- **Banc Natif** : les captures n'ont pas de caméra. La vue est supposée bonne ;
  seul l'écartement peut refuser.

## Résultats

| | Appui = décision (4.7.17) | Appui = cut posé (4.7.18) |
|---|---|---|
| Natif, 6 sessions : décidés, justes, faux | 472, 305, 3 | **identique** |
| Pilote, 5 lots relus : décidés, justes, faux | 239, 215, 1 | 232, 208, 1 |
| Partie 35, non relue : décidés | 206 | 205 |

**Décisions changées : 10, toutes sur deux lots.**

- **Partie 35 : 8952 et 8953**, le cas du relecteur. 8951, cible hors de la vue,
  n'est plus appui. 8952 reste un choix, appuyé sur 8949 seul ; 8953 est
  différé faute d'appui. Les deux étaient déjà différés sur le terrain (cibles
  hors de la vue).
- **Partie 2 : 114 à 121.** 113 et 114 sont des reprises dont la cible est hors
  de la vue : le Pilote ne pouvait pas les poser. Avec l'ancienne règle, elles
  portaient pourtant une chaîne de reprises, de 115 à 121. Avec la nouvelle,
  114 est repris sur 111 et 112, et 115 à 121 sont différés faute d'appui.

**Ce que le Pilote aurait réellement pu commander.** Le décompte « décidés » ne
tient pas compte de la vue. Recompté sur les 6 lots Pilote, en ne gardant que
les décisions commandables (écartement admissible ; cible dans la vue pour une
reprise ou un choix) :

| | Appui = décision | Appui = cut posé |
|---|---|---|
| Décisions commandables | 436 | 434 |
| dont jugées justes / faux | 209 / 1 | 207 / 1 |
| Perdues | — | **115 (1,45 mm) et 116 (2,59 mm)**, partie 2 |
| Gagnées | — | aucune |

De 117 à 121, les cibles étaient hors de la vue même avec l'ancienne règle : le
Pilote les aurait différées de toute façon. Le coût réel de la correction est
donc de **2 cuts justes sur 436 commandables, sans faux en plus ni en moins**.
Ce sont deux cuts qui n'avaient d'appuis que grâce au défaut.

**Conséquence sur un chiffre publié.** Le cas de la partie 2 (KI-054,
`audit/cas-decalage-esv-p2-2026-09-24.md`) disait : « la 4.7.15 aurait placé
115 et 116 justes ». Ce rejeu s'appuyait sur 113 et 114, hors de la vue : il
reposait sur le défaut B1. Avec la règle 4.7.18, 115 et 116 sont différés.

## Décision

**Retenu : un appui est un cut posé** (4.7.18, D-052). C'est la règle du cahier
(n°10). Elle ne change aucun faux sur le banc relu et coûte deux cuts justes
dont les appuis n'avaient jamais été posés. Le rejeu des lots antérieurs à la
4.7.18 garde l'ancienne règle (`decided`) : leur parité est intacte (partie 35 :
233/233).

**Limites.** La vue n'est pas mesurable au banc Natif (pas de caméra), et la
validation d'une décision différente de celle du lot est supposée. Aucun lot
4.7.18 n'existe encore : le premier lot relu confirmera ou non la règle.

# Différés de la partie 17 (second projet, à confirmer) : prédiction scellée de la GCV2 (19 octobre 2026)

Demande de l'opérateur (19/10/2026) : « tu vas tester la GCV2 sur les différés de cette partie ». La partie est le lot Orbite de la test 8 archivé dans
`banane-data/collections/2026-10-19_v4.9.5.8_partie-17-lot-15h51/` (9 844 cuts au départ : 9 703 validés, 139 invalides). **L'opérateur n'a pas encore
corrigé cette partie : il n'y a pas de pose de référence.** Ce test est donc une **prédiction scellée** : on calcule maintenant ce que la GCV2
proposerait pour chaque cut différé, on fige le fichier par son empreinte, et on ne le compare à l'opérateur qu'à l'arrivée de son Écho.

## 1. Ce que c'est, ce que ce n'est pas

- **C'est** un test de développement de la variante **V1+** (D-207, D-214) : V1, plus la GCV2 sur les cuts différés, sous le garde-fou de voie de la
  série. Seuls les différés sont calculés.
- **Ce n'est pas** un jugement G1-c. V1, la seule candidate de G1-c, **n'agit jamais sur un différé** : rien ici ne touche un cut où V1 pourrait agir.
- **Aucune vérité n'a été lue.** Aucun résultat ne peut être dit juste ou faux avant l'Écho de l'opérateur. Les chiffres du § 4 décrivent seulement ce que
  la GCV2 ferait.
- **Projet à confirmer** : l'opérateur n'a pas dit de quel projet est cette partie. La partie 17 du premier projet a 7 598 cuts, celle-ci 9 844 : elle est
  notée « 2:17, projet non confirmé » dans le fichier. Si l'opérateur dit « projet 1 », la prédiction reste la même (elle ne dépend que des cuts) ; seule
  l'étiquette est fausse.

## 2. Ce que « différé » veut dire ici

Le lot de la test 8 n'a traité que les **139 cuts invalides** de la partie (cuts 9521 à 9830). Pour chaque cut, le journal garde la décision du lot
(événement `gcv1-shadow-observed`) et, s'il l'a posé, sa validation (`validation-accepted`). Un **différé** est un cut que le lot a décidé et **n'a
pas validé** :

- 37 différés par le moteur (34 « pas d'appui », 3 « pas de minimum qualifié près de la voie prédite ») ;
- 4 où le lot avait une pose (reprise depuis la voie ou choix) mais ne l'a pas commandée parce qu'un rail sortait de la vue.

Les cuts 9521 à 9528 ont été vus deux fois (un premier lot arrêté, puis le lot complet) : c'est la seconde décision qui compte. Total : **139 cuts
du lot, 98 validés, 41 différés**, en 9 séries : 9521–9528 (8), 9545–9557 (9), 9604, 9624–9625, 9638–9653 (14), 9687–9689, 9753, 9790–9803 (3), 9815.

## 3. La chaîne, sans appui humain et causale

L'outil est `tools/gcv2-predire-differes.cjs` (sous-commande `predire`). Il lit **l'état du lot avant la relecture** : décisions, validations et
poses corrigées du lot, toutes antérieures au premier événement de la relecture « corriger » (15 h 32 min 08 s, heure de Paris). La relecture, ses 27 corrections,
toute validation d'après et tout Écho sont ignorés par construction. Un essai le prouve : si l'on remplace tout ce contenu par n'importe quoi, le
fichier de sortie ne change pas d'un octet.

Pour chaque différé, à l'**instant de la décision du lot** sur ce cut, et avec cela seulement :

- **voisins sûrs** : les cuts que le lot a validés avant cet instant (leurs poses corrigées par le lot) ; jamais une pose de l'opérateur ;
- **chaîne d'appuis** : ceux de ces voisins que le lot tenait pour appuis (un choix n'est jamais appui, règle du lot) ;
- **médiane d'écartement** : celle des poses validées par le lot avant cet instant (aucune pour les cuts 9521 à 9528, rien n'était encore validé) ;
- **zone** : il n'y a pas de zones de l'opérateur pour cette partie ; c'est le moteur de zones du dépôt (`src/regles-metier.js`), rejoué sur les captures
  du lot dans l'ordre du lot, avec ce qu'il savait à l'instant du cut (PN avec ses marges, puis ADV avec ses marges, sinon « abords ») ;
- **hypothèses H0 à H6** de `tools/gcv2-jeu.cjs` (famille « lot » : aucun voisin humain), dont **H6 « voie décalée »** et la **voie de référence
  de la série** avec ses preuves (au moins 2 voisins à 10 cuts, accord entre eux à 50 mm, voisin le plus proche à 5 cuts au plus, support des
  deux rails, pas de voie concurrente au départ, pas de rupture de série) ;
- **score et décision de paire** de la GCV2 entraînée, lus tels quels dans `datasets/gcv2-parametres.json` (usage « lot » : modèle, calibrage,
  τ et δ par zone) ; rien n'est réentraîné ni réglé ; **garde-fou de voie des différés** : chaque rail à 45 mm au plus de la voie de la série,
  et aucune action sans voie de série sûre.

**Contrôles de fidélité du rejeu** (sans effet sur la prédiction) : le moteur rejoué publie la même chose que le moteur du lot sur les 41 différés ;
la chaîne rejouée utilise les mêmes appuis que le lot sur 41/41 et arrive au même étage sur 39/41 (9550 et 9753 diffèrent) ; les zones rejouées
sont celles que l'ombre des zones du lot a consignées sur les 147 décisions (147/147).

## 4. Les chiffres que l'on peut dire sans vérité

| | Nombre |
|---|---:|
| Différés | **41** |
| avec nuage (capture du lot retrouvée) | 41 |
| sans nuage | 0 |
| avec pose de départ | 41 (dont **27** à l'écartement de 1 500 mm, valeur par défaut d'ESV) |
| Zone à l'instant de la décision : PN / ADV / abords / liste / hors | **0 / 32 / 9 / 0 / 0** |
| (pour information : zone connue à la fin du lot : ADV / abords) | 40 / 1 |
| **La GCV2 (V1+) agirait** | **0** |
| La GCV2 laisserait la pose de départ | **41** |
| dont faute de voie de série sûre (garde-fou de voie) | 41 |
| Différés avec au moins un candidat H6 | **27** (14 sans aucun voisin validé à 10 cuts) |
| H6 retenue pour agir | 0 |
| Voie de série sûre | **0** |
| Drapeaux de voie (aucune voie de série, ou voie non sûre) | **41** : aucune voie 21 ; non sûre 20 (appuis contradictoires 17, sans support local des deux rails 18, voie concurrente au départ 6, appui trop loin 6 ; un cut peut en avoir plusieurs) |
| Pose de départ à plus de 45 mm de la voie de la série | **20** (la voie de la série est à 139 à 184 mm de la pose de départ pour 19 d'entre eux) |
| Hypothèses scellées (deux rails, pour le rappel atteignable) | 1 347 (13 à 46 par différé) |

Ces chiffres disent seulement ce que la GCV2 ferait. Ils ne disent rien de sa justesse.

## 5. Ce qui a surpris

- **V1+ n'agirait sur aucun des 41 différés.** Le garde-fou de voie ne trouve jamais une voie de série sûre. Trois raisons, lisibles dans le fichier :
  (1) **la causalité** : à l'instant d'un différé, seuls les cuts d'avant sont validés ; dans les longues séries (9641–9653), les derniers cuts n'ont
  plus de voisin validé à 10 cuts ; (2) **les voisins se contredisent** : la plupart des poses de départ d'ESV de cette zone sont à l'écartement de
  1 500 mm (valeur par défaut), d'autres non ; le décalage « pose du lot moins pose d'ESV » n'est donc pas le même d'un voisin à l'autre (plus de
  50 mm d'écart) ; (3) **pas de support des deux rails** à la voie de référence dans la capture du différé. On est dans des ADV : une voie
  concurrente au départ est relevée 6 fois.
- **Toute la voie est décalée** : là où une voie de série existe, elle est à 139 à 184 mm de la pose de départ (comme la zone 2 de la partie 1 du
  second projet, D-206). C'est le cas visé par H6, mais ici H6 n'a jamais la preuve qu'elle exige.
- **Les zones à l'instant de la décision ne sont pas celles de la fin du lot** : 8 différés sont « abords » quand le lot les diffère et seraient
  « ADV » avec les zones connues à la fin du lot (la marge avant d'une ADV vue plus loin). C'est l'effet attendu de la causalité (F4 d'Astra).
- Les paramètres figés sont ceux de G1-b : ils n'ont **jamais vu de trait H6**. Une H6 n'y est notée que par ses traits communs. Ici cela ne change
  rien (aucune paire n'est permise), mais un vrai test de V1+ demandera des paramètres appris avec H6.

## 6. Le sceau

| | |
|---|---|
| Fichier de prédictions (hors dépôt, données de rails) | `predictions-differes-2-17.jsonl` (201 200 octets), dans le dossier de travail de la session |
| **SHA-256** | **`e91b15b2ca4285ef08e9b1f37288d9c593a387ab01d623cf9c5e81841aa468e2`** |
| Copie de contrôle | `copie-scellee-differes-2-17.jsonl`, même SHA-256 vérifié |
| Empreinte de l'entrée causale (ce que l'outil lit du journal) | `6e68111acf4d1e091819854dc10581f86d4f4889ecdd76aabe5a82e0b1ec0926` |
| Paramètres (`datasets/gcv2-parametres.json`, G1-b, usage lot) | `5e3bfe95781041ffc9fa13b56f0a3e8208b96bafb77ecdc0e82f32b7bf0cff41` |
| Outil (`tools/gcv2-predire-differes.cjs`, commit `ca0af2d`) | `9fc1f6b8abd71f32da3b4ddc91fec24637bcceed25cdeca29e2cc8c8077a3e42` |
| `tools/gcv2-jeu.cjs` / `tools/gcv2-apprendre.cjs` | `22c5ec8b…` / `1d658b3f…` (branche `claude/50-g1-h6`, `620fd82`) |
| Journal du lot / corpus (3 segments) | `ff6b32b4…` / `643fb17f…`, `214beaa2…`, `df93a804…` (journal dans le volume 01, corpus dans les volumes 02 à 04) |
| Node | v22.22.0 |

**Reproductible octet pour octet** : deux calculs indépendants (avant et après le commit de l'outil) ont donné le même SHA-256. Si le fichier du
dossier de travail est perdu, on le refait depuis `ca0af2d` et les zips de banane-data ; il doit retrouver la même empreinte, sinon il ne vaut rien.

Commande (les 5 zips extraits dans un dossier de travail, jamais dans banane-data) :

```
node --max-old-space-size=8000 tools/gcv2-predire-differes.cjs predire --partie 2:17 --juger-partie-reservee --projet-non-confirme \
  --journal ariane-journal-v4-1792417863622.json \
  --corpus ariane-gcv1-corpus-2026-10-19T13-51-05-seg01.json --corpus …-seg02.json --corpus …-seg03.json \
  --sortie predictions-differes-2-17.jsonl
```

## 7. Procédure exacte quand l'Écho de l'opérateur arrivera

1. Archiver l'Écho dans banane-data comme d'habitude (notes, SHA256SUMS, contrôle d'identité).
2. Vérifier le sceau **avant toute lecture** : `sha256sum predictions-differes-2-17.jsonl` doit donner `e91b15b2…a468e2` (sinon, refaire le
   fichier par la commande du § 6 et retrouver cette empreinte).
3. Extraire l'Écho dans un dossier de travail, puis :
   `node tools/gcv2-predire-differes.cjs comparer --predictions predictions-differes-2-17.jsonl --echo DOSSIER_ECHO [--echo …] --json comparaison.json`
   L'outil réimprime le SHA-256 du fichier lu : il doit être le même.
4. Lire, par zone et au total : différés jugés (référence de l'opérateur et même pose de départ, écartement à 2 mm), non jugés et pourquoi ; actions,
   justes (≤ 10 mm de l'opérateur), à 5 mm, abîmés, erreurs et borne de Wilson ; **mauvaises voies** au sens du protocole (erreur finale > 50 mm ou rail
   déplacé de plus de 45 mm en travers depuis la pose de départ), et, à part (audit H2), erreur > 50 mm seule, déplacement > 45 mm depuis le départ
   seul, sortie du corridor de la série ; abstentions ; grosses corrections laissées ; **rappel atteignable** (une hypothèse à 10 mm de l'opérateur aux
   deux rails) ; la **pose de départ du lot** en face (combien à 10 mm de l'opérateur, médiane).
5. Avec 0 action prédite, la comparaison mesurera surtout le **rappel atteignable** des hypothèses (dont H6) et ce que l'opérateur a fait des différés.
   **0 mauvaise voie avec 0 action ne prouve rien.** Aucun réglage ne sera changé d'après ce résultat ; une suite (paramètres appris avec H6,
   garde de série revu) passera par une décision écrite.

## 8. Limites

- Pas de vérité : aucun jugement n'est possible avant l'Écho. Projet à confirmer par l'opérateur.
- V1 n'agit jamais sur un différé : ce test ne dit rien de G1-c ; c'est un test de développement de V1+.
- Paramètres de G1-b, sans traits H6 (§ 5).
- La médiane d'écartement et les voisins ne viennent que du lot (choix de causalité) : les verts d'ESV voisins ne sont pas lus.
- Zones sans notes de l'opérateur : celles du moteur de zones, à l'instant de la décision.
- Rejeu : 2 différés sur 41 n'arrivent pas au même étage de chaîne que le lot (hypothèse H3 un peu différente pour eux).
- **Statut de la partie pour G1-c, à décider** : la décision D-212 dit que la GCV2 n'est pas calculée sur les parties neuves avant l'ouverture de
  G1-c. Ici elle l'a été, à la demande de l'opérateur, **sur les seuls différés** (où V1 n'agit pas), dans un fichier scellé que personne n'a comparé à l'opérateur.
  À consigner dans le registre des expositions du protocole ; garder ou non la partie comme confirmatoire pour V1 est une décision à écrire.

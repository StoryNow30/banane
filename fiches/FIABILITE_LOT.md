# Fiabilité du lot : avis de contrat, audit serveur, erreurs rangées (audit P-5, H14 à H16)

17 octobre 2026. Branche `claude/50-fiabilite-lot`, partie de `claude/50-base` (`97dfca7`).

L'audit P-5 des lots de terrain de la test 6 a relevé trois défauts de fiabilité. Ils faussaient l'analyse des lots et les avis montrés à l'opérateur (synthèse P-5, § 2 C3 à C5 et § 3.3 H14 à H16).

Pour chaque défaut, dans l'ordre : un essai rouge sur la base, le correctif minimal, puis la preuve.

**Ce qui ne change pas** : aucune commande à ESV n'est ajoutée ni modifiée. Seuls changent le journal, l'avis de contrat et l'audit serveur. `src/engine.js` n'est pas touché.

## En bref

| # | Défaut | Correctif | Preuve |
|---|---|---|---|
| H14 | L'empreinte de contrat hachait la sélection du rail. Sélectionner l'autre rail donnait un faux avis « contrat changé ». | La classe de sélection est ramenée à sa présence avant le hachage (forme 2). Une empreinte d'une autre forme n'est jamais comparée. | Essai : les 4 états de sélection donnent une seule empreinte (base : 4). ESV local : 0 avis au « Connecter » rail droit sélectionné (base : 2 avis). |
| H15 | À 10 h 04, une lecture de 5 pages sur 10 de la liste de la partie 9 a été auditée « partie 8 » : −4 877, puis +4 877. | Seule une lecture de la liste entière est comparée. La partie vient de la liste lue, pas du lot en pause. | Rejeu du journal de la test 6 : 0 audit incohérent (base : 2 sur 4). Les deux audits de la partie 8 sont inchangés. |
| H16 | Un `cancel` en retard était rangé sur un cut de L3. Les `batch-error` n'avaient pas de lot. | `adapter-result` et `batch-error` portent le lot et l'heure de la demande. `tools/perf-lot.cjs` range l'erreur au lot de sa demande. | Essai : lot, heure de demande et identité de la demande (base : absents). Outil : l'erreur va à L2 (base : L3). |

Commits : `706dec0` (H14), `f456fa3` (H15), `10de59a` (H16).

## H14 — Avis de contrat faux

**Cause.** L'empreinte du contrat (`src/adapter-page.js`, `empreinteContrat`) hachait les classes des deux boutons de rail. Ces classes disent quel rail est sélectionné :
- `leftRailSClass` : rail gauche sélectionné ;
- `leftRailUSClass` : rail gauche non sélectionné ;
- de même à droite.

Sélectionner l'autre rail changeait donc l'empreinte, et « Connecter » donnait l'avis « ESV n'a plus le même contrat ».

**Correctif.**
- `src/adapter-page.js` : avant le hachage, la classe de sélection est ramenée à `leftRail(S|US)Class` (ou `rightRail(S|US)Class`).
  - Sa **présence** reste comparée : Ariane la lit pour savoir quel rail est courant.
  - Son **état** ne l'est plus.
  - Les classes brutes (le rail sélectionné) vont dans `etat`, consigné mais jamais comparé, comme les libellés de boutons depuis D-139.
  - L'empreinte est maintenant de forme 2 (`forme: 2`).
- `background.js` (`contratNoter`) : une empreinte d'une autre forme n'est jamais comparée.
  - Au premier « Connecter » après l'installation, il n'y a donc ni avis ni « différente de la dernière connue ».
  - La forme est rangée avec l'empreinte et écrite dans `contrat-esv`.

**Preuve.**
- `tests/fiabilite-contrat-rail.test.cjs` simule une page ESV comme celle de la test 6. Les 4 états de sélection (gauche, droite, les deux, aucun) :
  - sur la base, donnent 4 empreintes : `cf09b21f`, `f05ddf81`, `a163347e` et `a2e2094e`. Les deux premières sont exactement celles du terrain (rail gauche et rail droit sélectionnés) ;
  - corrigé, donnent une seule empreinte, `ea8b250e`.
- Le même essai vérifie qu'un vrai changement de structure change toujours l'empreinte, dans les 4 états de sélection : bouton de navigation absent, écouteur d'ESV absent, bouton de rail absent, classe de sélection renommée, autre classe de bouton, version de jQuery, version de Potree.
- Sur la chaîne adaptateur puis service worker : « Connecter » rail gauche, puis rail droit, puis rail gauche donne 3 fois `change: false` et 0 avis. Sur la base : `change: true` aux 2e et 3e « Connecter » (`cf09b21f`, puis `f05ddf81`, puis `cf09b21f`).
- **ESV local** (maquette de `claude/esv-locale-audit`, extension réelle dans Chromium) : `tools/navigateur-contrat-rail.cjs`. Trois « Connecter » : aucun rail sélectionné, puis rail gauche, puis rail droit.

  | | Empreintes | Avis | Commandes reçues par la page |
  |---|---|---|---|
  | Base | 3 : `ff4510b5`, `e577db58`, `641bfd96` | 2 | `ping`, `state` |
  | Corrigé | 1 : `c7b39875` | 0 | `ping`, `state` |

**Empreintes connues, mises à jour.**
- Avant ce chantier, **aucune** empreinte réelle n'était épinglée dans le dépôt : ni fiche, ni essai, ni liste de contrats connus (recherche de `cf09b21f`, `f05ddf81`, `8ff6ba83` et `c4960ec5`).
- Contrat d'ESV de la test 6 : `ea8b250e` sous la nouvelle forme, quel que soit le rail sélectionné. Il remplace `cf09b21f` (rail gauche) et `f05ddf81` (rail droit). Il est épinglé dans `tests/fiabilite-contrat-rail.test.cjs`.
- `tests/releves-4953-adapter.test.cjs` épinglait le détail comparé (`detail.rails`). Il est mis à jour : `btn leftRail(S|US)Class` et `btn rightRail(S|US)Class` ; les classes brutes sont vérifiées dans `etat.rails`.
- Les empreintes de la test 3 (`8ff6ba83`, `c4960ec5`) sont de la forme 4.9.5.3, jamais relue depuis D-139 (clé `banane53Contrat`). Elles ne changent pas.
- Maquette ESV : `c7b39875`. Sur la base, elle variait selon la sélection (`ff4510b5`, `e577db58`, `641bfd96`).

## H15 — Audit serveur incohérent

**Cause.** À 10 h 04 min 01 s, le lot L2 (partie 8) était en pause, et ESV affichait la partie 9. Deux fautes se sont ajoutées :
- la lecture était déclarée complète après 4 s de silence, même s'il manquait des pages (5 pages sur 10, 5 000 lignes sur 9 908) ;
- la partie venait du lot ouvert, même en pause (`contexteAudit`).

D'où l'audit « partie 8 » à −4 877, puis +4 877 à 10 h 04 min 18 s, quand L3 comparait sa lecture complète à cette lecture partielle.

**Correctif** (`background.js` : `auditLecture`, `contexteAudit`, `relevesObservation`, et une nouvelle fonction `partieDeListe`).
1. **Lecture complète.**
   - Deux lectures ne se comparent que si elles couvrent la même liste entière, c'est-à-dire le même nombre de lignes.
   - Une lecture plus courte que la référence n'est ni auditée ni gardée, sauf si elle se dit complète : dernière page plus courte que les autres, ou une seule page ; pour un résumé d'avant séance, toutes ses pages lues.
   - Une référence fausse se répare donc d'elle-même à la lecture complète suivante, sans audit entre les deux.
2. **Partie de la liste lue.**
   - Chaque liste apprend sa partie au départ d'un lot : le résumé d'avant séance arrive pendant que le lot tourne.
   - Une partie n'a qu'une liste.
   - Un lot en pause, Écho ou la capture ne donnent leur partie qu'à une liste qui n'est pas connue pour être celle d'une autre partie. Sinon : partie nulle, et aucune validation attendue.
   - Une liste connue garde sa partie. La source est `liste` si elle diffère de celle du moment.

**Preuve.**
- `tests/fiabilite-audit-serveur.test.cjs` rejoue le même enchaînement avec des données fabriquées.
  - Base : −877 puis +877, partie du lot en pause.
  - Corrigé : aucun audit sur la lecture partielle, puis un audit à 0. L'audit de la partie du lot est inchangé.
  - Une liste d'une autre partie lue pendant la pause n'est jamais rangée à la partie du lot.
- **Rejeu du journal de la test 6** (`ariane-journal-v4-1792225071995.json`, lot de 10 h 17) avec `tools/rejeu-audit-serveur.cjs`. Les observations de liste passent par le vrai service worker ; l'état du lot vient du journal. Un audit est cohérent si sa partie est nulle ou celle de la liste, et si ses deux lectures couvrent la liste entière.

  | Audit (fin de lecture, UTC) | Journal | Base rejouée | Corrigé |
  |---|---|---|---|
  | 08:02:02, partie 8 | 29 constatés, 30 attendus, écart −1 | identique | **identique** |
  | 08:02:45, partie 8 | 0, 0, 0 | identique | **identique** |
  | 08:03:56, « partie 8 », 5 pages de la liste de la partie 9 | −4 877 (incohérent) | identique | **aucun audit** |
  | 08:03:59, partie 9, départ de L3 | +4 877 (incohérent) | identique | **0, 0, 0** (cohérent) |
  | Incohérents | 2 sur 4 | 2 sur 4 | **0 sur 3** |

- La base rejouée redonne les 4 audits du journal à l'identique : le rejeu est fidèle.
- Les deux audits de la partie 8 sont ceux qui comparent les validations de L1 : ils sont inchangés.
- Les trois autres exports du jour (lots de 10 h 00, 10 h 02 et 10 h 06) donnent aussi 0 audit incohérent une fois corrigés.

## H16 — Erreurs mal rangées

**Cause.**
- `adapter-result` était journalisé à l'arrivée de la réponse, avec l'identité de ce moment-là. Un `cancel` demandé pendant la pause de L2 a expiré au bout de 45 005 ms, en plein L3 : il a été rangé sur le cut 4051 de L3.
- `batch-error`, émis par le moteur, ne portait pas de lot.

**Correctif.**
- `background.js` : `callSur` relève, au moment de la **demande**, trois choses : le lot ouvert, l'heure et l'identité.
  - `adapter-result` porte `batchId`, `demandeA` et l'identité de la demande.
  - `batch-error` porte le lot qui passe en erreur (`batchId`). Quand l'erreur vient d'une commande à ESV, il porte aussi l'heure de sa demande (`demandeA`) et son nom (`commande`).
  - Le moteur n'est pas modifié : `batch-error` est complété au passage de son `event`.
  - Le message envoyé à la page ne change pas.
- `tools/perf-lot.cjs` (analyse automatique des lots) :
  - une réponse de commande ou une erreur de lot qui porte son lot est rangée à ce lot, quelle que soit l'heure de la réponse ;
  - chaque erreur de commande dit l'heure de sa demande (`demandeA`) et son lot ;
  - par lot, il compte les `batch-error` (`erreursDeLot`) ;
  - les journaux d'avant ce chantier, sans ces champs, gardent la fenêtre de temps.
  - `tools/analyse-locale.cjs` garde les `batch-error` tels quels dans ses extraits ; il n'a rien à changer.

**Preuve.** `tests/fiabilite-erreurs-lot.test.cjs` :
- une page qui disparaît pendant une capture donne un `batch-error` avec le lot, `commande: capture` et une heure de demande prise pendant le lot. Sur la base : aucun des trois ;
- un `cancel` demandé pendant la pause de L2, dont la réponse arrive après le départ de L3, porte le lot L2, l'heure de sa demande (avant L3) et l'identité de la demande, pas le cut de L3 ;
- `perf-lot`, sur un journal à deux lots où la réponse en retard arrive pendant L3 :
  - corrigé : L2 a 1 erreur, L3 n'en a aucune ;
  - base : 0 pour L2 et 1 pour L3, et le lot exporté L3 recevait l'erreur de L2.

## Commandes à ESV identiques, octet pour octet

`tests/fiabilite-lot-commandes.test.cjs` relève chaque message envoyé à la page (action et arguments), dans l'ordre. Il le fait dans trois scénarios, avec le service worker réel et un ESV simulé :
- A : lot complet précédé de « Connecter » ;
- B : erreur de lot (page disparue pendant une capture), puis « Reprendre » après F5 ;
- C : observations de liste avec audit, en lecture complète et partielle.

Les identifiants aléatoires et les heures sont neutralisés ; tout le reste est comparé à l'empreinte relevée sur la base, avant les corrections :
- A : 42 messages, `5758eac8…` ;
- B : 52 messages, `081e3019…` ;
- C : 42 messages, la même empreinte que A, car les observations ne changent aucune commande.

L'essai est vert après chacun des trois commits. Sur l'ESV local, la page ne reçoit que `ping` et `state`, sur la base comme corrigé.

## Limites et doutes

- **H14.**
  - Seules les classes `…RailSClass` et `…RailUSClass` sont traitées comme un état : ce sont les seules relevées sur ESV (relevé du 15 octobre et terrain). Une autre classe qui dépendrait de l'état (par exemple `active`) changerait encore l'empreinte. Elle serait alors visible dans `etat.rails` et dans `changements`.
  - La maquette n'a pas les versions de jQuery et de Potree d'ESV ; seule la sélection y est vérifiée.
- **H15.**
  - « Complète » veut dire « même nombre de lignes que la référence ». Si une partie change de taille, la première lecture d'après n'est pas auditée.
  - La partie d'une liste n'est apprise qu'au départ d'un lot. En Écho ou en correction, une liste inconnue alors qu'une autre liste est connue pour la même partie donne un audit à partie nulle, sans validations attendues. On a donc moins d'audits comparés, mais jamais de faux.
  - La cause des 5 pages manquantes de 10 h 04 reste inconnue : l'observateur en a vu 10, mais seules 5 ont été rangées. Ce chantier ne la corrige pas : il empêche seulement d'en tirer un audit.
- **H16.**
  - L'identité d'un `adapter-result` est maintenant celle de la demande. Pour une commande normale, c'est la même qu'avant ; elle ne diffère que pour une réponse en retard.
  - Le lien entre `batch-error` et sa commande passe par le texte exact de l'erreur. Une erreur interne du moteur, qui ne vient d'aucune commande, a `demandeA: null` et `commande: null`.
  - Les journaux du terrain déjà reçus n'ont pas ces champs : `perf-lot` y range encore le `cancel` de 45 s à L3.
- **Non vérifié sur le vrai ESV.** Les trois corrections sont prouvées par des essais, par le rejeu d'un journal de terrain et par la maquette. Le prochain lot de terrain doit montrer :
  - 0 avis de contrat quel que soit le rail sélectionné ;
  - `forme: 2` dans `contrat-esv` ;
  - `batchId` et `demandeA` sur les erreurs.

## Rejouer

```
nice -n 10 node --test tests/fiabilite-contrat-rail.test.cjs tests/fiabilite-audit-serveur.test.cjs tests/fiabilite-erreurs-lot.test.cjs tests/fiabilite-lot-commandes.test.cjs
# ESV local (DOSSIER = copie de la branche de la maquette :
#   git archive origin/claude/esv-locale-audit tests/esv-maquette tests/corpus vendor | tar -x -C DOSSIER)
nice -n 10 node tools/navigateur-contrat-rail.cjs --maquette DOSSIER [--extension AUTRE_DEPOT] [--json SORTIE.json]
# Audit serveur, rejeu d'un journal d'Orbite (--racine : rejouer avec le service worker d'une autre copie, la base par exemple)
nice -n 10 node tools/rejeu-audit-serveur.cjs JOURNAL [--racine DEPOT] [--json SORTIE.json]
```

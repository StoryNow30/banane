# Ciblage T22 : « 13 traités » sans total, sans graduations ni temps restant

Base : tronc `claude/50-test17` (bcc4630, 4.9.5.22). La test 21 est 4eb99db (4.9.5.21). Pas de version ni de paquet. Seuls `src/ui5.js`, `src/signal-rendu.js`, `panel-signal.css` et une ligne de `panel.js` changent. `background.js` ne change pas, ni la pose, ni la décision, ni l'écriture. Les bornes envoyées par `start-batch` ne changent pas non plus.

## Constat de l'opérateur (captures, lot en cours)

- **Test 21** : « En cours · Pose du cut 8791 · 13 traités sur 74 ciblés ». Le rail est gradué 0, 37, 74 ; l'allure finit par « environ … restantes ».
- **Test 22** : « En cours · Pose du cut 418 · 13 traités · 13 posés · 0 différés ». Le rail n'a ni graduations ni total, l'allure n'a pas de temps restant.

L'opérateur n'avait touché ni au premier ni au dernier cut avant le lot de la test 22.

## Cause (ÉTABLIE : lecture du code, puis panel.html réel des deux versions en navigateur, API Chrome simulée)

- **M (`cibles`) ne venait que de `travailDuLot`** (panel.js). Cette fonction ne rend la fiche de départ du lot (D-092, invalides de la liste d'ESV au démarrage) que pour un lot qui va **du cut 0 ou 1 jusqu'à la FIN DE PARTIE** (`endMode:'partie'`). Sans M, Signal n'affiche ni « sur M ciblés », ni les graduations, ni le temps restant. Il ne montre pas non plus « il reste N cuts » en pause, ni « N sur M » dans la poignée et la palette.
- **Premier cut : le même dans les deux versions.** `start-batch` (panel.js l. 1321) envoie le cut affiché dans ESV et ignore `#start` tant que l'opérateur ne l'a pas tapé. Les « 74 ciblés » de la test 21 veulent dire qu'ESV y affichait le cut 0 ou 1.
- **Dernier cut : c'est lui qui a changé.**
  - En test 21, Signal restait sur l'accueil du panneau (`#home`), où `render` ne remplit jamais `#end`. Chaque lot partait donc avec `end: 999999, endMode: 'partie'`, quel que soit l'état. C'est la même cause que le défaut D1 de la revue.
  - En test 22, Signal entre dans la vue Orbite (Connexion T21). panel.js (l. 621-626) y remplit `#end` comme le panneau d'avant, dans cet ordre : d'abord la **fin retenue pour la partie** (`bornes-partie`, clé `banane4Parties`), sinon la fin d'un lot précédent de la même partie, sinon rien (fin de partie). La fin retenue peut venir de deux sources :
    - « fin constatée » : le dernier cut traité avant qu'ESV passe à une autre partie ;
    - « saisie » : tout dernier cut envoyé pour un lot de cette partie, y compris une fin proposée de cette façon puis acceptée.

    Le lot part alors avec un dernier cut numéroté, `travailDuLot` rend null, et M devient inconnu.
- **Mesuré (même état de départ : ESV au cut 0 de la partie 23, aucun champ touché)** :

| État de départ | Test 21 : bornes envoyées · écran | Test 22 (bcc4630) : bornes envoyées · écran |
|---|---|---|
| aucune fin retenue | 0 → fin de partie · « 13 traités sur 74 ciblés », 3 graduations, « restantes » | identique |
| fin retenue 9999 (« constatée ») | 0 → fin de partie · « sur 74 ciblés » | 0 → 9999 · « 13 traités », rail inconnu, sans « restantes » |
| fin retenue 5000 (« saisie ») | 0 → fin de partie · « sur 74 ciblés » | 0 → 5000 · « 13 traités » |
| ESV au cut 400, aucune fin retenue | 400 → fin de partie · « 13 traités » | identique |

- **Valeurs vues par l'opérateur en test 22, sans rien toucher.** Le code les ÉTABLIT ; pour sa partie, elles restent PROBABLES tant que l'export du lot n'est pas lu (`scope.end`, `endMode`) :
  - Premier cut : le cut affiché dans ESV.
  - Dernier cut : la fin retenue pour cette partie, avec la note « Dernier cut retenu pour la partie N (ESV a quitté la partie après ce cut / saisi pour un lot précédent). Modifiable. »

  En test 21, vu du même état, le premier cut était le même et le dernier cut toujours « fin de partie ».

## Couverture (point de sécurité)

- **Départ : le même.** Seule la fin peut différer.
- **Fin « constatée »** : le lot de la test 22 s'arrête au dernier cut traité par un lot précédent avant la sortie de la partie. ESV charge toujours le cut non validé suivant, donc aucun invalide n'existait au-delà à ce moment-là. Un cut devenu invalide depuis serait hors lot.
- **Fin « saisie » plus courte** que la partie : les invalides au-delà sont hors lot.
- **Ce que l'opérateur voyait déjà :** la borne et sa note, avant « Démarrer ». Le service worker clôt le lot dès qu'ESV passe au-delà de la fin (`navigation-beyond-end`) : aucun cut hors du lot n'est traité.
- **Ce que l'opérateur ne voyait pas :** pendant le lot, Signal ne rappelait pas les bornes. À la fin, il ne montrait pas l'avis « ESV est passé au cut Y, hors du lot », parce que seuls les avis en erreur passaient.
- **Conclusion : jamais de saut silencieux depuis ce correctif.** Les bornes restent dites pendant le lot, et la fin hors du lot est dite (voir Correctif).

## Défaut annexe (ÉTABLI, corrigé)

panel.js l. 623 : quand la partie n'a aucune fin retenue, `bornes-partie` répond null, et avec ESV au cut 0, `null >= 0` vaut vrai. La note disait alors « Dernier cut retenu pour la partie N (ESV a quitté la partie après ce cut) », alors que le champ restait vide et que le lot partait bien « fin de partie ». La valeur envoyée était déjà juste ; seule la note était fausse.

## Correctif

- **`src/signal-rendu.js` · `ciblesBornes(scope, fiche, liste)`** : M = invalides compris dans les bornes du lot.
  - Le lot couvre toute la partie (départ au cut 0 ou 1, règle de `travailDuLot`, et fin de partie ou dernier cut au moins égal à la dernière ligne) : M = invalides de la fiche de départ de CE lot.
  - Sinon : M est compté dans l'instantané de la liste d'ESV (`src/liste-memoire.js`), seulement s'il est dans le **même état** que la fiche : même partie, même nombre de lignes, même nombre d'invalides.
  - Sinon, ou si aucun invalide n'est dans les bornes : null, jamais un total deviné.
  - M inconnu : « N traités · total inconnu ». Le rail n'a alors ni graduations ni total, et l'allure aucun temps restant.
- **`src/ui5.js`** : la fiche (`banane3FichesDepart`) et l'instantané (`banane5ListeInstantane:<partie>`) sont lus dans `chrome.storage.local`, en lecture seule et sans message. `travailDuLot` reste la première source. M trouvé est gardé pour tout le lot. La fiche est relue au plus toutes les 5 s, l'instantané six fois au plus par lot. `horsLot` est tiré de `batch.stoppedAtEnd` : `navigation-beyond-end`, même partie.
- **Signal pendant le lot** (en cours, pause demandée, pause, incident) : « Lot du cut X au cut Y » ou « Lot du cut X jusqu'à la fin de la partie ».
- **Signal à la fin** : une ligne « Bornes », et une ligne « Fin du lot » : « après le cut N, ESV est passé au cut Y, hors du lot : rien après le cut E n'est traité par ce lot ».
- **`panel.js` l. 623** : une fin retenue doit être un entier.
- **Essais** :
  - `tests/ciblage-t22.test.cjs` (vm, 9 essais) : rouges avant le correctif (8 sur 9 ; l'essai de la note n'était rouge qu'avec ESV au cut 0, corrigé), verts après.
  - `tests/ciblage-t22-navigateur.test.cjs` (panel.html réel, 3 essais) : rouges avant (3 sur 3), verts après. Ils couvrent la fin retenue 8770 (bornes envoyées 0 → 8770 inchangées ; écran « 13 traités sur 74 ciblés », graduations 0 · 37 · 74, « environ 2 min 51 restantes », « Lot du cut 0 au cut 8770 », Pause et « Arrêter le lot »), la note sans fin retenue, et la fin « hors du lot ».

## Écran En cours, test 21 et test 22 (même état ; code de 4eb99db et de bcc4630, et mesure)

| Élément | Test 21 | Test 22 | Origine |
|---|---|---|---|
| Mot, phrase « Pose du cut N » | oui | oui | inchangé |
| « N traités sur M ciblés » | oui (fin de partie) | « N traités » si fin retenue | **perte** (cause ci-dessus), rendue par ce correctif |
| « P posés · D différés » | oui (même code ; absent de la description de la capture, mais rendu par 4eb99db) | oui | inchangé |
| Graduations 0, M/2, M | oui | non si fin retenue | **perte**, rendue |
| Allure, médiane | oui | oui | inchangé (les écarts 29,3 / 21,5 viennent des données) |
| « environ … restantes » | oui | non si fin retenue | **perte**, rendue |
| Pause / « il reste N cuts », poignée et palette « N sur M » | oui | non si fin retenue | **perte**, rendue |
| Boutons | « Démarrer le lot » (défaut D1) | Pause, « Arrêter le lot » | correctif voulu (D1, Connexion T21) |
| Avis en rouge (contrat, refus, correction interrompue) | non | oui, sous la phrase | correctif voulu (D4, R5, D6) |
| Bornes du prochain lot | non | au repos seulement, pas pendant le lot | correctif voulu (D7) |
| « 0 vert », écran réécrit chaque seconde | oui | non | correctifs voulus (R4, R6) |
| Ordre : état, phrase, objet, allure, actions | même ordre | même ordre (avis entre phrase et objet) | inchangé |
| Bornes du lot pendant le lot, fin « hors du lot » | non | non | **ajout de ce correctif** |

## Vérification

- **verify complet** (`node tools/verify.cjs`, sur 3b67b99, après 60 s de repos de la machine) : 2 671 essais, 2 669 réussis, 0 échec, 0 annulé, 2 ignorés (les deux ignorés connus). Géométrie et moteur inchangés.
- **Maquette** (`node tests/esv-maquette/essais.cjs`) : 30 sur 30 et 2 ignorés à la troisième passe (code 0). Les trois autres passes ont eu 1 ou 2 échecs, toujours les mêmes essais, sans rapport avec ce correctif :
  - « Démarrer le lot ne part que sur l'onglet nommé » (connexion-t21) : `ECONNRESET` sur une écriture routée, ou pas de chargement dans les 3 s ;
  - « précision des nœuds » (adaptateur).

  La tête du tronc sans ce correctif (bcc4630) montre la même chose : 29 sur 30 puis 30 sur 30 ; connexion-t21 seul, 4 sur 5 puis 5 sur 5. Les deux essais sont INSTABLES (ÉTABLI), indépendamment de ce correctif.

## SUPPOSÉ / non mesuré

- La fin retenue de la partie de l'opérateur (« constatée » ou « saisie ») et sa valeur n'ont pas été mesurées : l'export du lot de la test 22 n'a pas été lu.
- M par l'instantané n'est donné que si l'instantané a été pris dans le même état que la fiche. Si ESV recharge la liste pendant le lot avant la première lecture, M reste « total inconnu », et l'écran le dit.

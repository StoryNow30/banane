# Écho et F5 : la reprise attend la fin de chargement d'ESV

Branche `claude/50-echo-f5`, partie de `claude/50-base`. Version du manifeste inchangée. `src/engine.js`, `DECISIONS.md`, `src/placement-convention.js` et `tools/verify.cjs` ne sont pas touchés.

## Cause (terrain 4.9.5 test 3, relecture de la partie 29)

Un F5 en pleine séance Écho n'a perdu aucune donnée, mais l'enchaînement autour du F5 cumulait trois défauts.

1. **Reprise trop tôt.** `chrome.tabs.onUpdated` lançait `echoReprise` au premier état `complete`, 0,35 s après le F5. ESV n'avait alors ni liste (7 s à lire), ni cut. Résultat : une visite sans identité, puis des visites au cut 0 du chargement (libellé « partie 0 » / cut 0), qui ne sont pas des relectures de l'opérateur.
2. **Pas d'adaptateur après un rechargement hors séance.** Le rechargement entre deux séances laisse l'onglet sans adaptateur. « Démarrer Écho » appelait `native.start()` sans rien vérifier : la session et sa période étaient créées, puis `nativeStart` échouait.
3. **Une période fantôme par essai raté.** `start()` puis `resume()` ouvraient une période avant l'appel à l'adaptateur et la fermaient aussitôt s'il échouait. Chaque clic en ajoutait une (six, de 0 à 60 ms, en 8 s).

## Correctif

`background.js`

- Le service worker note les pages de liste (`list-page`, 2xx) que l'observateur de la page lui rapporte déjà, par tampon rejoué à l'installation du pont. Rien de plus n'est demandé à ESV. L'état est remis à zéro à chaque `loading` de l'onglet choisi.
- `echoReprise` équipe la page (comme avant), puis interroge `ping` (lecture du libellé du cut dans le DOM) et attend :
  - le libellé lisible, avec une partie ≥ 1 ;
  - la liste lue puis silencieuse depuis `silenceListeMs` (2,5 s) ;
  - si aucune page de liste n'a été vue : un cut réel (≥ 1) après `attenteSansListeMs` (10 s). Jamais le cut 0 sans liste.
  - Délai total borné : `delaiMaxMs` (60 s), qui repart si l'onglet se recharge de nouveau. Au bout : aucune période n'est créée, message « reprise automatique impossible… Connecter puis Reprendre », comme avant.
  - La reprise s'abandonne si l'opérateur a repris à la main entre-temps.
- `native-start` : si la page ne répond pas, il l'équipe (ce que fait « Connecter » : injection locale) et relit le cut. Si elle ne répond toujours pas, l'erreur est dite avant toute création de session.
- Hors séance, un rechargement ne déclenche toujours rien : ni injection, ni commande.

`src/native-session.js`

- Un démarrage ou une reprise qui échoue marque sa période (`reason: 'start-failed'`, `error`). L'essai suivant la remplace. Au pire, une seule période marquée en fin de liste.

Réglages optionnels, lus dans `BananeSettings.echo.reprise` (valeurs par défaut dans `background.js`, `src/settings.js` inchangé) : `pollMs` 250, `silenceListeMs` 2500, `attenteSansListeMs` 10000, `delaiMaxMs` 60000.

Trace dans ESV : inchangée. Aucune requête nouvelle, aucune marque d'Ariane, aucun changement de pose, de validation ni de navigation d'Orbite.

## Essais

`tests/echo-f5-reprise.test.cjs` (rouges avant le correctif, commit précédent) :

| Essai | Avant | Après |
|---|---|---|
| F5 en Écho : attend liste + cut, même session, une nouvelle période, aucune commande ESV | rouge | vert |
| Liste jamais vue, cut réel : reprise après l'attente sans liste, jamais avant | rouge | vert |
| Second rechargement pendant l'attente : les pages de l'ancien chargement ne comptent pas | rouge | vert |
| ESV ne finit jamais de charger : délai borné, aucune période, reprise manuelle | rouge | vert |
| Page sans adaptateur : rien hors séance ; le démarrage équipe la page, une période | rouge | vert |
| Adaptateur muet, trois clics : au plus une période marquée, remplacée au succès | rouge | vert |
| Reprise manuelle ratée après F5 : pas de période par essai | rouge | vert |
| F5 pendant un lot Orbite : Écho non créé, aucune commande venue de l'onglet, « Reprendre » rattache le lot | vert | vert |

`tests/echo-4918.test.cjs` (AM-05, service worker) : l'essai donne désormais un libellé à `ping` et des délais courts, puisque la reprise attend l'identité.

## À vérifier sur le terrain

Les délais et le signal « liste silencieuse » viennent d'un seul relevé (liste en 10 pages sur 7,2 s). Une maquette ESV n'existait pas : rien n'a été joué contre le vrai ESV.

1. Séance Écho en cours, F5 : la séance est la même, une seule nouvelle période s'ouvre quand ESV a fini de charger. Noter l'écart page perdue → période (attendu : de l'ordre de la lecture de la liste, 7 à 10 s) et l'identité de la première visite (cut et partie renseignés).
2. Aucune visite au cut 0 ni sans identité juste après le F5.
3. F5 hors séance, puis « Démarrer Écho » sans « Connecter » : démarrage direct, une seule période.
4. Chargement lent : l'attente va jusqu'à 60 s, puis le message « Connecter puis Reprendre » ; « Reprendre » à la main fonctionne.
5. Lot Orbite : F5 puis « Reprendre » comme avant.

## Doutes

- Le silence de 2,5 s est un choix : un écart plus long entre deux pages de liste ferait repartir la reprise un peu tôt (le libellé doit toutefois être lisible). Si le terrain le montre, monter `silenceListeMs`.
- Si l'observateur de la page est coupé (`observateurPassif.actif`) ou si ESV ne relit pas la liste, aucune page n'est vue : la reprise attend 10 s puis exige un cut ≥ 1 ; sur le cut 0 elle renonce au bout de 60 s (reprise manuelle).
- Un vrai « partie 0 » serait pris pour un libellé de chargement (reprise manuelle seulement).
- Le signal `loading` interne d'ESV (événement jQuery en ombre) n'est pas utilisé : il n'est posé qu'au premier `ping`, donc après le début du chargement.

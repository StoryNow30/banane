# U2 — préparation des essais du panneau réel

2 octobre 2026. Développeur 3. Branche locale `sol/49-u2-preparation-panneau`.

## Verdict et portée

**Préparation écrite ; première exécution Chromium bloquée. U2 non accepté.**
Le banc a été lancé contre la 4.8.6 mais s’est arrêté au précontrôle : Chromium
absent. **23 scénarios recensés, 0 exécuté, 0 réussi, 0 échec UI observé,
23 bloqués.** Un zéro échec avec zéro exécution ne remplit aucune porte.
Le panneau de production n’a pas été chargé. Aucun diagnostic de fonctionnement,
contraste effectif, focus ou zoom réel n’est revendiqué. Le banc demeure à
valider par sa première exécution réelle avant d’être utilisé comme preuve.

Le compte et le blocage sont publiés dans
`tests/browser/u2-49/resultat-486.json` (`counts`, `infrastructureError`,
`extension.loaded`, `environment`). Cette sortie est séparée de verify.
Aucune correction de panneau n’est livrée ou attribuée à U1 sans observation.
Aucun chantier suivant n’est lancé ; U3 attend encore U2 et les actions clavier.

## Autorisation et lectures

Mission fournie : `mission-u2-preparation-2026-10-02.md`, annexe D-072 lue en
premier. Les annexes D-066, D-067, D-068, D-071 et le cadrage complémentaire
ont été lus depuis cette pièce locale. D-072 autorise le parallèle et réserve
les corrections de `panel.js`, `panel.html`, `panel.css` à U1. Aucun avenant
local n’est supposé publié sur GitHub et aucun document signé n’est réécrit.

Code : étiquette légère `v4.8.6`, commit et étiquette vérifiés par
`git rev-parse HEAD v4.8.6 'v4.8.6^{}'` :

```text
042aee649bc25b89c46a26def481f87f46d047ac
042aee649bc25b89c46a26def481f87f46d047ac
042aee649bc25b89c46a26def481f87f46d047ac
```

Documents du cahier lus avec `git show 18a355eb:<fichier>` : référence exacte
`18a355eb02a00b20b2adaeb1d84648854664972e`, descendante de la base stable
(`git merge-base --is-ancestor v4.8.6 18a355eb`, sortie 0). Lecture du cahier
§2, §3–5, U2 §6 (`:391–401`), carte §14 (`:646–672`), des besoins
`:80–115` incluant 90/108, et du relais `consignes/demarrage-session-49.md`.
Passation 4.8.0, D-057 à D-065, problèmes KI-059/060/064/066–069,
`PLAN_SUITE.md` §3, `consignes/analyse-locale.md`, audit qualité C02/U02 et sa
réponse ont été consultés. Le développement en série historique et les
attributions à 4.9.5 sont remplacés seulement dans la portée des avenants.
Aucun `AGENTS.md` n’a été trouvé dans cette copie (`rg --files -g AGENTS.md`).

## Cartographie et fichiers

- `tools/navigateur-telechargements.cjs:19–35` : modèle de chargement Chromium
  persistant/extension, conservé sans changement.
- `tests/browser/README.md:1–18` : fixture historique simulée, non utilisée.
- `panel.html:35–42,77–93,129–174` : onglets, commandes, tiroirs, connexion.
- `panel.js:94–135,325–329,334–549,550–558,873–919` : vues, focus implicite,
  états, rafraîchissement, actions et tiroirs ; aucune modification.
- `panel.js:13–24` et `panel.css:274–294` : réduction du mouvement.
- `panel.css:13–30` ; `audit/chantiers/qualite-480/reponse.md:19` : couleurs
  corrigées, seuil de texte ordinaire adopté 4,5:1 ; aucun seuil nouveau.

Nouveaux fichiers réservés : `tools/navigateur-panneau-49.cjs`,
`tests/browser/u2-49/` (backend, helpers, matrice, 23 fichiers de scénarios,
contrôles d’infrastructure, README et preuves), et le présent rapport.
`audit/verification.txt` / `.json` générés sont inclus parce qu’ils reflètent
le contrôle final, conformément au cahier §2.3. Ils conservent leurs mentions
historiques de non-exécution navigateur ; la raison actuelle est celle de la
sortie U2, pas un refus de page de gestion observé dans cette session.

## Environnement et précontrôle réel

Node `v24.19.0`, Linux, Playwright
`1.62.1` ; module :
`/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js`.
Binaire attendu : `/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`,
**absent**. Version navigateur : **non mesurée**. Service worker chargé :
**non**, vérification de chargement prévue mais non atteinte. Aucune version
Chromium n’est attribuée au panneau à partir du seul numéro du téléchargement.

Commande d’installation standard essayée :

```sh
node /opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/cli.js install chromium
```

Échec du téléchargement/extraction, conservé dans
`tests/browser/u2-49/installation-chromium.log` :

```text
Error: End of central directory record signature not found. Either not a zip file, or file is truncated.
Failed to install browsers
Error: Failed to download Chrome for Testing 151.0.7922.34 (playwright chromium v1234)
```

Il s’agit d’un blocage d’environnement, pas d’un défaut constaté du panneau.
Aucune substitution par un faux DOM, aucun accès ESV, aucune capture d’écran,
aucun corpus privé n’ont été utilisés.

## Commande reproductible

Depuis la branche U2 :

```sh
node tools/navigateur-panneau-49.cjs /chemin/vers/la/cible --output /chemin/u2-resultats.json
```

Exécution faite ici :

```sh
node tools/navigateur-panneau-49.cjs . --output tests/browser/u2-49/resultat-486.json
```

Code de sortie **2**, signifiant blocage. Durées par scénario : non mesurées,
aucun scénario n’a commencé. Le README documente `PLAYWRIGHT_MODULE`,
`CHROMIUM`, `--headed`, `--scenario`, les codes de sortie et les limitations.

Le banc accepte un dossier cible. Il publie le commit Git (ou `null` pour
un dossier sans Git), le manifeste et les empreintes, vérifie le service worker
et les URLs du panneau avant chaque assertion. Les modifications locales sont
publiées dans `gitStatus`, jamais dissimulées derrière un simple numéro de version.
Une exécution sélective ne vaut pas exécution complète. Le résultat vert
éventuel concerne seulement le périmètre exécuté, jamais l’acceptation U2.

## Couverture préparée et résultats

| Scénario | Assertion observable attendue | Résultat actuel | Durée |
|---|---|---|---|
| `tab-home` | Toutes les commandes visibles et disponibles atteintes dans l’ordre DOM, retour inverse, focus visible. | **Bloqué, non exécuté** | Non mesurée |
| `tab-echo` | Toutes les commandes visibles et disponibles atteintes dans l’ordre DOM, retour inverse, focus visible. | **Bloqué, non exécuté** | Non mesurée |
| `tab-orbite-running` | Toutes les commandes visibles et disponibles atteintes dans l’ordre DOM, retour inverse, focus visible. | **Bloqué, non exécuté** | Non mesurée |
| `tab-orbite-paused` | Toutes les commandes visibles et disponibles atteintes dans l’ordre DOM, retour inverse, focus visible. | **Bloqué, non exécuté** | Non mesurée |
| `tab-orbite-unresolved` | Toutes les commandes visibles et disponibles atteintes dans l’ordre DOM, retour inverse, focus visible. | **Bloqué, non exécuté** | Non mesurée |
| `enter-start` | Une activation clavier transmet exactement une commande au double, sans émission à ESV. | **Bloqué, non exécuté** | Non mesurée |
| `space-pause` | Une activation clavier transmet exactement une commande au double, sans émission à ESV. | **Bloqué, non exécuté** | Non mesurée |
| `enter-resume` | Une activation clavier transmet exactement une commande au double, sans émission à ESV. | **Bloqué, non exécuté** | Non mesurée |
| `space-stop` | Une activation clavier transmet exactement une commande au double, sans émission à ESV. | **Bloqué, non exécuté** | Non mesurée |
| `enter-echo-start` | Une activation clavier transmet exactement une commande au double, sans émission à ESV. | **Bloqué, non exécuté** | Non mesurée |
| `space-echo-pause` | Une activation clavier transmet exactement une commande au double, sans émission à ESV. | **Bloqué, non exécuté** | Non mesurée |
| `hidden-disabled` | Start désactivé et Pause cachée exclus de la tabulation ; Start ne produit aucune commande. | **Bloqué, non exécuté** | Non mesurée |
| `focus-view` | Focus conservé sur l’onglet déclencheur après changement de vue ; Tab atteint une commande disponible. | **Bloqué, non exécuté** | Non mesurée |
| `focus-details` | Le tiroir est cohérent avec aria-expanded, garde le focus du bouton, exclut ses enfants fermés. | **Bloqué, non exécuté** | Non mesurée |
| `focus-pause` | Après disparition de Pause, le focus reste sur une commande visible/disponible du panneau ; il ne se perd pas sur body. | **Bloqué, non exécuté** | Non mesurée |
| `focus-error` | Erreur de reprise affichée dans la région live ; focus disponible sur Reprendre, erreur conservée au rafraîchissement. | **Bloqué, non exécuté** | Non mesurée |
| `zoom-home` | Zoom natif confirmé à 2, texte non tronqué et commandes atteignables après défilement. | **Bloqué, non exécuté** | Non mesurée |
| `zoom-native` | Zoom natif confirmé à 2, texte non tronqué et commandes atteignables après défilement. | **Bloqué, non exécuté** | Non mesurée |
| `zoom-automatic` | Zoom natif confirmé à 2, texte non tronqué et commandes atteignables après défilement. | **Bloqué, non exécuté** | Non mesurée |
| `reduced-motion` | Préférence reduce réellement émulée ; CSS/pseudoéléments et Web Animations restent figés sur un cut qui change. | **Bloqué, non exécuté** | Non mesurée |
| `motion-control` | Le témoin no-preference présente une animation réelle : la vérification reduce n’est pas vide. | **Bloqué, non exécuté** | Non mesurée |
| `contrast-light` | Tokens corrigés et couleurs calculées live/muted respectent le seuil 4,5:1 déjà adopté. | **Bloqué, non exécuté** | Non mesurée |
| `contrast-dark` | Tokens corrigés et couleurs calculées live/muted respectent le seuil 4,5:1 déjà adopté. | **Bloqué, non exécuté** | Non mesurée |

La tabulation va jusqu’à la dernière commande visible/disponible puis revient
en sens inverse ; ordre DOM, absence de tabindex positif et indicateur de focus
sont contrôlés. Les six activations mesurent les appels backend, une seule
commande attendue par activation, sans activer une commande cachée.
Les états synthétiques comprennent accueil, Écho vide/actif, Orbite vide,
actif, pause, rail non résolu et activité occupée. Le tiroir est ouvert/fermé
par le clavier et les enfants cachés sont exclus de la tabulation.

Attendus de focus explicités : un changement de vue garde le focus sur le
bouton déclencheur ; ouvrir/fermer les détails garde ce bouton ; une pause qui
fait disparaître Pause conserve un focus disponible, sans chute sur body ;
une erreur de reprise garde Reprendre et son message live après rafraîchissement.
Ce sont des assertions d’utilisation proposées pour le banc, pas des
comportements réellement confirmés de la base ni une décision U3.

### Zoom et mouvement

Le banc utilise `chrome.tabs.setZoom(tabId, 2)` et confirme `getZoom() === 2`
puis le changement DPR/largeur CSS, **à viewport inchangé**. Aucune réduction
simple du viewport ni propriété CSS zoom. Refus d’API : scénario bloqué.
Débordement horizontal, textes tronqués, commandes couvertes par le pied
sticky sont mesurés après défilement par hit-test. Méthode préparée, **non
exécutée ici** : il reste à confirmer son fonctionnement sous Chromium et
le comportement du poste Edge, de son popup et du menu natif.

La préférence réduit les mouvements via Playwright ; le banc interroge les
styles de tous les éléments/pseudoéléments et les Web Animations actives
après modification synthétique du cut. Un témoin no-preference vérifie que
la réduction n’est pas un contrôle vide. Contrastes : tokens corrigés et
couleurs calculées de l’état actif/texte secondaire, seuil adopté D-059.
Le seuil sur tous les SVG/fonds superposés et une certification générale
d’accessibilité ne sont pas couverts.

## Défauts, corrections et limites

**Aucun défaut UI observé : zéro essai UI exécuté.** Ne pas interpréter ceci
comme absence de défaut. Aucune demande de correction de production attribuable
à U1 ne peut encore être étayée par une sortie rouge navigateur. L’orchestrateur
recevra pour chaque échec futur : scénario, attendu, observation, reproduction,
source fichier:ligne et JSON en échec. Le développeur U2 ne corrigera pas le panneau.

Un défaut propre au support a été détecté avant livraison : le chemin relatif
du `require` dans `support.test.cjs` remontait quatre niveaux au lieu de trois.
Sortie rouge `support-rouge-chemin.log` : `MODULE_NOT_FOUND`. Correction limitée
à ce nouveau support ; sortie après correction `support-resultats.tap`.
Ce n’est pas un essai rouge de panneau ni un correctif U1.

Limites préparatoires : backend explicitement synthétique, pas de connexion
terrain ni garantie de conservation réelle. Les activations des exports,
abandon confirmé, SKIP explicite, reprise manuelle et nouveaux contrôles U1
restent à ajouter pour une couverture exhaustive ; l’accès par tabulation
est déjà prévu pour les commandes disponibles des états testés. Pas de
lecteur d’écran ni essai d’une livraison U1 future. Les fichiers navigateur
restent hors verify et n’ajoutent aucune réussite à ses comptes.

## Vérifications effectivement exécutées

Contrôles d’infrastructure (faux contexte API, **aucun faux test UI**) :

```sh
node --test --test-reporter=tap --test-timeout=7000 tests/browser/u2-49/support.test.cjs
```

```text
1..4
# tests 4
# suites 0
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 413.811773
```

Ils vérifient qu’aucun message ne traverse le double réel, le refus hors origine
extension, les options inconnues, et le rapport bloqué avec toutes ses lignes
lorsque Chromium manque. Fichier unique : durée totale ci-dessus, inférieure
à 7 s. Syntaxe explicite des 27 fichiers CJS nouveaux : contrôle à zéro
(`node --check` sur chacun). Les futurs fichiers de scénarios sont chacun
bornés à 7 s, lancement navigateur relevé à part. Aucune durée UI n’est supposée.

Contrôle final :

```sh
node tools/verify.cjs
```

Sortie stdout complète (TAP complet dans `audit/verification.txt`) :

```text
{"tests":1024,"suites":0,"pass":1022,"fail":0,"cancelled":0,"skipped":2,"todo":0}
Syntax: 37 runtime files. Geometry unchanged: true. Engine matches V4.6.0 baseline: true.
Bench mode: partial. Native corpus: absent (3 files). Skipped: 2 — skipped is not passed. Complete output: audit/verification.txt
```

Mode **partial** : 1024 tests,
1022 réussis, 0 échec,
2 sautés pour corpus privé absent.
Les sautés ne sont pas des réussites ; aucun corpus n’a été copié pour U2.
Ce résultat n’établit pas un rejeu privé J1 complet. Le banc U2 ne change
aucune décision moteur et ne revendique aucun résultat géométrique terrain.

## Preuve d’absence de modification de production

`tests/browser/u2-49/empreintes-production.json` compare les 38
fichiers de production (`background`, panneau, manifeste, `src`, `vendor`,
polices) **octet par octet** aux blobs de la base stable : tous identiques.
Moteur et fichiers gelés également contrôlés par verify ; aucune baseline changée.
Diff de production vide. Aucun fichier réservé V1/U1 ni harness partagé modifié.

Empreintes ciblées reprises par l’outil avant/après la tentative :

| Fichier | SHA-256 |
|---|---|
| `manifest.json` | `da8cbfae7778ab43ead5d0e91c44cbecc4d9e02ffff9adb6e4110d184435f91e` |
| `panel.html` | `657b8052b3c431991cf8520815fcf09d0eca7f3043d6f47d486e428e12046c26` |
| `panel.js` | `6c9983deafea736e6c881ba0ff543bac3001b59aaebaaabf07ad1b0b7bc2c1b5` |
| `panel.css` | `5805d69ade0d34b155fb1b4b6c91efc35125d934147dade1d252032b94680486` |

Le commit exact de la livraison est celui obtenu par
`git log -1 --format='%H' sol/49-u2-preparation-panneau` ; il est communiqué
avec le patch et le manifeste de livraison hors dépôt pour éviter une
référence circulaire dans ce même commit. Cible de la tentative de navigateur :
**base 042aee6 / manifeste 4.8.6**, panel/manifestes intacts ; ce n’est pas
la livraison U1. Commit local seulement : aucun push, merge, paquet terrain,
envoi de branche, étiquette ni publication.

## Reprise nécessaire et résumé en dix lignes

1. Développeur 3 : mission U2 préparation, cadrage D-072 respecté.
2. Branche séparée `sol/49-u2-preparation-panneau`, depuis v4.8.6 vérifiée.
3. Outil cible le vrai panneau sous origine extension, sans copie HTML.
4. 23 scénarios préparés, attentes/sources et durées publiables séparément.
5. Chromium absent ; installation standard échouée, preuve conservée.
6. 0 exécuté, 0 réussi, 0 échec UI observé, 23 bloqués : porte non passée.
7. Quatre contrôles d’infrastructure réussis ; pas de preuve navigateur.
8. Verify : 1 024 tests, 1 022 réussis, 0 échec, 2 sautés, mode partiel.
9. 38 fichiers de production intacts ; aucun correctif panneau ni résultat terrain.
10. Première exécution Chromium, compléments d’activation, puis rejeu U1/assemblage requis ; arrêt.

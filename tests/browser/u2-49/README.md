# Banc U2 (et résumé U1) — le vrai panneau d'Ariane dans Chromium

Ce banc charge le `panel.html` d'un **dossier cible** (un arbre Ariane) comme
extension MV3 dans un Chromium réel, sous l'origine `chrome-extension://`. Il ne
recopie aucun HTML, CSS ou JS du panneau. Il n'ouvre jamais de page ESV et ne
capture jamais ESV : seules les pages de l'extension sont ouvertes et capturées.

Préparé par la livraison U2 du 2 octobre 2026 (jamais exécuté alors), réécrit et
exécuté par la mission F (qualification) le 5 octobre 2026.

## Exécution

```sh
# Fenêtre réelle (recommandé) : Chromium à fenêtre sous Xvfb
xvfb-run -a -s '-screen 0 1280x1024x24' \
  node tools/navigateur-panneau-49.cjs DOSSIER_CIBLE --headed --output u2.json --captures captures/
# Suite du résumé de partie U1 (sans objet sur une cible sans src/part-summary-49.js)
xvfb-run -a -s '-screen 0 1280x1024x24' \
  node tools/navigateur-panneau-49.cjs DOSSIER_CIBLE --headed --suite u1-resume --output u1.json
# Suite du résumé réécrit par la mission G
xvfb-run -a -s '-screen 0 1280x1024x24' \
  node tools/navigateur-panneau-49.cjs DOSSIER_CIBLE --headed --suite g-resume --output g.json
# Quelques scénarios seulement
node tools/navigateur-panneau-49.cjs DOSSIER_CIBLE --scenario focus-pause,focus-error
```

Sur la machine partagée, toute exécution passe par le verrou commun (`flock`).
Prérequis : Node, Playwright (`PLAYWRIGHT_MODULE` sinon `playwright`), Chromium
(`CHROMIUM` sinon celui de Playwright). Aucune installation n'est faite par le banc.

Codes de sortie : 0 = sélection exécutée sans échec ni blocage ; 1 = échec ou
cible modifiée pendant l'essai ; 2 = blocage, ou rien d'exécuté (tout « sans objet »).
`executedScopeGate` ne vaut que pour la sélection et **ne déclare jamais U2 accepté**.

## Ce que le banc garantit

- **Extension réelle** : service worker MV3 vérifié (identifiant, nom, version du
  manifeste égaux à la cible), `panel.js` et `panel.css` chargés depuis la cible
  vérifiés avant chaque assertion ; commit, arbre, `git status` et empreintes de la
  cible publiés avant et après (`targetUnchanged`).
- **Profil neuf** pour chaque exécution, supprimé ensuite ; viewport 560 × 900,
  la largeur réelle de la fenêtre du panneau (`background.js` : `width:560`).
- **Réseau refusé** : mandataire local fermé (`--proxy-server=http://127.0.0.1:9`,
  boucle locale non exemptée), résolution DNS coupée, pages interceptées par
  Playwright. Une **sonde** le prouve à chaque exécution : un serveur local compte
  les requêtes ; Node l'atteint (témoin), la page d'extension et le service worker
  ne doivent jamais l'atteindre (`network.refuse`). Sinon : BLOCKED.
- **Backend synthétique** (`backend.cjs`) : seule `chrome.runtime.sendMessage` du
  panneau est remplacée ; les actions non simulées rendent une erreur et ne vont
  jamais au service worker. DOM, CSS, IndexedDB et scripts restent réels.
- **Journal de focus** sur chaque page : focusin/focusout, changements
  `hidden`/`disabled` des boutons, et tout changement d'`activeElement` (même
  silencieux). Il figure dans le diagnostic de tout échec.
- **Zoom 200 %** par `chrome.tabs.setZoom` (même niveau de zoom que Ctrl + ou le
  menu), confirmé par `getZoom() === 2` et par les métriques (largeur CSS, DPR),
  viewport inchangé. Ce zoom est mémorisé **par origine** : chaque scénario
  vérifie au départ un zoom de 100 % (`zoomInitial`, sinon BLOCKED) et le banc
  remet le zoom à 100 % après chaque scénario (`zoomAfterReset`).
- **Mise en page** : débordement horizontal, texte tronqué, puis chaque commande
  rendue atteinte au centre après défilement (hit-test, barre d'actions collante
  comprise). Une commande dans un `<details>` fermé n'est pas rendue et n'est pas
  comptée ; les tiroirs sont ensuite ouverts au clavier et le contrôle refait.
- **Captures** (`--captures`) : panneau seulement. Sous zoom, Playwright cadre en
  pixels CSS sans le facteur de zoom (images tronquées ou blanches) : le banc
  capture alors l'écran visible par CDP, sans cadrage.
- Budget de 7 s par scénario (navigation comprise) ; lancement de Chromium à part.

## Suites

`matrix.json` (suite `u2`, 24 scénarios) : les 23 scénarios de la préparation U2,
mêmes identifiants et mêmes attendus, plus `tab-echo-running` (ajout F : Écho en
cours, tiroir d'abandon fermé).

`matrix-u1-resume.json` (suite `u1-resume`, 6 scénarios) : résumé de partie U1
dans le vrai panneau, historique synthétique écrit dans l'IndexedDB réelle de
l'extension (profil jetable) : historique complet avec reprise, historique
indisponible (panne IndexedDB injectée dans la page de test), changement de
partie 23 → 24 → 23, historique partiel (début de lot manquant, identité
incomplète), identité de coupe incomplète, clavier et zoom 200 % du résumé.
Chaque scénario exige `src/part-summary-49.js` : « NOT_APPLICABLE » sinon.

`matrix-g-resume.json` (suite `g-resume`, 9 scénarios) : réécriture U1 de la mission G
(libellés propres à G). Les six cas et leurs attendus viennent de G, copiés tels quels
dans `fixtures-resume-g.cjs` (source `missions/G_PANNEAU/pour-F/fixtures-resume.cjs`,
SHA-256 `31789d73…f87603`). F ajoute à chaque cas : nombres exacts seulement si
l'historique est lu en entier, sinon « au moins N » ou « inconnu » ; transactions
IndexedDB du panneau toutes en lecture seule (relevé passif) ; aucune commande
envoyée. Et trois contrôles F : changement de partie 23 → 24 → 23 avec mouvement
réduit, clavier et zoom 200 % du résumé, thème sombre (contraste 4,5:1).
Les suites `u1-resume` et `g-resume` vérifient des libellés différents : chacune ne
vaut que pour sa réécriture.

## Limites

États synthétiques : pas de connexion ESV, pas de géométrie, pas de conservation
terrain. Pas de lecteur d'écran. Le zoom par le menu d'Edge et le poste de Mic ne
sont pas reproduits (Chromium seulement). La version de Chromium change certains
comportements de focus : elle est publiée dans chaque rapport (`browserVersion`).

Contrôles d'infrastructure (hors navigateur, hors verify) :

```sh
node --test --test-reporter=tap --test-timeout=7000 tests/browser/u2-49/support.test.cjs
```

## Fichiers historiques de la préparation (2 octobre 2026)

`resultat-486.json` (23 bloqués, 0 exécuté : Chromium absent alors),
`installation-chromium.log`, `support-resultats.tap`, `support-rouge-chemin.log`,
`syntaxe.log`, `empreintes-production.json` : preuves de la livraison de
préparation, citées par `audit/chantiers/u2-preparation-panneau.md`. Conservés
tels quels ; ils ne décrivent pas le banc actuel. Les résultats de qualification
sont livrés hors dépôt (dossier de la mission F).

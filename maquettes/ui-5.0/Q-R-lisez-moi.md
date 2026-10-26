# Maquettes Q « Signal » et R « Carnet technique » (24 octobre 2026)

Deux maquettes de la même architecture (« l'instrument et le tiroir », `architecture-ux.md`), une par direction artistique. Tout est inventé : chiffres, numéros de cuts, heures. Rien n'est construit dans l'extension.

## Ouvrir

- Double-cliquer sur `Q-signal.html` ou `R-carnet.html` dans Chrome. Les polices sont lues dans `../../fonts/` : garder les fichiers à leur place dans le dépôt.
- La barre du haut (hors maquette) choisit : la **scène**, la **taille** (600 × 760 ou compact 360 × 480), le **thème** (clair / sombre), la **Revue V1 / V2**, la **cadence de la simulation** (8 s ou 2 s par cut), le **mouvement réduit**. R a en plus l'option « mot d'état en Instrument Serif ».
- Dans la fenêtre : **Ctrl K** ouvre la palette, **Échap** ferme ce qui est ouvert, la poignée du bas ouvre le tiroir, **↑ ↓** parcourent une liste, **E** marque « examiné » (V2). Pause → « Pause demandée… » → En pause après le cut en cours, Reprendre relance.
- Paramètres d'adresse pour les captures : `?nu=1&scene=cours&taille=compact&theme=sombre&revue=v2&tiroir=1&cadence=rapide&reduit=1&serif=1`.

## Ce que chaque direction raconte

**Q · Signal.** Un appareil de cabine : graphite mat, filets d'un pixel, IBM Plex Sans et Plex Mono, une seule couleur vive à la fois. L'objet est le **rail** : une ligne graduée tous les 10 cuts, le segment des traités en encre, un repère ambre par différé, un curseur vert au cut en cours. Signe de vie : l'anneau du glyphe « en cours » se remplit du temps passé sur le cut (0 → médiane) ; le curseur glisse à chaque cut terminé. Clair = « papier technique ».

**R · Carnet technique.** Une fiche d'atelier : papier gris chaud, encre noire, bleu encre pour l'action, Bricolage Grotesque pour le mot d'état et le grand chiffre, Hanken Grotesk pour le texte, JetBrains Mono pour les cuts. L'objet est la **trame** : un carré par cut traité dans l'ordre du lot (plein : posé ; à bord : posé par la voie ; barré ocre : différé ; croix : SKIP ; point : repris), le carré « en cours » à contour épais se remplit du temps passé sur le cut, et les restants forment une seule barre grise, proportionnelle. Sombre = « ardoise ».

Commun aux deux : barre (logo, bascule Orbite / Écho, puce de l'onglet ESV, palette, réglages), instrument (mot d'état + glyphe, phrase, objet, ligne d'allure, une action principale), tiroir « Ce qui reste », bande cache permanente, feuille réglages, palette, confirmations, sélecteur d'onglets. Mode compact : la barre perd le mot « Ariane » et l'icône palette (Ctrl K reste), les compteurs passent sur deux lignes, le tiroir ouvert couvre l'instrument mais garde l'état sur sa poignée, la bande cache tient sur une ligne.

## L'allure : ce qui existe, ce qu'il faut ajouter

Vérifié dans le code (`src/engine.js`, `panel.js`, `src/ui5.js`) :

- **Existe déjà** : la durée de chaque cut posé (`batch.processed[].durationMs`, du début du cut à sa validation), l'heure d'ouverture du cut en cours (`batch.cutStartedAt`), l'heure de départ du lot (`batch.startedAt`), la durée des différés (`deferred[].durationMs`). Le panneau d'origine calcule déjà une médiane et un p90 **pour Écho** (`tempsParCut`, `quantile`), pas pour le lot. La « médiane observée 8 s » des maquettes D, J et L était un chiffre de maquette : `src/ui5.js` ne la calcule pas.
- **Donc calculable sans rien demander de nouveau à ESV** : la médiane des 20 derniers cuts, le remplissage proportionnel du glyphe et du carré (temps sur le cut ÷ médiane), le temps restant estimé (restants × médiane, seulement quand les ciblés sont connus), et des « cuts par minute » dérivés de la médiane.
- **À ajouter** : le calcul lui-même dans l'habillage (quelques lignes) ; pour des cuts par minute vrais, qui comptent aussi les navigations entre cuts, une heure de fin par cut posé (ou la lecture des événements horodatés) ; l'heure de mise en pause pour « en pause depuis » ; pour la relecture, une durée par cut relu (le module de relecture ne la garde pas aujourd'hui).

Le mouvement est proportionnel à la vitesse réelle : dans la maquette, la simulation tire une durée par cut autour d'une médiane et l'affichage n'invente rien d'autre.

## La Revue : V1 ou V2

- **V1 · lecture** : différés puis verts à contrôler, jamais mélangés, avec cut, motif, précision et heure. C'est ce que le panneau sait faire aujourd'hui.
- **V2 · surface de travail** : chaque ligne a « Ouvrir dans ESV » et « Examiner » ; la poignée et les sections comptent « reste à examiner ». **Fonction nouvelle à construire** : ouvrir un cut dans ESV demande une commande vers l'onglet ESV qui n'existe pas dans le panneau, et « examiné » demande un état conservé entre deux rendus. La maquette le signale dans le tiroir.

## Réalisable dans l'extension (hors réseau)

Oui pour tout ce qui est dessiné : polices OFL en fichiers locaux (sous `fonts/`, avec leur licence), pictogrammes SVG inline, tout en CSS, aucun canvas, aucune bibliothèque, aucun CDN. Le rail et la trame sont du HTML et du CSS. Le redessin toutes les deux secondes du panneau est compatible : les maquettes ne redessinent que le glyphe, le curseur ou le carré entre deux rendus complets. Le son d'incident (Signal) n'est pas dans les maquettes : à proposer, pas à promettre.

## Ce qui reste à décider

1. La direction : Signal ou Carnet, après les avoir vues à taille réelle à côté d'ESV, sur l'écran de Mic.
2. Clair ou sombre par défaut (les deux existent dans chaque direction).
3. Rail ou trame : lequel se lit le mieux après une heure.
4. Revue V1 (tout de suite) ou V2 (à construire).
5. Bricolage Grotesque, ou le mot d'état en Instrument Serif italique (option R), ou un repli plus neutre.
6. La taille réelle de la fenêtre chez Mic, et si le mode compact suffit.
7. Le nom et les états de la deuxième passe (session principale).

# CH-135 : l'interface alternative « Cadran » (D-368) : rapport

Branche `chantier/CH-135`, partie de `integration/cloture-50` (480928f). Relance : la première session n'avait rien poussé ; tout est reparti de zéro.

## Ce qui est livré
- **Réglages → « Interface : Instrument / Cadran »** (Instrument par défaut). Le choix passe sans recharger la page, la feuille reste ouverte, il est gardé (`banane51Interface`, clé existante) et rouvre le panneau en Cadran.
- **`src/cadran-rendu.js`** (pur, aucun DOM ni message) : part du rendu de l'instrument (`ArianeSignalRendu.rendre`, donc du même `modele()`), et ne remplace que des dessins : l'anneau devient **la voie en élévation** (deux rails, une traverse par cut ou par groupe de cuts au-delà de 60, plan de coupe bleu au cut en cours, doublé en pause, fanion orange par cut à poser, heurtoir à l'arrêt, bornes au repos et à la fin, tronçons par partie pour l'Aurore, une traverse par visite pour Écho) ; le glyphe d'état devient la voie en miniature ; « cut n/N » à droite du mot quand le total est connu ; compteurs de la maquette « Posés · À poser · Reste » quand le reste est connu. Sans total connu, la voie s'arrête au dernier cut traité et s'ouvre en pointillé : aucun total inventé.
- **`panel-cadran.css`**, sous `#ui5.u-cadran` seul (la feuille de l'instrument ne s'y applique pas, la réécriture de CH-134 ne le touche donc pas) : aplats, filets de 1 px, angles de 2 px, boutons de 44 px empilés, mot d'état en IBM Plex Mono capitales espacées, phrases et boutons en IBM Plex Sans (polices déjà au paquet, licences `fonts/OFL-IBMPlex*.txt`, rien chargé d'un serveur), « Ce qui reste » en pied, deux thèmes aux couleurs de la planche, rouge réservé à l'incident (un arrêt demandé reste à l'encre). Couches (menu, Ctrl K, onglets ESV, Réglages, Ce qui reste, Nouvelle Constellation, Détails techniques) habillées sans changer leur balisage.
- **Bascule « vue fil » de CH-134** : Cadran pose `sg:vue-lot` dans la tête et `data-vue="fil"` sur `.sg-fen` si l'instrument ne le fait pas déjà (garde anti-doublon) ; l'action reste à câbler par CH-134 (clic sans effet avant la fusion).
- **Télécommande** : le téléphone reste en Instrument (`src/telecommande-instantane.js` force `variante:'signal'` ; ÉTABLI à la lecture).

## Fichiers
Nouveaux : `src/cadran-rendu.js`, `panel-cadran.css`, `tests/ch135-cadran-rendu.test.cjs`, `tests/ch135-cadran-navigateur.test.cjs`, `chantiers/CH-135/outils/{scenes,photos,audit,page}.cjs`, ce rapport.
Communs, au plus court et marqués « CH-135 » : `src/ui5.js` (8 lignes), `src/signal-rendu.js` (1 ligne : le réglage), `panel.html` (2 balises), `tests/ui5-panneau.test.cjs` (raison : le nouveau script est déclaré entre signal-rendu et ui5, et passe les mêmes interdits). Aucun fichier protégé, aucun message nouveau au service worker.

## Preuves (mesurées)
- Essai pur : rouge d'abord (module absent), puis vert. Mêmes `data-act` dans le même ordre, mêmes boutons grisés, mêmes champs qu'en instrument sur 14 états × 7 couches ; voie, compteurs, bascule fil, réglage, pureté, aucune ressource externe. ÉTABLI.
- Essai navigateur (écrit après le code, pas rouge d'abord) : bascule sans recharger, choix gardé, retour à l'instrument ; sur 7 clics (Pause, Arrêter, Reprendre, Réessayer, Exporter, Démarrer, Écho), mêmes messages au service worker en Cadran qu'en instrument. ÉTABLI.
- Audit (débordement, sortie, troncature, contraste 4,5:1, rien sous 11 px) : 30 scènes × 11 largeurs (320 à 720 par 40) × 2 thèmes = 660 vues : 22 défauts, tous « zone à défiler » dans la seule scène « Détails ouverts » ; corrigé (fil coupé comme l'instrument), voir la remesure ci-dessous.
- Essais du panneau en instrument relancés : voir ci-dessous.

## Ce qui reste
- À la fusion avec CH-134 : retirer le filtre `sg:vue-lot` de l'essai de parité, vérifier que la bascule n'est rendue qu'une fois.
- La rangée « Palette » des Réglages reste visible en Cadran (même balisage que l'instrument) mais n'y change rien.

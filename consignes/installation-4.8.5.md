# Installer Ariane 4.8.5 (stable) — fiche de l'opérateur

**À faire seulement après le feu vert de la direction** (étiquette `v4.8.5`
et publication). Durée : 10 minutes. La 4.8.5 **remplace la 4.8.0 dans le même
dossier** : même extension, mêmes données.

## Avant

1. **Termine ou arrête le lot en cours** dans Orbite, et **télécharge ses
   exports** (« Tout télécharger pour l'analyse »). Termine et télécharge aussi
   une observation Écho en cours.
2. Vérifie dans Téléchargements que les fichiers sont bien là.

## Installer

1. Télécharge `ariane-v4.8.5.zip` et vérifie son empreinte SHA-256 (donnée
   avec le paquet et dans `LIRE_EN_PREMIER.md`).
2. Décompresse-le **dans le dossier de la 4.8.0**, en remplaçant les
   fichiers. **Ne supprime pas l'extension** : le stockage d'Écho et d'Orbite
   serait perdu.
3. `edge://extensions` → sur **Ariane**, bouton **Recharger**.
4. **Désactive les versions de test** (« Ariane 4.8.5 TEST », test 1 et
   test 2) si elles sont encore actives. Ne les supprime qu'après avoir
   téléchargé ce dont tu as besoin : chacune garde sa propre mémoire.
5. **F5 sur ESV**. Si Ariane dit « Une autre Ariane (4.8.0) est active… Si
   c'est une mise à jour de cette Ariane, F5 suffit » : c'est l'ancienne page,
   fais F5.

## Vérifier

- Accueil d'Ariane : **4.8.5** sous ARIANE (sans « test »).
- Bouton blanc au bas d'ESV : **Ariane 4.8.5 · ouvrir**.
- `edge://extensions` : une seule Ariane active, nommée **Ariane**, version
  **4.8.5**.

## Ce qui change pour toi

- **« refusés (écartement bas) »** dans la tuile Différés : Ariane diffère un
  premier passage sans appui dont les rails sont à moins de 1 420 mm ; pose-le
  toi-même.
- **Fin de partie** : si le lot s'arrête sur « fin de partie probable » (ou
  « à vérifier »), clique sur **Reprendre** (F5 seulement si ESV reste
  figée). Le lot se ferme. La fin n'est retenue que si ESV affiche une partie
  supérieure et que c'est le dernier cut. Si Ariane sait que ce n'est pas le
  dernier (« le cut N n'est pas le dernier »), rien à faire. Si elle ne peut
  pas le savoir, le panneau dit que ce cut « pourrait être le dernier » :
  saisis-le comme dernier cut si tu veux le retenir.
- **Une seule Ariane active à la fois.** Si le panneau dit « Ariane 4.8.5
  **en sécurité** » : une autre Ariane a tenté de commander l'onglet ;
  désactive-la, F5, puis **Reprendre**. Pendant une pose (« Validation
  refusée : la pose de ce cut est faite, non validée ») : **contrôle d'abord la
  pose dans ESV, avant tout F5**, puis désactive l'autre, F5, **Archiver le
  résultat interrompu**.
- **Export du journal lourd après Écho** (KI-068) : si tu as relu dans Écho
  avant d'exporter le lot, le journal d'Orbite contient aussi les données
  d'Écho (jusqu'à 1 Go). Exporte le lot **avant** la relecture quand tu le
  peux ; sinon envoie-le tel quel, je le filtre.

## En cas de problème

Retour à la 4.8.0 : `RETOUR_ARRIERE.md` (même dossier, puis F5 sur ESV,
obligatoire).

# Chantier 8 — fiche opérateur : une session réelle pour l'audit qualité

**Pour toi, l'opérateur.** Environ 50 minutes de travail normal dans Edge,
sur ESV, avec Ariane 4.8.0. Les exports disent déjà combien de temps prend
chaque cut. Ils ne disent pas ce que tu vois, ce qui te gêne, ni si la
mémoire de la page ESV grossit pendant un lot. L'auditeur (Astra) n'a pas
accès à ESV : cette session est sa seule vue de l'extension en
fonctionnement. Sans elle, ses constats sur les performances et l'UX restent
des hypothèses.

## Avant de commencer (5 minutes)

1. Installe `ariane-v4.8.0.zip` (voir `LIRE_EN_PREMIER.md`) et recharge ESV.
2. Note dans un fichier `notes.txt` :
   - le processeur et la mémoire du PC (Paramètres > Système >
     Informations) ;
   - la version d'Edge (`edge://version`, première ligne) ;
   - la taille de l'écran et la disposition choisie pour ESV et Ariane.
3. Choisis une partie avec du travail restant, idéalement une partie neuve.
   Prévois un lot d'au moins 30 minutes, soit environ 150 cuts.

## Les deux compteurs à photographier

- **Gestionnaire des tâches d'Edge** (Maj+Échap) : les lignes « Onglet : ESV… »
  et « Extension : Ariane », colonnes Mémoire et Processeur.
- **Moniteur de performances**, dans l'onglet ESV : F12, puis Ctrl+Maj+P,
  tape `performance monitor`, Entrée. Garde les courbes « JS heap size »,
  « DOM Nodes » et « JS event listeners ». Laisse les outils de
  développement ouverts pendant le lot, ancrés en bas.

Capture l'écran (Win+Maj+S) avec les deux compteurs visibles à quatre
moments : **T0** (Ariane ouverte, avant le lot), **T+15 min**, **T+30 min** et
**fin du lot**. Nomme les fichiers `T0.png`, `T15.png`, `T30.png`, `fin.png`.

## Déroulé

1. **Vidéo A (5 min environ)** : enregistre l'écran (Outil Capture d'écran,
   mode vidéo : Win+Maj+R). Filme de l'ouverture d'Ariane au lancement du lot
   Orbite, puis les dix premiers cuts. Dis à voix haute, ou note avec l'heure,
   ce que tu cherches ou ce qui n'est pas clair.
2. **Laisse tourner le lot sans y toucher** au moins 30 minutes, avec les
   captures T+15 et T+30.
3. **Vidéo B (3 min environ), essai F5** : pendant le lot, appuie sur F5 dans
   ESV. Attends la pause d'Ariane, puis clique sur « Reprendre ». Ce chemin
   n'a été essayé qu'en simulation : c'est sa première vraie mesure. Si
   quelque chose ne va pas, clique sur « Arrêter » et note l'heure.
4. **Vidéo C (3 min environ)** : fin du lot, ou « Arrêter ». Filme la lecture
   des chiffres du lot, les différés, puis « Tout télécharger pour
   l'analyse ». Capture `fin.png`.
5. **Écho (10 min, si tu as le temps)** : une session Écho sur une vingtaine
   de cuts de ton travail normal, puis son export.
6. **Irritants** : dans `notes.txt`, cinq lignes au plus, avec l'heure. Ce
   que tu as cherché, ce que tu n'as pas compris, ce que tu as cliqué pour
   rien, ce qui t'a fait attendre.

## Envoi

Mets tout dans une archive `audit-session-4.8.0.zip` : les quatre exports
d'Orbite, l'export Écho, les vidéos, les captures et `notes.txt`.

- Les **exports** (JSON) vont dans banane-data, comme d'habitude :
  `collections/AAAA-MM-JJ_v4.8.0_/session audit/`.
- Les **vidéos et captures** montrent l'écran d'ESV (noms de lignes,
  projets). Transmets-les à l'auditeur **en privé**, pas dans un dépôt :
  les dépôts sont publics.

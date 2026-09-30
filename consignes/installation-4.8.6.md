# Installer Ariane 4.8.6 (stable) — fiche de l'opérateur

**À faire seulement après le feu vert de la direction** (étiquette et publication). Durée : 10 minutes. La 4.8.6
**remplace la 4.8.5 dans le même dossier** : même extension, mêmes données.

## Avant
1. **Termine ou arrête le lot en cours** dans Orbite et **télécharge ses exports**. Termine et télécharge aussi une
   observation Écho en cours.
2. Vérifie dans Téléchargements que les fichiers sont bien là.

## Installer
1. Télécharge `ariane-v4.8.6.zip` et vérifie son empreinte SHA-256 (donnée avec le paquet).
2. Décompresse-le **dans le dossier de la 4.8.5**, en remplaçant les fichiers. **Ne supprime pas l'extension**.
3. `edge://extensions` → sur **Ariane**, **Recharger**.
4. **Désactive les versions de test** (« Ariane 4.8.6 TEST »). Ne les supprime qu'après avoir téléchargé ce dont tu as
   besoin : chacune garde sa propre mémoire.
5. **F5 sur ESV**.

## Vérifier
- Accueil : **4.8.6** sous ARIANE ; bouton blanc au bas d'ESV : **Ariane 4.8.6 · ouvrir** ; une seule Ariane active.

## Ce qui change pour toi
- **Dernier cut à valider d'une partie** : Ariane le reconnaît (compteur « N on M treated »). Cut posé : elle valide par
  **Ctrl+Entrée** et le lot se ferme (« Fin du lot : dernier cut à valider de la partie (N) validé ; ESV est resté sur ce
  cut »). Cut différé : rien n'est envoyé à ESV, le lot se ferme. ESV ne passe plus à la partie suivante.
- Si Ctrl+Entrée n'a pas l'effet attendu : le lot s'arrête avec un message (pose gardée, non validée) ; valide-le toi-même
  et préviens-moi.
- Un dernier cut à valider que rien ne permet de reconnaître (compteur illisible, cut validé à la main pendant le lot)
  reste traité comme avant : ESV peut quitter la partie.

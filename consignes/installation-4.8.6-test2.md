# Essayer Ariane 4.8.6 test 2 — fiche de l'opérateur

**Une seule question de terrain : Ctrl+Entrée valide-t-il le dernier cut d'une partie sans changer de
partie ?** La 4.8.6 test 2 s'installe **à côté** de la 4.8.5 (autre extension, autre mémoire).

## Installer

1. Vérifie l'empreinte SHA-256 de `ariane-4.8.6-test.2.zip` (donnée avec le paquet).
2. Décompresse-le dans un **nouveau dossier**, `edge://extensions` → « Charger l'extension non empaquetée ».
3. **Désactive la 4.8.5** (une seule Ariane active à la fois), **F5 sur ESV**.
4. Vérifie : **4.8.6 test 2** sous ARIANE ; bouton blanc « Ariane 4.8.6 test 2 · ouvrir ».

## L'essai

Choisis une partie dont le **dernier cut n'est pas validé** (Ariane détecte le dernier cut à valider par le compteur « N on M treated »). Lance un lot « jusqu'à la fin de la partie » qui arrive à ce cut.
- Attendu : Ariane pose, appuie sur **Ctrl+Entrée**, **ESV reste sur ce cut** (pas de changement de partie),
  le compteur passe de N à N+1, le lot se ferme sur « Fin du lot : dernier cut de la partie (M−1) validé ;
  ESV est resté sur ce cut ». Cut différé : « …, différé ; rien n'a été envoyé à ESV ».
- Si Ctrl+Entrée n'a pas l'effet attendu : le lot s'arrête avec un message (pose gardée, non validée) ; **valide
  toi-même**, et dis-moi ce que fait le raccourci dans ESV (ne change rien d'autre).
- Le dernier cut non validé plus tôt que M−1 n'est pas détectable : ESV quittera encore la partie (accepté).

Retour arrière : `RETOUR_ARRIERE.md` (cible 4.8.5).

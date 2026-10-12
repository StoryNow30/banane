# Séance terrain « test 3 » : consigne pour Mic (11 octobre 2026)

**Rien ne change dans la façon dont Ariane pose ou valide** : même moteur, mêmes réglages qu'au test 2. Ce paquet change
les exports (un seul fichier zip, cache qu'on peut vider) et la façon de noter la dernière validation d'un lot.

## Le paquet

- Fichier : `ariane-4.9.0-test.3.zip` (version 4.9.0.3, « 4.9.0 test 3 »), 1 234 508 octets (environ 1,2 Mo).
- SHA-256 : `2fa6442908e5ee2e857dd51914f12f6e90595d5c2d93b0ba8ca6a2e4e86f3799`.
- Construit avec `tools/package.py` depuis la tête `53aff3f` de la branche `claude/49-test-3` (verify : 1 263 essais,
  1 261 réussis, 0 échec, 2 sautés non réussis). Rien n'est publié ni fusionné.
- Nouveau par rapport au test 2 :
  - « Tout télécharger pour l'analyse » produit **un seul fichier zip** au lieu de plusieurs fichiers ;
  - un bouton **« Vider le cache des exports »**, avec une demande de confirmation ;
  - la dernière validation d'un lot est maintenant notée aussi quand tu arrêtes le lot toi-même
    (« Arrêter le lot ») ou quand le lot se termine normalement, pas seulement à la fin de partie.

## Avant de commencer

1. **Exporte d'abord ce qui reste dans l'ancienne Ariane** (« Tout télécharger pour l'analyse ») si ce n'est pas déjà
   envoyé : désinstaller une extension efface ce qu'elle gardait sur l'ordinateur. Vérifie que l'export est arrivé
   (fichier dans Téléchargements, taille non nulle, aucun message « Export incomplet ») et envoie-le-moi.
   **Si l'export n'est pas complet ou pas envoyé, ne désinstalle pas l'ancienne Ariane** : désactive-la (interrupteur
   dans chrome://extensions ou edge://extensions) et préviens-moi.
2. **Désinstalle l'ancienne Ariane** (4.9.0 test 2) seulement après l'étape 1 : une seule Ariane active à la fois. Puis
   installe ce paquet comme d'habitude.
3. **Recharge l'onglet ESV (F5) juste après l'installation**, puis choisis cet onglet dans Ariane. Sans rechargement,
   l'observateur n'est pas en place (le bilan dirait « Observateur : absent »).
4. Un seul onglet ESV si possible.

## La partie et les lots

- **Un lot par partie NEUVE** : une partie que personne n'a encore traitée. Ne reprends **aucune partie déjà traitée** :
  pas les parties **7, 8, 9 et 10** déjà traitées le 7 octobre avec le test 2 (l'identifiant du projet est tenu hors
  du dépôt : je te le redonne dans la conversation), ne les refais pas.
- **Dis-moi quelle partie (et quel projet) tu as prise** pour chaque lot.
- Travaille normalement avec Orbite. Aucun réglage à changer.

## Ce qui est nouveau à essayer

1. **« Tout télécharger pour l'analyse »** (vue Orbite) : à la fin, le message sous les boutons dit « 1 archive(s) zip …
   enregistrés dans Téléchargements ». Tu dois trouver **un seul fichier** `ariane-lot-<date>.zip` dans Téléchargements.
   Au-delà d'environ 1 Go, l'archive est coupée en plusieurs fichiers (`…-partie01.zip`, `…-partie02.zip`) : envoie-les tous.
2. **« Vider le cache des exports »** (dans « Exports du lot », sous les boutons « Télécharger… ») : efface de l'ordinateur
   ce qu'Ariane garde pour les exports (journal, visites, nuages LiDAR). Une fenêtre demande « Vider le cache des exports ? »
   avec ce qui sera supprimé : **OK** vide, **Annuler** ne touche à rien.
   - Le **vidage automatique est DÉSACTIVÉ** (réglage par défaut) : rien n'est jamais effacé tout seul après un export.
   - **Ne vide qu'APRÈS avoir vérifié** que le zip est bien enregistré (il est dans Téléchargements et sa taille n'est pas
     nulle) **ET envoyé** dans cette conversation. Dans le doute, ne vide pas : garder le cache ne gêne pas le lot suivant.
   - Pendant un lot en cours ou en pause, le bouton est grisé : c'est normal.
   - Juste après la fin d'un lot, Ariane peut répondre « Vidage impossible : les dernières observations du lot qui vient
     de finir peuvent encore arriver (5 s au plus) : réessaie dans quelques secondes ». Attends 5 secondes et recommence.

## À la fin de chaque lot

1. Clique sur « Tout télécharger pour l'analyse ».
2. Vérifie le zip dans Téléchargements, puis **envoie-le-moi dans cette conversation**.
3. Seulement ensuite, si tu veux, « Vider le cache des exports » (voir plus haut).

## Si un export échoue

Message « Export incomplet … », fichier absent ou de taille nulle : **ne vide rien** et **ne désinstalle pas Ariane**
(désinstaller efface tout ce qu'elle garde) : si tu dois l'écarter, désactive-la seulement, et préviens-moi. Envoie-moi
le message exact (copie ou photo) et les fichiers qui sont arrivés. Tu peux relancer « Tout télécharger pour l'analyse ».

## À noter dans ton retour

- Le poste (pro ou perso), le navigateur (Chrome ou Edge) et sa version.
- Si une autre fenêtre ESV était ouverte pendant le lot.
- Si l'extension Claude était active ou non dans ce navigateur.
- La partie et le projet de chaque lot, et si tu as vidé le cache (et quand).

## Si quelque chose d'anormal arrive

Ariane se bloque, ESV se comporte autrement, une fenêtre d'erreur apparaît : **arrête**, note l'heure et ce que tu as vu,
envoie-moi l'export. **Retour arrière** : exporte, puis vérifie que le zip est dans Téléchargements, que sa taille
n'est pas nulle et qu'aucun message « Export incomplet » n'est apparu, et envoie-le-moi. Ensuite seulement,
**DÉSACTIVE** la 4.9.0 test 3 (interrupteur dans chrome://extensions ou edge://extensions), **sans la supprimer**, puis
installe la 4.9.0 test 2 (`ariane-4.9.0-test.2.zip`, SHA-256
`06b1f2f728f584e7b05322a99301441e80712bcfa195f1cb39e05c55000f5ab2`), recharge ESV (F5) et choisis l'onglet. Ne supprime
la test 3 qu'après mon accord.

## Ce qui n'est pas vérifié (à savoir avant de partir)

- **Pas essayé sur le vrai ESV** : seulement dans un vrai Chromium contre notre copie locale d'ESV, et avec des données
  fabriquées pour les exports.
- **Mémoire du navigateur sur un export de 400 Mo et plus : non mesurée.**
- **Deux panneaux Ariane ouverts en même temps : non vérifié.** Garde un seul panneau ouvert.
- **Edge : non essayé.**
- La dernière validation après « Arrêter le lot » ou en fin normale de lot a été essayée avec un lot posé par script dans
  la copie locale, pas avec un vrai lot Orbite complet.

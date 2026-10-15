# Séance terrain « 4.9.5 test 3 » : des relevés en plus, un export plus léger (16 octobre 2026)

La 4.9.5 test 3 ajoute des **relevés en lecture seule** et allège le journal exporté. **Rien ne change dans ce qu'Orbite décide, lit, pose ou valide, ni dans ce qu'Écho observe.** Le moteur n'est pas modifié. Ariane n'envoie aucune commande de plus à ESV.

- **Ce que tu vois de nouveau : rien, sauf un avis possible** sous le message d'état du panneau. Il apparaît seulement si ESV a changé de façon qui compte pour Ariane :
  « ESV n’a plus le même contrat qu’à la dernière connexion (empreinte …, puis …). Rien ne s’arrête ; préviens-moi avant de lancer un lot. »
  ou « ESV a changé : des requêtes de rails passent par « fetch » (N vues), qu’Ariane ne voit pas. Les validations ne sont plus contrôlées : préviens-moi avant de lancer un lot. »
  S'il apparaît : ne lance pas de lot, note l'heure et le texte exact, et envoie-moi les exports.
- **Ce qui est relevé en plus, sans rien changer** : l'état des chargements de points d'ESV (réussis ou en échec, durée), la profondeur des nœuds lus et le budget de points,
  la part de points « au ras » à chaque cut, les champs de la liste d'ESV (leurs noms seulement), les événements internes d'ESV écoutés sans les gêner, une « empreinte » d'ESV à chaque
  « Connecter », le nombre de validés côté serveur à chaque rechargement de la liste, et le navigateur, l'ordinateur et la carte graphique dans l'en-tête de l'export.
- **Un export plus léger** : les mesures de temps de chaque visite sont regroupées. Le journal fait environ un tiers de moins ; rien n'est perdu pour l'analyse.

## Le paquet

`ariane-4.9.5-test.3.zip`, version 4.9.5.3, nom « 4.9.5 test 3 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne
est dans le paquet : elle ne peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que l'ancienne Ariane garde doit être **déjà exporté** (lot Orbite et session Écho).
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.5-test.3.zip -Algorithm SHA256`.
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la 4.9.5 test 3 par-dessus l'ancienne** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Ne désinstalle rien.
   Puis, dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane. **Note l'heure de ce F5.**
5. **Vérifie la version** : la carte dit « 4.9.5 test 3 », le panneau dit « ARIANE 4.9.5 test 3 » et le bouton blanc sur la page ESV dit « Ariane 4.9.5 test 3 · ouvrir ».
   Sinon, ne lance rien et dis-le-moi.

À la première connexion, Ariane note l'empreinte d'ESV et n'a rien à comparer : pas d'avis. Si un avis de contrat apparaît à une connexion suivante, vois plus haut.

Mêmes conditions que d'habitude pour toute la séance : fenêtre ESV d'au moins 600 pixels, extension Claude désactivée, un seul onglet ESV ouvert.

## 2. Ce que tu essaies en Orbite (30 minutes sans F5, puis F5 et 10 minutes)

1. **Une séance Orbite normale d'au moins 30 minutes, SANS F5 volontaire.** Lance un lot comme d'habitude (toute la partie, ou une grande plage)
   et laisse-le tourner. **N'appuie pas sur F5** pour la relancer, même si elle te paraît lente. Une pause de sécurité (« Lecture LiDAR instable ») peut arriver :
   clique sur **Reprendre**, sans F5, sauf si l'avis le demande.
2. **Puis un F5** : mets le lot en **Pause**, recharge l'onglet ESV (**F5**), attends que le cut s'affiche, puis **Reprendre**. **Note l'heure de ce F5.**
   Ariane relève alors la liste d'ESV : c'est la comparaison « validés côté serveur » contre ses propres validations.
3. **Encore 10 minutes** de lot après ce F5.
4. Note en une phrase : Ariane t'a-t-elle paru ralentir pendant la première demi-heure ? Est-elle repartie plus vite après le F5 ? Et si un avis (contrat d'ESV, ou
   « ESV a refusé d'enregistrer la validation… ») est apparu : le texte, l'heure, le cut.

Si tu dois t'arrêter avant les 30 minutes, ce n'est pas grave : exporte quand même, et dis-moi la durée.

## 3. Une courte séance Écho (environ 10 minutes, une dizaine de cuts)

1. **Démarre Écho** sur un cut affiché d'une partie déjà traitée par Orbite.
2. **Valide une dizaine de cuts** comme tu le fais d'habitude (Maj+Espace ou Ctrl+Entrée), dont un que tu corriges avant de valider.
3. **Terminer et télécharger** : l'export sort en volumes zip, avec un `CONTENU.txt`. Rien de plus à faire.

## 4. À la fin : les exports

- **Orbite** : attends 5 secondes, puis « Tout télécharger pour l'analyse ». L'export sort en volumes (`…-volume01-sur03.zip`, etc.).
  Envoie **tous les volumes**, tels quels, avec leur ligne SHA-256 (`Get-FileHash .\ariane-lot-*.zip -Algorithm SHA256`) et les heures de F5 notées.
  Le fichier journal est plus petit qu'avant : c'est voulu.
- **Écho** : envoie **tous les volumes** de l'export Écho, tels quels, avec leur ligne SHA-256 (`Get-FileHash .\ariane-echo-*.zip -Algorithm SHA256`).
- Vide le cache seulement après ma confirmation de réception.

## 5. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi les zips. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie les zips, puis
**désactive** la 4.9.5 test 3 (interrupteur dans `chrome://extensions`, sans la supprimer) et pose la 4.9.5 test 2, puis F5 sur ESV.
Le moteur est le même dans toutes ces versions.

## 6. Ce qui n'est pas vérifié

Tout a été essayé hors ligne (ESV simulé). Rien n'a été utilisé en séance réelle. Le statut des chargements de points dépend du navigateur (Chrome 109 ou plus) et peut manquer ;
les noms des boutons de navigation d'ESV et leurs écouteurs sont lus tels qu'ils sont, sans hypothèse : un avis de contrat dès la deuxième connexion serait peut-être une fausse alerte, dis-le-moi quand même.
Edge n'a pas été vu.

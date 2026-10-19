# Séance terrain « 4.9.5 test 4 » : l'Écho qui reprend après un F5, deux fenêtres ESV sans fausse alerte (16 octobre 2026)

La 4.9.5 test 4 corrige trois petites choses qui t'ont gêné, ajoute une mémoire de la liste d'ESV, et note en plus une idée de correction verticale sans jamais s'en servir.
**Rien ne change dans ce qu'Orbite décide, lit, pose ou valide, ni dans ce qu'Écho observe.** Le moteur n'est pas modifié. Ariane n'envoie aucune commande de plus à ESV et ne fait aucune requête de plus : ce que voit ESV est exactement ce qu'il verrait avec un humain.

## Ce qui est nouveau

- **La mémoire de la liste.** Ariane garde sur ton ordinateur, partie par partie, les bords qu'elle a écrits et une copie compacte de la liste d'ESV. Quand tu relis une partie, corriges des cuts, puis recharges la liste (F5) et démarres une séance, elle compte les cuts que tu as corrigés depuis son passage. Elle ne demande rien à ESV pour cela : elle lit la table que la page ESV tient déjà en mémoire. Le résumé de la partie dit « N corrections constatées ». La copie de la liste part dans l'export (un petit fichier `ariane-liste-partie…json`).
- **L'Écho reprend tout seul après un F5, et le F5 en Écho est de nouveau permis.** Avant, un F5 en pleine séance Écho reprenait trop tôt (avant que la liste d'ESV soit chargée) et laissait des périodes fantômes. Maintenant Écho attend que le cut s'affiche et que la liste soit lue, puis continue **la même séance** avec une nouvelle période. Rien n'est perdu. **C'est à essayer une fois, en fin de partie, avec l'heure notée** (section 3).
- **La référence humaine de l'Écho est mieux suivie.** Quand tu cliques un rail juste avant la touche de validation, ESV applique le déplacement une fraction de seconde *après* la touche : Écho gardait la pose d'avant. Maintenant elle suit l'écriture de validation d'ESV, qui porte la pose finale. C'était un cas sur 1 260 validations.
- **Deux fenêtres ESV ouvertes ne donnent plus de fausse alerte.** Ariane retient désormais l'« empreinte » d'ESV fenêtre par fenêtre (par onglet), et ne compare plus ce qui change selon l'état de la page (les libellés des boutons, le nombre d'écouteurs). Avant, deux fenêtres dans des états différents se disputaient la même empreinte et l'avis « ESV n'a plus le même contrat » alternait pour rien. Un vrai changement d'ESV est toujours signalé, pour la fenêtre concernée.
- **Le relevé `audit-serveur` est corrigé.** Il portait parfois la partie d'un lot terminé depuis longtemps. Il donne maintenant la partie de la séance en cours, et il sort aussi dans l'export d'Écho.
- **Une correction verticale est notée, jamais appliquée.** Sur les rails où le calage de convention est refusé, tu remontes la pose d'environ 3,6 mm. Ariane note, dans la décision de ces cuts, la pose qu'aurait donnée cette correction, à côté de la vraie. Cette pose-là n'est **jamais posée, ni commandée, ni validée** : la vraie pose est la même avec ou sans ce réglage. La page Réglages montre une ligne de plus, « Correction verticale en ombre (P8) ».
- **Le plafond de convention reste coupé.** La version le contient, mais il est éteint ; les rails refusés sont posés comme avant.
- **Le logo** « La voie » (celui que tu as choisi, déjà dans la test 3) sur la carte Ariane et dans la barre d'outils.
- **Pour le reste, rien de nouveau à l'écran, sauf un avis possible** sous le message d'état du panneau. Il apparaît seulement si ESV a changé de façon qui compte pour Ariane :
  « ESV n’a plus le même contrat qu’à la dernière connexion (empreinte …, puis …). Rien ne s’arrête ; préviens-moi avant de lancer un lot. »
  ou « ESV a changé : des requêtes de rails passent par « fetch » (N vues), qu’Ariane ne voit pas. Les validations ne sont plus contrôlées : préviens-moi avant de lancer un lot. »
  S'il apparaît : ne lance pas de lot, note l'heure et le texte exact, et envoie-moi les exports.

## Le paquet

`ariane-4.9.5-test.4.zip`, version 4.9.5.4, nom « 4.9.5 test 4 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne
est dans le paquet : elle ne peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que l'ancienne Ariane garde doit être **déjà exporté** (lot Orbite et session Écho).
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.5-test.4.zip -Algorithm SHA256`.
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la 4.9.5 test 4 par-dessus l'ancienne** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Ne désinstalle rien.
   Puis, dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane. **Note l'heure de ce F5.**
5. **Vérifie la version** : la carte dit « 4.9.5 test 4 », le panneau dit « ARIANE 4.9.5 test 4 » et le bouton blanc sur la page ESV dit « Ariane 4.9.5 test 4 · ouvrir ».
   Sinon, ne lance rien et dis-le-moi.

À la première connexion d'une fenêtre, Ariane note l'empreinte d'ESV et n'a rien à comparer : pas d'avis. Si un avis de contrat apparaît à une connexion suivante de la même fenêtre, vois plus haut.

Mêmes conditions que d'habitude pour toute la séance : fenêtre ESV d'au moins 600 pixels, les autres extensions d'assistant IA désactivées, un seul onglet ESV ouvert (sauf pour l'essai de la section 4).

## 2. Ce que tu essaies en Orbite (30 minutes sans F5, puis F5 et 10 minutes)

1. **Une séance Orbite normale d'au moins 30 minutes, SANS F5 volontaire.** Lance un lot comme d'habitude (toute la partie, ou une grande plage)
   et laisse-le tourner. **N'appuie pas sur F5** pour la relancer, même si elle te paraît lente. Une pause de sécurité (« Lecture LiDAR instable ») peut arriver :
   clique sur **Reprendre**, sans F5, sauf si l'avis le demande.
2. **Puis un F5** : mets le lot en **Pause**, recharge l'onglet ESV (**F5**), attends que le cut s'affiche, puis **Reprendre**. **Note l'heure de ce F5.**
   Ariane relève alors la liste d'ESV : c'est la comparaison « validés côté serveur » contre ses propres validations, et la mémoire de la liste.
3. **Encore 10 minutes** de lot après ce F5.
4. Note en une phrase : Ariane t'a-t-elle paru ralentir pendant la première demi-heure ? Est-elle repartie plus vite après le F5 ? Et si un avis (contrat d'ESV, ou
   « ESV a refusé d'enregistrer la validation… ») est apparu : le texte, l'heure, le cut.

Si tu dois t'arrêter avant les 30 minutes, ce n'est pas grave : exporte quand même, et dis-moi la durée.

## 3. Une séance Écho avec un F5 en fin de partie (environ 15 minutes)

1. **Démarre Écho** sur un cut affiché d'une partie déjà traitée par Orbite.
2. **Valide une dizaine de cuts** comme tu le fais d'habitude (Maj+Espace ou Ctrl+Entrée), dont un que tu corriges avant de valider, et dont un où tu cliques un rail juste avant la touche si cela t'arrive naturellement.
3. **Un seul F5**, **en fin de partie**, quand tu as fini de valider ce que tu voulais valider (si ça tourne mal, tu ne perds rien d'important). **Note l'heure de ce F5**, à la seconde près si tu peux.
4. Regarde ce qui se passe, sans toucher à rien :
   - un **bandeau rouge** « CAPTURE ARRÊTÉE » apparaît en bas d'ESV, puis disparaît quand la page est rechargée et que la liste est lue (de l'ordre de 7 à 10 secondes) ;
   - **la même séance continue** : tu n'as pas à redémarrer Écho. Ne valide rien avant que le bandeau ait disparu et que le cut soit affiché ;
   - si rien ne se passe au bout de 60 secondes, c'est que la reprise automatique a renoncé : clique sur **Connecter** puis **Reprendre**, comme avant, et note l'heure.
5. Valide encore deux ou trois cuts après la reprise, pour vérifier qu'Écho les voit.
6. **Terminer et télécharger** : l'export sort en volumes zip, avec un `CONTENU.txt`. Rien de plus à faire.

Note en une phrase : le bandeau est-il apparu, a-t-il disparu seul, après combien de temps à peu près, et Écho a-t-il vu les cuts d'après ?

## 4. Deux fenêtres ESV (si tu en as deux ouvertes)

À faire à part, pas pendant un lot, environ 5 minutes. C'est ce qui produisait les fausses alertes de contrat.

1. Ouvre la partie dans deux fenêtres ESV, dans des états un peu différents (un cut différent dans chacune ; dans l'une, un rail sélectionné).
2. Dans Ariane, **Connecter** la première fenêtre, puis la seconde, puis de nouveau la première, puis de nouveau la seconde.
3. Il n'y a plus de fausse alerte : aucun avis « ESV n’a plus le même contrat… ». Si l'avis apparaît quand même, note l'heure et le texte exact, dis-moi dans quelle fenêtre tu étais, et envoie-moi les exports.

## 5. À la fin : les exports

- **Orbite** : attends 5 secondes, puis « Tout télécharger pour l'analyse ». L'export sort en volumes (`…-volume01-sur03.zip`, etc.).
  Envoie **tous les volumes**, tels quels, avec leur ligne SHA-256 (`Get-FileHash .\ariane-lot-*.zip -Algorithm SHA256`) et les heures de F5 notées.
- **Écho** : envoie **tous les volumes** de l'export Écho, tels quels, avec leur ligne SHA-256 (`Get-FileHash .\ariane-echo-*.zip -Algorithm SHA256`) et l'heure du F5.
- Vide le cache seulement après ma confirmation de réception.

## 6. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi les zips. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie les zips, puis
**désactive** la 4.9.5 test 4 (interrupteur dans `chrome://extensions`, sans la supprimer) et pose la 4.9.5 test 3, puis F5 sur ESV.
Le moteur est le même dans toutes ces versions.

## 7. Ce qui n'est pas vérifié

Tout a été essayé hors ligne (ESV simulé). Rien n'a été utilisé en séance réelle avec cette version.

- **Le F5 en Écho** : les délais d'attente (liste silencieuse depuis 2,5 secondes, 60 secondes au plus) viennent d'un seul relevé réel. C'est pour cela que je te demande de l'essayer une fois, en fin de partie.
- **La fausse alerte à deux fenêtres** : corrigée sur des fenêtres simulées. Si les classes des boutons de rail changent elles aussi selon l'état, un avis pourrait encore apparaître ; dis-le-moi quand même.
- **Les contrats entre deux jours** : l'empreinte d'une fenêtre ne dure que le temps de la session du navigateur. Un changement d'ESV pendant la nuit n'est plus signalé par un avis (l'empreinte reste notée dans le journal à chaque connexion).
- La mémoire de la liste et la référence humaine corrigée n'ont été vues que sur des exports déjà collectés et sur le banc simulé.
- Edge n'a pas été vu.

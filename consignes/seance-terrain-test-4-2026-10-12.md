# Séance terrain « test 4 » : consigne pour Mic (12 octobre 2026)

**Rien ne change dans la façon dont Ariane pose ou valide** : même moteur, mêmes réglages qu'au test 3. Ce paquet corrige
une seule chose : le bouton « Vider le cache des exports » marche maintenant aussi après un lot qui s'est terminé sur son
**dernier cut différé**. Le 12 octobre, il répondait « Vidage impossible : une capture est en cours (STALE) » dans ce cas.

## Le paquet

- Fichier : `ariane-4.9.0-test.4.zip` (version 4.9.0.4, « 4.9.0 test 4 »), environ 1,2 Mo. C'est un **numéro neuf** : il ne
  se confond pas avec la test 3 (4.9.0.3, paquet du 12 octobre).
- Taille exacte et SHA-256 : dans le fichier `ariane-4.9.0-test.4.zip.sha256` livré avec le paquet et dans mon message
  (cette consigne est dans le paquet : elle ne peut pas porter sa propre empreinte).
- Construit avec `tools/package.py` depuis la branche `claude/49-test-4` (commit donné dans mon message ; verify : 0 échec,
  relevé dans `audit/verification.txt` du paquet). Rien n'est publié ni fusionné.
- Nouveau par rapport au test 3 :
  - **« Vider le cache des exports » est permis après un lot terminé sur un dernier cut différé** (et aussi sur un dernier
    cut posé mais pas validé, ou laissé sans commande, qui laissent le même état) ;
  - dans ce cas Ariane **garde volontairement le nuage LiDAR de la capture du dernier cut**, et les lignes du journal qui s'y
    rapportent : la fenêtre de confirmation le dit (« Sera GARDÉ : la capture ouverte du dernier cut … »), et le message
    après le vidage aussi (« 1 nuage gardé : capture du dernier cut … »). **Ce n'est pas une perte ni une erreur** : ce nuage
    reste dans le cache et repartira dans le **prochain export** (tu le verras donc une deuxième fois, c'est normal).
- Le reste est comme au test 3 : un seul fichier zip pour « Tout télécharger pour l'analyse », vidage avec confirmation,
  vidage automatique désactivé, dernière validation notée aussi après « Arrêter le lot » et en fin normale de lot.

## Avant de commencer

1. **Exporte d'abord ce qui reste dans l'ancienne Ariane** (« Tout télécharger pour l'analyse ») si ce n'est pas déjà
   envoyé : désinstaller une extension efface ce qu'elle gardait sur l'ordinateur. Vérifie que l'export est arrivé
   (fichier dans Téléchargements, taille non nulle, aucun message « Export incomplet ») et envoie-le-moi.
   **Si l'export n'est pas complet ou pas envoyé, ne désinstalle pas l'ancienne Ariane** : désactive-la (interrupteur
   dans chrome://extensions ou edge://extensions) et préviens-moi.
2. **Pose la test 4 d'UNE seule de ces deux façons** (pas les deux). Après l'étape 1 dans tous les cas :
   - **Par-dessus l'ancienne Ariane** (4.9.0 test 3, la plus simple, comme les fiches d'installation 4.8.x) : décompresse le zip
     de la test 4 **dans le même dossier** que celui où tu as installé la test 3, en remplaçant les fichiers. **Ne désinstalle rien.**
     Puis, dans `chrome://extensions` (ou `edge://extensions`), clique sur **Recharger** sur la carte « Ariane ». C'est la
     **même extension** : elle garde son cache. (Mesuré dans Chromium : mêmes fichiers remplacés dans le même dossier,
     navigateur relancé avec le même profil. Le bouton « Recharger » lui-même : non essayé.)
   - **Dans un nouveau dossier** : décompresse le zip dans un dossier neuf, puis « Charger l'extension non empaquetée »
     (Chrome) ou « Charger l'extension décompressée » (Edge) et choisis ce dossier. C'est une **autre** extension, avec un
     **cache vide**. La test 3 garde le sien tant que tu ne la supprimes pas (les deux points sont mesurés dans Chromium,
     même profil) : **désactive-la** (interrupteur). Tu ne peux la désinstaller qu'après l'étape 1 (désinstaller efface son
     cache) ; tu peux aussi la laisser désactivée.
   Dans les deux cas : **une seule Ariane active à la fois**.
3. **Recharge l'onglet ESV (F5) juste après l'installation**, puis choisis cet onglet dans Ariane. Sans rechargement,
   l'observateur n'est pas en place (le bilan dirait « Observateur : absent »).
4. Un seul onglet ESV si possible.

## La partie et les lots

- **Un lot par partie NEUVE** : une partie que personne n'a encore traitée. Ne reprends **aucune partie déjà traitée** :
  pas les parties **7, 8, 9 et 10** déjà traitées le 7 octobre avec le test 2, ni la partie traitée le 12 octobre avec le
  test 3 (l'identifiant du projet est tenu hors du dépôt : je te le redonne dans la conversation).
- **Dis-moi quelle partie (et quel projet) tu as prise** pour chaque lot.
- Travaille normalement avec Orbite. Aucun réglage à changer.

## Ce qui est nouveau à essayer

1. **« Tout télécharger pour l'analyse »** (vue Orbite) : comme au test 3. À la fin, le message sous les boutons dit
   « 1 archive(s) zip … enregistrés dans Téléchargements ». Tu dois trouver **un seul fichier** `ariane-lot-<date>.zip` dans
   Téléchargements. Au-delà d'environ 1 Go, l'archive est coupée en plusieurs fichiers (`…-partie01.zip`, `…-partie02.zip`) :
   envoie-les tous. Si le zip est trop gros pour être envoyé d'un coup dans la conversation, tu peux reprendre **l'astuce du
   découpage en morceaux de 20 Mo** ; envoie alors tous les morceaux.
2. **« Vider le cache des exports »** (dans « Exports du lot », sous les boutons « Télécharger… ») : efface de l'ordinateur
   ce qu'Ariane garde pour les exports (journal, visites, nuages LiDAR). Une fenêtre demande « Vider le cache des exports ? »
   avec ce qui sera supprimé : **OK** vide, **Annuler** ne touche à rien.
   - Le **vidage automatique est DÉSACTIVÉ** (réglage par défaut) : rien n'est jamais effacé tout seul après un export.
   - **Ne vide qu'APRÈS avoir vérifié** que le zip est bien enregistré (il est dans Téléchargements et sa taille n'est pas
     nulle) **ET envoyé** dans cette conversation. Dans le doute, ne vide pas : garder le cache ne gêne pas le lot suivant.
   - Pendant un lot en cours ou en pause, le bouton est grisé : c'est normal. Il redevient utilisable dès que le lot est
     fini : arrêté, arrivé en fin de partie ou terminé tout seul.
   - Juste après la fin d'un lot, Ariane peut répondre « Vidage impossible : les dernières observations du lot qui vient
     de finir peuvent encore arriver (5 s au plus) : réessaie dans quelques secondes ». Attends 5 secondes et recommence.
3. **NOUVEAU : « Vider le cache des exports » après un lot terminé sur son dernier cut différé** (message du lot :
   « Fin du lot : dernier cut à valider de la partie …, différé ; rien n'a été envoyé à ESV »). C'est le cas qui t'a bloqué.
   - Le bouton est utilisable. La fenêtre de confirmation te dit ce qui sera supprimé **et** ce qui sera gardé
     (« Sera GARDÉ : la capture ouverte du dernier cut (1 nuage LiDAR, … événements liés) »). Les chiffres « supprimé » ne
     comptent pas ce qui est gardé.
   - Après **OK**, le message dit par exemple « Cache des exports vidé : … 1 nuage gardé : capture du dernier cut (… événements
     liés gardés aussi). Elle partira avec le prochain export. » **C'est voulu** : ce nuage est celui du dernier cut, que le
     lot n'a pas terminé ; Ariane le garde pour ne rien perdre et pour que le lot puisse être repris ou la capture annulée.
   - Si tu vides une deuxième fois sans rien faire entre-temps, Ariane répond « Rien d'autre à vider » : il ne reste que cette
     capture gardée.
   - Ariane refuse encore, et c'est normal, dans ces cas : lot **arrêté à la main au milieu d'un cut** (le message explique :
     clique sur « Reprendre » et laisse le lot aller jusqu'à sa fin, puis vide), lot en cours, en pause ou en erreur, résultat
     d'une commande à contrôler dans ESV, Écho actif.
   - **Note-moi le message exact** que tu vois dans la fenêtre et après le vidage.

## À la fin de chaque lot

1. Attends 5 secondes après la fin du lot, puis clique sur « Tout télécharger pour l'analyse ».
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
- Après un lot terminé sur un dernier cut différé : le message de la fenêtre de confirmation et celui d'après le vidage.

## Si quelque chose d'anormal arrive

Ariane se bloque, ESV se comporte autrement, une fenêtre d'erreur apparaît : **arrête**, note l'heure et ce que tu as vu,
envoie-moi l'export. **Retour arrière** : exporte, puis vérifie que le zip est dans Téléchargements, que sa taille
n'est pas nulle et qu'aucun message « Export incomplet » n'est apparu, et envoie-le-moi. Ensuite seulement,
**DÉSACTIVE** la 4.9.0 test 4 (interrupteur dans chrome://extensions ou edge://extensions), **sans la supprimer**, puis
installe, **dans un nouveau dossier** (pas par-dessus la test 4, qui garde ainsi son cache), la 4.9.0 test 3
(`ariane-4.9.0-test.3.zip`, SHA-256
`3612bd3886e86777aad5c4923021bf93ef131edb94db472a9f1143d18c2fabba`) ou, si je te le demande, la 4.9.0 test 2
(`ariane-4.9.0-test.2.zip`, SHA-256 `06b1f2f728f584e7b05322a99301441e80712bcfa195f1cb39e05c55000f5ab2`) ; recharge ESV (F5)
et choisis l'onglet. Ne supprime la test 4 qu'après mon accord. Avec la test 3, « Vider le cache des exports » reste refusé
après un lot terminé sur un dernier cut différé (c'est le défaut corrigé ici).
## Petites précautions (limites connues)

- Cette séance se fait avec **Orbite seulement** : pas d'Écho (ses observations seraient rangées avec le dernier lot).
- **Ne change pas l'heure de l'ordinateur** pendant un lot : la dernière validation pourrait ne pas être notée.
- Si un lot passe **en erreur**, exporte avant d'en lancer un autre, et dis-le-moi.
- Si tu vides le cache puis **reprends un lot que tu avais arrêté**, garde et envoie **les deux zips** (avant et après le
  vidage) : chacun n'a qu'une partie du lot.

## Ce qui n'est pas vérifié (à savoir avant de partir)

- **Pas essayé sur le vrai ESV** : seulement dans un vrai Chromium contre notre copie locale d'ESV, et avec des données
  fabriquées pour les exports.
- Le vidage après un dernier cut différé a été essayé avec des lots simulés de bout en bout (service worker réel, ESV simulé)
  et dans un vrai Chromium avec un état posé par script, pas avec un vrai lot Orbite complet dans le vrai ESV. Dans cet
  essai, l'état « STALE » (celui du message du 12 octobre) est posé à la main ; dans la vraie séance, Ariane le pose quand tu
  navigues dans ESV (lu dans le code, non observé dans le vrai ESV).
- **Mémoire du navigateur sur un export de 400 Mo et plus : non mesurée.**
- **Deux panneaux Ariane ouverts en même temps : non vérifié.** Garde un seul panneau ouvert.
- **Edge : non essayé.**
- **Le bouton « Recharger » de chrome://extensions et d'edge://extensions : non essayé** (essayé seulement : fichiers remplacés dans
  le même dossier, navigateur relancé).
- La dernière validation après « Arrêter le lot » ou en fin normale de lot a été essayée avec un lot posé par script dans
  la copie locale, pas avec un vrai lot Orbite complet.

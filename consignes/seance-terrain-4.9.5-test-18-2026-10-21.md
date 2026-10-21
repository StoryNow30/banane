# Séance terrain « 4.9.5 test 18 (L1-e6) » : la deuxième passe pose en fin de lot, et la partie 0 corrige la recherche

**Ce qui change par rapport à la test 16 :**

1. **La deuxième passe des différés, en fin de lot, ÉCRIT DANS ESV.** Elle est **allumée** dès l'installation, sans limite de poses (ta décision du 21/10). **Son écriture n'a jamais été jouée dans ESV** : voir § 3.
2. **Une correction tirée de la partie 0 du troisième projet** : la recherche recentrée accepte une paire jusqu'à **25 mm** en hauteur du voisin (20 en test 16). Sur la partie 0, deux poses fausses de la test 16 (846 et 847, mauvaise voie) deviennent justes, et trois cuts de plus sont posés justes.
3. **Le nouveau panneau, à l'essai.** Le panneau d'avant reste celui du départ. Le lien « Essayer le nouveau panneau », en bas du panneau, ouvre la maquette v2. « Ancien panneau », dans ses Réglages, revient. La palette (Ctrl K) est dans le nouveau panneau.
4. **Pause et reprise de la relecture** : construites, **éteintes**. Tu les allumes dans la carte « Relecture » (« Pause et reprise de la relecture (même après un F5) ») ; « Si ESV est rechargé pendant la relecture » : mettre en pause (défaut) ou arrêter.

La 4.9.5 test 17 (UI) est le paquet « interface seule » sur le moteur de la test 16 ; cette test 18 contient la même interface **plus** la deuxième passe et la correction de la recherche.

Tout ce que la chaîne du lot posait avant, elle le pose comme avant. La décision des différés pendant le lot est celle de la test 16, au seul réglage de hauteur près.

**Vocabulaire.** Un **cut laissé sans pose** est un cut que la chaîne n'a pas posé et que la GCV2 n'a pas posé non plus, alors que le nuage est là. Les cuts à nuage vide ne comptent pas. **Moins il y en a, mieux c'est.**

## Ce que dit le banc

Rejeux de tes lots contre tes Échos, pas des mesures terrain. **Les neuf anciens lots et la partie 0 ont tous servi à régler** : les chiffres ne disent pas ce que la test 18 fera sur une partie nouvelle. La test 18 est mesurée telle que tu l'auras : **avec** la deuxième passe.

MESURES_TABLEAU

## 1. Installer et vérifier

1. Exporte d'abord ce que ta version actuelle garde.
2. **Contrôle l'empreinte du zip** (PowerShell, dans le dossier du zip) : `Get-FileHash .\ariane-4.9.5-test.18.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message, sinon n'installe pas.
3. **Pose la test 18 par-dessus** : décompresse le zip dans le même dossier, en remplaçant les fichiers. **Ne désinstalle rien.** Dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
4. **F5 sur l'onglet ESV**, puis choisis-le dans Ariane.
5. **Vérifie la version** : la carte, le panneau et le bouton blanc d'ESV disent « 4.9.5 test 18 (L1-e6) ».
6. **Vérifie l'interrupteur** : Orbite, « Règles et choix du prochain lot », case **« Deuxième passe des différés en fin de lot (écrit dans ESV) »** : elle est **cochée**.

## 2. Ce que fait la deuxième passe

À la fin naturelle d'un lot (dernier cut atteint), sous le profil livré, Ariane reprend les cuts que le lot a laissés rouges. Elle les redécide avec **les poses d'avant ET d'après** (deux passes au plus), puis elle **les pose et les valide sur place**, un par un, dans l'ordre de sa décision.

Pour chaque cut, dans l'ordre :

1. elle va au cut et vérifie qu'ESV l'affiche ;
2. elle vérifie que la pose d'ESV est celle de la visite du lot, à 1 mm près ;
3. elle vérifie dans la liste d'ESV que le cut est **rouge** et pas traité par un opérateur : **jamais d'écrasement d'un vert** ;
4. elle pose (clic « tout recentré »), puis relit la pose à 1 mm ; sinon elle remet la pose d'avant ;
5. elle valide sur place (Ctrl+Entrée) et le prouve : le compteur « N on M treated » avance, le même cut est affiché, et l'écriture « valid » de la ligne est vue.

**Au premier refus ou à la première anomalie, elle s'arrête** : les poses suivantes comptaient sur celle-ci. Si la validation est partie sans preuve, la pose reste, et Ariane te demande de contrôler ce cut (« J'ai contrôlé le cut N ») avant tout nouveau lot.

**Pendant qu'elle écrit** : le panneau d'avant affiche en ambre **« La deuxième passe travaille, ne touche à rien dans ESV »**, avec le cut et l'avancement ; le nouveau panneau affiche « Deuxième passe en cours » et la commande verrouillée « Ne touche à rien dans ESV ». **Ne touche à rien dans ESV tant qu'elle n'a pas fini.** Le bouton **« Arrêter la deuxième passe »** l'arrête avant le cut suivant.

**Ce qu'elle ne fait pas seule** : si le lot s'est arrêté sur une pose d'Ariane **non validée** (le dernier cut d'un lot borné, souvent), elle ne part pas. Valide (ou corrige) ce cut dans ESV, puis clique sur **« Relancer la deuxième passe »**. Elle ne part pas non plus pendant une relecture en cours ou en pause. La relecture après le lot attend la fin de la deuxième passe.

**Pour la couper** : décoche la case de l'étape 6 du § 1 (ou, dans le nouveau panneau, Réglages, « Deuxième passe (écrit dans ESV) » : Coupée). C'est pris en compte tout de suite : une passe en train d'écrire s'arrête avant le cut suivant, et la suivante ne part plus.

## 3. Le premier lot : sois présent

**L'écriture de la deuxième passe n'a jamais été jouée dans ESV.** Elle a été essayée contre un ESV simulé, et sa décision a été rejouée au banc, mais Ctrl+Entrée sur un cut rouge atteint hors de l'ordre du lot n'a jamais été vu sur le vrai ESV.

1. Pour le **premier lot**, choisis une plage **courte** et reste devant l'écran jusqu'à la fin de la deuxième passe.
2. Regarde chaque cut qu'elle pose : il doit passer au vert, et la pose doit être la bonne voie.
3. **Au premier refus, au premier message d'anomalie, ou à la première pose qui te paraît fausse : clique sur « Arrêter la deuxième passe », décoche la case, note le cut et l'heure, exporte.**
4. Si tout se passe bien, garde-la allumée pour les lots suivants.

## 4. Pendant et après le lot

**Chaque pose est définitive dans ESV.** Un vert faux est pire qu'un rouge.

Note les verts **faux** (mauvaise voie, mauvais rail, plus de 1 cm de ta pose), en séparant ceux de la deuxième passe : le journal de l’export les marque (`passe-differes-ecriture`).

Zones à surveiller : les ADV ; les cuts posés par la deuxième passe entre deux cuts eux-mêmes posés par Ariane ; les longues suites de cuts posés par la GCV2.

## 5. À la fin : les exports

**Orbite** : l'export du lot, comme d'habitude ; il contient le journal de la deuxième passe.

**Écho**, deux exports séparés comme en test 16 (premier Écho : les cuts restés rouges ; second Écho : toute la partie) : « Terminer et télécharger », tous les volumes et segments, leurs SHA-256, tes notes. Dis-moi lequel est le premier et lequel est le second.

Vide le cache seulement après ma confirmation de réception.

## 6. Si quelque chose ne va pas

1. « Arrêter la deuxième passe » (ou « Arrêter le lot »), puis décoche la case de la deuxième passe.
2. Note l'heure et le message.
3. Exporte et envoie les zips.

**Ne désinstalle pas Ariane.**

Retour arrière vers la test 16 :

1. Exporte.
2. **Désactive** la test 18 dans `chrome://extensions`, sans la supprimer.
3. Décompresse le zip de la **4.9.5 test 16** (`ariane-4.9.5-test.16.zip`) dans le même dossier.
4. **Réactive** la carte, puis clique sur **Recharger**.
5. F5 sur ESV.

Les poses déjà validées dans ESV restent, y compris celles de la deuxième passe : le retour arrière ne les défait pas.

## 7. Limites et ce qui n'est pas vérifié

LIMITES_LISTE

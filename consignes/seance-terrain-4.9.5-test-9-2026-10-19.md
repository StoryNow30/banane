# Séance terrain « 4.9.5 test 9 » : la raison de la correction dans Écho

**La pose ne change pas : Orbite pose les rails au même endroit qu'avant.** Le lot et le moteur ne sont pas modifiés. Ce qui change : dans Écho, tu peux dire **pourquoi** tu corriges un cut, en tapant un chiffre. C'est **facultatif**, **coupé par défaut**, et ça ne bloque jamais rien.

## Ce qui change pour toi

- Une carte **« Raison de la correction »** dans la vue Écho. Case décochée : Écho travaille exactement comme avant.
- Les touches, au clavier d'ESV : **1** rail voisin, **2** ADV, **3** PN, **4** nuage diffus ou pauvre, **5** hauteur seulement, **6** autre, **0** efface.
- Pas de raison par défaut. Un cut sans touche reste **inconnu** : il n'est ni « bon » ni « autre ».
- Ariane ne retient aucune touche et n'envoie rien à ESV. Elle lit ta frappe, comme elle lisait déjà tes autres touches.
- Petit correctif (D-211) : « Cuts d'Ariane mémorisés » compte aussi le dernier cut validé juste après la fin du lot et les corrections de la relecture « Corriger ». La pose ne change pas.

## 0. Étape 0 : vérifie qu'ESV ne réagit pas aux chiffres (2 minutes)

1. Dans ESV, ouvre un cut que tu ne valides pas. Tape **1, 2, 3, 4, 5, 6, 0** (rangée du haut), avec et sans **Maj**.
2. Regarde si quelque chose bouge : la caméra, un rail, la liste, le cut affiché.
3. **Rien ne bouge** : parfait, passe à la suite.
4. **ESV réagit** : dans la carte « Raison de la correction », choisis **« Alt + chiffre »**, puis refais l'essai en tenant **Alt**. Si ESV réagit encore, choisis **« Pavé numérique seul »**. Dis-moi la rangée qui marche.

Le mieux : fais cet essai pendant une séance Écho courte, case décochée. L'export gardera la trace de ce qui a bougé.

## 1. Installer et vérifier

1. Exporte d'abord ce que la test 8 garde.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.5-test.9.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message, sinon n'installe pas.
3. **Pose la 4.9.5 test 9 par-dessus la test 8** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Ne désinstalle rien. Dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
4. **Recharge l'onglet ESV (F5)**, puis choisis-le dans Ariane.
5. **Vérifie la version** : la carte dit « 4.9.5 test 9 », le panneau dit « ARIANE 4.9.5 test 9 » et le bouton blanc sur la page ESV dit « Ariane 4.9.5 test 9 · ouvrir ». La carte « Raison de la correction » est là, **case décochée**.

## 2. Taper une raison

1. **Avant de démarrer Écho**, coche **« Noter ma raison »**. Le choix est lu au démarrage et gardé jusqu'à la fin de la séance.
2. **Pour ce cut** : tape la touche une fois, avant de valider ou pendant que tu corriges.
3. **Après la validation** : une touche tapée jusqu'à une **demi-seconde** après **Maj+Espace** va au cut que tu viens de valider, pas au suivant.
4. **Rendre la raison collante** : tape la **même touche deux fois** de suite, vite (moins de **0,6 seconde**). Elle s'applique alors aux cuts suivants. Une autre touche tapée une fois vaut pour ce cut seul, puis la collante reprend.
5. **L'effacer** : tape **0**. Cela efface la raison du cut et finit la collante. Elle s'arrête aussi seule si tu changes de partie, si tu sautes de plus de 30 cuts ou si tu mets Écho en pause. Après 40 cuts collants, le panneau te le rappelle (rien ne s'arrête).
6. Le panneau montre la raison de ce cut, la collante, les 24 derniers cuts et le nombre de raisons posées ; le bandeau d'ESV, si tu l'actives, dit « raison : ADV (collante) ». Un clic sur une pastille vaut une touche.
7. **Vise** les corrections de plus de 10 mm (au moins 8 sur 10 étiquetées), sans te presser. Si tu te sens ralenti, **décoche la case** : à toi de juger.

## 3. Une séance d'Écho complète

Au moins **150 cuts**, avec une zone d'ADV si tu peux. Note **les touches tapées par erreur** et **si tu as été ralenti**.

## 4. À la fin : les exports

**Écho** : « Terminer et télécharger », **tous les volumes**, leur SHA-256 (`Get-FileHash` sur chaque zip), l'heure du F5 et tes notes. Vide le cache seulement après ma confirmation de réception.

## 5. Si quelque chose ne va pas

Arrête, note l'heure et le message, exporte et envoie les zips. **Ne désinstalle pas Ariane.**
Retour arrière : exporte, vérifie et envoie les zips, puis **désactive** la 4.9.5 test 9 (interrupteur dans `chrome://extensions`, sans la supprimer). Décompresse le zip de la 4.9.5 test 8 dans le même dossier, en remplaçant les fichiers, puis **réactive** la carte Ariane et clique sur **Recharger**, puis F5 sur ESV.

## 6. Ce qui ne change pas

- Orbite, la pose, le lot, la relecture après le lot, le moteur : comme à la test 8.
- Case décochée, ou aucune touche tapée : l'Écho est **le même, octet pour octet**, que celui de la test 8.
- Maj+Espace, `D` et toutes les autres touches passent à ESV comme avant.

## 7. Ce qui n'est pas vérifié

- **ESV et les chiffres** : personne n'a le code de ses touches. L'étape 0 le dit.
- **La demi-seconde après la validation** : choisie sans mesure. Ton premier essai dira le vrai délai de tes frappes.
- **Le coût d'une raison** : estimé à 0,6 s, pas mesuré. L'export le mesure.
- Si, après trois séances, aucune mesure ne se sert des raisons, la fonction est retirée. Edge n'a pas été vu.

# Séance terrain « test 5 » : installer, vider le cache, puis test A/A (12 octobre 2026)

**Rien ne change dans la façon dont Ariane pose ou valide.** Deux nouveautés par rapport à la test 3 : (1) « Vider le cache des exports » marche aussi après un lot
terminé sur son dernier cut reporté (le nuage de ce cut est gardé exprès et repart au prochain export) ; (2) la borne basse de l'écartement passe de 1405 à 1420 mm
(sur tes lots du 12 octobre, aucune décision ne change). **But de la séance : le test A/A**, c'est-à-dire mesurer le bruit de la mesure avec deux lots de la même version.

## Le paquet

`ariane-4.9.0-test.5.zip`, version 4.9.0.5, nom « 4.9.0 test 5 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne est dans le paquet : elle ne
peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que l'ancienne Ariane garde doit être **déjà exporté, vérifié et envoyé** : c'est le cas pour la séance du 12 octobre. Sinon, exporte d'abord et envoie-moi le zip.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.0-test.5.zip -Algorithm SHA256` (ou `certutil -hashfile ariane-4.9.0-test.5.zip SHA256`).
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la test 5 par-dessus l'ancienne** : décompresse le zip dans le même dossier que l'ancienne Ariane, en remplaçant les fichiers. Ne désinstalle rien. Puis, dans
   `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. (Pour retrouver le dossier : bouton Détails de la carte, ligne « Chargée depuis ».)
   Le cache est gardé. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane. Un seul onglet ESV.
5. **Vérifie la version** : la carte dans `chrome://extensions` dit « 4.9.0 test 5 », le panneau dit « ARIANE 4.9.0 test 5 » et le bouton blanc sur la page ESV dit
   « Ariane 4.9.0 test 5 · ouvrir ». Sinon, ne lance rien et dis-le-moi.
6. **Vide le cache** : « Vider le cache des exports » (dans « Exports du lot »), confirme avec OK. Envoie-moi le message affiché. Si le dernier lot s'est terminé sur un cut
   reporté, il doit dire « 1 nuage gardé : capture du dernier cut… » : c'est voulu. Tes exports du 12 octobre sont déjà reçus.

## 2. Le test A/A : deux lots

Le principe : la **même version, deux fois**, sans rien changer. L'écart entre les deux lots est le « bruit » du protocole (difficulté des coupes, heure, serveur ESV, poste).
Sans lui, on ne sait pas si une version plus rapide l'est vraiment.

- **Deux parties neuves**, jamais traitées (pas la partie du 12 octobre, pas les parties 7 à 10 du 7 octobre), de difficulté comparable : environ **150 à 200 coupes à valider ou plus**
  chacune, de préférence dans le même projet. S'il y en a moins, dis-le-moi avant.
- **Mêmes conditions pour les deux lots** : même poste, même Chrome, fenêtre ESV d'au moins **600 pixels de large** (plein écran de préférence), même zoom, extension Claude
  désactivée, pas d'autre application lourde, un seul onglet ESV, si possible le même moment de la journée.
- **Orbite seulement**, aucun réglage à changer. **Ne touche à rien pendant un lot** : pas de pause, pas de F5, pas de changement d'onglet, sauf si Ariane se bloque.
- **Note** pour chaque lot : heure de début et de fin, partie et projet (dis-les-moi dans la conversation), taille de fenêtre, zoom, et si tu as dû intervenir.

## 3. À la fin de chaque lot

1. Attends 5 secondes, puis « Tout télécharger pour l'analyse ».
2. Vérifie le zip dans Téléchargements (taille non nulle, aucun message « Export incomplet »).
3. Envoie-le-moi. S'il est trop gros, **découpe-le en morceaux de 20 Mo** avec le bloc PowerShell que je t'ai déjà donné, et envoie tous les morceaux.
4. Une fois que je t'ai confirmé la réception, « Vider le cache des exports » : chaque export ne contient alors que son lot.

## 4. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi le zip. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie le zip, puis **désactive**
la test 5 (interrupteur dans `chrome://extensions`, sans la supprimer) et pose la 4.9.0.4 (`ariane-4.9.0-test.4.zip`, SHA-256
`ddf94276db49c2a0f22890f9a025e7f6fff334887a6238ecd867d3c4089be8dd`), puis F5 sur ESV.

## 5. Ce qui n'est pas vérifié

Pas essayé sur un long lot du vrai ESV avec la 4.9.0.5 ; Edge non essayé ; le bouton « Recharger » du navigateur non essayé ; deux panneaux Ariane ouverts en même temps non vérifié
(garde un seul panneau).

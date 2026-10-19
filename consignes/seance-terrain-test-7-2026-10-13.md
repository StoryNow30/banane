# Séance terrain « test 7 » : mode rapide (V3, D-088), un lot long (13 octobre 2026)

**Rien ne change dans ce qu'Ariane décide, pose ou valide.** Sur **un cut sur deux**, tiré au sort une fois pour toutes d'après son
numéro, Ariane enlève ses attentes de prudence :
- elle lit le nuage sans attendre une image d'ESV (la nouveauté de la test 6) ;
- elle change de vue (rail gauche, rail droit) dès l'image suivante, au lieu d'attendre un quart de seconde ;
- elle lit dès qu'ESV n'a plus rien à charger, au lieu d'attendre toujours 0,8 seconde de plus ;
- elle pose les deux rails sans attendre que la vue se recentre sur chacun.

Sur l'autre moitié des cuts, elle fait tout comme la test 5. Les deux modes se mélangent dans le même lot : **un seul lot suffit**.
Au banc ESV local, sur les mêmes cuts lus dans les deux modes, les points lus sont **identiques** et les rails posés au même endroit
(écart sous 0,7 mm), pour environ 3 secondes gagnées par cut (2,4 s sur la lecture, 0,65 s sur la pose).

**Ce que tu vas voir de différent, et c'est normal** : sur les cuts rapides, la vue d'ESV ne suit pas toujours le rail qu'Ariane
pose. Tu peux voir un rail bouger alors que la vue montre l'autre rail, ou la vue rester sur le rail droit. La pose est relue
au millimètre après chaque clic, comme avant.

**Si tu n'as pas encore fait la séance test 6, fais directement celle-ci** : la test 7 contient la test 6.

## Le paquet

`ariane-4.9.0-test.7.zip`, version 4.9.0.7, nom « 4.9.0 test 7 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne
est dans le paquet : elle ne peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que l'ancienne Ariane garde doit être **déjà exporté, vérifié et envoyé**. Sinon, exporte d'abord et envoie-moi le zip.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.0-test.7.zip -Algorithm SHA256` (ou `certutil -hashfile ariane-4.9.0-test.7.zip SHA256`).
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la test 7 par-dessus l'ancienne** : décompresse le zip dans le même dossier que l'ancienne Ariane, en remplaçant les fichiers. Ne désinstalle rien. Puis, dans
   `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. Le cache est gardé. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane. Un seul onglet ESV.
5. **Vérifie la version** : la carte dans `chrome://extensions` dit « 4.9.0 test 7 », le panneau dit « ARIANE 4.9.0 test 7 » et le bouton blanc sur la page ESV dit
   « Ariane 4.9.0 test 7 · ouvrir ». Dans les réglages du panneau, la ligne « Mode rapide (V3) » dit « un cut sur deux, tiré au sort ». Sinon, ne lance rien et dis-le-moi.
6. **Vide le cache** : « Vider le cache des exports », confirme avec OK, et envoie-moi le message affiché.

## 2. Le lot

- **Une partie neuve**, jamais traitée, avec **au moins 300 coupes** si possible (deux lots sur deux parties neuves si une seule partie n'en a pas assez ; dis-le-moi avant).
- **Mêmes conditions que d'habitude** : fenêtre ESV d'au moins **600 pixels de large** (plein écran de préférence), extension Claude désactivée, pas d'autre application lourde,
  un seul onglet ESV, **onglet ESV au premier plan** (Ariane attend les images d'ESV ; un onglet caché la ralentit).
- **Orbite seulement**, aucun réglage à changer. **Ne touche à rien pendant le lot**, sauf si Ariane se bloque.
- **Regarde ESV de temps en temps** : si l'image saccade ou se fige plus qu'avant, note l'heure.
- **Arrête tout de suite** si Ariane affiche « Le clic a déplacé le rail … au lieu du rail … » : note l'heure, puis va à la partie 4.
- **Note** : heure de début et de fin, partie et projet (dis-les-moi dans la conversation), et chaque intervention ou message « Lecture LiDAR instable ».

## 3. À la fin du lot

1. Attends 5 secondes, puis « Tout télécharger pour l'analyse ».
2. Vérifie le zip dans Téléchargements (taille non nulle, aucun message « Export incomplet »).
3. Envoie-le-moi. S'il est trop gros, **découpe-le en morceaux de 20 Mo**, et envoie tous les morceaux.
4. Une fois que je t'ai confirmé la réception, « Vider le cache des exports ».

Je mesure alors, dans ce seul lot, les deux moitiés l'une contre l'autre (`node tools/perf-v3.cjs`) : temps par cut, part posée, poses,
lectures au signal, points lus.

## 4. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi le zip. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie le zip, puis
**désactive** la test 7 (interrupteur dans `chrome://extensions`, sans la supprimer) et pose la 4.9.0.5 (`ariane-4.9.0-test.5.zip`, SHA-256
`77dfb592323f02f8c9dcd2897c344750b488db1c43c41a39721059627630d3fc`), puis F5 sur ESV.

## 5. Ce qui n'est pas vérifié

Mesuré au banc ESV local seulement (Chromium 141 sans carte graphique, environ 20 images par seconde, réseau simulé) : jamais sur le vrai ESV.
Non vérifiés : une carte graphique réelle (plus d'images par seconde : le mode rapide devrait y gagner encore), Edge, Chrome et Edge avant la
version 129 (lecture avec un repli), un vrai réseau lent ou en panne (repli prévu : l'attente de 0,8 seconde de la test 5).

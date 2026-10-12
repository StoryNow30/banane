# Séance terrain « test 6 » : lecture rapide (V3, I1), un lot long (13 octobre 2026)

**Rien ne change dans ce qu'Ariane pose ou valide.** Une seule nouveauté : sur **un cut sur deux**, tiré au sort une fois pour toutes d'après son numéro, Ariane lit le
nuage **sans attendre une image d'ESV** (« lecture rapide ») ; sur l'autre moitié, elle lit comme la test 5. Les points lus sont les mêmes ; seule la vitesse change.
Les deux modes se mélangent dans le même lot : **un seul lot suffit**, plus besoin de lots A/A séparés (le bruit a été mesuré sur tes exports du 7 et du 12 octobre).
La test 6 contient aussi tout ce que la test 5 apportait (vidage après un dernier cut reporté, borne d'écartement à 1420 mm).

## Le paquet

`ariane-4.9.0-test.6.zip`, version 4.9.0.6, nom « 4.9.0 test 6 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne est dans le paquet : elle ne
peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que l'ancienne Ariane garde doit être **déjà exporté, vérifié et envoyé**. Sinon, exporte d'abord et envoie-moi le zip.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.0-test.6.zip -Algorithm SHA256` (ou `certutil -hashfile ariane-4.9.0-test.6.zip SHA256`).
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la test 6 par-dessus l'ancienne** : décompresse le zip dans le même dossier que l'ancienne Ariane, en remplaçant les fichiers. Ne désinstalle rien. Puis, dans
   `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. Le cache est gardé. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane. Un seul onglet ESV.
5. **Vérifie la version** : la carte dans `chrome://extensions` dit « 4.9.0 test 6 », le panneau dit « ARIANE 4.9.0 test 6 » et le bouton blanc sur la page ESV dit
   « Ariane 4.9.0 test 6 · ouvrir ». Dans les réglages du panneau, la ligne « Lecture rapide (V3, I1) » dit « un cut sur deux, tiré au sort ». Sinon, ne lance rien et dis-le-moi.
6. **Vide le cache** : « Vider le cache des exports », confirme avec OK, et envoie-moi le message affiché.

## 2. Le lot

- **Une partie neuve**, jamais traitée, avec **au moins 300 coupes** si possible (deux lots sur deux parties neuves si une seule partie n'en a pas assez ; dis-le-moi avant).
- **Mêmes conditions que d'habitude** : fenêtre ESV d'au moins **600 pixels de large** (plein écran de préférence), extension Claude désactivée, pas d'autre application lourde,
  un seul onglet ESV.
- **Orbite seulement**, aucun réglage à changer. **Ne touche à rien pendant le lot**, sauf si Ariane se bloque.
- **Regarde ESV de temps en temps** : si l'image saccade ou se fige pendant les lectures plus qu'avant, note l'heure. C'est le seul risque connu de la lecture rapide.
- **Note** : heure de début et de fin, partie et projet (dis-les-moi dans la conversation), et chaque intervention ou message « Lecture LiDAR instable ».

## 3. À la fin du lot

1. Attends 5 secondes, puis « Tout télécharger pour l'analyse ».
2. Vérifie le zip dans Téléchargements (taille non nulle, aucun message « Export incomplet »).
3. Envoie-le-moi. S'il est trop gros, **découpe-le en morceaux de 20 Mo**, et envoie tous les morceaux.
4. Une fois que je t'ai confirmé la réception, « Vider le cache des exports ».

Je mesure alors, dans ce seul lot, les deux moitiés l'une contre l'autre (`node tools/perf-v3.cjs`) : temps par cut, part posée, lectures, points lus.

## 4. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi le zip. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie le zip, puis
**désactive** la test 6 (interrupteur dans `chrome://extensions`, sans la supprimer) et pose la 4.9.0.5 (`ariane-4.9.0-test.5.zip`, SHA-256
`77dfb592323f02f8c9dcd2897c344750b488db1c43c41a39721059627630d3fc`), puis F5 sur ESV.

## 5. Ce qui n'est pas vérifié

La lecture rapide n'a été mesurée qu'au laboratoire (Chromium 141 : 0,9 s → 0,3 s par lecture, mêmes points) et au banc ; jamais sur le vrai ESV. Chrome et Edge avant la
version 129 lisent avec un repli (canal de messages), non mesuré. Edge non essayé.

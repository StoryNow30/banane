# Séance terrain « 4.9.5 test 1 » : suivre le signal de fin de chargement (15 octobre 2026)

La 4.9.5 test 1 est la 4.9.0 stable avec deux ajouts. **Rien ne change dans ce qu'Ariane décide, lit, pose ou valide.** Le moteur n'est pas modifié.

- **Un petit relevé à chaque lecture** : Ariane note pourquoi elle a lu « au signal » ou attendu 800 ms (chargements en cours dans ESV, images, vue),
  l'âge de la page ESV et quelques compteurs. C'est pour comprendre pourquoi Ariane ralentit au bout d'environ 10 minutes sur la même page ESV,
  et pourquoi un F5 la fait repartir vite. Tu ne vois rien de plus à l'écran.
- **Si ESV refuse d'enregistrer une validation** (erreur du serveur), Ariane se met en pause et le dit :
  « ESV a refusé d'enregistrer la validation du cut N (erreur serveur). Vérifie ce cut dans ESV, puis Reprendre. »
  Avant, elle continuait sans rien dire. On ne peut pas provoquer ce cas exprès : s'il arrive, suis l'avis.

## Le paquet

`ariane-4.9.5-test.1.zip`, version 4.9.5.1, nom « 4.9.5 test 1 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne
est dans le paquet : elle ne peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que la 4.9.0 garde doit être **déjà exporté**.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.5-test.1.zip -Algorithm SHA256`.
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la 4.9.5 test 1 par-dessus la 4.9.0** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Ne désinstalle rien.
   Puis, dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane. **Note l'heure de ce F5.**
5. **Vérifie la version** : la carte dit « 4.9.5 test 1 », le panneau dit « ARIANE 4.9.5 test 1 » et le bouton blanc sur la page ESV dit « Ariane 4.9.5 test 1 · ouvrir ».
   Sinon, ne lance rien et dis-le-moi.

## 2. La séance

Mêmes conditions que d'habitude : fenêtre ESV d'au moins 600 pixels, extension Claude désactivée, Orbite seulement.

1. **Une séance Orbite normale d'au moins 30 minutes, SANS F5 volontaire.** Lance un lot comme d'habitude (toute la partie, ou une grande plage)
   et laisse-le tourner. Le but est de voir le moment où Ariane ralentit (vers 10 minutes) : **n'appuie pas sur F5 pour la relancer**, même si elle
   te paraît lente. Une pause de sécurité (« Lecture LiDAR instable ») peut arriver : clique sur **Reprendre**, sans F5, sauf si l'avis le demande.
2. **Puis un F5** : mets le lot en **Pause**, recharge l'onglet ESV (**F5**), attends que le cut s'affiche, puis **Reprendre**. **Note l'heure de ce F5.**
3. **Encore 10 minutes** de lot après ce F5.
4. Note en une phrase : est-ce qu'Ariane t'a paru ralentir pendant la première demi-heure ? Est-ce qu'elle est repartie plus vite après le F5 ?
   Et si l'avis « ESV a refusé d'enregistrer la validation… » est apparu : le cut, l'heure, et ce que tu as vu dans ESV pour ce cut.

Si tu dois t'arrêter avant les 30 minutes, ce n'est pas grave : exporte quand même, et dis-moi la durée.

## 3. À la fin : l'export

Attends 5 secondes, puis « Tout télécharger pour l'analyse ». L'export **sort tout seul en volumes** (`…-volume01-sur03.zip`, etc. ; un seul zip s'il tient en un).
Envoie **tous les volumes**, tels quels, avec leur ligne SHA-256 (PowerShell : `Get-FileHash .\ariane-lot-*.zip -Algorithm SHA256`),
avec les deux heures de F5 notées, puis vide le cache seulement après ma confirmation de réception.

## 4. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi les zips. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie les zips, puis
**désactive** la 4.9.5 test 1 (interrupteur dans `chrome://extensions`, sans la supprimer) et pose la 4.9.0 stable (`ariane-v4.9.0.zip`, SHA-256
`341a0d0bf4957face8fa072d772ee5e2b72c3af2648c71c6e20fd7a5db75b3ac`), puis F5 sur ESV. La 4.9.0 a le même moteur et la même lecture : seuls le relevé et la pause
sur écriture refusée disparaissent.

## 5. Ce qui n'est pas vérifié

Tout a été essayé hors ligne (ESV simulé). Rien n'a été utilisé en séance réelle. La pause sur écriture refusée suppose que l'observateur d'ESV voit
l'écriture (navigateur 111 ou plus, page ESV rechargée après l'installation) ; elle rapproche l'écriture du cut que le lot vient de valider par l'heure,
faute d'autre repère dans ESV pour une écriture refusée. Edge n'a pas été vu.

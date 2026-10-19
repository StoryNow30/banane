# Séance terrain « 4.9.5 test 2 » : Écho corrigé, et le signal d'Orbite suivi (15 octobre 2026)

La 4.9.5 test 2 réunit en un seul paquet les deux dernières versions de test. **Rien ne change dans ce qu'Orbite décide, lit, pose ou valide.** Le moteur n'est pas modifié.

- **Les corrections d'Écho de la test 20** : Écho reconnaît toutes tes façons de valider (Maj+Espace, Ctrl+Entrée, Entrée, le bouton d'ESV) ;
  une validation lue 6 ms après ta touche n'est plus écartée ; si tu valides deux fois le même cut, la dernière pose compte ; la pose de départ est celle
  d'avant ton premier geste ; après un F5 sur ESV, Écho le dit (bandeau rouge dans ESV) et reprend tout seul ; l'export d'Écho sort en volumes zip de 17 Mo au plus,
  avec un `CONTENU.txt` ; l'export d'Orbite ne porte plus les données d'Écho.
- **Un petit relevé à chaque lecture d'Orbite** : Ariane note pourquoi elle a lu « au signal » ou attendu 800 ms, l'âge de la page ESV et quelques compteurs.
  C'est pour comprendre pourquoi Ariane ralentit au bout d'environ 10 minutes sur la même page ESV, et pourquoi un F5 la fait repartir vite.
  Tu ne vois rien de plus à l'écran.
- **Si ESV refuse d'enregistrer une validation** (erreur du serveur), Orbite se met en pause et le dit :
  « ESV a refusé d'enregistrer la validation du cut N (erreur serveur). Vérifie ce cut dans ESV, puis Reprendre. »
  Avant, elle continuait sans rien dire. On ne peut pas provoquer ce cas exprès : s'il arrive, suis l'avis.

## Le paquet

`ariane-4.9.5-test.2.zip`, version 4.9.5.2, nom « 4.9.5 test 2 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne
est dans le paquet : elle ne peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que l'ancienne Ariane garde doit être **déjà exporté** (lot Orbite et session Écho).
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.5-test.2.zip -Algorithm SHA256`.
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la 4.9.5 test 2 par-dessus l'ancienne** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Ne désinstalle rien.
   Puis, dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane. **Note l'heure de ce F5.**
5. **Vérifie la version** : la carte dit « 4.9.5 test 2 », le panneau dit « ARIANE 4.9.5 test 2 » et le bouton blanc sur la page ESV dit « Ariane 4.9.5 test 2 · ouvrir ».
   Sinon, ne lance rien et dis-le-moi.

Mêmes conditions que d'habitude pour toute la séance : fenêtre ESV d'au moins 600 pixels, extension Claude désactivée, un seul onglet ESV ouvert.

## 2. Ce que tu essaies en Écho (une partie déjà traitée par Orbite, une quarantaine de cuts)

Pour chaque point, note en une phrase si c'est **bien**, **pas bien** (et quoi), ou **pas vu**.

1. **Démarre Écho** sur un cut affiché. Le compteur « visites de cuts » monte à chaque changement de cut.
2. **Valide de plusieurs façons**, chacune sur un cut différent : Maj+Espace, **Ctrl+Entrée**, **Entrée** et le bouton d'ESV. Puis, sur deux autres cuts, passe au suivant et au précédent sans valider avec **Ctrl+flèche** : Écho doit les compter comme « passage sans décision », pas comme des validations. Note quel cut avec quelle touche.
   Note quel cut avec quelle touche.
3. **Corrige un cut** (bouge un rail, valide), puis sur un autre cut **valide, bouge encore, revalide**.
4. **F5 sur ESV en plein Écho** : un bandeau rouge « CAPTURE ARRÊTÉE » apparaît en bas d'ESV, puis disparaît quand la page est rechargée ;
   le panneau dit « reprise après le rechargement ». Si le bandeau reste, clique sur **Connecter** puis **Reprendre** et note-le.
5. **Pause de dix minutes** avec l'onglet ESV en arrière-plan (autre fenêtre devant), puis reviens et continue : Écho doit toujours être
   « Collecte en cours », sans « interrompue ».
6. **Le dernier cut de la partie**, validé en place (Ctrl+Entrée), sans passer au suivant.
7. **Terminer et télécharger** : l'export sort en volumes zip (`ariane-echo-partieN-…-volume01-sur03.zip`, etc. ; un seul zip s'il tient en un).
   Ouvre un `CONTENU.txt` : « mode Écho », l'heure de Paris, la partie, le nombre de visites.
8. **Démarrer une nouvelle session** sans avoir téléchargé : Ariane refuse et le dit. (Si tu as téléchargé, elle accepte.)

## 3. Ce que tu essaies en Orbite (suivre le signal, D3)

1. **Une séance Orbite normale d'au moins 30 minutes, SANS F5 volontaire.** Lance un lot comme d'habitude (toute la partie, ou une grande plage)
   et laisse-le tourner. Le but est de voir le moment où Ariane ralentit (vers 10 minutes) : **n'appuie pas sur F5 pour la relancer**, même si elle
   te paraît lente. Une pause de sécurité (« Lecture LiDAR instable ») peut arriver : clique sur **Reprendre**, sans F5, sauf si l'avis le demande.
2. **Puis un F5** : mets le lot en **Pause**, recharge l'onglet ESV (**F5**), attends que le cut s'affiche, puis **Reprendre**. **Note l'heure de ce F5.**
3. **Encore 10 minutes** de lot après ce F5.
4. Note en une phrase : est-ce qu'Ariane t'a paru ralentir pendant la première demi-heure ? Est-ce qu'elle est repartie plus vite après le F5 ?
   Et si l'avis « ESV a refusé d'enregistrer la validation… » est apparu (D3) : le cut, l'heure, et ce que tu as vu dans ESV pour ce cut.

Si tu dois t'arrêter avant les 30 minutes, ce n'est pas grave : exporte quand même, et dis-moi la durée.

## 4. À la fin : les exports

- **Écho** : envoie **tous les volumes** de l'export Écho, tels quels, avec leur ligne SHA-256 (PowerShell : `Get-FileHash .\ariane-echo-*.zip -Algorithm SHA256`),
  et dis-moi quel cut tu as validé avec quelle touche (point 2 d'Écho), et lesquels tu as corrigés (point 3 d'Écho).
- **Orbite** : attends 5 secondes, puis « Tout télécharger pour l'analyse ». L'export **sort tout seul en volumes** (`…-volume01-sur03.zip`, etc.).
  Envoie **tous les volumes**, tels quels, avec leur ligne SHA-256 (`Get-FileHash .\ariane-lot-*.zip -Algorithm SHA256`) et les heures de F5 notées.
  Vide le cache seulement après ma confirmation de réception.

## 5. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi les zips. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie les zips, puis
**désactive** la 4.9.5 test 2 (interrupteur dans `chrome://extensions`, sans la supprimer) et pose la 4.9.5 test 1 ou la 4.9.0 stable (`ariane-v4.9.0.zip`), puis F5 sur ESV.
Le moteur est le même dans toutes ces versions.

## 6. Ce qui n'est pas vérifié

Tout a été essayé hors ligne (ESV simulé). Rien n'a été utilisé en séance réelle. La pause sur écriture refusée suppose que l'observateur d'ESV voit
l'écriture (navigateur 111 ou plus, page ESV rechargée après l'installation) ; elle rapproche l'écriture du cut que le lot vient de valider par l'heure,
faute d'autre repère dans ESV pour une écriture refusée. Edge n'a pas été vu.

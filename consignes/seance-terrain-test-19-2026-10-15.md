# Séance terrain « test 19 » : Écho corrigé (15 octobre 2026)

La test 19 est la test 18 avec un seul correctif : les écritures d'ESV sont rattachées au bon cut (par numéro de ligne), et seule une vraie validation confirme un cut (ton export de la partie 24 l'a montré). Le reste est la test 18 : les corrections de l'audit d'Écho. **Rien ne change dans ce qu'Orbite décide, pose ou valide.** Le moteur n'est pas modifié.

Ce qui change, en Écho seulement :
- Écho reconnaît **toutes** tes façons de valider : Maj+Espace, **Ctrl+Entrée**, **Entrée**, le bouton d'ESV ;
- si tu valides deux fois le même cut, c'est **la dernière pose** qui compte ;
- la pose de départ est celle d'**avant ton premier geste** (un recalage d'ESV au chargement n'est plus une correction) ;
- après un **F5** sur ESV, Écho le dit (bandeau rouge dans ESV) et **reprend tout seul** ; onglet fermé : Connecter puis Reprendre ;
- l'export d'Écho sort **en volumes zip de 17 Mo au plus**, comme Orbite, avec un `CONTENU.txt` ;
- l'export d'Orbite ne porte plus les données d'Écho (il redevient léger après des relectures).

## Le paquet

`ariane-4.9.0-test.19.zip`, version 4.9.0.19, nom « 4.9.0 test 19 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne
est dans le paquet : elle ne peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que l'ancienne Ariane garde doit être **déjà exporté** (lot Orbite et session Écho).
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.0-test.19.zip -Algorithm SHA256`.
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la test 19 par-dessus l'ancienne** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Ne désinstalle rien.
   Puis, dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane.
5. **Vérifie la version** : la carte dit « 4.9.0 test 19 », le panneau dit « ARIANE 4.9.0 test 19 » et le bouton blanc sur la page ESV dit « Ariane 4.9.0 test 19 · ouvrir ».
   Sinon, ne lance rien et dis-le-moi.

## 2. Ce que tu essaies en Écho (une partie déjà traitée par Orbite, une quarantaine de cuts)

Pour chaque point, note en une phrase si c'est **bien**, **pas bien** (et quoi), ou **pas vu**. Un seul onglet ESV ouvert.

1. **Démarre Écho** sur un cut affiché. Le compteur « visites de cuts » monte à chaque changement de cut.
2. **Valide de trois façons** sur trois cuts différents : Maj+Espace, Ctrl+Entrée, et le bouton d'ESV. Note quel cut avec quelle touche.
3. **Corrige un cut** (bouge un rail, valide), puis sur un autre cut **valide, bouge encore, revalide**.
4. **F5 sur ESV en plein Écho** : un bandeau rouge « CAPTURE ARRÊTÉE » apparaît en bas d'ESV, puis disparaît quand la page est rechargée ;
   le panneau dit « reprise après le rechargement ». Si le bandeau reste, clique sur **Connecter** puis **Reprendre** et note-le.
5. **Pause de dix minutes** avec l'onglet ESV en arrière-plan (autre fenêtre devant), puis reviens et continue : Écho doit toujours être
   « Collecte en cours », sans « interrompue ».
6. **Le dernier cut de la partie**, validé en place (Ctrl+Entrée), sans passer au suivant.
7. **Terminer et télécharger** : l'export sort en volumes zip (`ariane-echo-partieN-…-volume01-sur03.zip`, etc. ; un seul zip s'il tient en un).
   Ouvre un `CONTENU.txt` : « mode Écho », l'heure de Paris, la partie, le nombre de visites.
8. **Démarrer une nouvelle session** sans avoir téléchargé : Ariane refuse et le dit. (Si tu as téléchargé, elle accepte.)

## 3. À la fin : l'export

Envoie **tous les volumes** de l'export Écho, tels quels, avec leur ligne SHA-256 (PowerShell : `Get-FileHash .\ariane-echo-*.zip -Algorithm SHA256`),
et dis-moi quel cut tu as validé avec quelle touche (point 2), et lesquels tu as corrigés (point 3). Garde l'export Orbite de la même partie.

## 4. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi les zips. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie les zips, puis
pose la test 18 par-dessus et recharge l'extension.

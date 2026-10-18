# Séance terrain « 4.9.5 test 7 » : le panneau rangé et la relecture après le lot (18 octobre 2026)

**La pose ne change pas : Orbite pose les rails au même endroit qu'avant.** Le moteur n'est pas modifié. Ce qui change : le panneau, le départ d'un lot sur un cut vert, et une **relecture après le lot**, coupée tant que tu ne la choisis pas.

## Ce qui change pour toi

- **Le panneau est rangé en groupes** : « Lot », « Règles et choix du prochain lot », « Résultats du dernier lot », « Relecture », puis « Export, archive et réglages avancés » (replié). Sous chaque choix, « Dernier lot » et « Prochain lot » disent ce qui a servi et servira.
- **Un lot qui part d'un cut déjà vert n'écrit rien sur ce cut** : Ariane passe au prochain cut non validé, comme toi (Maj+Z), puis travaille comme avant. Si les rouges restants sont tous derrière, le panneau les nomme. Une partie complète ne reçoit plus d'écriture inutile.
- **La règle de la grappe a un nouveau libellé** : « Mettre en attente les cuts voisins d’une série de différés ». Elle est toujours coupée par défaut.
- **Relecture après le lot** : la carte « Relecture après le lot » propose « Coupée » (par défaut), « Ombre » et « Corriger ». Après les rouges, Ariane visite les verts que tu relirais (PN, ADV, abords). Elle part seule juste après le lot, sans compte à rebours ; « Arrêter la relecture » l'arrête.
  - « Ombre » : elle visite, calcule et note, sans rien écrire. ESV marque « vu » chaque cut neuf qu'elle affiche, comme quand c'est toi.
  - « Corriger » : elle corrige seulement les verts sûrs du PN, de l'ADV et des abords, avec la pose du lot et **Maj+Espace**, ton geste. Jamais un cut posé ou différé par le lot, jamais un SKIP.
- **Avis de contrat et audits de fin de lot corrigés.**
- **Toujours coupés** : la mémoire des différés de l'Écho et **déplacer la vue**.

## Le paquet

`ariane-4.9.5-test.7.zip`, version 4.9.5.7. L'empreinte SHA-256 et la taille sont dans mon message.

## 1. Installer et vérifier

1. Exporte d'abord ce que la test 6 garde.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.5-test.7.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message, sinon n'installe pas.
3. **Pose la 4.9.5 test 7 par-dessus la test 6** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Ne désinstalle rien. Puis, dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
4. **Recharge l'onglet ESV (F5)**, puis choisis-le dans Ariane.
5. **Vérifie la version** : la carte dit « 4.9.5 test 7 », le panneau dit « ARIANE 4.9.5 test 7 » et le bouton blanc sur la page ESV dit « Ariane 4.9.5 test 7 · ouvrir ». Dans Orbite, « Comme avant » est coché et la case de la règle est vide ; dans la relecture, « Coupée » est cochée. Sinon, ne lance rien et dis-le-moi.

## 2. Un lot en « Ombre »

1. **Une partie neuve** : pas les parties 12, 13, 17, 24 et 29 du premier projet, ni la partie 1 du second.
2. Coche **« Ombre »** **avant** de démarrer le lot, puis lance-le.
3. Quand le lot finit, la relecture part seule. **Ne touche à rien dans ESV pendant qu'elle travaille.** Note l'heure de début et l'heure de fin de la relecture.
4. Fais ensuite **une Écho complète** de la partie, comme d'habitude.

## 3. Un lot en « Corriger »

1. **Une autre partie neuve**, de préférence avec des PN et des ADV : note leurs plages.
2. Coche **« Corriger »** **avant** de démarrer le lot. Même déroulé : ne touche à rien pendant la relecture, note les heures.
3. Puis **une Écho complète**, et **note les cuts qu'Ariane a corrigés et que tu as dû reprendre**.
4. Si la relecture s'arrête et nomme un cut, ou demande « J’ai contrôlé le cut » : lis le message, contrôle ce cut dans ESV, clique, et note-le.

## 4. À la fin : les exports

- **Orbite** : « Tout télécharger pour l'analyse », après chaque lot. Le choix de la relecture y est noté. Envoie **tous les volumes**, avec leur SHA-256 (`Get-FileHash .\ariane-lot-*.zip -Algorithm SHA256`) et tes heures.
- **Écho** : « Terminer et télécharger », **tous les volumes**, leur SHA-256, l'heure du F5 et tes notes.
- Vide le cache seulement après ma confirmation de réception.

## 5. Si quelque chose ne va pas

Arrête, note l'heure et le message, exporte et envoie les zips. **Ne désinstalle pas Ariane.**
Retour arrière : exporte, vérifie et envoie les zips, puis **désactive** la 4.9.5 test 7 (interrupteur dans `chrome://extensions`, sans la supprimer). Décompresse le zip de la 4.9.5 test 6 dans le même dossier, en remplaçant les fichiers, puis **réactive** la carte Ariane et clique sur **Recharger**, puis F5 sur ESV.

## 6. Ce qui n'est pas vérifié

- **Maj+Espace envoyé par Ariane n'a jamais été essayé dans le vrai ESV.** Tu m'as dit qu'il valide sur place. Si ESV change de cut, la relecture s'arrête et nomme le cut.
- Le seuil de 9 % n'est pas démontré pour l'ADV et les abords (14 à 18 % d'erreurs dans l'étude) : tu as accepté ces chiffres.
- Durée : 3 à 9 minutes par partie au banc, jamais mesurée dans le vrai ESV ; Ariane lit le nuage plus souvent que toi (de ×2 à ×9 estimé).
- La relecture a lieu après le lot, pas au fil du lot : c'est la suite.
- Vu au banc et dans Chromium, pas sur un vrai lot. Edge n'a pas été vu.

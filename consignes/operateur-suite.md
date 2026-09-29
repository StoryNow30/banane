# Ta fiche pas à pas — clôture de la 4.8.0, puis 4.8.5 et 4.9

Dans l'ordre. Chaque étape dit ce qu'il faut faire, combien de temps, et ce que
tu m'envoies. Rien d'autre n'est attendu de toi entre deux étapes.

## Étape 1 — Étiquettes de version sur GitHub (10 min, n'importe quel ordinateur)

Trois étiquettes, trois fois la même manipulation. J'ai préparé pour chacune
une branche `release/…` qui pointe sur le bon commit : tu n'as qu'à la choisir.

| Étiquette | Cible (onglet « Branches ») | Titre | Pièce jointe | « Latest » |
|---|---|---|---|---|
| `v4.8.0` | `release/v4.8.0` | Ariane 4.8.0 — stable | `ariane-v4.8.0.zip` | **coché** |
| `v4.7.21` | `release/v4.7.21` | Banane 4.7.21 — retour arrière | aucune | décoché |
| `v4.7.0` | `release/v4.7.0` | Banane 4.7.0 | aucune | décoché |

Pour chacune, dans cet ordre (v4.7.0, v4.7.21, puis v4.8.0 en dernier) :

1. Ouvre `https://github.com/StoryNow30/banane/releases/new`.
2. **Choose a tag** : tape l'étiquette (par exemple `v4.7.0`), puis clique
   **Create new tag: … on publish**.
3. **Target** : onglet **Branches**, choisis la branche `release/…` du tableau.
4. **Release title** : le titre du tableau.
5. **Description** : colle la ligne correspondante :
   - v4.8.0 : `Version stable. Paquet ariane-v4.8.0.zip, SHA-256 38aa29a28bc0695258dd444adb2844752a340ef3c6de30c22939ef6b8575e25b. Décisions D-058 à D-061.`
   - v4.7.21 : `Cible de retour arrière (RETOUR_ARRIERE.md).`
   - v4.7.0 : `Pilot Continuous.`
6. Pour v4.8.0 seulement, glisse le zip dans **Attach binaries**. C'est celui que
   tu as installé ; sinon, sur GitHub : `StoryNow30/banane-data` →
   `travail/2026-09-28_ariane-480-final/ariane-v4.8.0.zip` → **Download raw file**.
7. **Set as the latest release** : coché pour v4.8.0 seulement.
8. **Publish release**.

Dis-moi « étiquettes faites » : je vérifie les trois, puis je retire les
branches `release/…`.

## Étape 2 — Relecture des 37 cuts restants de la partie 11 (5 min)

Avec **Ariane 4.8.0** (ta version stable), comme d'habitude :

1. Ouvre la **partie 11** dans ESV.
2. Ariane → **Écho** → **Démarrer l'observation**.
3. Parcours ces cuts : **578–591, 605, 614, 615, 617, 618, 642, 643, 645–648,
   651–662, 689**. Pour chacun :
   - regarde les deux rails au moins une demi-seconde ;
   - s'ils sont bons : passe au suivant **sans valider** (Z) ; c'est compté comme
     accepté (D-040) ;
   - si un rail est faux : corrige-le, puis **valide** (Maj+Espace) ; sans
     validation, la correction ne compte pas.
   Les cuts croisés entre deux plages : passe simplement.
4. Écho → **Terminer et télécharger**.

## Étape 3 — Relecture du lot de la partie 15 (20 à 25 min)

Il faut revoir au moins **154** des 192 cuts posés par Orbite. Les 12 plages
ci-dessous en contiennent 156 : fais-les toutes, dans n'importe quel ordre.

| Plage | Cuts posés |
|---|---|
| 5708–5778 | 34 |
| 106–138 | 19 |
| 279–307 | 18 |
| 343–358 | 16 |
| 900–918 | 14 |
| 1005–1014 | 10 |
| 6234–6245 | 10 |
| 7819–7828 | 9 |
| 6287–6303 | 8 |
| 6727–6734 | 7 |
| 6757–6766 | 6 |
| 235–240 | 5 |

1. **Partie 15** dans ESV, Ariane 4.8.0 → **Écho** → **Démarrer l'observation**.
2. Va au premier cut d'une plage (comme tu le fais d'habitude), puis parcours la
   plage cut par cut, avec la même règle qu'à l'étape 2 : bon → suivant sans
   valider ; faux → corrigé puis validé.
3. Les cuts différés que tu croises dans une plage (Orbite n'y a rien posé) :
   laisse-les, ils ne comptent pas.
4. À la fin : Écho → **Terminer et télécharger**.

## Étape 4 — Envoi (5 min)

1. Mets les fichiers des étapes 2 et 3 dans une archive (7z ou zip, comme
   d'habitude).
2. Dépose-la ici, avec une ligne : le temps passé, et ce qui t'a surpris.

Je calcule le taux de faux de la 4.8.0 finale et je complète le rapport de sortie.

## Étape 5 — Le prompt d'Astra (2 min, après l'étape 1)

Copie le bloc de `consignes/chantier-9-auditeur.md` et envoie-le à Astra. Son
rapport arrivera sur sa propre branche ; je l'intègre avant d'écrire le cahier
4.9.

## Étape 6 — La 4.8.5 de test, à côté de la 4.8.0 (quand je te la livre, ≈ 1 h 15)

Je te dirai où télécharger `ariane-4.8.5-test.2.zip` (le test 2, D-062 ; il
remplace le test 1 pour ce lot). Ensuite :

**Installer à côté (une seule fois, 5 min)**
1. Décompresse le zip dans un **nouveau dossier**, par exemple
   `Documents\Ariane\4.8.5-test2`. Ne touche pas au dossier de la 4.8.0 : ne
   remplace rien dedans.
2. `edge://extensions` → **Mode développeur** activé → **Charger l'extension
   décompressée** → choisis le nouveau dossier.
3. Tu vois deux extensions : **Ariane** (4.8.0) et **Ariane 4.8.5 TEST**.
   Chacune a sa propre mémoire : la 4.8.0 ne voit rien des essais.

**Passer de l'une à l'autre (à chaque fois)**
1. `edge://extensions` : désactive l'une (interrupteur), active l'autre.
2. **F5** sur ESV.
3. Vérifie le nom sur le bouton blanc au bas d'ESV. Si les deux sont actives,
   la version de test refuse de se connecter et te le dit.
   Si le panneau dit « Ariane 4.8.5 test 2 **en sécurité** » : l'autre Ariane
   a tenté de commander l'onglet. Désactive-la, F5, puis **Reprendre**.
   Si c'était pendant une pose (« Validation refusée : la pose de ce cut est
   faite, non validée ») : **contrôle d'abord la pose dans ESV, avant tout
   F5** (valide-la toi-même si elle est juste), puis désactive l'autre, F5,
   **Archiver le résultat interrompu**.

**Le lot de validation (≈ 45 min, surveillance légère)**
1. Choisis une **partie jamais passée par Ariane** : ni 2, 3, 6, 9, 11, 12, 13,
   14, 15, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 33, 34, 35 (registre :
   `audit/rotation-parties.md`), avec **au moins ~200 cuts non validés**. De préférence une partie dont
   la plupart des cuts ne sont pas validés, avec des courbes et si possible un
   passage à niveau.
2. Fenêtre d'ESV d'au moins 600 pixels de large.
3. Orbite : premier cut = celui affiché ; dernier cut = vide (jusqu'à la fin de
   la partie). **Démarrer le lot**.
4. Si le lot s'arrête sur « fin de partie probable » (ou « à vérifier ») :
   clique sur **Reprendre** (F5 seulement si ESV reste figée). Le lot se
   ferme. La fin de partie n'est retenue que si ESV montre une partie
   supérieure et que c'est le dernier cut. Si le panneau dit « le cut N n'est
   pas le dernier », rien à faire ; s'il dit que ce cut « pourrait être le
   dernier », saisis-le comme dernier cut si tu veux le retenir. Si le
   panneau dit « Contrôle le cut N dans ESV », fais-le.
5. À la fin : **Tout télécharger pour l'analyse**.

**Sa relecture (≈ 15 à 25 min)**
1. **Démarrer l'observation** dans Écho ; vérifie que le panneau affiche la
   **même partie** que le lot, et, après deux cuts, que le nombre de visites
   monte. Sans observation active, rien n'est enregistré.
2. Pars du **premier cut du lot** et avance dans l'ordre, sans en choisir :
   relis **tous les cuts validés par Orbite**, jusqu'à en avoir relu **au moins
   100** (tous s'il y en a moins). Règle habituelle : bon → suivant sans
   valider ; faux → corrigé puis validé.
3. **Les différés « écartement bas »** (motif affiché dans le panneau
   d'Orbite) : ce sont les refus de la nouvelle garde. Pose-les toi-même et
   valide : c'est ainsi que je saurai si le refus était juste.
4. Si tu dois faire **F5** pendant la relecture : relance l'observation et
   revérifie que les visites montent.
5. **Terminer et télécharger**, puis vérifie que les fichiers sont bien dans
   Téléchargements **avant** de revenir à la version stable.

**Envoi** : une archive avec les deux exports, et trois temps notés à part :
le lot, la relecture, l'export et l'envoi ; plus tes surprises. Je mesure, puis je te donne une **fiche de décision** de 5 points
au plus.

**Pour revenir à la stable** : désactive « Ariane 4.8.5 TEST », active
« Ariane », F5.

## Ensuite (4.9)

Un cycle tous les 2 à 3 jours : un paquet de test, ton lot et sa relecture,
ma fiche de décision, ta réponse. Deux petites tâches uniques s'y ajouteront,
annoncées la veille :
- **P2** : 30 cuts reposés en aveugle (15 min) ;
- **décentrage de la vue** : un relevé de 10 min dans ESV, avec un script à
  coller que je te fournirai.

# CH-102 : maquettes du panneau construites avec Exact (D-326) — travail en cours

Rien n'est intégré dans l'extension. Rien d'Exact n'est dans ce dépôt : seules les sources des trois applications y sont. Aucune capture ici.

## État au 10/11/2026 (à lire avant tout)

- **ÉTABLI** : `aujourdhui.cjs` photographie le panneau du tronc dans les huit états, aux deux tailles (360 × 480, 600 × 760) et dans les deux thèmes : 32 images, 0 erreur de page. Les images restent hors dépôt.
- **NON FAIT** : les trois applications ci-dessous **n'ont jamais été compilées ni lancées**. L'installation d'Exact (`bun scripts/exact.mjs setup`) est refusée dans la session du chantier par une règle de permission (exécution de code d'un dépôt tiers) ; l'accord de l'opérateur est attendu. Les sources sont écrites d'après `docs/start-here.md`, la carte Contract et les patrons d'Exact : elles contiennent certainement des erreurs que le compilateur dira. Aucun chiffre de rendu, aucune image de proposition n'existe.

## Fichiers

- `modele.contract` : le lot fabriqué (partie 13, cuts 4790 à 4900, 22 cuts traités, 19 posés, 3 à poser), les huit états, les actions par état, et l'écran « Plus » commun.
- `fiche/`, `carte/`, `bandeau/` : `vue.contract` (la vue de la proposition) et `app.test.contract` (le parcours des huit états).
- `assembler.cjs` : fabrique `app.contract` = en-tête de la vue + modèle + vue. À lancer vers le dossier de l'application Exact, hors dépôt.
- `aujourdhui.cjs` : la colonne « aujourd'hui ».

## Les trois propositions (une phrase chacune)

1. **La fiche** : une page de réglages du système ; l'état est le titre de la première carte, l'avancement sa barre, les chiffres des lignes.
2. **La carte** : l'état en grand titre, une seule carte du système pour l'avancement, un seul bouton plein.
3. **Le bandeau** : l'état est un aplat de couleur en tête de fenêtre, lisible de loin ; la barre et les chiffres dessous.

Aucune ne dessine de voie, de rail ni de cut. Aucune ne nomme une police ni une taille de contrôle.

## Où est chaque action du panneau actuel

| Action | Où |
|---|---|
| Démarrer le lot, Pause, Reprendre, Réessayer ce cut, Voir ce qui reste | premier plan, bouton plein |
| Reprise manuelle, Exporter le dossier, Nouveau lot (fin de lot) | premier plan, bouton bordé |
| Arrêter le lot, Arrêter la relecture, Arrêter le rattrapage | premier plan, bouton d'arrêt |
| Premier cut, Dernier cut | premier plan à l'état « prêt » (fiche) ; **à placer** dans la carte et le bandeau |
| Liste « à poser », verts (Recalculer), Écho, Aurore, Constellation (Préparer la file), Nouveau lot, Tout télécharger, Vider le cache, onglet ESV, Reconnecter ESV, réglages et journal | écran « Plus », un clic |
| SKIP explicite | nulle part (D-320) |

À compléter une fois les applications lancées : Repris manuellement, Archiver le résultat interrompu, Relancer la deuxième passe, les actions de la file (Arrêter, Reprendre, Lancer), Pause et Reprendre de la relecture, J'ai contrôlé le cut, Aller au cut, la correction. Elles n'apparaissent que dans des états hors des huit montrés.

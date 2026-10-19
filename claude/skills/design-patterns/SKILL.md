---
name: design-patterns
description: Use when a change in Ariane/Banane keeps growing the same switch or if-chain, when duplicated lifecycle or setup code appears across modules, when a new variant (session type, pilot policy, export format, storage backend) forces edits in many files, or before introducing a class, wrapper or abstraction layer. Design patterns, refactoring, GoF, anti-conditional, couplage, patron de conception.
---

# Design patterns (Ariane)

Source : refactoring.guru/design-patterns (22 patrons GoF). Catalogue condensé : [catalog.md](catalog.md). Où ils vivent déjà dans Ariane : [ariane-map.md](ariane-map.md).

**Principe : un patron répond à un symptôme observé dans le code, jamais à l'envie d'en placer un.** Pas de symptôme nommé = pas de patron.

## Procédure

1. Nommer le symptôme en une phrase, avec `fichier:ligne`.
2. Le chercher dans le tableau ci-dessous ; lire UNE entrée de [catalog.md](catalog.md).
3. Vérifier « Quand ne pas l'utiliser » (ci-dessous) et le contrat gelé de [ariane-map.md](ariane-map.md).
4. Appliquer la plus petite version qui supprime le symptôme, tests existants verts avant et après (`node tools/verify.cjs`).

## Symptôme → patron

| Symptôme | Patron |
|---|---|
| `if/switch` sur un type ou un mode, qui grossit à chaque variante | Strategy ; si les variantes se déclenchent entre elles : State |
| Beaucoup d'étapes identiques, 2 ou 3 qui changent | Template Method |
| Constructeur ou objet d'options à 8+ paramètres, étapes optionnelles | Builder |
| Créer un objet selon la config sans connaître sa classe | Factory Method (une famille cohérente : Abstract Factory) |
| API tierce ou format incompatible (ESV, chrome.*) | Adapter |
| Sous-système complexe appelé dans le même ordre partout | Facade |
| Même accès contrôlé (cache, droits, lazy, journal) devant un service | Proxy |
| Ajouter un comportement empilable sans sous-classes | Decorator |
| Vérifications ordonnées, chacune peut stopper | Chain of Responsibility |
| Action à mettre en file, rejouer, journaliser, annuler | Command (+ Memento pour l'état d'avant) |
| Objets qui s'appellent tous entre eux | Mediator ; réaction à un événement : Observer |
| Instantané et restauration sans exposer l'interne | Memento |
| Arbre de parties traitées comme un tout | Composite (+ Iterator, Visitor) |
| Trop d'objets identiques en mémoire | Flyweight |
| Copier un objet configuré sans connaître sa classe | Prototype |
| Deux axes de variation croisés | Bridge |

## Quand ne pas l'utiliser

- **Moins de 3 variantes ou aucun changement prévu :** garder le `if`.
- **JavaScript :** une fonction passée en paramètre ou une table `{clé: fonction}` remplace presque toujours Strategy, Command, Factory et Template Method. Pas de classe sans état à porter.
- **Singleton :** à éviter (état global, tests difficiles). Un module UMD est déjà un singleton.
- **Fichiers gelés :** voir [ariane-map.md](ariane-map.md). Ne rien refactorer dans `src/geometry.js` ni `src/geometry-candidate-v1.js` (empreintes vérifiées) ; un patron s'ajoute autour, pas dedans.
- **Refactor sans test de caractérisation :** en écrire un d'abord.

## Erreurs fréquentes

| Erreur | Correction |
|---|---|
| Patron appliqué par analogie de nom | Revenir au symptôme de l'étape 1 |
| Hiérarchie de classes en JS fonctionnel | Table de fonctions ou composition |
| Mélanger refactor et changement de comportement | Deux commits ; le refactor ne change aucune sortie |
| Facade/Mediator qui devient un fourre-tout | Scinder par responsabilité |

# Catalogue des 22 patrons

Source : https://refactoring.guru/design-patterns (page patron : `/design-patterns/<slug>`). Trois familles : **créationnels** (comment créer), **structurels** (comment assembler), **comportementaux** (comment les objets communiquent et se répartissent le travail).

Format : *symptôme* → idée → à surveiller.

## Créationnels

| Patron (slug) | Symptôme | Idée | À surveiller |
|---|---|---|---|
| Factory Method (`factory-method`) | Le code dépend de classes concrètes ; ajouter un type touche partout | Une méthode de création redéfinissable ; le client ne voit que l'interface produit | Beaucoup de sous-classes. Spécialisation de Template Method |
| Abstract Factory (`abstract-factory`) | Familles de produits qui doivent rester compatibles | Une fabrique par variante, produisant toute la famille | Beaucoup d'interfaces |
| Builder (`builder`) | « Telescoping constructor », objet à étapes optionnelles | Étapes de construction isolées ; Director optionnel pour les recettes courantes | Classes en plus. Utile pour les arbres Composite |
| Prototype (`prototype`) | Copier sans connaître la classe ; sous-classes qui ne diffèrent que par la config | `clone()` + registre de modèles préconfigurés | Références circulaires |
| Singleton (`singleton`) | Une seule instance partagée | Constructeur privé + accès statique | Viole SRP, état global caché, tests difficiles, concurrence |

## Structurels

| Patron | Symptôme | Idée | À surveiller |
|---|---|---|---|
| Adapter (`adapter`) | Interface incompatible (tiers, héritage) | Enveloppe qui traduit les appels | Parfois plus simple de modifier le service |
| Bridge (`bridge`) | Deux dimensions de variation → explosion de sous-classes | Abstraction (contrôle) tenant une Implémentation (plateforme) | Inutile sur une classe déjà cohésive |
| Composite (`composite`) | Modèle en arbre, feuilles et conteneurs | Interface commune, récursion | Interface trop générale |
| Decorator (`decorator`) | Combinaisons de comportements | Enveloppes empilables de même interface | Ordre d'empilement, retrait au milieu difficile |
| Facade (`facade`) | Sous-système complexe, appels répétés dans le même ordre | Interface simple devant le sous-système | Devient un « god object » |
| Flyweight (`flyweight`) | Trop d'objets en RAM | État intrinsèque partagé et immuable, extrinsèque passé en paramètre | Échange mémoire contre CPU |
| Proxy (`proxy`) | Accès à contrôler (lazy, cache, droits, distant, journal) | Même interface que le service, logique avant/après | Latence, classes en plus |

## Comportementaux

| Patron | Symptôme | Idée | À surveiller |
|---|---|---|---|
| Chain of Responsibility (`chain-of-responsibility`) | Contrôles ordonnés qui gonflent un bloc | Maillons chaînés, chacun traite ou transmet | Requête non traitée |
| Command (`command`) | Besoin de file, rejeu, annulation, journal | Requête = objet autonome avec `execute` | Couche en plus |
| Iterator (`iterator`) | Parcours mélangé au stockage | Objet itérateur avec son propre curseur | Superflu sur listes simples |
| Mediator (`mediator`) | Composants fortement couplés entre eux | Passer par un médiateur central | Devient un god object |
| Memento (`memento`) | Annuler/restaurer sans casser l'encapsulation | Snapshot immuable créé par le propriétaire, gardé par un Caretaker | Mémoire, nettoyage des snapshots |
| Observer (`observer`) | Réagir à un changement sans couplage | Éditeur + abonnés via une interface | Ordre de notification non garanti |
| State (`state`) | Gros `if/switch` sur un champ d'état dans chaque méthode | Une classe par état, le contexte délègue ; les états peuvent déclencher les transitions | Excessif pour peu d'états |
| Strategy (`strategy`) | Gros conditionnel entre variantes d'un algorithme | Algorithmes interchangeables derrière une interface | Excessif pour peu de variantes ; une fonction suffit en JS |
| Template Method (`template-method`) | Algorithmes quasi identiques | Squelette en base, étapes redéfinies (abstraites, optionnelles, hooks) | Rigide ; héritage statique |
| Visitor (`visitor`) | Nouvelle opération sur une structure d'éléments de classes différentes | `accept(visitor)` + double dispatch | Chaque nouvel élément oblige à modifier tous les visiteurs |

## Confusions classiques

- **Adapter / Facade / Proxy / Decorator :** Adapter *change* l'interface ; Facade en *crée une nouvelle* pour un sous-système ; Proxy *garde la même* et contrôle l'accès ; Decorator *garde ou étend* et s'empile.
- **Strategy / State :** Strategy = algorithmes indépendants ; State = états qui se connaissent et déclenchent les transitions.
- **Strategy / Template Method :** composition à l'exécution contre héritage fixé à la compilation.
- **Strategy / Command :** même algorithme interchangeable contre opération transformée en objet (file, historique).
- **Mediator / Observer / Chain / Command :** quatre façons de relier émetteur et récepteur : hub central, abonnement, chaîne, lien à sens unique.
- **Decorator / Chain :** un décorateur ne casse jamais le flux ; un maillon peut l'arrêter.
- **Facade / Mediator :** la Facade n'ajoute rien et les objets se parlent encore ; le Mediator centralise.
- **Singleton / Flyweight :** Flyweight a plusieurs instances immuables ; Singleton une seule, éventuellement mutable.

## Évolution typique

Commencer par Factory Method, évoluer vers Abstract Factory, Prototype ou Builder si le besoin de souplesse l'exige. Les patrons se combinent : Command + Memento (annuler), Composite + Iterator/Visitor (parcourir un arbre), Builder qui produit un Composite.

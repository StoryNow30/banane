# Référence : SwiftPieces (dépôt local + site swiftpieces.com)

Famille : parcours et motifs d'application éprouvés. Lecteur : concepteur CH-014 (série `app-`).

## Ce que j'ai ouvert exactement

### Dépôt `saivion/swiftpieces` (lecture seule)
- `README.md` en entier (85 pièces, 14 catégories ; principes : un fichier par pièce, Reduce Motion et Reduce Transparency respectés, couleurs sémantiques, Dynamic Type).
- En-têtes (titre + description) des **85** pièces de `registry/swift/*/*.swift` (ÉTABLI, lu).
- Code complet (partie propre à la pièce, avant `// MARK: - Piece motion`) — ÉTABLI, lu ligne à ligne :
  - feedback : `StatusMorph.swift` (avec ses copies `PieceMotion` / `PieceLiquid` / `PieceMorphText`), `OutcomeScreen.swift`, `SkeletonLoader.swift` ;
  - navigation : `ScrollIsland.swift` (1 120 lignes, en entier), `StepTrail.swift` (lignes 1–720 : modèle, états done/current/ahead/unreached, refus qui secoue, légende « Step 2 of 4 », repli sans titres).
- Commentaires de conception (`///` et `//`) de la partie propre — ÉTABLI, lu :
  - navigation : `FloatingDock`, `TrackingTabs`, `PageDots` ;
  - sheets : `ConfirmSheet`, `NoticeStack`, `Toast` ;
  - lists : `StatusTimeline`, `TaskRow`, `SwipeActionRow`, `FollowScroll`, `PagedList` ;
  - cards : `SwipeDeck`, `WalletStack` ;
  - data and charts : `LiveStat`, `Odometer`, `RingBreakdown`, `ScrubChart` ;
  - AI : `ThinkingState`, `ThoughtOrb`, `StreamingReply` ;
  - motion : `DragToDismiss` ;
  - buttons and controls : `HoldToConfirm`, `CommitButton`, `LiquidSwitch`, `TimerDial`, `LevelPicker`, `inputs/ScrubStepper` ;
  - Liquid Glass : `GlassSegments`, `GlassModeBar`, `GlassSurface`, `GlassActionMenu` ;
  - media : `NowPlaying`, `StoryStrip`.
  Total : 34 pièces étudiées au-delà de l'en-tête.
- Fondations : la copie de `PieceMotion` (cinq ressorts, rôles, mouvement réduit) et de `PieceLiquid` (fusion, `joined` 4 pt, `apart` 26 pt) lue dans `StatusMorph.swift`.
- Guides `content/docs/guides/` : `swiftui-loading-states.mdx`, `swiftui-haptics.mdx`, `swiftui-animations.mdx`, `swiftui-motion.mdx` (prose entière, code sauté) ; `content/docs/liquid-glass.mdx`.
- Patterns (blocks Pro, texte public + vignettes du dépôt `public/pro-blocks/`) : `agents/agent-run`, `agent-approval`, `agent-plan`, `tab-bars/accessory-tab-bar`, `action-tab-bar`, `nav-bars/scope-header`, `lists/activity-timeline`, `dashboards/stats-overview`, `sheets/schedule-sheet`. Vignettes `agent-run.webp`, `accessory-tab-bar.webp` regardées, et 6 images tirées de `agent-run.mp4` (en cours → pause → terminé avec sorties).
- Paquet `packages/brand` : `README.md`, `tokens.css`, `theme.css`, `src/components/nav-glyph.tsx`.

### Site swiftpieces.com (Chromium, navigation ordinaire)
- Accueil, `/components`, `/components/feedback`, `/components/navigation`, `/components/sheets`.
- Pages de doc : `/docs/components/navigation/scroll-island`, `/feedback/status-morph`, `/navigation/step-trail`, `/sheets/notice-stack`, `/lists/status-timeline` (aperçus en direct).
- Erreurs exactes : à l'ouverture, une fenêtre promotionnelle « Whole sections, ready to drop in. » couvre la page (fermée par son bouton « Maybe later », pas de défi). Les adresses `/components/<catégorie>/<pièce>` répondent **404 « Page not found »** ; la bonne forme est `/docs/components/<catégorie>/<pièce>`.

## Ce que j'en retiens pour Ariane (ÉTABLI = lu dans le code)
1. **Une seule couleur d'action.** Partout le rouge « signal » n'est que l'action principale ou la sélection en cours (`StepTrail` : « the only red » ; `NoticeStack` : « Clear all … the one place the stack uses red »). Les issues ont leurs blocs pâles avec encre foncée : sauge = réussi, beurre = avertissement/échec, ciel = vide/info. → Chez nous : une couleur d'action par maquette, les issues en blocs pâles avec un mot.
2. **Un chiffre lu ne dépasse jamais.** Rôle `value` : ressort sans rebond, « so it never shows a value that isn't true » ; `Odometer` : tiret en attente, `TimerDial` « never shows a time or a percent it isn't ». → Rejoint « jamais un chiffre non mesuré » : total inconnu = pas de barre déterminée, tirets.
3. **Déterminé / indéterminé** (`swiftui-loading-states`) : barre déterminée seulement si la taille est connue ; sinon indicateur qui dit « ça tourne » sans quantité. `ThoughtOrb.Pill` : « dots that say the wait is indeterminate ».
4. **Un conteneur qui change d'état au lieu de trois vues** (`swiftui-motion`, « State morphs ») : la forme change (morph), le contenu se remplace (l'ancien sort plus vite), la réponse secondaire arrive en dernier.
5. **Arrêt en deux temps** : `NoticeStack` (« the clear button stretches into a red Clear all capsule; a second tap sends every card off », retombe après 3 s) et `HoldToConfirm`. Le moteur a déjà « Arrêter » → « Confirmer l'arrêt » (4 s). → Je dessine la capsule qui s'étire et le compte à rebours.
6. **Où suis-je, combien reste-t-il, comment sauter** (`ScrollIsland`) : îlot flottant, titre de la section, « 3 of 6 », anneau de lecture, grandit en panneau de sommaire. → Maquette `app-ilot`.
7. **Accessoire en direct au-dessus des onglets** (`accessory-tab-bar`) : ce qui tourne reste visible dans tous les onglets. → Maquette `app-onglets`.
8. **Agent Run** : état, horloge, activité en cours, barre à segments, Pause / Stop confirmé, puis bilan avec sorties à ouvrir. → structure de l'état EN COURS / FIN dans plusieurs maquettes.
9. **StepTrail** : faites = coche, en cours = capsule avec numéro et titre, pas encore atteintes = numéro estompé ; repli sans titres en étroit ; légende « Partie 2 sur 3 ». → File de parties.
10. **SwipeDeck / WalletStack** : pile dont chaque en-tête reste visible, la carte touchée vient devant ; jeton d'issue qui apparaît en approchant du seuil. → Maquette `app-pile`.
11. **FollowScroll** : un fil qui suit le plus récent sauf si l'on remonte ; pastille « 3 new » pour revenir. → Journal d'activité.
12. **Mouvement** : cinq ressorts (serré 0,14 s sans rebond ; réactif 0,32 s ; élastique 0,42 s ; expressif 0,48 s ; calme 0,5 s), ouvrir plus lent que fermer, cascade 30 ms plafonnée au 7e, jamais de cascade sur des données, mouvement réduit = substitution (fondu court, pas de rebond) et non suppression.
13. **Jetons du site** (`tokens.css`) : rayons 12 / 20 / 28 / pilule, lignes fines plutôt que bordures, `--ease-out: cubic-bezier(0.22,1,0.36,1)`. Le site dit « Red is never a button colour » alors que les pièces font du rouge l'action : deux usages, j'en retiens qu'il faut choisir et s'y tenir.

## Ce que j'écarte et pourquoi
- Le verre liquide (Liquid Glass, cous qui fusionnent) : propre à iOS 26, coûteux en web, et il pose du texte sur du translucide (contraste non garanti, le vérificateur ne lit que le fond CSS). Je garde l'idée « une pièce sort d'une autre et y rentre » en forme pleine.
- Le rouge pur `#FF0000` comme action : trop proche d'un sens « arrêt / danger » chez nous, où l'arrêt existe. Une couleur d'action propre à chaque maquette.
- Les orbes (`AssistantOrb`, `ThoughtOrb`) : décoratifs par nature (« Siri-style wave »), interdits de fait (« pas de halo par réflexe »).
- Haptique : sans objet dans une extension ; j'en garde la règle « un retour par moment qui compte ».

## PROBABLE / SUPPOSÉ
- PROBABLE (vu en liste, non lu) : `PromptChips`, `SourceStack`, `FlipCard`, `MotionCard`, `ParallaxCard`, `FanStack`, `ElasticButton`, `ActivityHeatmap`, `RangeLens`, les `inputs/*` autres que `ScrubStepper`, `media/*` autres que `NowPlaying`, `StoryStrip`.
- SUPPOSÉ : le code des blocks Pro (`Agent Run`, `Accessory Tab Bar`) : seulement texte et vignettes publics, la source est payante (« Its SwiftUI source comes with SwiftPieces Pro »).

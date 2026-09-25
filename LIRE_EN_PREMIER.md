# Démarrer avec Banane V4.7.19 TEST — passages à niveau, reprise des différés

**Ce n'est pas une release.** La release officielle reste la **4.7.0**,
étiquetée `v4.7.0` dans Git.

Installe `banane-v4.7.19-test.zip` dans Edge **par-dessus la 4.7.18** (bouton
« Recharger » de la page des extensions, ou remplacement du dossier) : ne
supprime pas l'extension, sinon le stockage du lot de ce matin (partie 3) est
perdu. Termine ou arrête le lot en cours avant.

Vérifie **V4.7.19 · TEST** en haut de la fenêtre Banane, et **Banane 4.7.19 ·
ouvrir** sur le bouton au bas d'ESV quand toutes les fenêtres Banane sont
fermées.

**Première chose à faire : exporter le journal** (Détails › Dépannage →
Télécharger le journal). Il contient encore le lot de la partie 3 et dira ce qui
s'est passé au cut 8209 ; la 4.7.19 le lit directement dans le stockage, sans
le message géant qui échouait.

## Ce que la 4.7.19 change sur le terrain

- **Passages à niveau.** Quand la chaîne habituelle diffère un cut de passage à
  niveau, le Pilote lit le rail par son ornière (le bord de la rainure côté
  champignon) et pose cette paire si son écartement est dans le contrat, si
  elle passe la garde d'écartement voisin et, quand il y a des cuts posés
  autour, si elle tombe à 10 mm de la voie. Il ne remplace jamais une décision
  que la chaîne prend déjà : un premier passage, une reprise ou un choix restent
  ce qu'ils étaient. Dans la voie du panneau, ces cuts comptent parmi les
  « posés par la voie ».
- **Reprise des différés.** Après un lot Pilote qui a des différés, coche
  « Reprise des différés » sous les bornes : elles passent du premier différé à
  la fin du lot précédent ; ouvre ce cut dans ESV et démarre. Le Pilote repart
  des cuts qu'il a posés et validés lui-même autour des différés : un différé
  qui a des cuts posés **des deux côtés** est prédit par une courbe passant par
  eux (ta méthode : 2–3 cuts avant, 2–3 après). Les cuts validés à la main ne
  servent pas d'appui.
- **Arrêt au dernier cut.** Au dernier cut du lot, le Pilote pose la paire et
  **s'arrête sans valider** : ESV reste sur ce cut au lieu de passer à la partie
  suivante. Contrôle-le et valide-le toi-même. Un dernier cut non résolu est
  laissé sans commande ni navigation. La ligne d'état l'écrit (« dernier cut …
  posé, non validé »). Un lot peut encore finir dans une autre partie si ESV y
  saute avant la borne (validation du dernier cut non validé de la partie).
- **Messages trop gros (KI-059).** La capture, les réponses d'ESV et les exports
  tiennent sous la limite de 64 Mo de Chrome ; une capture trop grosse met le
  lot en pause avec un message clair (« Lecture LiDAR instable : capture de …
  Mo »), reprenable, au lieu de « Adaptateur sans réponse ».
- **Ce qui ne change pas** : les contrôles avant commande, le contrat
  d'écartement 1405–1470 (jamais une cible), les commandes envoyées à ESV,
  l'interface « La ligne » (la maquette H viendra dans la version suivante).

**Ton prochain lot** : si possible une partie neuve (pas un reliquat) avec des
passages à niveau, puis une « Reprise des différés » sur le même lot, puis la
relecture Natif. Exporte journal, diagnostic et corpus.

En cas de problème, reviens à la 4.7.18 (`RETOUR_ARRIERE.md`).

## Ce qui change pour toi

**4.7.18 — la mémoire du lot ne retient que ce qui est posé.** Le Pilote
s'appuie sur les cuts voisins pour placer les suivants. Jusqu'ici, un cut qu'il
avait décidé mais pas pu poser (cible hors de la vue, cut différé ou repris à
la main) pouvait servir d'appui. Désormais, seul un cut posé et validé sert
d'appui. Tu ne verras presque aucune différence : sur la partie 35, un seul
appui sur 176 était dans ce cas. Et **« Réessayer ce cut »** est refusé si tu
as bougé les rails pendant la pause : choisis alors Reprise manuelle ou SKIP
explicite. L'interface ne change pas.

**4.7.17 — le panneau seulement.** Sous la voie, **la dernière commande** se
lit en trois étapes : émise, effet, serveur (vert seulement si l'effet est
vu). Dans l'Assisté, **l'écartement** de la proposition s'affiche sur la plage
1405–1470. Une **pastille** sur les onglets dit ce qui tourne ailleurs. En fin
de lot, **« Nouveau lot »** rouvre les bornes. Les exports de diagnostic et le
dépannage sont rangés sous **« Détails › »**. Le Pilote place exactement comme
en 4.7.16.

**4.7.16 — deux règles de la décision sur le lot.** Un cut dont l'écartement
s'éloigne de plus de 20 mm de celui de ses voisins est repris depuis la voie ;
s'il ne peut pas l'être, il est différé avec le motif « garde d'écartement
voisin » (à poser à la main, comme un différé). Et le choix par la voie accepte
un champignon vu avec 5 points de dessus au lieu de 15. Sur tout ce qui a été
relu : 13 cuts justes de plus, un faux de moins, aucun juste perdu. À la
relecture ciblée, mets dans la zone des cuts posés par la voie (traverses
creuses) et note les différés « garde d'écartement voisin ».

**4.7.15 — un seul réglage change.** Un cut que le Pilote a repris depuis la
voie sert maintenant d'appui aux cuts suivants s'il tombe à 15 mm au plus de
la position prédite (10 mm jusqu'ici). Sur tout ce qui a été relu, cela place
4 cuts justes de plus, sans aucun faux. Rien d'autre ne change : ni
l'interface, ni les contrôles, ni l'écartement.

**4.7.14 — corrections de la relecture indépendante.** Quand la garde de
continuité écarte la proposition du moteur et que la position retrouvée par la
voie ne peut pas être commandée (hors de la vue d'ESV), le cut est différé :
le Pilote n'applique plus la proposition écartée (KI-053). « Reprendre » sur un
cut archivé est refusé avec un message : passe au cut suivant, puis Reprendre.

**4.7.13 — la nouvelle interface « La ligne ».** Le Pilote travaille exactement
comme en 4.7.12 ; seul le panneau change. En haut, l'état du lot, le cut en
cours en grand et les compteurs. Dessous, **la voie** : une traverse par cut —
pleine, posé par le moteur ; creuse, posé par la voie ; pointillée, différé ;
haute avec son numéro, le cut affiché (rouge « N ? » si le résultat est
incertain). Au-dessus, **le profil** : l'écart de chaque cut à la voie de ses
voisins, dans la bande de ±30 mm ; un point rouge au-dessus de la bande, c'est
un cut qui sort de la voie. En bas, **un seul bouton plein** : l'action
suivante (Pause pendant le lot, Archiver en cas d'incident, Télécharger à la
fin) ; les autres choix sont des liens. SKIP explicite demande désormais une
confirmation. Le thème suit celui de Windows (clair ou sombre).


**Le Pilote place plus de cuts.** Quand le moteur diffère un cut, ou le refuse
pour son écartement, le Pilote le reprend à partir de la voie tracée par les
cuts **qu'il vient de placer dans le même lot**, puis applique la position
trouvée. Sur ton lot 2 de la partie 31, il aurait placé 72 cuts sur 78 au lieu
de 47. Les règles ne changent pas : les deux rails sont exigés, l'écartement
[1 405, 1 470] mm n'est qu'un contrôle d'admissibilité, jamais une cible.
Comme tout cut que le Pilote place, un cut repris ainsi est **validé** dans ESV
avant de passer au suivant ; un cut qu'il ne sait pas placer reste différé,
sans VALIDATE ni SKIP.

**Un faux connu est accepté** (D-042) : sur ce même lot, un cut (7026) aurait
été placé à 20 mm, un choix fait avec un seul cut voisin (KI-050). Relis donc
comme d'habitude : un cut faux se corrige et se valide.

**4.7.11 — plus d'arrêt « Position proposée hors de la vue ».** Le Pilote
place un rail en cliquant dans la vue d'ESV, qui ne montre que ±20 cm autour du
rail. Quand la position trouvée tombe hors de cette vue (pose ESV de départ très
éloignée, comme sur la partie 33), le cut est désormais **différé** au lieu
d'arrêter le lot (KI-051). Pose-le à la main, comme tu le fais : dézoome et
déplace la vue au clic droit (D-043).

**4.7.12 — garde de paire.** Quand le moteur tranche une ambiguïté (S1) et
que son calage de convention échoue sur la même paire, le cut est désormais
différé : c'est la combinaison des faux 241 et 409 de la partie 20 (D-044).

**Si le Pilote s'arrête sur une erreur** : **Archiver le résultat interrompu · cut N**,
passe au cut suivant dans ESV, puis **Reprendre** (corrigé en 4.7.12, KI-052)
ou lance un nouveau lot.

**Réglages du lot → Décision sur le lot** : « Appliquer » par défaut ;
« Observer seulement » rend exactement le Pilote de la 4.7.9. Le réglage est
figé à la création du lot.

## Ce qu'il faut faire avec ce build

**F1 — des lots Pilote, puis leur relecture** (idéalement sur des parties
jamais collectées) :

1. Lance un lot Pilote GCV1 avec **Décision sur le lot : Appliquer**.
2. À la fin du lot, exporte le **diagnostic GCV1**, le **corpus LiDAR** et le
   **journal** (Dépannage → Télécharger le journal).
3. Puis **relis le lot en Natif** :
   - **passe sur chaque cut du lot** : un cut que tu visites sans le corriger
     ni le valider est compté comme bon (D-040) ; **si tu le corriges,
     valide-le** (Maj+Espace), sinon il n'est pas jugeable. Au moins une
     demi-seconde par cut ;
   - **passe aussi (Z, sans valider) sur les 5 cuts de part et d'autre** de
     chaque cut du lot.
   Exporte ensuite la session Natif.

Je compte à part les faux des cuts **placés par la décision sur le lot** (ceux
que la 4.7.9 n'aurait pas placés). Si l'anomalie du 7026 (choix à un seul
appui) se reproduit, je propose le correctif (D-042).

**Si ESV ne charge pas le nuage** (plusieurs cuts de suite « différés sans point
LiDAR ») : arrête le lot, rafraîchis la page ESV, recharge si besoin l'onglet,
puis relance un lot sur la suite (KI-049).

**F2 — P2, le plancher humain : 30 cuts replacés en aveugle**, quelques jours
après leur première pose :

1. En Natif, reviens sur 30 cuts d'une collecte déjà faite.
2. Avant de poser, **éloigne grossièrement les deux rails** (au moins 5 cm) pour
   ne pas partir de ton ancienne pose, puis replace-les et valide.
3. Exporte la session. La comparaison avec ta première pose donnera ton propre
   écart : le plancher sous lequel aucune précision n'a de sens.

## Mise à jour

1. Décompresse le ZIP et remplace les fichiers dans **le dossier de Banane déjà chargé dans Edge**. L'identité de l'extension et son stockage sont conservés.
2. Dans `edge://extensions`, clique sur **Recharger**. Recharge ensuite **la page ESV**.
3. Ouvre Banane.

## Ce que la 4.7 change pour toi

**Un cut que le moteur ne sait pas résoudre n'arrête plus le lot.** Avant, le lot se mettait en pause et t'attendait. Maintenant, par défaut, Banane quitte ce cut par une navigation sans décision — la même action que **Maj+Z** — et continue. Le cut est compté à part, dans **Différés : N**.

Un cut différé n'est **ni validé, ni skippé, ni corrigé**. Banane n'envoie rien dessus. Il est simplement mis de côté pour que tu le regardes plus tard. Les compteurs le disent : « cuts traités » et « Différés » ne se mélangent jamais.

Tu gardes le choix. Dans **Réglages du lot**, *Lorsqu'un rail n'est pas résolu* propose **Continuer et le différer** (le nouveau défaut) ou **Mettre le lot en pause** (l'ancien comportement). Le choix est figé au démarrage du lot : le changer ensuite n'affecte que le lot suivant.

**Un écartement de rails aberrant n'est plus appliqué.** Sur le lot du 21 septembre, dix paires avaient été appliquées puis validées avec un écartement entre 1 503 et 1 564 mm, hors du contrat ferroviaire. Chaque rail semblait plausible tout seul ; c'est la paire qui était fausse. Banane mesure désormais l'écartement **prévu** avant d'agir et refuse de commander hors contrat. Ces cuts-là sont différés, pas corrigés.

**Le panneau dit ce qui s'applique vraiment.** En lot Pilote GCV1, le réglage de faible confiance est neutralisé — la publication GCV1 est sa propre frontière. Le panneau l'annonce désormais au lieu d'afficher un réglage sans effet.

## Ton essai

Lance un lot Pilote TEST sur une plage où tu sais qu'il y a des cuts difficiles, et regarde :

- les propositions normales sont appliquées et validées comme avant ;
- un cut non résolu est quitté sans décision, et **Différés** augmente de 1 ;
- aucun SKIP ne part tout seul ;
- les numéros de cut peuvent sauter — c'est ESV qui décide du suivant, Banane n'en invente aucun ;
- ferme puis rouvre la fenêtre : les compteurs sont identiques, et rien n'est rejoué.

Si une navigation reste incertaine, Banane te le dit avec le numéro du cut et **ne la renvoie pas**. Contrôle ce cut dans ESV, puis clôture le résultat depuis **Dépannage**.

À la fin, **Télécharger le bilan et les LiDAR** produit le fichier de diagnostic complet.

## Les autres modes n'ont pas changé

**Mode Natif** observe ton travail manuel sans rien piloter. **Mes corrections** conserve le workflow guidé. L'**assisté** demande une proposition sur un seul cut. Aucun de ces modes n'envoie de VALIDATE, de SKIP ou de navigation à ta place.

Un cut SKIP reste dans le fichier avec son LiDAR et les états avant/final des deux rails, mais il est exclu des exemples d'entraînement. Aucun SKIP n'est déclenché automatiquement.

## Ce qui n'est pas prouvé

La confirmation d'enregistrement côté serveur ESV n'est toujours pas observable : une navigation observée n'est pas une preuve d'enregistrement. Le garde d'écartement intercepte les erreurs grossières de paire, pas les erreurs qui conservent l'écartement. Les limites connues sont listées dans `KNOWN_ISSUES.md`.

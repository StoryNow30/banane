# Démarrer avec Banane V4.7.7 TEST — Banane observe ta logique de continuité

**Ce n'est pas une release.** La release officielle reste la **4.7.0**,
étiquetée `v4.7.0` dans Git.

Installe `banane-v4.7.7-test.zip` dans Edge, exactement comme la 4.7.6.

Vérifie d'abord **V4.7.7 · TEST** en haut de la fenêtre Banane, et **Banane 4.7.7 · ouvrir** sur le bouton au bas d'ESV quand toutes les fenêtres Banane sont fermées. Si tu lis encore 4.7.6, l'ancienne copie est toujours chargée.

## Ce qui change pour toi

**Rien de visible.** En Natif, à la fin de chaque cut, Banane calcule en
arrière-plan la pose qu'il aurait proposée en partant de la droite de tes
derniers cuts validés — ta façon de faire, mesurée sur ton export de la
partie 22 (amendement n°7 du cahier 4.8). Il l'écrit dans l'export, dans la
visite (`continuityObservation`), et c'est tout : **rien n'est appliqué, rien
n'est affiché, aucune commande n'est envoyée**. C'est voulu : si tu voyais sa
proposition, elle influencerait ta pose, et ta pose est le juge.

Le Pilote, le calage et le flanc partiel sont inchangés.

## Ce qu'il faut faire avec ce build

1. **Une session Natif sur une partie avec appareils de voie ou contre-rails**,
   idéalement autre que 20 et 22. Pose chaque cut toi-même et **valide chaque
   cut** (Maj+Espace) : seules tes validations servent d'appui.
2. **Commence quelques cuts avant la zone difficile** et avance cut par cut :
   les appuis sont tes cuts validés à 3 numéros au plus du cut en cours.
3. Travaille comme d'habitude, y compris les retours en arrière : Banane ne
   s'appuie que sur ce que tu as déjà validé.
4. Envoie l'export.

**Règle d'arrêt :** si, sur la collecte, le départ par continuité fait plus de
cuts faux que le départ ESV rejoué sur la même entrée, l'observation s'arrête
là (retour à la 4.7.6, voir `RETOUR_ARRIERE.md`). À surveiller aussi : si la
santé de collecte se dégrade (captures perdues, file qui monte), dis-le.

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

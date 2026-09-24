# Démarrer avec Banane V4.7.9 TEST — correctif de l'observation du Pilote

**Ce n'est pas une release.** La release officielle reste la **4.7.0**,
étiquetée `v4.7.0` dans Git.

Installe `banane-v4.7.9-test.zip` dans Edge, exactement comme la 4.7.8.

Vérifie d'abord **V4.7.9 · TEST** en haut de la fenêtre Banane, et **Banane 4.7.9 · ouvrir** sur le bouton au bas d'ESV quand toutes les fenêtres Banane sont fermées.

## Ce qui change pour toi

**Rien de visible : le Pilote pose exactement les mêmes cuts qu'en 4.7.8, avec
le même moteur.** La 4.7.9 corrige seulement ce que le Pilote **écrit dans son
journal** sur la décision sur le lot : en 4.7.8, le « choix par la voie » ne
voyait jamais les positions calculées par le moteur (KI-048) ; sur ton lot de
la partie 31, il sous-comptait 6 cuts. Ce calcul reste **consigné, jamais
appliqué** ; c'est à partir de tes exports que je mesure ce qu'il aurait donné.

Si tu vois moins de différés qu'avant, c'est la partie, pas la version : le
Pilote de la 4.7.9 place comme celui de la 4.7.6.

## Ce qu'il faut faire avec ce build

**F1 — deux ou trois lots Pilote complets** (idéalement sur des parties jamais
collectées) :

1. Lance un lot Pilote GCV1, comme d'habitude.
2. À la fin du lot, exporte le **diagnostic GCV1** et le **corpus LiDAR**.
3. Puis **relis le lot en Natif** :
   - **valide chaque cut du lot** (Maj+Espace), **y compris ceux que le Pilote a
     posés et validés** : sans ta validation, un cut appliqué ne peut pas être
     jugé, et sous 80 % de cuts appliqués jugés le rapport déclare C4 non
     évaluable ;
   - **passe aussi (Z, sans valider) sur les 5 cuts de part et d'autre** de
     chaque cut du lot, même ceux que le Pilote a sautés : leurs poses servent à
     mesurer les appuis validés (`audit/appuis-valides-2026-09-24.md`).
   Exporte ensuite la session Natif.

**Si ESV ne charge pas le nuage** (plusieurs cuts de suite « différés sans point
LiDAR ») : arrête le lot, rafraîchis la page ESV, recharge si besoin l'onglet,
puis relance un lot sur la suite. Le Pilote ne sait pas encore reconnaître ce
défaut d'ESV (KI-049). Les cuts déjà différés restent non résolus dans ESV, et
un lot suivant les reprendra.

**F2 — P2, le plancher humain : 30 cuts replacés en aveugle**, quelques jours
après leur première pose :

1. En Natif, reviens sur 30 cuts d'une collecte déjà faite.
2. Avant de poser, **éloigne grossièrement les deux rails** (au moins 5 cm) pour
   ne pas partir de ton ancienne pose, puis replace-les et valide.
3. Exporte la session. La comparaison avec ta première pose donnera ton propre
   écart : le plancher sous lequel aucune précision n'a de sens.

**Arrêt :** si, sur un lot, la décision sur le lot produit un seul cut faux que
le Pilote n'aurait pas fait, elle n'est pas activée (D2).

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

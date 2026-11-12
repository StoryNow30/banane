# Télécommande d'Ariane sur iPhone : installation pas à pas

Une fois installée : ton iPhone affiche en direct ce que fait Ariane sur Chrome (état du lot, partie, cut, compteurs, relecture, Constellation) et porte les boutons du panneau pour **mettre en pause, reprendre et arrêter** le lot, la relecture et la Constellation. Ariane reste sur l'ordinateur : c'est toujours elle seule qui lit ESV et qui écrit. Le téléphone ne peut ni valider, ni poser, ni envoyer SKIP (D-345).

Coût : 0 €, sans carte bancaire (offre gratuite de Cloudflare). Durée : 20 minutes.

**Ce qui passe par Internet.** L'état et les ordres passent par un petit relais à toi (un « Worker » Cloudflare). Tout est chiffré de bout en bout avec une clé que seuls l'ordinateur et le téléphone connaissent : le relais ne voit qu'un numéro de canal et du charabia. Ce qui sort d'Ariane est réduit à des nombres et des mots d'une liste fermée : aucune adresse, aucun code projet, aucun identifiant, aucun nom, aucun texte d'ESV.

Il n'y a **aucun secret à fabriquer ni à coller** dans Cloudflare. Le seul secret est la clé d'appairage, affichée dans le panneau d'Ariane sous forme de QR code : ne la montre à personne, ne la colle dans aucune conversation (avec une IA ou non) ni dans aucun fichier.

## A. Le compte Cloudflare (3 min)
1. Si tu as déjà le compte du relais Telegram (`hub/telegram/INSTALLATION.md`), garde-le et passe à B.
2. Sinon, crée un compte gratuit sur https://dash.cloudflare.com (courriel et mot de passe ; pas de carte bancaire).
3. Menu « Workers & Pages » : si Cloudflare te demande de choisir ton sous-domaine `….workers.dev`, choisis un mot neutre (pas ton nom).

## B. Installer le relais (10 min, sur l'ordinateur)
Le relais est fait de trois fichiers du dossier `telecommande/` du dépôt : `worker.js`, `telephone.html`, `wrangler.toml`. Il s'installe avec l'outil officiel de Cloudflare, `wrangler`, qui tourne avec Node.js.

4. Si Node.js n'est pas installé : https://nodejs.org → version « LTS » → installe-la avec les choix proposés.
5. Mets les trois fichiers dans un dossier vide de ton ordinateur, par exemple `Documents/ariane-telecommande` (sur GitHub, ouvre chaque fichier, bouton « Raw », Fichier › Enregistrer sous, en gardant exactement son nom).
6. Ouvre un terminal dans ce dossier (Windows : clic droit dans le dossier › « Ouvrir dans le terminal » ; Mac : Terminal, puis `cd ` et glisse le dossier dans la fenêtre, Entrée).
7. Tape `npx wrangler login`, Entrée (accepte l'installation de wrangler si on te la propose). Une page Cloudflare s'ouvre : **Allow**. Reviens au terminal.
8. Tape `npx wrangler deploy`, Entrée. À la fin, le terminal affiche l'adresse du relais, qui commence par https et se termine par `ariane-telecommande.<ton-sous-domaine>.workers.dev`. Note-la (ce n'est pas un secret, mais inutile de la répandre).
9. Contrôle : ouvre cette adresse dans ton navigateur. Tu dois voir une page « Ariane » qui demande un code. C'est la page du téléphone.

Si `wrangler deploy` parle de « Durable Objects » ou de « migrations » et refuse : copie le message d'erreur **sans l'adresse** et donne-le à l'intégrateur.

## C. La version d'Ariane et de Chrome
Il faut une version d'Ariane qui contient la télécommande (CH-111) et **Chrome 116 ou plus récent** (menu ⋮ › Aide › À propos de Google Chrome). Sous Chrome 116, la télécommande reste éteinte et la feuille du panneau le dit.

À savoir : tant qu'un téléphone est appairé, Ariane envoie un signe de vie au relais toutes les 15 secondes, ce qui garde la partie de fond de l'extension éveillée même quand tu ne fais rien (sans appairage, Chrome peut l'endormir après 30 secondes d'inactivité, comme avant ; d'après la documentation de Chrome, non mesuré ici). Coupe la télécommande quand tu ne t'en sers pas pendant longtemps.

## D. Appairer l'iPhone (3 min)
10. Dans le panneau d'Ariane : menu `···` › **Réglages** › ligne **Télécommande (iPhone)** › **Ouvrir**.
11. Colle l'adresse du relais (étape 8) › **Appairer un téléphone**. Chrome demande la permission d'accéder à `….workers.dev` : **Autoriser**. Un QR code et un code de 53 caractères s'affichent.
12. Sur l'iPhone, ouvre l'appareil photo, vise le QR code, touche le lien proposé : la page s'ouvre dans Safari et affiche « En direct » en quelques secondes.
13. Dans Safari : bouton **Partager** › **Sur l'écran d'accueil** › **Ajouter**. L'icône « Ariane » ouvre désormais la télécommande en plein écran. La page efface la clé de son adresse dès qu'elle l'a lue (elle ne reste que dans la mémoire du téléphone) : si l'icône de l'écran d'accueil demande le code à sa première ouverture, tape-le une fois (il est sous le QR code ; majuscules, espaces et tirets n'ont pas d'importance). Sans appareil photo : ouvre l'adresse du relais sur l'iPhone et tape le code.
14. Ferme la feuille du panneau. Tu peux la rouvrir plus tard pour revoir le QR code (**Afficher le QR code**) et appairer un deuxième téléphone avec la même clé.

## E. À l'usage
- La page du téléphone se met à jour d'elle-même (en général en moins d'une seconde) et se reconnecte seule après une coupure de réseau ou un retour sur l'appli.
- **« Ariane hors ligne · dernier état à HH:MM »** : l'ordinateur ne parle plus (Chrome fermé, ordinateur en veille, réseau coupé). Les boutons sont grisés tant qu'Ariane est hors ligne.
- Les boutons sont ceux que le panneau propose au même moment. « Arrêter » demande une confirmation. Chaque ordre reçoit une réponse d'Ariane : « fait », ou le refus exact du panneau (par exemple « Sélectionne un onglet ESV. »).
- **Heures** : l'ordinateur et l'iPhone doivent être à l'heure automatique ; un ordre de plus de 30 secondes est refusé (« Ordre trop ancien »).
- Chaque ordre reçu, accepté ou refusé, est noté au journal d'Ariane (`telecommande-ordre`), sans la clé ni aucun texte.

## F. Couper
- **Sur l'ordinateur** : Réglages › Télécommande › **Couper la télécommande**. Ariane oublie la clé, ferme la liaison et rend la permission du relais. Les téléphones appairés passent « hors ligne » et leurs ordres ne servent plus à rien. Pour reprendre : appairer de nouveau (nouvelle clé, nouveau QR code).
- **Sur l'iPhone** : en bas de la page, **Oublier ce téléphone** efface la clé du téléphone.
- **Téléphone perdu ou clé montrée à quelqu'un** : coupe la télécommande sur l'ordinateur tout de suite (l'ancienne clé ne donne plus accès à rien), puis appaire de nouveau.
- **Supprimer le relais** : tableau de bord Cloudflare › Workers & Pages › `ariane-telecommande` › Settings › **Delete**.

## Ce qui n'est pas vérifié
Le relais et la page ont été essayés avec un relais local qui fait tourner le même code, dans Chromium. Rien n'a tourné sur le vrai Cloudflare ni sur un vrai iPhone : le déploiement par `wrangler`, les limites de l'offre gratuite et le comportement de Safari d'iOS (sockets coupées en arrière-plan, écran d'accueil) sont **SUPPOSÉS** d'après la documentation. Si Chrome endort malgré tout la partie de fond de l'extension, le téléphone l'affiche « hors ligne » ; au réveil (n'importe quelle action dans le panneau), elle se reconnecte seule.

**Limite de sécurité.** La page du téléphone est servie par ton relais. Le chiffrement protège contre quelqu'un qui regarderait passer les données chez Cloudflare ; il ne protège pas contre un Worker modifié, qui pourrait servir une page qui vole la clé. C'est pourquoi le relais doit rester le tien, sur ton compte Cloudflare, et n'être modifié qu'avec les fichiers du dépôt.

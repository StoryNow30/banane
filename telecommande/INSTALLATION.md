# Télécommande d'Ariane sur iPhone : installation pas à pas

Une fois installée : ton iPhone affiche en direct **le panneau d'Ariane lui-même**, avec ses quatre onglets (Orbite, Écho, Constellation, Aurore) et le même dessin que sur l'ordinateur (depuis la Vision 19, CH-130), et porte les boutons du panneau pour **mettre en pause, reprendre et arrêter** le lot, la relecture et la Constellation. Ariane reste sur l'ordinateur : c'est toujours elle seule qui lit ESV et qui écrit. Le téléphone ne peut ni valider, ni poser, ni envoyer SKIP (D-345).

Coût : 0 €, sans carte bancaire (offre gratuite de Cloudflare). Durée : 20 minutes.

**Ce qui passe par Internet.** L'état et les ordres passent par un petit relais à toi (un « Worker » Cloudflare). Tout est chiffré de bout en bout avec une clé que seuls l'ordinateur et le téléphone connaissent : le relais ne voit qu'un numéro de canal et du charabia. Ce qui sort d'Ariane est réduit à des nombres et des mots d'une liste fermée : aucune adresse, aucun code projet, aucun identifiant, aucun nom, aucun texte d'ESV.

Il n'y a **aucun secret à fabriquer ni à coller** dans Cloudflare. Le seul secret est la clé d'appairage, affichée dans le panneau d'Ariane sous forme de QR code : ne la montre à personne, ne la colle dans aucune conversation (avec une IA ou non) ni dans aucun fichier.

## A. Le compte Cloudflare (3 min)
1. Si tu as déjà le compte du relais Telegram (`hub/telegram/INSTALLATION.md`), garde-le et passe à B.
2. Sinon, crée un compte gratuit sur https://dash.cloudflare.com (courriel et mot de passe ; pas de carte bancaire).
3. Menu « Workers & Pages » : si Cloudflare te demande de choisir ton sous-domaine `….workers.dev`, choisis un mot neutre (pas ton nom).

## B. Installer le relais (10 min, sur l'ordinateur)
Le relais est le dossier `telecommande/` d'Ariane. Depuis la Vision 19 (CH-130), il sert aussi au téléphone le dessin du panneau (`src/signal-rendu.js`, `panel-signal.css`, sa police) : il se déploie **depuis le dossier d'Ariane décompressé**, pas depuis trois fichiers isolés. Il s'installe avec l'outil officiel de Cloudflare, `wrangler`, qui tourne avec Node.js. Sans Node.js : voir G.

4. Si Node.js n'est pas installé (Windows répond « Le terme « npx » n'est pas reconnu… ») : https://nodejs.org → version « LTS » → installe-la avec les choix proposés (ou, dans un terminal : `winget install OpenJS.NodeJS.LTS`). Puis **ferme le terminal et rouvres-en un** : un terminal déjà ouvert ne voit pas Node.js. Contrôle : `node -v` doit afficher un numéro de version.
5. Décompresse le zip d'Ariane une **deuxième fois**, dans un dossier à part, par exemple `Documents/ariane-relais` (pas dans le dossier chargé par Chrome : wrangler y laisse un dossier de travail). Le dossier à utiliser est `ariane-relais/telecommande`.
6. Ouvre un terminal dans ce dossier `telecommande` (Windows : clic droit dans le dossier › « Ouvrir dans le terminal » ; Mac : Terminal, puis `cd ` et glisse le dossier dans la fenêtre, Entrée).
7. Tape `npx wrangler login`, Entrée (accepte l'installation de wrangler si on te la propose ; une seule commande à la fois). Si Windows répond que « l'exécution de scripts est désactivée », tape `npx.cmd` au lieu de `npx`, ici et à l'étape 8. Une page Cloudflare s'ouvre : **Allow**. Reviens au terminal.
8. Tape `npx wrangler deploy`, Entrée. À la fin, le terminal affiche l'adresse du relais, qui commence par https et se termine par `ariane-telecommande.<ton-sous-domaine>.workers.dev`. Note-la (ce n'est pas un secret, mais inutile de la répandre).
9. Contrôle : ouvre cette adresse dans ton navigateur. Tu dois voir une page « Ariane » qui demande un code. C'est la page du téléphone.

Si `wrangler deploy` parle de « Durable Objects » ou de « migrations » et refuse : copie le message d'erreur **sans l'adresse** et donne-le à l'intégrateur.

## C. La version d'Ariane et de Chrome
Il faut une version d'Ariane qui contient la télécommande (CH-111) et **Chrome 116 ou plus récent** (menu ⋮ › Aide › À propos de Google Chrome). Sous Chrome 116, la télécommande reste éteinte et la feuille du panneau le dit.

À savoir : tant qu'un téléphone est appairé, Ariane envoie un signe de vie au relais toutes les 15 secondes, ce qui garde la partie de fond de l'extension éveillée même quand tu ne fais rien (sans appairage, Chrome peut l'endormir après 30 secondes d'inactivité, comme avant ; d'après la documentation de Chrome, non mesuré ici). Coupe la télécommande quand tu ne t'en sers pas pendant longtemps.

## D. Appairer l'iPhone (3 min)
10. Dans le panneau d'Ariane : menu `···` › **Réglages** › ligne **Télécommande (iPhone)** › **Ouvrir**.
11. L'adresse du relais est **déjà proposée** dans le champ (la dernière que tu as tapée, ou celle que l'intégrateur a mise dans le paquet ; voir H). Sinon, colle-la (étape 8). Puis **Appairer un téléphone**. Chrome demande la permission d'accéder à `….workers.dev` : **Autoriser**. Un QR code et un code de 53 caractères s'affichent.
12. Sur l'iPhone, ouvre l'appareil photo, vise le QR code, touche le lien proposé : la page s'ouvre dans Safari et affiche « En direct » en quelques secondes.
13. Dans Safari : bouton **Partager** › **Sur l'écran d'accueil** › **Ajouter**. L'icône « Ariane » ouvre désormais la télécommande en plein écran. La page efface la clé de son adresse dès qu'elle l'a lue (elle ne reste que dans la mémoire du téléphone) : si l'icône de l'écran d'accueil demande le code à sa première ouverture, tape-le une fois (il est sous le QR code ; majuscules, espaces et tirets n'ont pas d'importance). Sans appareil photo : ouvre l'adresse du relais sur l'iPhone et tape le code.
14. Ferme la feuille du panneau. Tu peux la rouvrir plus tard pour revoir le QR code (**Afficher le QR code**) et appairer un deuxième téléphone avec la même clé.

## E. À l'usage
- La page du téléphone se met à jour d'elle-même (en général en moins d'une seconde) et se reconnecte seule après une coupure de réseau ou un retour sur l'appli.
- **« Ariane hors ligne · dernier état à HH:MM »** : l'ordinateur ne parle plus (Chrome fermé, ordinateur en veille, réseau coupé). Les boutons sont grisés tant qu'Ariane est hors ligne.
- Les boutons sont ceux que le panneau propose au même moment. « Arrêter » demande une confirmation. Chaque ordre reçoit une réponse d'Ariane : « fait », ou un refus. Le téléphone ne reçoit pas la phrase du panneau : il reçoit un code d'une liste fermée (et le numéro de cut s'il y en a un) et affiche une phrase fixe pour ce code (par exemple « aucun onglet ESV choisi sur l’ordinateur. »).
- **Heures** : l'ordinateur et l'iPhone doivent être à l'heure automatique ; un ordre de plus de 30 secondes est refusé (« Ordre trop ancien »).
- Chaque ordre reçu, accepté ou refusé, est noté au journal d'Ariane sur l'ordinateur (`telecommande-ordre`), sans la clé ; en cas de refus, la phrase du panneau y est gardée (300 caractères au plus) avec son code. Cette phrase ne part jamais vers le téléphone.

## F. Couper
- **Sur l'ordinateur** : Réglages › Télécommande › **Couper la télécommande**. Ariane oublie la clé, ferme la liaison et rend la permission du relais. Les téléphones appairés passent « hors ligne » et leurs ordres ne servent plus à rien. Pour reprendre : appairer de nouveau (nouvelle clé, nouveau QR code).
- **Sur l'iPhone** : en bas de la page, **Oublier ce téléphone** efface la clé du téléphone.
- **Téléphone perdu ou clé montrée à quelqu'un** : coupe la télécommande sur l'ordinateur tout de suite (l'ancienne clé ne donne plus accès à rien), puis appaire de nouveau.
- **Supprimer le relais** : tableau de bord Cloudflare › Workers & Pages › `ariane-telecommande` › Settings › **Delete**.

## G. Mettre à jour le relais (Vision 19, CH-130) — à faire une fois, puis à chaque changement du dessin du panneau
Pourquoi : le relais sert la page du téléphone. Un relais installé avant la Vision 19 continue de marcher avec la nouvelle Ariane, mais le téléphone garde l'**ancienne page réduite** (état, compteurs, boutons), sans les onglets. La feuille « Télécommande » du panneau le dit en une ligne (« Ton relais sert l'ancienne page… »). Ce qui change : `worker.js`, `wrangler.toml`, `telephone.html`, et les fichiers du panneau que le relais sert (`src/signal-rendu.js`, `src/telecommande-instantane.js`, `panel-signal.css`, `fonts/Inter-latin-opsz-wght.woff2`). Rien à changer chez Cloudflare (pas de secret, pas de variable, même nom `ariane-telecommande`, même Durable Object : l'appairage et la clé restent valables, le téléphone n'a rien à refaire).

**Avec Node.js sur l'ordinateur** (3 min) : étapes 5 à 8 avec le zip de la Vision 19 (nouveau dossier `ariane-relais`), `npx wrangler deploy` dans `ariane-relais/telecommande`. Puis contrôle (plus bas).

**Sans Node.js** (pas de droits administrateur) : l'intégrateur déploie pour toi depuis sa session dans le cloud, avec un jeton Cloudflare que tu lui donnes **sans le coller dans aucune conversation**.
1. Sur https://dash.cloudflare.com : icône de profil (en haut à droite) › **Mon profil** › **Jetons d'API** › **Créer un jeton** › modèle **« Modifier les Workers Cloudflare »** › **Utiliser le modèle**. Laisse « Filtrage des adresses IP » vide (la session dans le cloud sort par plusieurs adresses). **Continuer** › **Créer le jeton**. Copie le jeton (il ne s'affiche qu'une fois).
2. Sur claude.ai, dans les réglages de l'environnement de la session de l'intégrateur : **secret réseau** pour l'hôte `api.cloudflare.com` (type « Bearer »), colle le jeton, enregistre. Le jeton n'apparaît ni dans la conversation, ni dans le dépôt, ni dans un commit. (Si un jeton y est déjà enregistré pour `api.cloudflare.com` avec ces droits, rien à faire : dis-le à l'intégrateur.)
3. L'intégrateur lance, dans `telecommande/` du dépôt à jour : `CLOUDFLARE_API_TOKEN=factice npx wrangler deploy` (le relais de la session remplace « factice » par ton jeton). Il te dit « déployé » **sans recopier l'adresse** (elle porte ton nom : jamais dans le dépôt, un commit ou le hub).
4. Une fois le contrôle fait, tu peux supprimer le jeton : Mon profil › Jetons d'API › `…` › **Supprimer** (et le secret dans les réglages de l'environnement).

**Contrôle** (1 min) : sur l'iPhone, ouvre l'icône « Ariane ». Tu dois voir les onglets **Orbite · Écho · Constellation · Aurore** en haut ; menu `···` › « Page du relais : schéma 2 ». Dans le panneau de l'ordinateur, la feuille « Télécommande » ne dit plus « ancienne page ». Si la page dit « Page du relais plus ancienne qu'Ariane », le relais n'a pas été redéployé avec la bonne version.

## H. L'adresse du relais, proposée d'office
- Ariane garde la dernière adresse tapée dans la feuille. Elle est liée à l'identité de l'extension, qui dépend du **dossier** d'où Chrome la charge (mesuré : même dossier, même identité, même avec une nouvelle version ; autre dossier, autre identité, adresse oubliée). D'où la consigne de chaque Vision : **décompresser dans le même dossier**, puis Recharger.
- L'intégrateur peut aussi mettre l'adresse **dans le paquet** au moment de le fabriquer (variable `ARIANE_RELAIS` de son terminal, ou fichier `~/.ariane/relais.txt` de sa machine ; `tools/relais_paquet.py`) : elle est alors proposée même dans un dossier neuf. Elle n'est **jamais** écrite dans le dépôt ni dans un commit (un essai le vérifie à chaque passage, `tests/ch130-adresse.test.cjs`). Un paquet qui la porte ne se dépose nulle part (ni dépôt, ni `banane-data`) : il va à toi seul.

## Ce qui n'est pas vérifié
Le relais et la page ont été essayés avec un relais local qui fait tourner le même code, dans Chromium (Vision 19 : panneau complet à 390 × 844, quatre onglets ; déploiement à blanc accepté par wrangler 4.162, fichiers du panneau embarqués tels quels). Le 12/11, le relais a été déployé sur le vrai Cloudflare par `wrangler` 4.161 (offre gratuite, Durable Object SQLite accepté) : la page servie est identique au fichier du dépôt, et un message envoyé par le rôle « ariane » arrive au rôle « tel » avec l'avis de présence (**ÉTABLI**, essai à deux sockets). Rien n'a encore tourné sur un vrai iPhone ni avec la vraie extension : les limites de l'offre gratuite et le comportement de Safari d'iOS (sockets coupées en arrière-plan, écran d'accueil) restent **SUPPOSÉS** d'après la documentation.

**Sans Node.js sur l'ordinateur** (pas de droits administrateur) : un jeton Cloudflare (modèle « Edit Cloudflare Workers », **sans filtrage d'adresse IP**, car une session de déploiement dans le cloud sort par plusieurs adresses) permet de déployer depuis une autre machine ; une fois le relais en ligne, le jeton peut être supprimé. Si Chrome endort malgré tout la partie de fond de l'extension, le téléphone l'affiche « hors ligne » ; au réveil (n'importe quelle action dans le panneau), elle se reconnecte seule.

**Limite de sécurité.** La page du téléphone est servie par ton relais. Le chiffrement protège contre quelqu'un qui regarderait passer les données chez Cloudflare ; il ne protège pas contre un Worker modifié, qui pourrait servir une page qui vole la clé. C'est pourquoi le relais doit rester le tien, sur ton compte Cloudflare, et n'être modifié qu'avec les fichiers du dépôt.

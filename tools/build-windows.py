from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
CONNECTION = '''<details id="connection"><summary>Connexion à ESV</summary><label>Onglet ESV<select id="tabs"><option value="">Choisir un onglet…</option></select></label><button id="connect" class="secondary">Reconnecter ESV</button><p class="muted">Après une mise à jour, recharge la page ESV.</p></details>'''

def page(name,title,subtitle,content):
    connection = '' if name=='home' else CONNECTION
    back = '' if name=='home' else '<a class="back" href="panel.html">← Accueil Banane</a>'
    html = f'''<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} · Banane V4</title><link rel="stylesheet" href="panel.css"></head>
<body data-window="{name}"><main>{back}<header><p class="brand">BANANE <span>V4.4.3 · TEST</span></p><h1>{title}</h1><p class="intro">{subtitle}</p></header>
<p id="context" class="context"></p><div id="notice" class="status" role="status" aria-live="polite">Prêt.</div>
{content}<p id="export-status" class="muted" role="status"></p>{connection}
<footer>Les données sont conservées quand tu fermes cette fenêtre.</footer></main><script src="panel.js"></script></body></html>'''
    (ROOT/('panel.html' if name=='home' else name+'.html')).write_text(html)

page('home','Une tâche, une fenêtre.','Choisis ce que tu veux faire dans ESV.', '''
<div class="choices"><button class="choice" data-open="corrections"><span class="choice-title">Mes corrections <span aria-hidden="true">↗</span></span><span>Enregistrer ton travail manuel pour améliorer le recalage.</span></button>
<button class="choice" data-open="native"><span class="choice-title">Mode Natif <span aria-hidden="true">↗</span></span><span>Observer ton travail manuel dans ESV sans piloter l’interface.</span></button>
<button class="choice" data-open="automatic"><span class="choice-title">Pilotage automatique <span aria-hidden="true">↗</span></span><span>Lancer et suivre un lot de cuts de test.</span></button></div>
<details><summary>Essayer une proposition avec l’assisté</summary><p>Banane propose une position sur un cut. Tu choisis de l’appliquer ou de l’ignorer.</p><button data-open="assisted" class="secondary">Ouvrir l’assisté</button></details>''')
page('native','Mode Natif','Banane observe. Tu gardes entièrement la main dans ESV.', '''
<div class="count"><strong id="native-count">0</strong><span>visites de cuts enregistrées dans cette session</span></div><p id="native-incomplete" class="warning" hidden></p>
<button id="native-start" class="primary">Démarrer l’observation</button>
<div class="row"><button id="native-pause" class="secondary" hidden>Pause</button><button id="native-resume" class="secondary" hidden>Reprendre</button></div>
<button id="native-end" class="primary" hidden>Terminer et télécharger</button>
<button id="native-download" class="secondary" hidden>Télécharger à nouveau la session</button>
<div class="guide"><p>Travaille ensuite normalement dans ESV. Aucun clic Banane n’est nécessaire entre les cuts.</p><p>Ce mode n’envoie aucun déplacement, changement de caméra, choix de rail, VALIDATE, SKIP ou navigation.</p></div>
<details><summary>Ce qui est observé</summary><p>Chaque visite, y compris un retour sur un cut, reste distincte. Banane sépare l’état observé, l’intention clavier ou souris, l’effet ensuite observé et la confirmation serveur — qui reste indiquée comme non observée.</p><p>Les points déjà chargés sont lus par petites portions avec une mémoire bornée. Si la collecte ne suit plus, elle réduit son niveau et l’indique dans l’export. Pause ferme la période en cours ; Reprendre en ouvre une nouvelle sans inventer ce qui s’est passé pendant la pause.</p></details>''')
page('corrections','Mes corrections','Un clic au début. Un clic à la fin.', '''
<div class="count"><strong id="count">0</strong><span>cuts enregistrés dans cette session</span></div><p id="incomplete" class="warning" hidden></p>
<button id="manual-start" class="primary">Démarrer l’enregistrement</button>
<div class="row"><button id="manual-pause" class="secondary" hidden>Pause</button><button id="manual-resume" class="secondary" hidden>Reprendre</button></div>
<button id="manual-end" class="primary" hidden>Terminer et télécharger</button>
<button id="manual-download" class="secondary" hidden>Télécharger à nouveau la session</button>
<div class="guide"><p>Quand le cut est prêt, corrige le rail gauche, passe au droit avec <kbd>d</kbd>, puis utilise <kbd>Shift + Espace</kbd> pour valider ou <kbd>Shift + Retour arrière</kbd> pour skipper.</p><p>Banane enregistre avant la commande ESV et prépare le cut suivant après navigation. Aucun SKIP automatique.</p></div>
<details><summary>Ce qui est enregistré</summary><p>Les points LiDAR, les positions avant, les positions finales des deux rails et la décision VALIDATE ou SKIP sont associés par cut. Un cut skippé reste conservé mais est exclu des exemples de pointage correct pour l’entraînement.</p><p>La préparation lit les deux vues et revient sur le rail gauche. Attends « Cut prêt » avant de pointer. Une lecture impossible est signalée dans l’export ; ton travail manuel peut continuer.</p><p>À la fin, le dernier cut modifié est aussi conservé. Le bouton Terminer n’envoie aucune commande supplémentaire à ESV.</p></details>''')
page('automatic','Pilotage automatique','Choisis une plage, puis suis le lot.', '''
<p class="muted">Le recalage reste expérimental. Ce lot sert à tester des résultats que tu contrôles ensuite.</p>
<div class="range"><label>Premier cut<input id="start" type="number" min="0"></label><label>Dernier cut<input id="end" type="number" min="0"></label></div>
<div id="batch" class="batch">Aucun lot en cours.</div>
<button id="start-batch" class="primary">Démarrer le lot TEST</button><div class="row"><button id="pause" class="secondary" hidden>Pause</button><button id="resume" class="secondary" hidden>Reprendre</button><button id="stop" class="danger" hidden>Arrêter</button></div>
<div class="row"><button id="retry" class="secondary" hidden>Réessayer ce cut</button><button id="manual-takeover" class="secondary" hidden>Reprise manuelle</button><button id="explicit-skip" class="danger" hidden>SKIP explicite</button></div>
<button id="dataset" class="secondary">Télécharger le bilan et les LiDAR</button>
<details><summary>Réglages du lot</summary><label>Si les deux propositions existent mais restent incertaines<select id="policy"><option value="pause">Mettre le lot en pause</option><option value="attempt">Tenter la proposition expérimentale</option></select></label><p class="muted">Un rail non résolu met toujours le cut en pause. Aucun SKIP automatique et aucun point inventé.</p><label>Seuil de l’indice LiDAR / 100<input id="confidence" type="number" value="55" min="0" max="100"></label><p class="muted">Cet indice ne mesure pas la précision réelle du pointage.</p></details>
<details><summary>Dépannage</summary><button id="journal" class="secondary">Télécharger le journal</button><button id="close-uncertain" class="secondary" hidden>Archiver le résultat interrompu</button><p class="muted">La navigation est observée dans ESV. La confirmation de l’enregistrement serveur reste indisponible.</p></details><p class="muted">Fermer cette fenêtre ne met pas le lot en pause. Utilise Pause ou Arrêter.</p>''')
page('assisted','Essai assisté','Une proposition sur le cut affiché, à ta demande.', '''
<div class="guide"><p>Clique sur Proposer, examine le résultat, puis choisis de l’appliquer ou de l’ignorer. La validation du cut reste ton action dans ESV.</p></div>
<button id="analyze" class="primary">Proposer pour ce cut</button><div id="proposals" class="proposals"></div>
<button id="accept" class="primary" hidden>Appliquer cette proposition</button><button id="reject" class="secondary" hidden>Ignorer cette proposition</button><button id="restore" class="secondary" hidden>Revenir aux positions initiales</button>
<p class="muted">Le retour aux positions initiales concerne le même cut, avant validation dans ESV.</p><details><summary>Exporter cet essai</summary><button id="dataset" class="secondary">Télécharger le bilan et les LiDAR</button></details>''')
print('Five separate windows built.')

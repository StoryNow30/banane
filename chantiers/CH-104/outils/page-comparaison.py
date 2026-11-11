#!/usr/bin/env python3
"""CH-104 : fabrique la page de comparaison (maquette à côté du vrai panneau) à partir des photos de capturer.cjs et capturer-maquette.cjs.
Usage : python3 chantiers/CH-104/outils/page-comparaison.py DOSSIER_MAQUETTE DOSSIER_VRAI DOSSIER_SORTIE
La page et ses images restent HORS du dépôt (interdit de CLAUDE.md) : elles sont publiées en privé."""
import sys, os, json, html
from PIL import Image
MAQ, VRAI, OUT = sys.argv[1:4]
os.makedirs(os.path.join(OUT, 'img'), exist_ok=True)
ORBITE = [('pret', 'Prêt'), ('cours', 'En cours'), ('pause', 'En pause'), ('toi', 'Rail non résolu'), ('panne', 'ESV muet'), ('rattrapage', 'Rattrapage'), ('relecture', 'Relecture'), ('fin', 'Fin de lot')]
FILE = [('file-repos', 'Prête'), ('file-cours', 'En cours'), ('file-passage', 'Passage'), ('file-arret', 'Arrêtée'), ('file-fin', 'Terminée')]
AUTRES = [('cours-total', 'Orbite, total connu : le pourcentage'), ('echo', 'Écho'), ('aurore', 'Aurore'), ('aurore-vide', 'Aurore sans liste'), ('menu', 'Menu « ··· »'), ('palette', 'Commandes'), ('reglages', 'Réglages'),
          ('esv', 'Onglets ESV'), ('tiroir', 'Ce qui reste'), ('boite-file', 'Boîte de la Constellation'), ('tech', 'Détails techniques'), ('relecture-pause', 'Relecture en pause après le lot'), ('relecture-interrompue', 'Relecture interrompue'), ('sans-onglet', 'Aucun onglet ESV'), ('deux-onglets', 'Deux onglets ESV, à choisir'), ('onglet-long', 'Nom d’onglet long'), ('sans-constellation', 'Constellation coupée par le réglage : trois onglets'), ('file-1', 'Constellation, une partie'), ('file-8', 'Constellation, huit parties'), ('origine', 'Panneau d’origine (secours), Orbite'), ('origine-echo', 'Panneau d’origine (secours), Écho')]
fichiers = {}
def img(src, nom):
    if not os.path.exists(src): return None
    dst = f'img/{nom}.webp'
    Image.open(src).convert('RGB').save(os.path.join(OUT, dst), 'WEBP', quality=86, method=6)
    fichiers[dst] = os.path.join(OUT, dst)
    return dst
def cadre(src, legende, taille):
    if not src: return ''
    w = 360 if taille == '360' else 600
    return f'<figure class="t{taille}"><img src="{src}" width="{w}" alt="{html.escape(legende)}" loading="lazy"><figcaption>{html.escape(legende)}</figcaption></figure>'
def rangee(cle, nom, avec_maquette=True):
    h = f'<section class="etat" id="e-{cle}"><h3>{html.escape(nom)}</h3>'
    for t in ('360', '600'):
        m = img(f'{MAQ}/maquette-{t}-{cle}.png', f'm-{t}-{cle}') if avec_maquette else None
        s = img(f'{VRAI}/sombre-{t}-{cle}.png', f's-{t}-{cle}'); c = img(f'{VRAI}/clair-{t}-{cle}.png', f'c-{t}-{cle}')
        h += f'<div class="rang" data-t="{t}">{cadre(m, "Maquette", t)}{cadre(s, "Vrai panneau", t)}{cadre(c, "Vrai panneau, thème clair", t)}</div>'
    return h + '</section>'
mes = {}
try: mes = json.load(open(os.path.join(VRAI, 'mesures.json'), encoding='utf8'))
except Exception: pass
defauts = sum(len(v) for v in mes.values())
corps = ''.join(rangee(c, n) for c, n in ORBITE)
corps_f = ''.join(rangee(c, n) for c, n in FILE)
corps_a = ''.join(rangee(c, n, False) for c, n in AUTRES)
notes = open(os.path.join(os.path.dirname(__file__), 'notes-page.html'), encoding='utf8').read() if os.path.exists(os.path.join(os.path.dirname(__file__), 'notes-page.html')) else ''
page = f'''<title>Panneau Graphite construit</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>
/* Mise en page : une colonne ; pour chaque état, la maquette à gauche, le vrai panneau à droite (sombre puis clair), à la taille choisie en haut. */
:root{{color-scheme:dark;--fond:#07080A;--tuile:#121418;--tx:#F1F2F4;--tx2:#9A9FAA;--trait:rgba(255,255,255,.1);--accent:#8F93FF;--ok:#59D499;--f:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}}
*{{box-sizing:border-box}}
body{{background:var(--fond);color:var(--tx);font:400 15px/1.55 var(--f);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 64px}}
.page{{max-width:1320px;margin:0 auto;display:flex;flex-direction:column;gap:28px}}
h1{{margin:0;font:700 clamp(24px,3.4vw,32px)/1.15 var(--f);letter-spacing:-.02em;text-wrap:balance}}
h2{{margin:18px 0 0;font:650 20px/1.2 var(--f);letter-spacing:-.01em}}
h3{{margin:0;font:600 13px/1.3 var(--f);letter-spacing:.03em;color:var(--tx2);text-transform:uppercase}}
p,li{{max-width:72ch;color:var(--tx2)}}p{{margin:0}}b,strong{{color:var(--tx);font-weight:600}}
ul{{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}}
.barre{{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 0;background:var(--fond);border-bottom:1px solid var(--trait)}}
.barre span{{color:var(--tx2);font-size:13px}}
.puce{{height:34px;padding:0 14px;border-radius:999px;border:1px solid var(--trait);background:transparent;color:var(--tx2);font:600 13px/1 var(--f);cursor:pointer}}
.puce[aria-pressed="true"]{{background:var(--tx);color:#0A0B10;border-color:transparent}}
.puce:focus-visible{{outline:2px solid var(--accent);outline-offset:2px}}
.etat{{display:flex;flex-direction:column;gap:10px;padding-top:14px;border-top:1px solid var(--trait)}}
.rang{{display:flex;gap:18px;overflow-x:auto;padding-bottom:8px}}
.page[data-t="360"] .rang[data-t="600"],.page[data-t="600"] .rang[data-t="360"]{{display:none}}
figure{{margin:0;flex:none;display:flex;flex-direction:column;gap:6px}}
figure img{{display:block;height:auto;border-radius:12px;box-shadow:0 0 0 1px var(--trait);max-width:none}}
figure.t360 img{{width:360px}}figure.t600 img{{width:420px}}
@media (min-width:1300px){{figure.t600 img{{width:400px}}}}
.page[data-clair="non"] figure:nth-child(3){{display:none}}
figcaption{{font-size:12px;color:var(--tx2)}}
.notes{{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:22px 40px;padding:20px;border-radius:14px;background:var(--tuile);border:1px solid var(--trait)}}
.notes h3{{margin-bottom:8px}}.notes>div{{min-width:0}}
.mesure{{color:var(--ok);font-weight:600}}
table{{border-collapse:collapse;font-size:13.5px;width:100%}}td,th{{text-align:left;padding:7px 12px 7px 0;border-top:1px solid var(--trait);vertical-align:top;color:var(--tx2)}}th{{color:var(--tx);font-weight:600}}td:first-child{{color:var(--tx)}}
.defile{{overflow-x:auto}}
</style>
<div class="page" data-t="360" data-clair="oui">
 <div><h1>Le panneau en Graphite, construit</h1><p>À gauche la maquette validée, à droite le vrai panneau de l’extension, chargé dans Chromium avec des états fabriqués. Treize états, deux tailles. Le thème clair n’a pas été vu par l’opérateur.</p></div>
 <div class="barre"><span>Taille</span><button type="button" class="puce" id="t360" aria-pressed="true">360 × 480</button><button type="button" class="puce" id="t600" aria-pressed="false">600 × 760</button><span>Thème clair</span><button type="button" class="puce" id="clair" aria-pressed="true">Montré</button></div>
 {notes}
 <h2>Orbite : les huit états du lot</h2>{corps}
 <h2>Constellation : les cinq états</h2>{corps_f}
 <h2>Les autres écrans (la maquette ne les montre pas)</h2>{corps_a}
</div>
<script>
(function(){{var p=document.querySelector('.page'),a=document.getElementById('t360'),b=document.getElementById('t600'),c=document.getElementById('clair');
function t(v){{p.dataset.t=v;a.setAttribute('aria-pressed',v==='360');b.setAttribute('aria-pressed',v==='600');}}
a.onclick=function(){{t('360');}};b.onclick=function(){{t('600');}};
c.onclick=function(){{var on=p.dataset.clair!=='oui';p.dataset.clair=on?'oui':'non';c.setAttribute('aria-pressed',on);c.textContent=on?'Montré':'Caché';}};}})();
</script>
'''
open(os.path.join(OUT, 'panneau-graphite-construit.html'), 'w', encoding='utf8').write(page)
json.dump(fichiers, open(os.path.join(OUT, 'fichiers.json'), 'w'), indent=0)
print(len(fichiers), 'images ;', defauts, 'défaut(s) mesuré(s) dans mesures.json')

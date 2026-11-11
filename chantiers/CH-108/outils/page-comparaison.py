#!/usr/bin/env python3
"""CH-108 : page de comparaison « référence (tronc + direction-d.css) » contre « panneau construit », à partir des photos de
chantiers/CH-104/outils/capturer.cjs (la référence prise avec FEUILLE_EN_PLUS dans une copie du tronc).
Usage : python3 chantiers/CH-108/outils/page-comparaison.py DOSSIER_REFERENCE DOSSIER_CONSTRUIT DOSSIER_SORTIE [notes.html]
La page et ses images restent HORS du dépôt (interdit de CLAUDE.md) : elles sont publiées en privé."""
import sys, os, json, html
from PIL import Image
REF, VRAI, OUT = sys.argv[1:4]
NOTES = open(sys.argv[4], encoding='utf8').read() if len(sys.argv) > 4 else ''
os.makedirs(os.path.join(OUT, 'img'), exist_ok=True)
ORBITE = [('pret', 'Prêt'), ('cours', 'En cours'), ('pause', 'En pause'), ('toi', 'Rail non résolu (à toi)'), ('panne', 'ESV muet (panne)'), ('rattrapage', 'Rattrapage'), ('relecture', 'Relecture'), ('fin', 'Fin de lot')]
FILE = [('file-repos', 'Prête, molette'), ('file-cours', 'En cours'), ('file-passage', 'Passage'), ('file-arret', 'Arrêtée'), ('file-fin', 'Terminée'), ('file-1', 'Une partie'), ('file-8', 'Huit parties')]
AUTRES = [('cours-total', 'Orbite, total connu : le pourcentage'), ('echo', 'Écho'), ('aurore', 'Aurore'), ('aurore-vide', 'Aurore sans liste'), ('menu', 'Menu « ··· »'), ('palette', 'Commandes'), ('reglages', 'Réglages'),
          ('esv', 'Onglets ESV'), ('tiroir', 'Ce qui reste'), ('boite-file', 'Boîte de la Constellation'), ('tech', 'Détails techniques'), ('relecture-pause', 'Relecture en pause après le lot'), ('relecture-interrompue', 'Relecture interrompue'),
          ('lot-arrete', 'Lot arrêté'), ('sans-onglet', 'Aucun onglet ESV'), ('deux-onglets', 'Deux onglets ESV'), ('onglet-long', 'Nom d’onglet long'), ('sans-constellation', 'Constellation coupée : trois onglets'),
          ('origine', 'Panneau d’origine, Orbite'), ('origine-echo', 'Panneau d’origine, Écho')]
fichiers = {}
def img(src, nom):
    if not os.path.exists(src): return None
    dst = f'img/{nom}.webp'
    Image.open(src).convert('RGB').save(os.path.join(OUT, dst), 'WEBP', quality=80, method=6)
    fichiers[dst] = os.path.join(OUT, dst)
    return dst
def cadre(src, legende, taille, classe):
    if not src: return ''
    return f'<figure class="t{taille} {classe}"><img src="{src}" alt="{html.escape(legende)}" loading="lazy"><figcaption>{html.escape(legende)}</figcaption></figure>'
def rangee(cle, nom, ref_clair):
    h = f'<section class="etat" id="e-{cle}"><h3>{html.escape(nom)}</h3>'
    for t in ('360', '600'):
        a = img(f'{REF}/sombre-{t}-{cle}.png', f'r-{t}-{cle}'); b = img(f'{VRAI}/sombre-{t}-{cle}.png', f's-{t}-{cle}')
        c = img(f'{REF}/clair-{t}-{cle}.png', f'rc-{t}-{cle}') if ref_clair else None; d = img(f'{VRAI}/clair-{t}-{cle}.png', f'c-{t}-{cle}')
        h += f'<div class="rang" data-t="{t}">{cadre(a, "Référence", t, "ref")}{cadre(b, "Construit", t, "moi")}{cadre(c, "Référence, clair", t, "ref clair")}{cadre(d, "Construit, clair", t, "moi clair")}</div>'
    return h + '</section>'
mes = {}
try: mes = json.load(open(os.path.join(VRAI, 'mesures.json'), encoding='utf8'))
except Exception: pass
defauts = sum(len(v) for v in mes.values())
corps = ''.join(rangee(c, n, True) for c, n in ORBITE)
corps_f = ''.join(rangee(c, n, c in ('file-repos', 'file-cours', 'file-passage', 'file-arret', 'file-fin')) for c, n in FILE)
corps_a = ''.join(rangee(c, n, False) for c, n in AUTRES)
page = f'''<title>Vision Épure construite</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300..600&display=swap">
<style>
/* Une colonne d'états ; pour chacun, la référence à gauche, le panneau construit à droite, puis le clair ; la taille se choisit en haut.
   Un seul monde, sombre, comme le panneau. */
:root{{color-scheme:dark;--fond:#08090B;--leve:#111216;--tx:#F1F2F4;--tx2:#9095A0;--trait:rgba(255,255,255,.08);--accent:#8F93FF;--ok:#59D499;--f:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}}
*{{box-sizing:border-box}}
body{{background:var(--fond);color:var(--tx);font:400 15px/1.55 var(--f);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:32px 64px}}
.page{{max-width:1500px;margin:0 auto;display:flex;flex-direction:column;gap:26px}}
h1{{margin:0;font:300 clamp(28px,4vw,40px)/1.1 var(--f);letter-spacing:-.03em;text-wrap:balance}}
h2{{margin:22px 0 0;font:400 22px/1.2 var(--f);letter-spacing:-.02em}}
h3{{margin:0;font:500 11px/1.3 var(--f);letter-spacing:.12em;color:var(--tx2);text-transform:uppercase}}
p,li{{max-width:75ch;color:var(--tx2)}}p{{margin:0}}b{{color:var(--tx);font-weight:500}}
ul{{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}}
.barre{{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 0;background:var(--fond);border-bottom:1px solid var(--trait)}}
body::before{{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--fond)}}
.barre span{{color:var(--tx2);font-size:13px;margin-left:6px}}
.puce{{height:34px;padding:0 15px;border-radius:999px;border:0;box-shadow:inset 0 0 0 1px var(--trait);background:transparent;color:var(--tx2);font:500 13px/1 var(--f);cursor:pointer}}
.puce[aria-pressed="true"]{{background:var(--tx);color:var(--fond);box-shadow:none}}
.puce:focus-visible{{outline:2px solid var(--accent);outline-offset:2px}}
.etat{{display:flex;flex-direction:column;gap:10px;padding-top:16px;border-top:1px solid var(--trait)}}
.rang{{display:flex;gap:16px;overflow-x:auto;padding-bottom:8px}}
.page[data-t="360"] .rang[data-t="600"],.page[data-t="600"] .rang[data-t="360"]{{display:none}}
.page[data-clair="non"] figure.clair{{display:none}}
figure{{margin:0;flex:none;display:flex;flex-direction:column;gap:6px}}
figure img{{display:block;height:auto;border-radius:10px;box-shadow:0 0 0 1px var(--trait);max-width:none}}
figure.t360 img{{width:300px}}figure.t600 img{{width:340px}}
figure.moi figcaption{{color:var(--tx)}}
figcaption{{font-size:12px;color:var(--tx2)}}
.notes{{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:22px 44px;padding:22px 0;border-block:1px solid var(--trait)}}
.notes>div{{min-width:0;display:flex;flex-direction:column;gap:8px}}
.mesure{{color:var(--ok)}}
</style>
<div class="page" data-t="360" data-clair="oui">
 <div style="display:flex;flex-direction:column;gap:10px"><h1>« Épure, un caractère par panneau », construite dans Vision</h1><p>Pour chaque état, à gauche la référence (le panneau du tronc avec la feuille maquettes/caractere/direction-d.css posée dessus), à droite le panneau construit (CH-108), puis le thème clair. Vrai panneau dans Chromium, états fabriqués, API Chrome simulée.</p></div>
 <div class="barre"><span>Taille</span><button type="button" class="puce" id="t360" aria-pressed="true">360 × 480</button><button type="button" class="puce" id="t600" aria-pressed="false">600 × 760</button><span>Thème clair</span><button type="button" class="puce" id="clair" aria-pressed="true">Montré</button></div>
 {NOTES}
 <h2>Orbite : les huit états du lot</h2>{corps}
 <h2>Constellation</h2>{corps_f}
 <h2>Les autres écrans</h2>{corps_a}
</div>
<script>
(function(){{var p=document.querySelector('.page'),a=document.getElementById('t360'),b=document.getElementById('t600'),c=document.getElementById('clair');
function t(v){{p.dataset.t=v;a.setAttribute('aria-pressed',v==='360');b.setAttribute('aria-pressed',v==='600');}}
a.onclick=function(){{t('360');}};b.onclick=function(){{t('600');}};
c.onclick=function(){{var on=p.dataset.clair!=='oui';p.dataset.clair=on?'oui':'non';c.setAttribute('aria-pressed',on);c.textContent=on?'Montré':'Caché';}};}})();
</script>
'''
open(os.path.join(OUT, 'vision-epure.html'), 'w', encoding='utf8').write(page)
json.dump(fichiers, open(os.path.join(OUT, 'fichiers.json'), 'w'), indent=0)
print(len(fichiers), 'images ;', defauts, 'défaut(s) mesuré(s) dans mesures.json')

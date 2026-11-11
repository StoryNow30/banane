'use strict';
/* CH-102 : fabrique la page de comparaison (hors dépôt : elle porte des captures).
 *   node maquettes/ui-ch102/outils/page.cjs DOSSIER_AUJOURDHUI DOSSIER_PROPOSITIONS DOSSIER_EMBARQUE DOSSIER_DE_SORTIE
 * DOSSIER_AUJOURDHUI : images de `maquettes/ui-ch101/outils/capturer2.cjs` (<thème>-<taille>-<état>.png) ;
 * DOSSIER_PROPOSITIONS : images de `photographier.cjs` (<proposition>-<état>-<taille>-<thème>.png) ;
 * DOSSIER_EMBARQUE : sortie de `embarquer.cjs` (les trois applications prêtes pour un sous-dossier).
 * Sortie : index.html, img/, app/ et fichiers.json (la liste à publier avec la page). */
const fs = require('node:fs'), path = require('node:path');
const [, , AUJ, CAP, EMB, SORTIE] = process.argv;
if (!SORTIE) { console.error('usage : page.cjs DOSSIER_AUJOURDHUI DOSSIER_PROPOSITIONS DOSSIER_EMBARQUE DOSSIER_DE_SORTIE'); process.exit(2); }
if (!path.relative(path.resolve(__dirname, '../../..'), path.resolve(SORTIE)).startsWith('..')) { console.error('refus : la sortie est dans le dépôt (aucune capture dans le dépôt)'); process.exit(2); }

const ETATS = [['pret', 'Prêt', 'Rien ne tourne. On choisit le premier et le dernier cut, puis on démarre.'], ['cours', 'Lot en cours', 'Ariane pose. Rien n’est attendu de l’opérateur.'],
  ['pause', 'Pause', 'Le lot attend qu’on le reprenne.'], ['toi', 'Rail non résolu', 'Ariane a besoin de l’opérateur : réessayer, ou reprendre le cut à la main.'],
  ['panne', 'ESV muet', 'ESV ne répond plus : recharger la page ESV, puis reprendre.'], ['rattrapage', 'Rattrapage', 'Ariane repasse sur les cuts laissés. On ne touche à rien.'],
  ['relecture', 'Relecture', 'Ariane relit les cuts posés après le lot.'], ['fin', 'Fin de lot', 'Le lot est fini. Il reste des cuts à poser à la main.']];
const COLS = [['auj', 'Aujourd’hui', ''], ['fiche', '1 · La fiche', 'fiche'], ['carte', '2 · La carte', 'carte'], ['bandeau', '3 · Le bandeau', 'bandeau']];
const PROPS = [['fiche', 'La fiche', 'Une page de réglages du système : l’état en titre de la première carte, l’avancement en barre, les actions, puis les chiffres et les cuts à poser en lignes.', 'La plus complète : tout se lit sans cliquer, en défilant.'],
  ['carte', 'La carte', 'L’état en très grand titre, une seule carte pour l’avancement, et les boutons. Rien d’autre à l’écran.', 'La plus calme : un écran, une idée.'],
  ['bandeau', 'Le bandeau', 'L’état est un aplat de couleur en haut de la fenêtre : gris à l’arrêt, bleu quand Ariane travaille, orange quand elle attend, rouge en panne, vert à la fin.', 'La plus lisible de loin : la couleur suffit, sans lire.']];

fs.rmSync(SORTIE, { recursive: true, force: true }); fs.mkdirSync(path.join(SORTIE, 'img'), { recursive: true });
const fichiers = {};
for (const [e] of ETATS) for (const t of ['360', '600']) for (const th of ['clair', 'sombre']) {
  const cibles = [[path.join(AUJ, `${th}-${t}-${e}.png`), `img/auj-${e}-${t}-${th}.png`], ...['fiche', 'carte', 'bandeau'].map(p => [path.join(CAP, `${p}-${e}-${t}-${th}.png`), `img/${p}-${e}-${t}-${th}.png`])];
  for (const [de, vers] of cibles) { fs.copyFileSync(de, path.join(SORTIE, vers)); fichiers[vers] = vers; }
}
for (const p of ['fiche', 'carte', 'bandeau']) { fs.mkdirSync(path.join(SORTIE, 'app', p), { recursive: true });
  for (const f of fs.readdirSync(path.join(EMB, p))) { fs.copyFileSync(path.join(EMB, p, f), path.join(SORTIE, 'app', p, f)); fichiers[`app/${p}/${f}`] = `app/${p}/${f}`; } }

const fig = (c, e, n) => `<figure class="cadre${c[0] === 'auj' ? ' auj' : ''}"><figcaption>${c[1]}</figcaption><button type="button" class="vue" data-col="${c[0]}" data-etat="${e[0]}" aria-label="Agrandir : ${c[1]}, ${e[1]}"><img alt="${c[1]}, état ${e[1]}" data-col="${c[0]}" data-etat="${e[0]}" width="360" height="480"${n ? ' loading="lazy"' : ''}></button></figure>`;
const html = `<title>Panneau Ariane, tour Exact</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Mise en page : une page de comparaison sobre, quatre colonnes par état (aujourd'hui puis les trois propositions) ; la page s'efface, les écrans parlent. */
:root{--fond:#f4f5f7;--surface:#ffffff;--encre:#16181d;--encre2:#5b6270;--trait:#d9dce3;--accent:#0b5fff;--cadre:#e4e7ec;
  --texte:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--chiffres:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--fond:#101216;--surface:#191c22;--encre:#eef0f4;--encre2:#9aa2b1;--trait:#2c313b;--accent:#6ea3ff;--cadre:#0a0b0e;color-scheme:dark}}
:root[data-theme="dark"]{--fond:#101216;--surface:#191c22;--encre:#eef0f4;--encre2:#9aa2b1;--trait:#2c313b;--accent:#6ea3ff;--cadre:#0a0b0e;color-scheme:dark}
body{background:var(--fond);color:var(--encre);font:16px/1.5 var(--texte)}
.page{max-width:1560px;margin:0 auto;padding-block:40px 80px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:flex;flex-direction:column;gap:48px}
h1{font-size:clamp(1.7rem,3.2vw,2.4rem);line-height:1.15;margin:0;letter-spacing:-.02em;text-wrap:balance}
h2{font-size:1.35rem;line-height:1.2;margin:0;letter-spacing:-.01em;text-wrap:balance}
h3{font-size:1.05rem;margin:0}
p{margin:0;max-width:68ch}
.chapo{color:var(--encre2);font-size:1.05rem}
.tete{display:flex;flex-direction:column;gap:14px}
.props{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.prop{background:var(--surface);border:1px solid var(--trait);border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:8px}
.prop b{font-size:.8rem;color:var(--encre2);font-weight:600;font-variant-numeric:tabular-nums}
.prop p{font-size:.95rem}.prop .plus{color:var(--encre2)}
.barre{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--fond);border-bottom:1px solid var(--trait);padding-block:10px;display:flex;flex-wrap:wrap;gap:10px 24px;align-items:center}
.groupe{display:flex;align-items:center;gap:8px;font-size:.9rem;color:var(--encre2)}
.seg{display:inline-flex;border:1px solid var(--trait);border-radius:8px;overflow:hidden;background:var(--surface)}
.seg button{font:inherit;color:var(--encre);background:none;border:0;padding:6px 12px;cursor:pointer;font-variant-numeric:tabular-nums}
.seg button+button{border-left:1px solid var(--trait)}
.seg button[aria-pressed="true"]{background:var(--encre);color:var(--fond)}
button:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.etats{display:flex;flex-direction:column;gap:44px}
.etat{display:flex;flex-direction:column;gap:14px}
.etat header{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline}
.etat header p{color:var(--encre2);font-size:.95rem}
.rang{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;align-items:start}
@media (max-width:900px){.rang{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:460px){.rang{grid-template-columns:minmax(0,1fr)}}
.cadre{margin:0;display:flex;flex-direction:column;gap:6px;min-width:0}
.cadre figcaption{font-size:.85rem;font-weight:600}
.cadre.auj figcaption{color:var(--encre2);font-weight:500}
.vue{display:block;padding:0;border:1px solid var(--trait);border-radius:10px;overflow:hidden;background:var(--cadre);cursor:zoom-in;width:100%;max-width:360px}
.rang[data-taille="600"] .vue{max-width:600px}
.vue img{display:block;width:100%;height:auto}
.essai{display:flex;flex-direction:column;gap:16px}
.cadres{display:flex;flex-wrap:wrap;gap:20px}
.vivant{display:flex;flex-direction:column;gap:6px;min-width:0;max-width:100%}
.vivant .defile{overflow-x:auto;max-width:100%}
.vivant iframe{display:block;border:1px solid var(--trait);border-radius:10px;background:var(--surface);width:360px;height:480px}
.essai[data-taille="600"] .vivant iframe{width:600px;height:760px}
.note{color:var(--encre2);font-size:.9rem}
table{border-collapse:collapse;font-size:.95rem;width:100%}
th,td{text-align:left;padding:8px 12px 8px 0;border-bottom:1px solid var(--trait);vertical-align:top}
th{font-weight:600;color:var(--encre2);font-size:.85rem}
.tableau{overflow-x:auto}
ul{margin:0;padding-left:1.1em;display:flex;flex-direction:column;gap:6px;max-width:72ch}
.deux{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:32px}
.bloc{display:flex;flex-direction:column;gap:12px}
dialog{border:0;padding:0;background:transparent;max-width:96vw;max-height:96vh}
dialog::backdrop{background:rgba(0,0,0,.72)}
dialog img{display:block;max-width:96vw;max-height:90vh;width:auto;height:auto;border-radius:10px}
dialog form{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 2px;color:#fff;font-size:.9rem}
dialog button{font:inherit;color:#fff;background:rgba(255,255,255,.16);border:0;border-radius:8px;padding:6px 14px;cursor:pointer}
</style>
<div class="page">
<div class="tete">
<h1>Le panneau d’Ariane, redessiné avec Exact</h1>
<p class="chapo">Trois propositions parties d’une page blanche. Chacune est une vraie application construite avec Exact : aucune couleur, aucune police ni aucun bouton n’y est dessiné à la main, tout vient du système. À gauche de chaque rang, le panneau d’aujourd’hui.</p>
</div>
<div class="props">
${PROPS.map((p, i) => `<div class="prop"><b>Proposition ${i + 1}</b><h3>${p[1]}</h3><p>${p[2]}</p><p class="plus">${p[3]}</p></div>`).join('\n')}
</div>
<div class="barre" role="toolbar" aria-label="Réglages des images">
<div class="groupe">Taille du panneau<div class="seg" id="seg-taille"><button type="button" id="ta-360" data-v="360" aria-pressed="true">360 × 480</button><button type="button" id="ta-600" data-v="600" aria-pressed="false">600 × 760</button></div></div>
<div class="groupe">Thème<div class="seg" id="seg-theme"><button type="button" id="th-clair" data-v="clair" aria-pressed="true">Clair</button><button type="button" id="th-sombre" data-v="sombre" aria-pressed="false">Sombre</button></div></div>
<span class="note">Un clic sur une image l’ouvre en taille réelle.</span>
</div>
<div class="etats">
${ETATS.map((e, n) => `<section class="etat" id="etat-${e[0]}"><header><h2>${e[1]}</h2><p>${e[2]}</p></header><div class="rang" data-taille="360">${COLS.map(c => fig(c, e, n)).join('')}</div></section>`).join('\n')}
</div>
<section class="essai" id="essai" data-taille="360">
<h2>Les essayer en vrai</h2>
<p>Ces trois cadres ne sont pas des images : ce sont les applications elles-mêmes. Les boutons marchent, et le texte s’affiche avec la police du système de ce poste. Les données sont fabriquées, rien n’est envoyé à ESV.</p>
<div class="barre" style="position:static;border:0;padding:0"><div class="groupe">État<div class="seg" id="seg-etat">${ETATS.map((e, i) => `<button type="button" id="es-${e[0]}" data-v="${e[0]}" aria-pressed="${i === 1}">${e[1]}</button>`).join('')}</div></div></div>
<div class="cadres">
${PROPS.map((p, i) => `<div class="vivant"><h3>${i + 1} · ${p[1]}</h3><div class="defile"><iframe title="${p[1]}, application" data-app="${p[0]}" src="app/${p[0]}/index.html?etat=cours" loading="lazy"></iframe></div></div>`).join('\n')}
</div>
<p class="note">Le bouton rond en haut à droite de chaque application ouvre « Plus » : tout ce qui n’est pas le lot en cours. Si un cadre reste vide, les images au-dessus montrent les mêmes écrans.</p>
</section>
<div class="deux">
<section class="bloc"><h2>Ce qui passe derrière un clic</h2>
<p>Dans les trois propositions, le bouton rond en haut à droite ouvre « Plus ». On y trouve :</p>
<ul><li>la liste des cuts à poser et les verts à contrôler (dans La fiche, la liste est aussi sur l’écran principal) ;</li><li>Écho, Aurore et la Constellation (« Préparer la file ») ;</li><li>« Nouveau lot », « Tout télécharger pour l’analyse », « Vider le cache des exports » ;</li><li>l’onglet ESV, « Reconnecter ESV », les réglages et le journal.</li></ul>
<p>Aucune action n’est ajoutée ni retirée. « SKIP explicite » reste masqué.</p></section>
<section class="bloc"><h2>Ce qui reste au premier plan</h2>
<div class="tableau"><table><thead><tr><th>État</th><th>Boutons à l’écran</th></tr></thead><tbody>
<tr><td>Prêt</td><td>Premier cut, dernier cut, Démarrer le lot</td></tr>
<tr><td>Lot en cours</td><td>Pause, Arrêter le lot</td></tr>
<tr><td>Pause, ESV muet</td><td>Reprendre, Arrêter le lot</td></tr>
<tr><td>Rail non résolu</td><td>Réessayer ce cut, Reprise manuelle, Arrêter le lot</td></tr>
<tr><td>Rattrapage</td><td>Arrêter le rattrapage</td></tr>
<tr><td>Relecture</td><td>Nouveau lot, Arrêter la relecture</td></tr>
<tr><td>Fin de lot</td><td>Voir ce qui reste, Exporter le dossier, Nouveau lot</td></tr>
</tbody></table></div>
<p class="note">Le bouton plein (bleu) est réservé à ce qui est attendu de l’opérateur. Pendant que le lot tourne, rien ne l’est : « Pause » reste un bouton ordinaire.</p></section>
</div>
<section class="bloc"><h2>Ce que montrent les images</h2>
<ul><li>Les images des propositions sont des photographies des applications Exact, dans les huit états, aux deux tailles du panneau, en clair et en sombre.</li><li>Elles ont été prises sur une machine de travail dont la police du système est Inter. Sur un autre poste, les mêmes écrans prennent la police de ce poste (Segoe UI sous Windows, San Francisco sous macOS) : les cadres « en vrai » le montrent.</li><li>La colonne « Aujourd’hui » est le panneau actuel, photographié avec les mêmes chiffres fabriqués : partie 13, cuts 4790 à 4900.</li></ul></section>
</div>
<dialog id="loupe" aria-label="Image en taille réelle"><form method="dialog"><span id="loupe-titre"></span><button type="submit">Fermer</button></form><img id="loupe-img" alt=""></dialog>
<script>
(function(){
  var taille='360',theme='clair',racine=document.documentElement;
  try{var t=racine.getAttribute('data-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))theme='sombre';}catch(e){}
  function src(col,etat){return 'img/'+col+'-'+etat+'-'+taille+'-'+theme+'.png';}
  function peindre(){
    document.querySelectorAll('.vue img').forEach(function(i){i.src=src(i.dataset.col,i.dataset.etat);i.width=+taille;i.height=taille==='360'?480:760;});
    document.querySelectorAll('.rang').forEach(function(r){r.dataset.taille=taille;});
    document.getElementById('essai').dataset.taille=taille;
    document.querySelectorAll('#seg-taille button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.v===taille));});
    document.querySelectorAll('#seg-theme button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.v===theme));});
  }
  document.getElementById('seg-taille').addEventListener('click',function(e){var b=e.target.closest('button');if(b){taille=b.dataset.v;peindre();}});
  document.getElementById('seg-theme').addEventListener('click',function(e){var b=e.target.closest('button');if(b){theme=b.dataset.v;peindre();}});
  document.getElementById('seg-etat').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
    document.querySelectorAll('#seg-etat button').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});
    document.querySelectorAll('.vivant iframe').forEach(function(f){f.src='app/'+f.dataset.app+'/index.html?etat='+b.dataset.v;});});
  var loupe=document.getElementById('loupe');
  document.querySelector('.etats').addEventListener('click',function(e){var v=e.target.closest('.vue');if(!v)return;var i=v.querySelector('img');
    document.getElementById('loupe-img').src=i.src;document.getElementById('loupe-img').style.width=taille+'px';document.getElementById('loupe-titre').textContent=i.alt+' · '+(taille==='360'?'360 × 480':'600 × 760');
    if(loupe.showModal)loupe.showModal();});
  loupe.addEventListener('click',function(e){if(e.target===loupe)loupe.close();});
  peindre();
})();
</script>
`;
fs.writeFileSync(path.join(SORTIE, 'index.html'), html);
fs.writeFileSync(path.join(SORTIE, 'fichiers.json'), JSON.stringify(fichiers, null, 1));
console.log(`${path.join(SORTIE, 'index.html')} · ${Math.round(html.length / 1024)} ko · ${Object.keys(fichiers).length} fichiers à publier avec la page`);

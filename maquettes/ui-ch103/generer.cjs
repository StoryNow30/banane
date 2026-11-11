'use strict';
/* CH-103 : fabrique la page des deux écrans (« lot en cours », « rail non résolu »).
 * Sans argument : écrit maquettes/ui-ch103/index.html, sans aucune capture (règle du dépôt).
 * Avec --captures DOSSIER --sortie FICHIER : page à publier, hors dépôt, police et captures du panneau actuel incluses.
 * Données fabriquées : partie 13, lot du cut 4790 au cut 4900, les mêmes que les captures de l'existant. */
const fs = require('node:fs');
const path = require('node:path');
const ICI = __dirname;
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const CAPTURES = arg('--captures');
const SORTIE = arg('--sortie') || path.join(ICI, 'index.html');

const LOT = { partie: 13, debut: 4790, fin: 4900, enCours: 4812, traites: 18, poses: 15,
  aPoser: [[4809, '10 h 09'], [4803, '10 h 03'], [4796, '10 h 06']] };
const POURCENT = Math.round((LOT.enCours - LOT.debut) / (LOT.fin - LOT.debut + 1) * 100);
const n = x => `<span class="n">${x}</span>`;

const tete = () => `
<header class="ar-tete">
 <div class="ar-onglets" role="tablist" aria-label="Mode">
  <button class="ar-onglet" role="tab" aria-selected="true">Orbite</button>
  <button class="ar-onglet" role="tab" aria-selected="false">Écho</button>
  <button class="ar-onglet" role="tab" aria-selected="false">Aurore</button>
 </div>
 <div class="ar-tete-fin">
  <button class="ar-discret" title="Utilisé par Ariane — ESV. Cliquer pour choisir l'onglet."><span class="ar-point"></span>ESV</button>
  <details class="ar-menu">
   <summary aria-label="Menu"><i></i></summary>
   <div class="ar-menu-liste" role="menu">
    <button role="menuitem">Commandes <small>Ctrl K</small></button>
    <button role="menuitem">Réglages</button>
    <hr>
    <button role="menuitem" disabled>Vider le cache des exports <small>après le lot</small></button>
   </div>
  </details>
 </div>
</header>`;

const liste = ouverte => `
<details class="ar-liste"${ouverte ? ' open' : ''}>
 <summary>À poser ${n(LOT.aPoser.length)} <small>à reprendre après le lot</small></summary>
 <ul>${LOT.aPoser.map(([c, h]) => `
  <li class="ar-ligne">${n(c)} <small>${h}</small>
   <span class="ar-actions"><button class="ar-discret" disabled>Ouvrir</button><button class="ar-discret">Examiner</button></span></li>`).join('')}
 </ul>
 <p class="ar-liste-note">Verts à contrôler <small>calculés à la fin du lot</small></p>
</details>`;

const avance = arret => `
<section class="ar-avance" aria-label="Avancement du lot">
 <p class="ar-avance-tete"><span>Lot du cut ${n(LOT.debut)} au cut ${n(LOT.fin)}</span><b>${POURCENT} %</b></p>
 <div class="ar-barre"${arret ? ' data-arret' : ''} role="progressbar" aria-valuenow="${POURCENT}" aria-valuemin="0" aria-valuemax="100"><i style="width:${POURCENT}%"></i></div>
</section>`;

const props = lignes => `
<dl class="ar-props">${lignes.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

const ECRANS = {
  cours: { titre: 'Lot en cours', html: ouverte => `
<main class="ar-principal">
 <section class="ar-etat" aria-live="polite">
  <span class="ar-signe ar-signe-cours" aria-hidden="true"></span><h1>En cours</h1>
  <p>Pose du cut ${n(LOT.enCours)}</p>
 </section>${avance(false)}${props([
    ['Traités', n(LOT.traites)], ['Posés', n(LOT.poses)],
    ['Rythme', `${n('7,9')} cuts par minute`], ['Médiane', `${n('7,6 s')} par cut`]])}${liste(ouverte)}
</main>
<footer class="ar-pied">
 <button class="ar-bouton ar-bouton-principal">Pause</button>
 <button class="ar-bouton">Arrêter le lot</button>
</footer>` },
  toi: { titre: 'Rail non résolu', html: ouverte => `
<main class="ar-principal">
 <section class="ar-etat" aria-live="assertive">
  <span class="ar-signe ar-signe-toi" aria-hidden="true"></span><h1>À toi</h1>
  <p>Partie ${n(LOT.partie)} · après le cut ${n(LOT.enCours - 1)}</p>
 </section>
 <section class="ar-avis">
  <p>Le cut ${n(LOT.enCours)} a un rail qu’Ariane ne sait pas poser. Réessaie, ou reprends-le à la main.</p>
  <div class="ar-actions">
   <button class="ar-bouton ar-bouton-principal">Réessayer ce cut</button>
   <button class="ar-bouton">Reprise manuelle</button>
  </div>
 </section>${avance(true)}${props([['Traités', n(LOT.traites)], ['Posés', n(LOT.poses)]])}${liste(ouverte)}
</main>
<footer class="ar-pied">
 <button class="ar-bouton">Arrêter le lot</button>
</footer>` },
};

const ecran = (id, ouverte) => `<div class="ar" data-theme="sombre" data-ecran="${id}"><div class="ar-corps-ecran">${tete()}${ECRANS[id].html(ouverte)}</div></div>`;

/* ---------- La page ---------- */
const lire = f => fs.readFileSync(path.join(ICI, f), 'utf8');
const image = (theme, taille, id) => {
  const f = path.join(CAPTURES, `${theme}-${taille}-${id}.png`);
  return `<img data-theme="${theme}" data-taille="${taille}" alt="Le panneau d'aujourd'hui, ${ECRANS[id].titre.toLowerCase()}, ${theme}, ${taille} px" src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"${theme === 'sombre' && taille === '360' ? '' : ' hidden'}>`;
};
const aujourdhui = id => CAPTURES
  ? `<figure class="pg-fig"><figcaption>Aujourd’hui</figcaption><div class="pg-defile"><div class="pg-cadre" data-taille="360">${['sombre', 'clair'].flatMap(t => ['360', '600'].map(s => image(t, s, id))).join('')}</div></div></figure>`
  : '';

const rang = id => `
<section class="pg-rang" id="ecran-${id}">
 <h2>${ECRANS[id].titre}</h2>
 <div class="pg-paire">
  <figure class="pg-fig"><figcaption>Proposition</figcaption><div class="pg-defile"><div class="pg-cadre" data-taille="360">${ecran(id, false)}</div></div></figure>
  ${aujourdhui(id)}
 </div>
</section>`;

const COULEURS = [['fond', 'Fond'], ['surface', 'Surface'], ['trait-fort', 'Trait'], ['texte-3', 'Texte 3'], ['texte-2', 'Texte 2'], ['texte', 'Texte'], ['a-toi', 'À toi']];
const planche = () => `
<section class="pg-rang" id="systeme">
 <h2>Le système</h2>
 <div class="ar pg-planche" data-theme="sombre">
  <div class="pg-pl-bloc"><h3>Couleurs</h3><div class="pg-pastilles">${COULEURS.map(([v, nom]) => `<span><i style="background:var(--ar-${v})"></i>${nom}</span>`).join('')}</div></div>
  <div class="pg-pl-bloc"><h3>Texte · Inter</h3>
   <p style="font-size:17px;line-height:24px;font-weight:590;letter-spacing:-.015em">État 17 · 590</p>
   <p style="font-size:13px;line-height:20px">Corps 13 · 400 <span class="n" style="font-weight:510">4812</span></p>
   <p style="font-size:12px;line-height:16px;color:var(--ar-texte-2)">Détail 12 · 400</p>
   <p style="font-size:11px;line-height:16px;font-weight:510;letter-spacing:.04em;text-transform:uppercase;color:var(--ar-texte-2)">Section 11 · 510</p></div>
  <div class="pg-pl-bloc"><h3>Boutons</h3><div class="ar-actions"><button class="ar-bouton ar-bouton-principal">Principal</button><button class="ar-bouton">Secondaire</button><button class="ar-discret">Discret</button></div>
   <h3>Onglets</h3><div class="ar-onglets"><button class="ar-onglet" aria-selected="true">Orbite</button><button class="ar-onglet" aria-selected="false">Écho</button><button class="ar-onglet" aria-selected="false">Aurore</button></div></div>
  <div class="pg-pl-bloc"><h3>Signes d’état</h3><p class="pg-signes"><span class="ar-signe ar-signe-cours"></span>En cours<span class="ar-signe ar-signe-toi"></span>À toi</p>
   <h3>Espacements · rayons</h3><p style="color:var(--ar-texte-2)">4 · 8 · 12 · 16 · 24 &nbsp;—&nbsp; 6 · 8</p></div>
 </div>
</section>`;

const STYLE_PAGE = `
/* Page de présentation : sobre, elle s'efface devant les deux écrans. Deux colonnes : la proposition, puis l'existant. */
:root { --pg-fond: #f4f4f2; --pg-texte: #1a1a18; --pg-texte-2: #5a5a55; --pg-trait: #dcdcd8; --pg-surface: #fcfcfb; --pg-actif: #1a1a18; --pg-actif-texte: #fcfcfb;
  --pg-police: "Inter Ariane", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --pg-fond: #050505; --pg-texte: #ededea; --pg-texte-2: #a4a49f; --pg-trait: #2a2a27; --pg-surface: #121211; --pg-actif: #e9e9e6; --pg-actif-texte: #0d0d0c; color-scheme: dark; } }
:root[data-theme="dark"] { --pg-fond: #050505; --pg-texte: #ededea; --pg-texte-2: #a4a49f; --pg-trait: #2a2a27; --pg-surface: #121211; --pg-actif: #e9e9e6; --pg-actif-texte: #0d0d0c; color-scheme: dark; }
body { background: var(--pg-fond); color: var(--pg-texte); font: 400 15px/24px var(--pg-police); letter-spacing: -.01em; -webkit-font-smoothing: antialiased; }
.pg { max-width: 1280px; margin: 0 auto; padding-block: 40px 72px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 40px; }
.pg-intro { display: flex; flex-direction: column; gap: 12px; max-width: 62ch; }
.pg-intro h1 { margin: 0; font-size: 28px; line-height: 34px; font-weight: 590; letter-spacing: -.022em; text-wrap: balance; }
.pg-intro p { margin: 0; color: var(--pg-texte-2); text-wrap: pretty; }
.pg-rang > h2 { margin: 0; font-size: 17px; line-height: 24px; font-weight: 590; letter-spacing: -.015em; }
.pg-choix { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; display: flex; flex-wrap: wrap; gap: 8px 16px; padding-block: 10px; background: var(--pg-fond); border-bottom: 1px solid var(--pg-trait); }
.pg-seg { display: inline-flex; padding: 2px; gap: 2px; border: 1px solid var(--pg-trait); border-radius: 8px; background: var(--pg-surface); }
.pg-seg button { height: 28px; padding: 0 12px; border: 0; border-radius: 6px; background: none; color: var(--pg-texte-2); font: 510 13px/20px var(--pg-police); cursor: pointer; font-variant-numeric: tabular-nums; }
.pg-seg button[aria-pressed="true"] { background: var(--pg-actif); color: var(--pg-actif-texte); }
.pg-seg button:focus-visible { outline: 2px solid var(--pg-texte-2); outline-offset: 1px; }
.pg-rang { display: flex; flex-direction: column; gap: 16px; }
.pg-paire { display: flex; flex-wrap: wrap; gap: 24px 32px; align-items: flex-start; }
.pg-fig { margin: 0; min-width: 0; max-width: 100%; display: flex; flex-direction: column; gap: 8px; }
.pg-fig figcaption { font-size: 12px; line-height: 16px; font-weight: 510; letter-spacing: .04em; text-transform: uppercase; color: var(--pg-texte-2); }
.pg-defile { max-width: 100%; overflow-x: auto; }
.pg-cadre { width: 360px; height: 480px; border: 1px solid var(--pg-trait); border-radius: 10px; overflow: hidden; }
.pg-cadre[data-taille="600"] { width: 600px; height: 760px; }
.pg-cadre img { display: block; width: 100%; height: 100%; max-width: none; }
.pg-planche { height: auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px 32px; padding: 24px; border: 1px solid var(--pg-trait); border-radius: 10px; font-size: 13px; line-height: 20px; letter-spacing: -.01em; }
.pg-pl-bloc { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.pg-pl-bloc h3 { margin: 0; font-size: 11px; line-height: 16px; font-weight: 510; letter-spacing: .04em; text-transform: uppercase; color: var(--ar-texte-3); }
.pg-pl-bloc h3:not(:first-child) { margin-top: 8px; }
.pg-pastilles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; color: var(--ar-texte-2); font-size: 12px; }
.pg-pastilles span { display: flex; align-items: center; gap: 8px; }
.pg-pastilles i { width: 20px; height: 20px; border-radius: 6px; border: 1px solid var(--ar-trait-fort); }
.pg-signes { display: flex; align-items: center; gap: 8px; }
.pg-signes .ar-signe-toi { margin-left: 12px; }
`;

const SCRIPT = `
(function () {
  var etat = { theme: 'sombre', taille: '360' };
  function appliquer() {
    document.querySelectorAll('.ar').forEach(function (e) { e.dataset.theme = etat.theme; });
    document.querySelectorAll('.pg-cadre').forEach(function (e) { e.dataset.taille = etat.taille; });
    document.querySelectorAll('.pg-cadre img').forEach(function (e) { e.hidden = !(e.dataset.theme === etat.theme && e.dataset.taille === etat.taille); });
    document.querySelectorAll('.ar-liste').forEach(function (e) { e.open = etat.taille === '600'; });
    document.querySelectorAll('.pg-seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(etat[b.dataset.cle] === b.dataset.valeur)); });
  }
  document.querySelectorAll('.pg-seg button').forEach(function (b) {
    b.addEventListener('click', function () { etat[b.dataset.cle] = b.dataset.valeur; appliquer(); });
  });
  /* maquette : un onglet se sélectionne, un menu se ferme quand on clique ailleurs */
  document.addEventListener('click', function (ev) {
    var o = ev.target.closest('.ar-onglet');
    if (o) o.parentElement.querySelectorAll('.ar-onglet').forEach(function (x) { x.setAttribute('aria-selected', String(x === o)); });
    document.querySelectorAll('.ar-menu[open]').forEach(function (m) { if (!m.contains(ev.target) || ev.target.closest('.ar-menu-liste button')) m.open = false; });
  });
  appliquer();
})();
`;

const corps = `
<div class="pg">
 <header class="pg-intro">
  <h1>Le panneau d’Ariane, d’après Linear et Cursor</h1>
  <p>Une seule proposition : une police, des gris, et une seule couleur, l’orange, qui n’apparaît que lorsque c’est à toi. Les deux écrans sont vivants : le menu, la liste « À poser » et les survols répondent. Le panneau d’aujourd’hui est à côté, dans le même état.</p>
 </header>
 <nav class="pg-choix" aria-label="Affichage">
  <span class="pg-seg" role="group" aria-label="Taille"><button id="ta-360" data-cle="taille" data-valeur="360" aria-pressed="true">360 × 480</button><button id="ta-600" data-cle="taille" data-valeur="600" aria-pressed="false">600 × 760</button></span>
  <span class="pg-seg" role="group" aria-label="Thème"><button id="th-sombre" data-cle="theme" data-valeur="sombre" aria-pressed="true">Sombre</button><button id="th-clair" data-cle="theme" data-valeur="clair" aria-pressed="false">Clair</button></span>
 </nav>
 ${rang('cours')}
 ${rang('toi')}
 ${planche()}
</div>`;

const TITRE = 'Panneau Ariane';
let page;
if (CAPTURES) {
  const police = fs.readFileSync(path.join(ICI, 'fonts/InterVariable.woff2')).toString('base64');
  const variables = lire('variables.css').replace('url("fonts/InterVariable.woff2")', () => `url("data:font/woff2;base64,${police}")`);
  page = `<title>${TITRE}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>${variables}\n${lire("ariane.css")}\n${STYLE_PAGE}</style>\n${corps}\n<script>${SCRIPT}</script>\n`;
} else {
  page = `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${TITRE}</title>\n<link rel="stylesheet" href="variables.css"><link rel="stylesheet" href="ariane.css">\n<style>${STYLE_PAGE}</style></head>\n<body>${corps}\n<script>${SCRIPT}</script>\n</body></html>\n`;
}
fs.writeFileSync(SORTIE, page);
console.log(SORTIE, Math.round(page.length / 1024) + ' Ko');

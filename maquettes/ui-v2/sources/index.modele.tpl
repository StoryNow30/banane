<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ariane ui-v2, comparaison</title>
<!-- Fichier assemblé par sources/construire.cjs depuis sources/index.modele.tpl. -->
<style>
/* Page de comparaison volontairement neutre : elle ne doit pas peser sur les maquettes. */
:root{--fond:#F2F2F0;--carte:#FFFFFF;--texte:#161616;--texte-2:#555;--bord:#D6D6D2;--plein:#161616;--sur-plein:#FFF}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--fond:#121212;--carte:#1B1B1B;--texte:#EDEDED;--texte-2:#A8A8A8;--bord:#2E2E2E;--plein:#EDEDED;--sur-plein:#121212}}
:root[data-theme="dark"]{--fond:#121212;--carte:#1B1B1B;--texte:#EDEDED;--texte-2:#A8A8A8;--bord:#2E2E2E;--plein:#EDEDED;--sur-plein:#121212}
*{box-sizing:border-box}
body{margin:0;background:var(--fond);color:var(--texte);font:15px/1.5 system-ui,sans-serif}
header{position:sticky;top:0;z-index:3;background:var(--fond);border-bottom:1px solid var(--bord);padding:12px 16px}
header h1{font-size:18px;margin:0 0 6px}
header p{margin:0 0 8px;color:var(--texte-2);max-width:70em}
.regles{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
.regles label{display:flex;gap:6px;align-items:center;font-size:14px}
select{font:inherit;color:var(--texte);background:var(--carte);border:1px solid var(--bord);border-radius:6px;padding:4px 6px}
.familles{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.familles button{font:inherit;font-size:13px;border:1px solid var(--bord);background:var(--carte);color:var(--texte);border-radius:999px;padding:4px 10px;cursor:pointer}
.familles button[aria-pressed="true"]{background:var(--plein);color:var(--sur-plein);border-color:var(--plein)}
main{padding:8px 16px 40px}
section h2{font-size:17px;margin:24px 0 2px}
section>p{margin:0 0 10px;color:var(--texte-2)}
.rangee{display:flex;gap:16px;overflow-x:auto;padding-bottom:12px;align-items:flex-start}
.carte{flex:none;background:var(--carte);border:1px solid var(--bord);border-radius:10px;padding:10px;width:calc(var(--w) + 22px)}
.carte h3{font-size:15px;margin:0 0 2px;display:flex;justify-content:space-between;gap:8px}
.carte h3 a{color:var(--texte)}
.carte .src{font-size:12px;color:var(--texte-2);margin:0 0 8px;min-height:3em}
.carte iframe{display:block;width:var(--w);height:760px;border:0;border-radius:6px;background:var(--fond)}
.carte details{font-size:13px;margin-top:8px}
.carte details p{margin:6px 0 0}
</style>
</head>
<body>
<header>
  <h1>Ariane, panneau : propositions neuves (CH-014)</h1>
  <p id="resume"></p>
  <div class="regles">
    <label>Scène <select id="scene"></select></label>
    <label>Thème <select id="theme"><option value="auto">système</option><option value="light">clair</option><option value="dark">sombre</option></select></label>
    <label>Largeur <select id="largeur"><option value="360">360 px</option><option value="420" selected>420 px</option><option value="600">600 px</option></select></label>
    <label>Mouvement <select id="mouvement"><option value="systeme">système</option><option value="reduit">réduit</option></select></label>
  </div>
  <div class="familles" id="familles" role="group" aria-label="Familles affichées"></div>
</header>
<main id="liste"></main>
<script>
(function () {
  'use strict';
  const D = /*DONNEES*/null;
  const SCENES = [['pret', 'Prêt'], ['encours', 'En cours'], ['encours-inconnu', 'En cours, total inconnu'], ['pause', 'En pause'], ['arrete', 'Arrêté au milieu'], ['fin', 'Fin de lot'], ['reste', 'Ce qui reste'], ['examen', 'Examiner un cut'], ['pret-absent', 'ESV non connecté'], ['pret-onglet', 'Onglet à choisir'], ['reprise', 'Reprise après rechargement'], ['pret-file', 'File : réglage'], ['file-encours', 'File : partie 2 sur 3'], ['file-relecture', 'File : relecture'], ['file-alerte-page', 'File : alerte page figée'], ['file-alerte-onglet', 'File : alerte onglet fermé'], ['file-alerte-muet', 'File : alerte ESV muet'], ['file-alerte-refus', 'File : alerte refus'], ['file-fin', 'File : fin'], ['echo', 'Écho']];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sel = document.getElementById('scene');
  sel.innerHTML = SCENES.map(([v, t]) => `<option value="${v}"${v === 'encours' ? ' selected' : ''}>${t}</option>`).join('');
  const r = () => ({ scene: sel.value, theme: document.getElementById('theme').value, largeur: document.getElementById('largeur').value, mouvement: document.getElementById('mouvement').value });
  document.getElementById('resume').textContent = `${D.maquettes.length} propositions jouables, en ${D.familles.filter((f) => D.maquettes.some((m) => m.famille === f.titre)).length} familles de conception. Les réglages ci-dessous s'appliquent à toutes ; chaque titre ouvre la maquette seule, avec sa régie et ses notes.`;
  const actives = new Set(D.familles.map((f) => f.titre));
  const fam = document.getElementById('familles');
  function boutonsFamilles() {
    fam.innerHTML = D.familles.filter((f) => D.maquettes.some((m) => m.famille === f.titre)).map((f) => `<button aria-pressed="${actives.has(f.titre)}" data-f="${esc(f.titre)}">${esc(f.titre)} (${D.maquettes.filter((m) => m.famille === f.titre).length})</button>`).join('');
  }
  fam.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const f = b.dataset.f; actives.has(f) ? actives.delete(f) : actives.add(f); boutonsFamilles(); dessiner(); });
  function src(m) { const x = r(); return `${m.nom}.html?regie=0&seul=1&s=${x.scene}&t=${x.theme}&w=${x.largeur}&m=${x.mouvement}`; }
  function dessiner() {
    const x = r();
    document.documentElement.style.setProperty('--w', x.largeur + 'px');
    if (x.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', x.theme);
    document.getElementById('liste').innerHTML = D.familles.filter((f) => actives.has(f.titre)).map((f) => {
      const ms = D.maquettes.filter((m) => m.famille === f.titre);
      if (!ms.length) return '';
      return `<section><h2>${esc(f.titre)}</h2><p>${esc(f.desc)}</p><div class="rangee">${ms.map((m) => `<article class="carte"><h3><a href="${m.nom}.html">${esc(m.titre)}</a></h3><p class="src">${esc(m.source.slice(0, 180))}${m.source.length > 180 ? '…' : ''}</p><iframe loading="lazy" title="${esc(m.titre)}" src="${src(m)}"></iframe><details><summary>Ce que ça veut dire</summary><p>${esc(m.sens)}</p></details></article>`).join('')}</div></section>`;
    }).join('');
  }
  function appliquer() { document.querySelectorAll('iframe').forEach((f) => { try { f.contentWindow.postMessage({ ui2: r() }, '*'); } catch (e) { /* cadre pas encore chargé */ } }); const x = r(); document.documentElement.style.setProperty('--w', x.largeur + 'px'); if (x.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', x.theme); }
  ['scene', 'theme', 'largeur', 'mouvement'].forEach((id) => document.getElementById(id).addEventListener('change', appliquer));
  document.addEventListener('load', (e) => { if (e.target.tagName === 'IFRAME') e.target.contentWindow.postMessage({ ui2: r() }, '*'); }, true);
  boutonsFamilles(); dessiner();
})();
</script>
</body>
</html>

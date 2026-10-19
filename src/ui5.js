/* 4.9.5 test 10-ui : HABILLAGE DU PANNEAU, partie navigateur.
 *
 * `panel.js` reste le moteur de la page : connexion à ESV, lecture de l'état, rendu de ses propres éléments, exports, vidage automatique
 * d'Écho. Ce fichier ne remplace rien : après chaque rendu du panneau (`ArianePanel.apres`), il lit l'état et les libellés que le panneau
 * vient d'écrire (un INSTANTANÉ), dessine l'une des trois présentations (src/ui5-rendu.js) et, quand on clique dessus, CLIQUE le bouton
 * d'origine du panneau (`data-act="legacy:<id>"`). Conséquences voulues :
 *   - aucune commande ni aucun export de plus ou de moins : c'est le même gestionnaire qui répond ;
 *   - AUCUN message au service worker depuis ce fichier (un essai le vérifie sur le source) ; il écrit seulement son propre choix
 *     d'interface (`banane50Interface`) dans chrome.storage.local, et demande la taille de sa fenêtre à chrome.windows ;
 *   - l'ancien panneau reste entier, une case de Réglages (ou « Ancien panneau ») le rend.
 * Les choix « après le lot », « clic », « grappe », « raison » sont ceux du panneau : un clic sur la case ou le bouton radio d'origine. */
(function (root) {
  'use strict';
  const D = root.document, R = root.ArianeUi5Rendu, CLE = 'banane50Interface';
  if (!D || !R || !root.ArianePanel) return;
  const defaut = R.VARIANTES.includes(root.ARIANE_UI5?.defaut) ? root.ARIANE_UI5.defaut : 'linear';
  const TAILLE = { linear: [1120, 760], raycast: [900, 660], figma: [1120, 760], ancienne: [560, 820] };
  const ui = { sel: null, palette: false, q: '', pi: 0, last: '', focusQ: false };
  let variante = defaut, ecran = 'seance', hote = null, gcv2Base = null, nbRows = 0;
  const $ = id => D.getElementById(id);
  const txt = id => { const e = $(id); return e ? String(e.textContent || '').trim() : ''; };
  const visible = id => { const e = $(id); return !!e && !e.hidden; };

  /* ---------------------------------------------------------------- instantané */
  const ORDRE_ORBITE = ['start-batch', 'resume', 'retry', 'manual-takeover', 'manual-completion', 'close-uncertain', 'pause', 'export-tout', 'new-batch', 'relecture-acquitter', 'relecture-arreter', 'relecture-lancer', 'explicit-skip', 'stop'];
  const ORDRE_ECHO = ['native-resume', 'native-end', 'native-download', 'native-start', 'native-pause', 'native-discard'];
  const tonClasse = id => { const c = String($(id)?.className || ''); return /\bred\b/.test(c) ? 'red' : /\bamber\b/.test(c) ? 'amber' : /\blive\b/.test(c) ? 'live' : 'ink'; };
  const coche = (ids) => { for (const [v, id] of ids) if ($(id)?.checked) return v; return null; };
  const entier = v => Number.isFinite(Number(v)) ? String(Math.trunc(Number(v))) : '—';

  function boutons(mode) {
    const ordre = mode === 'native' ? ORDRE_ECHO : mode === 'automatic' ? ORDRE_ORBITE : [];
    const out = [];
    for (const id of ordre) {
      const e = $(id); if (!e || e.hidden) continue;
      const c = String(e.className || '');
      out.push({ id, texte: String(e.textContent || '').trim(), role: /\bprimary\b/.test(c) ? 'primary' : /\bdanger\b/.test(c) ? 'danger' : 'link', actif: !e.disabled });
    }
    return out;
  }
  function lignesLot(s) {
    const A = root.ArianePanel, b = s?.batch;
    if (!b) return { rows: [], aPoser: 0 };
    let v; try { v = A.voieDuLot(s); } catch { return { rows: [], aPoser: 0 }; }
    const rows = [];
    v.cuts.forEach((c, i) => {
      const k = v.classe(c);
      const statut = k === 'actuel' ? 'cours' : k === 'incertain' ? 'incertain' : k === 'moteur' ? 'pose' : k === 'voie-l' ? 'voie' : k === 'differe' ? 'differe' : k === 'skip' ? 'saute' : k === 'main' ? 'main' : null;
      if (!statut) return;
      const e = v.ecart(c);
      const texte = { cours: 'Pose des rails', incertain: 'Résultat à contrôler', pose: 'Posé par le moteur', voie: 'Posé par la voie', differe: 'Différé', saute: 'SKIP', main: 'Repris à la main' }[statut];
      rows.push({ cut: entier(c), statut, texte, ecart: e === null ? '' : `${Math.round(e * 10) / 10} mm`, ordre: i });
    });
    /* La plus récente d'abord dans chaque groupe (lecture d'une liste de tâches). */
    rows.sort((x, y) => y.ordre - x.ordre);
    rows.forEach((r, i) => { r.rang = i; });
    let aPoser = 0;
    try { const f = A.travailDuLot(b); if (f && Number.isFinite(f.invalides)) aPoser = Math.max(0, f.invalides - (b.processed?.length || 0)); } catch { /* inconnu */ }
    return { rows, aPoser };
  }
  function lignesEcho(s) {
    const A = root.ArianePanel; let vis = [];
    try { vis = A.visitesNatif(s?.native) || []; } catch { /* aucune */ }
    const corr = x => /^VALIDATE_CORRECTED/.test(String(x.label || ''));
    const dur = x => x.d === null || x.d === undefined ? '' : x.encours ? 'en cours' : `${Math.round(x.d)} s`;
    const texte = x => x.encours ? 'Visite en cours' : /^VALIDATE_CORRECTED_BOTH/.test(x.label) ? 'Corrigé · 2 rails' : corr(x) ? 'Corrigé · 1 rail' : x.label === 'VALIDATE_NO_MOVEMENT' ? 'Validé tel quel' : x.label === 'SKIP' ? 'SKIP' : 'Visité';
    return { echoRows: vis.slice(-40).reverse().map(x => ({ cut: entier(x.c), texte: texte(x), corrige: corr(x), duree: dur(x) })), corriges: vis.filter(corr).length };
  }
  function instantane(s) {
    const A = root.ArianePanel, mode = D.body?.dataset?.window || 'home', id = s?.current?.identity;
    const compteurs = [];
    if (visible('lot-compteurs')) for (const t of ($('lot-compteurs').querySelectorAll?.('.tuile') || []))
      compteurs.push({ label: String(t.querySelector('.lbl')?.textContent || ''), valeur: String(t.querySelector('b')?.textContent || ''), sous: String(t.querySelector('small')?.textContent || '') });
    const fill = $('lot-progres-fill')?.style?.width, pct = visible('lot-progres') && fill ? parseFloat(fill) : null;
    const lot = lignesLot(s), echo = lignesEcho(s), n = $('tabs');
    const rg = {
      relecture: coche([['coupee', 'relecture-coupee'], ['ombre', 'relecture-ombre'], ['corriger', 'relecture-corriger']]),
      clic: coche([['tel-quel', 'clic-tel-quel'], ['gauche-recentre', 'clic-gauche-recentre'], ['tout-recentre', 'clic-tout-recentre']]),
      grappe: !!$('grappe-differes')?.checked, raison: !!$('raison-actif')?.checked,
      touches: coche([['chiffres', 'raison-touches-chiffres'], ['alt-chiffres', 'raison-touches-alt-chiffres'], ['pave', 'raison-touches-pave']]),
      bandeau: $('bandeau-toggle')?.getAttribute?.('aria-pressed') === 'true',
    };
    return {
      variante, mode, contexte: txt('context'), partie: id?.part ?? null, cutEsv: id?.cut ?? null,
      notice: { texte: txt('notice'), erreur: !!$('notice')?.classList?.contains('error') },
      avisContrat: visible('avis-contrat') ? txt('avis-contrat') : '',
      connexionOuverte: !!$('connection')?.open,
      boutons: boutons(mode),
      lot: { etat: txt('lot-etat'), ton: tonClasse('lot-etat'), cut: txt('lot-cut') || '—', pct, traites: txt('lot-traites') === '—' ? '' : txt('lot-traites'), traitesUnite: txt('lot-traites-u'), compteurs, finPartie: visible('lot-fin-partie') ? txt('lot-fin-partie') : '' },
      relecture: { ligne: visible('relecture-ligne') ? txt('relecture-ligne') : '', actif: visible('relecture-arreter'), interrompue: visible('relecture-interrompue') ? txt('relecture-interrompue') : '' },
      echo: { etat: visible('native-etat') ? txt('native-etat') : '', ton: tonClasse('native-etat'), visites: txt('native-count') || '0', corriges: echo.corriges },
      rows: lot.rows, aPoser: lot.aPoser, echoRows: echo.echoRows,
      reglages: rg, exportTexte: txt('export-status'),
      onglets: n ? [...(n.options || [])].filter(o => o.value).map(o => ({ valeur: o.value, texte: o.textContent })) : [], ongletChoisi: n?.value || '', connexionNote: txt('tabs-note'),
      gcv2: gcv2Base ? { total: gcv2Base.total, date: gcv2Base.date, session: echo.corriges || 0 } : null,
    };
  }

  /* ---------------------------------------------------------------- dessin */
  const zones = '.liste,.l,.reg,.toile,.insp,.det,.vide';
  function maj(force) {
    if (!hote || variante === 'ancienne') return;
    const s = root.ArianePanel.state(); if (!s) return;
    const snap = instantane(s);
    nbRows = snap.mode === 'native' ? snap.echoRows.length : snap.rows.length + (snap.aPoser || 0);
    const html = R.rendre(variante, snap, ui, ecran);
    if (!force && html === ui.last) return;
    const defil = [...hote.querySelectorAll(zones)].map(e => e.scrollTop);
    ui.last = html; hote.innerHTML = html;
    [...hote.querySelectorAll(zones)].forEach((e, i) => { if (defil[i]) e.scrollTop = defil[i]; });
    const q = $('ui5-q');
    if (q && ui.focusQ) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch { /* sans objet */ } }
  }

  /* ---------------------------------------------------------------- actions */
  function cliquer(id) { const e = $(id); if (e && !e.disabled) e.click(); }
  function choisir(nom, v) {
    if (nom === 'relecture') cliquer('relecture-' + v);
    else if (nom === 'clic') cliquer('clic-' + v);
    else if (nom === 'grappe') { if ((v === 'oui') !== !!$('grappe-differes')?.checked) cliquer('grappe-differes'); }
    else if (nom === 'raison') {
      if (v === 'non') { if ($('raison-actif')?.checked) cliquer('raison-actif'); }
      else { if (!$('raison-actif')?.checked) cliquer('raison-actif'); cliquer('raison-touches-' + v); }
    } else if (nom === 'onglet') { if ($('tabs')) $('tabs').value = v; }
    else if (nom === 'variante') void setVariante(v);
    setTimeout(() => maj(true), 250);
  }
  function agir(act) {
    if (!act) return;
    const [t, v] = [act.split(':')[0], act.slice(act.indexOf(':') + 1)];
    if (t === 'legacy') cliquer(v);
    else if (t === 'mode') { cliquer(v === 'native' ? 'tab-native' : 'tab-automatic'); ecran = 'seance'; ui.sel = null; }
    else if (t === 'ecran') { ecran = v; ui.sel = null; ui.q = ''; ui.palette = false; }
    else if (t === 'variante') void setVariante(v);
    else if (act === 'palette') { ui.palette = !ui.palette; ui.q = ''; ui.pi = 0; }
    else if (act === 'palette:fermer') ui.palette = false;
    maj(true);
    if (ui.palette) { const q = $('ui5-q'); if (q) { ui.focusQ = true; q.focus(); } }
  }

  /* ---------------------------------------------------------------- événements */
  function brancher() {
    hote.addEventListener('click', e => {
      const ligne = e.target.closest?.('[data-row]');
      if (ligne) { ui.sel = Number(ligne.dataset.row) || 0; maj(true); return; }
      const a = e.target.closest?.('[data-act]'); if (!a) return;
      if (a.dataset.act === 'palette:fermer' && e.target.closest('[data-stop]')) return;
      const fermer = a.dataset.fermer === '1';
      if (fermer) ui.palette = false;
      agir(a.dataset.act);
    });
    hote.addEventListener('change', e => { const s = e.target.closest?.('[data-sel]'); if (s) choisir(s.dataset.sel, s.value); });
    hote.addEventListener('input', e => { if (e.target.id === 'ui5-q') { ui.q = e.target.value; ui.pi = 0; maj(true); } });
    hote.addEventListener('focusin', e => { if (e.target.id === 'ui5-q') ui.focusQ = true; });
    hote.addEventListener('focusout', e => { if (e.target.id === 'ui5-q') ui.focusQ = false; });
    D.addEventListener('keydown', e => {
      if (variante === 'ancienne' || !hote || hote.hidden || e.altKey) return;
      const dansChamp = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '');
      const snap = instantane(root.ArianePanel.state() || {}), m = R.modele(snap);
      const cmds = R.filtrer(R.commandes(snap, m), ui.q), recherche = variante === 'raycast' || ui.palette;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (variante === 'raycast') { const q = $('ui5-q'); if (q) q.focus(); } else agir('palette'); return; }
      if (e.ctrlKey || e.metaKey) return;
      if (e.key === 'Escape') { if (ui.palette) agir('palette:fermer'); else if (ui.q) { ui.q = ''; maj(true); } else if (ecran !== 'seance') agir('ecran:seance'); return; }
      if (recherche && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { ui.pi = Math.max(0, Math.min(cmds.length - 1, (ui.pi || 0) + (e.key === 'ArrowDown' ? 1 : -1))); maj(true); e.preventDefault(); return; }
      if (recherche && e.key === 'Enter' && (dansChamp || ui.palette) && ecran === 'seance') { const c = cmds[Math.max(0, Math.min(cmds.length - 1, ui.pi || 0))]; if (c) { ui.palette = false; ui.q = ''; ui.pi = 0; agir(c.act); } e.preventDefault(); return; }
      if (dansChamp) return;
      if (variante === 'raycast' && e.key.length === 1 && /[\p{L}]/u.test(e.key)) { const q = $('ui5-q'); if (q) { q.focus(); } return; }
      const pas = variante === 'figma' ? { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 40, ArrowUp: -40 }[e.key] : { j: 1, k: -1, ArrowDown: 1, ArrowUp: -1 }[e.key];
      if (pas !== undefined && nbRows) { ui.sel = Math.max(0, Math.min(nbRows - 1, (ui.sel ?? 0) + pas)); maj(true); e.preventDefault(); return; }
      if (e.key === 'Enter' && !/^(BUTTON|A)$/.test(e.target?.tagName || '') && m.primaire && m.primaire.actif && ecran === 'seance') { cliquer(m.primaire.id); e.preventDefault(); }
    });
    const essai = $('ui5-essai'); if (essai) essai.onclick = () => void setVariante(defaut);
  }

  /* ---------------------------------------------------------------- variante et fenêtre */
  async function taille() {
    const t = TAILLE[variante]; const W = root.chrome?.windows;
    if (!t || !W?.getCurrent) return;
    try { const w = await W.getCurrent(); if (w?.type === 'popup' && (Math.abs((w.width || 0) - t[0]) > 40 || Math.abs((w.height || 0) - t[1]) > 40)) await W.update(w.id, { width: t[0], height: t[1] }); } catch { /* fenêtre non redimensionnable : sans effet */ }
  }
  function appliquer(v) {
    variante = v;
    D.body.classList.toggle('ui5', v !== 'ancienne');
    if (v !== 'ancienne') hote.className = 'u-' + v;
    hote.hidden = v === 'ancienne';
    if (v !== 'ancienne') maj(true);
    void taille();
  }
  async function setVariante(v) {
    if (v !== 'ancienne' && !R.VARIANTES.includes(v)) return;
    try { await root.chrome?.storage?.local?.set?.({ [CLE]: v }); } catch { /* le choix vaut pour cette fenêtre */ }
    ecran = 'seance'; ui.sel = null; ui.q = ''; ui.palette = false;
    appliquer(v);
  }

  async function init() {
    hote = D.createElement('div'); hote.id = 'ui5'; hote.hidden = true; D.body.appendChild(hote);
    try { const r = await root.chrome?.storage?.local?.get?.(CLE); const v = r?.[CLE]; if (v === 'ancienne' || R.VARIANTES.includes(v)) variante = v; } catch { /* défaut de la version */ }
    try { const f = await fetch(root.chrome.runtime.getURL('datasets/compteur-gcv2.json')); const j = await f.json(); if (Number.isFinite(j?.total)) gcv2Base = { total: j.total, date: String(j.date || '') }; } catch { /* sans compteur */ }
    brancher();
    root.ArianePanel.apres(() => maj(false));
    appliquer(variante);
  }
  void init();
  root.ArianeUi5 = { instantane, agir, setVariante, ui, maj };
})(typeof globalThis !== 'undefined' ? globalThis : this);

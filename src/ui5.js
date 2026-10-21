/* Test 17 : HABILLAGE DU PANNEAU, partie navigateur.
 *
 * `panel.js` reste le moteur de la page : connexion à ESV, lecture de l'état, rendu de ses propres éléments, exports, vidage automatique
 * d'Écho. Ce fichier ne remplace rien : après chaque rendu du panneau (`ArianePanel.apres`), il lit l'état et les libellés que le panneau
 * vient d'écrire (un INSTANTANÉ), dessine la présentation « Ariane » (src/ui5-rendu.js) et, quand on clique dessus, CLIQUE le bouton
 * d'origine du panneau (`data-act="legacy:<id>"`). Conséquences voulues :
 *   - aucune commande ni aucun export de plus ou de moins : c'est le même gestionnaire qui répond ;
 *   - AUCUN message au service worker depuis ce fichier (un essai le vérifie sur le source) ; il écrit seulement son propre choix
 *     d'interface (`banane51Interface`) dans chrome.storage.local, et demande la taille de sa fenêtre à chrome.windows ;
 *   - le panneau d'avant reste celui du départ (src/ui5-variante.js) : « Essayer le nouveau panneau » (pied du panneau) l'habille, « Ancien panneau »
 *     (Réglages) le rend ; le choix est gardé.
 * Les choix « après le lot », « clic », « grappe », « raison » sont ceux du panneau : un clic sur la case ou le bouton radio d'origine. */
(function (root) {
  'use strict';
  const D = root.document, R = root.ArianeUi5Rendu, CLE = 'banane51Interface';
  if (!D || !R || !root.ArianePanel) return;
  const VARIANTES = ['ariane2', 'palette', 'ancienne'], defaut = VARIANTES.includes(root.ARIANE_UI5?.defaut) ? root.ARIANE_UI5.defaut : 'ancienne';
  const TAILLE = { ariane2: [1180, 840], palette: [720, 560], ancienne: [560, 820] };
  const ui = { last: '', pauseLot: null, q: '', pi: 0, focusQ: false };
  let variante = defaut, ecran = 'accueil', hote = null, gcv2Base = null;
  const $ = id => D.getElementById(id);
  const txt = id => { const e = $(id); return e ? String(e.textContent || '').trim() : ''; };
  const visible = id => { const e = $(id); return !!e && !e.hidden; };

  /* ---------------------------------------------------------------- instantané */
  const ORDRE_ORBITE = ['start-batch', 'resume', 'retry', 'manual-takeover', 'manual-completion', 'close-uncertain', 'pause', 'export-tout', 'new-batch', 'relecture-acquitter', 'relecture-arreter', 'relecture-lancer', 'explicit-skip', 'stop'];
  const ORDRE_ECHO = ['native-resume', 'native-end', 'native-download', 'native-start', 'native-pause', 'native-discard'];
  const coche = (ids) => { for (const [v, id] of ids) if ($(id)?.checked) return v; return null; };
  /* « 999999 » est la borne interne « jusqu'à la fin de la partie » (panel.js) ; on ne l'affiche jamais. */
  const FIN_PARTIE = 999999;
  const finVisible = v => { const n = Number(v); return v === '' || v == null || !Number.isFinite(n) || n >= FIN_PARTIE ? null : String(v); };
  const entier = v => Number.isFinite(Number(v)) ? String(Math.trunc(Number(v))) : '—';

  function boutons(mode) {
    const out = [];
    for (const id of mode === 'native' ? ORDRE_ECHO : ORDRE_ORBITE) {
      const e = $(id); if (!e || e.hidden) continue;
      const c = String(e.className || '');
      out.push({ id, texte: String(e.textContent || '').trim(), role: /\bprimary\b/.test(c) ? 'primary' : /\bdanger\b/.test(c) ? 'danger' : 'link', actif: !e.disabled });
    }
    return out;
  }
  /* Statut de chaque cut du lot, dans l'ordre où le lot les a ouverts. */
  const STATUT = { actuel: 'cours', incertain: 'incertain', moteur: 'pose', 'voie-l': 'voie', differe: 'differe', skip: 'saute', main: 'main' };
  function statutsLot(s) {
    if (!s?.batch) return [];
    try { const v = root.ArianePanel.voieDuLot(s); return v.cuts.map(c => STATUT[v.classe(c)]).filter(Boolean); } catch { return []; }
  }
  function lignesEcho(s) {
    const A = root.ArianePanel; let vis = [];
    try { vis = A.visitesNatif(s?.native) || []; } catch { /* aucune */ }
    const corr = x => /^VALIDATE_CORRECTED/.test(String(x.label || ''));
    const dur = x => x.d === null || x.d === undefined ? '' : x.encours ? 'en cours' : `${Math.round(x.d)} s`;
    const texte = x => x.encours ? 'Visite en cours' : /^VALIDATE_CORRECTED_BOTH/.test(x.label) ? 'Corrigé · 2 rails' : corr(x) ? 'Corrigé · 1 rail' : x.label === 'VALIDATE_NO_MOVEMENT' ? 'Validé tel quel' : x.label === 'SKIP' ? 'SKIP' : 'Visité';
    return { echoRows: vis.slice(-40).reverse().map(x => ({ cut: entier(x.c), texte: texte(x), corrige: corr(x), duree: dur(x) })), corriges: vis.filter(corr).length };
  }
  /* Présentation « Ariane » : les chiffres et l'état du lot, d'après fiches/UI_ETATS_COMPTEURS.md. Lecture seule de l'état.
   * « Pause demandée » n'existe pas dans le moteur : c'est le clic sur Pause (gardé ici, pour ce lot) tant que le lot tourne encore. */
  const OUVERT = ['RUNNING', 'PAUSED', 'PAUSED_UNRESOLVED_RAIL', 'PAUSED_DEFER_NAVIGATION_UNCERTAIN', 'PAUSED_AFTER_STATE_MISSING', 'PAUSED_ADAPTER_UNRESPONSIVE', 'MANUAL_TAKEOVER'];
  const cutDe = x => { const n = Number(x?.cut ?? x?.identity?.cut); return Number.isFinite(n) ? Math.trunc(n) : null; };
  const heure = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}` : ''; };
  const RAILS = { left: 'rail gauche', right: 'rail droit' };
  function calculAr(s, statuts) {
    const b = s?.batch || null, A = root.ArianePanel, compte = k => statuts.filter(x => k.includes(x)).length;
    const poses = compte(['pose', 'voie']), differes = compte(['differe']), traites = poses + differes + compte(['saute', 'main']);
    let cibles = null; try { const f = b && A.travailDuLot(b); if (f && Number.isInteger(f.invalides)) cibles = f.invalides; } catch { /* inconnu */ }
    const st = b?.state || null, incertain = !!s?.reconcileRequired;
    if (st !== 'RUNNING' || ui.pauseLot !== b?.id) ui.pauseLot = null;
    let etat = 'pret', etatTexte = '';
    const horsLigne = !b && !s?.current?.identity;
    if (b) {
      if (incertain) { etat = 'alerte'; etatTexte = 'Résultat incertain'; }
      else if (st === 'RUNNING') etat = ui.pauseLot === b.id ? 'dem' : 'cours';
      else if (st === 'PAUSED' && b.pauseReason !== 'low-confidence') etat = 'pause';
      else if (st === 'COMPLETED' || st === 'FINISHED_WITH_UNCONFIRMED_ACTIONS') etat = 'fini';
      else if (st === 'STOPPED') etat = b.stoppedAtEnd ? 'fini' : 'arrete';
      else if (st === 'ERROR') { etat = 'alerte'; etatTexte = 'Erreur du lot'; }
      else { etat = 'alerte'; etatTexte = st === 'PAUSED_ADAPTER_UNRESPONSIVE' ? 'ESV ne répond plus' : st === 'MANUAL_TAKEOVER' ? 'Repris à la main' : 'À toi'; }
    }
    /* La relecture qui suit le lot écrit dans ESV (corriger) : tant qu'elle travaille, le lot n'est pas « terminé » ; le bouton « Arrêter la relecture » du panneau d'avant est visible. */
    if (etat === 'fini' && visible('relecture-arreter')) etat = 'rel';
    /* Phrase de l'incident, d'après l'état (vérifié dans le code : src/engine.js `apply`, `closeUncertain` ; panel.js, « debloquable ») :
     * une opération interrompue bloque toute écriture jusqu'à son archivage ; sans opération en cours, « Reprendre » suffit. */
    const cutI = cutDe(s?.intent?.identity) ?? cutDe(b?.activeIdentity);
    const alerte = !b ? '' : incertain ? `L’opération sur le cut ${cutI ?? '…'} n’a pas été confirmée. Ariane n’y renverra aucune commande : contrôle ce cut dans ESV, puis archive le résultat interrompu.`
      : st === 'PAUSED_ADAPTER_UNRESPONSIVE' ? 'ESV ne répond plus. Si la page ESV reste figée, recharge-la (F5), attends qu’elle réponde, puis clique sur Reprendre.'
      : st === 'PAUSED_UNRESOLVED_RAIL' || b.pauseReason === 'unresolved-rail' ? `Le cut ${cutI ?? '…'} a un rail qu’Ariane ne sait pas poser. Choisis : réessayer, le reprendre à la main, ou le passer.`
      : b.pauseReason === 'low-confidence' ? `Ariane n’est pas assez sûre de sa pose sur le cut ${cutI ?? '…'}. Choisis : réessayer, le reprendre à la main, ou le passer.`
      : st === 'MANUAL_TAKEOVER' ? `Le cut ${cutI ?? '…'} t’est rendu : corrige-le dans ESV, ouvre le cut suivant, puis déclare-le repris à la main.` : '';
    const fin = b?.scope?.end, debut = b?.scope?.start;
    const bornes = b ? { debut: Number.isInteger(debut) ? debut : null, fin: Number.isInteger(fin) && fin < FIN_PARTIE ? fin : null }
      : { debut: $('start')?.value || null, fin: finVisible($('end')?.value) };
    const differesListe = (b?.deferred || []).map(d => {
      const r = Array.isArray(d.unresolvedRails) ? d.unresolvedRails : [];
      return { cut: cutDe(d), motif: r.length ? 'Rail non résolu' : 'Différé', precision: r.length === 2 ? 'les deux rails' : r.length ? (RAILS[r[0]] || '') : '', heure: heure(d.deferredAt) };
    }).filter(d => d.cut !== null).reverse();
    const plages = [...($('verts-plages')?.querySelectorAll?.('li') || [])].map(li => ({ libelle: String(li.querySelector('b')?.textContent || '').trim(), detail: String(li.querySelector('span')?.textContent || '').trim() }));
    const vertsNombre = plages.reduce((n, p) => n + (Number((p.detail.match(/·\s*(\d+)/) || [])[1]) || 0), 0);
    const dernierP = (b?.processed || []).at?.(-1);
    return {
      etat, etatTexte, horsLigne, partie: s?.current?.identity?.part ?? b?.scope?.part ?? null, cutEsv: s?.current?.identity?.cut ?? null,
      cibles, poses, differes, traites, restants: cibles !== null ? Math.max(0, cibles - traites) : null,
      cours: st === 'RUNNING' ? cutDe(b?.activeIdentity) : null, dernier: cutDe(dernierP), bornes, differesListe,
      verts: visible('verts-controle') ? plages : [], vertsNombre: visible('verts-controle') ? vertsNombre : 0, vertsLigne: visible('verts-controle') ? txt('verts-ligne') : '',
      aExaminer: differes + (visible('verts-controle') ? vertsNombre : 0),
      lotOuvert: !!b && (OUVERT.includes(st) || incertain || etat === 'rel'),
      cache: { actif: !!$('export-cache-clear') && !$('export-cache-clear').disabled }, connexionBloquee: !!$('connect')?.disabled,
      echoEtat: { RUNNING: 'Collecte en cours', PAUSED: 'Collecte en pause', STARTING: 'Démarrage de la collecte', PAUSED_ADAPTER_UNRESPONSIVE: 'ESV ne répond plus' }[s?.native?.status] || (s?.native?.visits?.length ? 'Séance à terminer' : 'Aucune séance en cours'),
      alerte, esv: s?.connection?.status === 'unavailable' || st === 'PAUSED_ADAPTER_UNRESPONSIVE' ? 'ko' : s?.current?.identity ? 'ok' : 'non',
      pause: (() => { const e = $('pause'); return e && !e.hidden ? { actif: !e.disabled } : null; })(),
      reprendre: (() => { const e = $('resume'); return e && !e.hidden ? { actif: !e.disabled, texte: String(e.textContent || '').trim() } : null; })(),
    };
  }
  function instantane(s) {
    const statuts = statutsLot(s), echo = lignesEcho(s), n = $('tabs'), mode = D.body?.dataset?.window || 'home';
    const rg = {
      relecture: coche([['coupee', 'relecture-coupee'], ['ombre', 'relecture-ombre'], ['corriger', 'relecture-corriger']]),
      clic: coche([['tel-quel', 'clic-tel-quel'], ['gauche-recentre', 'clic-gauche-recentre'], ['tout-recentre', 'clic-tout-recentre']]),
      grappe: !!$('grappe-differes')?.checked, raison: !!$('raison-actif')?.checked,
      touches: coche([['chiffres', 'raison-touches-chiffres'], ['alt-chiffres', 'raison-touches-alt-chiffres'], ['pave', 'raison-touches-pave']]),
      bandeau: $('bandeau-toggle')?.getAttribute?.('aria-pressed') === 'true',
    };
    return {
      variante,
      notice: { texte: txt('notice'), erreur: !!$('notice')?.classList?.contains('error') },
      avisContrat: visible('avis-contrat') ? txt('avis-contrat') : '',
      connexionOuverte: !!$('connection')?.open,
      mode, boutons: boutons(mode), boutonsOrbite: boutons('automatic'), boutonsEcho: boutons('native'),
      lot: { etat: txt('lot-etat'), finPartie: visible('lot-fin-partie') ? txt('lot-fin-partie') : '' },
      relPause: (() => { try { const P = root.ArianeRelecturePause; return P ? P.vue(P.etat(), { esvMuet: s?.connection?.status === 'unavailable' }) : null; } catch { return null; } })(),
      relecture: { ligne: visible('relecture-ligne') ? txt('relecture-ligne') : '', actif: visible('relecture-arreter'), interrompue: visible('relecture-interrompue') ? txt('relecture-interrompue') : '' },
      echo: { visites: txt('native-count') || '0', corriges: echo.corriges },
      echoRows: echo.echoRows,
      reglages: rg, exportTexte: txt('export-status'),
      onglets: n ? [...(n.options || [])].filter(o => o.value).map(o => ({ valeur: o.value, texte: o.textContent })) : [], ongletChoisi: n?.value || '', connexionNote: txt('tabs-note'),
      gcv2: gcv2Base,
      ar: calculAr(s, statuts),
    };
  }

  /* ---------------------------------------------------------------- dessin */
  const zones = '.ecr,.reg,.defile,.l2';
  function maj(force) {
    if (!hote || variante === 'ancienne') return;
    const s = root.ArianePanel.state(); if (!s) return;
    const html = R.rendre(instantane(s), ecran, ui);
    if (!force && html === ui.last) return;
    const defil = [...hote.querySelectorAll(zones)].map(e => e.scrollTop), fb = D.activeElement?.dataset?.borne, avaitQ = D.activeElement?.id === 'ui5-q';
    ui.last = html; hote.innerHTML = html;
    [...hote.querySelectorAll(zones)].forEach((e, i) => { if (defil[i]) e.scrollTop = defil[i]; });
    if (fb) { const nb = hote.querySelector(`[data-borne="${fb}"]`); if (nb) { nb.focus(); try { nb.setSelectionRange?.(nb.value.length, nb.value.length); } catch { /* nombre */ } } }
    const q = $('ui5-q');
    if (q && (ui.focusQ || avaitQ)) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch { /* sans objet */ } }
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
  function agir(act, depuis) {
    const [type, v] = [act.split(':')[0], act.slice(act.indexOf(':') + 1)];
    if (act === 'pause') { const b = root.ArianePanel.state()?.batch; if (b?.state === 'RUNNING' && $('pause') && !$('pause').disabled) { ui.pauseLot = b.id; cliquer('pause'); } }
    else if (type === 'aller') { aller(v, depuis); return; }
    else if (type === 'legacy') cliquer(v);
    else if (type === 'conn') { if ($('tabs')) $('tabs').value = v; cliquer('connect'); }
    else if (type === 'mode') cliquer(v === 'native' ? 'tab-native' : 'tab-automatic');
    else if (type === 'interface') { void setVariante('ariane2').then(() => { ecran = v; maj(true); }); return; }
    else if (type === 'variante') void setVariante(v);
    maj(true);
  }

  /* ---------------------------------------------------------------- présentation « Ariane » : navigation animée
   * La vignette choisie garde ses repères : son icône et son nom volent jusqu'à l'en-tête de l'activité (et reviennent au retour),
   * pendant que l'écran d'arrivée apparaît. La barre du haut ne bouge pas. Orbite et Écho sont aussi les vues du panneau d'origine :
   * on clique son onglet, comme avant. */
  const reduit = () => { try { return root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch { return false; } };
  function voler(src, dst, ms) {
    const r0 = src.getBoundingClientRect(), r1 = dst.getBoundingClientRect(), c = src.cloneNode(true);
    Object.assign(c.style, { position: 'fixed', left: r0.left + 'px', top: r0.top + 'px', width: r0.width + 'px', height: r0.height + 'px', margin: 0, zIndex: 50, pointerEvents: 'none', transformOrigin: '0 0', whiteSpace: 'nowrap', fontSize: getComputedStyle(src).fontSize, fontWeight: getComputedStyle(src).fontWeight, color: '#fff' });
    D.body.appendChild(c); src.style.opacity = '0'; dst.style.opacity = '0';
    const k = src.classList.contains('picto') ? r1.width / r0.width : parseFloat(getComputedStyle(dst).fontSize) / parseFloat(getComputedStyle(src).fontSize);
    c.animate([{ transform: 'none' }, { transform: `translate(${r1.left - r0.left}px,${r1.top - r0.top}px) scale(${k})` }], { duration: ms, easing: 'cubic-bezier(.22,.8,.18,1)', fill: 'forwards' });
    setTimeout(() => { dst.style.opacity = ''; c.remove(); }, ms + 20);
  }
  function aller(v, depuis) {
    const avant = ecran, cible = v;
    if (v === 'orbite' && D.body?.dataset?.window !== 'automatic') cliquer('tab-automatic');
    if (v === 'echo' && D.body?.dataset?.window !== 'native') cliquer('tab-native');
    const carte = depuis?.closest?.('.vig') || (cible === 'accueil' ? null : hote.querySelector(`.vig[data-k="${cible}"]`));
    const sP = cible === 'accueil' ? hote.querySelector('.ar-nom .picto, .tete .picto') : carte?.querySelector('.picto');
    const sT = cible === 'accueil' ? hote.querySelector('.ar-nom b, .tete h2') : carte?.querySelector('b');
    const ancien = hote.querySelector('.ecr')?.cloneNode(true);
    ecran = cible; maj(true);
    if (reduit() || avant === cible) return;
    const ecr = hote.querySelector('.ecr'); if (!ecr) return;
    if (ancien) { ancien.querySelector('.haut')?.style.setProperty('visibility', 'hidden'); Object.assign(ancien.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: 40 }); ancien.classList.add('ar-ancien'); hote.querySelector('.app')?.appendChild(ancien); ancien.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out', fill: 'forwards' }).onfinish = () => ancien.remove(); }
    const corps = [...ecr.children].filter(e => !e.matches('.haut'));
    corps.forEach((e, i) => e.animate([{ opacity: 0, transform: `translateY(${cible === 'accueil' ? -8 : 12}px)` }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 100 + i * 40, easing: 'cubic-bezier(.22,.8,.18,1)', fill: 'backwards' }));
    let dP, dT;
    if (cible === 'accueil') { const c = hote.querySelector(`.vig[data-k="${avant}"]`); dP = c?.querySelector('.picto'); dT = c?.querySelector('b'); }
    else { dP = hote.querySelector('.ar-nom .picto, .tete .picto'); dT = hote.querySelector('.ar-nom b, .tete h2'); }
    const fP = ancien && cible === 'accueil' ? ancien.querySelector('.ar-nom .picto, .tete .picto') : null, fT = ancien && cible === 'accueil' ? ancien.querySelector('.ar-nom b, .tete h2') : null;
    const oP = cible === 'accueil' ? fP : sP, oT = cible === 'accueil' ? fT : sT;
    if (oP && dP) voler(oP, dP, 480);
    if (oT && dT) voler(oT, dT, 480);
  }

  /* ---------------------------------------------------------------- événements */
  function brancher() {
    hote.addEventListener('click', e => { const a = e.target.closest?.('[data-act]'); if (!a) return; if (variante === 'palette') { ui.q = ''; ui.pi = 0; } agir(a.dataset.act, a); });
    hote.addEventListener('change', e => { const s = e.target.closest?.('[data-sel]'); if (s) choisir(s.dataset.sel, s.value); });
    /* bornes du prochain lot : recopiées dans les champs d'origine, que « Démarrer » lit */
    hote.addEventListener('input', e => {
      if (e.target.id === 'ui5-q') { ui.q = e.target.value; ui.pi = 0; maj(true); return; }
      const bo = e.target.dataset?.borne; if (bo && $(bo)) { $(bo).value = e.target.value; $(bo).dispatchEvent(new Event('input', { bubbles: true })); $(bo).dispatchEvent(new Event('change', { bubbles: true })); }
    });
    hote.addEventListener('focusin', e => { if (e.target.id === 'ui5-q') ui.focusQ = true; });
    hote.addEventListener('focusout', e => { if (e.target.id === 'ui5-q') ui.focusQ = false; });
    D.addEventListener('keydown', e => {
      if (variante === 'ancienne' || hote.hidden || e.altKey) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); void setVariante(variante === 'palette' ? 'ariane2' : 'palette'); return; }
      if (variante === 'palette') {
        if (e.ctrlKey || e.metaKey) return;
        const cmds = R.paletteListe(instantane(root.ArianePanel.state() || {}), ui.q), dansChamp = e.target?.id === 'ui5-q';
        if (e.key === 'Escape') { if (ui.q) { ui.q = ''; ui.pi = 0; maj(true); } }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { ui.pi = Math.max(0, Math.min(cmds.length - 1, ui.pi + (e.key === 'ArrowDown' ? 1 : -1))); maj(true); e.preventDefault(); }
        else if (e.key === 'Enter' && dansChamp) { const c = cmds[Math.max(0, Math.min(cmds.length - 1, ui.pi))]; if (c && !c.off) { ui.q = ''; ui.pi = 0; agir(c.act); } e.preventDefault(); }
        else if (!dansChamp && e.key.length === 1 && /[\p{L}]/u.test(e.key)) $('ui5-q')?.focus();
        return;
      }
      const v = e.target?.closest?.('.vig');
      if (v && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { const l = [...hote.querySelectorAll('.vig')], i = l.indexOf(v); l[(i + (e.key === 'ArrowRight' ? 1 : l.length - 1)) % l.length].focus(); e.preventDefault(); }
      else if (e.key === 'Escape' && ecran !== 'accueil' && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '')) aller('accueil');
    });
    const essai = $('ui5-essai'); if (essai) essai.onclick = () => void setVariante('ariane2');
  }

  /* ---------------------------------------------------------------- variante et fenêtre */
  async function taille() {
    const t = TAILLE[variante]; const W = root.chrome?.windows;
    if (!t || !W?.getCurrent) return;
    try { const w = await W.getCurrent(); if (w?.type === 'popup' && (Math.abs((w.width || 0) - t[0]) > 40 || Math.abs((w.height || 0) - t[1]) > 40)) await W.update(w.id, { width: t[0], height: t[1] }); } catch { /* fenêtre non redimensionnable : sans effet */ }
  }
  /* `redimensionner` : à l'ouverture, seule une présentation habillée demande sa taille (le panneau d'avant garde celle que l'opérateur a donnée à la fenêtre) ; un changement de présentation la demande toujours. */
  function appliquer(v, redimensionner) {
    variante = v;
    D.body.classList.toggle('ui5', v !== 'ancienne');
    hote.className = v === 'palette' ? 'u-palette' : 'u-ariane';
    hote.hidden = v === 'ancienne';
    ui.focusQ = v === 'palette';
    maj(true);
    if (redimensionner || v !== 'ancienne') void taille();
  }
  async function setVariante(v) {
    if (!VARIANTES.includes(v)) return;
    try { await root.chrome?.storage?.local?.set?.({ [CLE]: v }); } catch { /* le choix vaut pour cette fenêtre */ }
    ecran = 'accueil'; ui.q = ''; ui.pi = 0;
    appliquer(v, true);
  }

  async function init() {
    hote = D.createElement('div'); hote.id = 'ui5'; hote.hidden = true; D.body.appendChild(hote);
    try { const v = (await root.chrome?.storage?.local?.get?.(CLE))?.[CLE]; if (VARIANTES.includes(v)) variante = v; } catch { /* défaut de la version */ }
    /* Compteur des exemples d'apprentissage (`ariane-compteur-gcv2-v1`, fiches/COMPTEUR_GCV2.md) : les cuts corrigés, tous projets. */
    try { const j = await (await fetch(root.chrome.runtime.getURL('datasets/compteur-gcv2.json'))).json();
      const total = j?.totaux?.tous?.corriges, d = j?.creeLe ? new Date(j.creeLe) : null;
      if (Number.isFinite(total) && d && !isNaN(d)) gcv2Base = { total, date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` }; } catch { /* sans compteur */ }
    brancher();
    root.ArianePanel.apres(() => maj(false));
    appliquer(variante);
  }
  void init();
  root.ArianeUi5 = { instantane, agir, setVariante, maj };
})(typeof globalThis !== 'undefined' ? globalThis : this);

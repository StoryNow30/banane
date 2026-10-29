/* CH-020 : rendu des niveaux 4a, 4b, 4c de la « Frise de lumière » (inclus dans chaque page,
 * après le moteur commun, les réglages et le moteur du faisceau). Le niveau est lu sur la racine
 * (data-niveau). Le contenu est le même pour les trois ; seuls quelques détails s'ajoutent
 * en b et c (repère du cut en cours sur la frise, étapes de la file, fond vivant).
 *
 * Ce qui est montré répond à l'une de trois questions de l'opérateur :
 *   où en est le lot ?   le mot de l'état, le grand nombre, la frise ;
 *   dois-je agir ?       l'incident, le seul bouton plein, la cause d'un arrêt ;
 *   que reste-t-il ?     les marques ○ ◆ de la frise et leur compte, la liste « ce qui reste ».
 * Le reste a été retiré ou fondu (voir chantiers/CH-020.rapport.md). */
(function () {
  'use strict';
  const NIV = document.documentElement.getAttribute('data-niveau') || 'a';
  const riche = NIV !== 'a';
  const { esc } = Demo.D;
  const avChoisi = () => document.documentElement.getAttribute('data-avancement');

  /* ---------- gestes : un bouton plein au plus, le reste en texte ---------- */
  function geste(x, plein) {
    const lib = `<span>${esc(x.libelle)}</span>${x.note ? `<span class="note">${esc(x.note)}</span>` : ''}`;
    const attrs = `data-a="${x.a}"${x.id ? ` data-id="${esc(x.id)}"` : ''}${x.desactive ? ' aria-disabled="true"' : ''}`;
    return plein ? `<button class="b" ${attrs}>${lib}</button>` : `<button class="t${x.confirme ? ' confirme' : ''}" ${attrs}>${x.note ? `${esc(x.libelle)} <span class="note">· ${esc(x.note)}</span>` : esc(x.libelle)}</button>`;
  }
  function gestes(liste) {
    if (!liste || !liste.length) return '';
    const [p, ...r] = liste;
    const plein = p.rang === 'principal';
    const autres = plein ? r : liste;
    const raisons = liste.filter((x) => x.raison).map((x) => `<p class="raison">${esc(x.raison)}</p>`).join('');
    return `<div class="actions">${plein ? geste(p, true) : ''}${raisons}${autres.length ? `<div class="textes">${autres.map((x) => geste(x, false)).join('')}</div>` : ''}</div>`;
  }

  /* ---------- ligne d'état ---------- */
  function activite(m) {
    const bl = m.activiteBloquee ? ' aria-disabled="true" title="Mettre le lot en pause ou l’arrêter avant de changer d’activité"' : '';
    return `<div class="activite" role="group" aria-label="Activité"><button data-a="orbite" aria-pressed="${m.activite === 'orbite'}"${m.activite === 'echo' ? '' : bl}>Orbite</button><button data-a="echo" aria-pressed="${m.activite === 'echo'}"${bl}>Écho</button></div>`;
  }
  function etapes(f) {
    if (NIV !== 'c' || !f.active) return '';
    let s = '';
    for (let i = 1; i <= f.nb; i++) s += `<i class="${f.finie || i < f.courante ? 'fait' : i === f.courante ? 'ici' : ''}"></i>`;
    return `<span class="etapes" aria-hidden="true">${s}</span>`;
  }
  /* heydamir : un seul mot en lumière dans l'écran (« trust » sur son accueil). Ici le mot de
   * l'état, et seulement quand le lot vit ; en 4c. */
  const enLumiere = (m) => NIV === 'c' && (m.phase === 'encours' || m.vue === 'echo') && m.vue !== 'reste' && m.vue !== 'examen';
  function ligne(m, mot, suite, sansActivite) {
    const non = m.liaison.etat !== 'relie' && !m.incident ? `<span class="non"><i aria-hidden="true"></i>${esc(m.liaison.texte)}</span>` : '';
    return `<div class="tete-ligne"><p class="etat">${enLumiere(m) ? `<span class="lumiere">${esc(mot)}</span>` : esc(mot)}${suite ? `<span class="sec">${esc(suite)}</span>` : ''}${etapes(m.file)}${non}</p>${sansActivite ? '' : activite(m)}</div>`;
  }
  const partieTexte = (f) => (f.active && !f.finie ? `partie ${f.courante} sur ${f.nb}` : '');

  /* ---------- carte du lot ---------- */
  function avance(m) {
    const detail = m.vue === 'reste' || m.vue === 'examen';
    const phase = detail ? 'vue' : m.vue === 'echo' ? 'encours' : m.phase;
    const part = detail || m.vue === 'echo' ? '' : m.phase === 'fin' ? 1 : m.compte.part == null ? '' : m.compte.part.toFixed(4);
    return ` data-part="${part}" data-phase="${phase}"`;
  }
  function carte(m, contenu, etiquette) {
    const fa = m.vue === 'reste' || m.vue === 'examen' ? 'absent' : m.phase === 'encours' || m.vue === 'echo' ? 'court' : m.phase === 'pause' ? 'fige' : 'absent';
    const n = m.vue === 'echo' ? m.echo.vus : m.compte.faits;
    const sec = `<section class="lot" data-fx="${fa}" data-faits="${n}"${avance(m)} aria-label="${esc(etiquette)}"><svg class="fx" data-garder="fx" aria-hidden="true"></svg>${contenu}</section>`;
    /* heydamir : double cadre d'appareil, rayons concentriques (dehors = dedans + marge) ; en 4c */
    return NIV === 'c' ? `<div class="appareil">${sec}</div>` : sec;
  }
  const nombre = (n, unite) => `<p class="grand"><span class="n" data-valeur="n">${n}</span><span class="s">${esc(unite)}</span></p>`;
  const sous = (t) => (t ? `<p class="sous">${esc(t)}</p>` : '');

  /* ---------- frise : la règle du lot ---------- */
  function frise(S, m) {
    const c = m.compte, d = c.debut, inconnu = c.total == null;
    const etendue = inconnu ? Math.max(c.faits + 40, 120) : c.total;
    const pos = (cut) => Math.max(0, Math.min(100, (cut - d) / Math.max(1, etendue - 1) * 100));
    const fa = m.phase === 'encours' ? 'court' : m.phase === 'pause' ? 'fige' : m.phase === 'fin' ? 'fin' : 'arret';
    const marques = S.restants.slice().sort((a, b) => a.cut - b.cut);
    const etages = [-99, -99, -99, -99]; let haut = 0;
    const j = marques.map((r) => {
      const x = pos(r.cut); let e = etages.findIndex((v) => x - v >= 7.5); if (e < 0) e = 3; etages[e] = x; haut = Math.max(haut, e);
      const lib = `Cut ${r.cut}, ${r.type === 'vert' ? 'à examiner' : 'différé'} : examiner`;
      return `<button class="marque${r.type === 'vert' ? ' eau' : ''}" data-forme="${r.type === 'vert' ? 'losange' : 'rond'}" style="left:${x.toFixed(2)}%;bottom:${30 + e * 18}px;--tige:${6 + e * 18}px" data-a="examiner" data-id="${r.id}" aria-label="${esc(lib)}" title="${esc(lib)}"></button>`;
    }).join('');
    const av = avChoisi();
    const vraie = m.phase === 'fin' ? 100 : pos(c.cut);
    let fait = vraie, k = 1;
    if (av === 'paliers' && !inconnu) { k = Math.floor(vraie / 100 * 12 + 1e-6); fait = k / 12 * 100; }
    if (av === 'graduation' && !inconnu) { k = Math.floor(vraie / 100 * 48 + 1e-6); fait = k / 48 * 100; }
    const tete = m.phase === 'fin' || (av && av !== 'continu') ? '' : `<span class="tete" style="left:${fait.toFixed(2)}%"${av === 'continu' ? ' data-garder="frise-tete"' : ' data-valeur="tete-frise"'} aria-hidden="true"><span hidden>${c.cut}</span></span>`;
    const ici = !riche || m.phase === 'fin' || vraie < 14 || (!inconnu && vraie > 84) ? '' : `<span class="ici" style="left:${vraie.toFixed(2)}%">${c.cut}</span>`;
    const fin = inconnu ? '<span class="borne f">fin inconnue</span>' : `<span class="borne f">${d + c.total - 1}</span>`;
    const nd = marques.filter((r) => r.type !== 'vert').length, nv = marques.length - nd;
    const clef = marques.length ? `<p class="clef"><span><i class="mq" aria-hidden="true">○</i><b>${nd}</b> différé${nd > 1 ? 's' : ''}</span><span><i class="mq eau" aria-hidden="true">◆</i><b>${nv}</b> à examiner</span></p>` : '';
    return `<div class="regle" data-fx="${fa}" data-av="${av || ''}" data-fait="${fait.toFixed(2)}" style="--k:${Math.max(1, k)};--h-regle:${56 + haut * 18}px" role="group" aria-label="Frise du lot, du cut ${d} ${inconnu ? 'à une fin inconnue' : 'au cut ' + (d + c.total - 1)} ; toucher une marque pour l’examiner">
        <span class="fil${inconnu ? ' ouvert' : ''}"></span>${inconnu ? '<span class="suite" aria-hidden="true"></span>' : ''}
        <span class="fait"${av === 'continu' ? ' data-garder="frise-fait"' : ''} style="width:${fait.toFixed(2)}%"></span>${tete}${j}
        <span class="borne d">${d}</span>${ici}${fin}
      </div>${clef}`;
  }

  /* ---------- incidents ---------- */
  function alerte(titre, texte, acts) {
    const excl = NIV === 'c' ? '<span class="excl" aria-hidden="true">!</span>' : '';
    return `<div class="alerte" role="alert"><h2>${excl}${esc(titre)}</h2><p>${esc(texte)}</p>${acts && acts.length ? gestes(acts) : ''}</div>`;
  }

  /* ---------- scènes ---------- */
  function principal(m, S) {
    const c = m.compte, f = m.file;
    let h = '';
    if (m.vue === 'echo') {
      h += ligne(m, 'Écho', 'Ariane observe, ne pose rien');
      h += carte(m, nombre(m.echo.vus, 'cuts vus') + sous(`${m.echo.accord} mêmes choix sur ${m.echo.vus}${riche && m.echo.dernier ? ` · dernier cut vu ${m.echo.dernier}` : ''}`), 'Écho');
      return h + gestes(m.actions) + message(m);
    }
    if (f.alerte) h += alerte(f.alerte.titre, f.alerte.detail);
    /* craft.md : le texte d'une erreur ne répète pas son bouton */
    const TEXTES = { absent: 'Aucun onglet ESV ne répond dans ce navigateur.', choisir: 'Plusieurs onglets ESV sont ouverts.' };
    if (m.incident && m.incident.type !== 'reprise') h += alerte(m.incident.titre, TEXTES[m.incident.type] || m.incident.texte, m.incident.actions);
    if (m.phase === 'pret') {
      const b = m.bornes;
      const total = b.finDePartie ? 'jusqu’à la fin de la partie' : `${b.fin - b.debut + 1} cuts`;
      h += ligne(m, 'Prêt', '');
      h += carte(m, `<div class="bornes"><label>Premier cut<input data-champ="debut" inputmode="numeric" value="${b.debut}"></label><label>Dernier cut<input data-champ="fin" inputmode="numeric" value="${b.finDePartie ? '' : b.fin}" placeholder="fin"${b.finDePartie ? ' disabled' : ''}></label></div>${sous(total)}<button class="inter" role="switch" aria-checked="${b.finDePartie}" data-a="finDePartie"><span class="r" aria-hidden="true"></span>Jusqu’à la fin de la partie</button>`, 'Prêt');
      /* Règle de kubre : on ne retire pas une fonction pour alléger l'écran ; « Préparer un autre
       * lot » (bornes suivantes) reste, en texte. La raison du bouton grisé n'est pas répétée
       * quand un incident l'explique déjà au-dessus. */
      h += gestes(m.actions.map((x) => (m.incident && x.raison ? { ...x, raison: null } : x)));
      h += `<div class="reglage"><button class="inter" role="switch" aria-checked="${f.active}" data-a="fileBascule"><span class="r" aria-hidden="true"></span>Enchaîner plusieurs parties</button>${f.active ? `<div class="pas"><button data-a="fileMoins" aria-label="Une partie de moins">−</button><output>${f.nb}</output><button data-a="filePlus" aria-label="Une partie de plus">+</button><span>parties, relues une à une</span></div>` : ''}</div>`;
      return h + message(m);
    }
    if (m.phase === 'fin') {
      h += ligne(m, m.titre, f.finie ? `${f.nb} parties` : '');
      h += carte(m, nombre(c.poses, 'posés') + sous(riche ? `${c.faits} cuts traités, du cut ${c.debut} au cut ${c.debut + c.faits - 1}` : '') + frise(S, m), m.titre);
      /* « que reste-t-il ? » passe avant « préparer un autre lot » */
      const acts = m.actions.map((x) => (x.a === 'voirReste' ? { ...x, rang: 'second' } : x));
      const vr = acts.findIndex((x) => x.a === 'voirReste');
      if (vr > 1) acts.splice(1, 0, acts.splice(vr, 1)[0]);
      return h + gestes(acts) + message(m);
    }
    /* en cours, pause, arrêt, relecture */
    let phrase = '';
    if (f.relecture) phrase = `relecture et correction de la partie ${f.courante}`;
    else if (m.phase === 'encours') phrase = riche ? c.tempsTexte : `cut ${c.cut} · ${c.tempsTexte}`;
    else if (m.phase === 'pause') phrase = `au cut ${c.cut}`;
    else if (m.phase === 'arrete') phrase = f.alerte ? `au cut ${c.cut}` : m.incident && m.incident.type === 'reprise' ? `au cut ${c.cut}` : `${(m.phrase.split('.')[0] || '').trim()} · au cut ${c.cut}`;
    h += ligne(m, m.titre, partieTexte(f));
    if (m.incident && m.incident.type === 'reprise') h = h.replace('<div class="tete-ligne">', `<div class="info" role="status"><h2>${esc(m.incident.titre)}</h2><p>${esc(m.incident.texte)}</p></div><div class="tete-ligne">`);
    h += carte(m, nombre(c.faits, `sur ${c.totalTexte}`) + sous(phrase) + frise(S, m), m.titre);
    return h + gestes(m.actions) + message(m);
  }
  const message = (m) => (m.message ? `<p class="message" role="status">${esc(m.message)}</p>` : '');

  function reste(m) {
    const l = m.restants.slice().sort((a, b) => a.cut - b.cut).map((r) => `<li><button class="ligne" data-a="examiner" data-id="${r.id}"><span class="c">${r.cut}</span><span class="g${r.type === 'vert' ? ' eau' : ''}">${r.type === 'vert' ? '◆ à examiner' : '○ différé'}</span><span class="m">${esc(r.motif)}</span></button></li>`).join('');
    return `<div class="tete-ligne"><p class="etat">Ce qui reste<span class="sec">${m.restants.length} cuts</span></p><button class="t" data-a="retour">Retour au lot</button></div>${l ? `<ul class="liste">${l}</ul>` : '<p class="sous" style="margin:0 4px">Rien à reprendre.</p>'}` + message(m);
  }
  function coupe(r) {
    const { pts, rails } = Demo.D.coupe(r.cut, 320);
    const W = 360, H = 190, X = (x) => 14 + (x + 1) / 2 * (W - 28), Z = (z) => 30 - (z + 0.1) * 340;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Coupe du cut ${r.cut}">`;
    for (const [x, z] of pts) s += `<circle cx="${X(x).toFixed(1)}" cy="${Z(z).toFixed(1)}" r="1.2" fill="var(--texte)" opacity=".75"/>`;
    for (const rx of rails) s += `<line x1="${X(rx)}" y1="${Z(-0.16) - 26}" x2="${X(rx)}" y2="${Z(-0.16) + 2}" stroke="var(--eau)" stroke-width="2.5"${r.type === 'vert' ? '' : ' stroke-dasharray="3 4"'}/>`;
    return s + '</svg>';
  }
  function examen(m) {
    const r = m.examen;
    const type = r.type === 'vert' ? '◆ à examiner' : '○ différé';
    return `<div class="tete-ligne"><p class="etat">Cut ${r.cut}<span class="sec">${type}</span></p><button class="t" data-a="voirReste">Retour à la liste</button></div>`
      + carte(m, `<p class="sous" style="margin:0">${esc(r.motif)}. ${r.type === 'vert' ? 'Rails posés, en vert d’eau.' : 'Rien de posé ; places envisagées en tireté.'}</p><div class="coupe">${coupe(r)}</div>`, `Cut ${r.cut}`)
      + gestes([{ a: 'ouvrir', id: r.id, libelle: 'Ouvrir dans ESV', rang: 'principal' }, { a: 'traiter', id: r.id, libelle: 'Marquer comme vu', rang: 'second' }]) + message(m);
  }

  /* ---------- fond : niveau c seulement, deux nappes d'une même lumière, très lentes (30 s) ---------- */
  function fond(t) {
    const cv = document.getElementById('fond');
    if (NIV !== 'c' || !cv) return;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const ctx = cv.getContext('2d'), st = getComputedStyle(document.documentElement);
    const tt = Demo.D.mouvementReduit() ? 0 : t / 30000;
    ctx.fillStyle = st.getPropertyValue('--base'); ctx.fillRect(0, 0, w, h);
    for (const [v, x, y, r] of [['--n1', 0.2 + Math.sin(tt) * 0.15, 0.1, 0.7], ['--n2', 0.8, 0.75 + Math.cos(tt * 0.8) * 0.1, 0.6]]) {
      const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * Math.max(w, h));
      /* vers la même teinte transparente (et non vers un noir transparent, qui grise le dégradé) */
      const c = st.getPropertyValue(v).trim(), rgb = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).join(',');
      g.addColorStop(0, c); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    requestAnimationFrame(fond);
  }

  Faisceau.creer({ cadence: 'fixe', tour: 4.2, traine: riche ? 0.3 : 0.22, mini: 22, rayon: 20 });
  Demo.monter({
    rendre(S, D) { const m = D.modele(); if (m.vue === 'reste') return reste(m); if (m.vue === 'examen' && m.examen) return examen(m); return principal(m, S); },
    /* en « continu », la part et la tête de la frise glissent vers leur nouvelle place */
    apres() {
      const r = document.querySelector('.regle[data-av="continu"]'); if (!r) return;
      const w = r.getAttribute('data-fait') + '%', f = r.querySelector('.fait'), t = r.querySelector('.tete');
      requestAnimationFrame(() => { if (f) f.style.width = w; if (t) t.style.left = w; });
    },
  });
  requestAnimationFrame(fond);
})();

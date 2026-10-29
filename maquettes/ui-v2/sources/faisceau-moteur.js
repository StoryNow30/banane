/* CH-020 : moteur du faisceau, commun aux quatre pistes « Faisceau ».
 * Inclus par construire.cjs à la place de « /*INCLURE:faisceau-moteur.js*\/ ».
 *
 * Le faisceau de la maquette d'origine est un dégradé conique qui tourne autour du centre de la
 * carte : sur un rectangle, sa vitesse le long du bord n'est pas constante, et il ne connaît
 * qu'un tour fixe de 3,2 s. Ici le faisceau est une tête de lumière qui parcourt le périmètre
 * réel de la carte (SVG, longueur mesurée), avec une vitesse, une inertie et une traînée.
 *
 * La carte porte son état en attributs, relus à chaque image :
 *   data-fx     = court | fige | absent | pret | arret | fin | echo | relecture
 *   data-faits  = nombre de cuts traités (pour la cadence « cuts »)
 * et contient <svg class="fx" data-garder="fx" aria-hidden="true"></svg>, que le moteur
 * commun garde d'un rendu à l'autre : le faisceau ne repart jamais à zéro.
 *
 * Options de Faisceau.creer :
 *   cadence  'fixe' (un tour en `tour` secondes) ou 'cuts' (un cran par cut posé, `crans` crans par tour)
 *   traine   longueur de traînée par px/s de vitesse (s) ; 0 = pas de traînée
 *   anneau   true : en fin de lot, la tête achève son tour et ferme un anneau continu
 *   onde     true : à chaque cut posé, un éclat s'étale le long du bord depuis la tête
 *   pause    longueur (px) du trait de lumière qui reste, figé, en pause (0 = la tête seule)
 *   rayon    rayon des coins de la carte (px)
 *   surTete  fonction (x, y, intensite, carte) appelée à chaque image : la lumière sert ailleurs
 * Mouvement réduit : rien ne se déplace ; chaque état garde une forme fixe (tête, segment, anneau).
 *
 * Effet d'avancement (racine data-avancement, posé par faisceau-reglages.js) : « actuel » garde
 * la tête de la piste ; continu, paliers, graduation et matière la remplacent par une mesure de
 * la part faite (data-part de la carte ; vide = total inconnu : l'effet ne montre alors aucune
 * quantité). data-phase de la carte règle la présence : en cours, pause (atténué), arrêté
 * (plus atténué), fin (complet) ; prêt et vues de détail : rien. Les formes propres à un état
 * qui n'est pas une avance (prêt, Écho, relecture de la piste 3) restent celles de la piste. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const N = 26; /* segments de traînée */
  const K = 12; /* paliers */
  const G = 48; /* traits de graduation */

  function el(nom, attrs, parent) {
    const e = document.createElementNS(NS, nom);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const approche = (x, cible, tau, dt) => cible + (x - cible) * Math.exp(-dt / Math.max(tau, 1e-3));

  function creer(opt) {
    const o = Object.assign({ cadence: 'fixe', tour: 3.2, crans: 4, traine: 0.22, anneau: false, onde: false, pause: 0, rayon: 22, selecteur: '.lot', surTete: null, mini: 26 }, opt || {});
    const st = { tete: 0, v: 0, alpha: 0, L: 0, base: null, faits: null, pulse: 0, anneau: 0, mode: null, depuis: 0, P: 0, w: 0, h: 0, cible: 0, souffle: 0, t0: performance.now() };
    let svg = null, geo = null, traits = [], halo = null, tete = null, coeur = null, cercle = null, encoche = null, base = null, onde = null;
    let jauge = null, paliers = [], gradA = null, gradD = null;
    const av = { pa: 0, va: 0, vis: 0, cliquet: -1, allume: [], partPrec: null, r: -1, rAge: 1, niv: 0, vn: 0, cle: '' };

    function construire(s) {
      s.innerHTML = '';
      base = el('rect', { class: 'fx-base' }, s);
      cercle = el('rect', { class: 'fx-anneau' }, s);
      halo = el('rect', { class: 'fx-halo' }, s);
      const g = el('g', { class: 'fx-traine' }, s);
      traits = [];
      for (let i = 0; i < N; i++) traits.push(el('rect', { class: 'fx-trait' }, g));
      encoche = el('rect', { class: 'fx-encoche' }, s);
      tete = el('circle', { class: 'fx-tete', r: 7 }, s);
      coeur = el('circle', { class: 'fx-coeur', r: 2.2 }, s);
      onde = el('rect', { class: 'fx-onde' }, s);
      jauge = el('rect', { class: 'fx-jauge' }, s);
      paliers = [];
      for (let k = 0; k < K; k++) paliers.push(el('rect', { class: 'fx-palier' }, s));
      gradA = el('path', { class: 'fx-grad' }, s);
      gradD = el('path', { class: 'fx-grad-der' }, s);
      geo = base;
      s.setAttribute('data-pret', '1');
      svg = s; st.w = 0;
    }

    function dimensionner(carte) {
      const w = carte.offsetWidth, h = carte.offsetHeight;
      if (w === st.w && h === st.h) return;
      const r = Math.min(o.rayon, h / 2), Pav = st.P;
      for (const e of [base, cercle, halo, encoche, onde, jauge, ...paliers, ...traits]) {
        e.setAttribute('x', 0.75); e.setAttribute('y', 0.75); e.setAttribute('width', Math.max(0, w - 1.5)); e.setAttribute('height', Math.max(0, h - 1.5)); e.setAttribute('rx', r);
      }
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      st.w = w; st.h = h; st.r = r; st.P = geo.getTotalLength(); av.cle = '';
      if (Pav) { st.tete = st.tete / Pav * st.P; st.L = st.L / Pav * st.P; if (st.base != null) st.base = st.base / Pav * st.P; }
    }

    function reduit() { return window.Demo ? Demo.D.mouvementReduit() : matchMedia('(prefers-reduced-motion: reduce)').matches; }

    let dernier = performance.now();
    function image(now) {
      const dt = Math.min(0.1, (now - dernier) / 1000); dernier = now;
      const carte = document.querySelector(o.selecteur);
      const s = carte && carte.querySelector('svg.fx');
      if (s) {
        if (s !== svg || !s.getAttribute('data-pret')) construire(s);
        dimensionner(carte);
        pas(carte, dt, now);
        const prog = avancement(carte, dt, now);
        dessiner(carte, now, prog);
      }
      requestAnimationFrame(image);
    }

    function pas(carte, dt, now) {
      const P = st.P || 1, mode = carte.getAttribute('data-fx') || 'absent', faits = Number(carte.getAttribute('data-faits') || 0);
      /* première image : la tête n'est au départ que si rien n'a encore tourné */
      if (st.mode == null && st.P) st.tete = mode === 'pret' ? 0 : st.P * 0.58;
      if (mode !== st.mode) { st.depuis = now; if (mode === 'court') st.base = null; if (mode === 'fin') st.anneauDepart = st.tete; st.mode = mode; }
      const age = (now - st.depuis) / 1000;
      const R = reduit();
      /* cuts posés : impulsion de lumière (et cran, en cadence « cuts ») */
      if (st.faits != null && faits > st.faits && faits - st.faits < 4) { st.pulse = 1; st.ondeAge = 0; st.ondeX = null; }
      if (st.faits != null && Math.abs(faits - st.faits) >= 4) st.base = null;
      st.faits = faits;
      st.pulse = approche(st.pulse, 0, 0.45, dt);
      if (st.ondeAge != null) st.ondeAge += dt;
      const haut = Math.max(1, st.w - 2 * st.r); /* longueur du bord haut, droite */
      let alphaCible = 1, vCible = 0, L0 = o.mini;
      if (R) {
        /* formes fixes : aucune position ne bouge */
        st.v = 0; st.pulse = 0;
        const fixe = { court: P * 0.58, relecture: P * 0.58, fige: P * 0.58, echo: haut / 2, pret: 0, arret: P * 0.58, fin: P * 0.58, absent: st.tete };
        st.tete = fixe[mode] ?? st.tete;
        st.L = mode === 'court' || mode === 'relecture' ? P * 0.16 : mode === 'echo' ? haut * 0.35 : mode === 'fige' ? o.pause : 0;
        st.alpha = ['absent', 'arret', 'fin'].includes(mode) ? 0 : 1;
        st.anneau = mode === 'fin' && o.anneau ? 1 : 0;
        st.souffle = 1;
        return;
      }
      switch (mode) {
        case 'court':
          if (o.cadence === 'cuts') {
            /* un cran par cut posé : la tête suit une cible qui n'avance qu'à chaque cut ;
             * ressort amorti (ω = 4,2) : elle accélère après un cut et ralentit avant le suivant. */
            if (st.base == null) st.base = st.tete - faits * P / o.crans;
            const T = st.base + faits * P / o.crans, w = 4.2;
            st.v += (w * w * (T - st.tete) - 2 * w * st.v) * dt;
            st.tete += st.v * dt;
          } else {
            vCible = P / o.tour;
            st.v = approche(st.v, vCible, age < 1.2 ? 0.45 : 0.2, dt);
            st.tete += st.v * dt;
          }
          break;
        case 'relecture':
          st.v = approche(st.v, -P / 7, 0.6, dt); st.tete += st.v * dt; break;
        case 'echo': {
          /* balayage d'aller-retour sur le bord haut : Ariane regarde, n'avance pas */
          const c = haut / 2 + Math.sin(((now - st.t0) / 1000) * Math.PI * 2 / 4.2) * haut * 0.36;
          let k = Math.round((st.tete - c) / P); const cible = c + k * P;
          const w = 6; st.v += (w * w * (cible - st.tete) - 2 * w * st.v) * dt; st.tete += st.v * dt;
          L0 = haut * 0.18; break;
        }
        case 'pret': {
          /* la tête rejoint le départ et y attend */
          let k = Math.round(st.tete / P); const cible = k * P; const w = 3.2;
          st.v += (w * w * (cible - st.tete) - 2 * w * st.v) * dt; st.tete += st.v * dt; L0 = 0; break;
        }
        case 'fin':
          if (o.anneau) { st.v = approche(st.v, 0, 0.25, dt); st.tete += st.v * dt; st.anneau = Math.min(1, st.anneau + dt / 1.1); alphaCible = 1 - st.anneau; }
          else { st.v = approche(st.v, 0, 0.3, dt); st.tete += st.v * dt; alphaCible = 0; }
          L0 = 0; break;
        case 'arret': case 'absent':
          st.v = approche(st.v, 0, 0.3, dt); st.tete += st.v * dt; alphaCible = 0; L0 = 0; break;
        case 'fige': default:
          /* pause : la tête freine sur place (inertie), puis respire */
          st.v = approche(st.v, 0, 0.32, dt); st.tete += st.v * dt; L0 = o.pause; break;
      }
      if (mode !== 'fin') st.anneau = Math.max(0, st.anneau - dt / 0.4);
      const Lc = Math.min(P * 0.42, L0 + Math.abs(st.v) * o.traine);
      st.L = approche(st.L, Lc, 0.18, dt);
      st.alpha = approche(st.alpha, alphaCible, alphaCible > st.alpha ? 0.25 : 0.32, dt);
      /* respiration : en attente seulement (pause, prêt), jamais pendant l'avance */
      const lent = Math.abs(st.v) < P * 0.02;
      const per = mode === 'pret' ? 3.4 : 2.4;
      const resp = 0.62 + 0.38 * (0.5 + 0.5 * Math.cos(((now - st.depuis) / 1000) * Math.PI * 2 / per));
      st.souffle = approche(st.souffle, (mode === 'fige' || mode === 'pret') && lent ? resp : 1, 0.15, dt);
    }

    function dessiner(carte, now, prog) {
      const P = st.P || 1, mode = st.mode;
      const mod = (x) => ((x % P) + P) % P;
      const h = mod(st.tete), L = Math.max(0, st.L), seg = L / N;
      const sens = st.v < 0 ? -1 : 1;
      const a = prog ? 0 : st.alpha * st.souffle;
      /* traînée : N traits empilés qui partent tous de la tête, de plus en plus longs, fins et
       * pâles ; leurs opacités se cumulent près de la tête : dégradé et effilement sans couture */
      for (let i = 0; i < N; i++) {
        const t = traits[i];
        if (seg < 0.5 || a < 0.01) { t.style.opacity = 0; continue; }
        const lg = (i + 1) * seg;
        tiret(t, lg, sens > 0 ? h - lg : h);
        const f = 1 - i / N;
        t.style.opacity = (a * 0.16).toFixed(3);
        t.style.strokeWidth = (0.8 + 2.2 * f).toFixed(2);
      }
      const lh = Math.max(L * 0.5, 18);
      tiret(halo, lh, sens > 0 ? h - lh : h);
      halo.style.opacity = (a * (0.55 + 0.45 * st.pulse)).toFixed(3);
      let p = { x: 0, y: 0 };
      try { p = geo.getPointAtLength(h); } catch (e) { /* géométrie pas encore posée */ }
      const r = 1 + 0.7 * st.pulse;
      tete.setAttribute('cx', p.x); tete.setAttribute('cy', p.y); tete.setAttribute('r', (7 * r).toFixed(2));
      coeur.setAttribute('cx', p.x); coeur.setAttribute('cy', p.y); coeur.setAttribute('r', (2.2 * r).toFixed(2));
      tete.style.opacity = Math.min(1, a * 0.95).toFixed(3); coeur.style.opacity = a.toFixed(3);
      /* anneau de fin : la lumière part de la tête et ferme le tour */
      if (o.anneau && st.anneau > 0.001 && !prog) {
        const lg = P * easeOut(st.anneau);
        tiret(cercle, lg, st.anneauDepart ?? 0);
        cercle.style.opacity = Math.min(1, st.anneau * 1.6).toFixed(3);
      } else cercle.style.opacity = 0;
      /* encoche d'arrêt : là où le lot s'est arrêté (piste « grammaire ») */
      if (mode === 'arret') {
        tiret(encoche, 12, h - 6);
        encoche.style.opacity = 1;
      } else encoche.style.opacity = 0;
      /* onde : à chaque cut posé, un éclat part de la tête et s'étale le long du bord, des deux
       * côtés, en s'effaçant (0,7 s) : on voit le cut, sans rien poser hors de la carte */
      if (o.onde && st.ondeAge != null && st.ondeAge < 0.7 && a > 0.05) {
        if (st.ondeX == null) st.ondeX = h;
        const k = st.ondeAge / 0.7, lg = 8 + 90 * easeOut(k);
        tiret(onde, lg, st.ondeX - lg / 2);
        onde.style.opacity = ((1 - k) * 0.9 * a).toFixed(3);
      } else if (onde) onde.style.opacity = 0;
      if (o.surTete) { if (prog) o.surTete(prog.x, prog.y, prog.i, carte, st); else o.surTete(p.x, p.y, a * (0.75 + 0.25 * st.pulse), carte, st); }
    }

    /* ---------- effets d'avancement ---------- */
    function point(d) { try { const P = st.P || 1; return geo.getPointAtLength(((d % P) + P) % P); } catch (e) { return { x: 0, y: 0 }; } }
    function cacher(sauf) {
      if (sauf !== 'continu') jauge.style.opacity = 0;
      if (sauf !== 'paliers') paliers.forEach((e) => { e.style.opacity = 0; });
      if (sauf !== 'graduation') gradA.style.opacity = 0;
      if (sauf !== 'graduation' && sauf !== 'matiere') gradD.style.opacity = 0;
    }
    /* ressort amorti critique vers la cible, sans jamais la dépasser : la lumière suit la part
     * mesurée avec un léger retard, d'un mouvement continu, et ne montre jamais plus que le vrai */
    function suivre(x, v, cible, w, dt) {
      v += (w * w * (cible - x) - 2 * w * v) * dt; x += v * dt;
      if (x > cible) { x = cible; v = 0; }
      return [x, v];
    }
    function avancement(carte, dt, now) {
      const choix = document.documentElement.getAttribute('data-avancement') || 'actuel';
      const mode = st.mode, P = st.P || 1, R = reduit();
      const actif = choix !== 'actuel' && !['pret', 'echo', 'relecture'].includes(mode);
      carte.setAttribute('data-av', actif ? choix : '');
      if (!actif) { cacher(''); return null; }
      cacher(choix);
      const phase = carte.getAttribute('data-phase') || '';
      const brut = carte.getAttribute('data-part');
      const connu = brut != null && brut !== '';
      const part = connu ? Math.max(0, Math.min(1, Number(brut))) : null;
      const faits = st.faits || 0;
      const visCible = { encours: 1, pause: 0.7, arrete: 0.5, fin: 1 }[phase] ?? 0;
      av.vis = R ? visCible : approche(av.vis, visCible, 0.3, dt);
      /* un nouveau lot : la part redescend nettement, on repart de zéro */
      if (connu && av.partPrec != null && part < av.partPrec - 0.05) { av.pa = part; av.va = 0; av.cliquet = -1; av.allume = []; av.niv = part; }
      if (connu) av.partPrec = part;
      const t = (now - st.t0) / 1000;
      let f = { x: 0, y: 0 };
      switch (choix) {
        case 'continu': {
          if (connu) {
            if (R) { av.pa = part; av.va = 0; } else [av.pa, av.va] = suivre(av.pa, av.va, part, 2.6, dt);
            tiret(jauge, av.pa * P, 0); f = point(av.pa * P);
          } else {
            /* total inconnu : une lueur courte glisse lentement ; elle ne dit aucune quantité */
            const pos = R ? P * 0.2 : (t / 9) * P;
            tiret(jauge, P * 0.12, pos - P * 0.12); f = point(pos);
          }
          jauge.style.opacity = av.vis.toFixed(3);
          break;
        }
        case 'paliers': {
          /* douze paliers ; un palier ne s'allume que plein, et ne s'éteint plus (cliquet) */
          const n = connu ? Math.floor(part * K + 1e-6) : Math.floor(faits / 20) % (K + 1);
          if (!connu && n < av.cliquet) { av.cliquet = -1; av.allume = []; }
          for (let k = Math.max(0, av.cliquet); k < n; k++) if (av.allume[k] == null) av.allume[k] = R ? -1e9 : now;
          av.cliquet = Math.max(av.cliquet, n);
          const ecart = 5, l = P / K - ecart;
          for (let k = 0; k < K; k++) {
            const e = paliers[k];
            tiret(e, l, k * P / K + ecart / 2);
            const on = k < av.cliquet, age = on ? (now - av.allume[k]) / 650 : 1;
            const eclat = on && age < 1 ? 1 - age : 0;
            e.style.opacity = (av.vis * (on ? 1 : 0.16)).toFixed(3);
            e.style.strokeWidth = (2.6 + 3 * eclat).toFixed(2);
            e.style.filter = eclat > 0 ? `drop-shadow(0 0 ${(6 * eclat).toFixed(1)}px var(--fa-halo))` : '';
          }
          f = point(Math.max(0, av.cliquet) * P / K);
          break;
        }
        case 'graduation': {
          /* 48 traits, révélés un à un à mesure que le lot avance ; le dernier est plus long */
          const r = connu ? Math.floor(part * G + 1e-6) : Math.floor(faits / 5) % (G + 1);
          if (r !== av.r) { if (r > av.r) av.rAge = R ? 1 : 0; av.r = r; av.cle = ''; }
          av.rAge = Math.min(1, av.rAge + dt / 0.4);
          const cle = `${r}|${st.w}|${st.h}|${av.rAge < 1 ? av.rAge.toFixed(2) : 1}`;
          if (cle !== av.cle) {
            av.cle = cle;
            let dA = '', dD = '';
            for (let i = 0; i < r; i++) {
              const s0 = (i + 0.5) / G * P, p0 = point(s0), a1 = point(s0 - 0.6), a2 = point(s0 + 0.6);
              let tx = a2.x - a1.x, ty = a2.y - a1.y; const nn = Math.hypot(tx, ty) || 1; tx /= nn; ty /= nn;
              const der = i === r - 1, lg = der ? 3 + 7 * easeOut(av.rAge) : 5;
              const x1 = p0.x - ty * 2, y1 = p0.y + tx * 2, x2 = p0.x - ty * (2 + lg), y2 = p0.y + tx * (2 + lg);
              const seg = `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
              if (der) dD = seg; else dA += seg;
              if (der) f = p0;
            }
            gradA.setAttribute('d', dA || 'M0 0'); gradD.setAttribute('d', dD || 'M0 0');
          }
          gradA.style.opacity = (av.vis * 0.5).toFixed(3); gradD.style.opacity = av.vis.toFixed(3);
          if (r > 0) f = point((r - 0.5) / G * P);
          break;
        }
        case 'matiere': {
          /* un niveau de lumière qui monte dans la carte ; total inconnu : il ne fait que vivre au fond */
          const cible = visCible === 0 ? 0 : connu ? part : 0.07 + 0.025 * Math.sin(t * 0.9);
          if (R) { av.niv = cible; av.vn = 0; } else if (connu) [av.niv, av.vn] = suivre(av.niv, av.vn, cible, 2.2, dt); else av.niv = approche(av.niv, cible, 0.4, dt);
          carte.style.setProperty('--niveau', (av.niv * 100).toFixed(2) + '%');
          /* deux encoches au niveau, sur les bords gauche et droit, hors du texte */
          const y = (st.h * (1 - av.niv)).toFixed(1), xd = (st.w - 1).toFixed(1), xg = (st.w - 13).toFixed(1);
          gradD.setAttribute('d', av.niv > 0.005 ? `M1 ${y}L13 ${y}M${xg} ${y}L${xd} ${y}` : 'M0 0');
          gradD.style.opacity = (av.vis * 0.9).toFixed(3); av.cle = '';
          f = { x: st.w / 2, y: st.h * (1 - av.niv) };
          break;
        }
      }
      return { x: f.x, y: f.y, i: av.vis * 0.8 };
    }
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    /* un tiret de longueur lg qui commence à la distance debut ; la période du motif vaut
     * exactement le périmètre, pour qu'un tiret qui passe le point de départ du tracé continue */
    function tiret(e, lg, debut) {
      const P = st.P || 1, l = Math.max(0, Math.min(lg, P));
      e.setAttribute('stroke-dasharray', l >= P - 0.01 ? 'none' : `${l} ${P - l}`);
      e.setAttribute('stroke-dashoffset', -(((debut % P) + P) % P));
    }

    requestAnimationFrame(image);
    return { etat: st };
  }

  window.Faisceau = { creer };
})();

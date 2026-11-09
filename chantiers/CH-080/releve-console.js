/* CH-080b — RELEVÉ DE CONSOLE, LECTURE SEULE, à coller dans la console d'ESV (onglet de la coupe, après le chargement des points).
 * Il ne modifie rien, n'émet aucune requête, ne copie rien dans le presse-papiers. Il n'affiche AUCUNE adresse ni AUCUNE valeur de clé :
 * seulement des types, des booléens, des comptes et des noms de propriétés (jamais leur valeur).
 * Il rend un objet JSON à recopier tel quel pour l'intégrateur. */
(() => {
  const sur = f => { try { return f(); } catch (e) { return 'erreur:' + (e && e.name || 'inconnue'); } };
  const cles = o => { try { const p = new Set(Object.keys(o)); let q = Object.getPrototypeOf(o), n = 0; while (q && q !== Object.prototype && n++ < 4) { for (const k of Object.getOwnPropertyNames(q)) if (k !== 'constructor') p.add(k + '()'); q = Object.getPrototypeOf(q); } return [...p].sort().slice(0, 80); } catch { return null; } };
  const D = /^\d+-\d+-\d+-\d+$/;
  const fiche = n => n ? {
    constructeur: sur(() => n.constructor && n.constructor.name), proprietes: cles(n),
    typeFilename: typeof n.filename, filenameD: sur(() => typeof n.filename === 'function' ? D.test(String(n.filename())) : null), filenameAvecPoint: sur(() => typeof n.filename === 'function' ? String(n.filename()).includes('.') : null), filenameR: sur(() => typeof n.filename === 'function' ? /^r[0-7]*$/.test(String(n.filename())) : null),
    typeKey: typeof n.key, keyConstructeur: sur(() => n.key && n.key.constructor && n.key.constructor.name), keyProprietes: sur(() => n.key ? cles(n.key) : null),
    keyNameD: sur(() => n.key && typeof n.key.name === 'function' ? D.test(String(n.key.name())) : null), keyEntiers: sur(() => n.key ? ['d', 'x', 'y', 'z'].map(k => Number.isInteger(n.key[k])) : null),
    typeName: typeof n.name, nameD: sur(() => D.test(String(n.name))), nameR: sur(() => /^r[0-7]*$/.test(String(n.name))),
    level: sur(() => Number.isInteger(n.level) ? n.level : typeof n.level), numPoints: sur(() => n.numPoints === -1 ? -1 : typeof n.numPoints === 'number' ? (n.numPoints > 0 ? '>0' : n.numPoints) : typeof n.numPoints),
    loaded: n.loaded, loading: n.loading, hasChildren: n.hasChildren, enfants: sur(() => n.children ? Object.values(n.children).filter(Boolean).length : null), typeChildren: sur(() => Array.isArray(n.children) ? 'tableau' : typeof n.children),
    nodeType: sur(() => n.nodeType), boite: sur(() => !!(n.boundingBox && n.boundingBox.min && n.boundingBox.max)),
    typeUrl: typeof n.url, urlFinitParKeyName: sur(() => typeof n.url === 'function' && n.key && typeof n.key.name === 'function' ? String(n.url()).endsWith(String(n.key.name())) : null),
    urlContientEptData: sur(() => typeof n.url === 'function' ? String(n.url()).includes('ept-data/') : null), urlFinitParFilename: sur(() => typeof n.url === 'function' && typeof n.filename === 'function' ? String(n.url()).endsWith(String(n.filename())) : null),
    urlAQuestion: sur(() => typeof n.url === 'function' ? String(n.url()).includes('?') : null), urlAbsolue: sur(() => typeof n.url === 'function' ? /^https?:/.test(String(n.url())) : null),
    typeEpt: typeof n.ept, typeEptUrl: sur(() => n.ept ? typeof n.ept.url : null), eptUrlFinitParBarre: sur(() => n.ept && typeof n.ept.url === 'string' ? n.ept.url.endsWith('/') : null),
    eptUrlAQuestion: sur(() => n.ept && typeof n.ept.url === 'string' ? n.ept.url.includes('?') : null), typeLoadHierarchy: typeof n.loadHierarchy,
    hierarchyByteSize: sur(() => typeof n.hierarchyByteSize), typeOctreeGeometry: typeof n.octreeGeometry
  } : null;
  const v = window.viewer, pcs = sur(() => v.scene.pointclouds) || [], sortie = { potreeVersion: sur(() => window.Potree && window.Potree.version ? cles(window.Potree.version) : null), potreeMajeur: sur(() => window.Potree && window.Potree.version && window.Potree.version.major), potreeMineur: sur(() => window.Potree && window.Potree.version && window.Potree.version.minor), nuages: [] };
  for (const pc of pcs.slice(0, 4)) {
    const g = pc && pc.pcoGeometry, racine = g && g.root, l = g && g.loader;
    const r = { pc: sur(() => pc.constructor.name), geometrie: sur(() => g.constructor.name), geometrieProprietes: sur(() => cles(g)), chargeur: sur(() => l && l.constructor.name),
      typeExtension: typeof (l && l.extension), extensionBin: sur(() => l && typeof l.extension === 'function' ? l.extension() === '.bin' : null), extensionLaz: sur(() => l && typeof l.extension === 'function' ? l.extension() === '.laz' : null),
      extensionForme: sur(() => l && typeof l.extension === 'function' ? /^\.[a-z0-9]{1,8}$/i.test(l.extension()) : null),
      matrice: sur(() => pc.matrixWorld && pc.matrixWorld.elements && pc.matrixWorld.elements.length), comptes: { vus: 0, charges: 0, enCours: 0, nonCharges: 0, moinsUn: 0, filenameD: 0, keyNameD: 0, keyEntiers: 0, nameR: 0 } };
    const pile = racine ? [racine] : [], c = r.comptes; let premierNonCharge = null, premierCharge = null, premierMoinsUn = null;
    while (pile.length && c.vus < 20000) {
      const n = pile.pop(); c.vus++;
      if (n.loaded === true) { c.charges++; premierCharge = premierCharge || n; } else if (n.loading === true) c.enCours++; else { c.nonCharges++; premierNonCharge = premierNonCharge || n;
        if (sur(() => D.test(String(n.filename()))) === true) c.filenameD++; if (sur(() => D.test(String(n.key.name()))) === true) c.keyNameD++;
        if (sur(() => ['d', 'x', 'y', 'z'].every(k => Number.isInteger(n.key[k]))) === true) c.keyEntiers++; if (/^r[0-7]*$/.test(String(n.name))) c.nameR++; }
      if (n.numPoints === -1) { c.moinsUn++; premierMoinsUn = premierMoinsUn || n; }
      const e = n.children; if (e) for (const x of (Array.isArray(e) ? e : Object.values(e))) if (x) pile.push(x);
    }
    Object.assign(r, { racine: fiche(racine), charge: fiche(premierCharge), nonCharge: fiche(premierNonCharge), moinsUn: fiche(premierMoinsUn) });
    sortie.nuages.push(r);
  }
  const texte = JSON.stringify(sortie);
  console.log(texte);
  return sortie;
})();

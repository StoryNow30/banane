'use strict';
/* Capture SYNTHÉTIQUE de l'essai du jeu d'hypothèses de la GCV2 (tests/gcv2-jeu.test.cjs) : deux rails à 1 450 mm, un champignon rectangulaire,
 * un dessus et un flanc de points bruités (graine fixe), deux concurrents plus loin. Valeurs inventées, aucune donnée de terrain. */
const trans = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
function alea(graine) { let a = graine >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }

/* Rail à `y` (scène), de signe `sign` : le contour part de l'axe vers l'extérieur de la voie. */
function rail(y, sign, o = [0, 0, 0]) {
  const contour = [];
  for (let u = 0; u <= 0.064 + 1e-12; u += 0.001) contour.push([o[0], o[1] + y + sign * u, o[2]]);
  for (let z = -0.001; z >= -0.04 - 1e-12; z -= 0.001) contour.push([o[0], o[1] + y, o[2] + z]);
  const P = trans(o[0], o[1] + y, o[2]);
  return { positionSceneRelative: [o[0], o[1] + y, o[2]], profileOriginSceneRelative: [o[0], o[1] + y, o[2]], sceneRelativeToProfileLocal: trans(-o[0], -(o[1] + y), -o[2]),
    profileLocalToSceneRelative: P, railLocalToSceneRelative: P, profileContours: [{ verticesSceneRelative: contour }] };
}
/* Points d'un rail : dessus et flanc autour du gabarit posé à (bu, bz) du rail, plus un faux dessus à `leurreMm` de côté. */
function pointsRail(y, sign, bu, bz, rnd, { leurreMm = null, o = [0, 0, 0] } = {}) {
  const pts = [];
  const poser = (du, dz) => pts.push([o[0], o[1] + y + sign * (bu + du), o[2] + bz + dz]);
  for (let i = 0; i < 40; i++) poser(0.015 + i * 0.035 / 39, (rnd() - 0.5) * 0.0008);
  for (let i = 0; i < 11; i++) poser((rnd() - 0.5) * 0.0008, -0.012 - i * 0.002);
  if (leurreMm !== null) for (let i = 0; i < 30; i++) pts.push([o[0], o[1] + y + sign * (bu + leurreMm / 1000 + 0.015 + i * 0.035 / 29), o[2] + bz + 0.006 + (rnd() - 0.5) * 0.0008]);
  return pts;
}
/* Capture : cut `cut` de la partie 91, gabarit réel du rail gauche en (12, -4) mm, du droit en (10, -3) mm. */
function capture({ cut = 5, graine = 7, leurre = true, origine = [0, 0, 0] } = {}) {
  const rnd = alea(graine), points = [...pointsRail(0, 1, 0.012, -0.004, rnd, { ...(leurre ? { leurreMm: 30 } : {}), o: origine }), ...pointsRail(1.45, -1, 0.010, -0.003, rnd, { o: origine })];
  return { identity: { part: 91, cut, frameId: null }, rails: { left: rail(0, 1, origine), right: rail(1.45, -1, origine) }, pointsSceneRelative: points, visibleByClipBoxes: points.map(() => true) };
}
module.exports = { capture, rail, trans, alea };

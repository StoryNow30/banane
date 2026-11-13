'use strict';
/* CH-121, exploration : le calage de convention (`placement-convention.js`) refait à la pose finale, rail par rail, `iter` fois.
 * reglage : { maxShiftMm (8), axes: 'les-deux'|'lat'|'vert', iter (1), minFacePoints (6), minTopPoints (15) } */
const path = require('node:path');
const Conv = require(path.join(__dirname, '../../../../src/placement-convention.js'));
const SIDES = ['left', 'right'];
function ajuster(capture, decal, R) {
  const out = { left: decal.left.slice(), right: decal.right.slice() }, info = {};
  for (const s of SIDES) {
    for (let k = 0; k < (R.iter || 1); k++) {
      const c = Conv.calibrate(capture, s, out[s].map(v => v / 1000), { maxShiftMm: R.maxShiftMm ?? 8, minFacePoints: R.minFacePoints ?? 6, minTopPoints: R.minTopPoints ?? 15 });
      if (!c.applied) { if (!k) info[s] = c.reason; break; }
      const n = c.delta.map(v => v * 1000);
      if (R.axes !== 'vert') out[s][1] = n[1];
      if (R.axes !== 'lat') out[s][2] = n[2];
      if (c.faceMode !== 'median' && R.axes !== 'vert') { /* pas de flanc : latéral inchangé */ }
    }
  }
  return { decal: out, info: Object.keys(info).length ? info : null };
}
module.exports = { ajuster };

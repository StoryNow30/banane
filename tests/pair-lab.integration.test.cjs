const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Lab=require('../tools/pair-lab.cjs');

const CORPUS=path.join(__dirname,'corpus','banane-lidar-part-23-cut-2855-1788941885642.json');
const OFFLINE=path.join(__dirname,'..','datasets','automatic','offline-evaluation-v4.3.0.json');

function pose(rail){
  return {
    profileOriginSceneRelative:rail.profileOriginSceneRelative,
    positionSceneRelative:rail.positionSceneRelative,
    profileLocalToSceneRelative:rail.profileLocalToSceneRelative,
    sceneRelativeToProfileLocal:rail.sceneRelativeToProfileLocal,
    railLocalToSceneRelative:rail.railLocalToSceneRelative,
    profileContours:rail.profileContours
  };
}

test('integration: banane-corrections-session-v4 joins a real capture and leaves a record without LiDAR unavailable',()=>{
  const cloud=JSON.parse(fs.readFileSync(CORPUS,'utf8'));
  assert.equal(cloud.part,23);
  assert.equal(cloud.cut,2855);
  const session={
    format:'banane-corrections-session-v4',
    clouds:[cloud],
    records:[
      {
        recordId:'joined-2855',part:cloud.part,cut:cloud.cut,shape:cloud.shape,
        lidarCaptureId:cloud.captureId,visitId:cloud.visitId,
        rails:{
          left:{initial:pose(cloud.rails.left),corrected:pose(cloud.rails.left)},
          right:{initial:pose(cloud.rails.right),corrected:pose(cloud.rails.right)}
        }
      },
      {
        recordId:'orphan-17',part:17,cut:1,shape:'U50',lidarCaptureId:'missing',
        rails:{
          left:{initial:{profileOriginSceneRelative:[0,0,0]},corrected:{profileOriginSceneRelative:[0,0,0]}},
          right:{initial:{profileOriginSceneRelative:[0,1.44,0]},corrected:{profileOriginSceneRelative:[0,1.436,0]}}
        }
      }
    ]
  };
  const {entries,coverage}=Lab.ingest(session);
  assert.equal(coverage.format,'banane-corrections-session-v4');
  assert.equal(coverage.records,2);
  assert.equal(coverage.clouds,1);
  assert.equal(coverage.joinedByCaptureId,1);
  assert.equal(coverage.unjoined,1);
  assert.equal(coverage.engineUnavailableNoLidar,1);
  assert.ok(coverage.engineReplayed===1||coverage.engineUnavailableReplayFailed===1);
  const joined=Lab.measureCase(entries[0]);
  const orphan=Lab.measureCase(entries[1]);
  assert.equal(joined.identity.cut,2855);
  assert.equal(joined.cloudJoin,'lidarCaptureId');
  assert.equal(orphan.pairProfileOriginDistanceTimes1e3.engineFrozen,null);
  assert.equal(orphan.pairProfileOriginDistanceTimes1e3.brainOfflineReplayV1Forced,null);
  assert.ok(Number.isFinite(orphan.pairProfileOriginDistanceTimes1e3.initial));
  assert.ok(Number.isFinite(orphan.pairProfileOriginDistanceTimes1e3.human));
});

test('integration: banane-offline-evaluation-v1 excerpt keeps the published format and rail comparator',()=>{
  assert.ok(fs.existsSync(OFFLINE), 'offline-evaluation-v4.3.0.json must be in the clone');
  const doc=JSON.parse(fs.readFileSync(OFFLINE,'utf8'));
  assert.equal(doc.format,'banane-offline-evaluation-v1');
  const excerpt={format:doc.format,results:(doc.results||[]).slice(0,2)};
  assert.ok(excerpt.results.length>=1);
  const {entries,coverage}=Lab.ingest(excerpt);
  assert.equal(coverage.format,'banane-offline-evaluation-v1');
  assert.equal(coverage.records,excerpt.results.length);
  const measured=Lab.measureCase(entries[0]);
  assert.equal(measured.kind,'offline-evaluation-row');
  assert.ok(measured.pairProfileOriginDistance.initial.status==='measured'
    || measured.pairProfileOriginDistance.initial.status==='unavailable');
  assert.ok(measured.anteHumanDescriptors);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEyeAspectRatio,
  computeHeadYawRatio,
  createActiveChallengeTracker,
  getChallengeFailureDetail,
  updateActiveChallengeTracker,
} from './activeLiveness.ts';

function makeLandmarks({ noseX = 0.5, earOpen = true } = {}) {
  const pts = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  pts[1] = { x: noseX, y: 0.55, z: -0.05 };
  pts[234] = { x: 0.3, y: 0.5, z: 0.02 };
  pts[454] = { x: 0.7, y: 0.5, z: 0.02 };

  const vGap = earOpen ? 0.032 : 0.004;
  // Left eye [33, 160, 158, 133, 153, 144]
  pts[33] = { x: 0.36, y: 0.42, z: 0 };
  pts[133] = { x: 0.44, y: 0.42, z: 0 };
  pts[160] = { x: 0.385, y: 0.42 - vGap / 2, z: 0 };
  pts[158] = { x: 0.415, y: 0.42 - vGap / 2, z: 0 };
  pts[144] = { x: 0.385, y: 0.42 + vGap / 2, z: 0 };
  pts[153] = { x: 0.415, y: 0.42 + vGap / 2, z: 0 };

  // Right eye [362, 385, 387, 263, 373, 380]
  pts[362] = { x: 0.56, y: 0.42, z: 0 };
  pts[263] = { x: 0.64, y: 0.42, z: 0 };
  pts[385] = { x: 0.585, y: 0.42 - vGap / 2, z: 0 };
  pts[387] = { x: 0.615, y: 0.42 - vGap / 2, z: 0 };
  pts[380] = { x: 0.585, y: 0.42 + vGap / 2, z: 0 };
  pts[373] = { x: 0.615, y: 0.42 + vGap / 2, z: 0 };

  return pts;
}

test('activeLiveness EAR, head yaw, and challenge state machine', () => {
  const frontalOpen = makeLandmarks({ noseX: 0.5, earOpen: true });
  const frontalClosed = makeLandmarks({ noseX: 0.5, earOpen: false });
  const turnRight = makeLandmarks({ noseX: 0.42, earOpen: true }); // yaw = +0.40
  const turnLeft = makeLandmarks({ noseX: 0.58, earOpen: true }); // yaw = -0.40

  assert.ok(computeEyeAspectRatio(frontalOpen) > 0.3);
  assert.ok(computeEyeAspectRatio(frontalClosed) < 0.1);
  assert.ok(Math.abs(computeHeadYawRatio(frontalOpen)) < 0.05);
  assert.ok(computeHeadYawRatio(turnRight) > 0.26);
  assert.ok(computeHeadYawRatio(turnLeft) < -0.26);

  const tracker = createActiveChallengeTracker();
  assert.equal(tracker.step, 'FRONTAL_CALIBRATION');

  updateActiveChallengeTracker(tracker, frontalOpen, true);
  assert.equal(tracker.step, 'BLINK');

  // Closing eyes alone does not finish BLINK until eyes reopen
  updateActiveChallengeTracker(tracker, frontalClosed, true);
  assert.equal(tracker.blinkDetected, false);
  assert.equal(tracker.step, 'BLINK');

  const afterBlink = updateActiveChallengeTracker(tracker, frontalOpen, true);
  assert.equal(afterBlink.blinkDetected, true);
  assert.equal(afterBlink.step, 'TURN_RIGHT');

  // Requires 2 consecutive turn frames
  updateActiveChallengeTracker(tracker, turnRight, true);
  assert.equal(tracker.turnRightDetected, false);
  updateActiveChallengeTracker(tracker, turnRight, true);
  assert.equal(tracker.turnRightDetected, true);
  assert.equal(tracker.step, 'TURN_LEFT');

  updateActiveChallengeTracker(tracker, turnLeft, true);
  assert.equal(tracker.turnLeftDetected, false);
  const finalStep = updateActiveChallengeTracker(tracker, turnLeft, true);
  assert.equal(finalStep.turnLeftDetected, true);
  assert.equal(finalStep.step, 'RETURN_CENTER');

  assert.match(getChallengeFailureDetail(createActiveChallengeTracker()), /kedipan mata, tengok kanan, tengok kiri/);
});

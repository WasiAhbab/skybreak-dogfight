import {Quaternion, Vector3} from './vendor/three.module.js';
import {clamp} from './flight-math.js';
const axis = new Vector3(), delta = new Quaternion();

export function turnAuthority(speed) {
  // Best sustained turning at corner speed. Boost trades turning for separation.
  return clamp(135 / Math.max(speed, 80), .48, 1.22);
}

export function integrateFlight(orientation, {pitch = 0, yaw = 0, roll = 0}, speed, dt) {
  const authority = turnAuthority(speed);
  axis.set(clamp(pitch, -1.5, 1.5) * 1.18 * authority,
    -clamp(yaw, -1.5, 1.5) * .92 * authority,
    -clamp(roll, -3, 3) * 2.35);
  const rate = axis.length();
  if (rate > 0 && dt > 0) {
    delta.setFromAxisAngle(axis.multiplyScalar(1 / rate), rate * dt);
    orientation.multiply(delta).normalize();
  }
  // No angular inertia: zero controls leave the attitude exactly unchanged.
  return orientation;
}

import * as THREE from 'three';
import * as SunCalc from 'suncalc';

// World axes: +X = east, -Z = north, +Y = up. One unit = one metre.

/**
 * Converts a wall-clock time in an IANA time zone to a real Date (UTC instant).
 * Uses Intl to find the zone's offset at that moment, iterating once to settle
 * DST transitions.
 */
export function zonedTimeToDate(year, month, day, minutes, timeZone) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  const guess = Date.UTC(year, month - 1, day, h, m);
  let offset = zoneOffsetMs(new Date(guess), timeZone);
  let utc = guess - offset;
  const offset2 = zoneOffsetMs(new Date(utc), timeZone);
  if (offset2 !== offset) utc = guess - offset2;
  return new Date(utc);
}

function zoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Minutes after local midnight for a Date, as seen in `timeZone`. */
export function minutesInZone(date, timeZone) {
  if (!date || isNaN(date)) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return get('hour') * 60 + get('minute');
}

/**
 * Unit vector pointing from the ground toward the sun.
 * suncalc ≥ 2 returns degrees, with azimuth clockwise from north (0 = N, 90 = E).
 * (suncalc 1.x used radians measured from south — don't mix the two.)
 */
export function sunDirection(altitudeDeg, azimuthDeg, target = new THREE.Vector3()) {
  const alt = THREE.MathUtils.degToRad(altitudeDeg);
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  return target.set(Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az));
}

const WARM = new THREE.Color(1.0, 0.55, 0.3);
const NOON = new THREE.Color(1.0, 0.97, 0.92);

/**
 * Directional sun + hemisphere fill. The shadow camera is fitted to the yard so
 * the 4k shadow map gives ~1.5 cm texels over a 60 m lot.
 */
export class Sun {
  constructor(scene, { yardRadius = 32, shadowMapSize = 4096 } = {}) {
    this.direction = new THREE.Vector3(0, 1, 0);
    this.altitude = 0;
    this.azimuth = 0;
    this.yardRadius = yardRadius;

    this.light = new THREE.DirectionalLight(0xffffff, 3);
    this.light.castShadow = true;
    const cam = this.light.shadow.camera;
    cam.left = -yardRadius;
    cam.right = yardRadius;
    cam.top = yardRadius;
    cam.bottom = -yardRadius;
    cam.near = 1;
    cam.far = 250;
    this.light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    this.light.shadow.bias = -0.0002;
    this.light.shadow.normalBias = 0.03;
    this.light.shadow.radius = 3;
    scene.add(this.light, this.light.target);

    // Sky/ground bounce. Kept low because the HDRI already provides most fill;
    // it mainly keeps shaded areas from going flat when the HDRI is dim.
    this.hemi = new THREE.HemisphereLight(0xbdd7ff, 0x4a5a2a, 0.25);
    scene.add(this.hemi);
  }

  update(date, lat, lon) {
    const pos = SunCalc.getPosition(date, lat, lon);
    this.altitude = pos.altitude; // degrees
    this.azimuth = pos.azimuth; // degrees, compass bearing
    sunDirection(pos.altitude, pos.azimuth, this.direction);

    const d = 120;
    this.light.position.copy(this.direction).multiplyScalar(d);
    this.light.target.position.set(0, 0, 0);

    // Intensity falls off with air mass near the horizon; colour warms up.
    const altDeg = pos.altitude;
    const up = THREE.MathUtils.smoothstep(altDeg, -2, 6);
    const warmth = 1 - THREE.MathUtils.smoothstep(altDeg, 2, 25);
    this.light.color.copy(NOON).lerp(WARM, warmth);
    this.light.intensity = 3.2 * up * (0.55 + 0.45 * THREE.MathUtils.smoothstep(altDeg, 0, 30));
    this.light.visible = up > 0.001;
    this.hemi.intensity = 0.05 + 0.25 * THREE.MathUtils.smoothstep(altDeg, -8, 20);
  }

  /** 0 at night, 1 in full daylight — used to dim the sky and environment. */
  get daylight() {
    return THREE.MathUtils.smoothstep(this.altitude, -8, 8);
  }

  static times(date, lat, lon) {
    return SunCalc.getTimes(date, lat, lon);
  }
}

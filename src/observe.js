/*
 * Walking and flying through the yard (Observe mode).
 *
 * Walk: first person at eye height. W A S D or the arrow keys move, Shift
 * runs, dragging (or a captured mouse) looks around. Buildings, decks,
 * fences and tree trunks are solid, and you stay inside the property line.
 *
 * Drone: the same keys fly level; Space or E climbs, Q or C descends, the
 * scroll wheel changes speed. Ground level is the floor and 200 ft the
 * ceiling; you can pass over roofs but not through them.
 *
 * Plan coordinates are (x, y); the scene's are (x, height, z = y).
 */
import * as THREE from 'three';

const EYE = 5.5;            // ft
const CEILING = 200;        // ft, drone
const WALK = 5, RUN = 12;   // ft/s
const FLY = 22, FLY_FAST = 55, CLIMB = 14;
const RADIUS = { walk: 1, drone: 1.6 };

function inPoly(p, x, y) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i].x, yi = p[i].y, xj = p[j].x, yj = p[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function nearestOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return { x: ax + dx * t, y: ay + dy * t };
}
function nearestOnRing(p, x, y) {
  let best = null, bd = Infinity;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const q = nearestOnSeg(x, y, p[j].x, p[j].y, p[i].x, p[i].y);
    const d = (q.x - x) ** 2 + (q.y - y) ** 2;
    if (d < bd) { bd = d; best = q; }
  }
  return { q: best, d: Math.sqrt(bd) };
}

export class Observer {
  /**
   * camera: the perspective camera to drive.
   * world(): { lot: [{x,y}], bounds: {x0,y0,x1,y1},
   *            obstacles: [{kind:'poly', pts, h} | {kind:'seg', a, b, h} | {kind:'circle', x, y, r, h}] }
   */
  constructor({ camera, canvas, world, onMove }) {
    this.camera = camera;
    this.canvas = canvas;
    this.world = world;
    this.onMove = onMove || (() => {});
    this.mode = null;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.speedK = 1;
    this.bob = 0;
    this.drag = null;
    this.blocked = false;
    this.#bind();
  }
  get active() { return this.mode === 'walk' || this.mode === 'drone'; }

  /** Begin walking or flying from a plan point, facing `yaw` (radians). */
  start(mode, { x, y, alt, yaw, pitch = 0 }) {
    this.mode = mode;
    this.yaw = yaw;
    this.pitch = mode === 'walk' ? Math.max(-0.5, Math.min(0.35, pitch)) : pitch;
    const h = mode === 'walk' ? EYE : Math.max(3, Math.min(CEILING, alt ?? 40));
    this.pos.set(x, h, y);
    this.vel.set(0, 0, 0);
    this.keys.clear();
    if (mode === 'walk') this.#spawnInside();
    this.#resolve();
    this.#applyCamera();
  }
  stop() {
    this.mode = null;
    this.keys.clear();
    this.drag = null;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
  }
  /** Plan position and heading, for handing back to the orbit camera. */
  pose() { return { x: this.pos.x, y: this.pos.z, alt: this.pos.y, yaw: this.yaw, pitch: this.pitch }; }
  altitude() { return this.pos.y; }
  speed() { return Math.hypot(this.vel.x, this.vel.z); }

  /** Advance by dt seconds. Returns true if the view changed. */
  tick(dt) {
    if (!this.active) return false;
    dt = Math.min(dt, 0.05);
    const k = this.keys;
    const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const r = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const fast = k.has('shift');
    const walk = this.mode === 'walk';
    const sp = (walk ? (fast ? RUN : WALK) : (fast ? FLY_FAST : FLY)) * (walk ? 1 : this.speedK);
    // forward on the ground, from the heading only (looking down doesn't slow you)
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let tx = fx * f + rx * r, tz = fz * f + rz * r;
    const tl = Math.hypot(tx, tz);
    if (tl > 1) { tx /= tl; tz /= tl; }
    let ty = 0;
    if (!walk) ty = ((k.has(' ') || k.has('e') ? 1 : 0) - (k.has('q') || k.has('c') ? 1 : 0)) * CLIMB * (fast ? 2 : 1);
    const a = 1 - Math.exp(-dt * (walk ? 12 : 5));
    this.vel.x += (tx * sp - this.vel.x) * a;
    this.vel.z += (tz * sp - this.vel.z) * a;
    this.vel.y += (ty - this.vel.y) * a;
    const moving = this.vel.lengthSq() > 0.004;
    if (!moving && !this.dirtyLook) { this.vel.set(0, 0, 0); return false; }
    this.dirtyLook = false;
    this.pos.addScaledVector(this.vel, dt);
    if (walk) {
      const s = Math.hypot(this.vel.x, this.vel.z);
      this.bob += dt * s * 1.15;
      this.pos.y = EYE + Math.sin(this.bob * 2) * 0.05 * Math.min(1, s / WALK);
    } else this.pos.y = Math.max(1.5, Math.min(CEILING, this.pos.y));
    this.#resolve();
    this.#applyCamera();
    this.onMove(this);
    return true;
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0032;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * 0.0032));
    this.dirtyLook = true;
    this.#applyCamera();
    this.onMove(this);
  }
  /** On-screen pad: hold a direction. */
  press(key, on) {
    if (on) this.keys.add(key); else this.keys.delete(key);
  }

  // ---- internals
  #applyCamera() {
    const c = this.camera;
    c.position.copy(this.pos);
    c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    c.up.set(0, 1, 0);
    c.updateMatrixWorld(true);
  }
  #spawnInside() {
    const w = this.world();
    if (!w.lot || inPoly(w.lot, this.pos.x, this.pos.z)) return;
    // start at the middle of the lot if the view was looking at somewhere outside it
    let cx = 0, cy = 0;
    for (const p of w.lot) { cx += p.x; cy += p.y; }
    this.pos.x = cx / w.lot.length; this.pos.z = cy / w.lot.length;
  }
  /* Push the viewer out of anything solid, sliding along walls. */
  #resolve() {
    const w = this.world();
    const r = RADIUS[this.mode] || 1;
    const alt = this.pos.y;
    const walk = this.mode === 'walk';
    let hit = false;
    for (let it = 0; it < 4; it++) {
      let moved = false;
      for (const o of w.obstacles) {
        // a drone clears anything it is above; walking, everything is in the way
        if (!walk && alt > o.h + 0.8) continue;
        const x = this.pos.x, y = this.pos.z;
        if (o.kind === 'poly') {
          const inside = inPoly(o.pts, x, y);
          const { q, d } = nearestOnRing(o.pts, x, y);
          if (inside) {
            const nx = q.x - x, ny = q.y - y, L = Math.hypot(nx, ny) || 1;
            this.pos.x = q.x + (nx / L) * r; this.pos.z = q.y + (ny / L) * r;
            moved = true;
          } else if (d < r) {
            const nx = x - q.x, ny = y - q.y, L = Math.hypot(nx, ny) || 1;
            this.pos.x = q.x + (nx / L) * r; this.pos.z = q.y + (ny / L) * r;
            moved = true;
          }
        } else if (o.kind === 'seg') {
          const q = nearestOnSeg(x, y, o.a.x, o.a.y, o.b.x, o.b.y);
          const d = Math.hypot(x - q.x, y - q.y);
          if (d < r) {
            const nx = (x - q.x) || 0.001, ny = y - q.y, L = Math.hypot(nx, ny) || 1;
            this.pos.x = q.x + (nx / L) * r; this.pos.z = q.y + (ny / L) * r;
            moved = true;
          }
        } else if (o.kind === 'circle') {
          const d = Math.hypot(x - o.x, y - o.y), need = o.r + r;
          if (d < need) {
            const ux = d > 1e-6 ? (x - o.x) / d : 1, uy = d > 1e-6 ? (y - o.y) / d : 0;
            this.pos.x = o.x + ux * need; this.pos.z = o.y + uy * need;
            moved = true;
          }
        }
      }
      if (walk && w.lot) {
        // stay inside the property line
        const x = this.pos.x, y = this.pos.z;
        const inside = inPoly(w.lot, x, y);
        const { q, d } = nearestOnRing(w.lot, x, y);
        if (!inside || d < r) {
          // the inward direction: away from the edge if inside, toward (and past) it if outside
          const nx = inside ? x - q.x : q.x - x, ny = inside ? y - q.y : q.y - y;
          const L = Math.hypot(nx, ny);
          if (L > 1e-6) {
            this.pos.x = q.x + (nx / L) * r;
            this.pos.z = q.y + (ny / L) * r;
            moved = true;
          }
        }
      } else if (!walk && w.bounds) {
        const b = w.bounds;
        this.pos.x = Math.max(b.x0, Math.min(b.x1, this.pos.x));
        this.pos.z = Math.max(b.y0, Math.min(b.y1, this.pos.z));
      }
      if (!moved) break;
      hit = true;
    }
    this.blocked = hit;
  }
  #bind() {
    const typing = (e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '');
    const MOVE = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ' ', 'e', 'q', 'c']);
    window.addEventListener('keydown', (e) => {
      if (!this.active || typing(e) || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (MOVE.has(k)) { this.keys.add(k); e.preventDefault(); }
    }, true);
    window.addEventListener('keyup', (e) => {
      if (!this.active) return;
      this.keys.delete(e.key.toLowerCase());
      if (e.key === 'Shift') this.keys.delete('shift');
    }, true);
    window.addEventListener('blur', () => this.keys.clear());
    const cv = this.canvas;
    cv.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      e.stopImmediatePropagation();
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
      cv.setPointerCapture(e.pointerId);
    }, true);
    cv.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      e.stopImmediatePropagation();
      if (document.pointerLockElement === cv) { this.look(e.movementX, e.movementY); return; }
      if (!this.drag || this.drag.id !== e.pointerId) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY; this.drag.moved += Math.abs(dx) + Math.abs(dy);
      this.look(dx, dy);
    }, true);
    const end = (e) => {
      if (!this.active) return;
      e.stopImmediatePropagation();
      // a click without a drag captures the mouse for looking, where allowed
      if (this.drag && this.drag.moved < 4 && e.pointerType === 'mouse' && document.pointerLockElement !== cv) {
        try { const p = cv.requestPointerLock?.(); if (p && p.catch) p.catch(() => {}); } catch { /* not allowed here */ }
      }
      this.drag = null;
    };
    cv.addEventListener('pointerup', end, true);
    cv.addEventListener('pointercancel', end, true);
    cv.addEventListener('wheel', (e) => {
      if (!this.active) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (this.mode === 'drone') this.speedK = Math.max(0.3, Math.min(4, this.speedK * (e.deltaY > 0 ? 1 / 1.15 : 1.15)));
      this.onMove(this);
    }, { capture: true, passive: false });
  }
}

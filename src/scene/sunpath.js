import * as THREE from 'three';

/*
 * The day's sun path drawn over the model as a luminous arc, with a bead at
 * every hour and the sun itself riding it: an armillary for the yard. The
 * glow comes from HDR emissive values picked up by the bloom pass.
 */
export class SunPath {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'sunpath';
    scene.add(this.group);
    this.arcMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.15, 0.55), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
    this.beadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.9), toneMapped: false });
    this.orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 6.8, 3.6), toneMapped: false });
    this.rayMat = new THREE.LineDashedMaterial({ color: 0xf2d594, dashSize: 2, gapSize: 2.5, transparent: true, opacity: 0.45, depthWrite: false });
    this.orb = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), this.orbMat);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: 0xffe2a8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.orb.raycast = () => {};
    this.halo.raycast = () => {};
    this.group.add(this.orb, this.halo);
    this.parts = [];
  }

  /** samples: [{dir: Vector3 (unit, world), hour: bool}] from sunrise to sunset. */
  build(center, radius, samples) {
    for (const p of this.parts) {
      this.group.remove(p);
      p.geometry.dispose();
    }
    this.parts = [];
    this.center = center.clone();
    this.radius = radius;
    const pts = samples.filter((s) => s.dir.y > -0.02).map((s) => center.clone().addScaledVector(s.dir, radius));
    if (pts.length > 1) {
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(240, pts.length * 3), radius * 0.0025, 6, false), this.arcMat);
      tube.raycast = () => {};
      this.parts.push(tube);
      this.group.add(tube);
    }
    const beadGeo = new THREE.SphereGeometry(radius * 0.006, 10, 8);
    for (const s of samples) {
      if (!s.hour || s.dir.y < 0) continue;
      const b = new THREE.Mesh(beadGeo, this.beadMat);
      b.position.copy(center).addScaledVector(s.dir, radius);
      b.raycast = () => {};
      this.parts.push(b);
      this.group.add(b);
    }
    this.orb.scale.setScalar(radius * 0.012);
    this.halo.scale.setScalar(radius * 0.11);
    const rayGeo = new THREE.BufferGeometry().setFromPoints([center, center]);
    this.ray = new THREE.Line(rayGeo, this.rayMat);
    this.ray.raycast = () => {};
    this.parts.push(this.ray);
    this.group.add(this.ray);
  }

  setSun(dir) {
    if (!this.center) return;
    const up = dir.y > 0;
    this.orb.visible = this.halo.visible = this.ray.visible = up;
    if (!up) return;
    const p = this.center.clone().addScaledVector(dir, this.radius);
    this.orb.position.copy(p);
    this.halo.position.copy(p);
    this.ray.geometry.setFromPoints([p, this.center]);
    this.ray.computeLineDistances();
  }

  setVisible(on) {
    this.group.visible = !!on;
  }
}

function haloTexture() {
  const N = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  r.addColorStop(0, 'rgba(255,236,190,.9)');
  r.addColorStop(0.18, 'rgba(255,214,140,.45)');
  r.addColorStop(0.5, 'rgba(255,190,110,.08)');
  r.addColorStop(1, 'rgba(255,180,100,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, N, N);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

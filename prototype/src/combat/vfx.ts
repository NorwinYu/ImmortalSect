import * as THREE from 'three';
import { glowTexture, slashTexture } from '../core/textures';

type Slash = {
  sprite: THREE.Sprite;
  age: number;
  life: number;
  base: number;
  spin: number;
};

type Spark = {
  points: THREE.Points;
  velocity: Float32Array;
  age: number;
  life: number;
};

type Beam = {
  mesh: THREE.Mesh;
  age: number;
  life: number;
};

type Wave = {
  mesh: THREE.Mesh;
  age: number;
  life: number;
  scale: number;
};

export class CombatVfx {
  private readonly slashTex = slashTexture();
  private readonly glowTex = glowTexture();
  private readonly slashes: Slash[] = [];
  private readonly sparks: Spark[] = [];
  private readonly beams: Beam[] = [];
  private readonly waves: Wave[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  slash(position: THREE.Vector3, color = '#e6f7ff', scale = 1, spin = 0.4): void {
    const material = new THREE.SpriteMaterial({
      map: this.slashTex,
      color,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      rotation: spin,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(3.2 * scale, 1.9 * scale, 1);
    sprite.renderOrder = 20;
    this.scene.add(sprite);
    this.slashes.push({ sprite, age: 0, life: 0.22, base: scale, spin });
  }

  impact(position: THREE.Vector3, color = '#ffd9a0'): void {
    const count = 28;
    const positions = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 2 - 0.4;
      const speed = 2.2 + Math.random() * 5.5;
      velocity[i * 3] = Math.cos(a) * speed;
      velocity[i * 3 + 1] = up * speed;
      velocity[i * 3 + 2] = Math.sin(a) * speed;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: this.glowTex,
      color,
      size: 0.11,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this.sparks.push({ points, velocity, age: 0, life: 0.42 });
  }

  beam(from: THREE.Vector3, to: THREE.Vector3, color = '#9ff3e2'): void {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    if (len < 0.1) return;
    const geo = new THREE.CylinderGeometry(0.08, 0.14, len, 6, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    mesh.renderOrder = 18;
    this.scene.add(mesh);
    this.beams.push({ mesh, age: 0, life: 0.24 });
  }

  shockwave(position: THREE.Vector3, color = '#ffcf8a', radius = 3.2): void {
    const geo = new THREE.RingGeometry(0.4, 0.55, 48);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(position);
    mesh.position.y += 0.06;
    mesh.renderOrder = 17;
    this.scene.add(mesh);
    this.waves.push({ mesh, age: 0, life: 0.5, scale: radius });
  }

  update(dt: number): void {
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.age += dt;
      const t = Math.min(s.age / s.life, 1);
      const mat = s.sprite.material as THREE.SpriteMaterial;
      mat.opacity = Math.pow(1 - t, 1.5);
      mat.rotation = s.spin + t * 0.5;
      const k = 1 + t * 0.5;
      s.sprite.scale.set(3.2 * s.base * k, 1.9 * s.base * k, 1);
      if (t >= 1) {
        this.scene.remove(s.sprite);
        mat.dispose();
        this.slashes.splice(i, 1);
      }
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.age += dt;
      const t = Math.min(s.age / s.life, 1);
      const pos = s.points.geometry.attributes.position as THREE.BufferAttribute;
      for (let j = 0; j < pos.count; j++) {
        s.velocity[j * 3 + 1] -= 12 * dt;
        pos.setXYZ(
          j,
          pos.getX(j) + s.velocity[j * 3] * dt,
          pos.getY(j) + s.velocity[j * 3 + 1] * dt,
          pos.getZ(j) + s.velocity[j * 3 + 2] * dt,
        );
      }
      pos.needsUpdate = true;
      const mat = s.points.material as THREE.PointsMaterial;
      mat.opacity = 1 - t;
      if (t >= 1) {
        this.scene.remove(s.points);
        s.points.geometry.dispose();
        mat.dispose();
        this.sparks.splice(i, 1);
      }
    }

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.age += dt;
      const t = Math.min(b.age / b.life, 1);
      const mat = b.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - t) * 0.95;
      b.mesh.scale.set(1 + t * 0.6, 1, 1 + t * 0.6);
      if (t >= 1) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        mat.dispose();
        this.beams.splice(i, 1);
      }
    }

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.age += dt;
      const t = Math.min(w.age / w.life, 1);
      const s = 0.4 + t * w.scale;
      w.mesh.scale.set(s, s, 1);
      const mat = w.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - t) * 0.8;
      if (t >= 1) {
        this.scene.remove(w.mesh);
        w.mesh.geometry.dispose();
        mat.dispose();
        this.waves.splice(i, 1);
      }
    }
  }
}

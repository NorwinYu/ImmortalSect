import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../core/math';
import { skyCloudTexture } from '../core/textures';

type SkyKey = {
  h: number;
  top: string;
  horizon: string;
  ground: string;
  sun: string;
  fog: string;
  hemiSky: string;
  hemiGround: string;
  density: number;
  exposure: number;
};

const KEYS: SkyKey[] = [
  {
    h: 0,
    top: '#070d19',
    horizon: '#182339',
    ground: '#05070b',
    sun: '#8fa6d8',
    fog: '#101827',
    hemiSky: '#2a3a55',
    hemiGround: '#0a0c0e',
    density: 0.0028,
    exposure: 0.82,
  },
  {
    h: 5.4,
    top: '#1d2c45',
    horizon: '#b97a58',
    ground: '#101216',
    sun: '#ffbc7a',
    fog: '#4a4050',
    hemiSky: '#3c4d68',
    hemiGround: '#151310',
    density: 0.0024,
    exposure: 0.94,
  },
  {
    h: 7.2,
    top: '#3c6289',
    horizon: '#e8c29b',
    ground: '#22241f',
    sun: '#ffd9ae',
    fog: '#b8a08a',
    hemiSky: '#7f9cb8',
    hemiGround: '#2b2a22',
    density: 0.002,
    exposure: 1.0,
  },
  {
    h: 12,
    top: '#4b7fb4',
    horizon: '#cfdfe4',
    ground: '#2b2f2a',
    sun: '#fff3df',
    fog: '#c6d2d4',
    hemiSky: '#9fc0d8',
    hemiGround: '#33362c',
    density: 0.00125,
    exposure: 1.12,
  },
  {
    h: 17.2,
    top: '#223a5e',
    horizon: '#ff9c52',
    ground: '#1b1915',
    sun: '#ffcc8c',
    fog: '#b07a58',
    hemiSky: '#7d8fa8',
    hemiGround: '#2b251c',
    density: 0.00135,
    exposure: 1.14,
  },
  {
    h: 18.6,
    top: '#1c2a44',
    horizon: '#bf6a52',
    ground: '#121317',
    sun: '#ff9a5f',
    fog: '#7c5860',
    hemiSky: '#4c5b78',
    hemiGround: '#1a1714',
    density: 0.0022,
    exposure: 0.94,
  },
  {
    h: 20.6,
    top: '#080e1b',
    horizon: '#1a2438',
    ground: '#05070b',
    sun: '#8fa6d8',
    fog: '#111a2a',
    hemiSky: '#2a3a55',
    hemiGround: '#0a0c0e',
    density: 0.0028,
    exposure: 0.84,
  },
  {
    h: 24,
    top: '#070d19',
    horizon: '#182339',
    ground: '#05070b',
    sun: '#8fa6d8',
    fog: '#101827',
    hemiSky: '#2a3a55',
    hemiGround: '#0a0c0e',
    density: 0.0028,
    exposure: 0.82,
  },
];

const SKY_VERT = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform float uNight;
  uniform float uTime;
  varying vec3 vWorldPosition;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldPosition - cameraPosition);
    float h = clamp(dir.y, 0.0, 1.0);

    vec3 col = mix(uHorizon, uTop, pow(h, 0.42));
    col = mix(uGround, col, smoothstep(-0.18, 0.02, dir.y));

    float sd = max(dot(dir, normalize(uSunDir)), 0.0);
    col += uSunColor * pow(sd, 900.0) * 2.2;
    col += uSunColor * pow(sd, 28.0) * 0.32;
    col += uSunColor * pow(sd, 4.0) * 0.07;

    float md = max(dot(dir, normalize(uMoonDir)), 0.0);
    col += vec3(0.72, 0.82, 1.0) * (smoothstep(0.9992, 0.9998, md) * 1.8 + pow(md, 90.0) * 0.10) * uNight;

    // High, thin clouds.
    vec2 cuv = dir.xz / max(dir.y, 0.06) * 0.5;
    float cl = fbm(cuv + vec2(uTime * 0.004, 0.0));
    cl = smoothstep(0.48, 0.8, cl) * smoothstep(0.02, 0.3, dir.y);
    vec3 cloudCol = mix(vec3(0.62, 0.60, 0.60), uSunColor, 0.34) * (0.5 + 0.5 * uNight);
    col = mix(col, cloudCol, cl * 0.52);

    // Stars.
    vec2 sp = floor(dir.xz * 1600.0);
    float star = step(0.9972, hash21(sp)) * uNight * smoothstep(0.06, 0.4, dir.y);
    col += vec3(star) * 0.9;

    // Horizon haze.
    float haze = exp(-abs(dir.y) * 9.0);
    col += uHorizon * haze * 0.10;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class SkySystem {
  readonly sun: THREE.DirectionalLight;
  readonly fill: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly ambient: THREE.AmbientLight;
  readonly sky: THREE.Mesh;
  private readonly cloudDome: THREE.Mesh;
  private readonly cloudMat: THREE.MeshBasicMaterial;
  readonly sunDir = new THREE.Vector3();
  readonly moonDir = new THREE.Vector3();
  readonly fogColor = new THREE.Color();
  night = 0;

  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly material: THREE.ShaderMaterial;
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly envScene: THREE.Scene;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private lastEnvHour = -99;
  private readonly keyColors = KEYS.map((k) => ({
    ...k,
    top: new THREE.Color(k.top),
    horizon: new THREE.Color(k.horizon),
    ground: new THREE.Color(k.ground),
    sun: new THREE.Color(k.sun),
    fog: new THREE.Color(k.fog),
    hemiSky: new THREE.Color(k.hemiSky),
    hemiGround: new THREE.Color(k.hemiGround),
  }));
  private readonly tmpA = new THREE.Color();

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.uniforms = {
      uTop: { value: new THREE.Color('#2b4259') },
      uHorizon: { value: new THREE.Color('#f0ab68') },
      uGround: { value: new THREE.Color('#1b1915') },
      uSunColor: { value: new THREE.Color('#ffcc8c') },
      uSunDir: { value: new THREE.Vector3(-0.9, 0.16, 0.34) },
      uMoonDir: { value: new THREE.Vector3(0.9, -0.16, -0.34) },
      uNight: { value: 0 },
      uTime: { value: 0 },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    const geo = new THREE.SphereGeometry(2200, 48, 24);
    this.sky = new THREE.Mesh(geo, this.material);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    scene.add(this.sky);

    const cloudMat = new THREE.MeshBasicMaterial({
      map: skyCloudTexture(),
      transparent: true,
      opacity: 0.5,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      color: '#f6d8bc',
    });
    this.cloudMat = cloudMat;
    this.cloudDome = new THREE.Mesh(new THREE.SphereGeometry(2120, 48, 24), cloudMat);
    this.cloudDome.renderOrder = -999;
    this.cloudDome.frustumCulled = false;
    scene.add(this.cloudDome);

    this.envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(geo, this.material);
    envSky.frustumCulled = false;
    this.envScene.add(envSky);

    this.sun = new THREE.DirectionalLight('#ffd9ae', 3.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -90;
    this.sun.shadow.camera.right = 90;
    this.sun.shadow.camera.top = 90;
    this.sun.shadow.camera.bottom = -90;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 420;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.035;
    this.sun.target.position.set(0, 0, -18);
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight('#7d8fa8', '#2b251c', 0.65);
    scene.add(this.hemi);

    this.fill = new THREE.DirectionalLight('#a8c4e0', 0.45);
    this.fill.position.set(-60, 40, -120);
    scene.add(this.fill);

    this.ambient = new THREE.AmbientLight('#1a2230', 0.32);
    scene.add(this.ambient);

    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();

    if (!scene.fog) scene.fog = new THREE.Fog('#b58f74', 42, 520);
    this.update(17.4, 0);
  }

  private sample(hour: number): (typeof this.keyColors)[number] {
    const keys = this.keyColors;
    let i = 0;
    while (i < keys.length - 1 && hour > keys[i + 1].h) i++;
    const a = keys[i];
    const b = keys[Math.min(i + 1, keys.length - 1)];
    const span = Math.max(0.0001, b.h - a.h);
    const t = smoothstep(0, 1, clamp((hour - a.h) / span, 0, 1));

    this.tmpA.copy(a.top).lerp(b.top, t);
    this.uniforms['uTop'].value.copy(this.tmpA);
    this.tmpA.copy(a.horizon).lerp(b.horizon, t);
    this.uniforms['uHorizon'].value.copy(this.tmpA);
    this.tmpA.copy(a.ground).lerp(b.ground, t);
    this.uniforms['uGround'].value.copy(this.tmpA);
    this.tmpA.copy(a.sun).lerp(b.sun, t);
    this.uniforms['uSunColor'].value.copy(this.tmpA);
    this.fogColor.copy(a.fog).lerp(b.fog, t);
    this.hemi.color.copy(a.hemiSky).lerp(b.hemiSky, t);
    this.hemi.groundColor.copy(a.hemiGround).lerp(b.hemiGround, t);

    return {
      ...a,
      density: lerp(a.density, b.density, t),
      exposure: lerp(a.exposure, b.exposure, t),
    } as (typeof this.keyColors)[number];
  }

  update(hour: number, dt: number, focus = new THREE.Vector3(0, 0, -18)): void {
    const key = this.sample(hour);

    const solar = ((hour - 6) / 24) * Math.PI * 2;
    this.sunDir.set(Math.cos(solar) * 0.95, Math.sin(solar), 0.12).normalize();
    this.moonDir.copy(this.sunDir).multiplyScalar(-1);

    const elevation = this.sunDir.y;
    const day = smoothstep(-0.08, 0.16, elevation);
    this.night = 1 - day;

    this.uniforms['uSunDir'].value.copy(this.sunDir);
    this.uniforms['uMoonDir'].value.copy(this.moonDir);
    this.uniforms['uNight'].value = this.night;
    this.uniforms['uTime'].value += dt * 0.6;
    this.sky.position.set(focus.x, 0, focus.z);
    this.cloudDome.position.set(focus.x, 0, focus.z);
    this.cloudDome.rotation.y += dt * 0.0025;
    this.cloudMat.opacity = 0.22 + day * 0.34;
    this.cloudMat.color.copy(this.uniforms['uSunColor'].value as THREE.Color).lerp(new THREE.Color('#d9e4ee'), 0.45);

    const useMoon = elevation < 0.02;
    const dir = useMoon ? this.moonDir : this.sunDir;

    this.sun.position.copy(focus).addScaledVector(dir, 170);
    this.fill.position.set(focus.x + 55, focus.y + 48, focus.z + 95);
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();

    this.tmpA.copy(key.sun);
    if (useMoon) this.tmpA.set('#9db4e0');
    this.sun.color.copy(this.tmpA);
    this.sun.intensity = useMoon ? 0.6 + 0.3 * this.night : 0.7 + 5.0 * day;

    this.hemi.intensity = lerp(0.4, 0.78, day);
    this.ambient.intensity = lerp(0.3, 0.16, day);

    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(this.fogColor);
      this.scene.fog.near = 42;
      this.scene.fog.far = 520;
    }

    this.renderer.toneMappingExposure = key.exposure;

    if (Math.abs(hour - this.lastEnvHour) > 1.1) {
      this.lastEnvHour = hour;
      this.updateEnvironment();
    }
  }

  private updateEnvironment(): void {
    const next = this.pmrem.fromScene(this.envScene, 0, 0.1, 5000);
    this.scene.environment = next.texture;
    this.scene.environmentIntensity = 0.55;
    if (this.envRT) this.envRT.dispose();
    this.envRT = next;
  }

  setShadowQuality(size: number): void {
    if (this.sun.shadow.mapSize.x === size) return;
    this.sun.shadow.mapSize.set(size, size);
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
    this.sun.shadow.camera.updateProjectionMatrix();
  }

  setExposure(v: number): void {
    this.renderer.toneMappingExposure = v;
  }
}

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

/**
 * Final display-space grade: cool shadows, warm highlights, gentle vignette,
 * a whisper of grain. Keeps every frame feeling like the same film stock.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uVignette: { value: 1 },
    uGrain: { value: 0.028 },
    uSaturation: { value: 1.13 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uSaturation;
    varying vec2 vUv;

    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 c = src.rgb;

      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);

      // cool shadows / warm highs
      c += vec3(-0.018, 0.002, 0.022) * (1.0 - smoothstep(0.0, 0.55, l));
      c += vec3(0.020, 0.011, -0.004) * smoothstep(0.45, 1.0, l);

      // gentle S-curve
      c = clamp(c, 0.0, 1.0);
      c = c * c * (3.0 - 2.0 * c) * 0.38 + c * 0.62;
      c = pow(c, vec3(0.985, 1.0, 1.012));

      // vignette
      vec2 p = vUv - 0.5;
      float d = length(p) * 1.15;
      float vig = smoothstep(0.88, 0.28, d);
      c *= mix(1.0, vig, 0.62 * uVignette);

      // animated grain (very subtle)
      float n = fract(sin(dot(vUv * vec2(1273.1, 931.7) + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * uGrain;

      gl_FragColor = vec4(c, src.a);
    }
  `,
};

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly grade: ShaderPass;
  readonly fxaa: ShaderPass;
  private readonly stage: HTMLElement;

  constructor(stage: HTMLElement) {
    this.stage = stage;

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Touch devices render at a much higher DPR; cap harder to protect framerate.
    const coarse =
      (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
    const dprCap = coarse ? 1.4 : 1.75;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.tabIndex = 0;
    this.stage.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#10141c');
    this.scene.fog = new THREE.FogExp2('#b98a6e', 0.0019);

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      2600,
    );
    this.camera.position.set(0, 4.2, 32);
    this.camera.lookAt(0, 2.2, -18);

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloom = new UnrealBloomPass(size, 0.48, 0.58, 0.8);
    this.composer.addPass(this.bloom);

    this.composer.addPass(new OutputPass());

    this.fxaa = new ShaderPass(FXAAShader);
    this.fxaa.material.uniforms['resolution'].value.set(
      1 / (window.innerWidth * this.renderer.getPixelRatio()),
      1 / (window.innerHeight * this.renderer.getPixelRatio()),
    );
    this.composer.addPass(this.fxaa);

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.fxaa.material.uniforms['resolution'].value.set(1 / (w * pr), 1 / (h * pr));
  }

  setExposure(v: number): void {
    this.renderer.toneMappingExposure = v;
  }

  render(dt: number): void {
    this.grade.material.uniforms['uTime'].value += dt;
    this.composer.render(dt);
  }

  get info(): THREE.WebGLRenderer['info'] {
    return this.renderer.info;
  }
}

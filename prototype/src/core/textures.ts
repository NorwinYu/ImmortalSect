import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [canvas, ctx];
}

function toTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  srgb = true,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Very subtle monochrome grain — multiplied with vertex colours on the terrain. */
export function grainTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const img = ctx.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 208 + Math.floor(Math.random() * 47);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas, 96, 96);
}

/** Mottled grass / earth detail, multiplied over the terrain's vertex colours. */
export function groundTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#d8d8cc';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 8 + Math.random() * 46;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() > 0.45;
    g.addColorStop(0, dark ? 'rgba(92,104,72,0.2)' : 'rgba(214,214,178,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  for (let i = 0; i < 2200; i++) {
    const a = Math.random() * 0.12;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(70,82,56,${a})` : `rgba(230,230,200,${a})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.6, 1.6);
  }

  return toTexture(canvas, 1, 1);
}

/** Grey stone slabs for the mountain path. */
export function stoneTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#b9ae9a';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 8;
  const cols = 6;
  const tileH = 64;
  const tileW = 86;

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : tileW * 0.5;
    for (let c = -1; c < cols + 1; c++) {
      const x = c * tileW + offset;
      const y = r * tileH;
      const shade = 0.9 + Math.random() * 0.16;
      const rr = Math.round(205 * shade);
      const gg = Math.round(195 * shade);
      const bb = Math.round(178 * shade);

      ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, tileW - 4, tileH - 4, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(92,84,70,0.3)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  // Soft mottling and wear.
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 10 + Math.random() * 40;
    const light = Math.random() > 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, light ? 'rgba(255,248,232,0.05)' : 'rgba(78,68,52,0.045)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  for (let i = 0; i < 1600; i++) {
    const a = Math.random() * 0.09;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,245,225,${a})` : `rgba(60,52,40,${a})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.4, 1.4);
  }

  return toTexture(canvas, 1, 1);
}

/** Dark blue-grey roof tiles. */
export function roofTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#5b6d72';
  ctx.fillRect(0, 0, 256, 256);

  // Barrel tiles running down the slope.
  for (let x = 0; x < 256; x += 14) {
    ctx.fillStyle = 'rgba(16,24,26,0.38)';
    ctx.fillRect(x, 0, 4, 256);
    ctx.fillStyle = 'rgba(190,210,212,0.18)';
    ctx.fillRect(x + 4, 0, 2, 256);
    ctx.fillStyle = 'rgba(210,226,228,0.07)';
    ctx.fillRect(x + 7, 0, 2, 256);
  }

  // Tile courses.
  for (let y = 0; y < 256; y += 26) {
    ctx.fillStyle = 'rgba(16,24,26,0.28)';
    ctx.fillRect(0, y, 256, 3);
    ctx.fillStyle = 'rgba(190,210,212,0.1)';
    ctx.fillRect(0, y + 3, 256, 2);
  }

  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(180,200,200,${Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 4, 1);
  }
  return toTexture(canvas, 3, 3);
}

/** A tile normal map so the roofs catch the low sun. */
export function roofNormalTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const hx = Math.sin((x / 14) * Math.PI * 2) * 0.5;
      const hy = Math.sin((y / 26) * Math.PI * 2) * 0.28;
      const dx = Math.cos((x / 14) * Math.PI * 2) * 0.5 * 1.2;
      const dy = Math.cos((y / 26) * Math.PI * 2) * 0.28 * 0.8;
      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * 256 + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
      void hx;
      void hy;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Warm paper behind a dark timber lattice. */
export function latticeTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 170);
  grad.addColorStop(0, '#d8bc8a');
  grad.addColorStop(0.65, '#b99a6b');
  grad.addColorStop(1, '#6f5334');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#2a1f18';
  ctx.fillRect(0, 0, 256, 10);
  ctx.fillRect(0, 246, 256, 10);
  ctx.fillRect(0, 0, 10, 256);
  ctx.fillRect(246, 0, 10, 256);
  for (let i = 1; i < 5; i++) {
    ctx.fillRect((256 / 5) * i - 3, 10, 6, 236);
    ctx.fillRect(10, (256 / 5) * i - 3, 236, 6);
  }
  ctx.fillStyle = 'rgba(42,31,24,0.35)';
  ctx.fillRect(10, 122, 236, 8);
  return toTexture(canvas, 1, 1);
}

/** Vertical sect banner. */
export function bannerTexture(text: string): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(160, 640);
  const grad = ctx.createLinearGradient(0, 0, 0, 640);
  grad.addColorStop(0, '#24474a');
  grad.addColorStop(0.55, '#1b383c');
  grad.addColorStop(1, '#12282c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 160, 640);

  ctx.strokeStyle = 'rgba(200,161,90,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 140, 620);

  ctx.fillStyle = 'rgba(200,161,90,0.16)';
  ctx.beginPath();
  ctx.arc(80, 520, 64, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e6d3a6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '76px "Songti SC", "STSong", serif';
  const chars = text.split('');
  chars.forEach((ch, i) => {
    ctx.fillText(ch, 80, 100 + i * 96);
  });

  ctx.fillStyle = 'rgba(200,161,90,0.8)';
  ctx.font = '18px "Songti SC", serif';
  ctx.fillText('宗', 80, 585);

  return toTexture(canvas, 1, 1);
}

/** Wooden plaque with gold characters. */
export function plaqueTexture(text: string): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 192);
  ctx.fillStyle = '#241913';
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = '#a8844c';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 172);
  ctx.strokeStyle = 'rgba(200,161,90,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, 468, 148);

  ctx.fillStyle = '#d9b979';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '86px "Songti SC", "STSong", serif';
  ctx.fillText(text, 256, 100);

  return toTexture(canvas, 1, 1);
}

/** Soft cloud puff — alpha only, used for the cloud sea and mist. */
export function cloudTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(1024, 1024);
  ctx.clearRect(0, 0, 1024, 1024);
  ctx.filter = 'blur(26px)';
  for (let i = 0; i < 90; i++) {
    const x = 120 + Math.random() * 784;
    const y = 160 + Math.random() * 704;
    const r = 60 + Math.random() * 150;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.06 + Math.random() * 0.12;
    g.addColorStop(0, `rgba(255,248,235,${a})`);
    g.addColorStop(0.6, `rgba(255,244,226,${a * 0.5})`);
    g.addColorStop(1, 'rgba(255,244,226,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = 'none';
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Painted cloud bands for the sky dome (equirectangular-ish). */
export function skyCloudTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(1024, 512);
  ctx.clearRect(0, 0, 1024, 512);
  ctx.filter = 'blur(22px)';

  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 1024;
    const y = 40 + Math.random() * 230;
    const rx = 50 + Math.random() * 180;
    const ry = 12 + Math.random() * 38;
    const a = 0.04 + Math.random() * 0.09;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, `rgba(255,242,224,${a})`);
    g.addColorStop(0.55, `rgba(255,236,214,${a * 0.55})`);
    g.addColorStop(1, 'rgba(255,236,214,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.filter = 'blur(7px)';
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 1024;
    const y = 70 + Math.random() * 200;
    const w = 120 + Math.random() * 260;
    ctx.fillStyle = `rgba(255,246,232,${0.02 + Math.random() * 0.04})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.filter = 'none';
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Crescent slash for combat VFX. */
export function slashTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.clearRect(0, 0, 256, 256);
  ctx.translate(128, 128);
  ctx.filter = 'blur(3px)';

  const grad = ctx.createLinearGradient(-100, 0, 100, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.55, 'rgba(255,255,255,1)');
  grad.addColorStop(0.85, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.strokeStyle = grad;
  ctx.lineCap = 'round';
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.arc(0, 0, 82, -1.15, 1.15);
  ctx.stroke();

  ctx.filter = 'blur(1px)';
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(0, 0, 82, -1.05, 1.05);
  ctx.stroke();

  ctx.filter = 'none';
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A single drifting petal. */
export function petalTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(64, 64);
  ctx.clearRect(0, 0, 64, 64);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 28);
  g.addColorStop(0, 'rgba(255,236,232,1)');
  g.addColorStop(0.6, 'rgba(244,196,198,0.9)');
  g.addColorStop(1, 'rgba(244,196,198,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(32, 32, 22, 12, Math.PI / 5, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft radial glow for dust / fireflies. */
export function glowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,240,210,0.7)');
  g.addColorStop(1, 'rgba(255,230,180,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Grass blades with alpha. */
export function grassTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 9; i++) {
    const x = 30 + Math.random() * 68;
    const h = 50 + Math.random() * 66;
    const lean = (Math.random() - 0.5) * 34;
    const g = ctx.createLinearGradient(x, 128, x + lean, 128 - h);
    g.addColorStop(0, 'rgba(48,72,44,0.95)');
    g.addColorStop(0.55, 'rgba(92,118,66,0.95)');
    g.addColorStop(1, 'rgba(140,156,92,0.55)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, 128);
    ctx.quadraticCurveTo(x + lean * 0.3, 128 - h * 0.55, x + lean, 128 - h);
    ctx.stroke();
  }
  return toTexture(canvas, 1, 1);
}

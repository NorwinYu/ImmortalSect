import type { Disciple } from './state';

type HairStyle = 'topknot' | 'loose' | 'bun' | 'side' | 'short' | 'old';
type Extra = 'sword' | 'herb' | 'fan' | 'needle';

interface Style {
  hair: HairStyle;
  faceRx: number;
  faceRy: number;
  eyeY: number;
  brow: number;
  mouth: number;
  skin: string;
  lips: string;
  hairColor?: string;
  beard?: boolean;
  wrinkles?: boolean;
  freckles?: boolean;
  headband?: boolean;
  bangs?: 'full' | 'side' | 'spiky';
  extra?: Extra;
  streak?: boolean;
}

const STYLES: Record<string, Style> = {
  gu: {
    hair: 'topknot',
    faceRx: 48, faceRy: 59, eyeY: 186, brow: -0.14, mouth: 0,
    skin: '#e0b894', lips: '#8d5b4c', extra: 'sword',
  },
  shen: {
    hair: 'loose',
    faceRx: 44, faceRy: 60, eyeY: 187, brow: 0.18, mouth: -0.2,
    skin: '#e7d2c3', lips: '#8f5b5b', extra: 'sword', streak: true,
  },
  su: {
    hair: 'bun',
    faceRx: 49, faceRy: 57, eyeY: 184, brow: -0.04, mouth: 0.45,
    skin: '#e8c6a4', lips: '#a85f58', bangs: 'side', extra: 'herb',
  },
  lu: {
    hair: 'side',
    faceRx: 46, faceRy: 55, eyeY: 182, brow: 0.06, mouth: 0.35,
    skin: '#e3bd97', lips: '#9c5f55', bangs: 'full', extra: 'herb',
  },
  bai: {
    hair: 'loose',
    faceRx: 45, faceRy: 58, eyeY: 188, brow: 0.08, mouth: -0.1,
    skin: '#e6d4c6', lips: '#9a6565', headband: true, extra: 'needle',
  },
  qi: {
    hair: 'short',
    faceRx: 50, faceRy: 54, eyeY: 184, brow: -0.06, mouth: 0.55,
    skin: '#e2b083', lips: '#a45d4b', freckles: true, bangs: 'spiky',
  },
  xuan: {
    hair: 'old',
    faceRx: 50, faceRy: 60, eyeY: 188, brow: 0.12, mouth: -0.15,
    skin: '#cba57f', lips: '#7a5045', beard: true, wrinkles: true,
    hairColor: '#6f6a61',
  },
};

const cache = new Map<string, string>();

function canvas(size = 320, height = 420): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('portrait canvas unavailable');
  return [c, ctx];
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  rotation = 0,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function stroke(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  color: string,
  width: number,
): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function seal(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.03);
  ctx.fillStyle = 'rgba(165,58,45,0.9)';
  ctx.fillRect(-15, -15, 30, 30);
  ctx.strokeStyle = 'rgba(240,225,205,0.65)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-13, -13, 26, 26);
  ctx.fillStyle = 'rgba(240,225,205,0.92)';
  ctx.font = '18px "Songti SC", "STSong", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

function drawHair(
  ctx: CanvasRenderingContext2D,
  style: Style,
  color: string,
  accent: string,
  cx: number,
): void {
  const { hair, faceRx, faceRy } = style;
  const capY = 184 - faceRy + 8;
  const capRx = faceRx * 1.14;
  const capRy = faceRy * 0.82;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, capY, capRx, capRy, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  switch (hair) {
    case 'topknot': {
      ellipse(ctx, cx, capY - capRy * 0.85, 17, 23, color);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 17, capY - capRy * 0.85);
      ctx.lineTo(cx + 17, capY - capRy * 0.85);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(cx - capRx, capY - 2, 9, 46);
      ctx.fillRect(cx + capRx - 9, capY - 2, 9, 46);
      break;
    }
    case 'loose': {
      ctx.beginPath();
      ctx.moveTo(cx - capRx + 4, capY + 6);
      ctx.quadraticCurveTo(cx - capRx - 18, 250, cx - capRx + 2, 310);
      ctx.lineWidth = 22;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + capRx - 4, capY + 6);
      ctx.quadraticCurveTo(cx + capRx + 18, 250, cx + capRx - 2, 310);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(240,235,225,0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, capY - capRy + 4);
      ctx.lineTo(cx, capY + 20);
      ctx.stroke();
      break;
    }
    case 'bun': {
      ellipse(ctx, cx, capY - capRy * 0.9, 21, 19, color);
      ellipse(ctx, cx + 26, capY - capRy * 0.7, 5, 7, accent);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 24, capY - capRy * 0.7);
      ctx.lineTo(cx + 24, capY - capRy * 0.95);
      ctx.stroke();
      break;
    }
    case 'side': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx + capRx * 0.7, capY + 8, 15, 20, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + capRx * 0.6, capY + 18);
      ctx.quadraticCurveTo(cx + capRx + 20, 240, cx + capRx - 4, 300);
      ctx.lineWidth = 16;
      ctx.strokeStyle = color;
      ctx.stroke();
      break;
    }
    case 'short': {
      ctx.strokeStyle = color;
      ctx.lineWidth = 7;
      for (let i = 0; i < 7; i++) {
        const x = cx - capRx + 10 + (i * (capRx * 2 - 20)) / 6;
        ctx.beginPath();
        ctx.moveTo(x, capY - capRy + 8);
        ctx.lineTo(x - 4 + (i % 2) * 8, capY - capRy - 12);
        ctx.stroke();
      }
      break;
    }
    case 'old': {
      ctx.fillStyle = color;
      ctx.fillRect(cx - capRx, capY - 4, 11, 60);
      ctx.fillRect(cx + capRx - 11, capY - 4, 11, 60);
      ctx.strokeStyle = 'rgba(240,235,225,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 30, capY - 6);
      ctx.lineTo(cx + 20, capY - 10);
      ctx.stroke();
      break;
    }
  }

  if (style.bangs === 'full') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, capY + 14, faceRx * 0.95, 20, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  } else if (style.bangs === 'side') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - faceRx, capY + 18);
    ctx.quadraticCurveTo(cx - 10, capY - 2, cx + faceRx * 0.8, capY + 8);
    ctx.lineTo(cx + faceRx * 0.8, capY + 24);
    ctx.quadraticCurveTo(cx - 4, capY + 18, cx - faceRx, capY + 34);
    ctx.closePath();
    ctx.fill();
  } else if (style.bangs === 'spiky') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    for (let i = 0; i < 5; i++) {
      const x = cx - 26 + i * 13;
      ctx.beginPath();
      ctx.moveTo(x, capY + 12);
      ctx.lineTo(x + 4, capY + 26);
      ctx.stroke();
    }
  }

  if (style.headband) {
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(cx - faceRx - 4, capY + 20, faceRx * 2 + 8, 7);
    ctx.globalAlpha = 1;
  }

  if (style.streak) {
    ctx.strokeStyle = 'rgba(235,240,245,0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - capRx + 10, capY + 30);
    ctx.quadraticCurveTo(cx - capRx + 2, 230, cx - capRx + 8, 290);
    ctx.stroke();
  }
}

/**
 * A procedurally painted, ink-wash bust. Silhouette first, one or two details
 * second; it is meant to sit in the ledger like an album leaf.
 */
export function portraitFor(d: Disciple): string {
  const cached = cache.get(d.id);
  if (cached) return cached;

  const [c, ctx] = canvas();
  const style = STYLES[d.id] ?? STYLES.gu;
  const { robe, accent } = d.palette;
  const hairColor = style.hairColor ?? d.palette.hair;
  const cx = 160;

  const bg = ctx.createLinearGradient(0, 0, 0, 420);
  bg.addColorStop(0, '#efe7d7');
  bg.addColorStop(0.55, '#e4dac6');
  bg.addColorStop(1, '#cfc2aa');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 320, 420);

  for (let i = 0; i < 6; i++) {
    const x = 40 + Math.random() * 240;
    const y = 30 + Math.random() * 360;
    const r = 40 + Math.random() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, i % 2 === 0 ? 'rgba(72,82,66,0.08)' : 'rgba(120,96,62,0.07)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  ellipse(ctx, cx, 168, 92, 98, 'rgba(255,250,238,0.35)');

  ctx.beginPath();
  ctx.moveTo(20, 420);
  ctx.bezierCurveTo(28, 336, 74, 300, 116, 292);
  ctx.lineTo(cx, 330);
  ctx.lineTo(204, 292);
  ctx.bezierCurveTo(246, 300, 292, 336, 300, 420);
  ctx.closePath();
  ctx.fillStyle = robe;
  ctx.fill();
  ctx.strokeStyle = 'rgba(35,30,24,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.75;
  ctx.fillRect(42, 394, 236, 11);
  ctx.globalAlpha = 1;

  if (d.id === 'su') {
    for (let i = 0; i < 7; i++) {
      ellipse(ctx, 60 + i * 30, 340 + (i % 3) * 18, 3, 2, 'rgba(240,230,210,0.35)');
    }
  } else if (d.id === 'qi') {
    ctx.fillStyle = 'rgba(240,225,200,0.2)';
    ctx.fillRect(52, 350, 20, 20);
  } else if (d.id === 'bai') {
    ctx.strokeStyle = 'rgba(143,208,196,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(238, 360);
    ctx.quadraticCurveTo(250, 330, 246, 312);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(118, 296);
  ctx.lineTo(cx, 338);
  ctx.lineTo(202, 296);
  ctx.lineTo(188, 284);
  ctx.lineTo(cx, 314);
  ctx.lineTo(132, 284);
  ctx.closePath();
  ctx.fillStyle = 'rgba(233,225,209,0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(35,30,24,0.4)';
  ctx.stroke();

  ctx.fillStyle = '#cf9f79';
  ctx.fillRect(cx - 17, 262, 34, 44);

  const faceGrad = ctx.createRadialGradient(cx - 10, 168, 8, cx, 184, style.faceRy + 10);
  faceGrad.addColorStop(0, style.skin);
  faceGrad.addColorStop(1, 'rgba(150,110,84,0.92)');
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.ellipse(cx, 184, style.faceRx, style.faceRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(54,42,32,0.42)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawHair(ctx, style, hairColor, accent, cx);

  const eyeX = style.faceRx * 0.3;
  ctx.strokeStyle = 'rgba(42,32,26,0.9)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx - eyeX - 9, style.eyeY - 12);
  ctx.lineTo(cx - eyeX + 9, style.eyeY - 12 + style.brow * 22);
  ctx.moveTo(cx + eyeX - 9, style.eyeY - 12 + style.brow * 22);
  ctx.lineTo(cx + eyeX + 9, style.eyeY - 12);
  ctx.stroke();

  const eyeH = style.hair === 'old' ? 2.2 : 3.2;
  ellipse(ctx, cx - eyeX, style.eyeY, 5, eyeH, 'rgba(30,25,22,0.92)');
  ellipse(ctx, cx + eyeX, style.eyeY, 5, eyeH, 'rgba(30,25,22,0.92)');
  ellipse(ctx, cx - eyeX + 1, style.eyeY - 1, 1.4, 1.4, 'rgba(250,245,235,0.9)');
  ellipse(ctx, cx + eyeX + 1, style.eyeY - 1, 1.4, 1.4, 'rgba(250,245,235,0.9)');

  stroke(ctx, [[cx, style.eyeY + 4], [cx - 3, style.eyeY + 21], [cx + 3, style.eyeY + 22]], 'rgba(120,84,62,0.5)', 1.6);
  const mouthY = 184 + style.faceRy * 0.55;
  ctx.beginPath();
  ctx.moveTo(cx - 12, mouthY);
  ctx.quadraticCurveTo(cx, mouthY + style.mouth * 10, cx + 12, mouthY);
  ctx.strokeStyle = style.lips;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  if (style.freckles) {
    for (let i = 0; i < 8; i++) {
      const sx = Math.random() > 0.5 ? 1 : -1;
      ellipse(ctx, cx + sx * (12 + Math.random() * 22), mouthY - 20 + Math.random() * 12, 1.2, 1.2, 'rgba(140,90,60,0.35)');
    }
  }

  if (style.wrinkles) {
    ctx.strokeStyle = 'rgba(90,70,55,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - eyeX - 14, style.eyeY + 10);
    ctx.quadraticCurveTo(cx - eyeX, style.eyeY + 14, cx - eyeX + 12, style.eyeY + 9);
    ctx.moveTo(cx + eyeX - 12, style.eyeY + 9);
    ctx.quadraticCurveTo(cx + eyeX, style.eyeY + 14, cx + eyeX + 14, style.eyeY + 10);
    ctx.stroke();
  }

  if (style.beard) {
    ctx.beginPath();
    ctx.moveTo(cx - 22, mouthY + 4);
    ctx.quadraticCurveTo(cx, mouthY + 70, cx + 22, mouthY + 4);
    ctx.fillStyle = 'rgba(80,76,70,0.55)';
    ctx.fill();
  }

  if (style.extra === 'sword') {
    ctx.save();
    ctx.translate(254, 302);
    ctx.rotate(-0.5);
    ctx.fillStyle = '#2c2722';
    ctx.fillRect(-4, -46, 8, 92);
    ctx.fillStyle = accent;
    ctx.fillRect(-12, -48, 24, 6);
    ctx.restore();
  } else if (style.extra === 'herb') {
    ctx.strokeStyle = '#5f7a4e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(252, 330);
    ctx.quadraticCurveTo(270, 292, 262, 268);
    ctx.stroke();
    ellipse(ctx, 262, 266, 9, 5, '#6f8b58', -0.5);
    ellipse(ctx, 250, 286, 8, 4, '#7e9a62', 0.5);
  } else if (style.extra === 'needle') {
    ctx.strokeStyle = '#b9c6c1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(246, 300);
    ctx.lineTo(276, 272);
    ctx.stroke();
    ellipse(ctx, 278, 270, 4, 4, accent);
  } else if (style.extra === 'fan') {
    ctx.beginPath();
    ctx.moveTo(238, 320);
    ctx.quadraticCurveTo(270, 286, 286, 320);
    ctx.strokeStyle = 'rgba(60,50,40,0.6)';
    ctx.stroke();
  }

  const lower = ctx.createLinearGradient(0, 340, 0, 420);
  lower.addColorStop(0, 'rgba(60,50,40,0)');
  lower.addColorStop(1, 'rgba(60,50,40,0.18)');
  ctx.fillStyle = lower;
  ctx.fillRect(0, 340, 320, 80);

  for (let i = 0; i < 900; i++) {
    const a = Math.random() * 0.045;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(60,50,40,${a})` : `rgba(255,250,235,${a})`;
    ctx.fillRect(Math.random() * 320, Math.random() * 420, 1, 1);
  }

  const vig = ctx.createRadialGradient(cx, 190, 80, cx, 200, 260);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(40,30,20,0.24)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, 320, 420);

  seal(ctx, 278, 386, '青');

  const url = c.toDataURL('image/png');
  cache.set(d.id, url);
  return url;
}

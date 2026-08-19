export const CONFIG = Object.freeze({ bpm: 115, fps: 60, width: 1080, height: 1920 });
export const FORM = Object.freeze(['I','I','I','I','IV','IV','I','I','V','IV','I','V']);
export const beatDuration = 60 / CONFIG.bpm;
export const barDuration = beatDuration * 4;
export const duration = barDuration * 12;
export const frameCount = Math.round(duration * CONFIG.fps);

const COLORS = { I: '#506b82', IV: '#c66f52', V: '#d7a62f' };
const LABELS = ['PHRASE 01', 'PHRASE 02', 'TURNAROUND'];
const SUBLABELS = ['TONIC · I — I — I — I', 'MOVE TO IV · IV — IV — I — I', 'V — IV — I — V'];
const canvas = document.querySelector('#overlay');
const ctx = canvas.getContext('2d', { alpha: true });

function roundedRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}

function text(value, x, y, size, weight = 500, align = 'left', alpha = 1, color = '#f4f1e9') {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`; ctx.textAlign = align;
  ctx.textBaseline = 'middle'; ctx.fillText(value, x, y); ctx.restore();
}

export function stateAtTime(rawTime) {
  const time = Math.max(0, Math.min(rawTime, duration - Number.EPSILON));
  const barIndex = Math.min(11, Math.floor(time / barDuration));
  const timeInBar = time - barIndex * barDuration;
  const beatIndex = Math.floor(time / beatDuration);
  const beatInBar = beatIndex % 4;
  const beatPosition = time - beatIndex * beatDuration;
  return { time, barIndex, timeInBar, beatIndex, beatInBar, beatPosition, degree: FORM[barIndex] };
}

export function renderAtTime(timeInSeconds) {
  const s = stateAtTime(timeInSeconds);
  ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);

  // Header and absolute-time metronome.
  const headerY = 410;
  text('NOW PLAYING', 170, headerY, 23, 700, 'left', .72);
  text(`BAR ${String(s.barIndex + 1).padStart(2, '0')}`, 170, headerY + 61, 48, 700);
  text(s.degree, 850, headerY + 34, 78, 700, 'center', 1, COLORS[s.degree]);
  const flashDuration = .13;
  const flash = s.beatPosition < flashDuration ? Math.pow(1 - s.beatPosition / flashDuration, 1.8) : 0;
  const downbeat = s.beatInBar === 0;
  ctx.save(); ctx.fillStyle = COLORS[s.degree]; ctx.shadowColor = COLORS[s.degree];
  ctx.shadowBlur = 10 + flash * 32; ctx.globalAlpha = .2 + flash * .8;
  ctx.beginPath(); ctx.arc(130, headerY + 3, (downbeat ? 10 : 8) + flash * (downbeat ? 8 : 5), 0, Math.PI * 2); ctx.fill(); ctx.restore();

  const left = 130, totalW = 820, segmentW = totalW / 4;
  const trackY = [690, 990, 1290], trackH = 98;
  for (let row = 0; row < 3; row++) {
    text(LABELS[row], left, trackY[row] - 64, 22, 700, 'left', .68);
    text(SUBLABELS[row], left, trackY[row] - 31, 15, 600, 'left', .52, COLORS[FORM[row * 4]]);
    for (let column = 0; column < 4; column++) {
      const index = row * 4 + column, x = left + column * segmentW, degree = FORM[index];
      ctx.save(); ctx.beginPath(); ctx.roundRect(left, trackY[row], totalW, trackH, 12); ctx.clip();
      ctx.fillStyle = COLORS[degree]; ctx.globalAlpha = .13; ctx.fillRect(x, trackY[row], segmentW, trackH); ctx.restore();
      let progress = 0, alpha = .18;
      if (index < s.barIndex) { progress = 1; alpha = .48; }
      else if (index === s.barIndex) { progress = s.timeInBar / barDuration; alpha = 1; }
      if (progress > 0) {
        ctx.save(); ctx.beginPath(); ctx.roundRect(left, trackY[row], totalW, trackH, 12); ctx.clip();
        ctx.fillStyle = COLORS[degree]; ctx.globalAlpha = alpha; ctx.fillRect(x, trackY[row], segmentW * progress, trackH); ctx.restore();
      }
      ctx.globalAlpha = index === s.barIndex ? 1 : index < s.barIndex ? .58 : .32;
      text(degree, x + segmentW / 2, trackY[row] + trackH / 2 + 1, 39, 700, 'center', ctx.globalAlpha);
      text(String(index + 1).padStart(2, '0'), x + 10, trackY[row] + trackH + 28, 15, 600, 'left', .34);
      if (column > 0) { ctx.fillStyle = '#eef1ed'; ctx.globalAlpha = .18; ctx.fillRect(x - 1, trackY[row] + 12, 2, trackH - 24); }
    }
  }
  ctx.globalAlpha = 1;
}

window.renderAtTime = renderAtTime;
window.BLUES_EXPORT = { ...CONFIG, beatDuration, barDuration, duration, frameCount, form: FORM };
if (!new URLSearchParams(location.search).has('export')) {
  const started = performance.now();
  const tick = now => { renderAtTime(((now - started) / 1000) % duration); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
} else renderAtTime(0);

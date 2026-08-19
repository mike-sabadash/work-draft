import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const frames = join(root, 'build/frames');
const out = join(root, 'dist');
const bpm = Number(process.env.BPM || 115);
const fps = 60;
const beatDuration = 60 / bpm;
const barDuration = beatDuration * 4;
const musicalDuration = barDuration * 12;
const frameCount = Math.ceil(musicalDuration * fps);
const form = ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'];

if (!Number.isFinite(bpm) || bpm <= 0) throw new Error('BPM must be a positive number.');
await rm(join(root, 'build'), { recursive: true, force: true });
await rm(out, { recursive: true, force: true });
await mkdir(frames, { recursive: true });
await mkdir(out, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = resolve(root, requested);
    if (!file.startsWith(`${root}/`)) throw new Error('Invalid path');
    response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise(resolveListen => server.listen(4173, '127.0.0.1', resolveListen));

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4173/?export', { waitUntil: 'networkidle' });
  for (let frame = 0; frame < frameCount; frame += 1) {
    await page.evaluate(time => window.renderAtTime(time), frame / fps);
    await page.locator('#overlay').screenshot({ path: join(frames, `${String(frame).padStart(6, '0')}.png`), omitBackground: true });
    if (frame % 120 === 0) process.stdout.write(`\r${frame}/${frameCount}`);
  }
  const controls = [
    ['control-bar-01-start.png', 0],
    ['control-bar-05-mid.png', 4.5 * barDuration],
    ['control-bar-09-turnaround.png', 8 * barDuration],
  ];
  for (const [name, time] of controls) {
    await page.evaluate(renderTime => window.renderAtTime(renderTime), time);
    await page.locator('#overlay').screenshot({ path: join(out, name), omitBackground: true });
  }
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-y', ...args], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg failed with status ${result.status}`);
}
const input = ['-framerate', String(fps), '-i', join(frames, '%06d.png')];
ffmpeg([...input, '-frames:v', String(frameCount), '-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', join(out, `12-bar-blues-${bpm}bpm-alpha.mov`)]);
ffmpeg([...input, '-frames:v', String(frameCount), '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-crf', '18', '-b:v', '0', '-metadata:s:v:0', 'alpha_mode=1', join(out, `12-bar-blues-${bpm}bpm-alpha.webm`)]);
ffmpeg([...input, '-f', 'lavfi', '-i', `color=c=#11151b:s=1080x1920:r=${fps}`, '-filter_complex', '[1:v][0:v]overlay=shortest=1:format=auto,format=yuv420p', '-frames:v', String(frameCount), '-c:v', 'libx264', '-crf', '18', '-movflags', '+faststart', join(out, `12-bar-blues-${bpm}bpm-preview.mp4`)]);

const barStarts = form.map((degree, index) => ({ bar: index + 1, degree, time: index * barDuration }));
const beatStarts = Array.from({ length: 48 }, (_, index) => ({
  beat: index + 1,
  bar: Math.floor(index / 4) + 1,
  beatInBar: index % 4 + 1,
  time: index * beatDuration,
  downbeat: index % 4 === 0,
}));
await writeFile(join(out, 'render-manifest.json'), `${JSON.stringify({
  bpm, fps, width: 1080, height: 1920, timeSignature: '4/4', bars: 12, beats: 48,
  form: 'I—I—I—I / IV—IV—I—I / V—IV—I—V', formByBar: form,
  beatDuration, barDuration, musicalDuration, frameCount, containerDuration: frameCount / fps,
  barStarts, beatStarts,
  controls: ['control-bar-01-start.png', 'control-bar-05-mid.png', 'control-bar-09-turnaround.png'],
}, null, 2)}\n`);
console.log(`\nRendered ${frameCount} frames (${frameCount / fps}s; music ${musicalDuration}s).`);

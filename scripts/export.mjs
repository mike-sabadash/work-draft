import { spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..'), frames = join(root, 'build/frames'), out = join(root, 'dist');
const bpm = Number(process.env.BPM || 115), fps = 60, duration = 2880 / bpm, frameCount = Math.round(duration * fps);
await rm(join(root, 'build'), { recursive: true, force: true }); await mkdir(frames, { recursive: true }); await mkdir(out, { recursive: true });
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const server = createServer(async (req,res) => { try { const p = join(root, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]); res.setHeader('Content-Type', types[extname(p)] || 'application/octet-stream'); res.end(await readFile(p)); } catch { res.statusCode=404; res.end(); } }).listen(4173);
const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width:1080, height:1920 }, deviceScaleFactor:1 });
await page.goto('http://127.0.0.1:4173/?export');
for (let f=0; f<frameCount; f++) { await page.evaluate(t => window.renderAtTime(t), f/fps); await page.locator('#overlay').screenshot({ path:join(frames, `${String(f).padStart(6,'0')}.png`), omitBackground:true }); if (f%120===0) process.stdout.write(`\r${f}/${frameCount}`); }
for (const [name,time] of [['start',0],['bar-05-mid',4.5*240/bpm],['turnaround',8*240/bpm]]) { await page.evaluate(t=>window.renderAtTime(t),time); await page.locator('#overlay').screenshot({path:join(out,`control-${name}.png`),omitBackground:true}); }
await browser.close(); server.close();
const runFfmpeg = args => { const r=spawnSync('ffmpeg',['-y',...args],{stdio:'inherit'}); if(r.status) throw new Error(`ffmpeg failed (${r.status})`); };
const input = ['-framerate',String(fps),'-i',join(frames,'%06d.png')];
runFfmpeg([...input,'-c:v','prores_ks','-profile:v','4','-pix_fmt','yuva444p10le',join(out,`12-bar-blues-${bpm}bpm-alpha.mov`)]);
runFfmpeg([...input,'-c:v','libvpx-vp9','-pix_fmt','yuva420p','-auto-alt-ref','0','-crf','18','-b:v','0','-metadata:s:v:0','alpha_mode=1',join(out,`12-bar-blues-${bpm}bpm-alpha.webm`)]);
runFfmpeg([...input,'-f','lavfi','-i','color=c=#11151b:s=1080x1920:r=60','-filter_complex','[1:v][0:v]overlay=shortest=1:format=auto,format=yuv420p','-c:v','libx264','-crf','18',join(out,`12-bar-blues-${bpm}bpm-preview.mp4`)]);
await writeFile(join(out,'render-manifest.json'),JSON.stringify({bpm,fps,width:1080,height:1920,timeSignature:'4/4',bars:12,form:['I','I','I','I','IV','IV','I','I','V','IV','I','V'],beats:48,beatDuration:60/bpm,barDuration:240/bpm,musicalDuration:duration,frameCount,containerDuration:frameCount/fps,controls:['control-start.png','control-bar-05-mid.png','control-turnaround.png']},null,2));
console.log(`\nRendered ${frameCount} frames (${frameCount/fps}s; musical duration ${duration}s).`);

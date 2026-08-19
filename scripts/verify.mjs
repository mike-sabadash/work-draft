import { spawnSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';

const bpm = Number(process.env.BPM || 115);
const fps = 60;
const expectedFrames = Math.ceil((2880 / bpm) * fps);
const expectedDuration = expectedFrames / fps;
const base = `dist/12-bar-blues-${bpm}bpm`;
const files = {
  mov: `${base}-alpha.mov`, webm: `${base}-alpha.webm`, mp4: `${base}-preview.mp4`,
  start: 'dist/control-bar-01-start.png', middle: 'dist/control-bar-05-mid.png',
  turnaround: 'dist/control-bar-09-turnaround.png', manifest: 'dist/render-manifest.json',
};
for (const [name, file] of Object.entries(files)) {
  if (statSync(file).size === 0) throw new Error(`${name} is empty: ${file}`);
}

function probe(file) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames',
    '-show_entries', 'stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames,nb_read_frames:stream_tags=alpha_mode:format=duration',
    '-of', 'json', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}
const probes = { mov: probe(files.mov), webm: probe(files.webm), mp4: probe(files.mp4) };
const stream = Object.fromEntries(Object.entries(probes).map(([key, value]) => [key, value.streams[0]]));
const durationOk = key => Math.abs(Number(probes[key].format.duration) - expectedDuration) <= 1 / fps;
const common = key => stream[key].width === 1080 && stream[key].height === 1920 && stream[key].r_frame_rate === '60/1' && durationOk(key);
const manifest = JSON.parse(readFileSync(files.manifest));
const musical = manifest.barStarts.length === 12 && manifest.beatStarts.length === 48
  && manifest.beatStarts.every((beat, index) => beat.beatInBar === index % 4 + 1 && beat.downbeat === (index % 4 === 0))
  && manifest.barStarts[4].degree === 'IV' && manifest.barStarts[8].degree === 'V' && manifest.barStarts[11].degree === 'V';
const movAlphaPixelFormats = /^(?:yuva444p(?:10|12)le|gbrap(?:10|12)le)$/;
const checks = {
  movCodec: stream.mov.codec_name === 'prores',
  movProfile: /4444/i.test(stream.mov.profile || ''),
  movAlphaPixelFormat: movAlphaPixelFormats.test(stream.mov.pix_fmt || ''),
  movFrameCount: Number(stream.mov.nb_read_frames || stream.mov.nb_frames) === expectedFrames,
  movGeometryFpsDuration: common('mov'),
  webmCodec: stream.webm.codec_name === 'vp9',
  webmAlphaMetadata: String(stream.webm.tags?.ALPHA_MODE ?? stream.webm.tags?.alpha_mode) === '1',
  webmGeometryFpsDuration: common('webm'),
  previewCodec: stream.mp4.codec_name === 'h264',
  previewOpaquePixelFormat: !stream.mp4.pix_fmt.includes('a'),
  previewGeometryFpsDuration: common('mp4'),
  musicalStructure: musical,
};
for (const [name, passed] of Object.entries(checks)) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
const report = {
  verifiedAt: new Date().toISOString(), bpm, fps, width: 1080, height: 1920,
  timeSignature: '4/4', bars: 12, beats: 48, form: manifest.form,
  expectedFrames, expectedDuration, outputs: files, checks,
  barStarts: manifest.barStarts, beatStarts: manifest.beatStarts, probes,
};
writeFileSync('dist/verification-report.json', `${JSON.stringify(report, null, 2)}\n`);
if (Object.values(checks).includes(false)) process.exit(1);

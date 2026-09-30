import { mkdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const domain = process.env.REPLIT_DEV_DOMAIN;
if (!domain) throw new Error('REPLIT_DEV_DOMAIN is not set');

const url = `https://${domain}/focus-compass-social/`;
const chromiumPath = '/repl/tools/bin/chromium';
const captureDir = '/tmp/focus-compass-social-capture';
const rawDir = `${captureDir}/raw`;
const rawVideo = `${captureDir}/capture.webm`;
const output = process.argv[2] || 'attached_assets/focus-compass-social-promo.mp4';
const music = 'artifacts/focus-compass-social/public/audio/bg_music.mp3';

await rm(captureDir, { recursive: true, force: true });
await mkdir(rawDir, { recursive: true });
await mkdir('attached_assets', { recursive: true });

const browser = await chromium.launch({
  executablePath: chromiumPath,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-extensions',
    '--hide-scrollbars',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

try {
  // Warm HTTP, image, font, and audio caches before opening the recorded page.
  const warm = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const warmPage = await warm.newPage();
  await warmPage.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await warmPage.waitForFunction(() => document.fonts?.status === 'loaded');
  await warmPage.waitForTimeout(2_000);
  await warm.close();

  let startedAt;
  let stoppedAt;
  let resolveStarted;
  let resolveStopped;
  const started = new Promise((resolve) => { resolveStarted = resolve; });
  const stopped = new Promise((resolve) => { resolveStopped = resolve; });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: rawDir,
      size: { width: 1920, height: 1080 },
    },
  });
  await context.exposeBinding('__captureStarted', () => {
    if (startedAt === undefined) {
      startedAt = process.hrtime.bigint();
      resolveStarted();
    }
  });
  await context.exposeBinding('__captureStopped', () => {
    if (stoppedAt === undefined) {
      stoppedAt = process.hrtime.bigint();
      resolveStopped();
    }
  });
  await context.addInitScript(() => {
    window.startRecording = async () => {
      await window.__captureStarted();
    };
    window.stopRecording = () => {
      void window.__captureStopped();
    };
  });

  const pageOpenedAt = process.hrtime.bigint();
  const page = await context.newPage();
  const video = page.video();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => document.fonts?.status === 'loaded');
  await Promise.race([
    started,
    new Promise((_, reject) => setTimeout(() => reject(new Error('startRecording hook timed out')), 20_000)),
  ]);
  await Promise.race([
    stopped,
    new Promise((_, reject) => setTimeout(() => reject(new Error('stopRecording hook timed out')), 40_000)),
  ]);
  await page.waitForTimeout(500);
  await page.close();
  const recordedPath = await video.path();
  await context.close();

  const hookDuration = Number(stoppedAt - startedAt) / 1e9;
  const trimStart = Number(startedAt - pageOpenedAt) / 1e9;
  console.log(`Lifecycle hooks: start +${trimStart.toFixed(3)}s, duration ${hookDuration.toFixed(3)}s`);

  await rm(rawVideo, { force: true });
  await new Promise((resolve, reject) => {
    const copy = spawn('cp', [recordedPath, rawVideo], { stdio: 'inherit' });
    copy.on('error', reject);
    copy.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`cp exited ${code}`)));
  });

  await new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-ss', trimStart.toFixed(6),
      '-i', rawVideo,
      '-stream_loop', '-1',
      '-i', music,
      '-t', '30',
      '-filter_complex', '[1:a]volume=0.45,atrim=duration=30,asetpts=PTS-STARTPTS[a]',
      '-map', '0:v:0',
      '-map', '[a]',
      '-vf', 'scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p',
      '-r', '30',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18',
      '-profile:v', 'high',
      '-level', '4.1',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-ac', '2',
      '-movflags', '+faststart',
      '-shortest',
      output,
    ], { stdio: 'inherit' });
    ffmpeg.on('error', reject);
    ffmpeg.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
  });
  console.log(`Exported ${output}`);
} finally {
  await browser.close();
}
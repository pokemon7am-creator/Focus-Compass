import { mkdir, readdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from '/tmp/fc-capture-tools/node_modules/playwright-core/index.mjs';

const domain = process.env.REPLIT_EXPO_DEV_DOMAIN;
if (!domain) throw new Error('REPLIT_EXPO_DEV_DOMAIN is not set.');

const baseUrl = `https://${domain}`;
const outputDir = 'attached_assets/focus-compass-previews/raw';
const profileDir = '/tmp/focus-compass-marketing-profile';
const videoFramesDir = '/tmp/focus-compass-video-frames';
const chromePath = '/repl/tools/bin/chromium';

await mkdir(outputDir, { recursive: true });
await rm(profileDir, { recursive: true, force: true });
await rm(videoFramesDir, { recursive: true, force: true });
await mkdir(videoFramesDir, { recursive: true });

const waitForApp = async (page) => {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => document.fonts?.status === 'loaded', null, { timeout: 30_000 });
  await page.waitForTimeout(1_200);
};

const completeOnboarding = async (page) => {
  if (new URL(page.url()).pathname !== '/tutorial') return;
  await page.getByText('Skip', { exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 });
  await waitForApp(page);
};

const openSection = async (page, label) => {
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByText(label, { exact: true }).click();
  await page.waitForTimeout(900);
  await page.waitForFunction(() => document.fonts?.status === 'loaded');
};

const takeShot = async (page, name) => {
  await page.screenshot({
    path: `${outputDir}/${name}.png`,
    animations: 'allow',
    fullPage: false,
  });
  console.log(`Captured ${name}.png`);
};

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-extensions', '--hide-scrollbars'],
});

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitForApp(page);

  if (new URL(page.url()).pathname === '/tutorial') {
    await takeShot(page, '01-onboarding-welcome');
  }
  await completeOnboarding(page);
  await takeShot(page, '02-focus-ready');

  await page.getByText('Start focus', { exact: true }).click();
  await page.waitForTimeout(1_700);
  await takeShot(page, '03-focus-running');

  await openSection(page, 'Stillness');
  await page.evaluate(() => window.scrollTo(0, 0));
  await takeShot(page, '04-stillness-ready');
  await page.getByText('Begin breathing', { exact: true }).click();
  await page.waitForTimeout(2_200);
  await takeShot(page, '05-breathing-active');

  await openSection(page, 'Insights');
  await page.evaluate(() => window.scrollTo(0, 0));
  await takeShot(page, '06-insights');

  await openSection(page, 'Shop');
  await page.evaluate(() => window.scrollTo(0, 0));
  await takeShot(page, '07-shop');

  const planetsSection = page.getByText(/Paper Planets collection/).first();
  await planetsSection.scrollIntoViewIfNeeded();
  const firstPlanet = page.getByText('Choose free starter', { exact: true }).first();
  await firstPlanet.click();
  await page.waitForTimeout(700);
  await planetsSection.scrollIntoViewIfNeeded();
  await takeShot(page, '08-paper-planets');
  await context.close();

  // Record a separate, clean browser session so the demo starts from the timer-ready state.
  const videoContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    colorScheme: 'light',
  });
  const videoPage = await videoContext.newPage();
  await videoPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitForApp(videoPage);
  await completeOnboarding(videoPage);

  const durationMs = 23_000;
  let recording = true;
  let frameNumber = 0;
  const startedAt = Date.now();
  const captureFrames = (async () => {
    while (recording && Date.now() - startedAt < durationMs) {
      const frame = String(frameNumber++).padStart(4, '0');
      await videoPage.screenshot({
        path: `${videoFramesDir}/frame-${frame}.jpg`,
        type: 'jpeg',
        quality: 82,
        animations: 'allow',
      });
      await videoPage.waitForTimeout(70);
    }
  })();

  await videoPage.waitForTimeout(2_500);
  await videoPage.getByText('15m', { exact: true }).click();
  await videoPage.waitForTimeout(1_500);
  await videoPage.getByText('Start focus', { exact: true }).click();
  await videoPage.waitForTimeout(4_300);
  await openSection(videoPage, 'Stillness');
  await videoPage.waitForTimeout(2_200);
  await videoPage.getByText('Begin breathing', { exact: true }).click();
  await videoPage.waitForTimeout(Math.max(0, durationMs - (Date.now() - startedAt)));
  recording = false;
  await captureFrames;
  await videoContext.close();

  const frames = (await readdir(videoFramesDir)).filter((name) => name.endsWith('.jpg')).length;
  if (frames < 2) throw new Error(`Only ${frames} video frames were captured.`);
  const frameRate = frames / (durationMs / 1000);
  const videoPath = `${outputDir}/focus-compass-browser-demo.mp4`;
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      'ffmpeg',
      [
        '-y',
        '-framerate',
        frameRate.toFixed(6),
        '-i',
        `${videoFramesDir}/frame-%04d.jpg`,
        '-vf',
        'scale=886:1920:flags=lanczos,format=yuv420p',
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '20',
        '-movflags',
        '+faststart',
        videoPath,
      ],
      { stdio: 'inherit' },
    );
    ffmpeg.on('error', reject);
    ffmpeg.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
  });
  console.log(`Recorded ${videoPath} from ${frames} real browser frames (${frameRate.toFixed(2)} fps).`);
} finally {
  await browser.close();
}
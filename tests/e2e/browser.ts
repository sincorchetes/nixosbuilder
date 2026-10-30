// Prueba de extremo a extremo con Chrome/Chromium headless (protocolo CDP).
// Uso: bun tests/e2e/browser.ts [url]   (por defecto http://localhost:4321/)
// Requiere un servidor sirviendo la web (`bun run dev` o `bun run preview`) y `google-chrome` o `chromium` en el PATH.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = (process.argv[2] ?? 'http://localhost:4321/').replace(/\/?$/, '/');
const port = 9333;
const chrome = ['google-chrome', 'chromium', 'chromium-browser'].find((bin) => Bun.which(bin));
if (!chrome) {
  console.error('Chrome/Chromium not found in PATH');
  process.exit(2);
}

// El Chrome del sistema (p. ej. el de los runners de GitHub) no debe cargar las librerías de Nix del shell de devenv.
const { LD_LIBRARY_PATH: _libs, LD_PRELOAD: _preload, ...cleanEnv } = process.env;
const workDir = mkdtempSync(join(tmpdir(), 'e2e-'));
const chromeLog = join(workDir, 'chrome.log');
const browser = Bun.spawn(
  [
    chrome,
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${join(workDir, 'profile')}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    'about:blank',
  ],
  { stdout: Bun.file(chromeLog), stderr: Bun.file(chromeLog), env: cleanEnv },
);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let ready = false;
for (let i = 0; i < 100 && !ready; i++) {
  try {
    ready = (await fetch(`http://localhost:${port}/json/version`)).ok;
  } catch {
    await sleep(200);
  }
}
if (!ready) {
  console.error(`Chrome (${chrome}) did not open the debugging port ${port}; exit code: ${browser.exitCode}`);
  console.error(readFileSync(chromeLog, 'utf8').slice(-2000));
  browser.kill();
  process.exit(2);
}

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`);
  if (!ok) failures.push(message);
};

async function openPage(target: string, width = 1280, height = 900, mobile = false) {
  const info = await (await fetch(`http://localhost:${port}/json/new?${target}`, { method: 'PUT' })).json();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  const errors: string[] = [];
  let id = 0;
  const pending = new Map<number, (value: any) => void>();
  ws.onmessage = (message) => {
    const data = JSON.parse(message.data as string);
    if (data.id && pending.has(data.id)) pending.get(data.id)!(data.result);
    else if (data.method === 'Runtime.exceptionThrown')
      errors.push(data.params.exceptionDetails.exception?.description ?? data.params.exceptionDetails.text);
    else if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error')
      errors.push(data.params.args.map((arg: any) => arg.value ?? arg.description).join(' '));
  };
  await new Promise((resolve) => (ws.onopen = resolve));
  const send = (method: string, params: object = {}) =>
    new Promise<any>((resolve) => {
      const n = ++id;
      pending.set(n, resolve);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const ev = async <T = any>(expression: string): Promise<T> =>
    (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Page.reload');
  await sleep(4500);
  return {
    ev,
    errors,
    close: () => {
      ws.close();
    },
  };
}

const next = (page: Awaited<ReturnType<typeof openPage>>) =>
  page.ev(`document.querySelector('.wizard-nav .primary-button').click()`).then(() => sleep(300));

for (const [lang, path] of [
  ['es', ''],
  ['en', 'en/'],
] as const) {
  const page = await openPage(url + path);
  check((await page.ev(`document.documentElement.lang`)) === lang, `[${lang}] the page language is ${lang}`);
  check((await page.ev(`document.querySelectorAll('.wizard-steps li').length`)) === 12, `[${lang}] the wizard has 12 steps`);

  // Saltando directamente a la penúltima pantalla no se puede ver el resumen: faltan pasos por revisar.
  await page.ev(`document.querySelectorAll('.wizard-steps button')[10].click()`);
  await sleep(300);
  check(
    await page.ev(`document.querySelector('.wizard-nav .primary-button').disabled`),
    `[${lang}] the summary stays locked while steps are unvisited`,
  );
  check(
    await page.ev(`document.querySelectorAll('.wizard-steps button')[11].disabled`),
    `[${lang}] the summary entry in the sidebar is disabled`,
  );
  await page.ev(`document.querySelectorAll('.wizard-steps button')[0].click()`);
  await sleep(300);

  const heights = new Set<number>();
  for (let i = 0; i < 12; i++) {
    if (i === 7) {
      // Sin esquema de particiones ni hardware-configuration.nix, el destino de instalación es un error.
      check(
        await page.ev(`document.querySelectorAll('.wizard-steps button')[7].classList.contains('warn')`),
        `[${lang}] the installation target is flagged until it is defined`,
      );
      await page.ev(
        `(() => { const area = document.querySelector('.wizard textarea'); area.value = '{ ... }: { fileSystems."/" = { device = "/dev/sda1"; fsType = "ext4"; }; }'; area.dispatchEvent(new Event('input', { bubbles: true })); })()`,
      );
      await sleep(200);
    }
    heights.add(await page.ev(`Math.round(document.querySelector('.wizard-window').getBoundingClientRect().height)`));
    if (i < 11) await next(page);
  }
  check(heights.size === 1, `[${lang}] the wizard window keeps the same height on every step (${[...heights].join(',')})`);
  check(
    await page.ev(`document.querySelectorAll('.wizard-nav .primary-button')[0].textContent.includes('.zip')`),
    `[${lang}] the last step offers the download`,
  );
  check((await page.ev(`document.querySelectorAll('.wizard .spoke').length`)) >= 10, `[${lang}] the summary shows one card per section`);
  check((await page.ev(`document.querySelectorAll('.tabs button').length`)) >= 3, `[${lang}] the generated files are listed`);
  check(
    (await page.ev(`document.querySelectorAll('.password-note code.inline').length`)) >= 3,
    `[${lang}] the password notice uses monospace`,
  );

  await page.ev(`document.querySelectorAll('.wizard-steps button')[2].click()`);
  await sleep(300);
  check(await page.ev(`!!document.querySelector('.to-summary')`), `[${lang}] with everything green, “Go to summary” appears`);

  const before = await page.ev(`Math.round(document.querySelector('.mode-tabs').getBoundingClientRect().top)`);
  await page.ev(`document.querySelectorAll('.mode-tabs button')[1].click()`);
  await sleep(700);
  const after = await page.ev(`Math.round(document.querySelector('.mode-tabs').getBoundingClientRect().top)`);
  check(Math.abs(before - after) <= 2, `[${lang}] switching to the technical view keeps the position (${before} → ${after})`);
  check((await page.ev(`document.querySelectorAll('.form-group').length`)) === 5, `[${lang}] the technical view groups into 5 blocks`);
  check(page.errors.length === 0, `[${lang}] no console errors${page.errors.length ? `: ${page.errors[0]}` : ''}`);
  page.close();
}

const scroll = await openPage(url);
const layers = await scroll.ev(`document.querySelectorAll('.hero [data-parallax]').length`);
const t0 = await scroll.ev(`document.querySelector('.hero [data-parallax="0.55"]').style.transform`);
await scroll.ev(`window.scrollTo(0, 400)`);
await sleep(500);
check(
  layers >= 5 && t0 !== (await scroll.ev(`document.querySelector('.hero [data-parallax="0.55"]').style.transform`)),
  'parallax moves the layers on scroll',
);
scroll.close();

for (const [name, width] of [
  ['mobile', 375],
  ['tablet', 768],
] as const) {
  const page = await openPage(url, width, 900, true);
  const overflow = () => page.ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  check((await overflow()) <= 0, `[${name}] the landing page does not overflow horizontally`);
  await page.ev(`document.querySelectorAll('.wizard-steps button')[11].click()`);
  await sleep(500);
  check((await overflow()) <= 0, `[${name}] the summary does not overflow horizontally`);
  await page.ev(`document.querySelectorAll('.mode-tabs button')[1].click()`);
  await sleep(700);
  check((await overflow()) <= 0, `[${name}] the technical view does not overflow horizontally`);
  page.close();
}

browser.kill();
console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nAll checks passed');
process.exit(failures.length ? 1 : 0);

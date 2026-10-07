/* Снимки всех страниц для сравнения «до/после» правок стилей.
   node tools/shots.js <папка>             — снять все страницы (компьютер 1440 и телефон 390)
   node tools/shots.js --diff <до> <после> — сравнить две папки, отличия сохранить в <после>/diff
   Нужен запущенный локальный сервер: python -m http.server 8765 --bind 127.0.0.1 */
'use strict';
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8765/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGES = fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => f.endsWith('.html'));
const PHONE = { isMobile: true, hasTouch: true, deviceScaleFactor: 1 };
const VIEWS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 834, height: 1112, ...PHONE },
  mobile: { width: 390, height: 844, ...PHONE },
  small: { width: 360, height: 640, ...PHONE }
};
const FREEZE = '*{transition:none!important;animation:none!important;caret-color:transparent}.map{visibility:hidden}';

// Состояния, которых нет на статичном снимке: меню, поп-ап, сборка «О нас», карточки посередине экрана
const STATES = [
  { name: 'menu', view: 'mobile', page: 'index.html', run: () => document.querySelector('.burger').click() },
  { name: 'modal', view: 'mobile', page: 'index.html', run: () => document.querySelector('[data-open-contact]').click() },
  { name: 'modal', view: 'desktop', page: 'index.html', run: () => document.querySelector('[data-open-contact]').click() },
  { name: 'mid', view: 'mobile', page: 'index.html', full: true,
    run: () => document.querySelectorAll('.dir, .card').forEach((el) => el.classList.add('is-mid', 'is-open')) },
  { name: 'mid', view: 'mobile', page: 'service-business-planning.html', full: true,
    run: () => document.querySelectorAll('.price').forEach((el) => el.classList.add('is-mid')) },
  ...[0.05, 0.4, 0.95].flatMap((p) => ['mobile', 'desktop'].map((view) => ({
    name: 'asm' + Math.round(p * 100), view, page: 'about.html', motion: true,
    run: (p) => { const a = document.querySelector('[data-asm]'); scrollTo(0, (a.offsetHeight - innerHeight) * p); }, arg: p
  })))
];

async function shoot(dir) {
  const puppeteer = require('puppeteer-core');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  for (const [name, viewport] of Object.entries(VIEWS)) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    // Без движения: появление, сборка «О нас» и паттерн замирают в конечном состоянии
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    for (const file of PAGES) {
      await page.goto(BASE + file, { waitUntil: 'networkidle0' });
      await page.addStyleTag({ content: FREEZE });
      await page.evaluate(() => document.fonts.ready);
      await new Promise((r) => setTimeout(r, 300));
      await page.screenshot({ path: path.join(dir, `${name}-${file.replace('.html', '')}.png`), fullPage: true });
    }
    await page.close();
  }
  for (const st of STATES) {
    const page = await browser.newPage();
    await page.setViewport(VIEWS[st.view]);
    if (!st.motion) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(BASE + st.page, { waitUntil: 'networkidle0' });
    await page.addStyleTag({ content: FREEZE });
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in')); });
    await page.evaluate(st.run, st.arg);
    await new Promise((r) => setTimeout(r, 1500));     // сборка «О нас» плавно догоняет прокрутку
    await page.screenshot({ path: path.join(dir, `state-${st.view}-${st.name}-${st.page.replace('.html', '')}.png`), fullPage: !!st.full });
    await page.close();
  }
  await browser.close();
  console.log('Снимки в ' + dir);
}

function diff(a, b) {
  const { PNG } = require('pngjs');
  const pixelmatch = require('pixelmatch');
  const out = path.join(b, 'diff');
  fs.mkdirSync(out, { recursive: true });
  let clean = true;
  for (const file of fs.readdirSync(a).filter((f) => f.endsWith('.png'))) {
    const A = PNG.sync.read(fs.readFileSync(path.join(a, file)));
    const B = PNG.sync.read(fs.readFileSync(path.join(b, file)));
    if (A.width !== B.width || A.height !== B.height) {
      console.log(`${file}: размер ${A.width}×${A.height} → ${B.width}×${B.height}`);
      clean = false;
      continue;
    }
    const D = new PNG({ width: A.width, height: A.height });
    const n = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.1 });
    if (n) {
      clean = false;
      fs.writeFileSync(path.join(out, file), PNG.sync.write(D));
      console.log(`${file}: отличаются ${n} пикс.`);
    }
  }
  console.log(clean ? 'Отличий нет' : 'Есть отличия — см. ' + out);
}

const args = process.argv.slice(2);
if (args[0] === '--diff') diff(args[1], args[2]);
else shoot(args[0] || 'shots').catch((e) => { console.error(e); process.exit(1); });

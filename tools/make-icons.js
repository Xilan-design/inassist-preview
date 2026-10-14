/* Иконки сайта и картинка для превью ссылок — из логотипа.
   node tools/make-icons.js   (нужен запущенный локальный сервер: python -m http.server 8765 --bind 127.0.0.1)

   Создаёт:
     favicon.ico                    — 16 и 32 px, для старых браузеров и закладок
     assets/img/favicon.svg         — знак логотипа; в тёмной теме браузера становится светлым
     assets/img/apple-touch-icon.png — 180 px, иконка на экране «Домой» iPhone
     assets/img/og-image.png        — 1200×630, превью ссылки в мессенджерах и соцсетях */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const BASE = 'http://127.0.0.1:8765/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// Знак логотипа (assets/img/logo-mini.svg, 38×32) — по центру квадрата
const mark = fs.readFileSync(path.join(ROOT, 'assets/img/logo-mini.svg'), 'utf8')
  .match(/<path[^>]*\/>/g).map((p) => p.replace(/ fill="[^"]*"/, '')).join('');

function squareSvg(size, pad, color, bg) {
  const s = (size - 2 * pad) / 38;
  const x = (size - 38 * s) / 2;
  const y = (size - 32 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    (bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : '') +
    `<g transform="translate(${x} ${y}) scale(${s})" fill="${color}">${mark}</g></svg>`;
}

// favicon.svg: цвет знака меняется вместе с темой браузера
const faviconSvg = squareSvg(32, 1, '#0F0F0F', null)
  .replace('<g ', '<style>g{fill:#0F0F0F}@media (prefers-color-scheme:dark){g{fill:#FBFAF6}}</style><g ');

// ICO с PNG внутри: заголовок 6 байт, по 16 байт на картинку, затем сами PNG
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size, e); head.writeUInt8(size, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
}

const ogHtml = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${BASE}assets/css/style.css"><style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#FBFAF6}
  .og{position:relative;width:1200px;height:630px;padding:88px 96px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between}
  .og img{width:347px;height:auto}
  .og h1{max-width:13em;font-size:64px;line-height:1.06;letter-spacing:-.03em}
  .og p{margin-top:24px;font-size:26px;color:#5E5B54}
  /* Фирменный параллелограмм со срезом 23° у правого края */
  .og i{position:absolute;right:0;top:0;bottom:0;width:calc(64px + 630px * .4245);background:#00A398;clip-path:polygon(calc(630px * .4245) 0,100% 0,64px 100%,0 100%)}
</style></head><body><div class="og"><img src="${BASE}assets/img/logo.svg" alt="">
  <div><h1>Команда, которой не хватает вашему бизнесу</h1><p>Бизнес-планы, реклама, сайты и автоматизация в Минске</p></div><i></i></div></body></html>`;

(async () => {
  fs.writeFileSync(path.join(ROOT, 'assets/img/favicon.svg'), faviconSvg);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const page = await browser.newPage();
  const render = async (svg, size) => {
    await page.setViewport({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  };
  const png16 = await render(squareSvg(16, 0, '#0F0F0F', null), 16);
  const png32 = await render(squareSvg(32, 1, '#0F0F0F', null), 32);
  fs.writeFileSync(path.join(ROOT, 'favicon.ico'), ico([{ size: 16, data: png16 }, { size: 32, data: png32 }]));
  fs.writeFileSync(path.join(ROOT, 'assets/img/apple-touch-icon.png'), await render(squareSvg(180, 40, '#0F0F0F', '#FBFAF6'), 180));

  await page.setViewport({ width: 1200, height: 630 });
  // Страница открывается с того же сервера, что и шрифты, — иначе браузер не даст их загрузить
  const tmp = path.join(ROOT, 'zz-og.html');
  fs.writeFileSync(tmp, ogHtml);
  await page.goto(BASE + 'zz-og.html', { waitUntil: 'networkidle0' });
  fs.unlinkSync(tmp);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(ROOT, 'assets/img/og-image.png') });
  await browser.close();
  console.log('Иконки и превью готовы');
})().catch((e) => { console.error(e); process.exit(1); });

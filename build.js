/* Сборка страниц сайта из src/ в корень проекта.

   Общие части лежат в src/partials/ и вставляются в страницы комментарием:
     <!-- @include header active="services.html" -->   шапка; active — какой пункт меню подсветить
     <!-- @include footer -->                           подвал и всплывающая форма
     <!-- @include contact topic="Реклама" -->          блок «Обсудим вашу задачу»; topic — выбранный вариант
     <!-- @include head-assets -->                      шрифты, стили и скрипты в <head>
     <!-- @include defs -->                             фактура для иллюстраций
     <!-- @include socials cls="socials--footer" -->    соцсети с иконками; cls — вариант оформления
     <!-- @include awards -->                           слайдер сертификатов и благодарностей
   Блоки можно вкладывать друг в друга; {{имя}} внутри блока заменяется параметром с тем же именем.

   Запуск:  node build.js           — собрать один раз
            node build.js --watch   — пересобирать при каждом сохранении файлов в src/

   Готовые .html в корне — результат сборки: правьте src/, иначе изменения затрутся.

   Стили и скрипты правятся в assets/css/style.css и assets/js/*.js. Сборка сжимает их (esbuild)
   в соседние *.min.css / *.min.js и подставляет в страницы с меткой версии ?v=…: метка меняется
   вместе с содержимым, поэтому браузер сразу берёт свежий файл, а не старый из кэша.
   Сами страницы тоже ужимаются: без комментариев и отступов. Перед первым запуском: npm install

   Ещё сборка добавляет в <head> каждой страницы иконки, адрес страницы для поисковиков (canonical)
   и превью для мессенджеров (Open Graph) — из её <title> и description, — и обновляет sitemap.xml
   и robots.txt. Адрес сайта — константа SITE_URL ниже.

   node build.js --dist   — собрать и сложить в dist/ только то, что нужно на хостинге,
                            плюс архив inassist-site.zip для загрузки */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const PARTIALS = path.join(SRC, 'partials');
const INCLUDE = /<!-- @include ([\w-]+)((?:\s+[\w-]+="[^"]*")*) -->/g;
const crypto = require('crypto');
const esbuild = require('esbuild');

// Исходник → сжатый файл. Цели — браузеры не старше 2021 года: синтаксис не переписывается
const ASSETS = ['assets/css/style.css', 'assets/js/main.js', 'assets/js/hero-pattern.js', 'assets/js/contacts-map.js'];
const TARGET = ['chrome100', 'edge100', 'firefox100', 'safari15'];

// Адрес боевого сайта: из него собираются canonical, превью ссылок, sitemap.xml и robots.txt
const SITE_URL = 'https://inassist.by/';

// Иконки, адрес страницы и превью ссылки. Страницы с noindex (404) в поиск и sitemap не попадают
function headTags(page, html) {
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  const url = SITE_URL + (page === 'index.html' ? '' : page);
  const tags = [
    '<link rel="icon" href="favicon.ico" sizes="32x32">',
    '<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">',
    '<meta name="theme-color" content="#FBFAF6">'
  ];
  if (!isNoindex(html)) {
    tags.push(
      `<link rel="canonical" href="${url}">`,
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="ИнАссист">',
      '<meta property="og:locale" content="ru_RU">',
      `<meta property="og:url" content="${url}">`,
      `<meta property="og:title" content="${title}">`,
      `<meta property="og:description" content="${desc}">`,
      `<meta property="og:image" content="${SITE_URL}assets/img/og-image.png">`,
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      '<meta name="twitter:card" content="summary_large_image">'
    );
  }
  return html.replace('</head>', tags.join('\n') + '\n</head>');
}

const isNoindex = (html) => /<meta name="robots" content="noindex/.test(html);

function writeSeoFiles(indexed) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = indexed.map((page) => {
    const loc = SITE_URL + (page === 'index.html' ? '' : page);
    return `  <url><loc>${loc}</loc><lastmod>${today}</lastmod></url>`;
  });
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n');
  fs.writeFileSync(path.join(ROOT, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /send.php\n\nSitemap: ${SITE_URL}sitemap.xml\n`);
}

// Что нужно на хостинге: страницы, сжатые стили и скрипты, шрифты, картинки и служебные файлы
const DIST_FILES = ['favicon.ico', 'robots.txt', 'sitemap.xml', 'send.php', '.htaccess'];

function copyDir(from, to, skip) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst, skip);
    else if (!skip(src)) fs.copyFileSync(src, dst);
  }
}

function dist(pages) {
  const DIST = path.join(ROOT, 'dist');
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST);
  for (const file of [...pages, ...DIST_FILES]) fs.copyFileSync(path.join(ROOT, file), path.join(DIST, file));
  // Исходники стилей и скриптов не нужны — страницы подключают сжатые *.min.*
  const sources = new Set(ASSETS.map((f) => path.join(ROOT, f)));
  copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), (f) => sources.has(f));
  const zip = path.join(ROOT, 'inassist-site.zip');
  fs.rmSync(zip, { force: true });
  // Архив: в Windows и macOS — встроенный tar (умеет zip), в Linux — zip
  const { execFileSync } = require('child_process');
  if (process.platform === 'win32') execFileSync(path.join(process.env.SystemRoot || 'C:\Windows', 'System32', 'tar.exe'), ['-a', '-c', '-f', zip, '.'], { cwd: DIST });
  else if (process.platform === 'darwin') execFileSync('tar', ['-a', '-c', '-f', zip, '.'], { cwd: DIST });
  else execFileSync('zip', ['-r', '-q', zip, '.'], { cwd: DIST });
  console.log('Готово к загрузке: папка dist/ и архив inassist-site.zip');
}

function buildAssets() {
  const map = {};
  for (const file of ASSETS) {
    const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const loader = file.endsWith('.css') ? 'css' : 'js';
    const min = esbuild.transformSync(code, { loader, minify: true, target: TARGET, charset: 'utf8', legalComments: 'none' }).code;
    const out = file.replace(/\.(css|js)$/, '.min.$1');
    fs.writeFileSync(path.join(ROOT, out), min);
    const v = crypto.createHash('sha1').update(min).digest('hex').slice(0, 8);
    map[file] = `${out}?v=${v}`;
  }
  return map;
}

// Комментарии и отступы строк не нужны браузеру. Перевод строки остаётся — он работает как пробел
function compactHtml(html, assets) {
  for (const [src, out] of Object.entries(assets)) html = html.split(`"${src}"`).join(`"${out}"`);
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r?\n[ \t]+/g, '\n')
    .replace(/\n{2,}/g, '\n');
}

// Параметры, которые меняют общий блок под конкретную страницу
const modifiers = {
  header(html, { active }) {
    if (!active) return html;
    const link = `<a href="${active}">`;   // первое вхождение — пункт верхнего уровня
    if (!html.includes(link)) throw new Error(`в меню нет пункта ${active}`);
    return html.replace(link, `<a href="${active}" aria-current="page">`);
  },
  contact(html, { topic }) {
    if (!topic) return html;
    const option = `value="${topic}">`;
    if (!html.includes(option)) throw new Error(`в форме нет варианта «${topic}»`);
    return html
      .replace(' checked><span>Пока не знаю', '><span>Пока не знаю')
      .replace(option, `value="${topic}" checked>`);
  }
};

function parseParams(str) {
  const params = {};
  for (const m of str.matchAll(/([\w-]+)="([^"]*)"/g)) params[m[1]] = m[2];
  return params;
}

function loadPartials() {
  const parts = {};
  for (const file of fs.readdirSync(PARTIALS)) {
    if (file.endsWith('.html')) parts[path.basename(file, '.html')] = fs.readFileSync(path.join(PARTIALS, file), 'utf8');
  }
  return parts;
}

function build() {
  const started = Date.now();
  const parts = loadPartials();
  const assets = buildAssets();
  const pages = fs.readdirSync(SRC).filter((f) => f.endsWith('.html'));
  const indexed = [];

  for (const page of pages) {
    const source = fs.readFileSync(path.join(SRC, page), 'utf8');
    const eol = source.includes('\r\n') ? '\r\n' : '\n';   // вставки получают те же переводы строк, что и страница
    // Общие блоки могут включать друг друга (шапка → соцсети); {{имя}} в блоке заменяется параметром
    const expand = (text, depth) => text.replace(INCLUDE, (_, name, rawParams) => {
      if (depth > 4) throw new Error(`${page}: слишком глубокое вложение блоков`);
      if (!(name in parts)) throw new Error(`${page}: нет общего блока src/partials/${name}.html`);
      const params = parseParams(rawParams);
      const part = expand(parts[name].replace(/\r?\n/g, eol), depth + 1)
        .replace(/\{\{([\w-]+)\}\}/g, (m, key) => params[key] || '');
      try {
        return modifiers[name] ? modifiers[name](part, params) : part;
      } catch (err) {
        throw new Error(`${page}: ${err.message}`);
      }
    });
    const html = headTags(page, expand(source, 0));
    fs.writeFileSync(path.join(ROOT, page), compactHtml(html, assets));
    if (!isNoindex(html)) indexed.push(page);
  }
  writeSeoFiles(indexed);
  if (process.argv.includes('--dist')) dist(pages);
  console.log(`Собрано страниц: ${pages.length} за ${Date.now() - started} мс`);
}

function safeBuild() {
  try {
    build();
  } catch (err) {
    console.error('Ошибка сборки: ' + err.message);
    process.exitCode = 1;
  }
}

safeBuild();

if (process.argv.includes('--watch')) {
  let timer = null;
  const rebuild = (_, file) => {
    if (file && file.includes('.min.')) return;   // свои же сжатые файлы не пересобираем
    clearTimeout(timer);
    timer = setTimeout(safeBuild, 100);   // редактор часто сохраняет файл в несколько приёмов
  };
  fs.watch(SRC, { recursive: true }, rebuild);
  fs.watch(path.join(ROOT, 'assets', 'css'), rebuild);
  fs.watch(path.join(ROOT, 'assets', 'js'), rebuild);
  console.log('Слежу за src/ и assets/ — сохраните файл, и страницы пересоберутся. Остановить: Ctrl+C');
}

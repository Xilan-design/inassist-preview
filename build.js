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
   Сами страницы тоже ужимаются: без комментариев и отступов. Перед первым запуском: npm install */
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
    const html = expand(source, 0);
    fs.writeFileSync(path.join(ROOT, page), compactHtml(html, assets));
  }
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

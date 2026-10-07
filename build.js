/* Сборка страниц сайта из src/ в корень проекта.

   Общие части лежат в src/partials/ и вставляются в страницы комментарием:
     <!-- @include header active="services.html" -->   шапка; active — какой пункт меню подсветить
     <!-- @include footer -->                           подвал и всплывающая форма
     <!-- @include contact topic="Реклама" -->          блок «Обсудим вашу задачу»; topic — выбранный вариант
     <!-- @include head-assets -->                      шрифты, стили и скрипты в <head>
     <!-- @include defs -->                             фактура для иллюстраций

   Запуск:  node build.js           — собрать один раз
            node build.js --watch   — пересобирать при каждом сохранении файлов в src/

   Готовые .html в корне — результат сборки: правьте src/, иначе изменения затрутся. */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const PARTIALS = path.join(SRC, 'partials');
const INCLUDE = /<!-- @include ([\w-]+)((?:\s+[\w-]+="[^"]*")*) -->/g;

// Параметры, которые меняют общий блок под конкретную страницу
const modifiers = {
  header(html, { active }) {
    if (!active) return html;
    const link = `<li><a href="${active}">`;
    if (!html.includes(link)) throw new Error(`в меню нет пункта ${active}`);
    return html.replace(link, `<li><a href="${active}" aria-current="page">`);
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
  const pages = fs.readdirSync(SRC).filter((f) => f.endsWith('.html'));

  for (const page of pages) {
    const source = fs.readFileSync(path.join(SRC, page), 'utf8');
    const eol = source.includes('\r\n') ? '\r\n' : '\n';   // вставки получают те же переводы строк, что и страница
    const html = source.replace(INCLUDE, (_, name, rawParams) => {
      if (!(name in parts)) throw new Error(`${page}: нет общего блока src/partials/${name}.html`);
      const params = parseParams(rawParams);
      const part = parts[name].replace(/\r?\n/g, eol);
      try {
        return modifiers[name] ? modifiers[name](part, params) : part;
      } catch (err) {
        throw new Error(`${page}: ${err.message}`);
      }
    });
    fs.writeFileSync(path.join(ROOT, page), html);
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
  fs.watch(SRC, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(safeBuild, 100);   // редактор часто сохраняет файл в несколько приёмов
  });
  console.log('Слежу за src/ — сохраните файл, и страницы пересоберутся. Остановить: Ctrl+C');
}

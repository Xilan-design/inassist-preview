/* ИнАссист — фирменный паттерн на главном экране.
   Построение по брендбуку: параллелограмм шириной X и высотой 3X со срезом 23°,
   колонки через X, просвет между фигурами X, соседние колонки смещены на половину шага.
   Цвета — только оттенки Navy (Dark Navy в паттерне не используется).
   Паттерн медленно дрейфует вверх волной слева направо и реагирует на курсор. Возле текста почти прозрачен. */
(function () {
  'use strict';

  var canvas = document.querySelector('.hero__pattern');
  if (!canvas || !canvas.getContext) return;
  var hero = canvas.parentElement;
  var text = hero.querySelector('.hero__text');
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Настройки ---------- */
  var TINTS = [[220, 240, 236], [184, 226, 222], [150, 213, 206], [114, 202, 195]]; // Navy 25 → Navy
  var HOVER = [114, 202, 195];   // Navy: самый насыщенный оттенок паттерна
  var TAN23 = 0.4245;            // tan(23°)
  var SPEED = 7.5;               // скорость дрейфа, px/с
  var WAVE_AMP = 0.6;            // высота волны, доля X
  var WAVE_PERIOD = 7;           // одно покачивание колонки, с
  var WAVE_COLS = 14;            // длина волны, колонок (волна бежит слева направо)
  var GROW_RIGHT = 0.15;         // насколько крупнее фигуры у правого края, чем в середине экрана
  var DENSITY = 0.55;            // доля заполненных мест в сетке
  var MAX_ALPHA = 0.44;          // насыщенность паттерна вдали от текста
  var TEXT_ALPHA = 0.05;         // насыщенность под текстом
  var TEXT_FADE = 200;           // расстояние, на котором паттерн проявляется от текста, px
  var RADIUS = 180;              // радиус реакции на курсор, px

  var W = 0, H = 0, dpr = 1, X = 24, textBox = null;
  var offset = 0, time = 0, last = 0, running = false, inView = true;
  var pointer = { x: 0, y: 0, sx: 0, sy: 0, on: 0, target: 0 };

  // Детерминированный «случайный» выбор: у каждой фигуры постоянное место в узоре
  function hash(c, r) {
    var n = (Math.imul(c, 374761393) + Math.imul(r, 668265263)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  function smooth(t) { return t * t * (3 - 2 * t); }

  function mix(a, b, k) {
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }

  // 0…1: насколько точка далеко от текстового блока
  function awayFromText(x, y) {
    var dx = Math.max(textBox.l - x, 0, x - textBox.r);
    var dy = Math.max(textBox.t - y, 0, y - textBox.b);
    return smooth(Math.min(Math.sqrt(dx * dx + dy * dy) / TEXT_FADE, 1));
  }

  function measure() {
    var hb = hero.getBoundingClientRect();
    var tb = text.getBoundingClientRect();
    W = hb.width;
    H = hb.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    X = W < 760 ? 16 : W < 1200 ? 23 : 28;
    textBox = { l: tb.left - hb.left - 24, t: tb.top - hb.top - 24, r: tb.right - hb.left + 24, b: tb.bottom - hb.top + 24 };
    draw();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var w = X, h = 3 * X, cut = X * TAN23, pitch = 2 * X, period = 4 * X;
    var cols = Math.ceil(W / pitch) + 1;
    var hovering = pointer.on > 0.001;

    for (var c = 0; c < cols; c++) {
      var x = c * pitch;
      var shift = (c % 2) * 2 * X;                       // смещение соседних колонок
      var base = TINTS[Math.min(3, Math.floor((c / cols) * 4))]; // горизонтальный градиент
      var r0 = Math.floor((offset - shift - h) / period) - 1;   // запас на увеличенные фигуры
      var r1 = Math.ceil((offset - shift + H) / period) + 1;
      // От середины экрана к правому краю фигуры плавно растут
      var scale = 1 + GROW_RIGHT * Math.min(Math.max((x + w / 2 - W / 2) / (W / 2), 0), 1);
      var sw = w * scale, sh = h * scale, sc = cut * scale;
      // Волна: колонки покачиваются со сдвигом фазы, гребень бежит вправо
      var wave = WAVE_AMP * X * Math.sin(2 * Math.PI * (time / WAVE_PERIOD - c / WAVE_COLS));

      for (var r = r0; r <= r1; r++) {
        if (hash(c, r) > DENSITY) continue;
        var y = r * period + shift - offset + wave;
        var cx = x + w / 2, cy = y + h / 2;
        var away = awayFromText(cx, cy);
        var alpha = TEXT_ALPHA + (MAX_ALPHA - TEXT_ALPHA) * away;

        var k = 0;
        if (hovering) {
          var dx = cx - pointer.sx, dy = cy - pointer.sy;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < RADIUS) k = smooth(1 - d / RADIUS) * pointer.on;
        }

        var color = base;
        if (k > 0) {
          // Возле текста реакция слабая, чтобы не мешать чтению
          var kk = k * (0.25 + 0.75 * away);
          color = mix(base, HOVER, kk);
          alpha = Math.min(1, alpha + 0.5 * kk);
          y -= X * 0.8 * kk;                             // фигура приподнимается
        }

        ctx.fillStyle = 'rgba(' + (color[0] | 0) + ',' + (color[1] | 0) + ',' + (color[2] | 0) + ',' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        // Масштаб от центра фигуры: пропорции X×3X и срез 23° сохраняются
        var fx = cx - sw / 2, fy = y + h / 2 - sh / 2;
        ctx.moveTo(fx, fy + sc);
        ctx.lineTo(fx + sw, fy);
        ctx.lineTo(fx + sw, fy + sh - sc);
        ctx.lineTo(fx, fy + sh);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function needsFrames() {
    if (!inView || document.hidden) return false;
    if (!reduceMotion.matches) return true;
    // Без дрейфа кадры нужны только пока догоняем курсор
    return Math.abs(pointer.target - pointer.on) > 0.005 ||
      Math.abs(pointer.x - pointer.sx) + Math.abs(pointer.y - pointer.sy) > 0.5;
  }

  function frame(now) {
    var dt = Math.min(now - last, 64) / 1000;
    last = now;
    if (!reduceMotion.matches) {
      offset += SPEED * dt;
      time += dt;
    }
    pointer.sx += (pointer.x - pointer.sx) * 0.12;
    pointer.sy += (pointer.y - pointer.sy) * 0.12;
    pointer.on += (pointer.target - pointer.on) * 0.08;
    draw();
    if (needsFrames()) requestAnimationFrame(frame);
    else running = false;
  }

  function start() {
    if (running || !needsFrames()) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  /* ---------- События ---------- */
  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;                // на тач-экранах только дрейф
    var hb = hero.getBoundingClientRect();
    pointer.x = e.clientX - hb.left;
    pointer.y = e.clientY - hb.top;
    if (pointer.on < 0.01) { pointer.sx = pointer.x; pointer.sy = pointer.y; }
    pointer.target = 1;
    start();
  });
  hero.addEventListener('pointerleave', function () {
    pointer.target = 0;
    start();
  });

  // Не тратим ресурсы, когда экран не виден
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      start();
    }).observe(hero);
  }
  document.addEventListener('visibilitychange', start);
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', start);

  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(hero);
  else window.addEventListener('resize', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  measure();
  start();
})();

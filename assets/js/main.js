/* ИнАссист — общие скрипты сайта */
(function () {
  'use strict';

  /* ---------- Одна толщина линий во всех иллюстрациях ----------
     Рисунки растянуты по-разному, а толщина линии задаётся в единицах рисунка. Сообщаем CSS,
     сколько единиц рисунка приходится на пиксель экрана (--u), — и линия везде выходит 1,2 px. */
  var arts = document.querySelectorAll('svg.scene, svg.step__art');
  var setUnit = function (svg) {
    var vb = svg.viewBox && svg.viewBox.baseVal;
    var r = svg.getBoundingClientRect();
    if (!vb || !vb.width || !r.width) return;
    var k = Math.min(r.width / vb.width, r.height / vb.height);   // рисунок вписан целиком
    svg.style.setProperty('--u', (1 / k).toFixed(3));
  };
  if ('ResizeObserver' in window) {
    var artsObserver = new ResizeObserver(function (entries) {
      entries.forEach(function (e) { setUnit(e.target); });
    });
    arts.forEach(function (svg) { artsObserver.observe(svg); });
  } else {
    arts.forEach(setUnit);
  }

  /* ---------- Мобильное меню ---------- */
  var burger = document.querySelector('.burger');
  var nav = document.getElementById('site-nav');

  function setMenu(open) {
    if (!burger || !nav) return;
    burger.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  if (burger && nav) {
    burger.addEventListener('click', function () {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setMenu(false);
        burger.focus();
      }
    });
  }

  /* ---------- Выпадающие списки в шапке: направления и контакты ----------
     С мышью открываются ещё и наведением (это делает CSS); здесь — нажатие, Escape и клик мимо */
  var dds = Array.prototype.slice.call(document.querySelectorAll('[data-dd]'));
  function setDd(dd, open) {
    dd.classList.toggle('is-open', open);
    var btn = dd.querySelector('.dd__btn');
    if (btn) btn.setAttribute('aria-expanded', String(open));
  }
  dds.forEach(function (dd) {
    var btn = dd.querySelector('.dd__btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var open = !dd.classList.contains('is-open');
      dds.forEach(function (other) { if (other !== dd) setDd(other, false); });
      setDd(dd, open);
    });
    // Фокус ушёл из списка (Tab дальше) — закрываем
    dd.addEventListener('focusout', function (e) {
      if (!dd.contains(e.relatedTarget)) setDd(dd, false);
    });
  });
  if (dds.length) {
    document.addEventListener('click', function (e) {
      dds.forEach(function (dd) { if (!dd.contains(e.target)) setDd(dd, false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      dds.forEach(function (dd) {
        if (!dd.classList.contains('is-open')) return;
        setDd(dd, false);
        dd.querySelector('.dd__btn').focus();
      });
    });
  }

  /* ---------- Шапка: прячется при прокрутке вниз, появляется при прокрутке вверх ---------- */
  var header = document.querySelector('.header');
  if (header) {
    var lastY = window.scrollY;
    var ticking = false;
    var THRESHOLD = 6;                 // мелкие подрагивания колёсика не учитываем

    function updateHeader() {
      ticking = false;
      var y = window.scrollY;
      var delta = y - lastY;
      if (Math.abs(delta) < THRESHOLD) return;
      var keepVisible =
        y < header.offsetHeight ||                                   // верх страницы
        (nav && nav.classList.contains('is-open')) ||                // открыто мобильное меню
        header.querySelector('[data-dd].is-open') ||                 // открыт выпадающий список
        header.contains(document.activeElement);                     // фокус клавиатуры в шапке
      header.classList.toggle('is-hidden', delta > 0 && !keepVisible);
      lastY = y;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateHeader);
      }
    }, { passive: true });

    // Переход по Tab в спрятанную шапку сразу её показывает
    header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
  }

  /* ---------- Карточки на тач-экранах ----------
     Наведения нет, поэтому «наведённой» становится карточка, через которую проходит середина экрана:
     у направлений проигрывается рисунок (.is-open), у остальных — то же, что при наведении (.is-mid).
     Ушла из середины — возвращается в покой, при возврате проиграется снова. */
  var mids = Array.prototype.slice.call(document.querySelectorAll(
    '.dir, .card, .price'));
  if (mids.length && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var midTicking = false;
    var updateMids = function () {
      midTicking = false;
      var mid = window.innerHeight / 2;
      mids.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var on = r.height > 0 && r.top < mid && r.bottom > mid;
        el.classList.toggle('is-mid', on);
        if (el.classList.contains('dir')) el.classList.toggle('is-open', on);
      });
    };
    window.addEventListener('scroll', function () {
      if (!midTicking) { midTicking = true; requestAnimationFrame(updateMids); }
    }, { passive: true });
    window.addEventListener('resize', updateMids);
    updateMids();
  }

  /* ---------- Появление при прокрутке ----------
     Класс .js-reveal ставит встроенный скрипт в <head> (если движение не отключено).
     Каждый [data-reveal] и лента этапов запускаются, когда сами попадают в экран,
     поэтому последовательность этапов не проиграет, пока лента ещё ниже края экрана. */
  if (document.documentElement.classList.contains('js-reveal')) {
    window.revealReady = true;
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('[data-reveal], .steps').forEach(function (el) {
      if (el.classList.contains('steps')) el.classList.add('will-reveal');
      revealObserver.observe(el);
    });
  }

  /* ---------- Иллюстрации вне карточек: проигрываются, когда попадают в экран ---------- */
  var plays = document.querySelectorAll('[data-play]');
  if (plays.length) {
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var playObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          // Небольшая пауза, чтобы сцена успела проявиться вместе с текстом
          setTimeout(function () { entry.target.classList.add('is-open'); }, 250);
          playObserver.unobserve(entry.target);
        });
      }, { threshold: 0.45 });
      plays.forEach(function (el) { playObserver.observe(el); });
    } else {
      plays.forEach(function (el) { el.classList.add('is-open'); });
    }
  }

  /* ---------- «О нас»: сборка компании на прокрутке ----------
     Секция высотой в несколько экранов, сцена внутри закреплена. Прогресс прокрутки 0…1 делится
     на участки: каждый этаж доезжает на своём, в конце опускается крыша. Работает и назад. */
  var asm = document.querySelector('[data-asm]');
  if (asm && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    asm.classList.add('is-scrub');
    var slides = asm.querySelectorAll('.asm__slide');
    var asmTicking = false;
    var lastSlide = -1;

    var seg = function (p, from, to) {
      var t = Math.min(Math.max((p - from) / (to - from), 0), 1);
      return t * t * (3 - 2 * t);                                  // плавный старт и доводка
    };

    // Сцена не прыгает за каждым движением пальца, а плавно догоняет прокрутку:
    // каждый кадр проходит часть оставшегося пути (cur → target), пока не доедет
    var cur = -1;
    var target = 0;
    var measure = function () {
      var rect = asm.getBoundingClientRect();
      var total = asm.offsetHeight - asmVh;
      target = total > 0 ? Math.min(Math.max(-rect.top / total, 0), 1) : 1;
    };
    var updateAsm = function () {
      asmTicking = false;
      measure();
      cur = cur < 0 ? target : cur + (target - cur) * 0.14;
      if (Math.abs(target - cur) < 0.0005) cur = target;
      else { asmTicking = true; requestAnimationFrame(updateAsm); }
      var p = cur;
      asm.style.setProperty('--p', p.toFixed(4));
      asm.style.setProperty('--m1', seg(p, 0.10, 0.30).toFixed(4));
      asm.style.setProperty('--m2', seg(p, 0.32, 0.52).toFixed(4));
      asm.style.setProperty('--m3', seg(p, 0.54, 0.74).toFixed(4));
      asm.style.setProperty('--m4', seg(p, 0.78, 0.92).toFixed(4));
      // 0 — манифест, 1…4 — главы
      var active = p < 0.08 ? 0 : p < 0.31 ? 1 : p < 0.53 ? 2 : p < 0.77 ? 3 : 4;
      if (active !== lastSlide) {
        slides.forEach(function (s, i) {
          s.classList.toggle('is-active', i === active);
          s.classList.toggle('is-past', i < active);
        });
        lastSlide = active;
      }
    };

    window.addEventListener('scroll', function () {
      if (!asmTicking) { asmTicking = true; requestAnimationFrame(updateAsm); }
    }, { passive: true });
    // Высоту экрана запоминаем и меняем только при повороте или смене ширины: на телефоне адресная строка
    // прячется и появляется при каждом свайпе, и без этого сцена подпрыгивала бы вместе с ней
    var asmVh = window.innerHeight;
    var asmVw = window.innerWidth;
    window.addEventListener('resize', function () {
      if (window.innerWidth !== asmVw) { asmVw = window.innerWidth; asmVh = window.innerHeight; }
      if (!asmTicking) { asmTicking = true; requestAnimationFrame(updateAsm); }
    });
    updateAsm();
  }

  /* ---------- Фильтр в портфолио и блоге ---------- */
  document.querySelectorAll('[data-filter-group]').forEach(function (group) {
    var list = group.parentElement.querySelector('[data-filter-list]');
    if (!list) return;
    group.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-filter]');
      if (!btn) return;
      var value = btn.getAttribute('data-filter');
      group.querySelectorAll('[data-filter]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      list.querySelectorAll('[data-cat]').forEach(function (item) {
        var show = value === 'all' || item.getAttribute('data-cat') === value;
        item.hidden = !show;
        if (show) item.classList.add('is-in');        // карточки, ещё не показанные прокруткой, сразу видны
      });
    });
  });

  /* ---------- Поделиться статьёй ---------- */
  document.querySelectorAll('[data-share]').forEach(function (box) {
    var url = encodeURIComponent(location.href);
    var title = encodeURIComponent(document.querySelector('h1') ? document.querySelector('h1').textContent : document.title);
    var links = {
      tg: 'https://t.me/share/url?url=' + url + '&text=' + title,
      vk: 'https://vk.com/share.php?url=' + url + '&title=' + title,
      viber: 'viber://forward?text=' + title + '%20' + url,
      wa: 'https://wa.me/?text=' + title + '%20' + url
    };
    box.querySelectorAll('[data-net]').forEach(function (a) {
      a.href = links[a.getAttribute('data-net')];
    });
    var status = box.querySelector('.share__status');
    var copy = box.querySelector('[data-copy]');
    if (copy) {
      copy.addEventListener('click', function () {
        if (!navigator.clipboard) { status.textContent = location.href; return; }
        navigator.clipboard.writeText(location.href).then(function () {
          status.textContent = 'Ссылка скопирована';
          setTimeout(function () { status.textContent = ''; }, 2500);
        });
      });
    }
  });

  /* ---------- FAQ: плавное раскрытие и закрытие ответа ----------
     <details> открывается мгновенно, поэтому высоту ответа анимируем сами.
     Повторный клик во время анимации разворачивает её с текущей высоты. */
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.qa').forEach(function (qa) {
    var summary = qa.querySelector('summary');
    var body = qa.querySelector('.qa__answer');
    if (!summary || !body || !body.animate) return;
    var anim = null;

    summary.addEventListener('click', function (e) {
      if (reduceMotion.matches) return;
      e.preventDefault();
      var from = body.getBoundingClientRect().height;
      var closing = qa.open && !qa.classList.contains('is-closing');
      if (anim) anim.cancel();

      if (closing) {
        qa.classList.add('is-closing');
        anim = body.animate(
          [{ height: from + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
          { duration: 280, easing: 'cubic-bezier(.4,0,.6,1)' }
        );
        anim.onfinish = function () { qa.open = false; qa.classList.remove('is-closing'); anim = null; };
      } else {
        qa.classList.remove('is-closing');
        qa.open = true;
        anim = body.animate(
          [{ height: from + 'px', opacity: 0, transform: 'translateY(-6px)' },
           { height: body.scrollHeight + 'px', opacity: 1, transform: 'none' }],
          { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' }
        );
        anim.onfinish = function () { anim = null; };
      }
    });
  });

  /* ---------- Поп-ап «Связаться с нами» ---------- */
  var dialog = document.getElementById('contact-dialog');

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-open-contact]');
    if (opener && dialog) {
      e.preventDefault();
      resetForm(dialog);
      dialog.showModal();
      return;
    }
    if (e.target.closest('[data-close-contact]') && dialog) dialog.close();
  });

  // Клик по затемнённому фону закрывает окно
  if (dialog) {
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close();
    });
  }

  /* ---------- Сертификаты и благодарности ----------
     Лента сама сдвигается на один документ раз в 3,5 с, пока она в экране. Наведение ставит на паузу,
     любое действие человека (стрелки, свайп, колёсико, клавиатура) выключает автопрокрутку совсем —
     дальше листает он сам. При «уменьшить движение» автопрокрутки нет. */
  var awardsBox = document.querySelector('[data-awards]');
  if (awardsBox) {
    var awardsSection = awardsBox.closest('.awards');
    var awardItems = Array.prototype.slice.call(awardsBox.querySelectorAll('.award'));
    var prevBtn = awardsSection.querySelector('[data-awards-prev]');
    var nextBtn = awardsSection.querySelector('[data-awards-next]');
    var bar = awardsSection.querySelector('.awards__progress');
    var stepSize = function () {
      return awardItems.length > 1 ? awardItems[1].offsetLeft - awardItems[0].offsetLeft : awardsBox.clientWidth;
    };
    var maxScroll = function () { return awardsBox.scrollWidth - awardsBox.clientWidth; };

    var updateAwards = function () {
      var max = maxScroll();
      var share = max > 0 ? awardsBox.clientWidth / awardsBox.scrollWidth : 1;
      var pos = max > 0 ? awardsBox.scrollLeft / max : 0;
      bar.style.setProperty('--w', (share * 100).toFixed(2) + '%');
      bar.style.setProperty('--x', (pos * (1 / share - 1) * 100).toFixed(2) + '%');
      prevBtn.disabled = awardsBox.scrollLeft <= 2;
      nextBtn.disabled = awardsBox.scrollLeft >= max - 2;
    };
    awardsBox.addEventListener('scroll', function () { requestAnimationFrame(updateAwards); }, { passive: true });
    window.addEventListener('resize', updateAwards);
    updateAwards();

    var go = function (dir) { awardsBox.scrollBy({ left: dir * stepSize(), behavior: 'smooth' }); };

    // Автопрокрутка
    var auto = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var paused = false, inView = false, timer = null;
    var stopAuto = function () { auto = false; clearInterval(timer); timer = null; };
    var tickAuto = function () {
      if (!auto || paused || !inView || document.hidden) return;
      if (awardsBox.scrollLeft >= maxScroll() - 2) awardsBox.scrollTo({ left: 0, behavior: 'smooth' });
      else go(1);
    };
    if (auto) {
      timer = setInterval(tickAuto, 3500);
      new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; }, { threshold: 0.4 }).observe(awardsBox);
      awardsBox.addEventListener('mouseenter', function () { paused = true; });
      awardsBox.addEventListener('mouseleave', function () { paused = false; });
      ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(function (type) {
        awardsBox.addEventListener(type, stopAuto, { passive: true });
      });
    }

    prevBtn.addEventListener('click', function () { stopAuto(); go(-1); });
    nextBtn.addEventListener('click', function () { stopAuto(); go(1); });
    awardsBox.addEventListener('keydown', function (e) {
      if (e.target !== awardsBox) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });

    // Мышью ленту можно тянуть; после перетаскивания клик по документу не открывает его
    var drag = null, dragged = false;
    awardsBox.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: awardsBox.scrollLeft };
      dragged = false;
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!dragged && Math.abs(dx) > 5) { dragged = true; awardsBox.classList.add('is-drag'); }
      if (dragged) awardsBox.scrollLeft = drag.left - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!drag) return;
      drag = null;
      if (!dragged) return;
      // Отпустили — доводим до ближайшего документа
      var step = stepSize();
      var target = Math.round(awardsBox.scrollLeft / step) * step;
      awardsBox.classList.remove('is-drag');
      awardsBox.scrollTo({ left: target, behavior: 'smooth' });
    });
    awardsBox.addEventListener('click', function (e) {
      if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; }
    }, true);
    awardsBox.addEventListener('dragstart', function (e) { e.preventDefault(); });

    // Документ крупно
    var docDialog = document.getElementById('award-dialog');
    if (docDialog) {
      var docImg = docDialog.querySelector('.doc__img');
      var docTitle = docDialog.querySelector('.doc__caption h2');
      var docFrom = docDialog.querySelector('.doc__caption p');
      var current = 0;
      var showDoc = function (i) {
        current = (i + awardItems.length) % awardItems.length;
        var item = awardItems[current];
        var img = item.querySelector('img');
        docImg.src = img.currentSrc || img.src;
        docImg.alt = img.alt;
        docTitle.textContent = item.querySelector('.award__title').textContent;
        docFrom.textContent = item.querySelector('.award__from').textContent;
      };
      awardItems.forEach(function (item, i) {
        item.querySelector('[data-award]').addEventListener('click', function () {
          stopAuto();
          showDoc(i);
          docDialog.showModal();
        });
      });
      docDialog.querySelector('[data-doc-prev]').addEventListener('click', function () { showDoc(current - 1); });
      docDialog.querySelector('[data-doc-next]').addEventListener('click', function () { showDoc(current + 1); });
      docDialog.querySelector('[data-award-close]').addEventListener('click', function () { docDialog.close(); });
      docDialog.addEventListener('click', function (e) { if (e.target === docDialog) docDialog.close(); });
      docDialog.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') showDoc(current + 1);
        if (e.key === 'ArrowLeft') showDoc(current - 1);
      });
      // После закрытия лента показывает тот документ, на котором остановились
      docDialog.addEventListener('close', function () {
        awardsBox.scrollTo({ left: awardItems[current].offsetLeft - awardItems[0].offsetLeft, behavior: 'auto' });
        awardItems[current].querySelector('[data-award]').focus({ preventScroll: true });
      });
    }
  }

  /* ---------- Согласие на cookie ----------
     Плашка внизу экрана при первом заходе. Выбор хранится в localStorage; событие cookie-consent
     сообщает его остальному коду (например, чтобы включить счётчики только после «Принять»). */
  var cookieBar = document.querySelector('[data-cookie]');
  if (cookieBar) {
    var CONSENT_KEY = 'inassist-cookie-consent';
    var saved = null;
    try { saved = localStorage.getItem(CONSENT_KEY); } catch (err) {}
    window.cookieConsent = saved;
    if (!saved) {
      cookieBar.hidden = false;
      requestAnimationFrame(function () {
        setTimeout(function () { cookieBar.classList.add('is-shown'); }, 600);
      });
    }
    cookieBar.addEventListener('click', function (e) {
      var choice = e.target.closest('[data-cookie-choice]');
      if (!choice) return;
      var value = choice.getAttribute('data-cookie-choice');
      try { localStorage.setItem(CONSENT_KEY, value); } catch (err) {}
      window.cookieConsent = value;
      document.dispatchEvent(new CustomEvent('cookie-consent', { detail: value }));
      cookieBar.classList.remove('is-shown');
      setTimeout(function () { cookieBar.hidden = true; }, 350);
    });
  }

  /* ---------- Формы заявки ---------- */
  var messages = {
    name: 'Укажите имя, чтобы мы знали, как к вам обращаться',
    phone: 'Укажите телефон: на него перезвонит менеджер',
    phoneFormat: 'Проверьте номер: в нём должно быть не меньше 9 цифр',
    consent: 'Без согласия на обработку данных мы не можем принять заявку'
  };

  function showError(input, text) {
    var err = document.getElementById(input.id + '-err');
    input.setAttribute('aria-invalid', text ? 'true' : 'false');
    if (err) {
      err.textContent = text || '';
      if (text) input.setAttribute('aria-describedby', err.id);
      else input.removeAttribute('aria-describedby');
    }
  }

  function validate(form) {
    var firstInvalid = null;
    var name = form.elements.name;
    var phone = form.elements.phone;
    var consent = form.elements.consent;

    var nameError = name.value.trim() ? '' : messages.name;
    showError(name, nameError);
    if (nameError && !firstInvalid) firstInvalid = name;

    var digits = phone.value.replace(/\D/g, '');
    var phoneError = !digits ? messages.phone : (digits.length < 9 ? messages.phoneFormat : '');
    showError(phone, phoneError);
    if (phoneError && !firstInvalid) firstInvalid = phone;

    var consentError = consent.checked ? '' : messages.consent;
    showError(consent, consentError);
    if (consentError && !firstInvalid) firstInvalid = consent;

    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function resetForm(scope) {
    var form = scope.querySelector('[data-form]');
    var done = scope.querySelector('.form-done');
    if (!form || !done || done.hidden) return;
    form.reset();
    form.hidden = false;
    done.hidden = true;
  }

  document.querySelectorAll('[data-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(form)) return;

      // TODO: отправка на сервер (CRM, почта или Telegram-бот) — подключим вместе с бэкендом.
      var done = form.parentElement.querySelector('.form-done');
      form.hidden = true;
      if (done) {
        done.hidden = false;
        done.focus();
      }
    });

    // Сообщение об ошибке исчезает, как только поле исправлено
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true') showError(e.target, '');
    });
    form.addEventListener('change', function (e) {
      if (e.target.type === 'checkbox' && e.target.checked) showError(e.target, '');
    });
  });

  /* ---------- Вкладки портфолио ---------- */
  document.querySelectorAll('[role="tablist"]').forEach(function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));

    function select(tab) {
      tabs.forEach(function (t) {
        var active = t === tab;
        t.setAttribute('aria-selected', String(active));
        t.tabIndex = active ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !active;
      });
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home') next = tabs[0];
        if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) {
          e.preventDefault();
          select(next);
          next.focus();
        }
      });
    });
  });
})();

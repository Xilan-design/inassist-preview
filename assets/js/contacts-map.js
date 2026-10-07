/* ИнАссист — карта на странице «Контакты».
   Leaflet + плитки OpenStreetMap; в серо-бирюзовый их тонирует CSS-фильтр (.map .leaflet-tile-pane).
   Для боевого сайта с заметным трафиком стоит подключить провайдера плиток с ключом (MapTiler, Stadia и т. п.):
   публичный сервер OSM рассчитан на небольшую нагрузку.
   Колесо мыши страницу не перехватывает, на телефоне карта не мешает прокрутке пальцем. */
(function () {
  'use strict';

  var el = document.getElementById('map');
  if (!el || !window.L) return;

  var OFFICE = [53.90136, 27.54529];   // г. Минск, ул. Короля, 2 (по OpenStreetMap)

  var map = L.map(el, {
    center: OFFICE,
    zoom: 16,
    minZoom: 11,
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: !L.Browser.mobile,
    tap: false
  });

  L.control.zoom({ position: 'bottomright', zoomInTitle: 'Приблизить', zoomOutTitle: 'Отдалить' }).addTo(map);
  map.attributionControl.setPrefix(false);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  }).addTo(map);

  // Метка фирменного цвета: капля с белой точкой
  var pin = L.divIcon({
    className: 'map__pin',
    html: '<svg viewBox="0 0 34 44" aria-hidden="true"><path d="M17 0C7.6 0 0 7.5 0 16.8 0 29.4 17 44 17 44s17-14.6 17-27.2C34 7.5 26.4 0 17 0Z" fill="#00A398"/><circle cx="17" cy="16.5" r="5.5" fill="#fff"/></svg>',
    iconSize: [34, 44],
    iconAnchor: [17, 44]
  });
  L.marker(OFFICE, { icon: pin, keyboard: false, interactive: false }).addTo(map);

  // Контейнер мог поменять размер, пока грузились шрифты и стили
  if ('ResizeObserver' in window) new ResizeObserver(function () { map.invalidateSize(); }).observe(el);
})();

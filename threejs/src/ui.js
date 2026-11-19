import './style.css';
import config from '../../shared/settings.json';
import { icon } from './icons.js';

const pictures = import.meta.glob('../../assets/miniaturas/*.png', { eager:true, query:'?url', import:'default' });
const byId = (id) => document.getElementById(id);

export function createUI(actions) {
  const list = byId('treasure-list'), dialog = byId('dialog');
  const notice = byId('notice'), frame = byId('viewport');
  const rows = new Map();
  let timer, previousState = '', fatal = false;
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
  if (matchMedia('(pointer: coarse)').matches) {
    const gestures = [
      ['Un dedo', 'Girar cámara'], ['Pellizcar', 'Acercar y alejar'],
      ['Dos dedos', 'Desplazar cámara'], ['Un toque', 'Recoger tesoro']
    ];
    document.querySelectorAll('.controls li').forEach((item, i) => {
      item.querySelector('b').textContent = gestures[i][0];
      item.querySelector('small').textContent = gestures[i][1];
    });
    document.querySelector('.controls .keys').textContent = '↔';
  }
  for (const {id, name} of config.treasures) {
    const row = document.createElement('li');
    row.className = 'specimen';
    row.dataset.treasure = id;
    row.innerHTML = '<div class="thumb"><img alt=""></div><div><b></b><small>Por descubrir</small></div><span class="radio" aria-hidden="true"></span>';
    row.querySelector('img').src = pictures['../../assets/miniaturas/' + id + '.png'];
    row.querySelector('b').textContent = name;
    list.append(row);
    rows.set(id, row);
  }
  function showNotice(text) {
    clearTimeout(timer);
    notice.querySelector('span').textContent = text;
    notice.hidden = false;
    timer = setTimeout(() => { notice.hidden = true; }, text === config.welcome ? 6500 : 3600);
  }
  function showDialog(html) {
    byId('dialog-content').innerHTML = html;
    // En pantalla completa, el diálogo debe pertenecer al subárbol visible.
    (document.fullscreenElement ?? document.body).append(dialog);
    if (!dialog.open) dialog.showModal();
  }
  function guide() {
    showDialog(`<div class="eyebrow gold">${icon('book')} GUÍA DE CAMPO</div>
      <h2 id="dialog-title">Cómo explorar</h2>
      <p>Rodea las rocas y cambia el ángulo de la cámara hasta ver cada tesoro. Haz clic en la parte visible para registrarlo.</p>
      <dl>
        <dt><kbd>Arrastrar</kbd></dt><dd>Girar alrededor del arrecife</dd>
        <dt><kbd>Rueda</kbd></dt><dd>Acercar o alejar. En una pantalla táctil, usa dos dedos.</dd>
        <dt><kbd>W A S D</kbd></dt><dd>Desplazar la cámara</dd>
        <dt><kbd>P</kbd> <kbd>L</kbd></dt><dd>Pausar animaciones o cambiar la iluminación</dd>
        <dt><kbd>R</kbd></dt><dd>Reiniciar la búsqueda y la media de FPS</dd>
        <dt><kbd>Esc</kbd></dt><dd>Cerrar la guía o salir del visor ampliado</dd>
      </dl>
      <p class="credits">Pontificia Universidad Católica del Ecuador, sede Manabí<br>John Steven Lopez Velez y Samuel Andres Vega Mendoza<br>Docente: Ing. Victor Hugo Alonzo Palacios</p>
      <button class="dialog-action" data-action="continue" autofocus>Volver al arrecife</button>`);
  }
  function expanded() { return Boolean(document.fullscreenElement || frame.classList.contains('expanded')); }
  function updateExpand() {
    const button = document.querySelector('[data-action="expand"]');
    button.innerHTML = icon(expanded() ? 'shrink' : 'expand');
    button.title = expanded() ? 'Reducir visor' : 'Ampliar visor';
    button.setAttribute('aria-label', button.title);
  }
  async function expand() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (frame.classList.contains('expanded')) frame.classList.remove('expanded');
    else {
      try { await frame.requestFullscreen(); }
      catch { frame.classList.add('expanded'); }
    }
    updateExpand();
  }
  function escape() {
    if (dialog.open) { dialog.close(); return; }
    if (expanded()) { void expand(); return; }
    guide();
  }
  document.addEventListener('fullscreenchange', updateExpand);
  document.addEventListener('click', e => {
    const action = e.target.closest?.('[data-action]')?.dataset.action;
    if (!action) return;
    switch (action) {
      case 'guide': guide(); break;
      case 'continue': dialog.close(); break;
      case 'expand': void expand(); break;
      case 'dismiss': notice.hidden = true; break;
      case 'reset': actions.reset(); showNotice('Búsqueda reiniciada. Los cinco tesoros te esperan.'); break;
      case 'home': actions.home(); showNotice('Cámara centrada.'); break;
      case 'pause': case 'light': actions[action](); break;
    }
  });
  const formatFps = value => Number.isFinite(value) && value > 0 ? String(Math.round(value)) : '—';
  return {
    update({found, paused, light, fps, average}) {
      byId('fps').textContent = formatFps(fps);
      byId('avg').textContent = formatFps(average);
      const state = [found.join(','), paused, light].join('|');
      if (state === previousState) return;
      previousState = state;
      for (const [id, row] of rows) {
        const yes = found.includes(id);
        row.classList.toggle('found', yes);
        row.querySelector('small').textContent = yes ? 'Encontrado' : 'Por descubrir';
        row.querySelector('.radio').innerHTML = yes ? icon('check') : '';
      }
      byId('count').textContent = found.length;
      document.querySelectorAll('.segments i').forEach((el, i) => el.classList.toggle('found', i < found.length));
      byId('live-label').textContent = paused ? 'EN PAUSA' : 'EN DIRECTO';
      const pause = document.querySelector('[data-action="pause"]');
      pause.setAttribute('aria-pressed', String(paused));
      pause.title = paused ? 'Reanudar animaciones (P)' : 'Pausar animaciones (P)';
      pause.setAttribute('aria-label', pause.title);
      pause.innerHTML = icon(paused ? 'play' : 'pause');
      const lighting = document.querySelector('[data-action="light"]');
      lighting.innerHTML = icon(light ? 'moon' : 'sun');
      lighting.setAttribute('aria-pressed', String(Boolean(light)));
      byId('light-name').textContent = config.lights[light].name;
      byId('light-name').previousElementSibling.innerHTML = icon(light ? 'moon' : 'sun');
    },
    notify: showNotice,
    victory() {
      showDialog(`<div class="eyebrow gold">${icon('check')} 5 / 5 TESOROS</div>
        <h2 id="dialog-title">Expedición completada</h2><p>${config.victory}</p>
        <button class="dialog-action" data-action="reset" autofocus>Volver a explorar</button>`);
    },
    reset() { if (dialog.open) dialog.close(); notice.hidden = true; },
    error(text) {
      fatal = true;
      notice.hidden = true;
      byId('render-error').textContent = text;
      byId('render-error').hidden = false;
      byId('live-label').textContent = 'SIN SEÑAL';
      document.querySelectorAll('.scene-actions button,.reset-btn').forEach(button => { button.disabled = true; });
    },
    blocked: () => fatal || dialog.open,
    escape,
  };
}

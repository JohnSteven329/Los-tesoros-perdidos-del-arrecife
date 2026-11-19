// Iconos dibujados en una cuadrícula común de 24 unidades.
const paths = {
  reset:'<path d="M4 11a8 8 0 1 1 2.2 6M4 5v6h6"/>',
  expand:'<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
  shrink:'<path d="M4 9h5V4m6 0v5h5M9 20v-5H4m11 5v-5h5"/>',
  focus:'<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/><circle cx="12" cy="12" r="3"/>',
  sun:'<circle cx="12" cy="12" r="3.8"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon:'<path d="M20.7 14A8.8 8.8 0 0 1 10 3.2 9.2 9.2 0 1 0 20.7 14Z"/>',
  pause:'<path d="M8 5v14m8-14v14" stroke-width="3"/>',
  play:'<path d="m8 4 12 8-12 8z"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/>',
  book:'<path d="M6 3h13v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 0v18m4-14h4m-4 4h3"/>',
  controls:'<path d="M4 7h6m4 0h6M4 17h10m4 0h2"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
  drag:'<path d="M8 12V8.5a1.5 1.5 0 0 1 3 0V5a1.5 1.5 0 0 1 3 0v4a1.5 1.5 0 0 1 3 0v2a1.5 1.5 0 0 1 3 0v4c0 4-2.5 6-6 6h-1c-2 0-3-1-4.3-2.6L4.5 13a1.4 1.4 0 0 1 2-1.9l2 1.9"/>',
  wheel:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  pointer:'<path d="m5 3 14 10-6 1.2L10 20Z"/>',
  activity:'<path d="M2 13h5l3-8 4 14 3-8h5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>'
};
export function icon(name) {
  return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+paths[name]+'</svg>';
}

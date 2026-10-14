export {};
type Frame = {
  id: string;
  title: string;
  description: string;
  src: string;
  url: string;
  exif: Record<string, string>;
  location: { city?: string; label?: string };
  collections: { name: string; url: string }[];
};
const photoFrames: Frame[] = JSON.parse(
  document.querySelector('#viewer-data')?.textContent ?? '[]',
);
const dialog = document.querySelector<HTMLDialogElement>('#lightbox')!;
const img = document.querySelector<HTMLImageElement>('#viewer-image')!;
const panel = document.querySelector<HTMLElement>('#viewer-panel')!;
const loading = document.querySelector<HTMLElement>('#viewer-loading')!;
let selection: Frame[] = [];
let index = 0;
let trigger: HTMLElement | undefined;
let zoomed = false;
let startX = 0;
let startY = 0;
let touches = 0;
function show() {
  const f = selection[index];
  if (!f) return;
  zoomed = false;
  img.classList.remove('zoomed');
  document.querySelector('#viewer-zoom')!.setAttribute('aria-pressed', 'false');
  img.alt = f.title;
  loading.hidden = false;
  loading.textContent = '正在加载照片…';
  img.src = f.src;
  if (img.complete && img.naturalWidth) loading.hidden = true;
  document.querySelector('#viewer-count')!.textContent =
    `${String(index + 1).padStart(2, '0')} / ${String(selection.length).padStart(2, '0')}`;
  document.querySelector('#viewer-title')!.textContent = f.title;
  const detail = document.querySelector<HTMLAnchorElement>('#viewer-detail')!;
  detail.href = f.url;
  panel.replaceChildren();
  for (const [label, value] of [
    ['Description', f.description],
    ['Location', f.location.label ?? f.location.city ?? ''],
    ...Object.entries(f.exif),
  ])
    if (value) {
      const p = document.createElement('p');
      const title = document.createElement('span');
      title.className = 'eyebrow';
      title.textContent = label;
      p.append(
        title,
        document.createElement('br'),
        document.createTextNode(value),
      );
      panel.append(p);
    }
  for (const c of f.collections) {
    const a = document.createElement('a');
    a.href = c.url;
    a.textContent = `${c.name} ↗`;
    panel.append(a);
  }
  const next = selection[(index + 1) % selection.length];
  if (next && next.id !== f.id) {
    const preload = new Image();
    preload.src = next.src;
  }
}
function move(delta: number) {
  if (selection.length) {
    index = (index + delta + selection.length) % selection.length;
    show();
  }
}
img.addEventListener('load', () => {
  loading.hidden = true;
});
img.addEventListener('error', () => {
  loading.hidden = false;
  loading.textContent = '照片加载失败，请稍后重试。';
});
document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest<HTMLAnchorElement>(
    'a[data-photo]',
  );
  if (!target || e.ctrlKey || e.metaKey) return;
  const frame = photoFrames.find((f) => f.id === target.dataset.photo);
  if (!frame) return;
  e.preventDefault();
  trigger = target;
  const cards = [...document.querySelectorAll<HTMLElement>('.photo-card')]
    .filter((c) => !c.hidden)
    .map((c) => c.dataset.id);
  selection = cards.includes(frame.id)
    ? cards.map((id) => photoFrames.find((f) => f.id === id)!).filter(Boolean)
    : photoFrames;
  index = selection.findIndex((f) => f.id === frame.id);
  show();
  dialog.showModal();
  document.body.style.overflow = 'hidden';
  document.querySelector<HTMLButtonElement>('#viewer-close')?.focus();
});
document
  .querySelector('#viewer-close')!
  .addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  document.body.style.overflow = '';
  panel.hidden = true;
  document.querySelector('#viewer-info')!.setAttribute('aria-pressed', 'false');
  trigger?.focus();
});
document
  .querySelector('#viewer-prev')!
  .addEventListener('click', () => move(-1));
document
  .querySelector('#viewer-next')!
  .addEventListener('click', () => move(1));
document.querySelector('#viewer-info')!.addEventListener('click', (e) => {
  panel.hidden = !panel.hidden;
  (e.currentTarget as HTMLElement).setAttribute(
    'aria-pressed',
    String(!panel.hidden),
  );
});
document.querySelector('#viewer-zoom')!.addEventListener('click', (e) => {
  zoomed = !zoomed;
  img.classList.toggle('zoomed', zoomed);
  (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(zoomed));
});
dialog.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    move(-1);
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    move(1);
  }
});
img.addEventListener(
  'touchstart',
  (e) => {
    touches = e.touches.length;
    if (touches === 1) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
  },
  { passive: true },
);
img.addEventListener(
  'touchend',
  (e) => {
    if (zoomed || touches !== 1) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5)
      move(dx < 0 ? 1 : -1);
  },
  { passive: true },
);

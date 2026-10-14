export {};
const controls = document.querySelector<HTMLFormElement>('#gallery-controls');
controls?.addEventListener('submit', (e) => e.preventDefault());
const grid = document.querySelector('#gallery-grid');
const cards = Array.from(
  document.querySelectorAll<HTMLElement>('#gallery-grid .photo-card'),
);
function filter() {
  const query = (
    document.querySelector<HTMLInputElement>('#gallery-search')?.value ?? ''
  )
    .toLocaleLowerCase()
    .trim();
  const category =
    document.querySelector<HTMLSelectElement>('#category-filter')?.value;
  const city = document.querySelector<HTMLSelectElement>('#city-filter')?.value;
  const sort =
    document.querySelector<HTMLSelectElement>('#sort-filter')?.value ?? 'order';
  let count = 0;
  cards.sort((a, b) =>
    sort === 'order'
      ? Number(a.dataset.order) - Number(b.dataset.order)
      : (b.dataset[sort] ?? '').localeCompare(a.dataset[sort] ?? ''),
  );
  for (const card of cards) {
    card.hidden = !!(
      (category && category !== card.dataset.category) ||
      (city && city !== card.dataset.city) ||
      (query &&
        !(card.dataset.search ?? '').toLocaleLowerCase().includes(query))
    );
    if (!card.hidden) count++;
    grid?.append(card);
  }
  document.querySelector('#result-count')!.textContent = String(count);
  (document.querySelector('#gallery-empty') as HTMLElement).hidden =
    count !== 0;
}
controls?.addEventListener('input', filter);
controls?.addEventListener('change', filter);

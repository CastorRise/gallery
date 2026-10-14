import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
type Point = {
  id: string;
  title: string;
  city: string;
  latitude: number;
  longitude: number;
  image: string;
  url: string;
  privacy: string;
};
const data = JSON.parse(document.querySelector('#map-data')!.textContent!) as {
  photos: Point[];
  collections: { id: string; photoIds: string[] }[];
};
const map = L.map('photo-map', { scrollWheelZoom: false }).setView(
  [32, 112],
  5,
);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);
const layer = L.layerGroup().addTo(map);
function draw() {
  layer.clearLayers();
  const city = document.querySelector<HTMLSelectElement>('#map-city')!.value;
  const collection =
    document.querySelector<HTMLSelectElement>('#map-collection')!.value;
  const ids = data.collections.find((c) => c.id === collection)?.photoIds;
  const visible = data.photos.filter(
    (p) => (!city || p.city === city) && (!ids || ids.includes(p.id)),
  );
  const groups = new Map<string, Point[]>();
  for (const p of visible) {
    const key = `${p.latitude},${p.longitude}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  for (const points of groups.values()) {
    const p = points[0];
    const content = document.createElement('div');
    content.className = 'map-popup';
    const title = document.createElement('h3');
    title.textContent = `${p.city || '公开位置'} · ${points.length} 张`;
    content.append(title);
    for (const point of points) {
      const a = document.createElement('a');
      a.href = point.url;
      a.dataset.photo = point.id;
      const image = document.createElement('img');
      image.src = point.image;
      image.alt = point.title;
      image.loading = 'lazy';
      const caption = document.createElement('span');
      caption.textContent = point.title;
      a.append(image, caption);
      content.append(a);
    }
    L.marker([p.latitude, p.longitude], {
      icon: L.divIcon({
        className: 'photo-marker',
        html: `<span>${points.length}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
    })
      .bindPopup(content, { maxWidth: 280, maxHeight: 320 })
      .addTo(layer);
  }
  document.querySelector('#map-count')!.textContent =
    `${visible.length} 张公开地点作品`;
  if (visible.length)
    map.fitBounds(
      L.latLngBounds(
        visible.map((p) => [p.latitude, p.longitude] as [number, number]),
      ).pad(0.2),
      { maxZoom: 10 },
    );
}
document.querySelector('#map-city')!.addEventListener('change', draw);
document.querySelector('#map-collection')!.addEventListener('change', draw);
draw();

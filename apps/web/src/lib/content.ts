import content from '../../../../content/gallery.json';
import type {
  PublicContent,
  PublicPhoto,
} from '../../../../packages/shared/src/index.ts';
export const data = content as PublicContent;
export const url = (path = '') => `/gallery/${path.replace(/^\//, '')}`;
export const photoUrl = (id: string) => url(`photos/${id}/`);
export const imageUrl = (file: string) => url(`images/${file}`);
export const ordered = data.photos.toSorted((a, b) => a.order - b.order);
export const categoryName = (id: string) =>
  data.categories.find((c) => c.id === id)?.name ?? '';
export const largest = (p: PublicPhoto) => p.variants.at(-1)!;
export const srcset = (p: PublicPhoto) =>
  p.variants.map((v) => `${imageUrl(v.file)} ${v.width}w`).join(', ');

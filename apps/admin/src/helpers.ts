import type { Photo } from '../../../packages/shared/src/index.ts';
export const uid = () => crypto.randomUUID();
export const thumb = (p: Photo) => `/api/images/${p.variants[0].file}`;
export const large = (p: Photo) => `/api/images/${p.variants.at(-1)!.file}`;
export function move<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

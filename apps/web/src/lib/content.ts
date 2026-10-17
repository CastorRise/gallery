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

import { localeFromPath, localizedUrl, messages } from './i18n';
import { translateContent } from './content-translations';
export function pageContent(pathname: string) {
  const locale = localeFromPath(pathname);
  const translate = (text: string) => translateContent(text, locale);
  const localized: PublicContent = {
    ...data,
    settings: {
      ...data.settings,
      manifesto: translate(data.settings.manifesto),
      bio: translate(data.settings.bio),
      philosophy: translate(data.settings.philosophy),
    },
    photos: data.photos.map((p) => ({
      ...p,
      title: translate(p.title),
      description: translate(p.description),
      alt: translate(p.alt),
      location: {
        ...p.location,
        ...(p.location.city ? { city: translate(p.location.city) } : {}),
        ...(p.location.label ? { label: translate(p.location.label) } : {}),
      },
    })),
    categories: data.categories.map((c) => ({ ...c, name: translate(c.name) })),
    collections: data.collections.map((c) => ({
      ...c,
      name:
        locale === 'en'
          ? c.englishName || translate(c.name)
          : translate(c.name),
      description: translate(c.description),
    })),
    journals: data.journals.map((j) => ({
      ...j,
      title: translate(j.title),
      subtitle: translate(j.subtitle),
      place: translate(j.place),
      blocks: j.blocks.map((b) => ({
        ...b,
        ...('text' in b ? { text: translate(b.text) } : {}),
        ...('caption' in b && b.caption
          ? { caption: translate(b.caption) }
          : {}),
      })),
    })),
  };
  return {
    locale,
    t: messages[locale],
    data: localized,
    ordered: localized.photos.toSorted((a, b) => a.order - b.order),
    url: (path = '') => localizedUrl(path, locale),
    photoUrl: (id: string) => localizedUrl(`photos/${id}/`, locale),
    categoryName: (id: string) =>
      localized.categories.find((c) => c.id === id)?.name ?? '',
  };
}

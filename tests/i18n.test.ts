import test from 'node:test';
import assert from 'node:assert/strict';
import {
  locales,
  localizedUrl,
  localeFromPath,
  pagePath,
  messages,
} from '../apps/web/src/lib/i18n.ts';
import { translateContent } from '../apps/web/src/lib/content-translations.ts';
test('all four locales preserve detail and collection routes without duplicating the gallery base', () => {
  for (const path of [
    '',
    'gallery/',
    'photos/stable-id/',
    'collections/cloud-atlas/',
  ]) {
    for (const locale of locales) {
      const url = localizedUrl(path, locale);
      assert.equal(localeFromPath(url), locale);
      assert.equal(pagePath(url), path);
      for (const target of locales)
        assert.equal(pagePath(localizedUrl(pagePath(url), target)), path);
    }
  }
});
test('translations cover the same UI labels and preserve new authored text and blank values', () => {
  for (const locale of locales) {
    assert.deepEqual(Object.keys(messages[locale]), Object.keys(messages.en));
    assert.ok(Object.values(messages[locale]).every(Boolean));
    assert.equal(translateContent('', locale), '');
    assert.equal(
      translateContent('new authored story', locale),
      'new authored story',
    );
  }
  assert.equal(translateContent('佩佩可爱！', 'zh'), '佩佩可爱！');
  assert.equal(translateContent('佩佩可爱！', 'en'), 'Pepe is adorable!');
});

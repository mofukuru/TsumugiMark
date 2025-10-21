import { getLanguage } from 'obsidian';
import en from './locales/en';
import ja from './locales/ja';

const localeMap: { [key: string]: Partial<typeof en> } = {
    en,
    ja
};

export function t(localizationId: keyof typeof en, ...inserts: string[]): string {
  const lang = getLanguage();
  const userLocale = localeMap[lang || 'en'];
  let localeStr = userLocale?.[localizationId] ?? en[localizationId] ?? localizationId;
  localeStr = localeStr.replaceAll(/%(\d+)/g, (_, indexStr) => {
    const index = parseInt(indexStr, 10) - 1;
    return inserts[index] ?? '';
  });

  return localeStr;
}

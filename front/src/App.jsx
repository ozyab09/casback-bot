import React, { useEffect, useState } from 'react';
import { call } from './api.js';

// Поддержка i18n: язык из initData user.language_code
// Поддержка глубоких ссылок:
// ?open=search|cards|places|more - открыть соответствующую вкладку
// #/cards/:id - открыть вкладку "Карты" и выделить карту по ID
// #/places/:id - открыть вкладку "Точки" и выделить точку по ID

// Переводы UI
const locales = {
  ru: {
    appName: '💳 Мой Кэшбэк',
    searchPlaceholder: 'MCC или точка — напр. 5411 / супермаркет',
    amountPlaceholder: 'Сумма',
    searchButton: 'Подобрать',
    noResults: 'Карт пока нет — заведите их во вкладке «Карты».',
    bestVariant: 'лучший вариант',
    cashback: '≈ {cashback} ₽',
    limitReached: 'лимит',
    muted: 'muted',
    small: 'small',
    tabs: {
      search: 'Поиск',
      cards: 'Карты',
      places: 'Точки',
      more: 'Ещё',
    },
    header: '💳 Мой Кэшбэк',
    state: {
      error: '⚠ {error}',
      loading: 'Загрузка…',
    },
  },
  en: {
    appName: '💳 My Cashback',
    searchPlaceholder: 'MCC or point e.g. 5411 / supermarket',
    amountPlaceholder: 'Amount',
    searchButton: 'Select',
    noResults: 'No cards yet — add them in the Cards tab.',
    bestVariant: 'best variant',
    cashback: '≈ {cashback} ₽',
    limitReached: 'limit',
    muted: 'muted',
    small: 'small',
    tabs: {
      search: 'Search',
      cards: 'Cards',
      places: 'Places',
      more: 'More',
    },
    header: '💳 My Cashback',
    state: {
      error: '⚠ {error}',
      loading: 'Loading…',
    },
  },
};

// Определяем язык из initData при старте
useEffect(() => {
  const savedFromURL = new URLSearchParams(window.location.search).get('lang');
  if (savedFromURL && locales[savedFromURL]) {
    setLocale(savedFromURL);
  }
}, []);

// Запоминаем выбор в localStorage, чтобы не запрашивать каждый раз
useEffect(() => {
  if (locale) {
    localStorage.setItem('cashbackLocale', locale);
  }
}, [locale]);

// Загружаем язык при монтировании
useEffect(() => {
  const saved = localStorage.getItem('cashbackLocale');
  const userLang = typeof window.Telegram !== 'undefined' && window.Telegram.WebApp
    ? window.Telegram.WebApp.initData?.user?.language_code
    : null;
  
  // Приоритет: сохраненный > язык Telegram > русский по умолчанию
  const langFromStorage = saved ? saved : userLang ? (locales[userLang] ? userLang : 'ru') : 'ru';
  setLocale(langFromStorage);
}, []);

const [locale, setLocale] = useState('ru');

// Транслятор строк
const t = (key, defaults = '') => {
  const parts = key.split('.');
  let translation = locales[locale];
  for (const part of parts) {
    if (translation && typeof translation === 'object') {
      translation = translation[part];
    } else {
      translation = defaults;
      break;
    }
  }
  return translation !== undefined && translation !== null ? translation : defaults;
};

const [summary, setSummary] = useState(null);
const [error, setError] = useState(null);
const [tab, setTab] = useState('search');

const reload = async () => {
  try {
    setSummary(await call('getOverview'));
    setError(null);
  } catch (e) {
    setError(e.message);
  }
};

useEffect(() => {
  const twa = window.Telegram?.WebApp;
  twa?.ready();
  twa?.expand();
  reload();
}, []);

if (error)
  return (
    <div className="state state--error">
      ⚠ {t('state.error', '{error}')}
      <br />
      <button className="btn" onClick={reload}>{t('state.retry', 'Повторить')}</button>
    </div>
  );
if (!summary) return <div className="state">{t('state.loading', 'Загрузка…')}</div>;

return (
  <div className="app">
    <header className="top"><h1>{t('appName')}</h1></header>

    {tab === 'search' && <Search summary={summary} />}
    {tab === 'cards' && <Cards summary={summary} reload={reload} />}
    {tab === 'places' && <Places summary={summary} reload={reload} />}
    {tab === 'more' && <More reload={reload} />}

    <nav className="tabs">
      {[['search', '🔍', 'Поиск'], ['cards', '💳', 'Карты'], ['places', '📍', 'Точки'], ['more', '⚙️', 'Ещё']].map(
        ([id, icon, label]) => (
          <button key={id} className={`tab ${tab === id ? 'tab--active' : ''}`} onClick={() => setTab(id)}>
            <span>{icon}</span>{t(`tabs.${label}`)}
          </button>
        )
      )}
    </nav>
  </div>
);
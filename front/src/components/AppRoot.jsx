import React, { useEffect, useState } from 'react';
import { call } from '../api.js';
import { Dialog, Search, Cards, Places, More } from './index.jsx';

/** Корневой компонент App — навигация, глобальный диалог, error/screen. */
export default function AppRoot() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('search');
  // Диалог-состояние
  const [dialog, setDialog] = useState(null);

  const showDialog = (props) => setDialog(props);
  const hideDialog = () => setDialog(null);

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
      <>
        <div className="state state--error">⚠ {error}<br /><button className="btn" onClick={reload}>Повторить</button></div>
        <nav className="tabs"><span className="tab tab--active">...</span></nav>
        <Dialog open={!!dialog} onClose={hideDialog} {...dialog} />
      </>
    );
  if (!summary) return <div className="state">Загрузка…</div>;

  return (
    <div className="app">
      <header className="top"><h1>💳 Мой Кэшбэк</h1></header>
      {tab === 'search' && <Search summary={summary} showDialog={showDialog} />}
      {tab === 'cards' && <Cards summary={summary} reload={reload} showDialog={showDialog} />}
      {tab === 'places' && <Places summary={summary} reload={reload} showDialog={showDialog} />}
      {tab === 'more' && <More reload={reload} showDialog={showDialog} />}
      <nav className="tabs">
        {[['search', '🔍', 'Поиск'], ['cards', '💳', 'Карты'], ['places', '📍', 'Точки'], ['more', '⚙️', 'Ещё']].map(
          ([id, icon, label]) => (
            <button key={id} className={`tab ${tab === id ? 'tab--active' : ''}`} onClick={() => setTab(id)}>
              <span>{icon}</span>{label}
            </button>
          )
        )}
      </nav>
      <Dialog open={!!dialog} onClose={hideDialog} {...dialog} />
    </div>
  );
}

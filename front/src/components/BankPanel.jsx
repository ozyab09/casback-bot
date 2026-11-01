import React, { useState } from 'react';
import { call } from '../api.js';
import Editor from './Editor.jsx';

/** Панель конкретного банка (карты + категории) с локальными фильтрами. */
export default function BankPanel({ bank, reload, showDialog }) {
  const [open, setOpen] = useState(true);
  const [edit, setEdit] = useState(null);
  const [cardFilter, setCardFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const filteredCards = cardFilter.trim()
    ? bank.cards.filter(c => c.name.toLowerCase().includes(cardFilter.toLowerCase()) ||
                              (c.last4 && c.last4.includes(cardFilter)))
    : bank.cards;

  const filteredCats = catFilter.trim()
    ? bank.categories.filter(c => c.name.toLowerCase().includes(catFilter.toLowerCase()))
    : bank.categories;

  return (
    <div className="panel">
      <div className="panel__head" onClick={() => setOpen(!open)}>
        <b>{bank.name}</b>
        <span className="muted small">карт {bank.cards.length} · кат {bank.categories.length}</span>
      </div>
      {open && (
        <>
          <div className="row" style={{ gap: '0.4em', marginBottom: '0.3em' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9em' }}>Карты:</label>
            <input className="inp" style={{ flex: 1 }} placeholder="Фильтр…" value={cardFilter}
              onChange={(e) => setCardFilter(e.target.value)} aria-label="Фильтр карт" />
          </div>
          {filteredCards.length === 0 && bank.cards.length === 0 && <div className="muted small">— карт нет</div>}
          {filteredCards.length === 0 && bank.cards.length > 0 && (
            <div className="muted small">Нет совпадений.</div>
          )}
          {filteredCards.map((c) => (
            <div key={c.id} className="li" onClick={() => setEdit({ kind: 'card', item: c })}>
              <span><b>{c.name}</b>{c.last4 && ` •${c.last4}`}{c.monthlyLimit != null && <span className="muted small"> · лимит {c.monthlyLimit}₽</span>}</span>
              <span className="muted">✎</span>
            </div>
          ))}
          {bank.cards.length > 0 && (
            <button className="btn btn--lite" onClick={() => setEdit({ kind: 'card', item: null, bankId: bank.id })}>＋ карта</button>
          )}
          <div className="row" style={{ gap: '0.4em', marginTop: '0.8em', marginBottom: '0.3em' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9em' }}>Категории:</label>
            <input className="inp" style={{ flex: 1 }} placeholder="Фильтр…" value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)} aria-label="Фильтр категорий" />
          </div>
          {filteredCats.length === 0 && bank.categories.length === 0 && <div className="muted small">— категорий нет</div>}
          {filteredCats.length === 0 && bank.categories.length > 0 && (
            <div className="muted small">Нет совпадений.</div>
          )}
          {filteredCats.map((c) => (
            <div key={c.id} className="li" onClick={() => setEdit({ kind: 'category', item: c })}>
              <span><b>{c.name}</b>{c.percent ? ` · ${c.percent}%` : ''}{c.isAll && ' · ★ все'}</span>
              <span className="muted">✎</span>
            </div>
          ))}
          {bank.categories.length > 0 && (
            <button className="btn btn--lite" onClick={() => setEdit({ kind: 'category', item: null, bankId: bank.id })}>＋ категория</button>
          )}
        </>
      )}
      {edit && <Editor edit={edit} bank={bank} onClose={() => setEdit(null)} reload={reload} showDialog={showDialog} />}
    </div>
  );
}

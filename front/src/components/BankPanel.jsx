import React, { useState } from 'react';
import { call } from '../api.js';
import Editor from './Editor.jsx';

/** Панель конкретного банка (карты + категории). */
export default function BankPanel({ bank, reload, showDialog }) {
  const [open, setOpen] = useState(true);
  const [edit, setEdit] = useState(null);
  return (
    <div className="panel">
      <div className="panel__head" onClick={() => setOpen(!open)}>
        <b>{bank.name}</b>
        <span className="muted small">карт {bank.cards.length} · кат {bank.categories.length}</span>
      </div>
      {open && (
        <>
          <h4>Карты</h4>
          {bank.cards.length === 0 && <div className="muted small">— карт нет</div>}
          {bank.cards.map((c) => (
            <div key={c.id} className="li" onClick={() => setEdit({ kind: 'card', item: c })}>
              <span><b>{c.name}</b>{c.last4 && ` •${c.last4}`}{c.monthlyLimit != null && <span className="muted small"> · лимит {c.monthlyLimit}₽</span>}</span>
              <span className="muted">✎</span>
            </div>
          ))}
          <button className="btn btn--lite" onClick={() => setEdit({ kind: 'card', item: null, bankId: bank.id })}>＋ карта</button>
          <h4>Категории</h4>
          {bank.categories.length === 0 && <div className="muted small">— категорий нет</div>}
          {bank.categories.map((c) => (
            <div key={c.id} className="li" onClick={() => setEdit({ kind: 'category', item: c })}>
              <span><b>{c.name}</b>{c.percent ? ` · ${c.percent}%` : ''}{c.isAll && ' · ★ все'}</span>
              <span className="muted">✎</span>
            </div>
          ))}
          <button className="btn btn--lite" onClick={() => setEdit({ kind: 'category', item: null, bankId: bank.id })}>＋ категория</button>
        </>
      )}
      {edit && <Editor edit={edit} bank={bank} onClose={() => setEdit(null)} reload={reload} showDialog={showDialog} />}
    </div>
  );
}

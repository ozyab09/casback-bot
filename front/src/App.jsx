import React, { useEffect, useState } from 'react';
import { call } from './api.js';

// Мини-апп «Мой Кэшбэк»: 4 экрана — Поиск, Карты (банки/категории), Точки, Ещё.

export default function App() {
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
        ⚠ {error}
        <br />
        <button className="btn" onClick={reload}>Повторить</button>
      </div>
    );
  if (!summary) return <div className="state">Загрузка…</div>;

  return (
    <div className="app">
      <header className="top"><h1>💳 Мой Кэшбэк</h1></header>

      {tab === 'search' && <Search summary={summary} />}
      {tab === 'cards' && <Cards summary={summary} reload={reload} />}
      {tab === 'places' && <Places summary={summary} reload={reload} />}
      {tab === 'more' && <More reload={reload} />}

      <nav className="tabs">
        {[['search', '🔍', 'Поиск'], ['cards', '💳', 'Карты'], ['places', '📍', 'Точки'], ['more', '⚙️', 'Ещё']].map(
          ([id, icon, label]) => (
            <button key={id} className={`tab ${tab === id ? 'tab--active' : ''}`} onClick={() => setTab(id)}>
              <span>{icon}</span>{label}
            </button>
          )
        )}
      </nav>
    </div>
  );
}

/* ================= Поиск ================= */
function Search() {
  const [query, setQuery] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const run = async () => {
    if (!query.trim()) return;
    setBusy(true); setMsg(null);
    try {
      setResult(await call('search', { query: query.trim(), amount: amount === '' ? undefined : Number(amount) }));
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  return (
    <main className="screen">
      <div className="panel">
        <input className="inp" placeholder="MCC или точка — напр. 5411 / супермаркет" value={query}
          onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
        <div className="row">
          <input className="inp inp--sum" placeholder="Сумма" inputMode="decimal" value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
          <button className="btn btn--primary" onClick={run} disabled={busy}>{busy ? '…' : 'Подобрать'}</button>
        </div>
      </div>

      {msg && <div className="state state--error">⚠ {msg}</div>}

      {result?.suggestions && (
        <div className="panel">
          <h3>Уточните запрос</h3>
          <div className="chips">
            {result.suggestions.map((s) => (
              <button key={s.mcc} className="chip" onClick={() => setQuery(String(s.mcc))}>
                {s.mcc} · {s.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {result?.variants && (
        <>
          <div className="panel">
            <h3>{result.title ? `${result.mcc} · ${result.title}` : `MCC ${result.mcc}`}</h3>
          </div>
          {result.variants.length === 0
            ? <div className="state">Карт пока нет — заведите их во вкладке «Карты».</div>
            : result.variants.map((v) => <Variant key={v.cardId} v={v} best={v.cardId === result.best} />)}
        </>
      )}
    </main>
  );
}

function Variant({ v, best }) {
  return (
    <div className={`variant ${best ? 'variant--best' : ''}`}>
      <div className="variant__head">
        <div>
          <b>{v.bankName} · {v.cardName}{v.last4 ? ` •${v.last4}` : ''}</b>
          <div className="muted">
            {v.categoryName ? (v.isFallback ? 'Все покупки → ' : '') + v.categoryName : 'нет подходящей категории'}
            {v.monthlyLimit != null && ` · лимит ${v.monthlyLimit}₽, остаток ${v.limitLeft ?? '?'}₽`}
          </div>
        </div>
        <div className={`percent ${v.percent > 0 ? 'percent--good' : ''} ${v.limitReached ? 'percent--zero' : ''}`}>
          {v.limitReached ? 'лимит' : `${v.percent}%`}
        </div>
      </div>
      {v.cashback != null && !v.limitReached && v.percent > 0 &&
        <div className="cashback">≈ {v.cashback} ₽{best ? ' · лучший вариант' : ''}</div>}
    </div>
  );
}

/* ================= Карты / Банки / Категории ================= */
function Cards({ summary, reload }) {
  const [bankModal, setBankModal] = useState(null);
  return (
    <main className="screen">
      <button className="btn btn--add" onClick={() => setBankModal({ name: '' })}>＋ Новый банк</button>
      {summary.banks.length === 0 && <div className="state">Банков пока нет.</div>}
      {summary.banks.map((bank) => <BankPanel key={bank.id} bank={bank} reload={reload} />)}
      {bankModal && (
        <Modal title="Новый банк" onClose={() => setBankModal(null)}>
          <input className="inp" placeholder="Название банка" value={bankModal.name} autoFocus
            onChange={(e) => setBankModal({ ...bankModal, name: e.target.value })} />
          <button className="btn btn--primary" onClick={async () => {
            try { await call('saveBank', { name: bankModal.name }); setBankModal(null); reload(); }
            catch (e) { alert(e.message); }
          }}>Создать</button>
        </Modal>
      )}
    </main>
  );
}

function BankPanel({ bank, reload }) {
  const [open, setOpen] = useState(true);
  const [edit, setEdit] = useState(null); // {kind:'card'|'category', item|form}
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
      {edit && <Editor edit={edit} bank={bank} onClose={() => setEdit(null)} reload={reload} />}
    </div>
  );
}

function Editor({ edit, bank, onClose, reload }) {
  const isCard = edit.kind === 'card';
  const src = edit.item;
  const [form, setForm] = useState(
    isCard
      ? { name: src?.name ?? '', last4: src?.last4 ?? '', holder: src?.holder ?? '', monthlyLimit: src?.monthlyLimit ?? '', limitLeft: src?.limitLeft ?? '', note: src?.note ?? '' }
      : { name: src?.name ?? '', percent: src?.percent ?? 0, mccText: (src?.mcc ?? []).join(', '), exclText: (src?.excludedMcc ?? []).join(', '), isAll: src?.isAll ?? false, note: src?.note ?? '' }
  );
  const [mccHint, setMccHint] = useState([]);
  const bankId = src?.bankId ?? edit.bankId;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    try {
      if (isCard) {
        await call('saveCard', {
          bankId, id: src?.id, name: form.name, last4: form.last4 || null,
          holder: form.holder || null,
          monthlyLimit: form.monthlyLimit === '' ? null : Number(form.monthlyLimit),
          limitLeft: form.limitLeft === '' ? null : Number(form.limitLeft),
          note: form.note || null,
        });
      } else {
        const mcc = parseMccList(form.mccText, 'MCC');
        const excludedMcc = parseMccList(form.exclText, 'Исключения MCC');
        await call('saveCategory', { bankId, id: src?.id, name: form.name, percent: Number(form.percent) || 0, mcc, excludedMcc, isAll: Boolean(form.isAll), note: form.note || null });
      }
      onClose(); reload();
    } catch (e) { alert(e.message); }
  };

  const del = async () => {
    if (!confirm('Удалить безвозвратно?')) return;
    try {
      await call(isCard ? 'deleteCard' : 'deleteCategory', { id: src.id });
      onClose(); reload();
    } catch (e) { alert(e.message); }
  };

  return (
    <Modal title={isCard ? (src ? 'Карта' : 'Новая карта') : (src ? 'Категория' : 'Новая категория')} onClose={onClose}>
      <input className="inp" placeholder={isCard ? 'Название карты' : 'Название категории'} value={form.name} autoFocus onChange={set('name')} />
      {isCard ? (
        <>
          <div className="row">
            <input className="inp" placeholder="Последние 4 цифры" maxLength={4} inputMode="numeric" value={form.last4} onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, '') })} />
            <input className="inp" placeholder="Владелец" value={form.holder} onChange={set('holder')} />
          </div>
          <div className="row">
            <input className="inp" inputMode="numeric" placeholder="Месячный лимит ₽" value={form.monthlyLimit} onChange={(e) => setForm({ ...form, monthlyLimit: e.target.value.replace(/\D/g, '') })} />
            <input className="inp" inputMode="numeric" placeholder="Остаток ₽" value={form.limitLeft} onChange={(e) => setForm({ ...form, limitLeft: e.target.value.replace(/\D/g, '') })} />
          </div>
        </>
      ) : (
        <>
          <div className="row">
            <input className="inp inp--sum" inputMode="numeric" placeholder="%" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value.replace(/\D/g, '') })} />
            <label className="check"><input type="checkbox" checked={form.isAll} onChange={(e) => setForm({ ...form, isAll: e.target.checked })} /> «Все покупки»</label>
          </div>
          <input className="inp" placeholder="MCC через запятую: 5300, 5411" value={form.mccText} onChange={set('mccText')} />
          <input className="inp" placeholder="Исключения MCC: 4829" value={form.exclText} onChange={set('exclText')} />
          <textarea className="inp inp--area" placeholder="Заметка" value={form.note} onChange={set('note')} />
        </>
      )}
      <div className="row">
        {src && <button className="btn btn--danger" onClick={del}>Удалить</button>}
        <button className="btn btn--primary" onClick={save}>Сохранить</button>
      </div>
    </Modal>
  );
}

/* ================= Точки ================= */
function Places({ summary, reload }) {
  const [edit, setEdit] = useState(null);
  return (
    <main className="screen">
      <button className="btn btn--add" onClick={() => setEdit({ name: '', mcc: '' })}>＋ Точка</button>
      {summary.places.length === 0 && <div className="state">Точек пока нет. Точка = название + MCC, чтобы искать по тексту.</div>}
      <div className="panel">
        {summary.places.map((p) => (
          <div key={p.id} className="li" onClick={() => setEdit({ ...p })}>
            <span><b>{p.name}</b> <span className="muted small">· MCC {p.mcc}</span></span>
            <span className="muted">✎</span>
          </div>
        ))}
      </div>
      {edit && (
        <Modal title={edit.id ? 'Точка' : 'Новая точка'} onClose={() => setEdit(null)}>
          <input className="inp" placeholder="Название" value={edit.name} autoFocus onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <input className="inp" inputMode="numeric" placeholder="MCC" value={edit.mcc} onChange={(e) => setEdit({ ...edit, mcc: e.target.value.replace(/\D/g, '') })} />
          <div className="row">
            {edit.id ? <button className="btn btn--danger" onClick={async () => {
              try { await call('deletePlace', { id: edit.id }); setEdit(null); reload(); } catch (e) { alert(e.message); }
            }}>Удалить</button> : <span />}
            <button className="btn btn--primary" onClick={async () => {
              const mcc = Number(edit.mcc);
              if (!Number.isInteger(mcc) || mcc < 1 || mcc > 99999) { alert('MCC: введите целое число 1…99999'); return; }
              try { await call('savePlace', { id: edit.id, name: edit.name, mcc }); setEdit(null); reload(); } catch (e) { alert(e.message); }
            }}>Сохранить</button>
          </div>
        </Modal>
      )}
    </main>
  );
}

/* ================= Ещё: экспорт / импорт ================= */
function More({ reload }) {
  const exportData = async () => {
    try {
      const data = await call('exportData');
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cashback-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { alert(e.message); }
  };

  const importData = async (mode) => {
    const file = document.getElementById('import-file').files[0];
    if (!file) { alert('Сначала выберите файл'); return; }
    if (mode === 'replace' && !confirm('Заменить ВСЕ текущие данные?')) return;
    try {
      const data = JSON.parse(await file.text());
      await call('importData', { mode, data });
      reload();
      alert('Импорт готов');
    } catch (e) { alert('Ошибка импорта: ' + e.message); }
  };

  return (
    <main className="screen">
      <div className="panel">
        <h3>Резервная копия</h3>
        <button className="btn btn--primary" onClick={exportData}>⬇ Экспорт JSON</button>
        <input type="file" id="import-file" accept=".json" className="inp inp--file" />
        <div className="row">
          <button className="btn" onClick={() => importData('merge')}>⬆ Импорт (дополнить)</button>
          <button className="btn btn--danger" onClick={() => importData('replace')}>⬆ Импорт (заменить)</button>
        </div>
        <p className="muted small">Формат: spec 3 — банки → карты/категории, точки. Экспорт совместим сам с собой.</p>
      </div>
    </main>
  );
}

/* ================= Общие ================= */

/** Разбор списка MCC: только целые 1…99999, мусор — понятная ошибка вместо NaN. */
function parseMccList(text, field) {
  const out = [];
  for (const raw of String(text ?? '').split(',')) {
    const s = raw.trim();
    if (!s) continue;
    const n = Number(s);
    if (!Number.isInteger(n) || n < 1 || n > 99999)
      throw new Error(`${field}: «${s}» — не MCC-код (целое число 1…99999)`);
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__box" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <b>{title}</b>
          <button className="modal__x" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

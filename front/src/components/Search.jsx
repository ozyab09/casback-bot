import React, { useState } from 'react';
import { call } from '../api.js';
import Variant from './Variant.jsx';

/** Экран поиска — MCC или текст → подбор банкоматов/категорий. */
export default function Search() {
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
          onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} aria-label="MCC или название точки" />
        <div className="row">
          <input className="inp inp--sum" placeholder="Сумма" inputMode="decimal" value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Сумма покупки" />
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

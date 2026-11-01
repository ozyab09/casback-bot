import React, { useState } from 'react';
import { call } from '../api.js';
import Modal from './Modal.jsx';

/** Экран «Точки» — пользовательский справочник названий + MCC. */
export default function Places({ summary, reload, showDialog }) {
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
          <input className="inp" placeholder="Название" value={edit.name} autoFocus onChange={(e) => setEdit({ ...edit, name: e.target.value })} aria-label="Название точки" />
          <input className="inp" inputMode="numeric" placeholder="MCC" value={edit.mcc} onChange={(e) => setEdit({ ...edit, mcc: e.target.value.replace(/\D/g, '') })} aria-label="MCC код" />
          <div className="row">
            {edit.id ? <button className="btn btn--danger" onClick={async () => {
              try { await call('deletePlace', { id: edit.id }); setEdit(null); reload(); } catch (e) { showDialog({ type: 'error', message: e.message }); }
            }}>Удалить</button> : <span />}
            <button className="btn btn--primary" onClick={async () => {
              const mcc = Number(edit.mcc);
              if (!Number.isInteger(mcc) || mcc < 1 || mcc > 99999) { showDialog({ type: 'error', message: 'MCC: введите целое число 1…99999' }); return; }
              try { await call('savePlace', { id: edit.id, name: edit.name, mcc }); setEdit(null); reload(); } catch (e) { showDialog({ type: 'error', message: e.message }); }
            }}>Сохранить</button>
          </div>
        </Modal>
      )}
    </main>
  );
}

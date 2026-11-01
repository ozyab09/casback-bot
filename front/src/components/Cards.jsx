import React, { useState } from 'react';
import { call } from '../api.js';
import BankPanel from './BankPanel.jsx';
import Modal from './Modal.jsx';

/** Экран «Карты» — список банков с фильтром. */
export default function Cards({ summary, reload, showDialog }) {
  const [bankModal, setBankModal] = useState(null);
  const [filter, setFilter] = useState('');

  const filtered = filter.trim()
    ? summary.banks.filter(b => b.name.toLowerCase().includes(filter.toLowerCase()))
    : summary.banks;

  return (
    <main className="screen">
      <div className="row" style={{ gap: '0.5em' }}>
        <input className="inp" placeholder="Поиск банка…" value={filter}
          onChange={(e) => setFilter(e.target.value)} aria-label="Поиск банка" />
        <button className="btn btn--add" onClick={() => setBankModal({ name: '' })}>＋ Новый банк</button>
      </div>
      {filtered.length === 0 && (
        <div className="state">{summary.banks.length === 0 ? 'Банков пока нет.' : 'Ничего не найдено.'}</div>
      )}
      {filtered.map((bank) => <BankPanel key={bank.id} bank={bank} reload={reload} showDialog={showDialog} />)}
      {bankModal && (
        <Modal title="Новый банк" onClose={() => setBankModal(null)}>
          <input className="inp" placeholder="Название банка" value={bankModal.name} autoFocus
            onChange={(e) => setBankModal({ ...bankModal, name: e.target.value })} aria-label="Название банка" />
          <button className="btn btn--primary" onClick={async () => {
            try { await call('saveBank', { name: bankModal.name }); setBankModal(null); reload(); }
            catch (e) { showDialog({ type: 'error', message: e.message }); }
          }}>Создать</button>
        </Modal>
      )}
    </main>
  );
}

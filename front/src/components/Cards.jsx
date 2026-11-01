import React, { useState } from 'react';
import { call } from '../api.js';
import BankPanel from './BankPanel.jsx';
import Modal from './Modal.jsx';

/** Экран «Карты» — список банков, карт, категорий. */
export default function Cards({ summary, reload, showDialog }) {
  const [bankModal, setBankModal] = useState(null);
  return (
    <main className="screen">
      <button className="btn btn--add" onClick={() => setBankModal({ name: '' })}>＋ Новый банк</button>
      {summary.banks.length === 0 && <div className="state">Банков пока нет.</div>}
      {summary.banks.map((bank) => <BankPanel key={bank.id} bank={bank} reload={reload} showDialog={showDialog} />)}
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

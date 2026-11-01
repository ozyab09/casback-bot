import React, { useState } from 'react';
import { call } from '../api.js';
import { parseMccList } from '../helpers.mjs';
import Modal from './Modal.jsx';

/** Редактор карты или категории */
export default function Editor({ edit, bank, onClose, reload, showDialog }) {
  const isCard = edit.kind === 'card';
  const src = edit.item;
  const [form, setForm] = useState(
    isCard
      ? { name: src?.name ?? '', last4: src?.last4 ?? '', holder: src?.holder ?? '', monthlyLimit: src?.monthlyLimit ?? '', limitLeft: src?.limitLeft ?? '', note: src?.note ?? '' }
      : { name: src?.name ?? '', percent: src?.percent ?? 0, mccText: (src?.mcc ?? []).join(', '), exclText: (src?.excludedMcc ?? []).join(', '), isAll: src?.isAll ?? false, note: src?.note ?? '' }
  );
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
    } catch (e) { showDialog({ type: 'error', message: e.message }); }
  };

  const del = async () => {
    showDialog({ type: 'confirm', title: 'Удаление', message: 'Удалить безвозвратно?', yesLabel: 'Удалить', onYes: (confirmed) => {
      if (!confirmed) return;
      (async () => {
        try {
          await call(isCard ? 'deleteCard' : 'deleteCategory', { id: src.id });
          onClose(); reload();
        } catch (e) { showDialog({ type: 'error', message: e.message }); }
      })();
    }});
  };

  return (
    <Modal title={isCard ? (src ? 'Карта' : 'Новая карта') : (src ? 'Категория' : 'Новая категория')} onClose={onClose}>
      <input className="inp" placeholder={isCard ? 'Название карты' : 'Название категории'} value={form.name} autoFocus onChange={set('name')} aria-label={isCard ? 'Название карты' : 'Название категории'} />
      {isCard ? (
        <>
          <div className="row">
            <input className="inp" placeholder="Последние 4 цифры" maxLength={4} inputMode="numeric" value={form.last4} onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, '') })} aria-label="Последние 4 цифры" />
            <input className="inp" placeholder="Владелец" value={form.holder} onChange={set('holder')} aria-label="Владелец карты" />
          </div>
          <div className="row">
            <input className="inp" inputMode="numeric" placeholder="Месячный лимит ₽" value={form.monthlyLimit} onChange={(e) => setForm({ ...form, monthlyLimit: e.target.value.replace(/\D/g, '') })} aria-label="Месячный лимит" />
            <input className="inp" inputMode="numeric" placeholder="Остаток ₽" value={form.limitLeft} onChange={(e) => setForm({ ...form, limitLeft: e.target.value.replace(/\D/g, '') })} aria-label="Остаток лимита" />
          </div>
        </>
      ) : (
        <>
          <div className="row">
            <input className="inp inp--sum" inputMode="numeric" placeholder="%" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value.replace(/\D/g, '') })} aria-label="Процент кэшбэка" />
            <label className="check"><input type="checkbox" checked={form.isAll} onChange={(e) => setForm({ ...form, isAll: e.target.checked })} /> «Все покупки»</label>
          </div>
          <input className="inp" placeholder="MCC через запятую: 5300, 5411" value={form.mccText} onChange={set('mccText')} aria-label="MCC коды через запятую" />
          <input className="inp" placeholder="Исключения MCC: 4829" value={form.exclText} onChange={set('exclText')} aria-label="Исключения MCC" />
          <textarea className="inp inp--area" placeholder="Заметка" value={form.note} onChange={set('note')} aria-label="Заметка" />
        </>
      )}
      <div className="row">
        {src && <button className="btn btn--danger" onClick={del}>Удалить</button>}
        <button className="btn btn--primary" onClick={save}>Сохранить</button>
      </div>
    </Modal>
  );
}

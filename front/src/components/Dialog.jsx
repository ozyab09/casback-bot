import React from 'react';

/** Кастомный Dialog — полная замена alert()/confirm().
 * Типы: 'error', 'info', 'confirm' */
export default function Dialog({ open, onClose, type, title, message, yesLabel, onYes }) {
  if (!open) return null;

  return (
    <div className="modal" onClick={type === 'confirm' ? onClose : undefined}>
      <div className="modal__box" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <b>{title || (type === 'error' ? 'Ошибка' : 'Подтверждение')}</b>
          {type !== 'confirm' && <button className="modal__x" onClick={onClose}>✕</button>}
        </div>
        <p style={{ margin: '0.8em 0', whiteSpace: 'pre-line' }}>{message}</p>
        {type === 'confirm' ? (
          <div className="row">
            <button className="btn btn--danger" onClick={() => { onYes?.(true); onClose(); }}>Да</button>
            <button className="btn" onClick={() => { onYes?.(false); onClose(); }}>Отмена</button>
          </div>
        ) : (
          <button className="btn btn--primary" onClick={onClose}>{yesLabel || 'OK'}</button>
        )}
      </div>
    </div>
  );
}

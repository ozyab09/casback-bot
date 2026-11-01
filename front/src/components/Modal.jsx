import React from 'react';

/** Встроенная модалка для форм редактирования (bank / card / category / place). */
export default function Modal({ title, children, onClose }) {
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

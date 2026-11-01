import React from 'react';

/** Карточка варианта кэшбэка. */
export default function Variant({ v, best }) {
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

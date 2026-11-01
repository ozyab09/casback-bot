import React from 'react';
import { call } from '../api.js';

/** Экран «Ещё» — экспорт/импорт данных (JSON backup). */
export default function More({ reload, showDialog }) {
  const exportData = async () => {
    try {
      const data = await call('exportData');
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cashback-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showDialog({ type: 'info', message: 'Экспорт завершён ✓' });
    } catch (e) { showDialog({ type: 'error', message: e.message }); }
  };

  const importData = async (mode) => {
    const fileInput = document.getElementById('import-file');
    const file = fileInput?.files?.[0];
    if (!file) { showDialog({ type: 'error', message: 'Сначала выберите файл' }); return; }
    if (mode === 'replace') {
      showDialog({ type: 'confirm', title: 'Замена данных', message: 'Заменить ВСЕ текущие данные?\nЭто действие необратимо.', yesLabel: 'Заменить всё', onYes: (confirmed) => {
        if (!confirmed) return;
        doImport(mode);
      }});
    } else {
      doImport(mode);
    }

    async function doImport(importMode) {
      try {
        const data = JSON.parse(await file.text());
        await call('importData', { mode: importMode, data });
        reload();
        showDialog({ type: 'info', message: 'Импорт готов ✓' });
      } catch (e) { showDialog({ type: 'error', message: 'Ошибка импорта: ' + e.message }); }
    }
  };

  return (
    <main className="screen">
      <div className="panel">
        <h3>Резервная копия</h3>
        <button className="btn btn--primary" onClick={exportData}>⬇ Экспорт JSON</button>
        <input type="file" id="import-file" accept=".json" className="inp inp--file" aria-label="Файл для импорта" />
        <div className="row">
          <button className="btn" onClick={() => importData('merge')}>⬆ Импорт (дополнить)</button>
          <button className="btn btn--danger" onClick={() => importData('replace')}>⬆ Импорт (заменить)</button>
        </div>
        <p className="muted small">Формат: spec 3 — банки → карты/категории, точки. Экспорт совместим сам с собой.</p>
      </div>
    </main>
  );
}

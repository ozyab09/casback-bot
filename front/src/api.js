// api.js — вызовы эндпоинтов через официальный Serverless мост.
// Он сам прикладывает верифицируемое initData — никакого ручного fetch.
export function call(name, input = {}) {
  return new Promise((resolve, reject) => {
    const twa = window.Telegram?.WebApp;
    if (!twa?.Serverless) {
      reject(new Error('Открой приложение внутри Telegram'));
      return;
    }
    twa.Serverless.call(name, input, (err, result) => {
      if (err) {
        const e = new Error(err.message || 'Ошибка вызова');
        e.type = err.type;
        e.code = err.parameters?.code;
        reject(e);
      } else {
        resolve(result);
      }
    });
  });
}

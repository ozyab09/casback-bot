// handlers/message.js — /start и /help: точка входа в Mini App.
// Полная функциональность — в Mini App: это только приглашение.

import { api } from 'sdk';

// Хост Мини Ап, который платформа поднимает из статики (tgcloud.jsonc → static).
const APP_URL = 'https://app8856406647.tgcloud.ai/';

const HELP_TEXT = [
  '💳 *Мой Кэшбэк* — подсказывает, какой картой платить.',
  '',
  'Ведите банки, карты и категории кэшбэка (с MCC-кодами) —',
  'а приложение по MCC или названию точки покажет, где кэшбэк выше.',
  '',
  'Открыть приложение → /start или кнопка в меню.',
].join('\n');

export default async function (message, ctx) {
  const text = message.text ?? '';
  const chatId = message.chat.id;

  if (/^\/(start|help)\b/.test(text)) {
    const help = /^\/help\b/.test(text);
    const started = /^\/start\b/.test(text);

    if (started) {
      await api.sendMessage({
        chat_id: chatId,
        text: '💳 *Мой Кэшбэк*\n\nОткрывайте приложение: карты, категории и расчёт «чем платить» — внутри.',
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '💳 Открыть приложение', web_app: { url: APP_URL } },
          ]],
        },
      });
    } else {
      await api.sendMessage({
        chat_id: chatId,
        text: HELP_TEXT,
        parse_mode: 'Markdown',
      });
    }
    return;
  }

  // Всё остальное мягко уводим в Мини-апп — без диалоговых сценариев.
  await api.sendMessage({
    chat_id: chatId,
    text: 'Всё управление — в приложении. Откройте его кнопкой в меню или /start.',
  });
}

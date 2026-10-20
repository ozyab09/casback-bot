# 💳 Мой Кэшбэк — Telegram Mini App

Бот-помощник «какой картой платить»: пользователь ведёт свои банки, карты
и категории кэшбэка (с MCC-кодами), а приложение по MCC или названию
торговой точки показывает, где кэшбэк выше и сколько вернётся с суммы.

## Состав

| Путь | Что это |
|---|---|
| `tgcloud/schema.js` | БД: users, banks, cards, categories, places, mcc_ref (seed-справочник) |
| `tgcloud/lib/` | Репозиторий БД, матчинг «чем платить», импорт/экспорт (spec 3), валидация |
| `tgcloud/endpoints/` | 12 POST-эндпоинтов Mini App: CRUD банков/карт/категорий/точек, `search`, `exportData`, `importData`, `getOverview` |
| `tgcloud/handlers/message.js` | `/start` (кнопка открытия Mini App), `/help` |
| `front/` | React + Vite SPA (тёмная тема Telegram, нижняя навигация) |
| `docs/spec-moy-cashback.md` | Полное ТЗ v1.0 |

Логика подбора: применимые категории → категория «Все покупки» (fallback,
учёт MCC-исключений) → 0%; месячные лимиты карт показываются в выдаче.

## Запуск и деплой

```bash
npm install && (cd front && npm install)

npx tgcloud login            # токен из @BotFather → Serverless → CLI Access
npx tgcloud push             # деплой модулей + статики
npx tgcloud migrate          # применить схему БД (после изменения schema.js)
npm run deploy               # сборка фронта + push (обычный путь)

# тест эндпоинта без Mini App:
npx tgcloud run endpoints/search '{"query":"5411","amount":1000}' \
  --ctx '{ initData: { user: { id: 1 } } }'
```

## CI

GitHub Actions собирает фронт (Vite) и проверяет модули на синтаксис на
каждый push/PR — см. `.github/workflows/ci.yml`.

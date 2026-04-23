# 📚 Telegram Novel Reader — Mini App

A private Telegram Mini App for reading novels, with invite-link access control, e-reader with swipe, and admin panel.

---

## Project Structure

```
tg-novel-app/
├── backend/
│   ├── main.py            ← FastAPI server
│   ├── bot.py             ← Telegram bot (invite links + whitelist)
│   ├── models.py          ← SQLAlchemy DB models
│   ├── database.py        ← DB setup
│   ├── routes/
│   │   ├── novels.py      ← Novel/Chapter CRUD
│   │   └── auth.py        ← Telegram initData verification
│   ├── .env.example       ← Copy to .env and fill in
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── App.jsx            ← Root app + auth gate + routing
    │   ├── api.js             ← All API calls
    │   ├── index.css          ← Global dark literary theme
    │   ├── hooks/useAuth.jsx  ← Auth context + Telegram SDK
    │   └── pages/
    │       ├── Catalogue.jsx  ← Novel grid
    │       ├── Reader.jsx     ← E-reader (swipe + tap to turn pages)
    │       └── Admin.jsx      ← Admin panel (add/edit/delete novels & chapters)
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Setup

### 1. Create a Telegram Bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram
2. `/newbot` → follow prompts → copy the **token**
3. `/newapp` on your bot → set the Mini App URL (your deployed frontend)

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in BOT_TOKEN, ADMIN_TELEGRAM_ID, MINI_APP_URL, ADMIN_SECRET

pip install -r requirements.txt

# Run the API server
uvicorn main:app --reload --port 8000

# Run the bot (in a separate terminal)
python bot.py
```

### 3. Frontend

```bash
cd frontend

# Create .env
echo "VITE_API_URL=http://localhost:8000" > .env

npm install
npm run dev
```

For production: `npm run build` → deploy `dist/` to any static host (Vercel, Cloudflare Pages, nginx).

---

## How Private Access Works

1. **You** send a bot command to generate an invite link:
   ```
   /genlink for-my-friend-anna
   ```
   Bot replies with: `https://t.me/YourBot?start=abc123xyz`

2. You send that link to your reader.

3. They click it → bot whitelists their Telegram ID → they can open the Mini App.

4. The Mini App sends their Telegram identity to your backend on every open. Backend verifies they're whitelisted.

### Bot Commands (send in private chat with your bot)

| Command | What it does |
|---|---|
| `/genlink [label]` | Generate a multi-use invite link |
| `/genlink_once [label]` | Generate a single-use invite link |
| `/links` | List all active invite tokens |
| `/revoke <token>` | Deactivate an invite link |
| `/users` | List whitelisted users |
| `/removeuser <telegram_id>` | Remove a user's access |

---

## Admin Panel

Access at `/admin` in your Mini App. You'll need the `ADMIN_SECRET` from your `.env`.

From there you can:
- Add a new novel (with cover image upload)
- Edit title, author, description, cover
- Add / edit / delete chapters
- Toggle publish status

---

## E-Reader Controls

| Action | Effect |
|---|---|
| Tap right 35% | Next page |
| Tap left 35% | Previous page |
| Tap center | Show/hide menu (chapter list, progress) |
| Swipe left | Next page |
| Swipe right | Previous page |

---

## Production Deployment Tips

- Use **PostgreSQL** instead of SQLite: set `DATABASE_URL=postgresql+asyncpg://user:pass@host/db`
- Host the backend on **Railway**, **Render**, or a VPS
- Host the frontend on **Vercel** or **Cloudflare Pages** (free)
- Set Telegram bot webhook instead of polling: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_BACKEND>/webhook`
- Tighten CORS in `main.py` to only allow your frontend domain

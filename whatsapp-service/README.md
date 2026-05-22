# WhatsApp Service

Express.js backend for WhatsApp Web.js integration with real-time WebSocket support.

## Structure

```
whatsapp-service/
├── src/
│   ├── server.js          # Express + Socket.IO server entry point
│   ├── services/
│   │   ├── whatsapp.js    # WhatsApp Web.js client wrapper & session management
│   │   └── d1.js          # Cloudflare Worker API client
│   └── routes/
│       └── api.js         # API routes & request handlers
├── start.js               # Auto-install guard & process launcher
├── package.json
├── .env.example
└── data/                  # Local JSON storage (notes, tickets, follow-ups)
```

## Quick Start

```bash
npm install
npm run dev
```

First run will download Puppeteer/Chromium (~130 MB). Subsequent starts are instant.

## Environment Variables

```env
PORT=3002
WA_WORKER_URL=http://localhost:8787
WA_SHARED_SECRET=dev-local-secret
WA_SESSION_ID=optional-session-id
SLA_THRESHOLD_SECONDS=900
INITIAL_MESSAGE_SYNC_CHATS=20
INITIAL_MESSAGE_SYNC_LIMIT=20
```

## API Endpoints

### Session Management
- `GET /api/status` — Current session state
- `POST /api/session/reconnect` — Reconnect WhatsApp client
- `POST /api/session/disconnect` — Disconnect WhatsApp client

### Chat & Message Operations
- `GET /api/chats` — List all chats
- `GET /api/chats/:chatId/messages` — Get chat messages
- `POST /api/chats/:chatId/messages` — Send message
- `GET /api/chats/:chatId/followup` — Get follow-up date
- `PATCH /api/chats/:chatId/followup` — Set follow-up date
- `PATCH /api/chats/:chatId/ticket` — Update ticket status

### Contacts
- `GET /api/contacts` — List contacts
- `PATCH /api/contacts/:phone` — Update contact info

### Local Features
- `GET /api/notes/:chatId` — Get internal notes
- `POST /api/notes/:chatId` — Add internal note

## Data Flow

1. **Real-time**: WhatsApp events → WebSocket broadcast
2. **Worker Layer**: All persistent data (messages, chats, contacts) flows through Cloudflare Worker at `WA_WORKER_URL`
3. **Local Storage**: Notes, tickets, follow-ups stored in `./data/*.json` (Worker doesn't have these endpoints)

## WebSocket Events

- `status` — Connection status changes
- `qr` — QR code for authentication
- `new_message` — Incoming or outgoing message
- `chat_update` — Chat metadata changes
- `message_ack` — Message delivery status
- `group_update` — Group events (member changes, subject, etc.)
- `sync_complete` — Initial data sync finished

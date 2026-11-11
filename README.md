# Green Task Rewards — WhatsApp Pairing App

A WhatsApp device-linking reward app built with **TanStack Start** (React SSR), **Supabase** Edge Functions, and the **ET7 WhatsApp Gateway**.

## Stack

| Layer | Tech |
|---|---|
| Frontend | TanStack Start + React 19 + Tailwind CSS v4 |
| Backend / Edge | Supabase Edge Functions (Deno) |
| WhatsApp API | ET7 Gateway (`et7india.fun`) |
| Database | Supabase Postgres |
| Deploy | Vercel |

---

## Supabase Project

- **Project Name:** `green-task-rewards`
- **Project ID:** `zvjidccwxqbougtqharj`
- **Region:** `ap-south-1` (Mumbai)
- **URL:** `https://zvjidccwxqbougtqharj.supabase.co`

## Edge Functions

### `whatsapp-pair`
**URL:** `https://zvjidccwxqbougtqharj.supabase.co/functions/v1/whatsapp-pair`

No JWT required (`verify_jwt: false`). Handles all ET7 WhatsApp pairing actions:

| Action | Description |
|---|---|
| `pair` | Request a new pairing code from ET7 Gateway |
| `check` | Poll WhatsApp connection status |
| `confirm` | User confirms they entered the code |
| `disconnect` | Disconnect the WhatsApp session |

**Example request:**
```bash
curl -X POST https://zvjidccwxqbougtqharj.supabase.co/functions/v1/whatsapp-pair \
  -H "Content-Type: application/json" \
  -d '{"action":"pair","phoneNumber":"9876543210","countryCode":"+91"}'
```

---

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

## Vercel Deploy

1. Import this repo in [vercel.com](https://vercel.com)
2. Set these **Environment Variables** in Vercel dashboard:
   - `VITE_SUPABASE_URL` = `https://zvjidccwxqbougtqharj.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = *(see `.env.example`)*
3. Build command: `npm run build`
4. Output dir: `.output/public` *(auto-detected via `vercel.json`)*

> **Note:** The app uses TanStack Start (SSR). For best Vercel compatibility, the `NITRO_PRESET=vercel` env var is auto-applied during build.

---

## ET7 API Integration

- **Base URL:** `https://et7india.fun`
- **Slug:** `1539of9`
- **Pairing flow:** Browser → Supabase Edge Function → ET7 → WhatsApp

See [`ET7_API_INTEGRATION_GUIDE.txt`](./ET7_API_INTEGRATION_GUIDE.txt) for full docs.

## Database Schema

Table: `public.whatsapp_connections`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `user_phone` | TEXT | Unique phone (user identifier) |
| `phone_number` | TEXT | 10-digit number |
| `country_code` | TEXT | e.g. `+91` |
| `slug` | TEXT | ET7 merchant slug |
| `pairing_code` | TEXT | Formatted `XXXX-XXXX` code |
| `status` | TEXT | `pending` / `connected` / `disconnected` |
| `rate_per_hour` | NUMERIC | ₹2.00/hr default |
| `total_earned` | NUMERIC | Running total |
| `connected_at` | TIMESTAMPTZ | When device linked |
| `last_heartbeat` | TIMESTAMPTZ | Last status check |
| `raw_response` | JSONB | Raw ET7 response |

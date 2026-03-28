# Trustgate Frontend

This Next.js app is the human-facing UI for Trustgate. It reads rankings from the backend API and renders API detail pages with aggregate review stats and recent reviews.

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS

## Local Run

1. Install frontend dependencies:

   ```bash
   cd trustgate_design_refresh
   npm install
   ```

2. Start the backend from the repository root in a separate terminal:

   ```bash
   npm run dev
   ```

   The backend listens on `http://127.0.0.1:3000` by default.

3. Create `trustgate_design_refresh/.env.local` and point the frontend at the backend:

   ```bash
   TRUSTGATE_BACKEND_BASE_URL=http://127.0.0.1:3000
   ```

   `TRUSTGATE_BACKEND_BASE_URL` is used by server-side data fetching and the published `skill.md` route.

4. Start the frontend on a different port so it does not conflict with the backend:

   ```bash
   npm run dev -- --port 3001
   ```

5. Open `http://127.0.0.1:3001`.

## Build

```bash
npm run build
```

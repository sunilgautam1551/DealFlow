# DealFlow

A sales pipeline screen for a team of 20 sharing about 50,000 deals. It handles bulk moves, a slow and unreliable network, teammates editing at the same time, and keyboard-only use. There is no real backend: a fake server inside the app simulates latency, failed saves and teammates' changes.

The write-up (decisions, trade-offs, limitations) is in [WRITEUP.md](WRITEUP.md).

## Running it

You need Node.js 18 or newer.

```bash
npm start
```

This installs dependencies and opens the app at http://localhost:5173.

Other scripts:

```bash
npm run dev        # start without reinstalling
npm run build      # type-check and production build
npm run typecheck  # type-check only
```

## Things to try

1. **Today tab:** your own open deals ranked by priority, with the reasons shown on each row.
2. **Bulk move:** open "Proposal Sent", set "No contact for" to 90+ days, click "Select all", then "Move to…" → Lost. A progress bar shows the save.
3. **Bad network:** click **Simulator** → "Offline", then move a deal. After three tries it's marked "Not saved" with Retry / Discard. Switch back to "As in the brief" and retry.
4. **Conflicts:** in the simulator, raise "Edit the deal you're saving" and move some deals. You'll get "Rahul moved it to Lost" with Keep mine / Keep theirs.
5. **Teammates:** choose "Busy team" and regenerate with 1,000 deals, so changes land on the rows you can see. Rows update in place, moved deals stay dimmed, and the banner offers "Show latest".
6. **Keyboard only:** Tab to the list, then use ↑/↓, Space, Shift+↑/↓, Enter (move to…) and Esc. ←/→ switch tabs.

## How the code is organised

```
src/
  api/          Fake backend: API contract, simulated server, seed data, teammate behaviour
  domain/       Plain business rules: stages, users, priority scoring, formatting
  app/          Redux store setup, typed hooks, shared commands
  features/     One folder per feature (Redux slice + selectors + thunks)
    deals/        Deals as the server last reported them
    sync/         Unsaved changes, batching, retries, conflicts
    view/         Tabs, filters, sorting, the rows on screen, keyboard focus
    selection/    Ticked deals
    realtime/     Teammates' changes from the server
    notifications/, simulator/, ui/
  components/   React components, each with its own CSS module
```

Built with React 18, TypeScript, Redux Toolkit, @tanstack/react-virtual and Vite.

A few places worth reading first:

- `src/features/sync/syncSlice.ts`: how saving, retries and conflicts work, explained at the top of the file.
- `src/features/view/viewSlice.ts`: why the list on screen is a snapshot.
- `src/api/fakeServer.ts`: what the fake backend simulates.

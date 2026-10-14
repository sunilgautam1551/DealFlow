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

## How it covers the brief

| The brief asks for | Where to see it |
|---|---|
| Know which deals to work on | **Today** tab: your open deals ranked by priority, with the reasons on each row |
| Smooth with 50,000 deals | Virtualized list, about 35 rows rendered at a time; scrolling stays at 60 fps |
| Move one deal or many | Action bar works on the ticked deals or the focused row; Shift+click, "Select all", progress bar for big moves |
| Slow, unreliable network | Moves show at once, retry automatically (1s, 3s), then show "Not saved" with Retry / Discard; header always shows save state |
| Teammates' changes without disturbing you | Rows update in place, moved deals stay dimmed, new or moved deals wait in a "Show latest" banner; conflicts offer Keep mine / Keep theirs |
| Keyboard | List, tabs and the "Move to…" picker all work without a mouse |
| Adjustable fake API | **Simulator** panel: save speed, failure rate, teammate activity, conflict chance, dataset size |

## How the code is organised

```
src/
├── features/                  one folder per feature, one folder per component (Name.tsx + Name.css)
│   ├── deal-table/
│   │   ├── DealTable/         the virtualized list and its keyboard handling
│   │   ├── DealRow/           one deal row
│   │   ├── RowSaveStatus/     Saving… / Not saved (Retry, Discard) / conflict (Keep mine, Keep theirs)
│   │   └── UpdatesBanner/     "Teammates made changes · Show latest"
│   ├── filters/
│   │   ├── PipelineFilters/   ViewTabs + FilterBar
│   │   ├── ViewTabs/          stage tabs with counts and values
│   │   └── FilterBar/         search, owner, "no contact for", sort
│   ├── bulk-actions/
│   │   ├── BulkActionBar/     actions for the ticked deals
│   │   ├── BulkProgress/      progress bars for big moves
│   │   └── MoveDialog/        keyboard "Move to…" picker
│   ├── save-status/
│   │   ├── SaveStatus/        header save indicator
│   │   └── Toasts/            background messages
│   └── simulator/
│       └── SimulationPanel/   controls for the fake backend
├── store/
│   ├── index.ts               store setup and typed hooks
│   ├── dealsSlice.ts          deals as the server last reported them, realtime feed
│   ├── syncSlice.ts           unsaved moves: batching, retries, conflicts
│   ├── viewSlice.ts           tabs, filters, sorting, rows on screen, focus, selection
│   └── uiSlice.ts             dialog, toasts, simulator settings
├── services/fakeApi.ts        the fake backend (latency, failures, conflicts, teammates)
├── hooks/useVirtualDeals.ts   virtualization for the deal list
├── utils/
│   ├── generateDeals.ts       seeded fake data
│   └── dealUtils.ts           stages, priority scoring, formatting
├── types/deal.ts              Deal, stages, users
├── App.tsx
├── main.tsx
└── index.css                  design tokens, base styles, page layout
```

Built with React 18, TypeScript, Redux Toolkit, @tanstack/react-virtual and Vite.

Good places to start reading:

- `src/store/syncSlice.ts`: how saving, retries and conflicts work, explained at the top of the file.
- `src/store/viewSlice.ts`: why the list on screen is a snapshot.
- `src/services/fakeApi.ts`: what the fake backend simulates.

# DealFlow: write-up

## What I built and why

DealFlow is one screen for a 20-person sales team sharing a pipeline of about 50,000 deals. It's a table with a tab per stage. Each tab shows its deal count and total value, so the tab row doubles as the pipeline overview.

I started from the complaints in the brief rather than from a layout. "I don't know which deals to work on today" became the **Today** tab, which is where the app opens. It lists your open deals, ranked by a simple points score built from four things:
- the close date (overdue, or due within a week),
- how long since anyone was in touch,
- deal size,
- how far along the stage is.

Each row shows why it ranks high ("Overdue 6d · No contact 82d · High value"), so the order can be checked rather than taken on faith. The weights are my own guesses.

The list is virtualized, so only the ~35 visible rows are in the DOM. Deals are stored in Redux by id, and each row subscribes to its own deal, so one change re-renders one row. All 50,000 deals load in about 1.5s, scrolling holds 60fps, and a full filter and sort takes about 40ms.

While testing I found that every realtime update froze the page for about 75ms. Profiling showed two causes:
- **Deal ids.** Ids like `d-000123` pushed V8 into slow dictionary storage for the 50,000-entry object, so every copy was expensive. Integer-like ids fixed that.
- **Immer auto-freeze.** Immer was deep-freezing that object on every update. I turned it off.

Together these brought an update down to about 15ms.

The backend is a fake in `fakeApi.ts`. It adds 0.3–1.5s of latency and fails about 1 in 10 saves. Half of those failures happen *after* the write is applied, so the client never gets the reply. Teammates keep editing deals in the background, and a Simulator panel adjusts all of it live.

## Key UX decisions, and what I rejected

**A table, not a Kanban board.** A board is the obvious picture of a pipeline, but it doesn't hold up at this size. A 10,000-card column can't be scanned, dragging is hard without a mouse, and nobody can drag 2,000 deals to Lost. A table fits more on screen, sorts and multi-selects naturally, and the stage tabs keep the overview.

**One control for one deal or thousands.** Actions apply to the ticked rows, or to the focused row if nothing is ticked. The quarter-end clean-up is: Proposal Sent → "No contact for 90+ days" → Select all → Move to Lost. Switching tabs clears the selection, so rows ticked in one view can't be moved by accident from another.

**The list holds still.** The rows on screen are a snapshot, taken when you open a tab or change a filter. When a teammate edits a visible deal, that row updates in place and flashes. If they move it away, it stays where it is, dimmed, with "Moved to Won by Rahul". Rows that should appear or disappear are only counted in a "Show latest" banner. I rejected a fully live list: it's always correct, but rows shifting just as you click one is exactly the "deals keep jumping around" complaint.

**Moves show instantly.** At up to 1.5s per save, waiting for the server would feel broken. A move shows at once (the stage pill is dashed until it's confirmed), and the header always shows the overall state: "All changes saved", "Saving 12 changes…" or a red "3 changes not saved · Review".

**Problems don't interrupt.** Failures and conflicts get a short toast, a note on the row, and a Needs attention tab that lists all of them, whatever filters are set. I rejected error popups, because one bulk move could open dozens.

**Keyboard, kept minimal.** The list is one Tab stop:
- ↑/↓ move between rows, and Home/End jump to the first or last.
- Space ticks a row, and Shift+↑/↓ ticks a range.
- Enter opens a "Move to…" picker that starts on the next stage.

I skipped Gmail-style letter shortcuts; they're more to learn and maintain than this needed.

## Failed saves and teammates' changes

Unsaved moves live in their own `sync` slice. The `deals` slice only holds what the server has confirmed, and the UI shows the pending stage on top of it. There's no manual rollback: a discarded change just disappears and the server value shows through.

**Sending.** Moves go out in batches of 500, with at most three requests in flight. A move is marked `saving` before it's sent, so it can't be sent twice. If the user moves a deal again mid-save, only the target is updated, and the new target is sent when the first response arrives.

**Failures.** A failed request is retried after 1s and again after 3s. At a 10% failure rate, three failures in a row is about 1 in 1,000. If it does happen, the deal stays where the user put it, marked "Not saved" with Retry and Discard. Nothing reverts silently, and closing the tab with unsaved changes asks first.

**Lost replies and conflicts.** Each move sends the stage the client believes the deal is in (`expectedStage`). The server only applies the move if the stage still matches, and treats "already in the target stage" as success. That one rule does two jobs:
- **Retries are safe.** Repeating a save whose reply was lost just succeeds again.
- **Teammates' moves are caught.** If someone moved the deal first, the server returns `conflict` with its current version. The row says "Rahul moved it to Negotiation" and offers Keep mine or Keep theirs.

Only the stage is compared, so a teammate editing the value doesn't block your move. I rejected last-write-wins, where one person's change silently disappears.

**Realtime.** Pushes are collected for 300ms and applied in one Redux update. Every deal carries a version number, and anything older than what the client already has is dropped, so a late push can't overwrite a newer save response. The feed connects before the initial load, so nothing changed during the load is missed.

As a check, I moved 2,000 deals at the default settings with teammates active: 1,975 saved, 25 came back as conflicts, and none were lost or stuck.

## What I'd do with more time

- Persist unsaved changes in IndexedDB. Today they're in memory, so a reload loses them (the app warns first).
- Add undo, mainly for bulk moves.
- Do bulk moves, filtering and paging on the server. One "move everything matching this filter" request is better than sending thousands of ids, and the browser shouldn't need to hold all 50,000 deals.
- Move filtering and sorting into a Web Worker. Searching all 50,000 deals still blocks the main thread for about 50ms.
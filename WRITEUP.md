# DealFlow: write-up

## What I built and why

DealFlow is a single screen for a sales team that shares one pipeline of about 50,000 deals. A **Simulator** panel lets you change save speed, failure rate and teammate activity while you test.

I went with a **table, not a Trello-style board**. A board looks right for a pipeline, but a column with 10,000 cards can't be scanned, dragging is hard without a mouse, and nobody can drag thousands of deals. A table shows 15–20 deals at once with the details that matter, and makes sorting, ticking many rows and keyboard use easy. To keep the overview a board gives, each stage is a **tab showing its deal count and total value**.

The first tab, **Today**, answers "which deals should I work on today?". It lists your open deals ranked by simple rules: overdue or closing within a week, no contact for two weeks or more, large value, and later stage. Each row shows why it's near the top ("Overdue 3d", "No contact 40d", "High value"). The weights are my guesses; a real team would tune them.

## Key UX decisions

**One way to move one deal or 10,000.** Actions apply to the ticked deals, or to the highlighted row if nothing is ticked. Moving a single deal and moving a whole stage work the same way. Rows can be ticked one by one, as a range with Shift+click, or all at once. Switching tabs clears the selection, so deals ticked in one view can't be moved by accident from another. For the quarter-end case you filter (e.g. Proposal Sent, no contact for 90+ days), click "Select all", and pick "Lost".

**The list doesn't move under you.** This was the most important decision. The rows on screen are a snapshot, taken when you open a tab or change a filter. When a teammate edits a deal you can see, the row updates in place and flashes briefly. If they move it to another stage, it stays where it is, dimmed, with "Moved to Won by Rahul". New deals and moved deals are counted in a banner ("3 deals now belong here, 13 moved out · Show latest"), and the list only changes when you click it. Tab counts always stay live.

- *Rejected:* a fully live list. It's always "correct", but rows jumping while you're about to click one is exactly the complaint in the brief.

**Saving is optimistic but honest.** A move shows up immediately, so the app doesn't feel slow on a 1.5 second network. The header always says where things stand: "All changes saved", "Saving 12 changes…", or a red "3 changes not saved · Review".

- *Rejected:* waiting for the server before showing the move. That feels broken at this latency.
- *Rejected:* silently undoing the move when a save fails. That is the "it didn't save and nobody told me" problem.

**Problems wait for you instead of interrupting you.** Failed saves and conflicts get a short toast, a note on the row, and a "Needs attention" tab that lists every one of them, whatever filters are set. Nothing blocks the screen. When a view is empty, for example after moving every matching deal to Lost, it says why and offers "Clear filters".

- *Rejected:* error popups. With bulk moves you could get dozens of them.

**Keyboard.** The list is one Tab stop. Inside it, ↑/↓ move between rows, Space ticks a row, Shift+↑/↓ ticks a range, and Enter opens a small "Move to…" picker that starts on the next stage. ←/→ switch tabs, and everything else is a normal button or dropdown. I kept it to what's needed to work without a mouse; Gmail-style letter shortcuts would have meant more to learn and more to build.

## How failed saves and teammates' changes are handled

**Failed saves.** Unsaved moves are kept apart from what the server has confirmed, and the screen shows them on top, so there's nothing to roll back by hand. Moves go out in batches of 500, at most three requests at a time. A failed request is retried after 1 second and again after 3; with 1 in 10 failing, users almost never see it. If all three tries fail, the deal stays where the user put it, marked "Not saved", with **Retry** and **Discard**. Closing the tab with unsaved changes asks first.

One tricky case is a save that reaches the server but whose reply is lost, so the app can't tell if it worked. The fake server simulates this. A repeated move counts as success, so retrying is always safe.

**Teammates editing the same deal.** Every move carries the stage the app thinks the deal is in. If a teammate moved it first, the server rejects the move as a conflict. The row then says what happened ("Rahul moved it to Lost") and offers **Keep mine** or **Keep theirs**. Only stage changes count, so a teammate editing the deal's value doesn't block your move.

- *Rejected:* "last write wins". It hides the problem and someone's work is lost without anyone knowing.

**Realtime updates.** Teammates' changes are collected for 300ms and applied together, so a busy team doesn't cause constant re-rendering. Every deal has a version number, and anything older than what the app already has is ignored, so out-of-order updates can't undo newer data.

## Performance with 50,000 deals

Only the rows on screen are rendered (about 35 at a time), and each row re-renders only when its own deal changes. Measured in Chrome on my laptop: the first screen appears about 1.5 seconds after opening, scrolling through 50,000 deals stays at 60 frames per second, filtering and sorting all of them takes about 40ms, and ticking all 50,000 takes about 40ms.

Early on, every realtime update froze the page for about 75ms. Two things caused it: deal ids like `d-000123` made copying the big lookup object slow, and Immer (used by Redux Toolkit) was freezing that object after every update. Plain numeric ids and turning the freezing off brought an update down to about 15ms.

## Limitations

- There are no automated tests. I checked behaviour with throwaway scripts: driving the fake server directly (2,000 moves at the default settings with teammates active: 1,975 saved, 25 flagged as conflicts, none lost or stuck) and clicking through the app in a headless browser.
- Unsaved changes live in memory, so a reload loses them. The app warns first.
- You can only move deals between stages; editing other fields is out of scope. Search only matches company names.
- At the default network speed, a 10,000-deal bulk move takes several seconds to save (1,265 deals took 1.4 seconds). A progress bar shows it.
- Searching across all 50,000 deals, and each batch of a big bulk save, briefly blocks the page for about 50ms. You can't really feel it, but it's there.

## What I'd do with more time

- Keep unsaved changes in IndexedDB, so a reload or crash doesn't lose them.
- Add undo, especially for bulk moves.
- Let the server "move everything matching this filter" in one request instead of receiving 10,000 ids, and page and filter on the server instead of loading every deal.
- Move filtering and sorting off the main thread (a Web Worker) to remove the ~50ms pauses.
- Add tests around the save and retry logic, where bugs would hurt most.
- Show who else is looking at a deal, to head off some conflicts.
- Let people tune how "Today" ranks deals, and test with keyboard and screen reader users.

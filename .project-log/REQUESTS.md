# Requests

Add new requests under `## New` as `- [ ] what you want`. Claude reads this before every section
and asks which to do now, later, or skip.

## New

## Accepted

- [ ] 2026-11-11 On phones, names are cut off or overlapped in several places; check everywhere and fix (medium)
- [x] 2026-11-11 Fresh data: tabs open instantly then refresh in the background, and on returning to the app (user's choice) (small)
- [x] 2026-11-11 Edit chores saves all or nothing (one transaction) (small)
- [x] 2026-11-11 Order in / We'll cook per meal, not per day (medium)
- [x] 2026-11-11 Menu owner as a chore with one person who can hand it over (user's choice) (small)
- [x] 2026-11-11 Swap chore days within a rotation: request, the other person accepts (user's choice) (large)
- [x] 2026-11-11 Fix audit findings 1-3: styled 'not found' pages; monthly jobs whose person left the flat; explain why non-owners can't plan the menu (small)
- [x] 2026-11-11 Fix the scheduled jobs (6 am daily, Sunday prompt): missing Vault values (small)
- [x] 2026-11-11 Notify when someone marks a chore done. Decided by the user: the whole flat, every chore (everyone except the person who pressed it; Undo sends nothing) (small)
- [x] 2026-11-11 Proper notifications outside the app. Found: nobody had ever subscribed (0 devices) because the Settings check raced the service worker and showed 'works in the installed app' with no button. Decided: fix turning on (desktop and Android browsers too), a prompt on Today, 'Send a test notification', and new alerts: new split with your share, monthly job due in 2 days / overdue, job handed to you (medium)
- [x] 2026-11-11 Editing an away entry (Kishore's reason) looked like 'nothing happens' on Save. Cause: the save worked, but there was no confirmation and the day panel didn't show reasons. Fix: 'Saved…' notice after saving or removing, reason shown in the day panel (small)
- [x] 2026-11-11 Remove 'Default splits' from Settings; on the Calendar, show cook and maid leave in its own section, not mixed with the flatmates (small)
- [x] 2026-11-11 Scan a bill: bring back the camera option (it was hidden on screens 1024 px and wider since 7 Nov). Decided: 'Take a photo' on every screen; phones use the native camera, laptops/desktops/landscape tablets get an in-app camera (small)
- [x] 2026-11-10 Monthly / every-N-months chores (cook and maid salary, rent monthly; EB bill every 2 months), assigned to one person who can hand it over to someone they choose. Decided by Claude as asked: new 'Monthly' frequency with every N months, due day and first month; one owner; per-occurrence Hand over (just this time or from now on); no auto-skip when away, a hint instead (medium)
- [x] 2026-11-10 Weekly work schedule for the cook and maid (e.g. maid Tue and Thu only; cook off alternate Sundays and no dinner on Sundays), settable and editable; then deploy. Decided by Claude as asked: per weekday Every week / Alternate weeks / Off, plus meals for the cook; schedule drives No cook on Menu/Today/Calendar and pay by days worked (medium)
- [x] 2026-11-10 Separate Cook & maid page, not mixed with flatmates; every flatmate can view and edit. Decided: own page at /staff linked from Today and Settings (bottom bar stays 5 tabs); shows phone (tap to call) and this month's days worked and leave; any flatmate can edit (medium)
- [x] 2026-11-10 Polish the remaining forms: Scan a bill review step, single chore, away and member edit forms (small)
- [x] 2026-11-09 Easy editing for chores and a whole-week menu. Decided: one screen to plan the week's menu with Copy last week and a saved usual menu; one screen to edit all chores, and a clearer Edit. Current permission rules kept. Done now, before UI polish 2 (medium)
- [x] 2026-11-07 Upload a bill image or document for splitting. Decided: two buttons (take a photo / upload a photo or PDF); PDFs read by Gemini only. Then: don't store the photo or PDF at all, only read it (medium)
- [x] 2026-11-07 Improve the UI so it looks good and aesthetic. Decided: polish the current look (keep Manrope, cream, teal); tighter hierarchy, focal duty block, lighter list rows, consistent states and skeletons, nav and header polish. Done in sections (large)
- [x] 2026-11-06 Maid's pay by days worked: a Maid's pay category that works like the cook's (daily rate × days worked) (small)
- [x] 2026-11-06 Mary replaces Lakshmi as cook (small)
- [x] 2026-11-06 Seamless flow: full flow audit of every journey (new user, flatmate, admin) at phone size, then fix in sections (medium)
- [x] 2026-11-06 Admin and notification gaps: push the admin on a join request, hand admin rights to another flatmate, per-person "usually skips breakfast" (small)
- [x] 2026-11-06 Chores banner calls part-day absences "away" (small)
- [x] 2026-11-06 Barani back 20 Nov: change his away end to 19 Nov; tapping "Back …" on Today opens the edit page (small)
- [x] 2026-11-06 Own-data permissions: each flatmate edits only their own away days, splits and duties; the admin can edit anyone's (medium)
- [x] 2026-11-06 Pages load too slowly; make them near-instant (medium)
- [x] 2026-11-06 Stop asking to sign in every time; keep people signed in (small)
- [x] 2026-11-06 Members admin (large): admin can edit and remove cook/maid; add/remove flatmates. Decided: flat code instead of invite link, new person sends a join request, admin accepts or declines in Settings; removing marks the person as left and keeps their history (staff with no history can be deleted).
- [x] 2026-11-06 Fill the app with sample data: Madan, Karthik, Rishab, Kishore, Barani (away since 1 Sep), rest made up (medium)
- [x] 2026-11-05 Part-day away: Morning / Afternoon / Night for a single day (large). Decided: slots affect meals only (afternoon = lunch, night = dinner, morning = breakfast); chores and money treat the person as home; cook gets No cook for those meals and is paid. Add breakfast to the menu. Slots only when From = Until and not whole day.
- [x] 2026-11-05 Set up the project log and status page (small)
- [x] 2026-11-05 Check that all 13 SPEC §12 test cases pass (small)

## Deferred

- [x] 2026-11-06 Per-meal menu plan (Order in / We'll cook per meal) (medium). Picked up 2026-11-11, see Accepted.
## Declined

- [ ] 2026-11-10 Away flatmates pay only rent (WiFi split only among people at home). Removed 2026-11-10 at the user's request; WiFi stays split among all members.
- [ ] 2026-11-06 Who owes whom + settle up on the Money tab. Declined 2026-11-10: the user wants only each person's share per bill and per month; leaving flatmates settle outside the app.

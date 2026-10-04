# Changelog

## 1.1.0 (2026-10-04)

### Added

- **Nine coaches.** Live: Sales call, Customer service call, Job interview, Social cues, and Anxiety coach. Practice: Interview practice, Social cues practice, Anxiety practice, and Dating practice.
- **Build your own coach** in Settings, with a live preview of the gauge and next step as you type. Duplicate a built-in coach to start from one that works, and import or export coaches as files to share them.
- **Coaches are folders of config** in `public/modes/`. `npm run check-modes` checks every coach before you ship it.
- **Auto capture** (experimental). Records the call audio and your mic as separate streams, splits lines at natural pauses, and drops echo when your mic picks up the call through your speakers.
- **Practice by voice.** Your words appear as you speak, it sends when you stop talking, and it waits longer if you trail off mid-thought. **Hands-free** starts listening on every new line.
- **Care in the anxiety coaches.** If you say you don't feel safe, the next-step card shows "Take care of yourself first" and points you to someone you trust, or 988 (US) or a local crisis line.
- **Onboarding.** A four-step welcome in the desktop app (three steps on the website), a numbered quick start, and **Try a sample call**.
- **Ctrl K** command palette for coaches and actions.
- **Floating window.** One compact window over your call, with solid cards and a ⋯ menu. Windows 11 glass is opt-in with `CALL_COACH_GLASS=1`.
- **Windows installer and portable exe**, built with `npm run dist`. Neither needs Node.js.
- **Website hosting.** Deploy to Vercel in one click, or run it anywhere with Node or the included Dockerfile. Visitors use their own TypeSafe key or an access code, speech is transcribed in their browser, and requests are rate limited.

### Changed

- **New glass design** shared by the app, Settings, and the dashboard, in light and dark. The background glow takes the gauge's stage color.
- Follows your system's reduce motion, reduce transparency, and high contrast settings.
- **Faster transcription.** With the Tiny model, a line now takes about 0.8 s instead of 5.3 s.
- The coaching API moved from `server.mjs` into `lib/coach.mjs`, so the Node server and the Vercel functions run the same code.

### Fixed

- The dashboard showed NaN and duplicated typed lines.
- Transcripts had stray gaps before punctuation.
- Error messages appeared in the wrong place.
- A request body that isn't valid JSON got a 500 instead of a clear 400.

## 1.0.0

- First release: sales and customer service coaching, plus a practice mode.

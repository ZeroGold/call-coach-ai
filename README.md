# Call Coach

A live sales-call assistant. It listens to the conversation, sends it to TypeSafe Jev after every sentence, and shows the rep what to do next with a confidence score.

## What you need

- Node.js 18 or newer (no packages to install)
- A TypeSafe API key
- Chrome or Edge for voice input. Other browsers can use the typed input instead.

## Run it

macOS or Linux:

```sh
TYPESAFE_API_KEY=your_key node server.mjs
```

Windows (PowerShell):

```powershell
$env:TYPESAFE_API_KEY="your_key"; node server.mjs
```

Then open http://localhost:3000 and allow microphone access when the browser asks.

To try it without talking, press **Play sample call**. It feeds a scripted conversation through the real API, one line every few seconds.

## Using it on a call

1. Press **Start listening**.
2. Switch between **Customer speaking** and **I'm speaking** as the conversation goes back and forth, or press **S** on the keyboard.
3. Watch the gauge. It shows the buying score (0-100), the current buying stage, and a confidence label.
4. The card below shows the suggested next step and coaching tips.
5. Press **D** or the **Mark done** button to dismiss a suggestion for a few minutes.

## Project structure

```
server.mjs          Node server: proxies API calls, serves public/
schema.json         Questions sent to TypeSafe Jev
public/
  index.html        The single-page UI
  decide.js         Local decision logic (smoothing, stability, tie-breaking)
  playbook.js       Action definitions, tips, stage labels, rules
```

## How it works

```
Microphone -> browser speech-to-text -> transcript
  -> server.mjs (adds your API key) -> TypeSafe Jev
  -> next action (Choice) + buying stage (Score) + 7 signals (Noul) -> screen
```

The API key stays in `server.mjs` and never reaches the browser. Every question is asked in a single request, so each update costs one API call.

## Customizing

- **Questions:** edit `schema.json`. Restart the server after changes.
- **Actions and coaching tips:** edit `public/playbook.js`. Keys must match the options in `schema.json`.
- **Decision tuning:** edit the constants at the top of `public/decide.js` (minimum confidence, smoothing, hysteresis).
- **Model:** set `TYPESAFE_MODEL`. The default is `jev-latest`. For anything beyond a demo, pin a specific version so behavior doesn't shift under you.
- **Port:** set `PORT` (default 3000).

## Things to know

- **Speech recognition runs through the browser.** In Chrome, audio goes to Google's speech service for transcription. Check that this is acceptable before using it on real customer calls.
- **Conversation text goes to TypeSafe.** Don't use this on calls where card numbers, passwords, or similar details might be spoken.
- **The microphone hears everyone.** On a speakerphone or video call, both sides end up in one transcript, so the speaker toggle matters. For production, use a call-transcription service that separates speakers automatically.
- Only the last 40 turns of the conversation are sent, to keep each request small.

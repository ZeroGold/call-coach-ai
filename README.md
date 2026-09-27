# Call Coach 

A live sales-call assistant. It listens to the conversation, sends it to TypeSafe Jev after every sentence, and shows the rep what to do next with a confidence score. 

This is a work in progress and a demo of Jev capabilities. Feel free to fork it and modify it. Or just message me if you want to make any changes. I am also open to pull requests as well for making improvements. Shoot me a DM if you need anything

## Demo Screen
<img width="2552" height="1348" alt="Screenshot 2026-09-20 165639" src="https://github.com/user-attachments/assets/b1d3768f-ae61-45a7-a68b-644367ef24ab" />

## Pop-Up Windows from Call Coach.bat
<img width="300" height="450" alt="image" src="https://github.com/user-attachments/assets/c40f18ea-9617-4546-b1bb-f3d4d23fb62d" />


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

### Auto capture (experimental)

**Auto capture** coaches hands-free. It records the call audio and your microphone as two separate streams, so it knows who said what without the speaker toggle:

- Call audio (Zoom, Meet, Teams, a phone app) is the **customer**.
- Your microphone is **you**.

Both are transcribed on your computer by the local Whisper model; only the text goes to TypeSafe. In the overlay (`Call Coach.bat`), press **Auto** in the title bar. In the browser, press **Auto capture** and share the tab or screen the call is in, with **Share audio** checked.

- **Only use it when everyone on the call knows and agrees.** Recording laws differ by place, and many require consent from every party.
- **Headphones work best.** Through speakers, your mic also hears the customer. Auto capture recognizes those echo segments and drops them, and when you talk over the customer it keeps your words and trims the echo around them. On a real call it's a best effort, not a guarantee.
- **Pick the speech model for your machine** in the dashboard. On a 16-core desktop CPU, a 6-second line takes about 1 s with Tiny, 2 s with Base, and 5 s with Small; laptops will be slower. If the app says transcription is falling behind, choose a smaller model.
- Only the customer's lines trigger a new evaluation. Your lines are included with the next one, which keeps API calls down.

## Project structure

```
server.mjs          Node server: proxies API calls, serves public/
schema.json         Questions sent to TypeSafe Jev
public/
  index.html        The single-page UI
  capture.js        Call audio capture and transcription (Capture call, Auto capture)
  segmenter.worklet.js  Cuts audio into lines at natural pauses; detects mic echo
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
- **Speech model threads:** set `ASR_THREADS` (default: half your CPU threads, at most 4). More threads is often slower, because the model's two parts compete for cores.
- **Echo detection:** edit `ECHO` at the top of `public/capture.js`.

## Things to know

- **Speech recognition runs through the browser.** In Chrome, audio goes to Google's speech service for transcription. Check that this is acceptable before using it on real customer calls.
- **Conversation text goes to TypeSafe.** Don't use this on calls where card numbers, passwords, or similar details might be spoken.
- **The microphone hears everyone.** On a speakerphone or video call, both sides end up in one transcript, so the speaker toggle matters. Auto capture avoids this by keeping the call audio and your mic separate.
- Only the last 40 turns of the conversation are sent, to keep each request small.

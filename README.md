# Call Coach 

A live call coach. It listens to the conversation, sends it to TypeSafe Jev after every sentence, and shows you what to do next with a confidence score. It comes with modes for sales calls and customer-service calls, plus a practice mode for rehearsing conversations on your own.

This is a work in progress and a demo of Jev capabilities. Feel free to fork it and modify it. Or just message me if you want to make any changes. I am also open to pull requests as well for making improvements. Shoot me a DM if you need anything

## Demo Screen
<img width="2552" height="1348" alt="Screenshot 2026-09-20 165639" src="https://github.com/user-attachments/assets/b1d3768f-ae61-45a7-a68b-644367ef24ab" />

## Pop-Up Windows from Call Coach.bat
<img width="300" height="450" alt="image" src="https://github.com/user-attachments/assets/c40f18ea-9617-4546-b1bb-f3d4d23fb62d" />


## What you need


- Node.js 18 or newer. Run `npm install` once; it adds the local speech model and the desktop overlay.
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

Then open http://localhost:3000, pick a mode, and allow microphone access when the browser asks. On Windows you can also run `Call Coach.bat` for the floating overlay; pick the mode in its first card.

To try a live mode without talking, press **Play sample call**. It feeds a scripted conversation through the real API, one line every few seconds.

## Modes

| Mode | Kind | The gauge shows |
|---|---|---|
| Sales call | Live call | How close the customer is to buying |
| Customer service call | Live call | How the caller is feeling |
| Dating practice | Practice | How well your reply lands |

Use **Change mode** (or click the mode name in the overlay's title bar) to switch.

## Using it on a call

1. Press **Start listening**.
2. Switch between **Customer speaking** and **I'm speaking** as the conversation goes back and forth, or press **S** on the keyboard.
3. Watch the gauge. It shows the score (0-100), the current stage, and a confidence label.
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

## Practice mode

Practice modes need no call and no one else. Pick a scenario, and your date says a line. Type your reply, or press **Speak** and say it (transcribed on your computer), then press **Get feedback**. The gauge scores your reply and the card below names one thing to work on. Press **Try again** to redo a reply and see whether the score moves up, or **Next line** to continue the conversation.

In the overlay, picking a practice mode opens it in its own window, since it doesn't need to float over a call.

## Project structure

```
server.mjs          Node server: proxies API calls, serves public/
public/
  index.html        The single-page UI, including the mode picker
  dashboard.html    Transcript, signals and speech model (from the overlay)
  modes/<mode>/     One folder per mode (see "Adding a mode")
  capture.js        Call audio capture and transcription (Capture call, Auto capture, Speak)
  segmenter.worklet.js  Cuts audio into lines at natural pauses; detects mic echo
  decide.js         Local decision logic (smoothing, stability, tie-breaking)
tools/
  check-modes.mjs   Checks every mode's files agree with each other
```

## How it works

```
Microphone / call audio -> speech-to-text -> transcript
  -> server.mjs (adds your API key and the mode's questions) -> TypeSafe Jev
  -> next action (Choice) + stage (Score) + signals (Noul) -> decide.js + the mode's playbook -> screen
```

The API key stays in `server.mjs` and never reaches the browser. Every question is asked in a single request, so each update costs one API call.

## Adding a mode

Every mode runs on the same engine. A mode is a folder in `public/modes/` with three files:

- **`mode.json`**: the name and description shown in the picker, `kind` (`"live"` or `"rehearsal"`), what the two speakers are called in the transcript Jev reads, and which questions drive the screen (`questions.action` must be a choice question and `questions.stage` a score question with four levels).
- **`schema.json`**: the questions sent to Jev.
- **`playbook.js`**: what the screen shows: the four stage names, a title and tips for every action option, priorities and rules, screen text (`copy`), dashboard `signals`, and a `sample` call (live modes) or `scenarios` (practice modes).

Copy an existing mode folder as a starting point, then run `npm run check-modes` to catch mismatches, like an action with no tips or a tip that names a question the schema doesn't ask. Restart the server to pick up the new mode.

## Customizing

- **Questions:** edit `public/modes/<mode>/schema.json`. Restart the server after changes.
- **Actions and coaching tips:** edit `public/modes/<mode>/playbook.js`. Keys must match the options in `schema.json`.
- **Decision tuning:** edit the constants at the top of `public/decide.js` (minimum confidence, smoothing, hysteresis). A playbook can override them for its mode with `config`.
- **Model:** set `TYPESAFE_MODEL`. The default is `jev-latest`. For anything beyond a demo, pin a specific version so behavior doesn't shift under you.
- **Port:** set `PORT` (default 3000).
- **Speech model threads:** set `ASR_THREADS` (default: half your CPU threads, at most 4). More threads is often slower, because the model's two parts compete for cores.
- **Echo detection:** edit `ECHO` at the top of `public/capture.js`.

## Things to know

- **Speech recognition runs through the browser.** In Chrome, audio goes to Google's speech service for transcription. Check that this is acceptable before using it on real customer calls.
- **Conversation text goes to TypeSafe.** Don't use this on calls where card numbers, passwords, or similar details might be spoken.
- **The microphone hears everyone.** On a speakerphone or video call, both sides end up in one transcript, so the speaker toggle matters. Auto capture avoids this by keeping the call audio and your mic separate.
- Only the last 40 turns of the conversation are sent, to keep each request small.

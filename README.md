# Call Coach 

A live call coach. It listens to the conversation, sends it to TypeSafe Jev after every sentence, and shows you what to do next with a confidence score. It comes with modes for sales calls and customer-service calls, plus a practice mode for rehearsing conversations on your own.

This is a work in progress and a demo of Jev capabilities. Feel free to fork it and modify it. Or just message me if you want to make any changes. I am also open to pull requests as well for making improvements. Shoot me a DM if you need anything

## Demo Screen
<img width="2552" height="1348" alt="Screenshot 2026-09-20 165639" src="https://github.com/user-attachments/assets/b1d3768f-ae61-45a7-a68b-644367ef24ab" />

## Pop-Up Windows from Call Coach.bat
<img width="300" height="450" alt="image" src="https://github.com/user-attachments/assets/c40f18ea-9617-4546-b1bb-f3d4d23fb62d" />


## Get it

You need a TypeSafe API key. There are three ways to run Call Coach:

| | What you get | How |
|---|---|---|
| **Windows installer** | The floating overlay, installed with Start menu and desktop shortcuts | Run `CallCoach-Setup-<version>.exe` |
| **Portable exe** | The same app with no install; runs from anywhere, like a USB stick | Run `CallCoach-<version>-portable.exe` |
| **Website** | The full app in a browser, for you or your team | See [Host it on a website](#host-it-on-a-website) |

The first time the desktop app starts, it asks for your key and keeps it in your user folder (`%APPDATA%\call-coach`). Speech models download there the first time you use speech.

Because the exe isn't code-signed yet, Windows SmartScreen may say it's from an unknown publisher. Choose **More info**, then **Run anyway**.

### Build the installer

On Windows, with Node.js 18 or newer:

```sh
npm install
npm run dist
```

The installer and portable exe land in `dist/`. `npm run icon` redraws the app icon (`build/icon.png`).

## Run from source

Node.js 18 or newer. Run `npm install` once; it adds the local speech model and the desktop overlay. `Call Coach.bat` (or `npm run overlay`) starts the overlay. To use it in a browser instead:

macOS or Linux:

```sh
TYPESAFE_API_KEY=your_key node server.mjs
```

Windows (PowerShell):

```powershell
$env:TYPESAFE_API_KEY="your_key"; node server.mjs
```

Then open http://localhost:3000, pick a mode, and allow microphone access when the browser asks.

To try a live mode without talking, press **Play sample call**. It feeds a scripted conversation through the real API, one line every few seconds.

## Modes

| Mode | Kind | The gauge shows |
|---|---|---|
| Sales call | Live call | How close the customer is to buying |
| Customer service call | Live call | How the caller is feeling |
| Dating practice | Practice | How well your reply lands |
| Your own | Either | Whatever you set up in Settings |

Use **Change mode** (or click the mode name in the overlay's title bar) to switch.

## The overlay

The desktop app floats one small window over your call, with both cards in it. Drag it by its title bar; it remembers where you left it. The title bar holds what you need mid-call:

- The **mode name**: click it to switch modes.
- **Auto** and **●**: auto capture and call capture.
- **⋯**: clear the conversation, open the dashboard (transcript and signals), change mode, open Settings, or switch light and dark.

Everything sits on solid cards, so it stays readable over any window or wallpaper.

## Build your own coach

Open **Settings** (the header in the browser, or **⋯ → Settings and coaches** in the overlay) to create coaches for other conversations: job interviews, negotiations, a support desk, or practice for something you're nervous about. No code needed:

1. Choose **New live coach** or **New practice coach**, or **Duplicate** a built-in coach to start from one that works.
2. Say who's talking and what you're working toward.
3. Set up **the gauge**: what it measures and its four levels, lowest to highest.
4. List the **next steps** the coach can suggest (or, for practice, the things to work on), each with when to suggest it and a tip. Higher in the list wins ties.
5. Optionally add yes/no **signals** for the dashboard and, for practice, **scenarios**: the other person's lines, in order.

Save it, and it's on the start screen. **Export** saves a coach to a file you can share; **Import** loads one. Custom coaches are stored in the app on your computer (on a website, in your browser), and their questions are sent along with each request.

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
- **Pick the speech model for your machine** in Settings. On a 16-core desktop CPU, a 6-second line takes about 1 s with Tiny, 2 s with Base, and 5 s with Small; laptops will be slower. If the app says transcription is falling behind, choose a smaller model.
- Only the customer's lines trigger a new evaluation. Your lines are included with the next one, which keeps API calls down.

## Practice mode

Practice modes need no call and no one else. Pick a scenario, and your date says a line. Type your reply, or press **Speak** and say it (transcribed on your computer), then press **Get feedback**. The gauge scores your reply and the card below names one thing to work on. Press **Try again** to redo a reply and see whether the score moves up, or **Next line** to continue the conversation.

In the overlay, picking a practice mode opens it in its own window, since it doesn't need to float over a call.

## Host it on a website

The same server runs as a website. Visitors enter their own TypeSafe key in **Settings**; it stays in their browser and passes through your server to TypeSafe without being stored. Speech is transcribed in each visitor's browser, so their audio never leaves their computer and your server does no heavy lifting. The mic needs HTTPS, which most hosts provide.

With Docker (Render, Railway, Fly.io, a VPS, and so on):

```sh
docker build -t call-coach .
docker run -p 8080:8080 call-coach
```

Without Docker, on any host with Node.js 18 or newer:

```sh
npm ci --omit=dev --omit=optional
HOSTED=1 node server.mjs
```

The hosted server has no npm dependencies at all. Settings for the website, as environment variables:

| Variable | Effect |
|---|---|
| `HOSTED=1` | Website mode (set in the Docker image) |
| `ACCESS_CODE` + `TYPESAFE_API_KEY` | People who enter the access code in Settings use your key; others can still use their own |
| `OPEN_ACCESS=1` + `TYPESAFE_API_KEY` | Anyone can use your key. Only for private networks |
| `RATE_LIMIT_PER_MINUTE` | Coaching requests per visitor per minute (default 30) |
| `TRUST_PROXY=1` | Behind a load balancer, count visitors by `X-Forwarded-For` (set in the Docker image) |
| `TRANSCRIBE` | `browser` (default when hosted), `server` (needs the optional packages), or `off` |

A website can't call TypeSafe directly from the browser (TypeSafe doesn't allow it), so it needs this server; a static host like GitHub Pages won't work on its own.

## Project structure

```
server.mjs          Node server: proxies API calls, serves public/, desktop or hosted
electron.js         Desktop app: the overlay, Settings, practice and dashboard windows
public/
  index.html        The main UI: mode picker, live coaching, practice
  settings.html     Coaches (build, duplicate, import, export), speech model, website key
  dashboard.html    Transcript and signals (from the overlay)
  modes/<mode>/     One folder per built-in mode (see "Adding a mode")
  coaches.js        Custom coaches: storage, and turning the Settings form into a mode
  capture.js        Call audio capture (Capture call, Auto capture, Speak)
  segmenter.worklet.js  Cuts audio into lines at natural pauses; detects mic echo
  transcriber.js    Speech to text, on the server or in the browser (asr-worker.js)
  decide.js         Local decision logic (smoothing, stability, tie-breaking)
tools/
  check-modes.mjs   Checks every mode's files agree with each other
  make-icon.js      Draws the app icon
Dockerfile          The website image
```

## How it works

```
Microphone / call audio -> speech-to-text -> transcript
  -> server.mjs (adds your API key and the mode's questions) -> TypeSafe Jev
  -> next action (Choice) + stage (Score) + signals (Noul) -> decide.js + the mode's playbook -> screen
```

In the desktop app the API key stays in the server and never reaches the page. Every question is asked in a single request, so each update costs one API call.

## Adding a mode

Every mode runs on the same engine. The easiest way to add one is **Build your own coach** in Settings. To ship a mode with the app itself, add a folder in `public/modes/` with three files:

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

- **Where speech goes.** Capture call, Auto capture and Speak transcribe on your computer (on a website, in your browser). **Start listening** uses the browser's built-in speech recognition instead, which in Chrome sends audio to Google. Check that this is acceptable before using it on real customer calls.
- **Conversation text goes to TypeSafe.** Don't use this on calls where card numbers, passwords, or similar details might be spoken.
- **The microphone hears everyone.** On a speakerphone or video call, both sides end up in one transcript, so the speaker toggle matters. Auto capture avoids this by keeping the call audio and your mic separate.
- Only the last 40 turns of the conversation are sent, to keep each request small.

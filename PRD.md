# StemDeck — Product Requirements Document

**Status:** Draft
**Owner:** Toyosi
**Last updated:** August 2026

---

## 1. Summary

StemDeck is a local-only, mobile-first Progressive Web App (PWA) for mixing song stems on iOS. Users add a "song" by selecting a folder containing individual stem files (e.g. `everybody cries/drums.mp3`, `everybody cries/vocals.mp3`), then play all stems back in perfect sync while adjusting volume, mute state, and overall playback speed per song. All audio and song data stay on-device — nothing is uploaded to a server.

## 2. Problem

Musicians, producers, and casual listeners who receive or export stems (drums, bass, vocals, other) want a simple way to play with the mix — muting a part, riding a fader, slowing a section down to learn it — without installing a full DAW or relying on a cloud service that requires uploading potentially large, personal, or copyrighted audio files.

## 3. Goals

- Let a user go from "I have a folder of stems" to "I'm mixing them live" in under 10 seconds.
- Keep every byte of audio local to the device — no server, no upload, no account.
- Feel like a lightweight, installed app on iOS, not a website.
- Make songs persist across sessions so users build a personal library over time.

### Non-goals (v1)

- Real time-stretching (pitch-independent speed change) — out of scope for v1; speed changes pitch along with tempo.
- Multi-user sharing, cloud sync, or collaboration.
- Waveform editing, trimming, or audio effects beyond volume/mute.
- Android/desktop-specific optimization (iOS Safari is the primary target; should still function elsewhere as a baseline).

## 4. Target platform & stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React + Vite | Fast dev/build, small bundle, good PWA plugin support (`vite-plugin-pwa`) |
| Design approach | Mobile-first | Primary target is iOS Safari, viewport ~375–430px; layouts scale up gracefully, not down |
| Audio | Web Audio API | `AudioContext`, `AudioBufferSourceNode`, `GainNode` per stem for sync playback and mixing |
| Storage | IndexedDB | Stores song metadata + raw audio blobs, persisted across sessions |
| Install | Web App Manifest + Service Worker | Enables "Add to Home Screen" and full offline use after first load |
| Theming | CSS `prefers-color-scheme` | Dark/light mode follows system setting automatically, no in-app toggle |

## 5. User stories

1. As a user, I can select a folder of stem files and have it added as a new song, with the folder name used as the song name.
2. As a user, I can see a "Recent" list of previously added songs on the home screen, persisted across app restarts.
3. As a user, I can open a song and see each stem as its own channel strip with a type icon (drums/bass/vocals/other) inferred from the filename.
4. As a user, I can play all stems of a song together, perfectly in sync.
5. As a user, I can mute or adjust the volume of any individual stem while playback continues.
6. As a user, I can change the playback speed of the whole song (all stems move together, staying in sync).
7. As a user, I can add more stems to an already-saved song later.
8. As a user, I can delete a song from my library.
9. As a user, I can remove an individual stem from a song.
10. As a user, the app looks right in dark or light mode depending on my system setting, with no manual toggle needed.
11. As a user, I can install the app to my iOS home screen and use it fully offline afterward.

## 6. Functional requirements

### 6.1 Library (home) view
- "Add Song" control opens a folder picker (`<input type="file" webkitdirectory>`); all audio files within are grouped into one song.
- Song name is derived from the folder name; if unavailable (browser doesn't expose folder path), fall back to prompting the user for a name.
- Non-audio files in the folder are ignored.
- Recent list shows, per song: stem-type icon set, name, stem count, date added — sorted most-recent-first.
- Tapping a song opens its mixer view.
- Each song has a delete action with a confirmation step.
- Empty state shown when no songs exist yet.

### 6.2 Mixer view (per song)
- Loads and decodes all of the song's stored stem blobs into `AudioBuffer`s on open.
- One channel strip per stem, showing:
  - Type icon (derived from filename — see 6.3)
  - Name
  - Mute toggle
  - Volume slider (0–120%)
  - Simple level indicator during playback
  - Remove button (also updates the persisted song record)
- Transport bar: single play/pause control; all stems start from the same clock position so they remain sample-accurate in sync.
- Speed control: single slider (e.g. 0.5x–1.5x) applied to all stems simultaneously via `playbackRate`; changing speed while playing re-anchors the position so sync is preserved. Pitch shifts along with speed in v1 (documented as a known limitation, not a bug).
- "Add more stems" control to append additional files to the currently open song; persisted back to IndexedDB.
- Back control returns to the library view and stops playback.

### 6.3 Stem type detection
- Filename is matched case-insensitively against keyword sets to assign a type + icon:
  - **Drums** 🥁 — "drum", "drums", "kit", "perc", "percussion"
  - **Bass** 🎸 — "bass"
  - **Vocals** 🎤 — "vocal", "vocals", "vox", "voice", "lead", "acapella", "choir"
  - **Other** 🎵 — default when no keyword matches
- Detection runs both at upload time and when rendering the library's icon summary.

### 6.4 Persistence
- IndexedDB store (`songs`), keyed by song ID, holding: id, name, dateAdded, and an array of stems (id, name, color, raw audio blob).
- All mutations (add song, add stem, remove stem, delete song) write through to IndexedDB immediately.
- No data ever leaves the device; no network requests for audio or song data.

### 6.5 PWA / installability
- `manifest.json` with app name, icons (multiple sizes), `display: standalone`, theme colors matching light/dark palettes.
- Service worker precaches the app shell (JS/CSS/HTML) so the app opens and functions fully offline after first load.
- Must be served over HTTPS (or localhost in dev) — required by iOS Safari for install + service worker registration.

### 6.6 Theming
- Color tokens defined as CSS variables with a `prefers-color-scheme: light` override block; no manual toggle in v1.

## 7. Design requirements

- **Mobile-first**: base styles target a ~375–430px viewport; layout should not require horizontal scrolling or pinch-zoom at any point.
- Touch targets (buttons, sliders, mute toggles) sized for comfortable thumb use (44px minimum touch target per Apple HIG guidance).
- Visual language: dark, studio/mixing-console-inspired palette by default, with a defined light equivalent — not a generic light/dark inversion, tuned per-mode.
- Each stem gets a distinct accent color (cycled palette) for quick visual scanning across channel strips.

## 8. Technical constraints & known limitations

- **iOS Safari + `webkitdirectory`**: folder selection support is inconsistent across iOS versions. Where unsupported, the picker should gracefully degrade to multi-file selection, prompting the user for a song name instead of inferring one.
- **iOS storage eviction**: Safari may clear IndexedDB data for installed PWAs after extended inactivity (Apple's ITP storage rules). Not solvable client-side in v1; worth flagging to users or considering an export/backup feature in a later version.
- **Speed/pitch coupling**: true independent time-stretching would require a much heavier DSP approach (e.g. a WASM-based stretcher); out of scope for v1.
- **No push notifications**: iOS PWA push support is limited/version-dependent and not needed for this app's core use case.

## 9. Success criteria

- A user can add a song from a folder and hear all stems playing in sync within a few taps, with no perceptible drift between stems over a full playback.
- Songs persist and reload correctly across an app close/reopen cycle (session persistence via IndexedDB).
- The app installs to an iOS home screen and functions with no network connection.
- No audio data is transmitted off-device at any point (verifiable via network inspection — zero requests carry audio payloads).

## 10. Open questions

- Should there be an export/backup mechanism for songs, given iOS's storage eviction risk?
- Should individual stem volume/mute state be remembered per song across sessions, or reset each time a song is opened?
- Is a waveform/level visualization worth the added complexity in a later version, or does the current simple level indicator suffice?
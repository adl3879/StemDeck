# StemDeck — Design Document

**Status:** Draft
**Companion to:** StemDeck PRD
**Scope:** Visual identity, theming system, iconography, and mobile layout for the React + Vite rebuild

---

## 1. Design principles

StemDeck should feel like a small, well-made piece of studio hardware that happens to live on your phone — not a generic productivity app, and not a literal skeuomorphic mixing desk either. The tone is **fun and modern, but restrained**: one confident color idea, clean geometry, and a lot of quiet, well-spaced UI around it.

Three rules guide every screen:

1. **One signature move, everywhere else quiet.** The signature is the icon system + level-meter motif (see §4). Everything surrounding it — cards, buttons, type — stays simple and gets out of the way.
2. **The phone owns the screen.** No wasted top/bottom chrome, no floating content in a sea of empty space. Views fill the vertical viewport intentionally (§5).
3. **Numbers look like numbers, words look like words.** Timecodes, percentages, and speed values are always monospaced; everything a human reads is humanist and friendly. This is a small detail that makes the app feel precise without feeling cold.

---

## 2. Color system

Rejecting the two most common "AI-default" palettes (warm-cream-and-terracotta, near-black-and-acid-green). StemDeck's identity color is **iris** — a violet-blue that reads as modern and a little playful without being a trend color — paired with a warm **coral** used sparingly for the one or two moments that need energy (play state, record/level peaks).

### 2.1 Dark mode (default)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#15141B` | App background — deep plum-black, never pure black |
| `--surface` | `#1E1C26` | Cards, panels, channel strips |
| `--surface-raised` | `#272531` | Buttons, inputs, hover/active states |
| `--border` | `#34313F` | Hairlines, card borders |
| `--text` | `#F2EEE8` | Primary text |
| `--text-dim` | `#8E8A9C` | Secondary text, labels, timecodes at rest |
| `--iris` | `#8C7CFF` | Primary accent — play button, active states, links |
| `--iris-dim` | `#4A4166` | Iris at low emphasis (e.g. disabled, borders) |
| `--coral` | `#FF6F61` | Secondary accent — mute/danger states, peak levels |

### 2.2 Light mode

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FAF7F2` | App background — warm paper white |
| `--surface` | `#FFFFFF` | Cards, panels, channel strips |
| `--surface-raised` | `#F1ECE2` | Buttons, inputs, hover/active states |
| `--border` | `#E7E1D6` | Hairlines, card borders |
| `--text` | `#201D2B` | Primary text |
| `--text-dim` | `#736C82` | Secondary text, labels |
| `--iris` | `#6C5CE0` | Primary accent (deepened for contrast on light bg) |
| `--iris-dim` | `#DAD4F7` | Iris at low emphasis |
| `--coral` | `#E8574A` | Secondary accent |

### 2.3 Per-stem palette (both modes)

A fixed 6-color cycle identifies stems at a glance, independent of theme — each hue is tuned separately per mode so contrast holds in both:

| Stem slot | Dark | Light |
|---|---|---|
| 1 | `#5FB3A3` (teal) | `#2F8A78` |
| 2 | `#D98A6F` (clay) | `#B85F3F` |
| 3 | `#9D8FC9` (violet) | `#6F5AA8` |
| 4 | `#D3B354` (gold) | `#96792A` |
| 5 | `#6F9BD9` (blue) | `#3D6BAD` |
| 6 | `#C9789E` (rose) | `#A34C74` |

Stem color is assigned by upload order and stored with the stem, so it stays stable across sessions.

---

## 3. Typography

Three type roles, each doing one job — no font does double duty:

| Role | Typeface | Where |
|---|---|---|
| **Display** | Space Grotesk (600/700) | App title, song titles, section headers — geometric and a little playful |
| **Body / UI** | Inter (400/500) | Buttons, labels, list text, body copy — quiet and legible |
| **Numeric / mono** | JetBrains Mono (400/500) | Timecodes, percentages, speed values, dates — anything that is a *measurement* rather than a word |

Type scale (mobile base):

- Display / app title: 20px / 700
- Section header: 13px / 600, uppercase, letter-spacing 0.08em
- Body / stem name: 14–15px / 500
- Secondary / metadata: 12px / 400
- Numeric readouts: 12–14px / 500, tabular figures

---

## 4. Iconography (SVG, not emoji)

Emoji are dropped in favor of a small custom icon set so the app has a consistent, on-brand look regardless of platform emoji rendering. All icons share one construction: **20×20 viewBox, 1.75px stroke, rounded caps and joins, no fill** — so they read as one family at a glance.

| Icon | Concept | Construction notes |
|---|---|---|
| **Drums** | Circular drum shell seen from above, with a cross-brace | A circle with a short horizontal + vertical tick through the center (suggests a snare head and rim), not a literal drum kit illustration |
| **Bass** | Simplified instrument neck | A vertical line (neck) with two short horizontal ticks (strings) crossing it near the top — abstracted, not a full guitar body |
| **Vocals** | Mic capsule | A rounded capsule (stylized microphone head) over a short stand line — no grille detail, kept to two shapes |
| **Other / unmatched** | Waveform blip | Three or five short vertical bars of varying height, echoing the level-meter motif used elsewhere in the app |
| **Theme: auto** | Half-filled circle | Simple circle split light/dark down the middle |
| **Theme: light** | Sun | Circle with short radiating ticks, minimal (4–6 rays, not 8) |
| **Theme: dark** | Moon | Crescent, single clean curve |
| **Play** | Triangle | Standard, rounded corners to match the icon family's joint style |
| **Pause** | Two bars | Rounded-cap bars, same stroke weight as the rest of the set |
| **Mute** | Speaker + slash | Simple speaker trapezoid with a diagonal line through it when muted |
| **Delete / remove** | X | Two rounded-cap strokes |
| **Add** | Plus | Two rounded-cap strokes, slightly heavier weight (2px) since it's a primary action |
| **Back** | Chevron | Single rounded chevron, not a full arrow |

Icons are inline SVG components (not an icon font or sprite sheet) so stroke color can be set per-instance via `currentColor` and inherit theme tokens directly — instrument icons pick up their stem's assigned color; UI icons use `--text` or `--iris` depending on state.

The **level-meter motif** (a small cluster of vertical bars, animated at random-ish heights) recurs in three places: the "Other" stem icon, the per-channel live level indicator during playback, and the loading state — giving the app one visual idea that shows up in function, not just decoration.

---

## 5. Layout: filling the phone

The app targets a true full-height mobile layout, not a scrollable document with margins:

- Root container is `100dvh` (dynamic viewport height, not `100vh`, to handle iOS Safari's collapsing address bar correctly), with `display: flex; flex-direction: column`.
- Each view (Library, Mixer) is a flex column with three regions:
  1. **Header** — fixed height, top-aligned. App title / song title + theme toggle + back button.
  2. **Content** — `flex: 1`, scrolls internally if content overflows; otherwise centers its content vertically when short (empty states, a library with only 1–2 songs, a song with only 1–2 stems) rather than leaving it pinned to the top with dead space below.
  3. **Docked action bar** — fixed at the bottom, safe-area-aware (`env(safe-area-inset-bottom)`), holding the primary action for that view: "Add Song" affordance on Library is inline in-flow, not docked; but the Mixer's transport bar (play/pause, speed) is docked at the bottom, thumb-reachable, always visible without scrolling.
- Centering rule: any view state with fewer items than would naturally fill the viewport (empty library, a song with 1 stem) vertically centers its content in the available space rather than top-aligning — this is what keeps short states from feeling like an unfinished page.
- Side padding: 16px on mobile, capped at a max content width (~480px) and centered horizontally on any larger viewport, so the app doesn't stretch awkwardly if opened on a tablet or desktop browser.

---

## 6. Theming system

A three-state theme control — **Auto / Light / Dark** — replaces the v1 system-only approach:

- Rendered as a compact segmented control (three small icon-only buttons: system, sun, moon) in the header, reachable with one tap.
- **Auto** (default on first launch): follows `prefers-color-scheme` and updates live if the system setting changes while the app is open.
- **Light / Dark**: explicit override, persisted (e.g. in `localStorage` or the same IndexedDB the songs live in) so the choice survives app restarts.
- Implementation: a `data-theme="auto" | "light" | "dark"` attribute on the root element; when `auto`, no inline overrides are applied and the CSS `prefers-color-scheme` media query controls tokens; when explicit, a matching class overrides the token block regardless of system setting.
- Transition: token changes cross-fade (150–200ms) rather than snapping, so switching modes feels considered rather than jarring.

---

## 7. Core components

### 7.1 Theme toggle
Three equal-width icon buttons in a single rounded pill, active state shown as a filled background in `--iris-dim` with the icon in `--iris`.

### 7.2 Song card (Library)
Rounded card (`--surface`, 1px `--border`), left-aligned row of that song's present stem-type icons (deduplicated, in `--text-dim` — icons don't need their stem color here, this is just a summary), song name in body weight, stem count + date in numeric/mono at `--text-dim`. Full-row tap target; delete icon at trailing edge, tap target padded generously so it doesn't compete with the row tap.

### 7.3 Channel strip (Mixer)
Left border in the stem's assigned color (3px) is the only strong color cue on an otherwise neutral card — keeps six strips visually distinct without turning the whole screen into confetti. Instrument icon in that same stem color, name in body text, live level bars beneath, mute + volume controls in a single row at the bottom of the card.

### 7.4 Transport bar (Mixer, docked bottom)
Play/pause as a filled circular button in `--iris` (the one place per screen allowed to be visually loud, per the restraint rule in §1). Timecode in mono. Speed control collapses to a compact readout (`1.00x`) that expands a slider on tap, keeping the docked bar from feeling cluttered at rest.

### 7.5 Add Song / Add Stems zone
Dashed-border rounded panel, centered icon + label, `--iris` for the plus icon and label text, `--text-dim` for the helper sub-line. Sits in-flow (not docked) since it's an occasional action, not a persistent control.

---

## 8. Motion

Used sparingly, in service of function:

- Theme switch: 150–200ms token cross-fade.
- Level meters: continuous subtle animation only while playing; instantly flat when paused or muted — motion should communicate state, not decorate.
- View transitions (Library ↔ Mixer): a brief slide/fade (200ms) reinforces the sense of "opening" a song rather than a hard cut.
- No decorative animation beyond these three purposes — restraint per §1.

---

## 9. Accessibility

- All interactive elements meet a 44×44px minimum touch target, per Apple HIG, regardless of visual icon size.
- Color is never the only signal: mute state also changes icon (speaker → speaker-with-slash) and label, not just color; stem identity is color **and** icon shape, not color alone.
- Contrast: both palettes keep `--text` on `--bg` and `--text` on `--surface` at or above WCAG AA (4.5:1) in normal text sizes.
- Respect `prefers-reduced-motion`: cross-fades and view transitions drop to instant/near-instant when set.
- Focus states are visible (not suppressed) for any user navigating via external keyboard or switch control.
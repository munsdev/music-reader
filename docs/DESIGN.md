# Music Reader: Product and UX Design

Version 0.2, November 2026. Source of truth for what the app does, how it looks and how it behaves. Recognition engineering lives in [OMR.md](OMR.md); repo rules live in [../CLAUDE.md](../CLAUDE.md).

---

## 01 &nbsp; P R O D U C T

### A photo of sheet music becomes colored notes for the instrument you actually own

**WHAT IT IS**

A free, offline Android app. You photograph sheet music, one page or many, and the app shows it as colored notes that match a color-coded instrument: a child's xylophone, desk bells, a toy keyboard, tuned tubes. You set up your instrument once, the app adapts every song to fit it, plays it back, and prints it.

**WHO IT IS FOR**

| User | Situation | What they need |
|---|---|---|
| Parent | Kid's 8-bar xylophone and a songbook | A song a 4-year-old can follow, in minutes |
| Music teacher | Class set of bells or tubes | Printable colored sheets for a group, same colors every time |
| Beginner adult | Keyboard with stickers on the keys | A colored score that matches the stickers |

**PRINCIPLES**

1. **Offline, always.** Recognition, adaptation, playback and PDF export run on the phone. No account, no server, no tracking.
2. **Never silently wrong.** Every recognized note can be checked and fixed. Every change made to fit an instrument is listed and can be undone.
3. **Color is never the only signal.** Every note carries a label and a shape, so colorblind players and black and white printers still work.
4. **Kid-proof output, adult-grade input.** Play and print views are big and calm. Editing tools are precise.
5. **Free, with an optional tip.** No ads, no locked features.

---

## 02 &nbsp; V I S U A L &nbsp; L A N G U A G E

### Painted wooden bars on a clean page

**THE IDEA**

The look comes from the objects in an elementary school music room and a toddler's toy box: painted enamel bars on a birch frame, round felt mallet heads, the brass nail that holds each bar, a songbook on a music stand. The app chrome stays quiet and cool so the note colors are the loudest thing on screen. The one memorable element is the **bar**: a soft rounded slab with two nail dots, used for the instrument, for primary buttons, for progress, and for the song preview strip. Everything else is disciplined.

Not this: primary-color confetti, cartoon mascots, bubble fonts, star bursts, rainbow gradients, clip-art notes. Not that either: grey dashboards, form-heavy settings pages, school-district blue.

**COLOR (APP CHROME)**

| Token | Hex | Use |
|---|---|---|
| `paper` | `#F3F6FA` | App background. Cool, faintly blue white, like a clean music stand sheet |
| `ink` | `#1E2A47` | Text, icons, staff lines. A deep navy, never pure black |
| `birch` | `#E7D7B8` | Wood: instrument frames, the mallet handle, selected states on wood items |
| `felt` | `#3A6F8F` | The single UI accent: primary buttons, links, focus rings, the play cursor |
| `stand` | `#C9D2DE` | Dividers, inactive bars, empty slots |
| `brass` | `#B8893B` | Nail dots on bars, small detail only |

Dark theme swaps `paper` to `#141B2D` and `ink` to `#E8EDF5`; `birch` darkens to `#5A4A33`. Note colors never change between themes.

**NOTE COLORS**

Defined per instrument (section 06). The default "Rainbow" palette is the familiar C red through B violet. Note colors appear only on notes, bars and legends, never on app chrome, so a red C is always a red C.

**TYPE**

| Role | Typeface | Why |
|---|---|---|
| Song titles, screen titles | Young Serif (OFL) | The friendly, slightly old-fashioned serif of a children's songbook |
| Everything else, including note labels | Atkinson Hyperlegible Next (OFL) | Designed for low-vision readers; distinguishes B, 8, D, 0 and similar glyphs, which matters for 4-year-olds reading note names |

Both are bundled in the app (offline) and embedded in PDFs. Type scale on a 16 px base: 14, 16, 20, 25, 31, 39. Sentence case everywhere in the UI. No all-caps labels.

**SHAPE AND MATERIAL**

- **Bars:** rounded rectangle, corner radius 30% of the bar height, a subtle top highlight and a 2 px darker bottom edge so it reads as painted wood, two brass nail dots placed at roughly a fifth and four fifths of the bar's length.
- **Mallet head:** a soft circle with a faint felt texture, used as the playback cursor and the "tap here" hint.
- **Surfaces:** flat. Cards only where content is a distinct object (a song, an instrument). Shadows are short and cool (`rgba(30,42,71,0.12)`), one elevation level only.
- **Icons:** 2 px rounded stroke, drawn in `ink`. Phosphor Icons (MIT) as the base set.

**MOTION**

- A bar dips 2 px and brightens when it sounds. That is the app's core animation, used in the instrument strip, the on-screen instrument and button presses.
- The mallet cursor glides between notes in time with the music.
- Nothing animates on its own outside of playback. `prefers-reduced-motion` turns the glide into a jump and removes the dip.

**VOICE**

Plain, warm, short. "Add a page", not "Upload additional content". "3 notes moved down an octave to fit", not "Range adaptation applied". Errors say what happened and what to do: "The page is blurry. Hold the phone steady and try again."

---

## 03 &nbsp; S T R U C T U R E

### Two shelves and a music stand

The app has two saved collections and one workspace:

- **Songs:** everything scanned, imported or written.
- **Instruments:** every instrument the user has set up.
- **The stand:** one song open with one instrument, where you review, play and print.

Bottom navigation with two tabs, **Songs** and **Instruments**, plus Settings behind a gear in the Songs header. The stand opens full screen over the tabs.

**SITE MAP**

```
Songs (home)
├─ Scan  ─▶ Capture ─▶ Pages ─▶ Recognize ─▶ Review ─▶ Stand
├─ Import (MusicXML, .mxl, PDF, images) ─▶ Pages / Review ─▶ Stand
├─ New (write it yourself) ─▶ Note editor ─▶ Stand
└─ Song ─▶ Stand
           ├─ Play view (circles, staff, strip)
           ├─ Fit (adaptation summary and overrides)
           ├─ Pages (add, reorder, retake, re-read)
           ├─ Edit notes
           └─ Print and share
Instruments
├─ Instrument ─▶ Instrument editor
└─ New ─▶ Preset picker ─▶ Instrument editor
Settings ─▶ Note names, language, theme, recognition models, about, licenses, support
```

---

## 04 &nbsp; F L O W S

### Scan, add pages later, fix, fit, play, print

**FIRST RUN**

1. One screen: the app name, a drawn 8-bar xylophone, and "Set up your instrument".
2. Preset picker: drawn instruments, each with its name and note count. Pick one, or "Build my own".
3. Instrument editor opens on the chosen preset so the user can match colors to their real toy. "Save instrument".
4. Songs opens with one sample song ("Twinkle, Twinkle, Little Star", public domain) on the shelf, ready to play.
5. Recognition models download on the first scan, with size shown and a Wi-Fi only option.

**SCAN A MULTI-PAGE SONG**

1. Songs ▶ **Scan**. Camera opens.
2. Each capture adds a thumbnail to a tray along the bottom with a page number. Keep shooting for more pages. Gallery picks (one or many images) go into the same tray.
3. Tap **Done** ▶ **Pages** screen: each page shows its crop with draggable corners. Drag thumbnails to reorder. Swipe up to delete. Rotate. Retake one page.
4. **Read music**. Pages are recognized one by one, in the background, with a notification when done.
5. **Review** (section 05). Then **Fit** to the instrument, then the play view.

**ADD PAGES TO A SONG THAT ALREADY EXISTS**

The page is the unit of a song. A song is an ordered list of pages, and each page holds its photo and the measures read from it.

1. Open the song ▶ **Pages**.
2. **Add a page** ▶ camera or gallery ▶ choose **At the end** (default), or drag the new thumbnail to any position.
3. Only new pages are recognized. Measure numbers are recalculated across the song. Edits on existing pages are kept.
4. Also available here: **Retake** (replace the photo, re-read that page only), **Read again** (re-recognize after a model update), **Remove page** (with undo).
5. From Songs, long-press a song ▶ **Merge with…** joins two saved songs into one, page order shown before confirming. This covers "I scanned page 2 as its own song by mistake."

**IMPORT**

- MusicXML or .mxl: straight to Fit; no review needed.
- PDF: each PDF page becomes a song page, then the scan flow from step 3.
- Images: same as gallery picks.
- Android share sheet: other apps can share images, PDFs or MusicXML into Music Reader.

**WRITE A SONG BY HAND**

Songs ▶ **New**. The instrument is drawn at the bottom of the screen; tapping a bar adds that note. A duration picker (whole, half, quarter, eighth, dotted) and a rest button sit above it. Backspace removes the last note. This is also how a parent types in a song from memory.

---

## 05 &nbsp; S C R E E N S

### What each screen shows, and its one job

**SONGS (HOME)**: find a song or start a new one

```
┌────────────────────────────────┐
│ Songs                       ⚙  │
│ [ Search songs              ]  │
│                                │
│ ┌────────────┐ ┌────────────┐  │
│ │ Twinkle,   │ │ Ode to Joy │  │
│ │ Twinkle    │ │            │  │
│ │ ● ● ● ● ● ●│ │ ● ● ● ● ● ●│  │  ◀ first notes, in their colors
│ │ Xylophone  │ │ Bells · 2p │  │
│ └────────────┘ └────────────┘  │
│                                │
│ ▬▬▬▬▬▬▬ Scan music ▬▬▬▬▬▬▬▬    │  ◀ primary button drawn as a bar
│   Import        New            │
├────────────────────────────────┤
│   Songs          Instruments   │
└────────────────────────────────┘
```

- Two-column grid of song cards. Title in Young Serif, a strip of the first notes as colored dots, instrument name and page count.
- Sort: recent or A to Z. Long-press: rename, duplicate, merge with, delete (with undo), share.
- Empty state: "Scan a page of music to make your first song" and the Scan button.

**CAPTURE**: get a sharp, flat photo of each page

- Full-screen camera, live page outline in `felt`, auto-capture when the outline holds still for one second (can be turned off).
- Bottom tray of captured pages with numbers. Shutter, flash, gallery, Done.
- First-use tip, dismissible: "Lay the page flat, use even light, fit the whole page in the frame."

**PAGES**: put pages in order and crop them

- Vertical list of pages, each with its crop and four draggable corners (magnifier under the finger).
- Drag handle to reorder. Rotate, Retake, Remove.
- Add a page. Read music.

**REVIEW**: check what the app read

```
┌────────────────────────────────┐
│ ← Review          4 to check ▸ │
│ ┌────────────────────────────┐ │
│ │      photo of the page     │ │  ◀ tap a note here...
│ │        ▢ highlighted       │ │
│ └────────────────────────────┘ │
│  𝄞  G major   3/4              │  ◀ clef, key, time as editable chips
│ ─♩─♩─♪♪─│─♩──◌──│─            │  ◀ ...and its partner lights up here
│                                │
│ ┌ Note ──────────────────────┐ │
│ │ E  ▲ ▼   ♯ ♮ ♭   ♩ ♪ 𝅗𝅥 𝅝    │ │
│ │ Delete      Undo           │ │
│ └────────────────────────────┘ │
│ ▬▬▬▬▬▬▬ Looks good ▬▬▬▬▬▬▬▬    │
└────────────────────────────────┘
```

- Photo above, engraved score below; selecting a note in one highlights it in the other.
- Notes the model is unsure about have an amber outline; "4 to check" steps through them.
- Note sheet: pitch up and down by step, sharp, natural, flat, duration, make rest, delete. Full undo history.
- Clef, key and time signature are editable chips per system, because one wrong clef shifts every note.

**FIT**: make the song playable on this instrument

- Instrument picker at the top (defaults to the last one used with this song).
- Plain-language list of what changed, each line expandable to show the measures and switchable off:
  - "Moved the whole song up 2 steps to fit."
  - "3 notes were too high and are played an octave lower."
  - "F♯ isn't on this instrument. Used F in 2 places."
  - "Chords reduced to the top note."
- Transpose stepper for a manual override. Fit score: "96% of notes play exactly as written."
- Fit settings are saved per song and instrument pair.

**PLAY VIEW**: read and play along

```
┌────────────────────────────────┐
│ ← Twinkle, Twinkle      ⋯      │
│ [ Circles | Staff | Strip ]    │
│                                │
│  (C) (C) (G) (G) │ (A) (A) (G) │  ◀ circles sized by duration
│  (F) (F) (E) (E) │ (D) (D) (C) │
│                                │
│ ┌────────────────────────────┐ │
│ │ ▬C ▬D ▬E ▬F ▬G ▬A ▬B ▬C    │ │  ◀ instrument strip, bars dip as they play
│ └────────────────────────────┘ │
│   ⟲   ◀◀    ▶    ▶▶   ♩=90     │
└────────────────────────────────┘
```

- **Circles:** rows of colored circles with label and shape, width by duration, measure lines between groups. Line breaks fall on measures. Best for young children.
- **Staff:** real notation with colored noteheads and labels under the notes. For older children and adults.
- **Strip:** the instrument fills the lower half; bars light up in sequence. For learning a song by watching.
- Shared: label style (letters, numbers 1 to n along the instrument, solfège, none), size (S, M, L, XL), landscape.

**INSTRUMENTS**: the user's saved instruments

- List of drawn instruments with name and note count. New ▶ preset picker or "Build my own".
- Long-press: rename, duplicate, delete (presets can be duplicated, not deleted).

**INSTRUMENT EDITOR**: make the app's instrument match the real one

```
┌────────────────────────────────┐
│ ← My xylophone          Save   │
│                                │
│  ▕▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▏ C4       │
│   ▕▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▏ D4        │  ◀ bars drawn long to short
│    ▕▬▬▬▬▬▬▬▬▬▬▬▬▬▬▏ E4         │
│      …                         │
│  + Add a bar at the top        │
│                                │
│ Colors: Rainbow ▾   Octave − + │
│ Labels: Letters ▾   Chords: off│
└────────────────────────────────┘
```

- The instrument is drawn as it looks: xylophone bars getting shorter, keyboard keys, tubes getting shorter, bells.
- Tap a bar: change its note, color (palette swatches plus a full picker), shape, and an optional sticker label.
- Add or remove a bar at either end. Shift the whole instrument by an octave (toy octaves are often unknown).
- Palette menu recolors everything at once. "Chords" switch sets one-note or multi-note playing.
- **Tap to hear:** every bar plays its tone, so the user can match it against the real toy by ear.
- **Print stickers:** a sheet of round labels in the instrument's colors for toys with unlabeled bars.

**PRINT AND SHARE**: get paper for the music stand

Covered in section 07.

**SETTINGS**

- Note names: English (C D E F G A B), German (C D E F G A H), solfège, numbers.
- Language: English, German. Theme: system, light, dark. Sound: volume, instrument sound. Haptics.
- Recognition models: status, size, remove, download again.
- Back up library to a file, restore from a file.
- About, privacy ("Nothing leaves your phone"), open-source licenses, support the app (tips).

---

## 06 &nbsp; I N S T R U M E N T S &nbsp; A N D &nbsp; C O L O R

### Presets that match real toys, palettes that work for everyone

**PRESETS**

| Preset | Notes | Kind |
|---|---|---|
| 8-note xylophone or bells | C4 to C5, white notes | Bars |
| 15-note glockenspiel | C5 to C7, white notes | Bars |
| 25-key toy keyboard | C4 to C6, all notes | Keys, chords allowed |
| Tuned tubes, 8 notes | C4 to C5, white notes | Tubes |
| Tuned tubes, 13 notes | C4 to C5, all notes | Tubes |

**PALETTES**

- **Rainbow** (default): C red, D orange, E yellow, F green, G blue, A indigo, B violet. Sharps and flats take the hue between their neighbors.
- **High contrast:** fewer, more separated hues.
- **Pastel:** softer colors for the paper-saving print option.
- **Custom:** per-note color picker.

Some commercial tube and bell sets use their own color schemes; the user matches them with Custom. The app never uses another product's brand name.

**ACCESSIBILITY OF COLOR**

- Every note shows a label and a shape (circle, square, triangle, diamond, star, hexagon, heart for the seven naturals; a ring around the base shape for sharps and flats).
- Label text color is chosen per note for at least 4.5:1 contrast.
- A test checks every built-in palette under deuteranopia, protanopia and tritanopia simulation and fails if two naturals become indistinguishable without their shapes.

---

## 07 &nbsp; P R I N T

### Print-ready PDFs that look like a real songbook page

**OUTPUT**

- Vector PDF built on the phone with pdf-lib (MIT), fonts embedded, no rasterized notes. Sharp at any size.
- Paper: A4 or US Letter (default from the phone's region), portrait or landscape. 15 mm margins, inside the safe area of home printers.
- Opens the Android print dialog directly, or saves and shares the file.

**LAYOUT OPTIONS**

| Option | Choices |
|---|---|
| Style | Circles, colored staff, or staff with circles underneath |
| Size | Regular, large, extra large (for toddlers: fewer measures per line) |
| Ink | Full color, light color (pastel fills with colored outlines, saves ink), black and white (shapes and labels only) |
| Extras | Instrument legend, measure numbers, title and composer header, page numbers, a blank line for the child's name |

**WHAT EVERY PAGE HAS**

- Header: title in Young Serif, composer, instrument name.
- First page: the instrument legend, drawn as the actual instrument with each bar's color, shape and label, so the paper works without the app.
- Lines break only at measure boundaries; a measure never splits across lines or pages.
- Footer: page x of y, and a small "Made with Music Reader".

**OTHER PRINTABLES**

- Sticker sheet for an instrument (round labels, sized for typical bar widths, with cut guides).
- Export also offers PNG per page, MusicXML with note colors, and MIDI.

---

## 08 &nbsp; P L A Y &nbsp; A L O N G

### Hear it, follow it, play it

**SOUND**

- Synthesized on the phone with the Web Audio API, no sound files needed. One voice per instrument kind: xylophone (wood, fast decay), glockenspiel and bells (metal, long ring), toy piano, soft tube "bonk".
- Each bar in the editor and play view plays its own tone when tapped.
- Low latency: audio context started on the first touch, scheduled with lookahead so timing stays steady.

**PLAYBACK CONTROLS**

- Play, pause, back to start, step one note forward or back.
- Tempo 40% to 150% of the written tempo, with the BPM shown.
- Count-in of one measure with clicks. Metronome on or off.
- Loop: drag across measures to repeat just that part.
- The cursor (the felt mallet) moves note by note; the current note grows slightly, the next note gets a soft outline.

**PRACTICE MODES**

| Mode | What happens | For |
|---|---|---|
| Listen | The app plays the song, cursor follows | Learning how it goes |
| Follow | The app plays a click; the child plays the real instrument; cursor keeps time | Playing along at tempo |
| Wait for me | The cursor waits until the right note is played, then moves on | Toddlers and first songs |
| Tap along | The child plays on the on-screen instrument instead of a real one | No instrument at hand |

"Wait for me" and "Follow" can listen through the microphone: the app detects the pitch the child plays (on-device pitch detection, no recording saved) and lights up the note when it is right. Without microphone permission, a parent can tap "Next" instead. The microphone is off unless one of these modes is running, and the app says so on screen.

---

## 09 &nbsp; D A T A &nbsp; M O D E L

### One internal score format; songs are made of pages

**SONG**

- `Song`: id, title, composer, created and updated dates, `pages`, `score`, per-instrument fit settings, last instrument used.
- `Page`: id, order, original photo (file path), crop corners, rotation, recognition status, model version, and the range of measures it produced.
- `Score` (internal, `src/core/model.ts`): parts ▶ measures ▶ note events with ticks at 480 per quarter note, spelled pitch plus MIDI number, voice, staff, ties, chord flags, and optional recognition data (box on the page photo, confidence).

Recognized pages each produce their own measures; the song's score is the concatenation in page order. Editing a note marks it as user-edited so re-reading a page keeps the edit or asks first.

**INSTRUMENT**

- `InstrumentProfile`: id, name, kind (bars, keys, tubes, bells), polyphony (one note or chords), sound, and an ordered list of notes, each `{ midi, color, shape, label? }`.

**FIT RESULT**

- The adapted score plus `Change` records `{ kind: 'transpose' | 'octave' | 'substitute' | 'melody' | 'drop', measures, from, to }`.

**STORAGE**

- IndexedDB via Dexie: songs, pages metadata, scores, instruments, fit settings.
- Capacitor Filesystem (app-private): page photos and exports.
- Capacitor Preferences: settings.
- Backup: one `.musicreader` file (zip of the database export and photos), restored from Settings.

---

## 10 &nbsp; F I T &nbsp; R U L E S

### Fit the music to the instrument, and say exactly what changed

1. **Melody** (one-note instruments, or by choice): keep the top voice of the top staff; for chords keep the highest note.
2. **Best transposition:** try every shift from −12 to +12 semitones. Score each by notes that land exactly on the instrument, with penalties for octave folds and substitutions and a small penalty for larger shifts. Ties go to the smaller shift, then upward.
3. **Octave folding:** notes still out of range move by whole octaves to the nearest playable octave.
4. **Substitution:** a missing note (F♯ on a white-notes xylophone) becomes the nearest available note, preferring the same letter (F♯ to F), otherwise the nearest by semitone, ties upward.
5. **Report:** every step produces `Change` records grouped by measure.

---

## 11 &nbsp; Q U A L I T Y &nbsp; B A R

### Usable by a child, a teacher and a screen reader

- WCAG 2.1 AA for all app chrome. Touch targets at least 48 × 48 dp; play-view bars at least 64 dp tall.
- Every note has a text alternative ("C, quarter note, measure 3").
- Android font scaling, dark theme, landscape on tablets.
- Cold start under 2 seconds on a mid-range phone. Recognition target under 20 seconds per page. Playback timing jitter under 10 ms.
- English and German at launch, all strings in translation files.
- Play Families policy: no ads, no analytics, purchases and external links behind a parent check.

---

## 12 &nbsp; S T A C K &nbsp; A N D &nbsp; L I C E N S I N G

### Standard tools, all compatible with a free app that takes tips

| Layer | Choice | License |
|---|---|---|
| UI | React 19, TypeScript, Tailwind CSS 4, React Router | MIT |
| State | Zustand | MIT |
| Storage | Dexie, Capacitor Filesystem and Preferences | Apache-2.0, MIT |
| Native shell | Capacitor 8 (Android) | MIT |
| Notation | OpenSheetMusicDisplay | BSD-3-Clause |
| PDF | pdf-lib | MIT |
| .mxl unzip | fflate | MIT |
| i18n | i18next, react-i18next | MIT |
| Icons | Phosphor Icons | MIT |
| Fonts | Young Serif, Atkinson Hyperlegible Next | SIL OFL 1.1 |
| Recognition | Native Kotlin plugin: ONNX Runtime Android, OpenCV Android, oemer pipeline port, retrained model | MIT, Apache-2.0, MIT |
| Tips | cordova-plugin-purchase (Google Play Billing) | MIT |
| Tests | Vitest, Testing Library; JVM tests for the plugin | MIT |
| Lint and format | oxlint, Prettier | MIT |

App code is Apache-2.0 with a `NOTICE` file. The Licenses screen is generated at build time from the dependency tree, plus a maintained list for fonts, models and datasets (CC BY 4.0 needs attribution in the app).

---

## 13 &nbsp; R E L E A S E &nbsp; P L A N

| Milestone | Contents |
|---|---|
| M1 Core | Data model, MusicXML and .mxl import, fit rules, presets, instrument editor, songs and instruments saved, circles and staff views, playback, PDF export |
| M2 Recognition | Native OMR plugin, retrained clean model, capture, pages (multi-page, add pages, merge), review |
| M3 Play along | Strip view, practice modes, microphone pitch detection, sticker sheet, MIDI export |
| M4 Store | German, accessibility pass, tips, licenses screen, signed AAB, listing, Families review, closed testing |

---

## 14 &nbsp; K N O W N &nbsp; L I M I T A T I O N S , &nbsp; P R E C I S E L Y

- **Recognition model license.** Both available pretrained OMR models are trained partly on non-commercial data (homr: Camera-PrIMuS; oemer model 1: CvcMuscima-Distortions). The plan retrains oemer's model 1 on commercially usable data. Until that model exists and is evaluated, photo recognition cannot ship.
- **Recognition accuracy** on phone photos of real songbooks is unmeasured. The test set and target are in OMR.md.
- **On-device speed.** The two networks are about 109 MB in float32. Speed and memory on a mid-range phone are unknown until benchmarked.
- **Microphone pitch detection** for toy instruments is untested. Toy xylophones are often out of tune and rich in overtones; the detector needs a tolerance setting and testing on real toys.
- **Handwritten music** is not supported.
- **Piano and multi-voice music** is shown in full but reduced to a melody for one-note instruments, which can sound thin.
- **Lyrics and dynamics** are ignored in v1. Repeats are expanded for playback when recognized.
- **Fonts.** Young Serif and Atkinson Hyperlegible Next licenses (OFL) allow bundling and PDF embedding; confirm the exact current releases before shipping.
- **App name.** "Music Reader" is a working title. Check the store name for trademark conflicts before release.

# Music Reader: build status and remaining work

Version 0.1, November 2026. What exists in the repo today, verified how, and what is left in priority order.

---

## 01 &nbsp; B U I L T

### The whole app runs in a browser and as a debug APK; photo recognition is mocked

**CORE LOGIC** (`src/core`, unit tested)

- Score model, pitch spelling and naming (English, German H/B, solfège).
- MusicXML and .mxl import (partwise, chords, voices, staves, ties, dots, transposing instruments) and MusicXML export with note colors and labels.
- Fit to instrument: melody extraction, best transposition search, octave folding, substitution, change report.
- Timeline for playback, circles layout (line breaks only at measures), MIDI export.
- Editing: pitch, step, accidental, duration, rest, delete, append, multi-page join, replace one page, merge songs.
- Instrument presets, palettes, shapes, labels.

**APP** (`src/features`, checked in a browser at phone size, English and German, light and dark)

- First run: welcome, preset picker, instrument editor.
- Songs: grid with color preview, search, sort, rename, duplicate, join songs, delete with undo, share MusicXML.
- Import: MusicXML, .mxl, PDF (each page rendered to an image), images.
- Scan: camera or gallery, multi-page, add pages to an existing song, reorder, crop corners, rotate, retake, remove, read again.
- Review and edit: photo with note boxes, low-confidence notes flagged, note panel, undo and redo.
- Write a song by tapping the instrument.
- Stand: circles, staff (OpenSheetMusicDisplay, colored noteheads, labels, cursor), strip; fit sheet with overrides; playback with tempo, count-in, metronome, loop; practice modes Listen, Follow, Wait for me (microphone pitch detection or Next note), Tap along.
- Print: vector PDF (circles style) in A4 or Letter, three sizes, color, light or black and white, instrument key, name line, measure numbers; sticker sheet per instrument.
- Settings: labels, letter names, language, theme, paper, volume, haptics, recognition files, backup and restore, licenses screen, tips behind a grown-up check.

**BUILD**

- `npm test`: 59 tests. `npm run typecheck`, `npm run lint`, `npm run format:check`.
- CI builds the web app and a debug APK on every push.
- `scripts/generate-licenses.mjs` fails the build if a copyleft or non-commercial license enters the dependency tree.

---

## 02 &nbsp; R E M A I N I N G

### In priority order

**1. NATIVE RECOGNITION PLUGIN** (largest item, see OMR.md)

- Kotlin Capacitor plugin named `Omr` implementing the interface in `src/omr/engine.ts` (`modelStatus`, `installModels`, `removeModels`, `recognize`, events `stage` and `installProgress`, error codes `no-models`, `no-staff`, `blurry`, `failed`).
- Port of oemer's pipeline with ONNX Runtime Android and OpenCV Android. Golden tests on the JVM against oemer's own output for the same images.
- Return note boxes as fractions of the page image and a confidence per note, in document order of the returned MusicXML.
- Respect the "Download only on Wi-Fi" setting.

**2. CLEAN MODEL**

- Retrain oemer model 1 without CvcMuscima (see OMR.md section 03). Record every dataset in `models/DATA_LICENSES.md`.
- int8 quantization, Play Asset Delivery on-demand pack, GitHub Release fallback for sideloaded builds, SHA-256 check.
- Build the 40-page evaluation set and publish the numbers.

**3. ON DEVICE CHECKS**

- Audio latency and timing on two mid-range phones; microphone pitch detection on real toy xylophones and bells (tolerance setting).
- Camera and gallery permissions on Android 10 to 15; photo picker path.
- Performance of the circles view on long songs.

**4. MISSING FEATURES FROM DESIGN.md**

- Live capture screen with page outline and auto-capture (today the system camera is used), automatic corner detection.
- Android print dialog (PrintManager plugin); today PDFs go through the share sheet.
- PDF styles "colored staff" and "staff with circles"; PNG export.
- Clef, key and time chips in Review.
- Drag to reorder pages (today: up and down buttons).
- Palette test under color-blindness simulation.

**5. STORE**

- App icon and splash in the visual language, store listing text (English and German), screenshots.
- Play Console: create consumable products `tip_small`, `tip_medium`, `tip_large`; Data safety form (no data collected); Families policy review; privacy policy page.
- Trademark check for the final name; then release signing.

---

## 03 &nbsp; K N O W N &nbsp; L I M I T A T I O N S , &nbsp; P R E C I S E L Y

- Recognition in this build is a mock that returns the same short melody for every page. It exists so the scan, review and fit flow can be built and tested.
- The staff view cursor moves by time, so in multi-voice music it may sit between notes of different voices.
- Microphone pitch detection is tested only on synthetic tones.
- The licenses screen lists npm packages automatically; fonts, icons, oemer and DeepScoresV2 are listed by hand in `src/features/settings/LicensesScreen.tsx` and must be kept current.

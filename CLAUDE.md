# Music Reader: rules for working in this repo

Free, offline Android app that turns sheet music (photos or MusicXML) into colored notes for children's color-coded instruments, with play-along and print-ready PDFs.

## Read first

- `docs/DESIGN.md`: product, visual language, screens, flows, print, play-along, data model. Source of truth for behavior and look.
- `docs/OMR.md`: on-device recognition pipeline, model retraining, licensing of models and datasets.
- `docs/HANDOFF.md`: what is built, what is left, in priority order.

If a change would contradict either document, stop and ask the owner (Casey) first, and say exactly what would change.

## Stack

React 19, TypeScript (strict, `noUncheckedIndexedAccess`), Tailwind CSS 4, Vite, Capacitor 8 (Android), Zustand, Dexie, React Router, i18next, OpenSheetMusicDisplay, pdf-lib, Vitest and Testing Library, oxlint, Prettier. Recognition is a native Kotlin Capacitor plugin (ONNX Runtime Android, OpenCV Android).

## Commands

```
npm run dev            # web dev server (use MockOmrEngine for recognition)
npm test               # Vitest
npm run typecheck
npm run lint
npm run format
npm run android:sync   # build web and copy into android/
npm run android:open   # open in Android Studio
cd android && ./gradlew assembleDebug
```

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, tests, web build, and builds the debug APK as an artifact.

## Layout

```
src/core/      Pure TypeScript logic, no React, no Capacitor. Fully unit tested.
src/omr/       Recognition engine interface, native bridge, MockOmrEngine, page reader.
src/audio/     Web Audio synth, player (lookahead scheduler), pitch detection.
src/print/     PDF export (pdf-lib, vector, embedded fonts) and sticker sheets.
src/data/      Dexie database, repositories, backup and restore.
src/state/     Settings store (Capacitor Preferences) and data hooks.
src/platform/  Camera, files and sharing, fonts, PDF page import, haptics, tips (Play Billing).
src/features/  Screens: songs, stand (play view, pages, edit, write), instruments, settings, onboarding.
src/ui/        Shared components (Bar, controls, Sheet, Screen, InstrumentView, toast).
src/i18n/      en and de strings; a test checks every key exists in both.
scripts/       generate-licenses.mjs (runs before build and test; fails on copyleft or NC licenses).
android/       Capacitor Android project and the OMR plugin module.
models/        Training scripts, data license records. Model files are not committed.
docs/          Design documents.
```

## Rules

- **Licensing is a hard constraint.** Only add dependencies, fonts, models, datasets or assets whose licenses allow use in a free app that takes tips (MIT, BSD, Apache-2.0, ISC, OFL, CC0, CC BY). Never NC, ND, GPL or AGPL. Record every model and dataset with its license and the date checked in `models/DATA_LICENSES.md`, and add required attributions to the Licenses screen.
- **Offline and private.** No analytics, no ads SDKs, no network calls except model download and Play Billing. Microphone only while a listening practice mode runs.
- **Core logic stays pure.** Anything in `src/core` must run in Node under Vitest. Add tests with every change there.
- **Design tokens only.** Colors, type and radii come from the Tailwind theme defined in `src/index.css` (`paper`, `ink`, `birch`, `felt`, `stand`, `brass`). Note colors come only from instrument profiles. No ad-hoc hex values in components.
- **Accessibility.** Touch targets at least 48 dp. Every note has a label and a shape, not color alone. Every interactive element has an accessible name. Respect `prefers-reduced-motion`.
- **Strings** go through i18next (`en` and `de`). No hard-coded user-facing text.
- **Copy style.** Sentence case, plain words, no all-caps labels. Errors say what happened and what to do.
- **No em dashes or en dashes** anywhere in UI text, docs or commit messages. American English spelling.
- **Secrets** (keystores, passwords) are never committed.

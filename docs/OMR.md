# Music Reader: On-Device Recognition (OMR)

Version 0.1, November 2026. How a photo becomes a `Score`, and how the models are produced so the app stays clean for commercial distribution.

---

## 01 &nbsp; A P P R O A C H

### Port oemer's MIT pipeline to Kotlin; retrain the one model that was trained on non-commercial data

**WHY OEMER**

- Code is MIT licensed (checked from the PyPI wheel, version 0.1.8, `LICENSE` file).
- Designed for skewed phone photos of printed music.
- Architecture is two U-Net segmentation models plus classical post-processing and small SVM classifiers. Classical code is portable and testable; the networks export to ONNX (already published as ONNX).

**WHY NOT HOMR**

- Code is AGPL-3.0, and its authors state they cannot offer a commercial license.
- Every transformer checkpoint released so far includes Camera-PrIMuS in its training data, listed as CC BY-NC 4.0 on Hugging Face.

**LICENSE STATUS OF OEMER ARTIFACTS**

| Artifact                                              | Training data                      | Data license                              | Usable?                                                   |
| ----------------------------------------------------- | ---------------------------------- | ----------------------------------------- | --------------------------------------------------------- |
| Model 1 (`1st_model.onnx`, staff vs symbols, 70.8 MB) | CvcMuscima-Distortions             | CC BY-NC-SA 4.0 (non-commercial research) | **No.** Retrain.                                          |
| Model 2 (`2nd_model.onnx`, symbol classes, 38.4 MB)   | DeepScores-extended                | CC BY 4.0                                 | Yes, with attribution                                     |
| SVM classifiers                                       | Extracted from DeepScores-extended | CC BY 4.0                                 | Yes, with attribution. Retrain anyway for reproducibility |

A free app with tips counts as commercial use for the purpose of a non-commercial license. Do not ship any artifact trained on NC data, even temporarily.

---

## 02 &nbsp; P I P E L I N E

### Seven stages, each testable on its own

| #   | Stage                     | Input ▶ output                                              | Implementation                                                                                                                          |
| --- | ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Page detection and dewarp | Camera image ▶ flat, cropped grayscale page                 | OpenCV: edge detection, largest quadrilateral, perspective transform; optional mild unwarp                                              |
| 2   | Normalize                 | Page ▶ fixed-width image (staff spacing normalized)         | Estimate staff line spacing from run-length histogram; rescale so spacing is a constant                                                 |
| 3   | Segmentation              | Image ▶ two class maps                                      | Model 1 (staff lines, symbols), Model 2 (noteheads, stems, clefs, accidentals, rests, barlines...) via ONNX Runtime, tiled with overlap |
| 4   | Staff extraction          | Staff map ▶ staves and systems                              | Port of oemer `staffline_extraction`                                                                                                    |
| 5   | Symbol extraction         | Class maps ▶ noteheads, clefs, accidentals, rests, barlines | Port of oemer `notehead_extraction`, `symbol_extraction`, `note_group_extraction`; SVMs for rest and accidental types                   |
| 6   | Rhythm and assembly       | Symbols ▶ voices, durations, measures                       | Port of oemer `rhythm_extraction` and `build_system`                                                                                    |
| 7   | Output                    | Assembly ▶ `RecognitionResult`                              | MusicXML string plus per-note bounding box and confidence                                                                               |

The plugin returns MusicXML so the web layer uses the same import path as files. Bounding boxes and confidences come alongside, keyed by note order, for the Review screen.

**PLUGIN INTERFACE** (TypeScript side, `src/omr/engine.ts`)

```ts
recognize(pages: { uri: string }[], onProgress): Promise<RecognitionResult>
modelStatus(): Promise<{ installed: boolean; version: string; bytes: number }>
installModels(): Promise<void>
```

A `MockOmrEngine` returns fixture MusicXML so the whole UI can be developed and tested in a desktop browser.

---

## 03 &nbsp; R E T R A I N I N G

### Same architecture, clean data, measured before and after

**DATA (COMMERCIALLY USABLE ONLY)**

| Dataset                           | License                                 | Use                                                                                                                     |
| --------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| DeepScoresV2 (Zenodo 4012193)     | CC BY 4.0                               | Primary training data for both models; includes staff line annotations                                                  |
| OpenScore Lieder                  | CC0                                     | Source scores for synthetic renders                                                                                     |
| PDMX `no_license_conflict` subset | CC BY 4.0 dataset, public-domain scores | Source scores for synthetic renders                                                                                     |
| Synthetic renders                 | Generated by us                         | Render source scores with an engraver, apply phone-style augmentation (perspective, blur, shadows, paper texture, JPEG) |

Before using any dataset, re-check its license at the source and record the date in `models/DATA_LICENSES.md`.

**PROCESS**

1. Reproduce oemer's model 1 training with its MIT training scripts on DeepScoresV2 and synthetic renders. The staff-vs-symbol target can be derived directly from DeepScoresV2 annotations and from synthetic renders.
2. Optionally retrain model 2 on the same mix for consistency.
3. Export to ONNX, then int8 dynamic quantization. Target: both models under 35 MB combined.
4. Evaluate on the test set below against the original oemer models. Accept when the clean model is within 2 points of the original on note-level F1, or better.

**COMPUTE**

A single consumer GPU or a free Kaggle/Colab GPU session. Training scripts must be resumable and checkpoint to disk every epoch.

---

## 04 &nbsp; E V A L U A T I O N

### A fixed test set of real phone photos

- 40 pages photographed on at least two phones: children's songbooks, hymnals, beginner piano books, lead sheets. Only public-domain music, so the set can live in the repo.
- Ground truth as MusicXML.
- Metrics: note-level pitch accuracy, note-level duration accuracy, measure-level exact match, and "notes needing a fix per page" (the number users feel).
- Run in CI on the JVM (ONNX Runtime has a desktop Java build) for every model change.

---

## 05 &nbsp; D E L I V E R Y

### Models are not bundled in the base APK

- Ship models as a Play Asset Delivery on-demand asset pack (Play-hosted, no own server). Debug and sideloaded builds download from a GitHub Release of this repo instead.
- Verify SHA-256 after download. Store under app-private storage.
- Model version is recorded in each `Score` that came from recognition.

---

## 06 &nbsp; K N O W N &nbsp; L I M I T A T I O N S , &nbsp; P R E C I S E L Y

- The clean model does not exist yet. Accuracy after retraining without CvcMuscima is unknown; CvcMuscima is handwritten, so the loss on printed music may be small, but this is untested.
- DeepScoresV2 is rendered digital music, not photos. Phone-photo robustness depends on the synthetic augmentation.
- On-device speed and memory are unmeasured. Tiled inference on a 3000 px page may need 1 to 2 GB of RAM in float32; quantization and smaller tiles are the mitigation.
- oemer's post-processing (staff, notehead, symbol, note group, rhythm extraction, system building, dewarp) is about 4,500 lines of Python using NumPy, SciPy, OpenCV and scikit-learn. The Kotlin port must be checked against oemer's own output on the same images (golden tests) to catch porting errors.
- oemer's README states it does not target handwritten scores.

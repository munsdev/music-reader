# Music Reader

Turn sheet music into colored notes for the instrument you have: a toy xylophone, desk bells, tuned tubes or a keyboard with stickers. Scan a page (or several), fit the song to your instrument, play along, and print it.

Free, offline, no ads, no account. Working title.

## Status

Early development. See [docs/DESIGN.md](docs/DESIGN.md) for the product and UX design and [docs/OMR.md](docs/OMR.md) for the recognition plan.

## Develop

Requires Node 22 and, for Android builds, JDK 21 and the Android SDK (Android Studio installs both).

```
npm install
npm run dev
npm test
npm run android:sync
cd android && ./gradlew assembleDebug
```

Every push to `main` builds a debug APK in GitHub Actions; download it from the run's artifacts.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Third-party licenses are listed in the app under Settings, Open-source licenses.

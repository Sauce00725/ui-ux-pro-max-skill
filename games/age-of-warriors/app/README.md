# Dawn of War: iOS and Android app

This folder wraps the game in a native app with [Capacitor](https://capacitorjs.com).
The game itself lives one folder up (`index.html`, `data.js`, `game.js`). This folder
adds a full page head for phones, the app icon and splash, and the Capacitor project.

## What's here

| File | Purpose |
|---|---|
| `build.mjs` | Builds `www/`: the game page with a mobile `<head>` (viewport, safe areas, home-screen meta), the scripts, icons and a web manifest |
| `make-icons.mjs` | Renders the icon and splash from the game's own art into `resources/` (icons are written without an alpha channel, as the App Store requires) |
| `resources/` | `icon-only.png` (1024×1024), `icon-512.png`, `icon-180.png`, `splash.png` (2732×2732) |
| `capacitor.config.json` | App id, name, background color, no web-view scrolling |
| `package.json` | Capacitor 7 (core, iOS, Android, Haptics) and the asset generator |

## Try it on a phone first

```bash
cd games/age-of-warriors/app
node build.mjs
npx http-server www -p 8080     # then open http://<your-computer-ip>:8080 on the phone
```

## Build the iOS app

You need a Mac with Xcode, and an [Apple Developer Program](https://developer.apple.com/programs/) membership (US$99 a year) to ship.

```bash
cd games/age-of-warriors/app
npm install
npm run ios:add          # builds www/ and creates the ios/ Xcode project
npm run assets           # generates every icon and splash size from resources/
npm run ios:open         # opens Xcode
```

In Xcode:

1. Set your Team and a unique Bundle Identifier (also change `appId` in `capacitor.config.json`, for example `com.yourname.dawnofwar`).
2. Under General → Deployment Info, untick Portrait so the game runs in landscape only.
3. Under Info, add `UIStatusBarHidden` = YES and `UIViewControllerBasedStatusBarAppearance` = NO for a full-screen game.
4. Run on a real iPhone. Check performance; the game lowers its effects automatically if it drops below 24 fps.
5. Product → Archive → Distribute App → App Store Connect.

After any change to the game, run `npm run ios:sync` to copy it into the app.

Android works the same way with `npm run android:add` and Android Studio.

## Before you submit: things that will block or risk review

1. **"Deadliest Warrior" is someone else's brand.** It is a Spike TV / Paramount show. The game uses the name, episode matchups and results, and calls a mode the "Deadliest Warrior simulator". App Store Review Guideline 5.2 (intellectual property) will likely reject this without a license. Before submitting, rename the simulator, remove the show name, and drop the "S1 · vs …" episode records, or get written permission from the rights holder.
2. **"Dawn of War" is an existing trademark.** *Warhammer 40,000: Dawn of War* is a well-known strategy game series (Games Workshop, published by SEGA/Relic). An app with the same title is likely to be flagged under Guideline 5.2 and could draw a trademark complaint. Search the USPTO and App Store before committing to the name, or pick a distinct variant.
3. **Real people.** Historical figures (Napoleon, Genghis Khan, Al Capone) are generally fine. Keep descriptions factual and respectful.
4. **Fonts load from Google Fonts.** Offline, the app falls back to system fonts. To bundle them, download the Teko, Orbitron and IBM Plex Sans Condensed / Mono files (SIL Open Font License) into `www/fonts` and swap the `<link>` for `@font-face` rules.
5. **Privacy.** The game stores only records, achievements and the effects setting on the device (`localStorage`). It sends nothing anywhere, so the App Privacy label is "Data Not Collected".
6. **Age rating.** The game shows blood by default (sprays, pools, glowing alien ichor). With blood on, answer "Frequent/Intense Cartoon or Fantasy Violence" in the age-rating questionnaire, which usually lands at 12+; if you add more realistic gore it can rise to 17+. Players can switch it off under Menu → Blood. To ship a gentler build, change the default in `game.js` (`let BLOOD = true`).
7. **Screenshots.** App Store Connect needs at least one set for 6.9" iPhones (2868×1320 in landscape) and iPads if you support them.
8. **Minimum functionality (Guideline 4.2).** A full offline game qualifies. Keep it free of links that leave the app.

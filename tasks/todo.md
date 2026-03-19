# FXP20-WINDOWS: Standalone JPOS RFID Reader Application

## TODO

- [x] 1. Create directory structure: middleware/, java-bridge/, web-client/, jpos-driver/
- [x] 2. Copy JPOS driver JARs and config into jpos-driver/
- [x] 3. Create middleware with JPOS as default reader mode (no serialport dep)
- [x] 4. Create Java bridge (FXP20Bridge.java) with stdin command support
- [x] 5. Create web client using WebSocket (middleware mode, not WebSerial)
- [x] 6. Create Windows batch scripts (setup, start, start-mock)
- [x] 7. Verify middleware starts in mock mode
- [x] 8. Verify API endpoints respond correctly
- [x] 9. Verify Java bridge compiles
- [x] 10. Create README.md
- [x] 11. Debug JPOS driver — fix ArrayIndexOutOfBoundsException and Unhandled exception
- [x] 12. Get readTags working — correct password (4 zero bytes), exact demo initialization sequence
- [x] 13. Get tag data output — use firstTag()/nextTag()/getCurrentTagID() cursor pattern
- [ ] 14. Test full stack end-to-end (middleware + web client)

---

## Compact UI Redesign (v1.0.7)

### Goal
Make the UI more compact and intuitive. Reduce wasted space, merge controls into fewer rows, tighter padding.

### Plan

- [x] 1. **Merge stats into header as inline chips** — replaced 3 bordered stat cards with compact inline stat pills
- [x] 2. **Move controls into a slim toolbar** — removed the bordered "control card", merged into slim toolbar strip
- [x] 3. **Reduce header padding** — tighter header (0.5rem), smaller logo (24px), smaller gaps
- [x] 4. **Tighten table spacing** — cell padding reduced to 0.45rem, smaller font sizes
- [x] 5. **Shrink filter/actions bar** — compact filter input (200px), smaller export buttons
- [x] 6. **Bump version to 1.0.7 and rebuild installer**

### Changes made

| File | What changed |
|------|-------------|
| `App.tsx` | Replaced 3 stat cards with inline `stat-pill` elements. Replaced separate `control-card` section with a `toolbar` strip. Simplified header to single row: logo + version badge + status pill + stats + icon buttons. Removed Refresh button (status auto-polls). Shortened button labels ("Clear" not "Clear Tags"). |
| `App.css` | Full rewrite for compactness: header padding 0.5rem (was 1rem), table cell padding 0.45rem (was 1rem), smaller font sizes throughout, new `.toolbar` / `.stat-pill` / `.icon-btn` styles, removed `.stat-card` / `.control-card` styles. CSS size reduced from 14.88 KB to 13.31 KB. |
| `ControlsPanel.tsx` | Shortened labels ("Start" / "Stop" / "Init..."), smaller icon sizes (14px), added `btn-sm` class, removed standalone Refresh button. |
| `TagTable.tsx` | Smaller filter input (200px), smaller icons (13-14px), removed inline paddingLeft style. |
| `package.json` | Version bumped to 1.0.7. |

### Build output

- **Installer**: `release/FXP20 RFID Reader Setup 1.0.7.exe`

---

## Auto-Update + Copy EPC (v1.0.8)

### What was done

Added GitHub Releases auto-update and EPC clipboard copy.

### Changes

| File | What changed |
|------|-------------|
| `electron/main.ts` | Added `electron-updater` integration: checks GitHub Releases on startup, exposes `/api/update-status`, `/api/update-download`, `/api/update-install` endpoints. |
| `web-client/src/App.tsx` | Added update banner (polls `/api/update-status` every 60s), shows Download/Install buttons. Added copy EPC to release notes v1.0.8. |
| `web-client/src/App.css` | Added `.update-banner`, `.update-btn`, `.update-dismiss`, `.copy-btn` styles. |
| `web-client/src/components/TagTable.tsx` | Added clipboard copy button next to each EPC (appears on row hover, shows checkmark briefly after copying). |
| `package.json` | Bumped to 1.0.8. Added `publish` config pointing to `github/Mr-bgrand/FXP20-WINDOWS`. Added `electron-updater` dependency. |

### Release workflow

1. Bump version, rebuild: `npm run electron:build`
2. Create GitHub Release (e.g. `v1.0.8`), attach `FXP20 RFID Reader Setup 1.0.8.exe` and `latest.yml` from `release/`
3. Existing app installs detect the new version on next launch

---

## Review

### What was built

A standalone Windows application in `FXP20-WINDOWS/` that reads RFID tags from a Zebra FXP20 using the native JPOS driver. The architecture is:

**FXP20 (USB) → Zebra JPOS Driver → Java Bridge → Node.js Middleware → WebSocket → React Web Client**

### JPOS Driver Debugging (items 11-13)

The Zebra JPOS driver v3.0.9 has several quirks that required careful reverse-engineering:

| Problem | Root Cause | Fix |
|---------|-----------|-----|
| Thread-2 crash during open() | Driver's InventoryOperations starts before antennas are enumerated | Harmless — ignore and continue, driver recovers |
| "Invalid Password" on readTags | Passing `null` or `new byte[0]` for password | Use `new byte[] {0,0,0,0}` (default Gen2 access password) |
| "Unhandled exception" on readTags | Passing `null` causes NPE inside driver | Same fix as above |
| No tag data output | Tried DataEvent callbacks (wrong approach) | Use `firstTag()`/`nextTag()`/`getCurrentTagID()` cursor pattern |
| Missing JCoreLoggerSetup | Demo app calls it before anything else | Added `JCoreLoggerSetup.SetUp()` to main() |

**Key finding from decompiling Zebra demo app (`javap`):**
- Demo uses `cmd=16` (RT_ID), `start=0`, `length=0`, `timeout=3000`, empty filterID/filterMask
- Tags are navigated via cursor pattern: `firstTag()` → `getCurrentTagID()` → `nextTag()`
- `claim(1000)` then `setDeviceEnabled(true)` then add all 4 listeners then `setDataEventEnabled(true)`
- Both `readTags` (timer-based) and `startReadTags`/`stopReadTags` (continuous) work

### Verified with hardware

- **10 RFID tags read successfully** via `readTags` (timer-based, 3s timeout)
- **10 RFID tags read successfully** via `startReadTags`/`stopReadTags` (continuous inventory)
- EPCs like `E28011700000021A7EAE452A` output as valid JSON

### Next steps

1. Test full stack end-to-end (middleware → web client)
2. Add RSSI parsing (currently 0 — need to check JPOS API for RSSI data)
3. Tune read timeout and continuous loop interval for optimal performance

---

## Electron Packaging Review (2026-03-19)

### What was done

Packaged the FXP20 RFID Reader as a self-contained Windows desktop app using Electron.

### Changes made

| Area | What changed |
|------|-------------|
| `electron/main.ts` | New Electron main process — starts Express middleware in-process, opens BrowserWindow to localhost:4000, system tray with show/quit, single instance lock |
| `electron/preload.ts` | Minimal preload exposing `isElectron` flag to renderer |
| `package.json` (root) | New root package.json for Electron app with build scripts and electron-builder config |
| `tsconfig.electron.json` | TypeScript config for compiling Electron code to `dist-electron/` |
| `middleware/src/reader/fxp20JposReader.ts` | Updated `spawnBridge()` to use `RESOURCE_PATH` and `JAVA_CMD` env vars so it finds bundled JRE and java-bridge when running inside packaged Electron app |
| `web-client/vite.config.ts` | Added `base: './'` so built assets load correctly when served by Express (not Vite dev server) |
| `web-client/src/config.ts` | Auto-detects API/WS URLs from `window.location.origin` instead of hardcoded localhost — works in both dev and Electron |
| `java-bridge/FXP20Bridge.java` | Added `getCurrentTagUserData()` probe to check if RSSI data is available (it's not — standard JPOS doesn't expose it) |
| `resources/jre/` | Downloaded Adoptium Temurin JRE 17.0.18 (41 MB) — bundled as extraResource, gitignored |
| `.gitignore` | Added `dist-electron/`, `release/`, `resources/jre/` |

### Build output

- **Installer**: `release/FXP20 RFID Reader Setup 1.0.0.exe` (113 MB)
- **Unpacked app**: `release/win-unpacked/` with bundled JRE, java-bridge .class files, JPOS driver JARs
- No code signing (skipped — can be added later with a certificate)

### Build commands

```bash
npm run build:all          # Build web client + middleware + electron
npm run electron:dev       # Build all then launch Electron in dev mode
npm run electron:build     # Build all then create Windows NSIS installer
```

### Architecture

```
Electron Main Process (Node.js)
  ├── Express middleware (in-process, port 4000)
  ├── WebSocket server (same port, /ws/tags path)
  ├── Spawns java.exe from bundled JRE
  │     └── FXP20Bridge.class ↔ JPOS Driver ↔ FXP20 USB
  └── BrowserWindow loads http://localhost:4000
        └── Serves pre-built React app (Vite output)
```

### What users see

1. Download `FXP20 RFID Reader Setup 1.0.0.exe`
2. Run installer (standard Windows NSIS — choose install location)
3. Launch from Start Menu or Desktop shortcut
4. App window shows the RFID reader UI — plug in FXP20 and click Start

### RSSI finding

The standard JPOS `RFIDScanner` interface does not expose RSSI. Added a `getCurrentTagUserData()` probe — with `cmd=16` (ID-only mode), user data returns empty. RSSI is RF signal metadata, not tag-stored data.

### Remaining work

- Add custom icon (currently uses default Electron icon)
- Auto-update mechanism (electron-updater or manual version check)
- Test installer on clean Windows machine without dev tools
- Code signing with a certificate for SmartScreen trust

---

## Driver Bundling + RSSI + Beep Review (v1.0.5)

### Key findings

| Item | Finding |
|------|---------|
| **Separate driver install?** | NOT needed. The JPOS JAR bundles `jSerialComm.dll` inside itself (extracted at runtime). Our installer already ships everything. |
| **RSSI** | Available via `RFIDScannerService115Impl.tagStore` (public static Hashtable). Each `rfid.api.TagData` has `getPeakRSSI()` returning a short. |
| **Hardware beep** | Available via `rfid.api.Config.beep(duration, mute, occurrences, volume)`. Accessed via reflection since it's on a private field. |
| **Antenna ID** | Also available from `rfid.api.TagData.getAntennaID()`. |

### Changes in v1.0.5

| File | Change |
|------|--------|
| `FXP20Bridge.java` | `iterateAndOutputTags()` now looks up each tag in `RFIDScannerService115Impl.tagStore` to get RSSI and antenna ID. Output JSON now includes real `rssi` and `antenna` values. |
| `FXP20Bridge.java` | Added `beep()` method using reflection to reach `myReader.Config.beep()`. Sends 200ms HIGH beep. |
| `FXP20Bridge.java` | Added `BEEP` command to stdin command loop. |

### How it works (RSSI)

The JPOS `readTags()` call internally populates a static `Hashtable<String, rfid.api.TagData>` keyed by EPC hex string. After `readTags()` + `getTagCount()`, we iterate via the JPOS cursor (`firstTag`/`nextTag`/`getCurrentTagID`) as before, but now also look up each EPC in the tag store to get `getPeakRSSI()` and `getAntennaID()`.

---

## RSSI Improvements + RSSI Filter (v1.0.10)

### What was done

Adjusted RSSI signal bar thresholds so typical RFID read values (-60 to -70 dBm) appear as decent signals instead of weak. Added a minimum RSSI filter input so users can hide weak reads.

### Changes

| File | Change |
|------|--------|
| `web-client/src/components/TagTable.tsx` | Shifted `getRssiClass` thresholds: strong >= -55 (was -40), medium >= -70 (was -55). Shifted `getRssiLevel` bars: 5 bars >= -45 (was -30), 4 >= -55, 3 >= -65, 2 >= -75, 1 otherwise. Added `rssiFilter` state and `Signal` icon. Added RSSI filter input next to EPC filter. Filter logic now excludes tags below the typed RSSI threshold. |
| `web-client/src/App.css` | Added `.rssi-filter-wrapper .filter-input { width: 150px }` for narrower RSSI input. |
| `web-client/src/App.tsx` | Bumped `APP_VERSION` to 1.0.10. Added v1.0.10 release notes entry. |
| `package.json` | Bumped version to 1.0.10. |

### Release

- Built and pushed to GitHub
- Created release v1.0.10 with correctly named `FXP20-RFID-Reader-Setup-1.0.10.exe` and `latest.yml`
- Fixed filename mismatch (GitHub converts spaces to dots, but `latest.yml` uses hyphens — uploaded with hyphenated filename to match)

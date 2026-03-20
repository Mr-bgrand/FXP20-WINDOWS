# FXP20 RFID Reader

A standalone Windows desktop application for the **Zebra FXP20 RFID reader**. Plug in the reader, install the app, and start scanning tags — no drivers or additional software required.

## Download & Install

1. **Download the latest installer:**

   **[Download FXP20 RFID Reader](https://github.com/Mr-bgrand/FXP20-WINDOWS/releases/latest)**

   Click the `.exe` file to download.

2. **Run the installer** — Windows SmartScreen may show a warning. Click **"More info"** → **"Run anyway"**.

3. **Connect your Zebra FXP20** via USB.

4. **Launch the app** from the desktop shortcut or Start Menu.

That's it. Everything is bundled — no Java, Node.js, or driver installs needed.

## Features

- **Real-time tag scanning** — see EPC, read count, RSSI signal strength, and antenna
- **Continuous firmware inventory** — fast scanning across all antenna ports
- **RSSI signal bars** — visual signal strength indicator for each tag
- **RSSI filter** — hide weak reads by setting a minimum threshold (e.g. `-75`)
- **EPC display** — toggle between HEX and ASCII, copy to clipboard
- **Export** — save tag data as CSV or JSON
- **Antenna configuration** — per-antenna power control, custom nicknames
- **Auto-updates** — checks for new versions and installs from the app
- **Light/dark theme**
- **Beep on new tag** — audible notification when a new unique tag is detected
- **Launch at startup** — optional Windows startup toggle

## Using the App

1. Click **Connect** to connect to the middleware
2. Click **Start** to begin scanning
3. Tags appear in real time in the table
4. Click **Stop** to pause, **Clear** to reset

### Filtering

| Filter | How to use |
|--------|-----------|
| EPC filter | Type in the search box to match EPCs |
| RSSI filter | Type a value like `-75` to hide weak signals |

### Antennas Tab

- View all 4 antenna ports with transmit power sliders
- Click an antenna name to rename it (e.g. "Dock Door", "Conveyor")
- Green dot shows which antennas are actively reading tags

### Automatic Updates

The app checks for updates on startup and periodically. When available, a banner appears at the top. You can also click the **download arrow icon** in the header to check manually.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot connect to middleware" | Close and reopen the app |
| Reader not detected | Unplug/replug the USB cable, restart the app |
| SmartScreen blocks installer | Click "More info" → "Run anyway" |
| Tags not appearing | Make sure you clicked both **Connect** and **Start** |
| External antennas not reading | Check physical connections to the FXP20 |

## System Requirements

- Windows 10 or later
- USB port for Zebra FXP20 reader

---

## For Developers

<details>
<summary>Development setup and architecture</summary>

### Architecture

```
Electron Main Process (Node.js)
  ├── Express middleware (in-process, port 4000)
  ├── WebSocket server (/ws/tags)
  ├── Spawns java.exe from bundled JRE
  │     └── FXP20Bridge.class ↔ JPOS Driver ↔ FXP20 USB
  └── BrowserWindow loads http://localhost:4000
        └── Serves pre-built React app
```

### Prerequisites

- Node.js 18+
- Java JDK 17+

### Development

```bash
# Install dependencies
npm install

# Run full stack in dev mode
npm run dev

# Build Electron installer
npm run electron:build
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/reader/status` | Reader status |
| POST | `/reader/start` | Start inventory |
| POST | `/reader/stop` | Stop inventory |
| GET | `/reader/antennas` | Get antenna config |
| POST | `/reader/antennas` | Set antenna power |
| WS | `/ws/tags` | Real-time tag stream |

### Project Structure

```
FXP20-WINDOWS/
  electron/           Electron main process
  middleware/          Node.js middleware (Express + WebSocket)
  web-client/          React frontend (Vite)
  java-bridge/         Java JPOS bridge
  jpos-driver/         Zebra JPOS driver JARs (bundled)
  resources/jre/       Bundled JRE 17 (gitignored)
```

</details>

---

*Built by [Mobi Solutions Inc.](https://mobisolutionsinc.com) — Powered by [Arrowhead](https://arrowheadcorp.com)*

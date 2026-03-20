# FXP20 RFID Reader — Installation Guide

## Download

Download the latest installer from GitHub:

**https://github.com/Mr-bgrand/FXP20-WINDOWS/releases/latest**

Click the `.exe` file (e.g. `FXP20-RFID-Reader-Setup-1.0.16.exe`) to download.

---

## Installation

1. Run the downloaded `.exe` installer
2. Windows SmartScreen may show a warning — click **"More info"** then **"Run anyway"** (the app is not code-signed yet)
3. Choose your install location (or keep the default)
4. Click **Install**
5. The app will launch automatically after installation

A desktop shortcut and Start Menu entry are created automatically.

---

## Hardware Setup

1. Connect the **Zebra FXP20 RFID reader** to your PC via USB
2. Windows will detect the device automatically — no separate driver install is needed
3. Launch **FXP20 RFID Reader** from the desktop shortcut or Start Menu

---

## Using the App

### Connect & Start Reading

1. Click **Connect** to connect to the reader
2. Click **Start** to begin scanning for RFID tags
3. Tags appear in real time in the table with EPC, read count, RSSI signal strength, and antenna

### Stop & Disconnect

- Click **Stop** to pause scanning
- Click **Disconnect** to disconnect from the reader
- Click **Clear** to clear all tags from the table

### Filtering

- **Filter EPC** — Type in the search box to filter tags by EPC
- **Min RSSI** — Type a value like `-75` to hide tags with weak signal (only show tags stronger than that threshold)

### EPC Display

- Click the **ASCII/HEX** toggle to switch between hexadecimal and ASCII display of EPCs
- Click the **copy icon** next to any EPC to copy it to clipboard

### Export

- Click **CSV** or **JSON** to export the current tag list

### Antennas

- Click the **Antennas** tab to view and configure antenna settings
- Adjust transmit power per antenna using the slider
- Click an antenna name to rename it (e.g. "Dock Door", "Conveyor")
- Custom names appear in the Tags table antenna column
- A green dot indicates which antennas are actively reading tags

---

## Settings (Header Icons)

| Icon | Function |
|------|----------|
| ↓ (Download arrow) | Check for app updates |
| ⏻ (Power) | Toggle launch at Windows startup |
| 🔊 / 🔇 | Toggle beep sound on new tag |
| ☀ / 🌙 | Toggle light/dark theme |

---

## Automatic Updates

The app checks for updates automatically. When an update is available:

1. A blue banner appears at the top of the app
2. Click **Download** to download the update
3. Click **Restart & Update** to install and restart

You can also manually check by clicking the **download arrow icon** in the top-right header.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot connect to middleware" | Close and reopen the app |
| Reader not detected | Unplug and replug the USB cable, then restart the app |
| SmartScreen blocks installer | Click "More info" → "Run anyway" |
| Tags not appearing | Make sure you clicked both **Connect** and **Start** |
| External antennas not reading | Check that external antennas are physically connected to the FXP20 |

---

## System Requirements

- Windows 10 or later
- USB port for Zebra FXP20 reader
- No additional software or drivers required — everything is bundled in the installer

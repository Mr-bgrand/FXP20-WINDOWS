# FXP20-WINDOWS

Standalone Windows application for the Zebra FXP20 RFID reader using the native JPOS driver.

## Architecture

```
FXP20 Reader (USB)
    |  Zebra JPOS Driver (Java)
    v
Java Bridge (FXP20Bridge.java)
    |  JSON via stdout
    v
Node.js Middleware (Express + WebSocket, port 4000)
    |  WebSocket /ws/tags
    v
React Web Client (Vite, port 3000)
```

## Prerequisites

- **Java JDK 17+** — [Adoptium](https://adoptium.net/) or Oracle JDK
- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **Zebra FXP20** connected via USB

## Quick Start

```bat
REM 1. Run setup (installs deps, builds Java bridge)
setup.bat

REM 2. Start everything (middleware + web client)
start.bat

REM 3. Open browser to http://localhost:3000
```

## Scripts

| Script | Description |
|--------|-------------|
| `setup.bat` | Install all dependencies and build Java bridge |
| `start.bat` | Start middleware (JPOS) + web client |
| `start-mock.bat` | Start with simulated tags (no hardware needed) |
| `start-middleware.bat` | Start middleware only |
| `start-webclient.bat` | Start web client only |

## Testing Without Hardware

Run `start-mock.bat` to use simulated tag reads. The web client will show fake tags streaming in real time — useful for UI development and testing.

## Project Structure

```
FXP20-WINDOWS/
  middleware/         Node.js middleware server
    src/
      index.ts        Entry point
      config.ts       Configuration (.env)
      logger.ts       Winston logger
      reader/
        readerInterface.ts   TagRead type + ReaderInterface
        mockReader.ts        Simulated tags for testing
        fxp20JposReader.ts   JPOS bridge integration
      server/
        httpServer.ts   REST API (start/stop/status)
        wsServer.ts     WebSocket tag streaming
  java-bridge/        Java JPOS bridge
    FXP20Bridge.java  Connects to FXP20 via JPOS, outputs JSON
    jpos.xml          JPOS device config
    build.bat         Compile Java bridge
    run.bat           Run bridge standalone
  jpos-driver/        Zebra JPOS driver (bundled)
    lib/              JAR files
    jpos.xml          Driver config
  web-client/         React web client
    src/
      App.tsx         Main app with tag aggregation
      hooks/useWebSocket.ts   WebSocket connection
      components/
        TagTable.tsx         Tag display with filtering + export
        ControlsPanel.tsx    Start/stop inventory controls
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/reader/status` | Reader running status |
| POST | `/reader/start` | Start RFID inventory |
| POST | `/reader/stop` | Stop RFID inventory |
| WS | `/ws/tags` | Real-time tag stream |

## Configuration

Edit `middleware/.env`:

```env
READER_MODE=fxp20-jpos   # or "mock" for testing
READER_ID=FXP20-01
PORT=4000
LOG_LEVEL=info
```

Antenna power is configured in `java-bridge/jpos.xml` (antennaPower property, default 270).

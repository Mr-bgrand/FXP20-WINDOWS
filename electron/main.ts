import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = 4000;
const isDev = !app.isPackaged;

let updateStatus: { available: boolean; version?: string; downloading?: boolean; downloaded?: boolean; error?: string } = { available: false };

const logLines: string[] = [];
const MAX_LOG_LINES = 500;
const _origConsoleLog = console.log.bind(console);
const _origConsoleError = console.error.bind(console);
const _origConsoleWarn = console.warn.bind(console);

function appLog(msg: string) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}`;
    logLines.push(line);
    if (logLines.length > MAX_LOG_LINES) logLines.shift();
    _origConsoleLog(line);

    try {
        const logDir = path.join(app.getPath('userData'), 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        fs.appendFileSync(path.join(logDir, 'app.log'), line + '\n');
    } catch { /* ignore */ }
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let httpServer: http.Server | null = null;
let reader: any = null;

function getResourcePath(...parts: string[]): string {
    if (isDev) {
        return path.join(__dirname, '..', ...parts);
    }
    return path.join(process.resourcesPath, ...parts);
}

function getJavaPath(): string {
    if (isDev) {
        const javaHome = process.env.JAVA_HOME;
        if (javaHome) return path.join(javaHome, 'bin', 'java.exe');
        return 'java';
    }
    return path.join(process.resourcesPath, 'jre', 'bin', 'java.exe');
}

function createReader() {
    const readerMode = process.env.READER_MODE || 'fxp20-jpos';

    if (readerMode === 'mock') {
        const { MockReader } = require(getMiddlewarePath('reader/mockReader'));
        return new MockReader();
    }

    const { FXP20JposReader } = require(getMiddlewarePath('reader/fxp20JposReader'));
    return new FXP20JposReader();
}

function getMiddlewarePath(subpath: string): string {
    if (isDev) {
        return path.join(__dirname, '..', 'middleware', 'dist', subpath);
    }
    return path.join(__dirname, '..', 'middleware', 'dist', subpath);
}

function startMiddleware(): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            process.env.JAVA_CMD = getJavaPath();
            process.env.RESOURCE_PATH = isDev ? path.join(__dirname, '..') : process.resourcesPath;

            appLog(`isDev: ${isDev}`);
            appLog(`JAVA_CMD: ${process.env.JAVA_CMD}`);
            appLog(`RESOURCE_PATH: ${process.env.RESOURCE_PATH}`);
            appLog(`__dirname: ${__dirname}`);
            appLog(`resourcesPath: ${process.resourcesPath}`);
            appLog(`userData: ${app.getPath('userData')}`);

            const javaExists = fs.existsSync(process.env.JAVA_CMD);
            appLog(`Java executable exists: ${javaExists}`);

            const bridgePath = path.join(process.env.RESOURCE_PATH, 'java-bridge');
            const bridgeClassExists = fs.existsSync(path.join(bridgePath, 'FXP20Bridge.class'));
            const jposXmlExists = fs.existsSync(path.join(bridgePath, 'jpos.xml'));
            appLog(`Bridge path: ${bridgePath}`);
            appLog(`FXP20Bridge.class exists: ${bridgeClassExists}`);
            appLog(`jpos.xml exists: ${jposXmlExists}`);

            const jposLibPath = path.join(process.env.RESOURCE_PATH, 'jpos-driver', 'lib');
            const jposLibExists = fs.existsSync(jposLibPath);
            appLog(`JPOS lib path: ${jposLibPath}, exists: ${jposLibExists}`);
            if (jposLibExists) {
                const jars = fs.readdirSync(jposLibPath).filter(f => f.endsWith('.jar'));
                appLog(`JPOS JARs: ${jars.join(', ')}`);
            }

            console.log = (...args: any[]) => { appLog(args.map(String).join(' ')); };
            console.error = (...args: any[]) => { appLog('[ERROR] ' + args.map(String).join(' ')); };
            console.warn = (...args: any[]) => { appLog('[WARN] ' + args.map(String).join(' ')); };

            reader = createReader();

            const expressApp = express();
            expressApp.use(cors());
            expressApp.use(express.json());

            const webClientPath = isDev
                ? path.join(__dirname, '..', 'web-client', 'dist')
                : path.join(__dirname, '..', 'web-client', 'dist');

            expressApp.use(express.static(webClientPath));

            expressApp.get('/health', (_req, res) => {
                res.json({ status: 'ok', timestamp: new Date().toISOString() });
            });

            expressApp.post('/reader/start', async (_req, res) => {
                try {
                    await reader.startInventory();
                    res.json({ success: true, message: 'Inventory started' });
                } catch (error: any) {
                    res.status(500).json({ success: false, message: error.message });
                }
            });

            expressApp.post('/reader/stop', async (_req, res) => {
                try {
                    await reader.stopInventory();
                    res.json({ success: true, message: 'Inventory stopped' });
                } catch (error: any) {
                    res.status(500).json({ success: false, message: error.message });
                }
            });

            expressApp.get('/reader/status', async (_req, res) => {
                try {
                    const status = await reader.getStatus();
                    res.json(status);
                } catch (error: any) {
                    res.status(500).json({ success: false, message: error.message });
                }
            });

            expressApp.get('/reader/antennas', async (_req, res) => {
                try {
                    if (reader.getAntennaConfig) {
                        const antennas = await reader.getAntennaConfig();
                        res.json({ antennas });
                    } else {
                        res.json({ antennas: [] });
                    }
                } catch (error: any) {
                    res.status(500).json({ success: false, message: error.message });
                }
            });

            expressApp.post('/reader/antennas', async (req, res) => {
                try {
                    const { antennaId, power } = req.body;
                    if (reader.setAntennaPower) {
                        await reader.setAntennaPower(antennaId, power);
                        res.json({ success: true, message: `Antenna ${antennaId} power set to ${power}` });
                    } else {
                        res.status(400).json({ success: false, message: 'Antenna power control not supported' });
                    }
                } catch (error: any) {
                    res.status(500).json({ success: false, message: error.message });
                }
            });

            expressApp.get('/debug/logs', (_req, res) => {
                res.type('text/plain').send(logLines.join('\n'));
            });

            expressApp.get('/api/update-status', (_req, res) => {
                res.json({ ...updateStatus, currentVersion: app.getVersion() });
            });

            expressApp.post('/api/update-download', (_req, res) => {
                if (!updateStatus.available) {
                    return res.json({ success: false, message: 'No update available' });
                }
                autoUpdater.downloadUpdate().catch(() => {});
                res.json({ success: true, message: 'Download started' });
            });

            expressApp.post('/api/update-install', (_req, res) => {
                if (!updateStatus.downloaded) {
                    return res.json({ success: false, message: 'Update not downloaded yet' });
                }
                res.json({ success: true, message: 'Installing update, app will restart...' });
                setTimeout(() => autoUpdater.quitAndInstall(false, true), 1000);
            });

            expressApp.get('*', (_req, res) => {
                res.sendFile(path.join(webClientPath, 'index.html'));
            });

            httpServer = http.createServer(expressApp);

            const wss = new WebSocketServer({ server: httpServer, path: '/ws/tags' });
            const clients = new Set<WebSocket>();

            reader.onTagRead((tag: any) => {
                const message = JSON.stringify(tag);
                clients.forEach((client: WebSocket) => {
                    if (client.readyState === WebSocket.OPEN) {
                        try { client.send(message); } catch { /* ignore */ }
                    }
                });
            });

            wss.on('connection', (ws: WebSocket) => {
                clients.add(ws);
                ws.send(JSON.stringify({
                    type: 'connected',
                    timestamp: new Date().toISOString(),
                    message: 'Connected to FXP20 tag stream',
                }));
                ws.on('close', () => clients.delete(ws));
            });

            httpServer.listen(PORT, () => {
                console.log(`Middleware running on http://localhost:${PORT}`);
                resolve();
            });

            httpServer.on('error', (err: any) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`Port ${PORT} in use, assuming middleware already running`);
                    resolve();
                } else {
                    reject(err);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

function setupAutoUpdater() {
    if (isDev) {
        appLog('Skipping auto-updater in dev mode');
        return;
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
        appLog(`Update available: v${info.version}`);
        updateStatus = { available: true, version: info.version };
    });

    autoUpdater.on('update-not-available', () => {
        appLog('App is up to date');
    });

    autoUpdater.on('download-progress', (progress) => {
        appLog(`Download progress: ${Math.round(progress.percent)}%`);
        updateStatus = { ...updateStatus, downloading: true };
    });

    autoUpdater.on('update-downloaded', (info) => {
        appLog(`Update downloaded: v${info.version}`);
        updateStatus = { available: true, version: info.version, downloaded: true, downloading: false };
    });

    autoUpdater.on('error', (err) => {
        appLog(`Auto-updater error: ${err.message}`);
        updateStatus = { available: false, error: err.message };
    });

    autoUpdater.checkForUpdates().catch((err) => {
        appLog(`Update check failed: ${err.message}`);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'FXP20 RFID Reader',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        show: false,
    });

    mainWindow.loadURL(`http://localhost:${PORT}`);

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    mainWindow.on('close', (event) => {
        if (tray) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    if (isDev) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
}

function createTray() {
    const iconPath = isDev
        ? path.join(__dirname, '..', 'resources', 'icon.png')
        : path.join(process.resourcesPath, 'icon.png');

    let trayIcon: Electron.NativeImage;
    try {
        trayIcon = nativeImage.createFromPath(iconPath);
    } catch {
        trayIcon = nativeImage.createEmpty();
    }

    tray = new Tray(trayIcon);
    tray.setToolTip('FXP20 RFID Reader');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show Window',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                } else {
                    createWindow();
                }
            },
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                tray?.destroy();
                tray = null;
                app.quit();
            },
        },
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });

    app.on('ready', async () => {
        try {
            await startMiddleware();
            createTray();
            createWindow();
            setupAutoUpdater();
        } catch (error) {
            console.error('Failed to start:', error);
            app.quit();
        }
    });

    app.on('window-all-closed', () => {
        // Keep running in tray on Windows
    });

    app.on('before-quit', async () => {
        if (reader) {
            try { await reader.shutdown(); } catch { /* ignore */ }
        }
        if (httpServer) {
            httpServer.close();
        }
    });
}

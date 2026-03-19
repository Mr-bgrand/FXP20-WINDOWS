import { useEffect, useState, useRef, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { TagTable } from './components/TagTable';
import { ControlsPanel } from './components/ControlsPanel';
import { TagInfo, ReaderStatus } from './types';
import { config } from './config';
import {
  Wifi, WifiOff, Trash2, Radio, Activity, Hash, Zap, Sun, Moon, Loader, Volume2, VolumeX, Info, X, Download, RefreshCw,
} from 'lucide-react';
import './App.css';

type Theme = 'dark' | 'light';

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('rfid-theme') as Theme) || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rfid-theme', theme);
  }, [theme]);

  return { theme, toggleTheme: () => setTheme((p) => (p === 'dark' ? 'light' : 'dark')) };
}

const APP_VERSION = '1.0.8';

const RELEASE_NOTES: { version: string; date: string; changes: string[] }[] = [
  {
    version: '1.0.8',
    date: '2026-03-19',
    changes: [
      'Auto-update from GitHub Releases — checks on startup, download + install from UI',
      'Copy EPC to clipboard button on each tag row',
    ],
  },
  {
    version: '1.0.7',
    date: '2026-03-19',
    changes: [
      'Compact UI redesign — tighter header, inline stat pills, slim toolbar',
      'Controls merged into single toolbar strip',
      'Reduced padding and font sizes throughout for more data density',
    ],
  },
  {
    version: '1.0.6',
    date: '2026-03-19',
    changes: [
      'Full antenna power (27 dBm) enabled by default',
      'Added release notes viewer',
      'Version displayed in header',
    ],
  },
  {
    version: '1.0.5',
    date: '2026-03-19',
    changes: [
      'Real RSSI values from hardware (via internal tag store)',
      'Real antenna ID from hardware',
      'Hardware beep support (BEEP command in bridge)',
      'No separate driver install needed for customers',
    ],
  },
  {
    version: '1.0.4',
    date: '2026-03-19',
    changes: [
      'Audible beep on new unique tag (with mute toggle)',
      'HEX/ASCII toggle for EPC display',
      'Faster tag reporting (500ms timeout, 100ms cycle)',
      'Simplified Connect button label',
    ],
  },
  {
    version: '1.0.3',
    date: '2026-03-19',
    changes: [
      'Reader error messages shown in UI (e.g. USB not connected)',
      'Header shows "Reader Error" state',
    ],
  },
  {
    version: '1.0.2',
    date: '2026-03-19',
    changes: [
      'Fixed crash on startup (console log recursion)',
      'Added diagnostic logging to file and /debug/logs endpoint',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-03-19',
    changes: [
      'Initial Electron desktop app release',
      'Bundled JRE, JPOS driver, Java bridge',
      'Windows NSIS installer',
      'WebSocket tag streaming with React UI',
    ],
  },
];

let audioCtx: AudioContext | null = null;
function playBeep() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 1200;
    gain.gain.value = 0.15;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    osc.stop(audioCtx.currentTime + 0.08);
  } catch { /* ignore audio errors */ }
}

function App() {
  const { theme, toggleTheme } = useTheme();
  const ws = useWebSocket();
  const [tags, setTags] = useState<Map<string, TagInfo>>(new Map());
  const [totalReads, setTotalReads] = useState(0);
  const [readsPerSecond, setReadsPerSecond] = useState(0);
  const [readerStatus, setReaderStatus] = useState<ReaderStatus | null>(null);
  const lastReadCountRef = useRef(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ available: boolean; version?: string; downloading?: boolean; downloaded?: boolean } | null>(null);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch(`${config.apiUrl}/api/update-status`);
        const data = await res.json();
        if (data.available) setUpdateInfo(data);
      } catch { /* ignore */ }
    };
    checkUpdate();
    const interval = setInterval(checkUpdate, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateDownload = async () => {
    try {
      await fetch(`${config.apiUrl}/api/update-download`, { method: 'POST' });
      setUpdateInfo(prev => prev ? { ...prev, downloading: true } : prev);
    } catch { /* ignore */ }
  };

  const handleUpdateInstall = async () => {
    try {
      await fetch(`${config.apiUrl}/api/update-install`, { method: 'POST' });
    } catch { /* ignore */ }
  };

  // Reads per second counter
  useEffect(() => {
    const interval = setInterval(() => {
      setReadsPerSecond(totalReads - lastReadCountRef.current);
      lastReadCountRef.current = totalReads;
    }, 1000);
    return () => clearInterval(interval);
  }, [totalReads]);

  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  // Process incoming tag reads from WebSocket
  useEffect(() => {
    if (!ws.lastMessage) return;
    const tag = ws.lastMessage;

    setTotalReads((prev) => prev + 1);
    setTags((prev) => {
      const next = new Map(prev);
      const existing = next.get(tag.epc);
      if (!existing && soundEnabledRef.current) playBeep();

      if (existing) {
        next.set(tag.epc, {
          ...existing,
          count: existing.count + 1,
          lastSeen: tag.timestamp,
          lastRssi: tag.rssi,
          lastAntenna: tag.antenna,
        });
      } else {
        next.set(tag.epc, {
          epc: tag.epc,
          count: 1,
          firstSeen: tag.timestamp,
          lastSeen: tag.timestamp,
          lastRssi: tag.rssi,
          lastAntenna: tag.antenna,
        });
      }

      return next;
    });
  }, [ws.lastMessage]);

  // Fetch reader status periodically when connected
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${config.apiUrl}/reader/status`);
      const data = await res.json();
      setReaderStatus(data);
    } catch {
      setReaderStatus(null);
    }
  }, []);

  useEffect(() => {
    if (ws.connectionStatus !== 'connected') return;
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [ws.connectionStatus, fetchStatus]);

  const handleClearTags = () => {
    setTags(new Map());
    setTotalReads(0);
  };

  const handleDisconnect = async () => {
    try {
      await fetch(`${config.apiUrl}/reader/stop`, { method: 'POST' });
    } catch { /* ignore */ }
    ws.disconnect();
    setReaderStatus(null);
  };

  return (
    <div className="app">
      {/* Update Banner */}
      {updateInfo?.available && (
        <div className="update-banner">
          <span>
            <Download size={14} />
            {updateInfo.downloaded
              ? `v${updateInfo.version} ready to install`
              : updateInfo.downloading
              ? `Downloading v${updateInfo.version}...`
              : `Update v${updateInfo.version} available`}
          </span>
          {updateInfo.downloaded ? (
            <button className="update-btn" onClick={handleUpdateInstall}>
              <RefreshCw size={13} /> Restart & Update
            </button>
          ) : !updateInfo.downloading ? (
            <button className="update-btn" onClick={handleUpdateDownload}>
              <Download size={13} /> Download
            </button>
          ) : null}
          <button className="update-dismiss" onClick={() => setUpdateInfo(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <Radio className="logo-icon" />
          <span className="logo-title">FXP20</span>
          <button className="version-badge" onClick={() => setShowReleaseNotes(true)} title="View release notes">
            v{APP_VERSION}
          </button>
          <div className={`connection-status status-${ws.connectionStatus}`}>
            {ws.connectionStatus === 'disconnected' || ws.connectionStatus === 'error' ? (
              <WifiOff size={14} />
            ) : (
              <Wifi size={14} />
            )}
            <span>
              {ws.connectionStatus === 'connected'
                ? readerStatus?.error ? 'Error'
                : readerStatus?.initializing ? 'Init...'
                : readerStatus?.running ? 'Reading'
                : 'Connected'
                : ws.connectionStatus === 'connecting'
                ? 'Connecting...'
                : 'Offline'}
            </span>
            {(readerStatus?.running || readerStatus?.initializing) && ws.connectionStatus === 'connected' && <span className="pulse-dot" />}
          </div>
        </div>

        <div className="header-stats">
          <div className="stat-pill"><Hash size={13} /><span className="stat-value">{tags.size}</span><span className="stat-label">tags</span></div>
          <div className="stat-pill"><Activity size={13} /><span className="stat-value">{totalReads.toLocaleString()}</span><span className="stat-label">reads</span></div>
          <div className="stat-pill"><Zap size={13} /><span className="stat-value">{readsPerSecond}</span><span className="stat-label">/sec</span></div>
        </div>

        <div className="header-right">
          <button className="icon-btn" onClick={() => setSoundEnabled(s => !s)} title={soundEnabled ? 'Mute beep' : 'Enable beep'}>
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button className="icon-btn" onClick={toggleTheme} title={`${theme === 'dark' ? 'Light' : 'Dark'} mode`}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          {ws.connectionStatus === 'disconnected' || ws.connectionStatus === 'error' ? (
            <button onClick={ws.connect} className="btn btn-primary">
              <Wifi size={16} />
              <span>Connect</span>
            </button>
          ) : ws.connectionStatus === 'connecting' ? (
            <button disabled className="btn btn-outline btn-connecting">
              <Loader size={16} className="spin" />
              <span>Connecting...</span>
            </button>
          ) : (
            <>
              <button onClick={handleDisconnect} className="btn btn-outline btn-sm">
                <WifiOff size={14} />
                <span>Disconnect</span>
              </button>

              <ControlsPanel
                connectionStatus={ws.connectionStatus}
                readerStatus={readerStatus}
                onRefreshStatus={fetchStatus}
              />

              <button onClick={handleClearTags} className="btn btn-outline btn-sm">
                <Trash2 size={14} />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>

        {ws.connectionStatus === 'error' && (
          <div className="toolbar-alert">Cannot connect to middleware. Is it running?</div>
        )}
        {readerStatus?.error && ws.connectionStatus === 'connected' && (
          <div className="toolbar-alert">{readerStatus.error}</div>
        )}
      </div>

      {/* Main Content */}
      <main className="app-main">
        <TagTable tags={tags} />
      </main>

      {/* Release Notes Modal */}
      {showReleaseNotes && (
        <div className="modal-overlay" onClick={() => setShowReleaseNotes(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Info size={20} /> Release Notes</h2>
              <button className="modal-close" onClick={() => setShowReleaseNotes(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {RELEASE_NOTES.map(release => (
                <div key={release.version} className="release-entry">
                  <div className="release-version">
                    <span className="release-tag">v{release.version}</span>
                    <span className="release-date">{release.date}</span>
                  </div>
                  <ul className="release-changes">
                    {release.changes.map((change, i) => (
                      <li key={i}>{change}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

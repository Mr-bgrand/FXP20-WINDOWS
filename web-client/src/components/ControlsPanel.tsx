import { useState } from 'react';
import { ConnectionStatus, ReaderStatus } from '../types';
import { config } from '../config';
import { Play, Square, Loader } from 'lucide-react';

interface ControlsPanelProps {
  connectionStatus: ConnectionStatus;
  readerStatus: ReaderStatus | null;
  onRefreshStatus: () => void;
}

export function ControlsPanel({
  connectionStatus,
  readerStatus,
  onRefreshStatus,
}: ControlsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInitializing = readerStatus?.initializing === true;
  const isReading = readerStatus?.running === true;
  const isConnected = connectionStatus === 'connected';

  const apiCall = async (endpoint: string, method: string = 'GET') => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiUrl}${endpoint}`, { method });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Request failed');
      onRefreshStatus();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const getStartLabel = () => {
    if (loading) return 'Starting...';
    if (isInitializing) return 'Init...';
    return 'Start';
  };

  return (
    <div className="controls-panel">
      {error && <div className="toolbar-alert">{error}</div>}

      <button
        onClick={() => apiCall('/reader/start', 'POST')}
        disabled={loading || !isConnected || isReading || isInitializing}
        className="btn btn-success btn-sm"
      >
        {isInitializing ? <Loader size={14} className="spin" /> : <Play size={14} />}
        <span>{getStartLabel()}</span>
      </button>

      <button
        onClick={() => apiCall('/reader/stop', 'POST')}
        disabled={loading || !isConnected || (!isReading && !isInitializing)}
        className="btn btn-warning btn-sm"
      >
        <Square size={14} />
        <span>Stop</span>
      </button>
    </div>
  );
}

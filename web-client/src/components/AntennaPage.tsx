import { useState, useEffect, useCallback } from 'react';
import { config } from '../config';
import { Antenna, Zap, ExternalLink, Loader, Check, Pencil } from 'lucide-react';

interface AntennaInfo {
  id: number;
  power: number;
}

const DEFAULT_LABELS: Record<number, { name: string; type: 'internal' | 'external' }> = {
  1: { name: 'Internal', type: 'internal' },
  2: { name: 'External 1', type: 'external' },
  3: { name: 'External 2', type: 'external' },
  4: { name: 'External 3', type: 'external' },
};

function loadNicknames(): Record<number, string> {
  try {
    return JSON.parse(localStorage.getItem('antenna-nicknames') || '{}');
  } catch { return {}; }
}

function saveNicknames(nicknames: Record<number, string>) {
  localStorage.setItem('antenna-nicknames', JSON.stringify(nicknames));
}

interface AntennaPageProps {
  activeAntennas: Set<number>;
}

export function AntennaPage({ activeAntennas }: AntennaPageProps) {
  const [antennas, setAntennas] = useState<AntennaInfo[]>([
    { id: 1, power: 270 },
    { id: 2, power: 270 },
    { id: 3, power: 270 },
    { id: 4, power: 270 },
  ]);
  const [localPower, setLocalPower] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [nicknames, setNicknames] = useState<Record<number, string>>(loadNicknames);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const fetchAntennas = useCallback(async () => {
    try {
      const res = await fetch(`${config.apiUrl}/reader/antennas`);
      const data = await res.json();
      if (data.antennas?.length) {
        setAntennas(data.antennas);
        const powers: Record<number, number> = {};
        data.antennas.forEach((a: AntennaInfo) => { powers[a.id] = a.power; });
        setLocalPower(powers);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAntennas(); }, [fetchAntennas]);

  const handlePowerChange = (antennaId: number, value: number) => {
    setLocalPower(prev => ({ ...prev, [antennaId]: value }));
    setSaved(prev => ({ ...prev, [antennaId]: false }));
  };

  const handleApply = async (antennaId: number) => {
    const power = localPower[antennaId];
    if (power === undefined) return;

    setSaving(prev => ({ ...prev, [antennaId]: true }));
    try {
      await fetch(`${config.apiUrl}/reader/antennas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ antennaId, power }),
      });
      setSaved(prev => ({ ...prev, [antennaId]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [antennaId]: false })), 2000);
    } catch { /* ignore */ }
    setSaving(prev => ({ ...prev, [antennaId]: false }));
  };

  const startEditing = (id: number) => {
    const defaultName = DEFAULT_LABELS[id]?.name || `Antenna ${id}`;
    setEditingId(id);
    setEditValue(nicknames[id] || defaultName);
  };

  const finishEditing = () => {
    if (editingId === null) return;
    const trimmed = editValue.trim();
    const defaultName = DEFAULT_LABELS[editingId]?.name || `Antenna ${editingId}`;
    const updated = { ...nicknames };
    if (trimmed && trimmed !== defaultName) {
      updated[editingId] = trimmed;
    } else {
      delete updated[editingId];
    }
    setNicknames(updated);
    saveNicknames(updated);
    setEditingId(null);
  };

  const powerToDbm = (power: number) => (power / 10).toFixed(1);

  const hasChanged = (antenna: AntennaInfo) => {
    return localPower[antenna.id] !== undefined && localPower[antenna.id] !== antenna.power;
  };

  if (loading) {
    return (
      <div className="antenna-loading">
        <Loader size={24} className="spin" />
        <span>Loading antenna configuration...</span>
      </div>
    );
  }

  return (
    <div className="antenna-page">
      <div className="antenna-grid">
        {antennas.map(antenna => {
          const defaults = DEFAULT_LABELS[antenna.id] || { name: `Antenna ${antenna.id}`, type: 'external' };
          const displayName = nicknames[antenna.id] || defaults.name;
          const isActive = activeAntennas.has(antenna.id);
          const power = localPower[antenna.id] ?? antenna.power;
          const isSaving = saving[antenna.id];
          const isSaved = saved[antenna.id];
          const isEditing = editingId === antenna.id;

          return (
            <div key={antenna.id} className={`antenna-card ${isActive ? 'active' : ''}`}>
              <div className="antenna-card-header">
                <div className="antenna-id">
                  {defaults.type === 'internal' ? <Antenna size={18} /> : <ExternalLink size={18} />}
                  <div>
                    {isEditing ? (
                      <input
                        className="antenna-name-input"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={finishEditing}
                        onKeyDown={e => { if (e.key === 'Enter') finishEditing(); if (e.key === 'Escape') setEditingId(null); }}
                        autoFocus
                      />
                    ) : (
                      <span className="antenna-name" onClick={() => startEditing(antenna.id)} title="Click to rename">
                        {displayName} <Pencil size={11} className="edit-hint" />
                      </span>
                    )}
                    <span className="antenna-port">Port {antenna.id}</span>
                  </div>
                </div>
                <div className={`antenna-status-dot ${isActive ? 'dot-active' : 'dot-inactive'}`} title={isActive ? 'Tags detected on this antenna' : 'No tag activity'} />
              </div>

              <div className="antenna-power-section">
                <div className="power-header">
                  <Zap size={14} />
                  <span className="power-label">Transmit Power</span>
                  <span className="power-value">{powerToDbm(power)} dBm</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={300}
                  step={10}
                  value={power}
                  onChange={e => handlePowerChange(antenna.id, Number(e.target.value))}
                  className="power-slider"
                />
                <div className="power-range">
                  <span>0</span>
                  <span>15 dBm</span>
                  <span>30 dBm</span>
                </div>
              </div>

              <button
                className={`btn btn-sm ${isSaved ? 'btn-saved' : hasChanged(antenna) ? 'btn-success' : 'btn-outline'}`}
                onClick={() => handleApply(antenna.id)}
                disabled={isSaving || (!hasChanged(antenna) && !isSaved)}
              >
                {isSaving ? <Loader size={13} className="spin" /> : isSaved ? <Check size={13} /> : <Zap size={13} />}
                <span>{isSaving ? 'Applying...' : isSaved ? 'Applied' : 'Apply'}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

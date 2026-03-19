import { useState, useMemo, useCallback } from 'react';
import { TagInfo } from '../types';
import { Radio, Search, FileSpreadsheet, FileJson, Binary, Type, Copy, Check, Signal } from 'lucide-react';

type EpcDisplay = 'hex' | 'ascii';

function hexToAscii(hex: string): string {
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.substring(i, i + 2), 16);
    result += (code >= 32 && code <= 126) ? String.fromCharCode(code) : '.';
  }
  return result;
}

interface TagTableProps {
  tags: Map<string, TagInfo>;
}

export function TagTable({ tags }: TagTableProps) {
  const [filter, setFilter] = useState('');
  const [epcDisplay, setEpcDisplay] = useState<EpcDisplay>('hex');
  const [copiedEpc, setCopiedEpc] = useState<string | null>(null);
  const [rssiFilter, setRssiFilter] = useState('');

  const copyEpc = useCallback((epc: string) => {
    navigator.clipboard.writeText(epc);
    setCopiedEpc(epc);
    setTimeout(() => setCopiedEpc(null), 1500);
  }, []);

  const tagArray = useMemo(() => {
    return Array.from(tags.values()).sort((a, b) =>
      new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
    );
  }, [tags]);

  const filteredTags = useMemo(() => {
    const rssiThreshold = rssiFilter ? parseInt(rssiFilter, 10) : NaN;
    return tagArray.filter((tag) => {
      if (filter && !tag.epc.toLowerCase().includes(filter.toLowerCase())) return false;
      if (!isNaN(rssiThreshold) && (tag.lastRssi === undefined || tag.lastRssi < rssiThreshold)) return false;
      return true;
    });
  }, [tagArray, filter, rssiFilter]);

  const formatTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString();

  const getRssiClass = (rssi: number | undefined): string => {
    if (rssi === undefined) return '';
    if (rssi >= -55) return 'rssi-strong';
    if (rssi >= -70) return 'rssi-medium';
    return 'rssi-weak';
  };

  const getRssiLevel = (rssi: number | undefined): number => {
    if (rssi === undefined) return 0;
    if (rssi >= -45) return 5;
    if (rssi >= -55) return 4;
    if (rssi >= -65) return 3;
    if (rssi >= -75) return 2;
    return 1;
  };

  const exportCSV = useCallback(() => {
    const headers = ['EPC', 'Count', 'First Seen', 'Last Seen', 'RSSI', 'Antenna'];
    const rows = filteredTags.map((t) => [
      t.epc, t.count.toString(),
      new Date(t.firstSeen).toISOString(), new Date(t.lastSeen).toISOString(),
      t.lastRssi?.toString() || '', t.lastAntenna?.toString() || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rfid-tags.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [filteredTags]);

  const exportJSON = useCallback(() => {
    const data = filteredTags.map((t) => ({
      epc: t.epc, count: t.count, firstSeen: t.firstSeen, lastSeen: t.lastSeen,
      rssi: t.lastRssi, antenna: t.lastAntenna,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rfid-tags.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [filteredTags]);

  return (
    <div className="tag-table-container">
      <div className="table-header">
        <h2>
          <Radio size={18} style={{ color: 'var(--accent-primary)' }} />
          Tags
          <span className="tag-count">{filteredTags.length}</span>
          {filteredTags.length !== tagArray.length && (
            <span className="tag-count-filtered">/ {tagArray.length}</span>
          )}
        </h2>

        <div className="table-actions">
          <div className="filter-wrapper">
            <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Filter EPC..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-wrapper rssi-filter-wrapper">
            <Signal size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Min RSSI (e.g. -75)"
              value={rssiFilter}
              onChange={(e) => setRssiFilter(e.target.value.replace(/[^0-9-]/g, ''))}
              className="filter-input"
            />
          </div>

          <button
            onClick={() => setEpcDisplay(d => d === 'hex' ? 'ascii' : 'hex')}
            className="btn-export"
            title={epcDisplay === 'hex' ? 'Show ASCII' : 'Show HEX'}
          >
            {epcDisplay === 'hex' ? <Type size={13} /> : <Binary size={13} />}
            <span>{epcDisplay === 'hex' ? 'ASCII' : 'HEX'}</span>
          </button>

          <div className="export-buttons">
            <button onClick={exportCSV} className="btn-export" disabled={filteredTags.length === 0} title="Export CSV">
              <FileSpreadsheet size={13} /> <span>CSV</span>
            </button>
            <button onClick={exportJSON} className="btn-export" disabled={filteredTags.length === 0} title="Export JSON">
              <FileJson size={13} /> <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {filteredTags.length === 0 ? (
        <div className="empty-state">
          <Radio className="empty-icon" />
          <div className="empty-title">{filter ? 'No tags match filter' : 'No tags detected'}</div>
          <div className="empty-subtitle">{filter ? 'Try adjusting your search' : 'Connect and start scanning'}</div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>EPC</th>
                <th>Count</th>
                <th>First Seen</th>
                <th>Last Seen</th>
                <th>RSSI</th>
                <th>Antenna</th>
              </tr>
            </thead>
            <tbody>
              {filteredTags.map((tag, idx) => (
                <tr key={tag.epc}>
                  <td className="row-number">{idx + 1}</td>
                  <td className="epc-cell" title={`HEX: ${tag.epc}\nASCII: ${hexToAscii(tag.epc)}`}>
                    <span>{epcDisplay === 'hex' ? tag.epc : hexToAscii(tag.epc)}</span>
                    <button className={`copy-btn${copiedEpc === tag.epc ? ' copied' : ''}`} onClick={() => copyEpc(tag.epc)} title="Copy EPC">
                      {copiedEpc === tag.epc ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </td>
                  <td className="count-cell">{tag.count.toLocaleString()}</td>
                  <td>{formatTime(tag.firstSeen)}</td>
                  <td>{formatTime(tag.lastSeen)}</td>
                  <td>
                    <div className="rssi-cell">
                      <div className={`rssi-bar ${getRssiClass(tag.lastRssi)}`}>
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div key={level} className={`rssi-bar-segment ${level <= getRssiLevel(tag.lastRssi) ? 'active' : ''}`} />
                        ))}
                      </div>
                      <span className="rssi-value">{tag.lastRssi !== undefined ? `${tag.lastRssi} dBm` : '-'}</span>
                    </div>
                  </td>
                  <td>{tag.lastAntenna ? `ANT${tag.lastAntenna}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

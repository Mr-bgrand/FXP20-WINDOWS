import { spawn, ChildProcess } from 'child_process';
import { ReaderInterface, TagRead, TagReadCallback, AntennaInfo } from './readerInterface';
import { config } from '../config';
import logger from '../logger';
import path from 'path';

interface JavaBridgeMessage {
    type: 'tag_read' | 'log' | 'error' | 'status' | 'antenna_config' | 'antenna_power_set';
    timestamp?: string;
    epc?: string;
    rssi?: number;
    antenna?: number;
    readerId?: string;
    level?: string;
    message?: string;
    error?: string;
    status?: string;
    antennas?: AntennaInfo[];
    antennaId?: number;
    power?: number;
}

export class FXP20JposReader implements ReaderInterface {
    private bridgeAlive: boolean = false;
    private bridgeReady: boolean = false;
    private inventoryActive: boolean = false;
    private lastError: string | null = null;
    private callbacks: TagReadCallback[] = [];
    private javaProcess?: ChildProcess;
    private buffer: string = '';
    private pendingAntennaResolve?: (antennas: AntennaInfo[]) => void;
    private pendingPowerResolve?: () => void;

    constructor() {
        logger.info('FXP20JposReader initialized');
    }

    async startInventory(): Promise<void> {
        if (this.inventoryActive) {
            logger.warn('Inventory already active');
            return;
        }

        if (this.bridgeAlive && this.bridgeReady) {
            this.sendCommand('CSTART');
            this.inventoryActive = true;
            return;
        }

        if (this.bridgeAlive && !this.bridgeReady) {
            logger.warn('Bridge is still initializing, please wait');
            return;
        }

        this.lastError = null;
        logger.info('Starting FXP20 JPOS bridge');
        await this.spawnBridge();
    }

    async stopInventory(): Promise<void> {
        if (!this.inventoryActive) return;

        logger.info('Stopping FXP20 JPOS inventory');
        this.sendCommand('STOP');
        this.inventoryActive = false;
    }

    async getStatus(): Promise<{ running: boolean; initializing?: boolean; error?: string | null }> {
        return {
            running: this.inventoryActive,
            initializing: this.bridgeAlive && !this.bridgeReady,
            error: this.lastError,
        };
    }

    onTagRead(cb: TagReadCallback): void {
        this.callbacks.push(cb);
    }

    async shutdown(): Promise<void> {
        this.inventoryActive = false;
        this.sendCommand('QUIT');
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (this.javaProcess) {
            this.javaProcess.kill('SIGTERM');
            this.javaProcess = undefined;
        }

        this.bridgeAlive = false;
        this.bridgeReady = false;
    }

    async getAntennaConfig(): Promise<AntennaInfo[]> {
        if (!this.bridgeAlive || !this.bridgeReady) {
            return [
                { id: 1, power: 270 },
                { id: 2, power: 270 },
                { id: 3, power: 270 },
                { id: 4, power: 270 },
            ];
        }

        return new Promise((resolve) => {
            this.pendingAntennaResolve = resolve;
            this.sendCommand('ANTENNAS');
            setTimeout(() => {
                if (this.pendingAntennaResolve) {
                    this.pendingAntennaResolve = undefined;
                    resolve([{ id: 1, power: 270 }, { id: 2, power: 270 }, { id: 3, power: 270 }, { id: 4, power: 270 }]);
                }
            }, 3000);
        });
    }

    async setAntennaPower(antennaId: number, power: number): Promise<void> {
        if (!this.bridgeAlive || !this.bridgeReady) {
            throw new Error('Reader not connected');
        }

        return new Promise((resolve, reject) => {
            this.pendingPowerResolve = resolve;
            this.sendCommand(`SETPOWER ${antennaId} ${power}`);
            setTimeout(() => {
                if (this.pendingPowerResolve) {
                    this.pendingPowerResolve = undefined;
                    reject(new Error('Timeout setting antenna power'));
                }
            }, 3000);
        });
    }

    private async spawnBridge(): Promise<void> {
        const resourceRoot = process.env.RESOURCE_PATH || path.resolve(__dirname, '../../../');
        const javaBridgePath = path.join(resourceRoot, 'java-bridge');
        const jposLibPath = path.join(resourceRoot, 'jpos-driver', 'lib');

        const classpath = [
            javaBridgePath,
            path.join(jposLibPath, '*'),
            jposLibPath,
            '.'
        ].join(';');

        const javaCmd = process.env.JAVA_CMD
            || (process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'java') : 'java');

        const libraryPath = `${javaBridgePath};${jposLibPath}`;

        logger.info('Spawning Java bridge', { javaBridgePath, jposLibPath, javaCmd, classpath, libraryPath });

        this.javaProcess = spawn(javaCmd, [
            '--enable-native-access=ALL-UNNAMED',
            `-Djava.library.path=${libraryPath}`,
            '-cp',
            classpath,
            'FXP20Bridge'
        ], {
            cwd: javaBridgePath,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PATH: process.env.PATH }
        });

        this.javaProcess.stdout?.on('data', (data: Buffer) => {
            const raw = data.toString();
            logger.info('BRIDGE STDOUT: ' + raw.trim().substring(0, 500));
            this.handleJavaOutput(raw);
        });

        this.javaProcess.stderr?.on('data', (data: Buffer) => {
            logger.error('BRIDGE STDERR: ' + data.toString().trim().substring(0, 500));
        });

        this.javaProcess.on('exit', (code, signal) => {
            logger.warn('Java bridge process EXITED', { code, signal });
            if (!this.bridgeReady && !this.lastError) {
                this.lastError = 'Reader connection failed — is the FXP20 plugged in via USB?';
            }
            this.bridgeAlive = false;
            this.bridgeReady = false;
            this.inventoryActive = false;
        });

        this.javaProcess.on('error', (error) => {
            logger.error('Java bridge process SPAWN ERROR', { error: error.message });
            this.lastError = 'Failed to start reader bridge: ' + error.message;
            this.bridgeAlive = false;
            this.bridgeReady = false;
            this.inventoryActive = false;
        });

        this.bridgeAlive = true;
    }

    private sendCommand(cmd: string): void {
        if (this.javaProcess?.stdin?.writable) {
            logger.info(`Sending command to Java bridge: ${cmd}`);
            this.javaProcess.stdin.write(cmd + '\n');
        } else {
            logger.warn('Cannot send command - bridge stdin not writable');
        }
    }

    private handleJavaOutput(data: string): void {
        this.buffer += data;
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
                const message: JavaBridgeMessage = JSON.parse(trimmed);
                this.handleJavaMessage(message);
            } catch (error) {
                logger.warn('Non-JSON output from Java bridge', { line: trimmed });
            }
        }
    }

    private handleJavaMessage(message: JavaBridgeMessage): void {
        switch (message.type) {
            case 'tag_read':
                if (message.epc && message.timestamp) {
                    const tagRead: TagRead = {
                        type: 'tag_read',
                        timestamp: message.timestamp,
                        epc: message.epc,
                        rssi: message.rssi,
                        antenna: message.antenna,
                        readerId: message.readerId || config.readerId,
                    };
                    this.emitTagRead(tagRead);
                }
                break;

            case 'log':
                logger.info(`Java bridge: ${message.message}`, { level: message.level });
                break;

            case 'error':
                logger.error(`Java bridge error: ${message.message}`, { error: message.error });
                this.lastError = message.error || message.message || 'Unknown reader error';
                break;

            case 'status':
                logger.info(`Java bridge status: ${message.status}`);
                if (message.status === 'connected' && !this.bridgeReady) {
                    this.bridgeReady = true;
                    logger.info('Bridge ready - sending CSTART for continuous reads');
                    this.sendCommand('CSTART');
                    this.inventoryActive = true;
                } else if (message.status === 'error') {
                    this.inventoryActive = false;
                }
                break;

            case 'antenna_config':
                if (this.pendingAntennaResolve && message.antennas) {
                    this.pendingAntennaResolve(message.antennas);
                    this.pendingAntennaResolve = undefined;
                }
                break;

            case 'antenna_power_set':
                if (this.pendingPowerResolve) {
                    this.pendingPowerResolve();
                    this.pendingPowerResolve = undefined;
                }
                break;
        }
    }

    private emitTagRead(tag: TagRead): void {
        this.callbacks.forEach(cb => {
            try { cb(tag); } catch (error) { logger.error('Error in tag read callback', { error }); }
        });
    }
}

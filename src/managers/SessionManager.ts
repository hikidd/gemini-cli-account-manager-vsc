import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

export interface SessionMetadata {
    id: string;
    filename: string;
    startTime: string;
    lastUpdated: string;
    preview: string;
    messageCount: number;
}

export interface SessionMessage {
    id: string;
    timestamp: string;
    type: string;
    content: string;
    thoughts?: any[];
}

export interface SessionDetail {
    sessionId: string;
    projectHash: string;
    startTime: string;
    lastUpdated: string;
    messages: SessionMessage[];
}

export class SessionManager {
    private static instance: SessionManager;
    private projectHash: string = '';
    private sessionDir: string = '';

    private constructor() {
        this.initialize();
        
        // Listen for workspace folder changes (e.g. user opens a folder after extension activation)
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            console.log('[SessionManager] Workspace folders changed, re-initializing...');
            this.initialize();
        });
    }

    public static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }

    private initialize() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.log('[SessionManager] No workspace folders found. Waiting for user to open a folder...');
            return;
        }

        const projectPath = workspaceFolders[0].uri.fsPath;
        const baseTmp = path.join(os.homedir(), '.gemini', 'tmp');

        const normalizedPath = path.normalize(projectPath);
        const lowerPath = normalizedPath.toLowerCase();
        const slashPath = normalizedPath.replace(/\\/g, '/');
        const lowerSlashPath = slashPath.toLowerCase();

        const candidateHashes = [
            this.calculateProjectHash(projectPath),
            this.calculateProjectHash(normalizedPath),
            this.calculateProjectHash(lowerPath),
            this.calculateProjectHash(slashPath),
            this.calculateProjectHash(lowerSlashPath)
        ].filter((hash, index, arr) => arr.indexOf(hash) === index);

        const existingHash = candidateHashes.find(hash => {
            const chatsDir = path.join(baseTmp, hash, 'chats');
            return fs.existsSync(chatsDir);
        });

        const selectedHash = existingHash || candidateHashes[0];
        this.projectHash = selectedHash || '';
        this.sessionDir = selectedHash ? path.join(baseTmp, selectedHash, 'chats') : '';
        
        console.log(`[SessionManager] Initialized. Project Path: ${projectPath}`);
        console.log(`[SessionManager] Selected Hash: ${this.projectHash}`);
        console.log(`[SessionManager] Session Dir: ${this.sessionDir}`);
    }

    private calculateProjectHash(projectPath: string): string {
        return crypto.createHash('sha256').update(projectPath).digest('hex');
    }

    private isSafeSessionFilename(filename: string): boolean {
        return /^session-[a-zA-Z0-9_-]+\.json$/.test(filename);
    }

    private resolveSafeSessionFilePath(filename: string): string | null {
        if (!this.sessionDir || !this.isSafeSessionFilename(filename)) {
            return null;
        }

        const baseDir = path.resolve(this.sessionDir);
        const targetPath = path.resolve(baseDir, filename);
        const baseWithSeparator = baseDir.endsWith(path.sep) ? baseDir : `${baseDir}${path.sep}`;

        if (!targetPath.startsWith(baseWithSeparator)) {
            return null;
        }

        return targetPath;
    }

    public getSessionDir(): string {
        return this.sessionDir;
    }

    public async listSessions(): Promise<SessionMetadata[]> {
        // Retry initialization if needed
        if (!this.sessionDir) {
            console.log('[SessionManager] SessionDir not set, retrying initialization...');
            this.initialize();
        }

        if (!this.sessionDir) {
            console.warn('[SessionManager] SessionDir still not set after retry.');
            return [];
        }

        if (!fs.existsSync(this.sessionDir)) {
            const msg = `Session directory not found: ${this.sessionDir}`;
            console.warn(`[SessionManager] ${msg}`);
            
            return [];
        }

        try {
            console.log(`[SessionManager] Reading sessions from: ${this.sessionDir}`);
            const files = await fs.promises.readdir(this.sessionDir);
            const sessionFiles = files.filter(file => this.isSafeSessionFilename(file));
            console.log(`[SessionManager] Found ${sessionFiles.length} session files.`);

            const sessions: SessionMetadata[] = [];

            for (const file of sessionFiles) {
                try {
                    const filePath = this.resolveSafeSessionFilePath(file);
                    if (!filePath) {
                        continue;
                    }

                    const content = await fs.promises.readFile(filePath, 'utf-8');
                    const data = JSON.parse(content);

                    // Extract preview from the first user message or system message
                    let preview = "No messages";
                    if (data.messages && data.messages.length > 0) {
                        const firstMsg = data.messages.find((m: any) => m.type === 'user') || data.messages[0];
                        preview = firstMsg.content ? firstMsg.content.substring(0, 100) : "Empty message";
                    }

                    sessions.push({
                        id: data.sessionId,
                        filename: file,
                        startTime: data.startTime,
                        lastUpdated: data.lastUpdated,
                        preview: preview,
                        messageCount: data.messages ? data.messages.length : 0
                    });
                } catch (err) {
                    console.error(`Error reading session file ${file}:`, err);
                }
            }

            // Sort by lastUpdated desc
            return sessions.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
        } catch (error) {
            console.error('Error listing sessions:', error);
            return [];
        }
    }

    public async getSession(filename: string): Promise<SessionDetail | null> {
        const filePath = this.resolveSafeSessionFilePath(filename);

        if (!filePath || !fs.existsSync(filePath)) {
            return null;
        }

        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return JSON.parse(content) as SessionDetail;
        } catch (error) {
            console.error(`Error reading session ${filename}:`, error);
            return null;
        }
    }

    public async deleteSession(filename: string): Promise<boolean> {
        const filePath = this.resolveSafeSessionFilePath(filename);

        if (!filePath || !fs.existsSync(filePath)) {
            return false;
        }

        try {
            await fs.promises.unlink(filePath);
            return true;
        } catch (error) {
            console.error(`Error deleting session ${filename}:`, error);
            return false;
        }
    }
}

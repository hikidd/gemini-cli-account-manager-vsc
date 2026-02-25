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
    content: unknown;
    thoughts?: any[];
}

export interface SessionDetail {
    sessionId: string;
    projectHash: string;
    startTime: string;
    lastUpdated: string;
    messages: SessionMessage[];
}

interface SessionFileData {
    sessionId: string;
    startTime: string;
    lastUpdated: string;
    messages: Array<{ type?: unknown; content?: unknown }>;
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
            this.projectHash = '';
            this.sessionDir = '';
            console.log('[SessionManager] No workspace folders found. Waiting for user to open a folder...');
            return;
        }

        const projectPath = workspaceFolders[0].uri.fsPath;
        const baseTmp = path.join(os.homedir(), '.gemini', 'tmp');

        const candidateIdentifiers = this.getProjectIdentifierCandidates(projectPath, baseTmp);
        const existingIdentifier = candidateIdentifiers.find(identifier => this.hasChatsDir(baseTmp, identifier));
        const selectedIdentifier = existingIdentifier || candidateIdentifiers[0] || '';

        this.projectHash = selectedIdentifier;
        this.sessionDir = selectedIdentifier ? path.join(baseTmp, selectedIdentifier, 'chats') : '';

        console.log(`[SessionManager] Initialized. Project Path: ${projectPath}`);
        console.log(`[SessionManager] Selected Identifier: ${this.projectHash}`);
        console.log(`[SessionManager] Session Dir: ${this.sessionDir}`);
    }

    private getProjectIdentifierCandidates(projectPath: string, baseTmp: string): string[] {
        const candidates: string[] = [];

        const registryIdentifier = this.readProjectIdentifierFromRegistry(projectPath);
        if (registryIdentifier) {
            candidates.push(registryIdentifier);
        }

        const markerIdentifiers = this.findMarkerOwnedProjectIdentifiers(baseTmp, projectPath);
        candidates.push(...markerIdentifiers);

        const legacyHashCandidates = this.getLegacyHashCandidates(projectPath);
        candidates.push(...legacyHashCandidates);

        const seen = new Set<string>();
        const uniqueCandidates: string[] = [];

        for (const candidate of candidates) {
            if (!candidate || seen.has(candidate)) {
                continue;
            }
            if (!this.isSafeProjectIdentifier(candidate)) {
                continue;
            }
            seen.add(candidate);
            uniqueCandidates.push(candidate);
        }

        return uniqueCandidates;
    }

    private readProjectIdentifierFromRegistry(projectPath: string): string | null {
        const registryPath = path.join(os.homedir(), '.gemini', 'projects.json');
        if (!fs.existsSync(registryPath)) {
            return null;
        }

        try {
            const raw = fs.readFileSync(registryPath, 'utf8');
            const parsed = JSON.parse(raw) as { projects?: Record<string, unknown> };
            const projects = parsed.projects;
            if (!projects || typeof projects !== 'object') {
                return null;
            }

            const normalizedTargetPath = this.normalizeProjectPath(projectPath);

            for (const [storedPath, identifier] of Object.entries(projects)) {
                if (typeof identifier !== 'string') {
                    continue;
                }
                if (!this.isSafeProjectIdentifier(identifier)) {
                    continue;
                }
                if (this.normalizeProjectPath(storedPath) === normalizedTargetPath) {
                    return identifier;
                }
            }
        } catch (error) {
            console.warn('[SessionManager] Failed to read projects registry:', error);
        }

        return null;
    }

    private findMarkerOwnedProjectIdentifiers(baseTmp: string, projectPath: string): string[] {
        if (!fs.existsSync(baseTmp)) {
            return [];
        }

        const normalizedTargetPath = this.normalizeProjectPath(projectPath);
        const identifiers: string[] = [];

        try {
            const entries = fs.readdirSync(baseTmp, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) {
                    continue;
                }

                const identifier = entry.name;
                if (!this.isSafeProjectIdentifier(identifier)) {
                    continue;
                }

                const markerPath = path.join(baseTmp, identifier, '.project_root');
                if (!fs.existsSync(markerPath)) {
                    continue;
                }

                try {
                    const ownerPath = fs.readFileSync(markerPath, 'utf8').trim();
                    if (!ownerPath) {
                        continue;
                    }

                    if (this.normalizeProjectPath(ownerPath) === normalizedTargetPath) {
                        identifiers.push(identifier);
                    }
                } catch (error) {
                    console.warn(`[SessionManager] Failed reading marker file for ${identifier}:`, error);
                }
            }
        } catch (error) {
            console.warn(`[SessionManager] Failed scanning ${baseTmp}:`, error);
        }

        return identifiers;
    }

    private getLegacyHashCandidates(projectPath: string): string[] {
        const normalizedPath = path.normalize(projectPath);
        const lowerPath = normalizedPath.toLowerCase();
        const slashPath = normalizedPath.replace(/\\/g, '/');
        const lowerSlashPath = slashPath.toLowerCase();

        return [
            this.calculateProjectHash(projectPath),
            this.calculateProjectHash(normalizedPath),
            this.calculateProjectHash(lowerPath),
            this.calculateProjectHash(slashPath),
            this.calculateProjectHash(lowerSlashPath)
        ];
    }

    private normalizeProjectPath(projectPath: string): string {
        const resolvedPath = path.resolve(projectPath);
        return process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath;
    }

    private calculateProjectHash(projectPath: string): string {
        return crypto.createHash('sha256').update(projectPath).digest('hex');
    }

    private isSafeProjectIdentifier(identifier: string): boolean {
        return /^[a-z0-9][a-z0-9-]*$/.test(identifier) || /^[a-f0-9]{64}$/.test(identifier);
    }

    private isPathInsideBaseDir(baseDir: string, targetPath: string): boolean {
        const normalizedBaseDir = path.resolve(baseDir);
        const normalizedTargetPath = path.resolve(targetPath);
        if (normalizedBaseDir === normalizedTargetPath) {
            return true;
        }

        const baseWithSeparator = normalizedBaseDir.endsWith(path.sep)
            ? normalizedBaseDir
            : `${normalizedBaseDir}${path.sep}`;

        return normalizedTargetPath.startsWith(baseWithSeparator);
    }

    private hasChatsDir(baseTmp: string, identifier: string): boolean {
        if (!this.isSafeProjectIdentifier(identifier)) {
            return false;
        }

        const baseDir = path.resolve(baseTmp);
        const projectDir = path.resolve(baseTmp, identifier);
        if (!this.isPathInsideBaseDir(baseDir, projectDir)) {
            return false;
        }

        const chatsDir = path.join(projectDir, 'chats');
        try {
            if (!fs.existsSync(chatsDir)) {
                return false;
            }

            const chatsLstat = fs.lstatSync(chatsDir);
            if (!chatsLstat.isDirectory() || chatsLstat.isSymbolicLink()) {
                return false;
            }

            const realBaseDir = fs.realpathSync(baseDir);
            const realProjectDir = fs.realpathSync(projectDir);
            const realChatsDir = fs.realpathSync(chatsDir);
            if (!this.isPathInsideBaseDir(realBaseDir, realProjectDir)) {
                return false;
            }
            if (!this.isPathInsideBaseDir(realProjectDir, realChatsDir)) {
                return false;
            }

            return true;
        } catch {
            return false;
        }
    }

    private isSafeSessionFilename(filename: string): boolean {
        return filename.startsWith('session-') && filename.endsWith('.json');
    }

    private resolveSafeSessionFilePath(filename: string): string | null {
        if (!this.sessionDir || !this.isSafeSessionFilename(filename)) {
            return null;
        }

        const baseDir = path.resolve(this.sessionDir);
        const targetPath = path.resolve(baseDir, filename);

        if (!this.isPathInsideBaseDir(baseDir, targetPath)) {
            return null;
        }

        if (!fs.existsSync(targetPath)) {
            return targetPath;
        }

        try {
            const realBaseDir = fs.realpathSync(baseDir);
            const realTargetPath = fs.realpathSync(targetPath);
            if (!this.isPathInsideBaseDir(realBaseDir, realTargetPath)) {
                return null;
            }
        } catch {
            // If realpath fails, keep lexical boundary check result.
        }

        return targetPath;
    }

    private parseTimestamp(value: string): number {
        const timestamp = Date.parse(value);
        return Number.isFinite(timestamp) ? timestamp : 0;
    }

    private isValidSessionFileData(data: unknown): data is SessionFileData {
        if (!data || typeof data !== 'object') {
            return false;
        }

        const candidate = data as SessionFileData;
        const hasValidSessionId = typeof candidate.sessionId === 'string' && candidate.sessionId.trim().length > 0;
        const hasValidStartTime = typeof candidate.startTime === 'string' && candidate.startTime.trim().length > 0;
        const hasValidLastUpdated = typeof candidate.lastUpdated === 'string' && candidate.lastUpdated.trim().length > 0;

        return hasValidSessionId && hasValidStartTime && hasValidLastUpdated && Array.isArray(candidate.messages);
    }

    private hasUserOrAssistantMessage(messages: Array<{ type?: unknown }>): boolean {
        return messages.some(message => message?.type === 'user' || message?.type === 'gemini');
    }

    private extractMessageText(content: unknown): string {
        if (typeof content === 'string') {
            return content;
        }

        if (!Array.isArray(content)) {
            return '';
        }

        const texts = content.map(part => {
            if (typeof part === 'string') {
                return part;
            }

            if (part && typeof part === 'object' && 'text' in part) {
                const text = (part as { text?: unknown }).text;
                return typeof text === 'string' ? text : '';
            }

            return '';
        });

        return texts.join(' ').trim();
    }

    private extractPreview(messages: Array<{ type?: unknown; content?: unknown }>): string {
        if (messages.length === 0) {
            return 'No messages';
        }

        const firstMessage = messages.find(msg => msg.type === 'user')
            || messages.find(msg => msg.type === 'gemini')
            || messages[0];

        const text = this.extractMessageText(firstMessage?.content);
        return text ? text.substring(0, 100) : 'Empty message';
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

            const sessionMap = new Map<string, SessionMetadata>();

            for (const file of sessionFiles) {
                try {
                    const filePath = this.resolveSafeSessionFilePath(file);
                    if (!filePath) {
                        continue;
                    }

                    const content = await fs.promises.readFile(filePath, 'utf-8');
                    const data = JSON.parse(content) as unknown;
                    if (!this.isValidSessionFileData(data)) {
                        continue;
                    }

                    // Skip sessions that only contain system messages
                    if (!this.hasUserOrAssistantMessage(data.messages)) {
                        continue;
                    }

                    const metadata: SessionMetadata = {
                        id: data.sessionId,
                        filename: file,
                        startTime: data.startTime,
                        lastUpdated: data.lastUpdated,
                        preview: this.extractPreview(data.messages),
                        messageCount: data.messages.length
                    };

                    const existing = sessionMap.get(metadata.id);
                    if (!existing || this.parseTimestamp(metadata.lastUpdated) > this.parseTimestamp(existing.lastUpdated)) {
                        sessionMap.set(metadata.id, metadata);
                    }
                } catch (err) {
                    console.error(`Error reading session file ${file}:`, err);
                }
            }

            // Sort by lastUpdated desc
            return Array.from(sessionMap.values())
                .sort((a, b) => this.parseTimestamp(b.lastUpdated) - this.parseTimestamp(a.lastUpdated));
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
            const lstat = await fs.promises.lstat(filePath);
            if (!lstat.isFile() || lstat.isSymbolicLink()) {
                return null;
            }

            const content = await fs.promises.readFile(filePath, 'utf-8');
            const parsed = JSON.parse(content) as unknown;
            if (!this.isValidSessionFileData(parsed)) {
                return null;
            }

            return parsed as SessionDetail;
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
            const lstat = await fs.promises.lstat(filePath);
            if (!lstat.isFile() || lstat.isSymbolicLink()) {
                return false;
            }

            await fs.promises.unlink(filePath);
            return true;
        } catch (error) {
            console.error(`Error deleting session ${filename}:`, error);
            return false;
        }
    }
}

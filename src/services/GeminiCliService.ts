import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GeminiAccount } from '../types';

export class GeminiCliService {
  private readonly GEMINI_DIR: string;
  private readonly GOOGLE_ACCOUNTS_FILE: string;
  private readonly OAUTH_CREDS_FILE: string;
  private readonly SETTINGS_FILE: string;

  constructor(geminiDir?: string) {
    this.GEMINI_DIR = geminiDir ?? path.join(os.homedir(), '.gemini');
    this.GOOGLE_ACCOUNTS_FILE = path.join(this.GEMINI_DIR, 'google_accounts.json');
    this.OAUTH_CREDS_FILE = path.join(this.GEMINI_DIR, 'oauth_creds.json');
    this.SETTINGS_FILE = path.join(this.GEMINI_DIR, 'settings.json');

    this.ensureGeminiDir();

    // Best-effort startup repair for legacy/mismatched history session paths.
    this.tryRepairHistorySessionDirs('on startup');
  }

  private ensureGeminiDir() {
    if (!fs.existsSync(this.GEMINI_DIR)) {
      fs.mkdirSync(this.GEMINI_DIR, { recursive: true });
    }
  }

  public async updateCredentials(account: GeminiAccount): Promise<void> {
    // 1. Backup settings.json if it exists
    let settingsBackup: string | null = null;
    if (fs.existsSync(this.SETTINGS_FILE)) {
      try {
        settingsBackup = fs.readFileSync(this.SETTINGS_FILE, 'utf8');
      } catch (e) {
        console.warn('Failed to backup settings.json', e);
      }
    }

    // 2. Update credentials files
    await this.updateGoogleAccountsFile(account);
    await this.updateOAuthCredsFile(account);

    // 3. Restore settings.json if we had a backup
    if (settingsBackup) {
      try {
        fs.writeFileSync(this.SETTINGS_FILE, settingsBackup, 'utf8');
        console.log('Restored settings.json backup');
      } catch (e) {
        console.error('Failed to restore settings.json', e);
      }
    }

    // 4. Best-effort history/session compatibility repair
    this.tryRepairHistorySessionDirs('during credential update');
  }

  private tryRepairHistorySessionDirs(context: string): void {
    try {
      this.repairHistorySessionDirs();
    } catch (e) {
      console.warn(`Failed to repair history/session dirs ${context}`, e);
    }
  }

  public repairHistorySessionDirs(): void {
    const configuredTmpDir = path.join(this.GEMINI_DIR, 'tmp');
    if (!fs.existsSync(configuredTmpDir)) {
      return;
    }

    let tmpDir: string;
    try {
      const tmpStats = fs.lstatSync(configuredTmpDir);
      if (tmpStats.isSymbolicLink()) {
        console.warn('Skip session repair because tmp directory is a symbolic link');
        return;
      }

      tmpDir = fs.realpathSync(configuredTmpDir);
    } catch (e) {
      console.warn('Failed to resolve tmp directory for session repair', e);
      return;
    }

    let projectDirs: fs.Dirent[] = [];
    try {
      projectDirs = fs.readdirSync(tmpDir, { withFileTypes: true }).filter(entry => entry.isDirectory());
    } catch (e) {
      console.warn('Failed to read tmp directory for session repair', e);
      return;
    }

    for (const projectDir of projectDirs) {
      try {
        const sourceChatsDir = path.join(tmpDir, projectDir.name, 'chats');
        if (!fs.existsSync(sourceChatsDir)) {
          continue;
        }

        const sessionFiles = fs.readdirSync(sourceChatsDir).filter(file => file.endsWith('.json'));
        for (const sessionFile of sessionFiles) {
          const sourceFile = path.join(sourceChatsDir, sessionFile);

          let parsed: any;
          try {
            parsed = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
          } catch {
            // Skip invalid/corrupted session file and continue loading others.
            continue;
          }

          const projectHash = typeof parsed?.projectHash === 'string' ? parsed.projectHash.trim() : '';
          if (!this.isSafeProjectHash(projectHash) || projectHash === projectDir.name) {
            continue;
          }

          const targetProjectDir = path.resolve(tmpDir, projectHash);
          if (!this.isPathInsideBaseDir(tmpDir, targetProjectDir)) {
            continue;
          }

          if (fs.existsSync(targetProjectDir) && !this.isSafeExistingDirectoryPath(tmpDir, targetProjectDir)) {
            continue;
          }

          const targetChatsDir = path.resolve(targetProjectDir, 'chats');
          if (!this.isPathInsideBaseDir(tmpDir, targetChatsDir)) {
            continue;
          }

          if (fs.existsSync(targetChatsDir)) {
            if (!this.isSafeExistingDirectoryPath(tmpDir, targetChatsDir)) {
              continue;
            }
          } else {
            fs.mkdirSync(targetChatsDir, { recursive: true });
          }

          const targetFile = path.join(targetChatsDir, sessionFile);
          if (!fs.existsSync(targetFile)) {
            fs.copyFileSync(sourceFile, targetFile);
          }
        }
      } catch (e) {
        console.warn(`Failed to repair session directory for ${projectDir.name}`, e);
      }
    }
  }

  private isSafeProjectHash(projectHash: string): boolean {
    return /^[a-zA-Z0-9_-]{8,128}$/.test(projectHash);
  }

  private isSafeExistingDirectoryPath(baseDir: string, directoryPath: string): boolean {
    try {
      const realPath = fs.realpathSync(directoryPath);
      const realBase = fs.realpathSync(baseDir);
      return this.isPathInsideBaseDir(realBase, realPath);
    } catch {
      return false;
    }
  }

  private isPathInsideBaseDir(baseDir: string, targetPath: string): boolean {
    const normalize = (p: string) => {
      const resolved = path.resolve(p);
      return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    };

    const normalizedBase = normalize(baseDir);
    const normalizedTarget = normalize(targetPath);
    const baseWithSeparator = normalizedBase.endsWith(path.sep) ? normalizedBase : `${normalizedBase}${path.sep}`;

    return normalizedTarget === normalizedBase || normalizedTarget.startsWith(baseWithSeparator);
  }

  private async updateGoogleAccountsFile(account: GeminiAccount) {
    let data: any = { active: '', old: [] };
    
    if (fs.existsSync(this.GOOGLE_ACCOUNTS_FILE)) {
      try {
        data = JSON.parse(fs.readFileSync(this.GOOGLE_ACCOUNTS_FILE, 'utf8'));
      } catch (e) {
        console.warn('Failed to parse google_accounts.json', e);
      }
    }

    // If there was a previous active account and it's not the current one, move it to 'old'
    if (data.active && data.active !== account.email) {
      if (!data.old.includes(data.active)) {
        data.old.push(data.active);
      }
    }

    // Remove current email from 'old' if it exists there
    data.old = data.old.filter((email: string) => email !== account.email);
    
    // Set new active
    data.active = account.email;

    fs.writeFileSync(this.GOOGLE_ACCOUNTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  public async updateOAuthCredsFile(account: GeminiAccount) {
    // Structure matches exactly what we saw in the user's file
    const creds = {
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      scope: account.scope || 'openid https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      token_type: account.tokenType || 'Bearer',
      id_token: account.idToken,
      expiry_date: account.expiresAt
    };

    fs.writeFileSync(this.OAUTH_CREDS_FILE, JSON.stringify(creds, null, 2), 'utf8');
  }

  public getSettings(): any {
    if (fs.existsSync(this.SETTINGS_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(this.SETTINGS_FILE, 'utf8'));
      } catch (e) {
        console.warn('Failed to parse settings.json', e);
      }
    }
    return {};
  }

  public saveSettings(newSettings: any) {
    let currentSettings = this.getSettings();

    // Deep merge logic for specific keys we care about
    if (newSettings.model) {
      currentSettings.model = { ...currentSettings.model, ...newSettings.model };
    }
    if (newSettings.tools) {
      currentSettings.tools = { ...currentSettings.tools, ...newSettings.tools };
    }

    fs.writeFileSync(this.SETTINGS_FILE, JSON.stringify(currentSettings, null, 2), 'utf8');
  }
}

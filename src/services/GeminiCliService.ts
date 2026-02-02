import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GeminiAccount } from '../types';

export class GeminiCliService {
  private readonly GEMINI_DIR = path.join(os.homedir(), '.gemini');
  private readonly SETTINGS_FILE = path.join(this.GEMINI_DIR, 'settings.json');

  constructor() {
    this.ensureGeminiDir();
  }

  private ensureGeminiDir() {
    if (!fs.existsSync(this.GEMINI_DIR)) {
      fs.mkdirSync(this.GEMINI_DIR, { recursive: true });
    }
  }

  public async updateCredentials(account: GeminiAccount): Promise<void> {
    const settings = this.readSettings();
    
    // Update or inject credentials
    // Note: The actual structure of .gemini/settings.json depends on the Gemini CLI tool.
    // Assuming standard OAuth structure often used by Google CLIs or a custom structure if this is a specific tool.
    // Based on the plan, we are just "injecting credentials".
    // Let's assume a structure that holds authentication info.
    
    /* 
       Hypothetical structure based on typical CLI tools:
       {
         "authentication": {
           "client_id": "...",
           "client_secret": "...",
           "refresh_token": "...",
           "access_token": "...",
           "token_expiry": ...
         },
         "project": "..."
       }
    */

    settings.authentication = {
      client_id: process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET_HERE',
      refresh_token: account.refreshToken,
      access_token: account.accessToken,
      token_expiry: account.expiresAt
    };

    if (account.projectId) {
      settings.project = account.projectId;
    }

    this.writeSettings(settings);
  }

  private readSettings(): any {
    if (fs.existsSync(this.SETTINGS_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(this.SETTINGS_FILE, 'utf8'));
      } catch (e) {
        console.warn('Failed to parse settings.json, starting fresh.', e);
        return {};
      }
    }
    return {};
  }

  private writeSettings(settings: any) {
    fs.writeFileSync(this.SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  }
}

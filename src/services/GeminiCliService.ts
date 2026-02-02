import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GeminiAccount } from '../types';

export class GeminiCliService {
  private readonly GEMINI_DIR = path.join(os.homedir(), '.gemini');
  private readonly GOOGLE_ACCOUNTS_FILE = path.join(this.GEMINI_DIR, 'google_accounts.json');
  private readonly OAUTH_CREDS_FILE = path.join(this.GEMINI_DIR, 'oauth_creds.json');

  constructor() {
    this.ensureGeminiDir();
  }

  private ensureGeminiDir() {
    if (!fs.existsSync(this.GEMINI_DIR)) {
      fs.mkdirSync(this.GEMINI_DIR, { recursive: true });
    }
  }

  public async updateCredentials(account: GeminiAccount): Promise<void> {
    await this.updateGoogleAccountsFile(account);
    await this.updateOAuthCredsFile(account);
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

  private async updateOAuthCredsFile(account: GeminiAccount) {
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
}

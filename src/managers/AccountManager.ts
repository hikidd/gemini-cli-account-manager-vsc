import * as vscode from 'vscode';
import { GeminiAccount } from '../types';
import { GeminiCliService } from '../services/GeminiCliService';
import { GoogleAuthService } from '../services/GoogleAuthService';

export class AccountManager {
  private context: vscode.ExtensionContext;
  private readonly ACCOUNTS_KEY = 'gemini-manager.accounts';
  private readonly LANGUAGE_KEY = 'gemini-manager.language';
  private _accounts: GeminiAccount[] = [];
  private cliService: GeminiCliService;
  private authService: GoogleAuthService;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.cliService = new GeminiCliService();
    this.authService = new GoogleAuthService();
    this.loadAccounts();
  }

  /**
   * Checks if an account's token is about to expire and refreshes it if necessary.
   */
  public async ensureValidToken(account: GeminiAccount): Promise<GeminiAccount> {
    const now = Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000;
    
    // Check if token is expired or about to expire in 5 minutes
    if (account.expiresAt && (now + FIVE_MINUTES) < account.expiresAt) {
      console.log(`[AccountManager] Token for ${account.email} is still valid.`);
      return account;
    }

    if (!account.refreshToken) {
      console.warn(`[AccountManager] No refresh token for ${account.email}, cannot refresh.`);
      return account;
    }

    try {
      console.log(`[AccountManager] Token for ${account.email} expired or expiring soon, refreshing...`);
      const tokens = await this.authService.refreshAccessToken(account.refreshToken);
      
      const updatedAccount: GeminiAccount = {
        ...account,
        accessToken: tokens.access_token,
        // Google might not return a new refresh token unless requested/needed
        refreshToken: tokens.refresh_token || account.refreshToken,
        expiresAt: Date.now() + (tokens.expires_in * 1000),
        idToken: tokens.id_token || account.idToken,
        tokenType: tokens.token_type || account.tokenType,
        scope: tokens.scope || account.scope
      };

      // Save to memory and extension state
      const idx = this._accounts.findIndex(a => a.id === account.id);
      if (idx !== -1) {
        this._accounts[idx] = updatedAccount;
        await this.persistAccounts();
      }

      // Sync to CLI credentials files if this is the active account
      if (updatedAccount.isActive) {
        console.log(`[AccountManager] Syncing refreshed token for ${updatedAccount.email} to CLI...`);
        await this.cliService.updateCredentials(updatedAccount);
      }

      return updatedAccount;
    } catch (error: any) {
      console.error(`[AccountManager] Failed to refresh token for ${account.email}:`, error.message);
      // We don't throw here to avoid crashing the flow, but the subsequent API call will likely fail (401)
      return account;
    }
  }

  public getLanguage(): 'zh' | 'en' {
    return this.context.globalState.get<'zh' | 'en'>(this.LANGUAGE_KEY) || 'zh';
  }

  public async setLanguage(lang: 'zh' | 'en'): Promise<void> {
    await this.context.globalState.update(this.LANGUAGE_KEY, lang);
  }

  public getSettings(): any {
    return this.cliService.getSettings();
  }

  public updateSettings(settings: any): void {
    this.cliService.saveSettings(settings);
  }

  private loadAccounts() {
    this._accounts = this.context.globalState.get<GeminiAccount[]>(this.ACCOUNTS_KEY) || [];
  }

  public getAccounts(): GeminiAccount[] {
    return this._accounts;
  }

  public getAccount(id: string): GeminiAccount | undefined {
    return this._accounts.find(a => a.id === id);
  }

  public async saveAccount(account: GeminiAccount): Promise<void> {
    // Check if account already exists (by email)
    const existingIndex = this._accounts.findIndex(a => a.email === account.email);
    
    if (existingIndex >= 0) {
      // Update existing
      this._accounts[existingIndex] = {
        ...this._accounts[existingIndex],
        ...account,
        // Keep ID and createdAt if not provided in update (though usually we pass full object)
        id: this._accounts[existingIndex].id, 
        createdAt: this._accounts[existingIndex].createdAt
      };
      
      // If we are setting this to active, deactivate others
      if (account.isActive) {
        this.setActiveAccount(this._accounts[existingIndex].id);
        return; // setActiveAccount handles saving
      }
    } else {
      // Add new
      if (this._accounts.length === 0) {
        account.isActive = true; // First account is active by default
      } else if (account.isActive) {
         // If new account is forced active, deactivate others
         this._accounts.forEach(a => a.isActive = false);
      }
      this._accounts.push(account);
    }

    await this.persistAccounts();
  }

  public async removeAccount(id: string): Promise<void> {
    this._accounts = this._accounts.filter(a => a.id !== id);
    await this.persistAccounts();
  }

  public async setActiveAccount(id: string): Promise<GeminiAccount | undefined> {
    let activatedAccount: GeminiAccount | undefined;
    
    this._accounts = this._accounts.map(a => {
      if (a.id === id) {
        activatedAccount = { ...a, isActive: true };
        return activatedAccount;
      }
      return { ...a, isActive: false };
    });

    await this.persistAccounts();
    return activatedAccount;
  }

  public getActiveAccount(): GeminiAccount | undefined {
    return this._accounts.find(a => a.isActive);
  }

  private async persistAccounts() {
    await this.context.globalState.update(this.ACCOUNTS_KEY, this._accounts);
  }
}

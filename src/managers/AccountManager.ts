import * as vscode from 'vscode';
import { GeminiAccount } from '../types';

export class AccountManager {
  private context: vscode.ExtensionContext;
  private readonly ACCOUNTS_KEY = 'gemini-manager.accounts';
  private readonly LANGUAGE_KEY = 'gemini-manager.language';
  private _accounts: GeminiAccount[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadAccounts();
  }

  public getLanguage(): 'zh' | 'en' {
    return this.context.globalState.get<'zh' | 'en'>(this.LANGUAGE_KEY) || 'zh';
  }

  public async setLanguage(lang: 'zh' | 'en'): Promise<void> {
    await this.context.globalState.update(this.LANGUAGE_KEY, lang);
  }

  private loadAccounts() {
    this._accounts = this.context.globalState.get<GeminiAccount[]>(this.ACCOUNTS_KEY) || [];
  }

  public getAccounts(): GeminiAccount[] {
    return this._accounts;
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

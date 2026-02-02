import * as vscode from 'vscode';
import { GeminiAccount } from '../types';

export class TerminalManager {
  private readonly TERMINAL_NAME = 'Gemini CLI';

  public async refreshTerminal(account: GeminiAccount, language: 'zh' | 'en' = 'zh') {
    // 1. Find and dispose existing terminals
    const terminals = vscode.window.terminals.filter(t => t.name === this.TERMINAL_NAME);
    for (const t of terminals) {
      t.dispose();
    }

    // 2. Create new terminal with updated environment
    // We can inject environment variables here if needed, 
    // or rely on the CLI picking up the updated ~/.gemini/settings.json
    
    // If the CLI tool reads from the config file we just updated in GeminiCliService,
    // we might not need to set env vars.
    // However, sometimes CLIs need explicit env vars.
    // The plan says "kill terminal -> inject credentials -> restart gemini".
    
    const terminal = vscode.window.createTerminal({
      name: this.TERMINAL_NAME,
      env: {
        // Inject tokens so the CLI tool can use them if it checks env vars
        'GEMINI_ACCESS_TOKEN': account.accessToken,
        'GEMINI_REFRESH_TOKEN': account.refreshToken,
        'GOOGLE_OAUTH_ACCESS_TOKEN': account.accessToken // Common fallback
      }
    });

    terminal.show();
    
    // Visual confirmation for the user
    const msg = language === 'zh' 
      ? `已切换账号上下文至: ${account.email}` 
      : `Switched context to: ${account.email}`;

    // Use echo for cross-platform compatibility (Windows CMD doesn't like # comments)
    terminal.sendText(`echo "---------------------------------------------"`);
    terminal.sendText(`echo "${msg} (${account.type || 'FREE'})"`);
    terminal.sendText(`echo "---------------------------------------------"`);
  }
}

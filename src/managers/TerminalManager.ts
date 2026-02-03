import * as vscode from 'vscode';
import { GeminiAccount } from '../types';

export class TerminalManager {
  private readonly TERMINAL_NAME = 'Gemini CLI';

  public async refreshTerminal(account: GeminiAccount, language: 'zh' | 'en' = 'zh', options?: { model?: string, isYolo?: boolean }) {
    // 1. Find and dispose existing terminals
    const terminals = vscode.window.terminals.filter(t => t.name === this.TERMINAL_NAME);
    for (const t of terminals) {
      t.dispose();
    }

    // 2. Create new terminal with updated environment
    const terminal = vscode.window.createTerminal({
      name: this.TERMINAL_NAME,
      env: {
        'GEMINI_ACCESS_TOKEN': account.accessToken,
        'GEMINI_REFRESH_TOKEN': account.refreshToken,
        'GOOGLE_OAUTH_ACCESS_TOKEN': account.accessToken
      }
    });

    terminal.show();
    
    const msg = language === 'zh' 
      ? `已切换账号上下文至: ${account.email}` 
      : `Switched context to: ${account.email}`;

    terminal.sendText(`echo "---------------------------------------------"`);
    terminal.sendText(`echo "${msg} (${account.type || 'FREE'})"`);
    terminal.sendText(`echo "---------------------------------------------"`);

    // Construct command
    let cmd = 'gemini';
    if (options?.model) {
      cmd += ` -m ${options.model}`;
    }
    if (options?.isYolo) {
      cmd += ` --yolo`;
    }

    terminal.sendText(cmd);
  }
}

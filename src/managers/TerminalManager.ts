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

  public async startProxyTerminal(port: number, key: string, language: 'zh' | 'en' = 'zh', options?: { model?: string, isYolo?: boolean }) {
    // 1. Dispose existing to ensure clean env (no conflicting OAuth tokens)
    const terminals = vscode.window.terminals.filter(t => t.name === this.TERMINAL_NAME);
    for (const t of terminals) {
      t.dispose();
    }

    // 2. Create new terminal WITHOUT OAuth tokens, but WITH Proxy envs
    const terminal = vscode.window.createTerminal({
      name: this.TERMINAL_NAME,
      env: {
        'GOOGLE_GEMINI_BASE_URL': `http://127.0.0.1:${port}`,
        'GEMINI_API_ENDPOINT': `http://127.0.0.1:${port}`,
        'GOOGLE_API_ENDPOINT': `http://127.0.0.1:${port}`,
        'API_ENDPOINT': `http://127.0.0.1:${port}`,
        'GEMINI_BASE_URL': `http://127.0.0.1:${port}`,
        'GEMINI_API_KEY': key,
        'GOOGLE_API_KEY': key, // Some SDKs/Tools prefer this
        // Ensure OAuth tokens are cleared/overridden if they exist in global env
        'GEMINI_ACCESS_TOKEN': '',
        'GEMINI_REFRESH_TOKEN': '',
        'GOOGLE_OAUTH_ACCESS_TOKEN': '',
        'GOOGLE_APPLICATION_CREDENTIALS': ''
      }
    });

    terminal.show();

    const msg = language === 'zh'
      ? `已启动本地代理模式 (Port: ${port})`
      : `Started Local Proxy Mode (Port: ${port})`;

    terminal.sendText(`echo "---------------------------------------------"`);
    terminal.sendText(`echo "${msg}"`);
    terminal.sendText(`echo "---------------------------------------------"`);

    // Construct command
    let cmd = 'gemini chat'; // Default to chat mode for proxy
    if (options?.model) {
      cmd += ` -m ${options.model}`;
    }
    if (options?.isYolo) {
      cmd += ` --yolo`;
    }

    terminal.sendText(cmd);
  }

  public async stopProxyTerminal(account: GeminiAccount | undefined, language: 'zh' | 'en' = 'zh') {
    // Just refresh back to normal mode if an account exists
    if (account) {
      await this.refreshTerminal(account, language);
    } else {
      // If no account, just unset envs in current terminal or close it
      // Since we can't easily unset envs in a created terminal session robustly across shells,
      // closing and notifying is safer, or just let user handle it.
      // But user asked to "set back". The best "set back" is to restore the normal session.
      const terminals = vscode.window.terminals.filter(t => t.name === this.TERMINAL_NAME);
      for (const t of terminals) {
        t.sendText('unset GEMINI_API_ENDPOINT');
        t.sendText('unset GEMINI_API_KEY');
        t.sendText('echo "Proxy Mode Deactivated. Returned to standard shell."');
      }
    }
  }
}

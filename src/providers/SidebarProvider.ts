import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AccountManager } from '../managers/AccountManager';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { GeminiCliService } from '../services/GeminiCliService';
import { TerminalManager } from '../managers/TerminalManager';
import { GeminiQuotaService } from '../services/GeminiQuotaService';
import { SessionManager } from '../managers/SessionManager';
import { Message } from '../types';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private context: vscode.ExtensionContext;
  private accountManager: AccountManager;
  private authService: GoogleAuthService;
  private cliService: GeminiCliService;
  private terminalManager: TerminalManager;
  private quotaService: GeminiQuotaService;
  private sessionManager: SessionManager;
  private refreshTimer?: NodeJS.Timeout;

  constructor(context: vscode.ExtensionContext, accountManager: AccountManager) {
    this.context = context;
    this.accountManager = accountManager;
    this.authService = new GoogleAuthService();
    this.cliService = new GeminiCliService();
    this.terminalManager = new TerminalManager();
    this.quotaService = new GeminiQuotaService();
    this.sessionManager = SessionManager.getInstance();
    
    // Start auto-refresh timer (every 15 minutes)
    this.startAutoRefresh();
  }

  private startAutoRefresh() {
    // Refresh every 15 minutes (15 * 60 * 1000)
    this.refreshTimer = setInterval(() => {
      console.log('[SidebarProvider] Triggering auto-refresh for all accounts...');
      this.refreshAllAccounts();
    }, 15 * 60 * 1000);
  }

  public dispose() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  private async refreshAllAccounts() {
    const accounts = this.accountManager.getAccounts();
    for (const account of accounts) {
        await this.performQuotaRefresh(account, true); // true = silent mode
    }
    await this.sendState();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'webview')),
        vscode.Uri.file(path.join(this.context.extensionPath, 'resources'))
      ]
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      undefined,
      this.context.subscriptions
    );
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const templatePath = path.join(this.context.extensionPath, 'src', 'webview', 'template.html');
    let html = fs.readFileSync(templatePath, 'utf8');

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'webview', 'script.js'))
    );
    const styleUri = webview.asWebviewUri(
        vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'webview', 'style.css'))
    );

    html = html.replace('{{SCRIPT_URI}}', scriptUri.toString());
    html = html.replace('{{STYLE_URI}}', styleUri.toString());

    const nonce = this.getNonce();
    html = html.replace(
      '<head>',
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:;">
    `);
    html = html.replace('<script src=', `<script nonce="${nonce}" src=`)

    return html;
  }

  private async handleMessage(message: Message): Promise<void> {
    try {
      switch (message.type) {
        case 'loginWithGoogle':
          await this.handleLogin();
          break;
        case 'switchAccount':
          await this.handleSwitchAccount(message.payload.id);
          break;
        case 'removeAccount':
          await this.handleRemoveAccount(message.payload.id);
          break;
        case 'setLanguage':
          await this.handleSetLanguage(message.payload.language);
          break;
        case 'getState':
          await this.sendState();
          break;
        case 'refreshQuota':
          await this.handleRefreshQuota(message.payload.id);
          break;
        case 'openFile':
          await this.handleOpenFile(message.payload.file);
          break;
        case 'restart':
          await this.handleRestart();
          break;
        case 'openUrl':
          await this.handleOpenUrl(message.payload.url);
          break;
        case 'updateSettings':
          await this.handleUpdateSettings(message.payload);
          break;
        case 'refreshAll':
          await this.handleRefreshAll();
          break;
        case 'listSessions':
          await this.handleListSessions();
          break;
        case 'loadSession':
          await this.handleLoadSession(message.payload.filename);
          break;
        case 'deleteSession':
          await this.handleDeleteSession(message.payload.filename);
          break;
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`Error: ${error.message}`);
      this.sendError(error.message);
    }
  }

  private async handleRefreshAll() {
    await this.refreshAllAccounts();
    const lang = this.accountManager.getLanguage();
    vscode.window.showInformationMessage(lang === 'zh' ? '所有账号配额已刷新' : 'All accounts refreshed');
  }

  private async handleUpdateSettings(payload: any) {
    this.accountManager.updateSettings(payload);
    await this.sendState();
  }

  private async handleOpenFile(file: string) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const geminiDir = path.join(homeDir, '.gemini');
      let targetPath = '';

      if (file === 'rules') {
          targetPath = path.join(geminiDir, 'GEMINI.md');
      } else if (file === 'mcp') {
          targetPath = path.join(geminiDir, 'settings.json'); 
      }

      if (targetPath && fs.existsSync(targetPath)) {
          const doc = await vscode.workspace.openTextDocument(targetPath);
          await vscode.window.showTextDocument(doc);
      } else {
          // If file doesn't exist, try opening the directory or notify
           if (fs.existsSync(geminiDir)) {
               // Try to open a default file or just warn
                vscode.window.showWarningMessage(`File not found: ${targetPath}. Opening directory...`);
                // There isn't a direct "open directory" in VSCode API like openTextDocument, 
                // but we can try to find *any* file or just tell the user.
                // Better: Create the file if it's 'rules' (GEMINI.md) as it's common.
                if (file === 'rules') {
                    fs.writeFileSync(targetPath, '# Gemini Rules\n\nAdd your rules here.');
                    const doc = await vscode.workspace.openTextDocument(targetPath);
                    await vscode.window.showTextDocument(doc);
                    return;
                }
           }
           vscode.window.showErrorMessage(`File not found: ${targetPath}`);
      }
  }

  private getTerminalOptions() {
      const settings = this.accountManager.getSettings();
      return {
          model: settings.model?.name,
          isYolo: settings.tools?.autoAccept
      };
  }

  private async handleRestart() {
      const activeAccount = this.accountManager.getActiveAccount();
      const lang = this.accountManager.getLanguage();

      const message = lang === 'zh'
        ? "重启将关闭当前终端。请确保已保存当前对话。确定继续吗？"
        : "Restarting will close the current terminal. Please ensure you have saved your current session. Continue?";
      
      const confirmBtn = lang === 'zh' ? "确定" : "Continue";
  
      const selection = await vscode.window.showWarningMessage(
        message,
        { modal: true },
        confirmBtn
      );
  
      if (selection !== confirmBtn) {
        return;
      }

      if (activeAccount) {
          await this.terminalManager.refreshTerminal(activeAccount, lang, this.getTerminalOptions());
          vscode.window.showInformationMessage(lang === 'zh' ? 'Gemini CLI 已重启' : 'Gemini CLI Restarted');
      } else {
          vscode.window.showWarningMessage(lang === 'zh' ? '没有激活的账号' : 'No active account');
      }
  }

  private async handleOpenUrl(url: string) {
      vscode.env.openExternal(vscode.Uri.parse(url));
  }

  private async handleRefreshQuota(id: string) {
    const account = this.accountManager.getAccount(id);
    if (!account) return;

    await this.performQuotaRefresh(account, false); // false = show notification
    await this.sendState();
  }

  private async performQuotaRefresh(account: any, silent: boolean = false) {
    // Check if token needs refresh (buffer 5 minutes)
    if (Date.now() > account.expiresAt - 5 * 60 * 1000) {
      try {
        console.log(`[SidebarProvider] Token expired or soon to expire for ${account.email}, refreshing...`);
        const tokens = await this.authService.refreshAccessToken(account.refreshToken);
        
        // Update account with new tokens
        account.accessToken = tokens.access_token;
        account.expiresAt = Date.now() + (tokens.expires_in * 1000);
        if (tokens.refresh_token) {
          account.refreshToken = tokens.refresh_token;
        }
        
        await this.accountManager.saveAccount(account);
        if (account.isActive) {
           await this.cliService.updateCredentials(account);
        }
        console.log(`[SidebarProvider] Token refreshed successfully.`);
      } catch (error: any) {
        console.error(`[SidebarProvider] Failed to refresh token: ${error.message}`);
        if (!silent) {
            vscode.window.showErrorMessage(`Failed to refresh session for ${account.email}. Please login again.`);
        }
        return;
      }
    }

    // Refresh Project ID & Quota & Account Type
    const accountInfo = await this.quotaService.fetchAccountInfo(account);
    if (accountInfo.projectId) {
      account.projectId = accountInfo.projectId;
    }
    if (accountInfo.type) {
      account.type = accountInfo.type;
    }
    if (accountInfo.tierId) {
      account.tierId = accountInfo.tierId;
    }
    
    const quotaData = await this.quotaService.fetchQuota(account);
    if (quotaData && quotaData.buckets) {
      account.quota = { buckets: quotaData.buckets };
    }

    account.lastRefreshed = Date.now();

    await this.accountManager.saveAccount(account);
    
    if (!silent) {
        vscode.window.showInformationMessage(`Quota refreshed for ${account.email}`);
    }
  }

  private async handleLogin() {
    const account = await this.authService.startLogin();
    
    // 1. Fetch Project ID & Account Type
    const accountInfo = await this.quotaService.fetchAccountInfo(account);
    if (accountInfo.projectId) {
      account.projectId = accountInfo.projectId;
    }
    if (accountInfo.type) {
      account.type = accountInfo.type;
    }
    if (accountInfo.tierId) {
      account.tierId = accountInfo.tierId;
    }

    // 2. Fetch Quota
    const quotaData = await this.quotaService.fetchQuota(account);
    if (quotaData && quotaData.buckets) {
      account.quota = { buckets: quotaData.buckets };
    }

    await this.accountManager.saveAccount(account);
    await this.accountManager.setActiveAccount(account.id); // Auto-switch
    await this.cliService.updateCredentials(account);
    
    const lang = this.accountManager.getLanguage();
    await this.terminalManager.refreshTerminal(account, lang, this.getTerminalOptions());
    
    await this.sendState();
    vscode.window.showInformationMessage(`Successfully logged in as ${account.email}`);
  }

  private async handleSwitchAccount(id: string) {
    const lang = this.accountManager.getLanguage();
    const message = lang === 'zh'
      ? "切换账号将重启终端。请确保已保存当前对话（例如使用 '/chat save'）。确定继续吗？"
      : "Switching accounts will restart the terminal. Please ensure you have saved your current session (e.g. '/chat save'). Continue?";
    
    const confirmBtn = lang === 'zh' ? "确定" : "Continue";

    const selection = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      confirmBtn
    );

    if (selection !== confirmBtn) {
      return;
    }

    const account = await this.accountManager.setActiveAccount(id);
    if (account) {
      // Refresh Project ID & Quota & Type on switch
      const accountInfo = await this.quotaService.fetchAccountInfo(account);
      if (accountInfo.projectId) {
        account.projectId = accountInfo.projectId;
      }
      if (accountInfo.type) {
        account.type = accountInfo.type;
      }
      if (accountInfo.tierId) {
        account.tierId = accountInfo.tierId;
      }
      
      const quotaData = await this.quotaService.fetchQuota(account);
      if (quotaData && quotaData.buckets) {
        account.quota = { buckets: quotaData.buckets };
      }
      // Save the updated info (projectId/quota) back to storage
      await this.accountManager.saveAccount(account);

      await this.cliService.updateCredentials(account);
      
      // lang is already fetched
      await this.terminalManager.refreshTerminal(account, lang, this.getTerminalOptions());
      
      await this.sendState();
      vscode.window.showInformationMessage(`Switched to ${account.email}`);
    }
  }

  private async handleRemoveAccount(id: string) {
    const lang = this.accountManager.getLanguage();
    const message = lang === 'zh' ? '确定要移除该账号吗？' : 'Are you sure you want to remove this account?';
    const confirmBtn = lang === 'zh' ? '确定' : 'Yes';
    
    const answer = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      confirmBtn
    );

    if (answer === confirmBtn) {
      await this.accountManager.removeAccount(id);
      await this.sendState();
    }
  }

  private async handleSetLanguage(language: 'zh' | 'en') {
    await this.accountManager.setLanguage(language);
    await this.sendState();
  }

  private async handleListSessions() {
    const sessions = await this.sessionManager.listSessions();
    if (this.view) {
        this.view.webview.postMessage({
            type: 'updateSessions',
            payload: { sessions }
        });
    }
  }

  private async handleLoadSession(filename: string) {
    const session = await this.sessionManager.getSession(filename);
    if (!session) {
        vscode.window.showErrorMessage('Failed to load session');
        return;
    }

    const lang = this.accountManager.getLanguage();
    const message = lang === 'zh'
      ? "加载历史会话将覆盖当前终端内容。确定继续吗？"
      : "Loading a history session will overwrite the current terminal content. Continue?";
    const confirmBtn = lang === 'zh' ? "确定" : "Continue";

    const selection = await vscode.window.showWarningMessage(message, { modal: true }, confirmBtn);
    if (selection !== confirmBtn) {
        return;
    }

    // Reuse terminal manager to send commands
    // We can't easily "restore" the state into the CLI process itself unless the CLI supports importing sessions.
    // However, the user request is about "managing" sessions. 
    // If the goal is just to VIEW the session, we can show it in a webview or output channel.
    // If the goal is to RESUME, we might need to send the history to the CLI.
    // Based on the gemini-cli features, it supports resume via flags or /resume command.
    // But since we are already running the terminal, maybe we can use /chat load <file>?
    // Or restart the terminal with --resume <id>.
    
    // Let's try to restart the terminal with the session ID if possible, 
    // or just show the content in a new editor for now as a safe step.
    
    // Re-reading requirements: "gemini cli itself unless manual /chat save... manage sessions... nice feature"
    // The user wants to manage sessions.
    
    // Strategy:
    // 1. Show the session content in a read-only editor.
    // 2. Offer to "Resume" which would restart the terminal with `gemini --resume <session_id>` or sending `/chat resume <id>` if supported.
    // Looking at CLI docs/help found online: `gemini --resume <uuid>` is supported.
    
    const activeAccount = this.accountManager.getActiveAccount();
    if (activeAccount) {
        // Restart terminal with --resume flag
        // We need to update TerminalManager to support passing extra args or handle this specific case.
        // For now, let's open the JSON file so the user can see it, and maybe copy the ID.
        // BETTER: Use TerminalManager to send `/chat load <id>` if that works, or restart with flag.
        // Since we don't want to change TerminalManager too much blindly, let's try to restart with the resume flag.
        
        // Actually, the simplest way to "resume" a specific session ID is likely passing it during startup.
        // Let's modify the terminal options to include resumeSessionId.
        
        await this.terminalManager.refreshTerminal(activeAccount, lang, {
            ...this.getTerminalOptions(),
            resumeSessionId: session.sessionId
        });
        
        vscode.window.showInformationMessage(lang === 'zh' ? '会话已加载' : 'Session loaded');
    }
  }

  private async handleDeleteSession(filename: string) {
    const lang = this.accountManager.getLanguage();
    const confirm = await vscode.window.showWarningMessage(
        lang === 'zh' ? '确定删除此会话？' : 'Delete this session?',
        { modal: true },
        lang === 'zh' ? '删除' : 'Delete'
    );
    
    if (confirm) {
        await this.sessionManager.deleteSession(filename);
        await this.handleListSessions(); // Refresh list
    }
  }

  private async sendState() {
    if (!this.view) return;
    const accounts = this.accountManager.getAccounts();
    const language = this.accountManager.getLanguage();
    const settings = this.accountManager.getSettings();
    const sessions = await this.sessionManager.listSessions();
    this.view.webview.postMessage({
      type: 'updateState',
      payload: { accounts, language, settings, sessions }
    });
  }

  private sendError(message: string) {
    if (!this.view) return;
    this.view.webview.postMessage({
      type: 'error',
      payload: { message }
    });
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
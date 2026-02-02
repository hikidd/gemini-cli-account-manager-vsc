import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AccountManager } from '../managers/AccountManager';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { GeminiCliService } from '../services/GeminiCliService';
import { TerminalManager } from '../managers/TerminalManager';
import { GeminiQuotaService } from '../services/GeminiQuotaService';
import { Message } from '../types';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private context: vscode.ExtensionContext;
  private accountManager: AccountManager;
  private authService: GoogleAuthService;
  private cliService: GeminiCliService;
  private terminalManager: TerminalManager;
  private quotaService: GeminiQuotaService;

  constructor(context: vscode.ExtensionContext, accountManager: AccountManager) {
    this.context = context;
    this.accountManager = accountManager;
    this.authService = new GoogleAuthService();
    this.cliService = new GeminiCliService();
    this.terminalManager = new TerminalManager();
    this.quotaService = new GeminiQuotaService();
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
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`Error: ${error.message}`);
      this.sendError(error.message);
    }
  }

  private async handleRefreshQuota(id: string) {
    const account = this.accountManager.getAccount(id);
    if (!account) return;

    // Refresh Project ID & Quota
    const projectId = await this.quotaService.fetchProjectId(account);
    if (projectId) {
      account.projectId = projectId;
    }
    
    const quotaData = await this.quotaService.fetchQuota(account);
    if (quotaData && quotaData.buckets) {
      account.quota = { buckets: quotaData.buckets };
    }

    await this.accountManager.saveAccount(account);
    await this.sendState();
    vscode.window.showInformationMessage(`Quota refreshed for ${account.email}`);
  }

  private async handleLogin() {
    const account = await this.authService.startLogin();
    
    // 1. Fetch Project ID
    const projectId = await this.quotaService.fetchProjectId(account);
    if (projectId) {
      account.projectId = projectId;
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
    await this.terminalManager.refreshTerminal(account, lang);
    
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
      // Refresh Project ID & Quota on switch
      const projectId = await this.quotaService.fetchProjectId(account);
      if (projectId) {
        account.projectId = projectId;
      }
      
      const quotaData = await this.quotaService.fetchQuota(account);
      if (quotaData && quotaData.buckets) {
        account.quota = { buckets: quotaData.buckets };
      }
      // Save the updated info (projectId/quota) back to storage
      await this.accountManager.saveAccount(account);

      await this.cliService.updateCredentials(account);
      
      // lang is already fetched
      await this.terminalManager.refreshTerminal(account, lang);
      
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

  private async sendState() {
    if (!this.view) return;
    const accounts = this.accountManager.getAccounts();
    const language = this.accountManager.getLanguage();
    this.view.webview.postMessage({
      type: 'updateState',
      payload: { accounts, language }
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
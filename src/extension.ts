import * as vscode from 'vscode';
import { AccountManager } from './managers/AccountManager';
import { SidebarProvider } from './providers/SidebarProvider';
import { ProxyService } from './services/ProxyService';

export function activate(context: vscode.ExtensionContext) {
  console.log('Gemini CLI Account Manager is now active!');

  // Initialize Account Manager
  const accountManager = new AccountManager(context);

  // Initialize Proxy Service
  const proxyService = new ProxyService(accountManager);
  context.subscriptions.push({ dispose: () => proxyService.stop() });

  // Register Sidebar Provider
  const sidebarProvider = new SidebarProvider(context, accountManager, proxyService);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gemini-manager.sidebarView', sidebarProvider)
  );
  
  // Ensure SidebarProvider is disposed (to stop timers etc)
  context.subscriptions.push({ dispose: () => sidebarProvider.dispose() });

  // Register Command to Open Panel
  context.subscriptions.push(
    vscode.commands.registerCommand('gemini-manager.openPanel', () => {
      vscode.commands.executeCommand('gemini-manager.sidebarView.focus');
    })
  );
}

export function deactivate() {}

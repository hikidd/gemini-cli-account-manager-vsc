import * as vscode from 'vscode';
import { AccountManager } from './managers/AccountManager';
import { SidebarProvider } from './providers/SidebarProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('Gemini CLI Account Manager is now active!');

  // Initialize Account Manager
  const accountManager = new AccountManager(context);

  // Register Sidebar Provider
  const sidebarProvider = new SidebarProvider(context, accountManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gemini-manager.sidebarView', sidebarProvider)
  );

  // Register Command to Open Panel
  context.subscriptions.push(
    vscode.commands.registerCommand('gemini-manager.openPanel', () => {
      vscode.commands.executeCommand('gemini-manager.sidebarView.focus');
    })
  );
}

export function deactivate() {}
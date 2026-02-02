import * as vscode from 'vscode';
import { GeminiAccount } from '../types';

export class TerminalManager {
  private readonly TERMINAL_NAME = 'Gemini CLI';

  public async refreshTerminal(account: GeminiAccount) {
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
        // Optional: Override env vars if the CLI supports it, 
        // strictly speaking `GeminiCliService` handles the file persistence.
        // 'GOOGLE_APPLICATION_CREDENTIALS': ... (if using key file)
      }
    });

    terminal.show();
    
    // Optional: Run a command to verify or start the session
    // terminal.sendText('gemini info'); // Hypothetical command
  }
}

import * as http from 'http';
import * as https from 'https';
import * as vscode from 'vscode';
import { AccountManager } from '../managers/AccountManager';
import { GeminiAccount } from '../types';
import { URL } from 'url';

export class ProxyService {
  private server: http.Server | null = null;
  private accountManager: AccountManager;
  private isRunning: boolean = false;
  private port: number = 8000;
  private proxyKey: string = ''; // The key client needs to provide
  private currentAccountIndex: number = 0;
  private _onStatusChange = new vscode.EventEmitter<{ running: boolean; port: number; activeAccounts: number }>();
  public readonly onStatusChange = this._onStatusChange.event;

  constructor(accountManager: AccountManager) {
    this.accountManager = accountManager;
  }

  public start(port: number, proxyKey: string) {
    if (this.isRunning) {
      this.stop();
    }

    this.port = port;
    this.proxyKey = proxyKey;

    this.server = http.createServer(async (req, res) => {
      // 1. CORS & Basic Checks
      this.handleCors(res);
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // 2. Validate Proxy Key
      // gemini-cli sends key in 'x-goog-api-key' header or 'key' query param
      const clientKey = (req.headers['x-goog-api-key'] as string) ||
        (req.headers['x-api-key'] as string) ||
        this.getQueryParam(req.url, 'key');

      if (this.proxyKey && clientKey !== this.proxyKey) {
        console.warn(`[Proxy] Auth Failed. Expected: ${this.proxyKey}, Got: ${clientKey || 'None'}`);
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `[Proxy] Invalid Proxy API Key. Received: ${clientKey ? '***' : 'None'}` }));
        return;
      }

      // 3. Prepare Accounts (Load Balance Pool)
      // Filter only valid accounts (simplified: those with access tokens)
      const accounts = this.accountManager.getAccounts().filter(a => a.accessToken);
      if (accounts.length === 0) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No active Google accounts available in Account Manager' }));
        return;
      }

      // 4. Read Request Body
      const body = await this.readRequestBody(req);

      // 5. Forward with Retry Logic
      await this.tryForwardRequest(req, res, body, accounts);
    });

    this.server.listen(this.port, () => {
      this.isRunning = true;
      this.emitStatus();
      console.log(`Gemini Proxy Server running on port ${this.port}`);
    });

    this.server.on('error', (err: any) => {
      vscode.window.showErrorMessage(`Proxy Server Error: ${err.message}`);
      this.stop();
    });
  }

  public stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.isRunning = false;
    this.emitStatus();
  }

  public getStatus() {
    const validAccounts = this.accountManager.getAccounts().filter(a => a.accessToken).length;
    return {
      running: this.isRunning,
      port: this.port,
      activeAccounts: validAccounts
    };
  }

  private emitStatus() {
    this._onStatusChange.fire(this.getStatus());
  }

  private handleCors(res: http.ServerResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
  }

  private getQueryParam(urlStr: string | undefined, param: string): string | undefined {
    if (!urlStr) return undefined;
    try {
      // Dummy base because req.url is just the path
      const u = new URL(urlStr, 'http://localhost');
      return u.searchParams.get(param) || undefined;
    } catch {
      return undefined;
    }
  }

  private readRequestBody(req: http.IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  /**
   * Core Load Balancing & Retry Logic
   */
  private async tryForwardRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: Buffer,
    accounts: GeminiAccount[],
    retryCount: number = 0
  ) {
    // Round-Robin Selection
    const accountIndex = (this.currentAccountIndex + retryCount) % accounts.length;
    const account = accounts[accountIndex];

    // Update global index for next request (advance by 1)
    if (retryCount === 0) {
      this.currentAccountIndex = (this.currentAccountIndex + 1) % accounts.length;
    }

    try {
      console.log(`\n========================================`);
      console.log(`[Proxy] 📨 Received Request: ${req.method} ${req.url}`);
      console.log(`[Proxy] 👤 Using Account [${accountIndex + 1}/${accounts.length}]: ${account.email}`);
      console.log(`[Proxy] 🔄 Round-Robin Index: ${accountIndex} (Next will be: ${(accountIndex + 1) % accounts.length})`);
      if (retryCount > 0) {
        console.log(`[Proxy] 🔁 Retry Attempt: ${retryCount}/${accounts.length - 1}`);
      }
      console.log(`========================================`);

      // 1. Simple path cleanup (remove key params, keep original path)
      let targetPath = req.url || '/';

      try {
        const u = new URL(targetPath, 'http://localhost');

        // Delete ANY param that looks like a key
        const keysToDelete: string[] = [];
        u.searchParams.forEach((_, key) => {
          if (key.toLowerCase().includes('key')) {
            keysToDelete.push(key);
          }
        });
        keysToDelete.forEach(k => u.searchParams.delete(k));

        targetPath = u.pathname + u.search;
        console.log(`[Proxy] Cleaned path: ${targetPath}`);
      } catch (e) {
        console.error('[Proxy] URL Parsing Error:', e);
      }

      // 2. Prepare Headers - NO BODY TRANSFORMATION, DIRECT PASSTHROUGH
      const headers = { ...req.headers };
      delete headers['x-goog-api-key'];
      delete headers['X-Goog-Api-Key'];
      delete headers['x-api-key'];
      delete headers['authorization'];
      delete headers['Authorization'];
      delete headers['host'];
      delete headers['connection'];

      // Inject OAuth token for generativelanguage.googleapis.com
      headers['host'] = 'generativelanguage.googleapis.com';
      headers['authorization'] = `Bearer ${account.accessToken}`;
      headers['content-length'] = body.length.toString();

      console.log(`[Proxy] ✅ Direct passthrough to generativelanguage.googleapis.com`);
      console.log(`[Proxy] 🔑 Using OAuth Token from account: ${account.email}`);

      const options: https.RequestOptions = {
        hostname: 'generativelanguage.googleapis.com',
        port: 443,
        path: targetPath,
        method: req.method,
        headers: headers
      };

      const proxyReq = https.request(options, (proxyRes) => {
        // Collect response data first to decide whether to retry
        const responseChunks: Buffer[] = [];

        proxyRes.on('data', chunk => responseChunks.push(chunk));

        proxyRes.on('end', () => {
          const statusCode = proxyRes.statusCode || 500;

          // Handle retryable errors: 429 (Rate Limit) and 403 (Permission Denied)
          if ((statusCode === 429 || statusCode === 403) && retryCount < accounts.length - 1) {
            const responseBody = Buffer.concat(responseChunks).toString();
            console.error(`[Proxy] Account ${account.email} error ${statusCode}:`, responseBody);
            console.log(`[Proxy] Switching to next account (retry ${retryCount + 1}/${accounts.length - 1})...`);

            // Retry with next account
            this.tryForwardRequest(req, res, body, accounts, retryCount + 1);
            return;
          }

          // All accounts exhausted or non-retryable error
          if (statusCode === 429 || statusCode === 403) {
            if (retryCount >= accounts.length - 1) {
              const errorBody = Buffer.concat(responseChunks).toString();
              console.error(`[Proxy] ❌ All ${accounts.length} accounts exhausted.`);
              console.error(`[Proxy] 📋 Final Error ${statusCode}:`, errorBody);
              res.writeHead(statusCode, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: `All accounts unavailable (${statusCode === 429 ? 'rate limited' : 'insufficient permissions'})`,
                details: errorBody
              }));
              return;
            }
          }

          // Log error details for debugging
          if (statusCode >= 400) {
            const errorBody = Buffer.concat(responseChunks).toString();
            console.error(`[Proxy] Upstream Error ${statusCode}:`, errorBody);
          }

          // Forward response to client
          res.writeHead(statusCode, proxyRes.headers);
          res.end(Buffer.concat(responseChunks));
        });
      });

      proxyReq.on('error', (e) => {
        console.error('[Proxy] Request Error:', e);
        if (!res.headersSent) {
          res.writeHead(502);
          res.end(JSON.stringify({ error: 'Upstream connection failed' }));
        }
      });

      // Write Body (direct passthrough, no transformation)
      proxyReq.write(body);
      proxyReq.end();

    } catch (error) {
      console.error('[Proxy] Critical Error:', error);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Internal Proxy Error' }));
      }
    }
  }
}

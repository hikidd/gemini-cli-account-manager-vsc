import * as http from 'http';
import * as url from 'url';
import * as vscode from 'vscode';
import { GeminiAccount } from '../types';
import * as crypto from 'crypto';

export class GoogleAuthService {
  private readonly CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE';
  private readonly CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET_HERE';
  private readonly REDIRECT_URI = 'http://localhost:8085/oauth2callback';
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  public async startLogin(): Promise<GeminiAccount> {
    const code = await this.startLocalServer();
    const tokens = await this.exchangeCodeForToken(code);
    const userInfo = await this.getUserInfo(tokens.access_token);

    return {
      id: crypto.randomUUID(),
      email: userInfo.email,
      projectId: 'gemini-cli-project', // Default or fetched if possible. 
      // Note: Getting default project from Google API is not always straightforward without extra steps.
      // We might need to ask user or list projects. 
      // For now, let's use a placeholder or prompt the user later if needed.
      // Actually, standard Gemini CLI setup might default to a specific project logic.
      // But let's check if we can get it or just leave it empty for now and let user config it?
      // The requirement says "projectId" in GeminiAccount.
      // Let's leave it as a placeholder or empty string for now if not found.
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
      isActive: false,
      createdAt: new Date().toISOString(),
      avatarUrl: userInfo.picture,
      type: 'FREE' // Default to Free tier
    };
  }

  private startLocalServer(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          const parsedUrl = url.parse(req.url!, true);
          
          if (parsedUrl.pathname === '/oauth2callback') {
            const code = parsedUrl.query.code as string;
            
            if (code) {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end('<h1>登录成功!</h1><p>您可以关闭此窗口并返回 VS Code。</p><script>window.close()</script>');
              resolve(code);
            } else {
              res.writeHead(400);
              res.end('Authorization code not found.');
              reject(new Error('Authorization code not found.'));
            }
            
            server.close();
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
        } catch (error) {
          reject(error);
          server.close();
        }
      });

      server.listen(8085, () => {
        // Open browser
        const authUrl = this.getAuthUrl();
        vscode.env.openExternal(vscode.Uri.parse(authUrl));
      });

      server.on('error', (err) => {
        reject(err);
      });
    });
  }

  private getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.CLIENT_ID,
      redirect_uri: this.REDIRECT_URI,
      response_type: 'code',
      scope: this.SCOPES.join(' '),
      access_type: 'offline', // Important for refresh_token
      prompt: 'select_account' // Force account selection to allow adding different users
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private async exchangeCodeForToken(code: string): Promise<any> {
    const params = new URLSearchParams({
      code: code,
      client_id: this.CLIENT_ID,
      client_secret: this.CLIENT_SECRET,
      redirect_uri: this.REDIRECT_URI,
      grant_type: 'authorization_code'
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    return await response.json();
  }

  private async getUserInfo(accessToken: string): Promise<any> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    return await response.json();
  }
}

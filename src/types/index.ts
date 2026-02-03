export interface GeminiAccount {
  id: string;                    // UUID
  email: string;                 // Google 邮箱
  projectId: string;             // GCP 项目 ID
  accessToken: string;
  refreshToken: string;
  expiresAt: number;             // 过期时间戳（毫秒）
  idToken?: string;              // OIDC ID Token
  tokenType?: string;            // Bearer etc.
  scope?: string;                // OAuth scopes
  isActive: boolean;
  createdAt: string;
  avatarUrl?: string;            // 用户头像 URL
  type?: 'FREE' | 'PRO' | 'ULTRA'; // 账号类型
  tierId?: string;               // 原始 Tier ID (用于调试)
  lastRefreshed?: number;        // 上次刷新配额时间戳
  quota?: {
    buckets: Array<{
      modelId: string;
      remainingFraction: number;
      resetTime?: string;
    }>;
  };
}

export type MessageType = 
  | 'loginWithGoogle'
  | 'switchAccount'
  | 'removeAccount'
  | 'setLanguage'
  | 'getState'
  | 'updateState'
  | 'error'
  | 'success'
  | 'refreshQuota'
  | 'openFile'
  | 'restart'
  | 'openUrl';

export interface Message {
  type: MessageType;
  payload?: any;
}

export interface ExtensionState {
  accounts: GeminiAccount[];
  language: 'zh' | 'en';
}

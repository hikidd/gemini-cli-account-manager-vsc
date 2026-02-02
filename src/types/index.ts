export interface GeminiAccount {
  id: string;                    // UUID
  email: string;                 // Google 邮箱
  projectId: string;             // GCP 项目 ID
  accessToken: string;
  refreshToken: string;
  expiresAt: number;             // 过期时间戳（毫秒）
  isActive: boolean;
  createdAt: string;
  avatarUrl?: string;            // 用户头像 URL
}

export type MessageType = 
  | 'loginWithGoogle'
  | 'switchAccount'
  | 'removeAccount'
  | 'setLanguage'
  | 'getState'
  | 'updateState'
  | 'error'
  | 'success';

export interface Message {
  type: MessageType;
  payload?: any;
}

export interface ExtensionState {
  accounts: GeminiAccount[];
  language: 'zh' | 'en';
}

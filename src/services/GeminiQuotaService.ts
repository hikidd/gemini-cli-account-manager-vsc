import axios from 'axios';
import { GeminiAccount } from '../types';

interface QuotaResponse {
  buckets?: Array<{
    modelId: string;
    remainingFraction: number;
    resetTime?: string;
    tokenType?: string;
  }>;
}

interface LoadCodeAssistResponse {
  cloudaicompanionProject?: {
    id: string; // The Project ID
    number: string;
  };
  currentTier?: {
    id: string;
    name: string;
  };
}

export class GeminiQuotaService {
  private readonly BASE_URL = 'https://cloudcode-pa.googleapis.com/v1internal';

  /**
   * Fetches the Project ID associated with the account's token.
   * This mimics the 'loadCodeAssist' call from the official CLI.
   */
  public async fetchProjectId(account: GeminiAccount): Promise<string | undefined> {
    try {
      console.log(`[GeminiQuotaService] Fetching Project ID for ${account.email}...`);
      const response = await axios.post<LoadCodeAssistResponse>(
        `${this.BASE_URL}:loadCodeAssist`,
        {}, 
        {
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`[GeminiQuotaService] Project ID response:`, response.data);
      return response.data.cloudaicompanionProject?.id;
    } catch (error: any) {
      console.error('[GeminiQuotaService] Failed to fetch Project ID:', error.response?.data || error.message);
      
      // Fallback to hardcoded ID for debugging/development
      const fallbackId = 'astute-impulse-485515-q7';
      console.warn(`[GeminiQuotaService] Using fallback Project ID: ${fallbackId}`);
      return fallbackId;
    }
  }

  /**
   * Fetches the quota/usage limits for the account.
   */
  public async fetchQuota(account: GeminiAccount): Promise<QuotaResponse | null> {
    if (!account.projectId) {
      // Try to fetch it if missing
      const fetchedId = await this.fetchProjectId(account);
      if (fetchedId) {
        account.projectId = fetchedId;
      } else {
        console.warn('[GeminiQuotaService] Cannot fetch quota: Missing Project ID');
        return null;
      }
    }

    try {
      console.log(`[GeminiQuotaService] Fetching Quota for ${account.email} (Project: ${account.projectId})...`);
      const response = await axios.post<QuotaResponse>(
        `${this.BASE_URL}:retrieveUserQuota`,
        {
          project: account.projectId
        },
        {
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`[GeminiQuotaService] Quota response:`, JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error: any) {
      console.error('[GeminiQuotaService] Failed to fetch quota:', error.response?.data || error.message);
      return null;
    }
  }
}

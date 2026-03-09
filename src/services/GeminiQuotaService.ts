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
  cloudaicompanionProject?: string | {
    id: string; // The Project ID
    number: string;
  };
  currentTier?: {
    id: string;
    name: string;
  };
  paidTier?: {
    id: string;
    name: string;
  };
}

export class GeminiQuotaService {
  private readonly BASE_URL = 'https://cloudcode-pa.googleapis.com/v1internal';

  /**
   * Fetches the Project ID and Account Tier associated with the account's token.
   * This mimics the 'loadCodeAssist' call from the official CLI.
   */
  public async fetchAccountInfo(account: GeminiAccount): Promise<{ projectId?: string; type?: 'FREE' | 'PRO' | 'ULTRA'; tierId?: string }> {
    try {
      console.log(`[GeminiQuotaService] Fetching Account Info for ${account.email}...`);
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
      
      console.log(`[GeminiQuotaService] Account Info response:`, JSON.stringify(response.data, null, 2));
      
      let projectId: string | undefined;
      const rawProject = response.data.cloudaicompanionProject;
      if (typeof rawProject === 'string') {
        projectId = rawProject;
      } else {
        projectId = rawProject?.id;
      }

      let type: 'FREE' | 'PRO' | 'ULTRA' = 'FREE'; // Default
      let rawTierId = '';

      // Check for paidTier first (e.g. Google One AI Ultra)
      const paidTier = response.data.paidTier;
      const currentTier = response.data.currentTier;

      if (paidTier) {
        const pId = (paidTier.id || '').toLowerCase();
        const pName = (paidTier.name || '').toLowerCase();
        rawTierId = paidTier.id;

        if (pId.includes('ultra') || pName.includes('ultra')) {
          type = 'ULTRA';
        } else if (pId.includes('pro') || pId.includes('standard') || pId.includes('premium')) {
          type = 'PRO';
        }
      }

      // If still not ULTRA, check currentTier
      if (type !== 'ULTRA' && currentTier) {
        const tierId = (currentTier.id || '').toLowerCase();
        const tierName = (currentTier.name || '').toLowerCase();
        if (!rawTierId) rawTierId = currentTier.id;

        const isUltra = tierId.includes('ultra') || tierId.includes('advanced') || 
                        tierName.includes('ultra') || tierName.includes('advanced');

        const isPro = tierId.includes('pro') || tierId.includes('premium') || tierId.includes('standard') ||
                      tierName.includes('pro') || tierName.includes('premium') || tierName.includes('standard');
        
        const isFree = tierId.includes('free') || tierId.includes('basic') || tierName.includes('free');

        if (isUltra) {
          type = 'ULTRA';
        } else if (type === 'FREE' && isPro && !isFree) {
          type = 'PRO';
        } else if (type === 'FREE' && !isFree && tierId !== '') {
            type = 'PRO';
        }
      }

      return { projectId, type, tierId: rawTierId };
    } catch (error: any) {
      console.error('[GeminiQuotaService] Failed to fetch Account Info:', error.response?.data || error.message);
      
      // Fallback to hardcoded ID for debugging/development
      const fallbackId = 'astute-impulse-485515-q7';
      console.warn(`[GeminiQuotaService] Using fallback Project ID: ${fallbackId}`);
      return { projectId: fallbackId, type: 'FREE', tierId: 'error_fallback' };
    }
  }

  /**
   * Fetches the quota/usage limits for the account.
   */
  public async fetchQuota(account: GeminiAccount): Promise<QuotaResponse | null> {
    if (!account.projectId) {
      // Try to fetch it if missing
      const info = await this.fetchAccountInfo(account);
      if (info.projectId) {
        account.projectId = info.projectId;
        if (info.type) account.type = info.type; // Bonus: update type as well
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

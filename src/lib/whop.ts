import { WhopServerSdk } from '@whop/api';

type WhopSdkShape = {
  verifyUserToken: (headers: Headers) => Promise<{ userId?: string }>;
  users: {
    getUser: (args: { userId: string }) => Promise<{
      id: string;
      name?: string;
      username?: string;
      profilePicture?: { sourceUrl?: string };
      city?: string;
      country?: string;
      bio?: string;
      phoneVerified?: boolean;
      banner?: { sourceUrl?: string };
      createdAt?: number;
      userStat?: {
        moneyEarned24Hours?: number;
        moneyEarned30Days?: number;
        moneyEarned7Days?: number;
        moneyEarnedLifetime?: number;
      };
    }>;
  };
};

let cachedSdk: WhopSdkShape | null = null;

export function getWhopSdk(): WhopSdkShape {
  if (cachedSdk) return cachedSdk;
  const apiKey = process.env.WHOP_API_KEY;
  const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;
  if (!apiKey || !appId) {
    throw new Error('Missing WHOP credentials');
  }

  // The server SDK validates user tokens and can act on behalf of the app
  const sdk = new (WhopServerSdk as unknown as {
    new (args: { appId: string; appApiKey: string }): WhopSdkShape;
  })({
    appId,
    appApiKey: apiKey
  });

  cachedSdk = sdk;
  return sdk;
}


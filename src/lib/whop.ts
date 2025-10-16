import { WhopServerSdk } from '@whop/api';

type WhopSdkShape = {
  verifyUserToken: (headers: Headers) => Promise<{ userId?: string }>;
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


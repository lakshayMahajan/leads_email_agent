import type { NextApiRequest, NextApiResponse } from 'next';

async function exchangeCodeForToken(code: string) {
  const params = new URLSearchParams({
    code,
    client_id: process.env.ZOHO_CLIENT_ID!,
    client_secret: process.env.ZOHO_CLIENT_SECRET!,
    redirect_uri: process.env.ZOHO_REDIRECT_URI!,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    body: params,
  });

  if (!response.ok) {
    throw new Error('Token exchange failed');
  }

  return response.json();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  try {
    const tokenData = await exchangeCodeForToken(code);
    // TODO: save tokenData in your DB associated with user

    res.status(200).json({ message: 'Tokens received', tokenData });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

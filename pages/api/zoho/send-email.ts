import type { NextApiRequest, NextApiResponse } from 'next';

const ACCESS_TOKEN = process.env.ZOHO_ACCESS_TOKEN!;
const ACCOUNT_ID = process.env.ZOHO_ACCOUNT_ID!;
const FROM_ADDRESS = process.env.ZOHO_FROM_ADDRESS!; // set in your env

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { to, subject, content } = req.body as { to: string; subject: string; content: string };

  if (!to || !subject || !content) {
    res.status(400).json({ error: 'Missing email parameters' });
    return;
  }

  try {
    const response = await fetch(`https://mail.zoho.com/api/accounts/${ACCOUNT_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromAddress: FROM_ADDRESS,
        toAddress: [to],
        subject,
        content,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || response.statusText);
    }

    const data = await response.json();
    res.status(200).json({ message: 'Email sent', data });
  } catch (error) {
    console.error('Zoho send email error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
}

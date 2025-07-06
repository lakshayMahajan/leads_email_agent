import type { NextApiRequest, NextApiResponse } from 'next';
import { incrementSentCount, resetSentCount } from './sent-count';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { csvData, emailTemplate } = req.body;
  const accessToken = req.headers.authorization?.replace('Bearer ', '');

  if (!accessToken) {
    return res.status(401).json({ message: 'No access token provided' });
  }

  try {
    // Reset sent count at the start
    resetSentCount();
    // Limit to 450 emails
    const limitedData = csvData.slice(0, 450);
    for (let i = 0; i < limitedData.length; i++) {
      const row = limitedData[i];
      // Replace placeholders in the template
      let emailBody = emailTemplate;
      Object.entries(row).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        emailBody = emailBody.replace(regex, value as string);
      });

      // Send email using our Gmail API endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/google/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          to: row.email, // Assumes there's an 'email' column in the CSV
          subject: 'Your Email Subject', // You might want to make this configurable
          body: emailBody,
        }),
      });

      if (!response.ok) {
        console.error(`Failed to send email to ${row.email}`);
      } else {
        console.log(`Sent email to ${row.email}`);
        incrementSentCount();
      }

      // Wait 1 minute before sending the next email (except after the last one)
      if (i < limitedData.length - 1) {
        await delay(60000);
      }
    }
    res.status(200).json({ message: 'All emails sent (up to 450, 1 min interval)' });
  } catch (error) {
    console.error('Batch email error:', error);
    res.status(500).json({ message: 'Failed to send batch emails' });
  }
}

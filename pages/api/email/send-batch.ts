import type { NextApiRequest, NextApiResponse } from 'next';

type CsvRow = Record<string, string>;

const SEND_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const MAX_SEND_COUNT = 20; // max emails to send

function personalizeTemplate(template: string, row: CsvRow) {
  let output = template;
  Object.entries(row).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    output = output.replace(regex, value);
  });
  return output;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { csvData, emailTemplate } = req.body as {
    csvData: CsvRow[];
    emailTemplate: string;
  };

  if (!csvData || !emailTemplate) {
    res.status(400).json({ error: 'Missing csvData or emailTemplate' });
    return;
  }

  const sendCount = Math.min(csvData.length, MAX_SEND_COUNT);

  for (let i = 0; i < sendCount; i++) {
    const row = csvData[i];
    const personalizedContent = personalizeTemplate(emailTemplate, row);
    const to = row['email'] || row['Email'] || row['to']; // adjust per your CSV

    if (!to) {
      console.warn(`Skipping row ${i} due to missing email field`);
      continue;
    }

    setTimeout(async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/zoho/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to,
            subject: 'Your Subject Here', // Update or make dynamic if needed
            content: personalizedContent,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Failed to send email to ${to}:`, errorData);
        } else {
          console.log(`Email sent to ${to}`);
        }
      } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
      }
    }, i * SEND_INTERVAL_MS);
  }

  res.status(200).json({ message: `Scheduled ${sendCount} emails over ~${(sendCount - 1) * 3} minutes.` });
}

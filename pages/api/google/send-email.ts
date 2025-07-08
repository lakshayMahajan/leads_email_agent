import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  let { to, subject, body, row } = req.body
  const accessToken = req.headers.authorization?.replace('Bearer ', '')

  if (!accessToken) {
    return res.status(401).json({ message: 'No access token provided' })
  }

  // If row is provided, replace placeholders in to and subject
  if (row) {
    Object.entries(row).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      if (typeof to === 'string') to = to.replace(regex, value as string)
      if (typeof subject === 'string') subject = subject.replace(regex, value as string)
    })
  }

  try {
    // Create email in base64 format as required by Gmail API
    const email = [
      'Content-Type: text/plain; charset="UTF-8"\n',
      'MIME-Version: 1.0\n',
      `To: ${to}\n`,
      `Subject: ${subject}\n\n`,
      body
    ].join('')

    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    // Send email using Gmail API
    const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedEmail,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to send email')
    }

    const data = await response.json()
    res.status(200).json(data)
  } catch (error) {
    console.error('Send email error:', error)
    res.status(500).json({ message: 'Failed to send email' })
  }
}

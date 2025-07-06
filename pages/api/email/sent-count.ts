import type { NextApiRequest, NextApiResponse } from 'next'

// Simple in-memory counter for demo (resets on server restart)
let sentCount = 0

export function incrementSentCount() {
  sentCount++
}

export function resetSentCount() {
  sentCount = 0
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    res.status(200).json({ count: sentCount })
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}

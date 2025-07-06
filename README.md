# Leads Email Agent

A Next.js app to send personalized email campaigns in bulk using the Gmail API. Upload a CSV, write your template, and send emails with Google OAuth authentication. The app sends one email per minute (configurable), logs each sent email, and provides a live countdown and sent counter in the UI.

---

## Features
- Upload CSV with recipient data and placeholders
- Compose email templates with dynamic placeholders (e.g. `{{Name}}`)
- Google OAuth 2.0 authentication (no password required)
- Sends up to 450 emails per batch, one every 60 seconds
- Live countdown timer and sent email counter on the dashboard
- Logs each sent email in the backend

---

## Getting Started

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd leads_email_agent
npm install
```

### 2. Google Cloud Setup
1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or select an existing one)
3. Enable the **Gmail API** for your project
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000`
6. Download your credentials or copy the **Client ID** and **Client Secret**

### 3. Configure Environment Variables
Create a `.env.local` file in the project root:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_APP_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 4. Run the App
```bash
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000)

---

## Usage
1. **Authenticate with Google**: On first load, you'll be prompted to sign in with your Google account and grant Gmail send permissions.
2. **Upload CSV**: The CSV must have at least an `email` column. Add more columns for placeholders (e.g. `Name`).
3. **Write Template**: Use `{{columnName}}` to insert CSV values.
4. **Send Emails**: Click "Send Emails". The app will send one email per minute, up to 450 emails per batch. Progress is shown on the dashboard.

### Example CSV
```csv
email,Name
alice@example.com,Alice
bob@example.com,Bob
```

### Example Template
```
Hello {{Name}},
This is a personalized message.
```

---

## Notes & Limits
- **Gmail API daily limits**: Free Gmail accounts can send ~100-150 emails/day via API. Google Workspace accounts have higher limits.
- **Rate limiting**: The app sends one email per minute to avoid spam flags and rate limits.
- **Logs**: Each sent email is logged in the backend console.
- **In-memory sent counter**: The sent email counter resets if the server restarts.

---

## Customization
- To change the interval, edit the delay in `pages/api/email/send-batch.ts`.
- To change the max batch size, edit the slice in the same file.
- To add more placeholders, add columns to your CSV and use them in your template.

---

## License
MIT

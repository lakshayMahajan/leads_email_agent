"use client"

import type React from "react"
import { useState, useRef } from "react"
import Papa from "papaparse"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Upload, Globe, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"

type CsvRow = Record<string, string>

export default function UploadPage() {
  const [csvData, setCsvData] = useState<CsvRow[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [selectedPlaceholders, setSelectedPlaceholders] = useState<string[]>([])
  const [emailTemplate, setEmailTemplate] = useState("")
  const [subject, setSubject] = useState("")
  const [sending, setSending] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [scrapeUrl, setScrapeUrl] = useState("")
  const [activeTab, setActiveTab] = useState("upload")
  const [timer, setTimer] = useState(180)
  const [sentCount, setSentCount] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Check if we have a valid Google access token
    const accessToken = localStorage.getItem("GOOGLE_ACCESS_TOKEN");
    const tokenExpiry = localStorage.getItem("GOOGLE_TOKEN_EXPIRY");

    const now = Date.now();
    if (!accessToken || (tokenExpiry && now > parseInt(tokenExpiry))) {
      // Check if we got redirected back with ?code= from Google OAuth
      const code = searchParams?.get("code");
      if (code) {
        // Exchange the code for tokens by calling our backend API
        fetch(`/api/google/oauth-callback?code=${code}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.access_token) {
              localStorage.setItem("GOOGLE_ACCESS_TOKEN", data.access_token);
              localStorage.setItem(
                "GOOGLE_TOKEN_EXPIRY",
                (Date.now() + data.expires_in * 1000).toString()
              );
              localStorage.setItem("GOOGLE_REFRESH_TOKEN", data.refresh_token);
              // Clean URL to remove code param
              router.replace(window.location.pathname);
            } else {
              console.error("Token exchange failed", data);
            }
          });
      } else {
        // Redirect user to Google OAuth consent page
        const clientId = "1081948288134-ku1m6c9qpq2rjk06tj3s6s9mtpa63peh.apps.googleusercontent.com";
        const redirectUri = encodeURIComponent(window.location.origin);
        const scope = encodeURIComponent("https://www.googleapis.com/auth/gmail.send");
        const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?scope=${scope}&access_type=offline&include_granted_scopes=true&response_type=code&redirect_uri=${redirectUri}&client_id=${clientId}`;
        window.location.href = oauthUrl;
      }
    }
  }, [searchParams, router]);

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data)
        setColumns(results.meta.fields || [])
        setSelectedPlaceholders([]) // reset placeholders on new upload
      },
      error: (err) => alert("Error parsing CSV: " + err.message),
    })
  }

  function togglePlaceholder(col: string) {
    setSelectedPlaceholders((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]))
  }

  function previewEmail(row: CsvRow) {
    let output = emailTemplate
    selectedPlaceholders.forEach((col) => {
      const val = row[col] ?? ""
      const regex = new RegExp(`{{\\s*${col}\\s*}}`, "g")
      output = output.replace(regex, val)
    })
    return output
  }

  async function handleSend() {
    if (!csvData.length) {
      alert("Please upload a CSV file first.")
      return
    }
    if (!emailTemplate) {
      alert("Please write an email template.")
      return
    }
    if (!subject) {
      alert("Please enter an email subject.")
      return
    }

    const accessToken = localStorage.getItem("GOOGLE_ACCESS_TOKEN")
    if (!accessToken) {
      alert("Please authenticate with Google first.")
      return
    }

    setSending(true)
    setLog([])
    try {
      setLog((prev) => [...prev, "Starting email batch..."])
      const response = await fetch("/api/email/send-batch", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          csvData,
          emailTemplate,
          subject,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        setLog((prev) => [...prev, `Error: ${error || "Failed to send emails"}`])
        throw new Error(error || "Failed to send emails")
      }

      setLog((prev) => [...prev, "Emails sent successfully!"])
      alert("Emails sent successfully!")
    } catch (err) {
      setLog((prev) => [...prev, `Error: ${(err as Error).message}`])
      alert((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  async function handleScrape() {
    if (!scrapeUrl) {
      alert("Please enter a URL to scrape.")
      return
    }

    setScraping(true)
    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapeUrl }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error || "Failed to scrape data")
      }

      const data = await response.json()

      // Assuming the scraper returns data in a format that can be used as CSV
      setCsvData(data)
      if (data.length > 0) {
        setColumns(Object.keys(data[0]))
      }

      setActiveTab("upload") // Switch to upload tab to show results
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setScraping(false)
    }
  }

  // Timer effect
  useEffect(() => {
    if (sending) {
      setTimer(180)
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) return 180
          return prev - 1
        })
      }, 1000)
    } else {
      setTimer(180)
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [sending])

  // Listen for sentCount updates from backend
  useEffect(() => {
    if (!sending) return
    const interval = setInterval(async () => {
      const res = await fetch("/api/email/sent-count")
      if (res.ok) {
        const data = await res.json()
        setSentCount(data.count)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [sending])

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl">
      <Card className="shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-50">
          <CardTitle className="text-2xl font-bold">Email Campaign Generator</CardTitle>
          <CardDescription>Upload a CSV file or scrape data to create personalized email campaigns</CardDescription>
        </CardHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6 pt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload size={16} /> CSV Upload
              </TabsTrigger>
              <TabsTrigger value="scrape" className="flex items-center gap-2">
                <Globe size={16} /> Web Scraping
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="upload" className="p-6">
            <div className="space-y-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="csv-file">Upload CSV File</Label>
                <Input id="csv-file" type="file" accept=".csv" onChange={handleFileUpload} className="cursor-pointer" />
              </div>

              {csvData.length > 0 && (
                <div className="mt-4 p-4 bg-slate-50 rounded-md">
                  <p className="text-sm text-slate-500 mb-2">
                    Loaded {csvData.length} rows with {columns.length} columns
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {columns.map((col) => (
                      <Badge key={col} variant="outline" className="bg-white">
                        {col}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="scrape" className="p-6">
            <div className="space-y-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="scrape-url">Website URL to Scrape</Label>
                <div className="flex gap-2">
                  <Input
                    id="scrape-url"
                    type="url"
                    placeholder="https://example.com/data-page"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                  />
                  <Button onClick={handleScrape} disabled={scraping || !scrapeUrl} className="whitespace-nowrap">
                    {scraping ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Scraping...
                      </>
                    ) : (
                      "Scrape Data"
                    )}
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Enter the URL of a webpage containing tabular data you want to extract
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <CardContent>
          {/* Timer and sent count UI */}
          <div className="flex items-center gap-6 mb-4">
            <div className="text-lg font-mono">Next email in: <span className="font-bold">{timer}s</span></div>
            <div className="text-lg font-mono">Emails sent: <span className="font-bold">{sentCount}</span></div>
          </div>

          {/* Subject input */}
          <div className="mb-4">
            <Label htmlFor="subject">Email Subject</Label>
            <Input
              id="subject"
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              className="font-mono text-sm"
            />
          </div>

          {columns.length > 0 && (
            <>
              <Separator className="my-6" />

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-3">Select Placeholders</h3>
                  <p className="text-sm text-slate-500 mb-3">
                    Choose columns to use as placeholders in your email template
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {columns.map((col) => (
                      <div key={col} className="flex items-center space-x-2">
                        <Checkbox
                          id={`checkbox-${col}`}
                          checked={selectedPlaceholders.includes(col)}
                          onCheckedChange={() => togglePlaceholder(col)}
                        />
                        <Label htmlFor={`checkbox-${col}`} className="cursor-pointer text-sm font-medium">
                          {col}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-3">Email Template</h3>
                  <p className="text-sm text-slate-500 mb-3">
                    Write your email template using {"{{"} and {"}}"} around placeholder names
                  </p>
                  <Textarea
                    rows={6}
                    value={emailTemplate}
                    onChange={(e) => setEmailTemplate(e.target.value)}
                    placeholder="Write your email template here..."
                    className="font-mono text-sm"
                  />

                  {selectedPlaceholders.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs text-slate-500">Available placeholders: </span>
                      {selectedPlaceholders.map((p) => (
                        <Badge key={p} variant="secondary" className="text-xs">
                          {"{{"}
                          {p}
                          {"}}"}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {csvData.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-3">Preview</h3>
                    <Alert className="bg-slate-50 border border-slate-200">
                      <AlertDescription>
                        <div className="font-mono text-sm whitespace-pre-wrap">{previewEmail(csvData[0])}</div>
                      </AlertDescription>
                    </Alert>
                    <p className="text-xs text-slate-500 mt-2">
                      This is how your email will look with data from the first row
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-end gap-3 border-t p-6 bg-slate-50">
          <Button
            variant="outline"
            className="bg-white text-slate-800"
            onClick={() => {
              setCsvData([])
              setColumns([])
              setSelectedPlaceholders([])
              setEmailTemplate("")
              setSubject("")
            }}
          >
            Reset
          </Button>

          <Button
            onClick={handleSend}
            disabled={sending || !csvData.length}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Emails
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Log area */}
      <div className="mt-6 p-3 bg-slate-100 rounded text-xs font-mono max-h-40 overflow-y-auto border border-slate-200">
        <div className="font-bold mb-1">Log:</div>
        {log.length === 0 ? <div className="text-slate-400">No log yet.</div> : log.map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  )
}

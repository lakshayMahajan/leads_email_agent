"use client"

import type React from "react"
import { useState } from "react"
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
  const [emailTemplate, setEmailTemplate] = useState("Hello {{Name}}, your order {{OrderID}} is ready.")
  const [sending, setSending] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [scrapeUrl, setScrapeUrl] = useState("")
  const [activeTab, setActiveTab] = useState("upload")
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // 1. Check if access token exists and is valid (you'd likely check localStorage or cookie)
    const accessToken = localStorage.getItem("ZOHO_ACCESS_TOKEN");
    const tokenExpiry = localStorage.getItem("ZOHO_TOKEN_EXPIRY"); // store expiry timestamp

    const now = Date.now();
    if (!accessToken || (tokenExpiry && now > parseInt(tokenExpiry))) {
      // 2. Check if we got redirected back with ?code= from Zoho OAuth
      const code = searchParams?.get("code");
      if (code) {
        // 3. Exchange the code for tokens by calling your backend API
        fetch(`/api/oauth/exchange?code=${code}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.tokenData) {
              // Save tokens and expiry (assume expires_in is in seconds)
              localStorage.setItem("ZOHO_ACCESS_TOKEN", data.tokenData.access_token);
              localStorage.setItem(
                "ZOHO_TOKEN_EXPIRY",
                (Date.now() + data.tokenData.expires_in * 1000).toString()
              );
              localStorage.setItem("ZOHO_REFRESH_TOKEN", data.tokenData.refresh_token);
              // Clean URL to remove code param
              router.replace(window.location.pathname);
            } else {
              console.error("Token exchange failed", data);
            }
          });
      } else {
        // 4. Redirect user to Zoho OAuth consent page
        const clientId = "1000.B0AOT87DW183BS1JKV17KUQP4DPUBX";
        const redirectUri = encodeURIComponent(window.location.origin);
        const scope = encodeURIComponent("ZohoMail.messages.CREATE"); // adjust scopes
        const oauthUrl = `https://accounts.zoho.com/oauth/v2/auth?scope=${scope}&client_id=${clientId}&response_type=code&access_type=offline&redirect_uri=${redirectUri}`;
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

    setSending(true)
    try {
      const response = await fetch("/api/email/send-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvData,
          emailTemplate,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error || "Failed to send emails")
      }

      alert("Emails scheduled successfully!")
    } catch (err) {
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
              setEmailTemplate("Hello {{Name}}, your order {{OrderID}} is ready.")
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
    </div>
  )
}

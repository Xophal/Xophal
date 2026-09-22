"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

const ENTITY_OPTIONS = [
  { value: "boards", label: "Boards" },
  { value: "classes", label: "Classes" },
  { value: "subjects", label: "Subjects" },
  { value: "chapters", label: "Chapters" },
  { value: "topics", label: "Topics" },
  { value: "lessons", label: "Lessons" },
  { value: "questions", label: "Questions" },
  { value: "notes", label: "Notes" },
  { value: "mock_tests", label: "Mock Tests" },
];

export default function AdminImportPage() {
  const [entityType, setEntityType] = useState("questions");
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fileFormat, setFileFormat] = useState<"CSV" | "XLSX" | "JSON">("CSV");
  type ImportPreview = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCount: number;
  previewRows?: Record<string, unknown>[];
};

type ImportIssue = {
  rowIndex: number;
  field?: string;
  message: string;
  severity: string;
};

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setPreview(null);
    setIssues([]);
    setError(null);

    const file = event.target.files?.[0];
    if (!file) {
      setFileName("");
      setCsvText("");
      return;
    }

    setFileName(file.name);
    const lowerName = file.name.toLowerCase();
    const detectedFormat = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") ? "XLSX" : lowerName.endsWith(".json") ? "JSON" : lowerName.endsWith(".csv") ? "CSV" : null;
    if (!detectedFormat) {
      setError("Use a CSV, XLSX, or JSON file.");
      setCsvText("");
      return;
    }
    setFileFormat(detectedFormat);

    setCsvText(detectedFormat === "CSV" ? await file.text() : "file-selected");
  };

  const handleSubmit = async () => {
    if (!csvText) {
      setError("Upload a CSV, XLSX, or JSON file to preview import results.");
      return;
    }

    setError(null);
    setLoading(true);
    setPreview(null);
    setIssues([]);

    try {
      let result;
      let response: Response | undefined;
      if (fileName) {
        // send as multipart to upload endpoint
        const form = new FormData();
        const fileInput = (document.getElementById("csvFile") as HTMLInputElement | null)?.files?.[0];
        if (!fileInput) {
          setError("No file selected");
          setLoading(false);
          return;
        }
        form.append("file", fileInput);
        form.append("entity_type", entityType);

        response = await fetch("/api/admin/imports/upload", {
          method: "POST",
          body: form,
        });
        result = await response.json();
        // if job created, trigger processing automatically
        if (result?.data?.job?.id) {
          try {
            const proc = await fetch("/api/admin/imports/process", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jobId: result.data.job.id }),
            });
            const procJson = await proc.json();
            if (!proc.ok) {
              toast({ title: "Import processing failed", description: procJson.error || "Processing failed on server" });
            } else {
              toast({ title: "Import processed", description: `Imported ${procJson.data.imported} rows` });
            }
          } catch (e) {
            // ignore
          }
        }
      } else {
        response = await fetch("/api/admin/imports", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            entity_type: entityType,
            format: "CSV",
            filename: fileName,
            csv: csvText,
          }),
        });
        result = await response.json();
      }
      if (!response?.ok || !result.success) {
        setError(result.error || "Failed to validate import.");
        toast({ title: "Import preview failed", description: result.error || "Validation failed." });
        return;
      }

      setPreview(result.data.preview ?? null);
      setIssues(result.data.preview?.issues ?? []);
      toast({ title: "Import preview ready", description: "Validation completed successfully." });
    } catch {
      setError("Unable to reach import endpoint.");
      toast({ title: "Import request failed", description: "Please check your connection and try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Content Import</CardTitle>
          <CardDescription>
            Upload CSV, XLSX, or JSON content to validate required fields, duplicates, and row-level issues before processing.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="entityType">Entity Type</Label>
            <select
              id="entityType"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              className="px-3 py-2 glass-input"
            >
              {ENTITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="csvFile">Import file ({fileFormat})</Label>
            <Input id="csvFile" type="file" accept=".csv,.json,.xlsx,.xls" onChange={handleFileChange} />
            {fileName ? <p className="text-sm text-slate-600">Selected file: {fileName}</p> : null}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="default" onClick={handleSubmit} disabled={loading}>
              {loading ? "Validating..." : "Preview Import"}
            </Button>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>Preview Results</CardTitle>
            <CardDescription>
              Total rows: {preview.totalRows} · Valid rows: {preview.validRows} · Invalid rows: {preview.invalidRows} · Duplicates: {preview.duplicateCount}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {issues.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium">Issues</p>
                <div className="overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-3">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="border-b px-3 py-2">Row</th>
                        <th className="border-b px-3 py-2">Field</th>
                        <th className="border-b px-3 py-2">Issue</th>
                        <th className="border-b px-3 py-2">Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issues.slice(0, 20).map((issue, index) => (
                        <tr key={index}>
                          <td className="border-b px-3 py-2">{issue.rowIndex + 1}</td>
                          <td className="border-b px-3 py-2">{issue.field ?? "-"}</td>
                          <td className="border-b px-3 py-2">{issue.message}</td>
                          <td className="border-b px-3 py-2 capitalize">{issue.severity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {issues.length > 20 ? <p className="mt-2 text-xs text-slate-500">Showing first 20 issues.</p> : null}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No issues found in preview.</p>
            )}

            {preview.previewRows && preview.previewRows.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium">Preview rows</p>
                <div className="overflow-x-auto rounded-md border border-slate-200 bg-white p-3">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr>
                        {Object.keys(preview.previewRows[0] as Record<string, unknown>).map((key) => (
                          <th key={key} className="border-b px-3 py-2 text-slate-700">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.previewRows.slice(0, 10).map((row, rowIndex: number) => (
                        <tr key={rowIndex}>
                          {Object.values(row).map((value, cellIndex) => (
                            <td key={cellIndex} className="border-b px-3 py-2">
                              {String(value ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.previewRows.length > 10 ? <p className="mt-2 text-xs text-slate-500">Showing first 10 preview rows.</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

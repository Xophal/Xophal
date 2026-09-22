"use client";

import Upload from "@/components/shared/Upload";

export default function UploadDemoPage() {
  const handleComplete = async (files: { name: string; url: string }[]) => {
    try {
      await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(files[0] ?? {}),
      });
      // ignore response for demo
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Upload Demo</h1>
      <p>Choose a file to upload to Supabase Storage (bucket: <strong>public</strong>).</p>
      <Upload bucket="public" path="uploads" onUploadComplete={handleComplete} />
    </div>
  );
}

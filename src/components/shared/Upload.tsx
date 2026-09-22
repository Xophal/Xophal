"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type UploadedFile = { name: string; url: string };

type Props = {
  bucket: string;
  path?: string;
  accept?: string;
  multiple?: boolean;
  onUploadComplete?: (files: UploadedFile[]) => void;
};

export default function Upload({
  bucket,
  path = "",
  accept,
  multiple = false,
  onUploadComplete,
}: Props) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Please sign in before uploading files.");
      return;
    }
    setUploading(true);
    setError(null);
    const results: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      try {
        if (file.size > 10 * 1024 * 1024) throw new Error("Files must be 10 MB or smaller.");
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"];
        if (!allowedTypes.includes(file.type)) throw new Error("This file type is not allowed.");
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
        const filePath = `${user.id}/${path ? `${path}/` : ""}${fileName}`;

        const { data, error } = await supabase.storage.from(bucket).upload(filePath, file);
        if (error) throw error;

        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);
        const url = publicData.publicUrl;

        const uploadedFile = { name: file.name, url };
        results.push(uploadedFile);
        setUploaded((prev) => [...prev, uploadedFile]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    setUploading(false);
    onUploadComplete?.(results);
  };

  return (
    <div>
      <label style={{ display: "inline-block" }}>
        <input type="file" accept={accept} multiple={multiple} onChange={(e) => handleFiles(e.target.files)} />
      </label>
      {uploading && <p>Uploading…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      <ul>
        {uploaded.map((f, i) => (
          <li key={i}>
            <a href={f.url} target="_blank" rel="noreferrer">
              {f.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

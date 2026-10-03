"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { clientErrorMessage, readApiData } from "@/lib/client-api";

type Props = {
  initialAvatarUrl?: string | null;
  name?: string | null;
};

function getInitials(name?: string | null) {
  return name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || null;
}

export default function ProfileAvatarEditor({ initialAvatarUrl, name }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: "Image is too large", description: "Choose an image smaller than 4 MB.", variant: "destructive" });
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Unsupported image", description: "Choose a JPEG, PNG, or WebP image.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/profile/avatar", { method: "POST", body });
      const result = await readApiData<{ avatarUrl: string }>(response, "Could not upload your profile picture.");
      setAvatarUrl(result.avatarUrl);
      router.refresh();
      toast({ title: "Profile picture updated" });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: clientErrorMessage(error, "Could not upload your profile picture."),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      await readApiData<{ avatarUrl: null }>(response, "Could not remove your profile picture.");
      setAvatarUrl(null);
      router.refresh();
      toast({ title: "Profile picture removed" });
    } catch (error) {
      toast({
        title: "Could not remove picture",
        description: clientErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="profile-picture-heading" className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary/10 text-primary">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={`${name || "Your"} profile picture`} fill sizes="96px" unoptimized className="object-cover" />
        ) : getInitials(name) ? (
          <span aria-hidden="true" className="text-2xl font-semibold">{getInitials(name)}</span>
        ) : (
          <UserRound className="h-10 w-10" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 space-y-3">
        <div>
          <h3 id="profile-picture-heading" className="font-semibold">Profile picture</h3>
          <p className="mt-1 text-sm text-muted-foreground">JPEG, PNG, or WebP · maximum 4 MB. Images are cropped square.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Choose profile picture"
          disabled={busy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void upload(file);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
            {avatarUrl ? "Change picture" : "Add picture"}
          </Button>
          {avatarUrl ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void remove()}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

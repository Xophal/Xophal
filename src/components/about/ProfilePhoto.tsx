import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { User } from "lucide-react";

const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;

type ProfilePhotoProps = {
  photoSlug: string;
  name?: string;
  alt: string;
  shape: "portrait" | "square";
  className: string;
};

function initialsFor(name?: string) {
  const words = name?.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/).filter(Boolean);
  return words?.length
    ? words.slice(0, 2).map((word) => word[0].toUpperCase()).join("")
    : null;
}

export default function ProfilePhoto({
  photoSlug,
  name,
  alt,
  shape,
  className,
}: ProfilePhotoProps) {
  const teamDirectory = path.join(process.cwd(), "public", "team");
  const extension = PHOTO_EXTENSIONS.find((candidate) =>
    existsSync(path.join(teamDirectory, `${photoSlug}${candidate}`)),
  );

  return (
    <div
      className={`relative isolate overflow-hidden bg-xophol-lightBlue dark:bg-xophol-blue/20 ${className}`}
    >
      {extension ? (
        <Image
          src={`/team/${photoSlug}${extension}`}
          alt={alt}
          fill
          sizes={shape === "portrait" ? "(max-width: 1023px) 100vw, 40vw" : "(max-width: 639px) 100vw, 176px"}
          className="object-cover object-top"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-full min-h-0 w-full items-center justify-center text-xophol-blue dark:text-slate-100"
        >
          {initialsFor(name) ? (
            <span className="text-5xl font-semibold tracking-tight sm:text-6xl">
              {initialsFor(name)}
            </span>
          ) : (
            <User className="h-12 w-12" strokeWidth={1.5} />
          )}
        </div>
      )}
    </div>
  );
}

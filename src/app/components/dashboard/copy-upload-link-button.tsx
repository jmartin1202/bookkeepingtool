"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

type Props = {
  path: string;
};

export function CopyUploadLinkButton({ path }: Props) {
  const [copied, setCopied] = useState(false);
  const displayPath = path.startsWith("/") ? path : `/${path}`;

  const href = useMemo(() => displayPath, [displayPath]);

  async function copyLink() {
    const url = new URL(href, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      className="inline-flex items-center justify-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:border-spruce hover:text-spruce"
      onClick={copyLink}
      type="button"
    >
      {copied ? (
        <Check aria-hidden="true" size={16} />
      ) : (
        <Copy aria-hidden="true" size={16} />
      )}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

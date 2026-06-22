"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileUp, Loader2, UploadCloud } from "lucide-react";
import { clsx } from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { PortalCycle, PortalDocumentRequest } from "@/lib/public-upload/types";

type Props = {
  cycle: PortalCycle;
};

type UploadState = {
  file?: File;
  status: "idle" | "uploading" | "done" | "error";
  message?: string;
};

export function PortalUploadList({ cycle }: Props) {
  const [email, setEmail] = useState(cycle.clientEmail);
  const [requests, setRequests] = useState(cycle.requests);
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});

  const completedCount = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.status === "uploaded" ||
          request.status === "approved" ||
          request.uploads.length > 0,
      ).length,
    [requests],
  );

  const progress =
    requests.length === 0 ? 0 : Math.round((completedCount / requests.length) * 100);

  function setRequestUploadState(
    requestId: string,
    nextState: Partial<UploadState>,
  ) {
    setUploads((current) => ({
      ...current,
      [requestId]: {
        ...current[requestId],
        ...nextState,
        status: nextState.status ?? current[requestId]?.status ?? "idle",
      },
    }));
  }

  function markUploaded(requestId: string, originalFilename: string) {
    setRequests((current) =>
      current.map((request) => {
        if (request.id !== requestId) return request;

        return {
          ...request,
          status: "uploaded",
          uploads: [
            ...request.uploads,
            {
              id: crypto.randomUUID(),
              originalFilename,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }),
    );
  }

  async function uploadFile(request: PortalDocumentRequest) {
    const uploadState = uploads[request.id];
    const file = uploadState?.file;

    if (!file) {
      setRequestUploadState(request.id, {
        status: "error",
        message: "Choose a file first.",
      });
      return;
    }

    if (!email) {
      setRequestUploadState(request.id, {
        status: "error",
        message: "Enter your email before uploading.",
      });
      return;
    }

    setRequestUploadState(request.id, {
      status: "uploading",
      message: undefined,
    });

    try {
      const signResponse = await fetch("/api/public-upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicToken: cycle.publicToken,
          documentRequestId: request.id,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
        }),
      });

      const signedUpload = await signResponse.json();

      if (!signResponse.ok) {
        throw new Error(signedUpload.error ?? "Could not prepare upload.");
      }

      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(signedUpload.bucket)
        .uploadToSignedUrl(signedUpload.path, signedUpload.token, file);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const completeResponse = await fetch("/api/public-upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicToken: cycle.publicToken,
          documentRequestId: request.id,
          storagePath: signedUpload.path,
          originalFilename: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          uploadedByEmail: email,
        }),
      });

      const completedUpload = await completeResponse.json();

      if (!completeResponse.ok) {
        throw new Error(completedUpload.error ?? "Upload could not be saved.");
      }

      markUploaded(request.id, file.name);
      setRequestUploadState(request.id, {
        file: undefined,
        status: "done",
        message: "Uploaded.",
      });
    } catch (error) {
      setRequestUploadState(request.id, {
        status: "error",
        message: error instanceof Error ? error.message : "Upload failed.",
      });
    }
  }

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-4 rounded-md border border-line bg-white p-4 shadow-soft md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-ink/60">Progress</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {completedCount} of {requests.length} received
          </p>
        </div>
        <div className="w-full md:max-w-sm">
          <div className="h-3 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-moss transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-right text-sm font-medium text-ink/60">
            {progress}%
          </p>
        </div>
      </div>

      <label className="mt-6 block max-w-md text-sm font-semibold text-ink">
        Your email
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-base font-normal text-ink shadow-sm"
          placeholder="name@example.com"
          type="email"
        />
      </label>

      <div className="mt-6 space-y-3">
        {requests.map((request) => {
          const uploadState: UploadState = uploads[request.id] ?? {
            status: "idle",
          };
          const isUploading = uploadState.status === "uploading";
          const isDone =
            request.status === "uploaded" ||
            request.status === "approved" ||
            request.uploads.length > 0;

          return (
            <article
              className="rounded-md border border-line bg-white p-4 shadow-sm"
              key={request.id}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-ink">
                      {request.label}
                    </h2>
                    {request.required ? (
                      <span className="rounded-full bg-gold/15 px-2 py-1 text-xs font-semibold text-gold">
                        Required
                      </span>
                    ) : null}
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                        isDone
                          ? "bg-moss/10 text-moss"
                          : "bg-coral/10 text-coral",
                      )}
                    >
                      {isDone ? (
                        <CheckCircle2 aria-hidden="true" size={14} />
                      ) : (
                        <FileUp aria-hidden="true" size={14} />
                      )}
                      {isDone ? "Received" : "Missing"}
                    </span>
                  </div>
                  {request.description ? (
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">
                      {request.description}
                    </p>
                  ) : null}
                  {request.uploads.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-sm text-ink/60">
                      {request.uploads.map((upload) => (
                        <li key={upload.id}>{upload.originalFilename}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="w-full shrink-0 md:w-80">
                  <input
                    aria-label={`Upload ${request.label}`}
                    className="block w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-spruce file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
                    disabled={isUploading}
                    onChange={(event) =>
                      setRequestUploadState(request.id, {
                        file: event.target.files?.[0],
                        status: "idle",
                        message: undefined,
                      })
                    }
                    accept=".pdf,.png,.jpg,.jpeg,.csv,.xls,.xlsx,.doc,.docx"
                    type="file"
                  />
                  <button
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-spruce px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:bg-ink/35"
                    disabled={isUploading || !uploadState.file}
                    onClick={() => uploadFile(request)}
                    type="button"
                  >
                    {isUploading ? (
                      <Loader2 aria-hidden="true" className="animate-spin" size={18} />
                    ) : (
                      <UploadCloud aria-hidden="true" size={18} />
                    )}
                    {isUploading ? "Uploading" : "Upload"}
                  </button>
                  {uploadState.message ? (
                    <p
                      className={clsx(
                        "mt-2 text-sm",
                        uploadState.status === "error"
                          ? "text-coral"
                          : "text-moss",
                      )}
                    >
                      {uploadState.message}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

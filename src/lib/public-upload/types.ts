export type UploadRecord = {
  id: string;
  originalFilename: string;
  createdAt: string;
};

export type PortalDocumentRequest = {
  id: string;
  label: string;
  description: string | null;
  required: boolean;
  status: "missing" | "uploaded" | "approved" | "rejected";
  uploads: UploadRecord[];
};

export type PortalCycle = {
  id: string;
  publicToken: string;
  periodMonth: string;
  dueDate: string;
  status: "open" | "complete" | "archived";
  organizationName: string;
  clientName: string;
  clientEmail: string;
  requests: PortalDocumentRequest[];
};

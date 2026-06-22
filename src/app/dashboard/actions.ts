"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const clientSchema = z.object({
  name: z.string().trim().min(2).max(160),
  contactEmail: z.string().trim().email().max(254),
  contactPhone: z.string().trim().max(40).optional(),
});

const templateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  items: z
    .string()
    .trim()
    .min(3)
    .transform((value) =>
      value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 40),
    )
    .pipe(z.array(z.string().min(2).max(180)).min(1)),
});

const cycleSchema = z.object({
  clientId: z.string().uuid(),
  templateId: z.string().uuid(),
  periodMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type ProfileRow = {
  organization_id: string;
};

function dashboardRedirect(kind: "success" | "error", message: string): never {
  redirect(`/dashboard?${kind}=${encodeURIComponent(message)}`);
}

async function getCurrentOrganizationId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    dashboardRedirect("error", "Your workspace profile is not ready yet.");
  }

  return {
    supabase,
    organizationId: (data as ProfileRow).organization_id,
  };
}

export async function createClientAction(formData: FormData) {
  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone") || undefined,
  });

  if (!parsed.success) {
    dashboardRedirect("error", "Enter a client name and valid email.");
  }

  const { supabase, organizationId } = await getCurrentOrganizationId();

  const { error } = await supabase.from("clients").insert({
    organization_id: organizationId,
    name: parsed.data.name,
    contact_email: parsed.data.contactEmail,
    contact_phone: parsed.data.contactPhone || null,
  });

  if (error) {
    dashboardRedirect("error", error.message);
  }

  revalidatePath("/dashboard");
  dashboardRedirect("success", "Client added.");
}

export async function createChecklistTemplateAction(formData: FormData) {
  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    items: formData.get("items"),
  });

  if (!parsed.success) {
    dashboardRedirect(
      "error",
      "Enter a checklist name and at least one checklist item.",
    );
  }

  const { supabase, organizationId } = await getCurrentOrganizationId();

  const { data: template, error: templateError } = await supabase
    .from("checklist_templates")
    .insert({
      organization_id: organizationId,
      name: parsed.data.name,
    })
    .select("id")
    .single();

  if (templateError || !template) {
    dashboardRedirect("error", templateError?.message ?? "Template failed.");
  }

  const templateId = (template as { id: string }).id;
  const itemRows = parsed.data.items.map((label, index) => ({
    template_id: templateId,
    label,
    sort_order: index + 1,
    required: true,
  }));

  const { error: itemsError } = await supabase
    .from("checklist_items")
    .insert(itemRows);

  if (itemsError) {
    dashboardRedirect("error", itemsError.message);
  }

  revalidatePath("/dashboard");
  dashboardRedirect("success", "Checklist template created.");
}

export async function createCollectionCycleAction(formData: FormData) {
  const parsed = cycleSchema.safeParse({
    clientId: formData.get("clientId"),
    templateId: formData.get("templateId"),
    periodMonth: formData.get("periodMonth"),
    dueDate: formData.get("dueDate"),
  });

  if (!parsed.success) {
    dashboardRedirect("error", "Choose a client, template, month, and due date.");
  }

  const { supabase } = await getCurrentOrganizationId();
  const { data, error } = await supabase.rpc("create_collection_cycle", {
    p_client_id: parsed.data.clientId,
    p_template_id: parsed.data.templateId,
    p_period_month: parsed.data.periodMonth,
    p_due_date: parsed.data.dueDate,
  });

  if (error) {
    dashboardRedirect("error", error.message);
  }

  const cycle = data as { uploadPath?: string } | null;
  revalidatePath("/dashboard");
  dashboardRedirect(
    "success",
    cycle?.uploadPath
      ? `Collection link created: ${cycle.uploadPath}`
      : "Collection link created.",
  );
}

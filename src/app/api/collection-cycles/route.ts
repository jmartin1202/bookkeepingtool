import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date format YYYY-MM-DD");

const createCollectionCycleSchema = z.object({
  clientId: z.string().uuid(),
  templateId: z.string().uuid(),
  periodMonth: isoDate,
  dueDate: isoDate,
});

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function errorStatus(message: string) {
  if (message.includes("Active subscription required")) return 402;
  if (message.includes("Authentication required")) return 401;
  if (message.includes("not found")) return 404;
  return 400;
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createCollectionCycleSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "You must be signed in to create a collection cycle" },
      { status: 401 },
    );
  }

  // The RPC runs atomically in Postgres and enforces organization + subscription checks.
  const { data, error } = await supabase.rpc("create_collection_cycle", {
    p_client_id: parsed.data.clientId,
    p_template_id: parsed.data.templateId,
    p_period_month: parsed.data.periodMonth,
    p_due_date: parsed.data.dueDate,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: errorStatus(error.message) },
    );
  }

  const uploadUrl = new URL(data.uploadPath, getAppUrl()).toString();

  return NextResponse.json(
    {
      cycle: {
        ...data,
        uploadUrl,
      },
    },
    { status: 201 },
  );
}

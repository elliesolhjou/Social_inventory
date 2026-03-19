import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

// Service role client for Storage uploads (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// POST: Upload video evidence (V1, V2, or V3) for a transaction
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const { id: transactionId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { evidence_type, video_base64, duration_seconds } = body;

  if (!evidence_type || !["V1", "V2", "V3"].includes(evidence_type)) {
    return NextResponse.json(
      { error: "evidence_type must be V1, V2, or V3" },
      { status: 400 }
    );
  }
  if (!video_base64) {
    return NextResponse.json(
      { error: "video_base64 is required" },
      { status: 400 }
    );
  }

  // Fetch transaction
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .select("id, borrower_id, owner_id, state")
    .eq("id", transactionId)
    .single();

  if (txError || !transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const isBorrower = transaction.borrower_id === user.id;
  const isOwner = transaction.owner_id === user.id;

  // Role + type validation
  if (evidence_type === "V1" || evidence_type === "V2") {
    if (!isBorrower) {
      return NextResponse.json(
        { error: `Only the borrower can upload ${evidence_type} evidence` },
        { status: 403 }
      );
    }
  }
  if (evidence_type === "V3") {
    if (!isOwner) {
      return NextResponse.json(
        { error: "Only the owner can upload V3 evidence" },
        { status: 403 }
      );
    }
  }

  // State validation
  if (evidence_type === "V1" && transaction.state !== "deposit_held" && transaction.state !== "picked_up") {
    return NextResponse.json(
      { error: "V1 can only be uploaded around pickup time" },
      { status: 409 }
    );
  }
  if (evidence_type === "V2" && transaction.state !== "picked_up") {
    return NextResponse.json(
      { error: "V2 can only be uploaded when item is checked out" },
      { status: 409 }
    );
  }
  if (evidence_type === "V3" && !["return_submitted", "completed"].includes(transaction.state)) {
    return NextResponse.json(
      { error: "V3 can only be uploaded after return is submitted" },
      { status: 409 }
    );
  }

  // Upload video to Supabase Storage using service role
  const filename = `${transactionId}/${evidence_type}_${Date.now()}.webm`;
  const videoBuffer = Buffer.from(video_base64, "base64");

  const { error: uploadError } = await supabaseAdmin.storage
    .from("evidence-videos")
    .upload(filename, videoBuffer, {
      contentType: "video/webm",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Failed to upload video", detail: uploadError.message },
      { status: 500 }
    );
  }

  const { data: urlData } = supabaseAdmin.storage
    .from("evidence-videos")
    .getPublicUrl(filename);

  // Insert evidence record using service role (bypasses RLS for insert)
  const { data: evidence, error: insertError } = await supabaseAdmin
    .from("transaction_evidence")
    .insert({
      transaction_id: transactionId,
      uploader_id: user.id,
      evidence_type,
      video_url: urlData.publicUrl,
      duration_seconds: duration_seconds ?? null,
    })
    .select("id, evidence_type, video_url, captured_at")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: `${evidence_type} evidence already exists for this transaction` },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to save evidence", detail: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, evidence });
}

// ---------------------------------------------------------------------------
// GET: Retrieve all evidence for a transaction
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const { id: transactionId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: transaction } = await supabase
    .from("transactions")
    .select("borrower_id, owner_id")
    .eq("id", transactionId)
    .single();

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (transaction.borrower_id !== user.id && transaction.owner_id !== user.id) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  const { data: evidence, error } = await supabase
    .from("transaction_evidence")
    .select("id, evidence_type, video_url, thumbnail_url, duration_seconds, extracted_frames, captured_at")
    .eq("transaction_id", transactionId)
    .order("captured_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch evidence", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ evidence: evidence ?? [] });
}

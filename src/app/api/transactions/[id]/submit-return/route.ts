import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

// Service role client for bypassing RLS on transaction_photos insert
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const { id: transactionId } = await params;

  // 1. Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse request body — expect array of photo URLs from client upload
  const body = await request.json();
  const { photo_urls } = body as { photo_urls: string[] };

  if (!photo_urls || !Array.isArray(photo_urls) || photo_urls.length === 0) {
    return NextResponse.json(
      { error: "At least one return photo is required" },
      { status: 400 }
    );
  }

  if (photo_urls.length > 10) {
    return NextResponse.json(
      { error: "Maximum 10 return photos allowed" },
      { status: 400 }
    );
  }

  // 3. Fetch transaction
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .select("id, item_id, borrower_id, owner_id, state")
    .eq("id", transactionId)
    .single();

  if (txError || !transaction) {
    return NextResponse.json(
      { error: "Transaction not found" },
      { status: 404 }
    );
  }

  // 4. Must be borrower
  if (transaction.borrower_id !== user.id) {
    return NextResponse.json(
      { error: "Only the borrower can submit a return" },
      { status: 403 }
    );
  }

  // 5. Must be in picked_up state
  if (transaction.state !== "picked_up") {
    return NextResponse.json(
      {
        error: `Cannot submit return for a transaction in state "${transaction.state}"`,
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  // 6. Insert return photos into transaction_photos (service role to bypass RLS)
  const photoRows = photo_urls.map((url, i) => ({
    transaction_id: transactionId,
    submitted_by: user.id,
    photo_url: url,
    photo_type: "return",
    display_order: i,
    capture_method: "camera",
    captured_at: now,
  }));

  const { data: insertedPhotos, error: photoError } = await supabaseAdmin
    .from("transaction_photos")
    .insert(photoRows)
    .select("id");

  if (photoError || !insertedPhotos) {
    console.error("Failed to insert return photos:", photoError);
    return NextResponse.json(
      { error: "Failed to save return photos" },
      { status: 500 }
    );
  }

  const returnPhotoIds = insertedPhotos.map((p) => p.id);

  // 7. Get item condition_category for damage assessment baseline
  const { data: item } = await supabase
    .from("items")
    .select("title, condition_category, media_urls, owner_id")
    .eq("id", transaction.item_id)
    .single();

  const itemTitle = item?.title ?? "the item";

  // 8. Snapshot listing baseline photos into transaction_photos (if not already done at pickup)
  let listingPhotoIds: string[] = [];

  const { data: existingBaseline } = await supabaseAdmin
    .from("transaction_photos")
    .select("id")
    .eq("transaction_id", transactionId)
    .eq("photo_type", "listing_baseline");

  if (!existingBaseline || existingBaseline.length === 0) {
    // Snapshot now — listing photos weren't captured at pickup
    if (item?.media_urls && item.media_urls.length > 0) {
      const baselineRows = item.media_urls.map((url: string, i: number) => ({
        transaction_id: transactionId,
        submitted_by: item.owner_id,
        photo_url: url,
        photo_type: "listing_baseline",
        display_order: i,
        capture_method: "listing_snapshot",
        captured_at: now,
      }));

      const { data: baselinePhotos } = await supabaseAdmin
        .from("transaction_photos")
        .insert(baselineRows)
        .select("id");

      listingPhotoIds = baselinePhotos?.map((p) => p.id) ?? [];
    }
  } else {
    listingPhotoIds = existingBaseline.map((p) => p.id);
  }

  // 9. Create damage_assessments row (pending — vision agent runs later)
  const { error: assessmentError } = await supabaseAdmin
    .from("damage_assessments")
    .insert({
      transaction_id: transactionId,
      listing_photo_ids: listingPhotoIds,
      return_photo_ids: returnPhotoIds,
      condition_category: item?.condition_category ?? "good",
      status: "pending",
    });

  if (assessmentError) {
    console.error("Failed to create damage assessment:", assessmentError);
    // Non-blocking — continue with state transition even if assessment fails
  }

  // 10. Update transaction state to return_submitted
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      state: "return_submitted",
      return_submitted_at: now,
      updated_at: now,
    })
    .eq("id", transactionId);

  if (updateError) {
    console.error("Failed to update transaction state:", updateError);
    return NextResponse.json(
      { error: "Failed to submit return", detail: updateError.message },
      { status: 500 }
    );
  }

  // 11. Log state change
  await supabase.from("transaction_state_log").insert({
    transaction_id: transactionId,
    from_state: "picked_up",
    to_state: "return_submitted",
    changed_by: user.id,
    change_reason: "borrower_submitted_return",
    metadata: {
      return_photo_count: photo_urls.length,
      return_photo_ids: returnPhotoIds,
      damage_assessment_created: !assessmentError,
    },
  });

  // 12. Get borrower name for message
  const { data: borrowerProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const borrowerName = borrowerProfile?.display_name ?? "The borrower";

  // 13. Send message to owner
  await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: transaction.owner_id,
    message_type: "return_submitted",
    content: `${borrowerName} has submitted a return for "${itemTitle}" with ${photo_urls.length} photo${photo_urls.length !== 1 ? "s" : ""}. Please confirm you've received the item.`,
    topic: transaction.item_id,
    payload: {
      transaction_id: transactionId,
      item_id: transaction.item_id,
      item_title: itemTitle,
      return_photo_ids: returnPhotoIds,
      return_submitted_at: now,
    },
  });

  return NextResponse.json({
    success: true,
    new_state: "return_submitted",
    return_photo_count: photo_urls.length,
    damage_assessment_created: !assessmentError,
  });
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import BorrowRequestCard from "@/components/messages/BorrowRequestCard";
import DepositConfirmCard from "@/components/messages/DepositConfirmCard";
import ReturnConfirmCard from "@/components/messages/ReturnConfirmCard";
import PickupCoordinationCard from "@/components/messages/PickupCoordinationCard";
import PickupConfirmButton from "@/components/messages/PickupConfirmButton";
import PickupSuggestionCard from "@/components/messages/PickupSuggestionCard";
import { useLogisticsParser } from "@/hooks/useLogisticsParser";

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type: string;
  payload?: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
};

type Profile = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  unit_number: string;
  trust_score: number;
};

type Conversation = {
  partner: Profile;
  lastMessage: Message;
  unreadCount: number;
  messages: Message[];
};

// Message types that render as system badges (centered, no bubble)
const SYSTEM_MESSAGE_TYPES = [
  "request_declined",
  "request_pending",
  "request_expired",
  "pickup_confirmed",
  "pickup_partial",
  "return_initiated",
  "transaction_complete",
  "request_cancelled",
  "deposit_nudge",
  "deposit_warning",
  "deposit_auto_cancelled",
  "logistics_confirmed",
  "logistics_partial",
];

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [myId, setMyId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileCache, setProfileCache] = useState<Record<string, Profile>>({});
  // Track transaction states for active conversation
  const [transactionStates, setTransactionStates] = useState<
    Record<string, { state: string; owner_id: string }>
  >({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const activeConvRef = useRef<Conversation | null>(null);
  const supabase = createClient();
  const { triggerParse } = useLogisticsParser(() => {
    // Refresh conversation when Miles sends a suggestion
    setTimeout(() => window.location.reload(), 500);
  });

  // Keep ref in sync so realtime callback sees latest state
  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);

  // Fetch a profile (with cache)
  const fetchProfile = useCallback(
    async (id: string): Promise<Profile | null> => {
      if (profileCache[id]) return profileCache[id];
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, display_name, username, avatar_url, unit_number, trust_score",
        )
        .eq("id", id)
        .single();
      if (data) {
        setProfileCache((prev) => ({ ...prev, [id]: data }));
      }
      return data;
    },
    [profileCache],
  );

  // Mark messages as read
  const markAsRead = useCallback(async (partnerId: string, userId: string) => {
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", partnerId)
      .eq("recipient_id", userId)
      .is("read_at", null);
  }, []);

  // Fetch transaction states for messages that reference transactions
  const fetchTransactionStates = useCallback(async (messages: Message[]) => {
    const txIds = messages
      .filter((m) => m.payload?.transaction_id)
      .map((m) => m.payload!.transaction_id as string);

    const uniqueIds = [...new Set(txIds)];
    if (uniqueIds.length === 0) return;

    const { data } = await supabase
      .from("transactions")
      .select("id, state, owner_id")
      .in("id", uniqueIds);

    if (data) {
      const stateMap: Record<string, { state: string; owner_id: string }> = {};
      data.forEach((tx) => {
        stateMap[tx.id] = { state: tx.state, owner_id: tx.owner_id };
      });
      setTransactionStates((prev) => ({ ...prev, ...stateMap }));
    }
  }, []);

  // Handle incoming realtime message
  const handleRealtimeMessage = useCallback(
    async (payload: any) => {
      const msg: Message = payload.new;
      if (!myId) return;

      // Only process messages involving me
      if (msg.sender_id !== myId && msg.recipient_id !== myId) return;

      // Don't double-add messages I just sent
      if (msg.sender_id === myId) return;

      const partnerId =
        msg.sender_id === myId ? msg.recipient_id : msg.sender_id;

      // If message has a transaction ref, refresh that transaction's state
      if (msg.payload?.transaction_id) {
        fetchTransactionStates([msg]);
      }

      setConversations((prev) => {
        const existing = prev.find((c) => c.partner.id === partnerId);

        if (existing) {
          // Add message to existing conversation
          const updated = prev.map((c) => {
            if (c.partner.id !== partnerId) return c;
            const isActive = activeConvRef.current?.partner.id === partnerId;
            return {
              ...c,
              messages: [...c.messages, msg],
              lastMessage: msg,
              unreadCount: isActive ? c.unreadCount : c.unreadCount + 1,
            };
          });
          // Re-sort by latest message
          updated.sort(
            (a, b) =>
              new Date(b.lastMessage.created_at).getTime() -
              new Date(a.lastMessage.created_at).getTime(),
          );
          return updated;
        }

        // New conversation — need to fetch profile
        fetchProfile(partnerId).then((profile) => {
          if (!profile) return;
          const newConv: Conversation = {
            partner: profile,
            lastMessage: msg,
            unreadCount: 1,
            messages: [msg],
          };
          setConversations((p) => [newConv, ...p]);
        });

        return prev;
      });

      // If this conversation is currently open, update it and mark as read
      if (activeConvRef.current?.partner.id === partnerId) {
        setActiveConv((prev) => {
          if (!prev || prev.partner.id !== partnerId) return prev;
          return {
            ...prev,
            messages: [...prev.messages, msg],
            lastMessage: msg,
          };
        });
        markAsRead(partnerId, myId);
        setTimeout(
          () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
          100,
        );
      }
    },
    [myId, fetchProfile, markAsRead, fetchTransactionStates],
  );

  // Initial data load
  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }
      setMyId(user.id);

      // Fetch own profile for pickup card unit number
      const { data: ownProfile } = await supabase
        .from("profiles")
        .select(
          "id, display_name, username, avatar_url, unit_number, trust_score",
        )
        .eq("id", user.id)
        .single();
      if (ownProfile) setMyProfile(ownProfile);

      // Fetch all messages where I am sender or recipient
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: true });

      if (!msgs || msgs.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch transaction states for any transaction-linked messages
      fetchTransactionStates(msgs);

      // Group by conversation partner
      const partnerIds = [
        ...new Set(
          msgs.map((m) =>
            m.sender_id === user.id ? m.recipient_id : m.sender_id,
          ),
        ),
      ];

      const { data: profiles } = await supabase
        .from("profiles")
        .select(
          "id, display_name, username, avatar_url, unit_number, trust_score",
        )
        .in("id", partnerIds);

      const profileMap = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, p]),
      );
      setProfileCache(profileMap);

      const convs: Conversation[] = partnerIds
        .map((partnerId) => {
          const convMsgs = msgs.filter(
            (m) =>
              (m.sender_id === user.id && m.recipient_id === partnerId) ||
              (m.sender_id === partnerId && m.recipient_id === user.id),
          );
          const unread = convMsgs.filter(
            (m) => m.recipient_id === user.id && !m.read_at,
          ).length;
          return {
            partner: profileMap[partnerId],
            lastMessage: convMsgs[convMsgs.length - 1],
            unreadCount: unread,
            messages: convMsgs,
          };
        })
        .filter((c) => c.partner);

      convs.sort(
        (a, b) =>
          new Date(b.lastMessage.created_at).getTime() -
          new Date(a.lastMessage.created_at).getTime(),
      );
      setConversations(convs);

      // Auto-open conversation from URL param
      const openId = searchParams.get("with");
      if (openId) {
        const found = convs.find((c) => c.partner.id === openId);
        if (found) {
          setActiveConv(found);
          markAsRead(openId, user.id);
        }
      } else if (convs.length > 0) {
        setActiveConv(convs[0]);
        markAsRead(convs[0].partner.id, user.id);
      }

      setLoading(false);
    };
    load();
  }, []);

  // Set up Realtime subscription
  useEffect(() => {
    if (!myId) return;

    const channel = supabase
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${myId}`,
        },
        handleRealtimeMessage,
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [myId, handleRealtimeMessage]);

  // Scroll to bottom when active conversation changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.partner.id]);

  // When opening a conversation, mark unread as read
  const openConversation = useCallback(
    (conv: Conversation) => {
      setActiveConv(conv);
      if (myId && conv.unreadCount > 0) {
        markAsRead(conv.partner.id, myId);
        setConversations((prev) =>
          prev.map((c) =>
            c.partner.id === conv.partner.id ? { ...c, unreadCount: 0 } : c,
          ),
        );
      }
    },
    [myId, markAsRead],
  );

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConv || !myId) return;
    setSending(true);

    const { data: msg } = await supabase
      .from("messages")
      .insert({
        sender_id: myId,
        recipient_id: activeConv.partner.id,
        content: newMessage.trim(),
        message_type: "direct",
      })
      .select()
      .single();

    if (msg) {
      const updatedMsgs = [...activeConv.messages, msg];
      const updatedConv = {
        ...activeConv,
        messages: updatedMsgs,
        lastMessage: msg,
      };
      setActiveConv(updatedConv);
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.partner.id === activeConv.partner.id ? updatedConv : c,
        );
        updated.sort(
          (a, b) =>
            new Date(b.lastMessage.created_at).getTime() -
            new Date(a.lastMessage.created_at).getTime(),
        );
        return updated;
      });
    }

    setNewMessage("");
    setSending(false);
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      100,
    );

    // Trigger Miles to parse for logistics agreement
    // if (msg) {
    //   console.log("MILES DEBUG: transactionStates =", JSON.stringify(transactionStates));
      
    //   // Find transaction ID from conversation messages (more reliable than state lookup)
    //   const txIdFromMessages = activeConv?.messages
    //     .filter((m) => m.payload?.transaction_id)
    //     .map((m) => m.payload!.transaction_id as string)
    //     .pop();
      
    //   const activeTxId = txIdFromMessages 
    //     ?? Object.entries(transactionStates).find(
    //       ([, tx]) => ["approved", "deposit_held"].includes(tx.state)
    //     )?.[0];
      
    //   console.log("MILES DEBUG: activeTxId =", activeTxId);
      
    //   if (activeTxId) {
    //     triggerParse(activeTxId);
    //   }
    // }
  };

  // Refresh transaction state after an action (called by child components)
  const refreshTransactionState = useCallback(async (transactionId: string) => {
    const { data } = await supabase
      .from("transactions")
      .select("id, state, owner_id")
      .eq("id", transactionId)
      .single();

    if (data) {
      setTransactionStates((prev) => ({
        ...prev,
        [data.id]: { state: data.state, owner_id: data.owner_id },
      }));
    }
  }, []);

  function formatTime(ts: string) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000)
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  // Get conversation list preview text (handle system messages nicely)
  function previewText(msg: Message): string {
    if (msg.message_type === "borrow_request") return "Borrow request";
    if (msg.message_type === "request_accepted") return "Request accepted";
    if (msg.message_type === "request_declined") return "Request declined";
    if (msg.message_type === "request_pending") return "Considering request...";
    if (msg.message_type === "deposit_confirmed") return "Deposit confirmed";
    if (msg.message_type === "request_cancelled") return "Request cancelled";
    if (msg.message_type === "request_expired") return "Request expired";
    if (msg.message_type === "pickup_proposal") return "Pickup proposal sent";
    // if (msg.message_type === "pickup_suggestion") return "Miles suggested pickup details";
    if (msg.message_type === "logistics_confirmed") return "Pickup details locked in";
    if (msg.message_type === "logistics_partial") return "Pickup details — waiting for confirm";
    if (msg.message_type === "return_submitted") return "Return submitted";

    return msg.content;
  }

  // ─── Render a single message ───
  function renderMessage(msg: Message) {
    const isMine = msg.sender_id === myId;
    const payload = msg.payload ?? {};
    const txId = payload.transaction_id as string | undefined;
    const txState = txId ? transactionStates[txId] : undefined;

    // ─── Borrow request card (owner sees action buttons) ───
    if (msg.message_type === "borrow_request") {
      // If no transaction_id in payload, this is a legacy message —
      // render as a styled text bubble instead of the interactive card
      if (!txId) {
        return (
          <div
            key={msg.id}
            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs sm:max-w-sm rounded-2xl text-sm ${
                isMine
                  ? "bg-accent text-white rounded-br-md"
                  : "bg-inventory-100 text-inventory-900 rounded-bl-md"
              }`}
            >
              <div className="px-4 pt-2.5 pb-1">
                <span
                  className={`inline-block text-[10px] font-semibold uppercase tracking-wide mb-1 ${isMine ? "text-white/70" : "text-accent"}`}
                >
                  Borrow request
                </span>
              </div>
              <div className="px-4 pb-2.5">
                <p className="leading-relaxed">{msg.content}</p>
                <p
                  className={`text-xs mt-1 ${isMine ? "text-white/60" : "text-inventory-400"}`}
                >
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div
          key={msg.id}
          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
        >
          <div>
            <BorrowRequestCard
              transactionId={txId}
              itemTitle={(payload.item_title as string) ?? "Item"}
              itemPhotoUrl={payload.item_photo_url as string | null}
              borrowerName={(payload.borrower_name as string) ?? "Someone"}
              borrowerAvatarUrl={payload.borrower_avatar_url as string | null}
              requestMessage={msg.content}
              depositAmountCents={(payload.deposit_amount_cents as number) ?? 0}
              condition={payload.condition as string | null}
              currentState={txState?.state ?? "requested"}
              isOwner={myId === txState?.owner_id}
            />
            <p
              className={`text-[10px] mt-1 ${isMine ? "text-right" : ""} text-inventory-400`}
            >
              {formatTime(msg.created_at)}
            </p>
          </div>
        </div>
      );
    }

    // ─── Accepted → deposit confirm card (borrower sees CTA) ───
    if (msg.message_type === "request_accepted") {
      return (
        <div key={msg.id} className="flex flex-col items-center gap-1">
          <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs border border-green-200">
            Request accepted
          </span>
          <DepositConfirmCard
            transactionId={txId!}
            itemTitle={(payload.item_title as string) ?? "Item"}
            itemPhotoUrl={payload.item_photo_url as string | null}
            ownerName={activeConv?.partner.display_name ?? "Owner"}
            ownerAptNumber={activeConv?.partner.unit_number ?? null}
            depositAmountCents={(payload.deposit_amount_cents as number) ?? 0}
            currentState={txState?.state ?? "approved"}
            isBorrower={myId !== txState?.owner_id}
          />
          <p className="text-[10px] text-inventory-400">
            {formatTime(msg.created_at)}
          </p>
        </div>
      );
    }

    // ─── Deposit confirmed → system badge (Miles handles logistics now) ───
    if (msg.message_type === "deposit_confirmed") {
      return (
        <div key={msg.id} className="flex flex-col items-center gap-1">
          <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs border border-green-200">
            {msg.content}
          </span>
          <p className="text-[10px] text-inventory-400">
            {formatTime(msg.created_at)}
          </p>
        </div>
      );
    }

    // ─── Pickup proposal message with confirm button ───
    if (msg.message_type === "pickup_proposal") {
      const confirmations =
        txId && transactionStates[txId]
          ? (payload.confirmations as
              | { borrower_confirmed: boolean; owner_confirmed: boolean }
              | undefined)
          : undefined;

      return (
        <div
          key={msg.id}
          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-xs sm:max-w-sm rounded-2xl text-sm ${
              isMine
                ? "bg-accent text-white rounded-br-md"
                : "bg-inventory-100 text-inventory-900 rounded-bl-md"
            }`}
          >
            <div className="px-4 py-2.5">
              <p className="leading-relaxed whitespace-pre-line">
                {msg.content}
              </p>
              <p
                className={`text-xs mt-1 ${isMine ? "text-white/60" : "text-inventory-400"}`}
              >
                {formatTime(msg.created_at)}
              </p>
            </div>
            {txId && txState && (
              <div
                className={`px-4 pb-2.5 ${isMine ? "[&_button]:bg-white/20 [&_button]:text-white [&_button]:hover:bg-white/30 [&_span]:bg-white/10 [&_span]:text-white/90 [&_span]:border-white/20 [&_p]:text-white/70" : ""}`}
              >
                <PickupConfirmButton
                  transactionId={txId}
                  currentUserId={myId ?? ""}
                  ownerId={txState.owner_id}
                  confirmations={
                    confirmations ?? {
                      borrower_confirmed: false,
                      owner_confirmed: false,
                    }
                  }
                  transactionState={txState.state}
                />
              </div>
            )}
          </div>
        </div>
      );
    }

    // ─── Miles pickup suggestion → both parties see confirm card ───
    if (msg.message_type === "pickup_suggestion") {
      return (
        <div key={msg.id} className="flex flex-col items-center gap-1">
          <PickupSuggestionCard
            transactionId={(payload.transaction_id as string) ?? ""}
            currentUserId={myId ?? ""}
            ownerId={txState?.owner_id ?? ""}
            borrowerId={myId === txState?.owner_id ? activeConv?.partner.id ?? "" : myId ?? ""}
            suggestedLocation={(payload.suggested_location as string) ?? null}
            suggestedDate={(payload.suggested_date as string) ?? null}
            suggestedTime={(payload.suggested_time as string) ?? null}
            suggestedNote={(payload.suggested_note as string) ?? null}
            dateDisplay={(payload.date_display as string) ?? null}
            timeDisplay={(payload.time_display as string) ?? null}
            confidence={(payload.confidence as number) ?? 0.7}
            transactionState={txState?.state ?? "deposit_held"}
          />
          <p className="text-[10px] text-inventory-400">
            {formatTime(msg.created_at)}
          </p>
        </div>
      );
    }

    // ─── Return submitted → owner sees confirm card ───
    if (msg.message_type === "return_submitted") {
      return (
        <div key={msg.id} className="flex flex-col items-center gap-1">
          <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200">
            {msg.content}
          </span>
          <ReturnConfirmCard
            transactionId={txId!}
            itemTitle={(payload.item_title as string) ?? "Item"}
            returnPhotoCount={
              (payload.return_photo_ids as string[])?.length ?? 0
            }
            borrowerName={activeConv?.partner.display_name ?? "Borrower"}
            currentState={txState?.state ?? "return_submitted"}
            isOwner={myId === txState?.owner_id}
          />
          <p className="text-[10px] text-inventory-400">
            {formatTime(msg.created_at)}
          </p>
        </div>
      );
    }

    if (msg.message_type === "return_submitted") return "Return submitted";
    // ─── System badge messages ───
    if (SYSTEM_MESSAGE_TYPES.includes(msg.message_type)) {
      const variantMap: Record<string, string> = {
        request_declined: "bg-red-50 text-red-700 border-red-200",
        request_pending: "bg-amber-50 text-amber-700 border-amber-200",
        request_expired:
          "bg-inventory-100 text-inventory-500 border-inventory-200",
        deposit_confirmed: "bg-green-50 text-green-700 border-green-200",
        deposit_nudge: "bg-amber-50 text-amber-700 border-amber-200",
        deposit_warning: "bg-red-50 text-red-700 border-red-200",
        deposit_auto_cancelled: "bg-red-50 text-red-700 border-red-200",
        pickup_confirmed: "bg-green-50 text-green-700 border-green-200",
        pickup_partial: "bg-amber-50 text-amber-700 border-amber-200",
        logistics_confirmed: "bg-green-50 text-green-700 border-green-200",
        logistics_partial: "bg-amber-50 text-amber-700 border-amber-200",
        return_initiated: "bg-blue-50 text-blue-700 border-blue-200",
        transaction_complete: "bg-green-50 text-green-700 border-green-200",
        request_cancelled:
          "bg-inventory-100 text-inventory-500 border-inventory-200",
      };
      return (
        <div key={msg.id} className="flex justify-center">
          <div
            className={`px-3 py-1.5 rounded-lg text-xs text-center border max-w-[90%] ${variantMap[msg.message_type] ?? "bg-inventory-100 text-inventory-500 border-inventory-200"}`}
          >
            {msg.content}
          </div>
        </div>
      );
    }

    // ─── Regular chat / direct message ───
    return (
      <div
        key={msg.id}
        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
      >
        <div
          className={`max-w-xs sm:max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
            isMine
              ? "bg-accent text-white rounded-br-md"
              : "bg-inventory-100 text-inventory-900 rounded-bl-md"
          }`}
        >
          <p className="leading-relaxed">{msg.content}</p>
          <p
            className={`text-xs mt-1 ${isMine ? "text-white/60" : "text-inventory-400"}`}
          >
            {formatTime(msg.created_at)}
          </p>
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
      </main>
    );

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-inventory-200/50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-inventory-500 hover:text-inventory-900 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="font-display font-bold text-base flex-1 flex items-center gap-2">
            Inbox
            <span
              className="w-2 h-2 rounded-full bg-trust-high animate-pulse"
              title="Live"
            />
          </h1>
          {conversations.reduce((n, c) => n + c.unreadCount, 0) > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-accent text-white text-xs font-bold">
              {conversations.reduce((n, c) => n + c.unreadCount, 0)} new
            </span>
          )}
        </div>
      </header>

      {conversations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <span className="text-5xl mb-4">💬</span>
          <p className="font-display font-bold text-inventory-700 mb-2">
            No messages yet
          </p>
          <p className="text-sm text-inventory-400 mb-6">
            When you message a neighbor or someone messages you, it&apos;ll
            appear here.
          </p>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 bg-accent text-white rounded-xl font-display font-semibold text-sm"
          >
            Browse Items →
          </Link>
        </div>
      ) : (
        <div className="flex-1 flex max-w-5xl mx-auto w-full">
          {/* Conversation list */}
          <aside
            className={`w-full sm:w-72 border-r border-inventory-100 flex-shrink-0 ${activeConv ? "hidden sm:block" : "block"}`}
          >
            {conversations.map((conv) => (
              <button
                key={conv.partner.id}
                onClick={() => openConversation(conv)}
                className={`w-full flex items-center gap-3 px-4 py-4 border-b border-inventory-50 hover:bg-inventory-50 transition-colors text-left ${activeConv?.partner.id === conv.partner.id ? "bg-accent/5 border-l-2 border-l-accent" : ""}`}
              >
                <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {conv.partner.avatar_url ? (
                    <img
                      src={conv.partner.avatar_url}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-bold text-accent">
                      {conv.partner.display_name?.[0] ?? "?"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-display font-bold text-sm truncate">
                      {conv.partner.display_name}
                    </p>
                    <span className="text-xs text-inventory-400 flex-shrink-0 ml-2">
                      {formatTime(conv.lastMessage.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-inventory-400 truncate">
                    {previewText(conv.lastMessage)}
                  </p>
                </div>
                {conv.unreadCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </aside>

          {/* Message thread */}
          {activeConv ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Thread header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-inventory-100 bg-white">
                <button
                  onClick={() => setActiveConv(null)}
                  className="sm:hidden text-inventory-500"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <Link
                  href={`/profile/${activeConv.partner.id}`}
                  className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity"
                >
                  <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden">
                    {activeConv.partner.avatar_url ? (
                      <img
                        src={activeConv.partner.avatar_url}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-bold text-accent text-sm">
                        {activeConv.partner.display_name?.[0]}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-display font-bold text-sm">
                      {activeConv.partner.display_name}
                    </p>
                    <p className="text-xs text-inventory-400">
                      Unit {activeConv.partner.unit_number}
                    </p>
                  </div>
                </Link>
              </div>

              {/* Messages */}
              <div
                className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
                style={{ maxHeight: "calc(100vh - 220px)" }}
              >
                {activeConv.messages.map((msg) => renderMessage(msg))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-inventory-100 bg-white flex gap-2 items-end">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Message ${activeConv.partner.display_name.split(" ")[0]}...`}
                  rows={1}
                  className="flex-1 px-4 py-2.5 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm resize-none transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !newMessage.trim()}
                  className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center flex-shrink-0 hover:bg-accent-dark transition-colors disabled:opacity-50"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 hidden sm:flex items-center justify-center text-center">
              <div>
                <span className="text-4xl mb-3 block">💬</span>
                <p className="font-display font-bold text-inventory-500">
                  Select a conversation
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

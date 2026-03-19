import { useCallback, useRef } from "react";

/**
 * useLogisticsParser
 *
 * Call `triggerParse(transactionId)` after a chat message is sent.
 * It debounces (waits 2s after the last message) then calls
 * /api/miles/parse-logistics to check if both parties agreed on
 * pickup details. If so, Miles auto-sends a pickup_suggestion
 * message into the thread.
 *
 * Usage in your conversation/chat component:
 *
 *   const { triggerParse } = useLogisticsParser();
 *
 *   async function handleSendMessage() {
 *     await fetch("/api/messages/send", { ... });
 *     // After sending, trigger logistics parse
 *     if (transactionId) {
 *       triggerParse(transactionId);
 *     }
 *   }
 */
export function useLogisticsParser() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastParsedRef = useRef<string | null>(null);

  const triggerParse = useCallback((transactionId: string) => {
    // Debounce — wait 2 seconds after the last message before parsing
    // This avoids parsing mid-conversation when messages come rapid-fire
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      // Don't re-parse the same transaction within 30 seconds
      const cacheKey = `${transactionId}`;
      const now = Date.now();
      const lastParsed = lastParsedRef.current;

      console.log("MILES HOOK: timer fired, cacheKey =", cacheKey, "lastParsed =", lastParsed);

      if (lastParsed === cacheKey) {
        console.log("MILES HOOK: skipping — already parsed");
        return; // Skip — already parsed recently
      }

      try {
        console.log("MILES HOOK: calling parse-logistics API...");
        const res = await fetch("/api/miles/parse-logistics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction_id: transactionId }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.suggestion_sent) {
            // Miles sent a suggestion — the realtime subscription
            // on messages will pick it up and render the card
            lastParsedRef.current = cacheKey;
          }
        }
      } catch (err) {
        // Silent fail — logistics parsing is best-effort
        console.error("Logistics parse failed:", err);
      }
    }, 2000);
  }, []);

  return { triggerParse };
}

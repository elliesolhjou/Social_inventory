import { useCallback, useRef } from "react";

export function useLogisticsParser(onSuggestionSent?: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastParsedRef = useRef<{ key: string; time: number } | null>(null);

  const triggerParse = useCallback(
    (transactionId: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(async () => {
        const cacheKey = transactionId;
        const now = Date.now();

        if (
          lastParsedRef.current &&
          lastParsedRef.current.key === cacheKey &&
          now - lastParsedRef.current.time < 30000
        ) {
          return;
        }

        try {
          const res = await fetch("/api/miles/parse-logistics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transaction_id: transactionId }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.suggestion_sent) {
              lastParsedRef.current = { key: cacheKey, time: now };
              onSuggestionSent?.();
            }
          }
        } catch (err) {
          console.error("Logistics parse failed:", err);
        }
      }, 2000);
    },
    [onSuggestionSent],
  );

  return { triggerParse };
}

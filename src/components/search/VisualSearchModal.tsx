"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";

interface VisualSearchResult {
  id: string;
  title: string;
  thumbnail_url: string | null;
  category: string;
  ai_condition: string | null;
  deposit_cents: number;
  similarity: number;
  composite_score: number;
  owner: {
    id: string;
    name: string;
    avatar_url: string | null;
    trust_score: number;
  };
}

interface VisualSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SearchState = "upload" | "searching" | "results";

export default function VisualSearchModal({
  isOpen,
  onClose,
}: VisualSearchModalProps) {
  const [state, setState] = useState<SearchState>("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [results, setResults] = useState<VisualSearchResult[]>([]);
  const [milesMessage, setMilesMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setState("upload");
    setPreview(null);
    setResults([]);
    setMilesMessage("");
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSearch = useCallback(async (frame: string) => {
    setPreview(frame);
    setState("searching");
    setError(null);

    try {
      const response = await fetch("/api/search/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frame }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Search failed");
      }

      const data = await response.json();
      setResults(data.results || []);
      setMilesMessage(data.miles_message || "");
      setState("results");
    } catch (err: any) {
      console.error("Visual search error:", err);
      setError(err.message || "Search failed. Please try again.");
      setState("upload");
    }
  }, []);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        handleSearch(dataUrl);
      };
      reader.readAsDataURL(file);

      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [handleSearch],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 px-6 pt-5 pb-3 flex items-center justify-between border-b border-inventory-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔍</span>
            <h2 className="font-display text-lg font-bold">
              {state === "upload"
                ? "Search by Photo"
                : state === "searching"
                  ? "Miles is looking..."
                  : "Search Results"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-inventory-100 flex items-center justify-center hover:bg-inventory-200 transition-colors"
          >
            <svg
              className="w-4 h-4 text-inventory-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {/* ERROR */}
          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* UPLOAD STATE */}
          {state === "upload" && (
            <div className="space-y-4">
              <p className="text-inventory-500 text-sm">
                Upload or take a photo of what you&apos;re looking for. Miles
                will search your building&apos;s inventory for matches.
              </p>

              <div className="flex gap-3">
                {/* Camera */}
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 py-8 border-2 border-dashed border-accent/30 rounded-2xl flex flex-col items-center gap-2 hover:bg-accent/5 transition-colors"
                >
                  <svg
                    className="w-8 h-8 text-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span className="text-sm font-medium text-accent">
                    Take Photo
                  </span>
                </button>

                {/* Gallery */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-8 border-2 border-dashed border-inventory-300 rounded-2xl flex flex-col items-center gap-2 hover:bg-inventory-50 transition-colors"
                >
                  <svg
                    className="w-8 h-8 text-inventory-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-sm font-medium text-inventory-500">
                    Upload Photo
                  </span>
                </button>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFile}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="hidden"
              />
            </div>
          )}

          {/* SEARCHING STATE */}
          {state === "searching" && (
            <div className="flex flex-col items-center py-10">
              {/* Preview of search image */}
              {preview && (
                <div className="w-24 h-24 rounded-2xl overflow-hidden mb-6 ring-2 ring-accent/20">
                  <img
                    src={preview}
                    alt="Search"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="relative w-12 h-12 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-inventory-100" />
                <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin" />
              </div>

              <p className="text-sm text-inventory-500 text-center">
                Miles is searching your building&apos;s inventory...
              </p>
            </div>
          )}

          {/* RESULTS STATE */}
          {state === "results" && (
            <div className="space-y-4">
              {/* Miles message */}
              <div className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm">🤖</span>
                </div>
                <div className="bg-inventory-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-inventory-700">
                  {milesMessage}
                </div>
              </div>

              {/* Search image preview */}
              {preview && (
                <div className="flex items-center gap-3 px-3 py-2 bg-inventory-50 rounded-xl">
                  <img
                    src={preview}
                    alt="Your search"
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <span className="text-xs text-inventory-500">
                    Your search photo
                  </span>
                </div>
              )}

              {/* Results list */}
              {results.length > 0 ? (
                <div className="space-y-3">
                  {results.map((item) => (
                    <Link
                      key={item.id}
                      href={`/item/${item.id}`}
                      onClick={handleClose}
                      className="flex gap-3 p-3 rounded-2xl border border-inventory-100 hover:border-accent/30 hover:bg-accent/5 transition-all"
                    >
                      {/* Item image */}
                      <div className="w-16 h-16 rounded-xl bg-inventory-100 overflow-hidden flex-shrink-0">
                        {item.thumbnail_url ? (
                          <img
                            src={item.thumbnail_url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">
                            📦
                          </div>
                        )}
                      </div>

                      {/* Item info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-bold text-sm truncate">
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-inventory-500">
                            {item.owner.name}
                          </span>
                          {item.ai_condition && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-inventory-100 text-inventory-600">
                              {item.ai_condition}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs font-bold text-accent">
                            ${(item.deposit_cents / 100).toFixed(0)} deposit
                          </span>
                          <span className="text-xs text-inventory-400">
                            {Math.round(item.similarity * 100)}% match
                          </span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center">
                        <svg
                          className="w-4 h-4 text-inventory-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                /* No results — broadcast prompt */
                <div className="text-center py-4">
                  <p className="text-sm text-inventory-500 mb-3">
                    Want to let your neighbors know you&apos;re looking for this?
                  </p>
                  <button
                    onClick={handleClose}
                    className="px-6 py-2.5 bg-accent text-white rounded-2xl text-sm font-display font-semibold hover:bg-accent/90 transition-colors"
                  >
                    Post a Broadcast Request
                  </button>
                </div>
              )}

              {/* Search again */}
              <button
                onClick={reset}
                className="w-full py-2.5 border-2 border-inventory-200 text-inventory-600 rounded-2xl text-sm font-display font-semibold hover:border-inventory-400 transition-colors"
              >
                Search Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

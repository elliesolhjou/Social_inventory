"use client";
import { useState, useEffect, useRef } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  onVisualSearch?: () => void;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({
  onSearch,
  onVisualSearch,
  placeholder = "Search items, categories, brands...",
  className = "",
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce — fire search 200ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => onSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const clear = () => {
    setQuery("");
    onSearch("");
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search icon */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          className="w-4 h-4 text-inventory-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"
          />
        </svg>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-20 py-3 rounded-2xl border-2 border-inventory-200 bg-white/80 backdrop-blur text-sm focus:border-accent focus:outline-none transition-colors placeholder:text-inventory-400 font-body"
      />

      {/* Right side buttons */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {/* Clear button */}
        {query && (
          <button
            onClick={clear}
            className="w-6 h-6 rounded-full bg-inventory-200 flex items-center justify-center hover:bg-inventory-300 transition-colors"
          >
            <svg
              className="w-3 h-3 text-inventory-600"
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
        )}

        {/* Camera button — visual search */}
        {onVisualSearch && (
          <button
            onClick={onVisualSearch}
            className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center hover:bg-accent/20 transition-colors"
            title="Search by photo"
          >
            <svg
              className="w-4 h-4 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

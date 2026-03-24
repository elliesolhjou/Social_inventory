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
          className="w-5 h-5 text-[#8f7067]"
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
        className="w-full pl-12 pr-24 py-3.5 rounded-full border border-[#e6e2de] bg-white text-[#1c1b1a] text-sm focus:border-[#ae3200] focus:ring-2 focus:ring-[#ae3200]/20 focus:outline-none transition-all placeholder:text-[#8f7067] font-['Be_Vietnam_Pro'] shadow-sm"
      />

      {/* Right side buttons */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {/* Clear button */}
        {query && (
          <button
            onClick={clear}
            className="w-7 h-7 rounded-full bg-[#ebe7e4] flex items-center justify-center hover:bg-[#ddd9d6] transition-colors"
          >
            <svg
              className="w-3.5 h-3.5 text-[#5b4038]"
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
            className="w-8 h-8 rounded-full bg-[#ae3200]/10 flex items-center justify-center hover:bg-[#ae3200]/20 transition-colors"
            title="Search by photo"
          >
            <svg
              className="w-4 h-4 text-[#ae3200]"
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

"use client";

import { useEffect, useRef, useState } from "react";

interface TagChipInputProps {
  /** Comma-separated tag string, same shape as Card.tags */
  value: string;
  onChange: (next: string) => void;
  label?: string;
  placeholder?: string;
}

function parse(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function serialize(tags: string[]): string {
  return tags.join(",");
}

/**
 * Chip-style tag input with typeahead from the user's existing tags.
 * Tags are stored as a comma-separated string (matches Card.tags),
 * so this is a drop-in replacement for the old free-text input.
 */
export function TagChipInput({
  value,
  onChange,
  label = "Tags",
  placeholder = "Add tag…",
}: TagChipInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = parse(value);

  // Fetch the user's existing tag list once on mount for autocomplete.
  useEffect(() => {
    fetch("/api/user/tags")
      .then((r) => r.json())
      .then((data: { tags: { name: string }[] }) => {
        setAllTags(data.tags.map((t) => t.name));
      })
      .catch(() => setAllTags([]));
  }, []);

  // Recompute suggestions whenever input or existing tags change.
  useEffect(() => {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    const matches = allTags
      .filter(
        (t) =>
          t.toLowerCase().includes(trimmed) &&
          !tags.includes(t)
      )
      .slice(0, 6);
    setSuggestions(matches);
  }, [input, allTags, tags]);

  function addTag(tag: string) {
    const clean = tag.trim();
    if (!clean) return;
    if (tags.includes(clean)) {
      setInput("");
      return;
    }
    onChange(serialize([...tags, clean]));
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(serialize(tags.filter((t) => t !== tag)));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 min-h-[40px] focus-within:ring-2 focus-within:ring-ring"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-primary/15 text-primary text-xs font-medium px-2 py-0.5"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="hover:text-primary/70 text-xs leading-none"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Short delay lets click on a suggestion register before blur closes the list
            setTimeout(() => setFocused(false), 150);
            if (input.trim()) addTag(input);
          }}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[100px] bg-transparent outline-none text-sm"
        />
      </div>
      {focused && suggestions.length > 0 && (
        <div className="relative">
          <div className="absolute left-0 right-0 top-1 z-10 rounded-lg border border-border bg-popover shadow-md p-1">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(s);
                }}
                className="block w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Press Enter or comma to add. Backspace removes the last tag.
      </p>
    </div>
  );
}

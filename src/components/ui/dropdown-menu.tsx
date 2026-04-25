"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function DropdownMenu({ trigger, children, align = "right", className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            // Higher z, beefier shadow + backdrop-blur so the menu
            // visually separates from the warm-dark content underneath
            // (the home-page hero card has the same bg-card colour, so
            // a plain border isn't enough to distinguish them).
            "absolute z-[60] mt-2 min-w-[200px] overflow-hidden rounded-xl border border-border bg-[color-mix(in_oklch,var(--card)_92%,white)] p-1 shadow-2xl shadow-black/40 backdrop-blur-md",
            align === "right" ? "right-0" : "left-0",
            className
          )}
        >
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  destructive?: boolean;
}

export function DropdownItem({ children, onClick, className, destructive }: DropdownItemProps) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-primary/10",
        destructive && "text-destructive hover:bg-destructive/10",
        className
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

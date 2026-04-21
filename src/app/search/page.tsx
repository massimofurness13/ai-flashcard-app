import { Suspense } from "react";
import { SearchClient } from "./search-client";

export const metadata = {
  title: "Search · FlashMind",
};

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <SearchClient />
    </Suspense>
  );
}

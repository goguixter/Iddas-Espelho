"use client";

import { Search } from "lucide-react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  RecordTable,
  type RecordTableColumn,
  type RecordTableRow,
} from "@/components/record-table";

export function SearchableRecordTable({
  columns,
  currentQuery,
  emptyLabel,
  hrefBase,
  placeholder,
  rows,
}: {
  columns: RecordTableColumn[];
  currentQuery?: string;
  emptyLabel: string;
  hrefBase?: string;
  placeholder: string;
  rows: RecordTableRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(currentQuery ?? "");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const normalizedCurrent = (currentQuery ?? "").trim();
    const normalizedDeferred = deferredQuery.trim();

    if (normalizedCurrent === normalizedDeferred) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());

    if (normalizedDeferred) {
      nextParams.set("q", normalizedDeferred);
    } else {
      nextParams.delete("q");
    }

    nextParams.delete("page");

    const nextUrl = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname;

    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        router.replace(nextUrl, { scroll: false });
      });
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [currentQuery, deferredQuery, pathname, router, searchParams]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <label className="relative block shrink-0">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-faint)]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] py-2.5 pr-4 pl-10 text-[13px] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent)]"
        />
      </label>

      <div className="min-h-0 flex-1">
        <RecordTable
          columns={columns}
          emptyLabel={emptyLabel}
          hrefBase={hrefBase}
          rows={rows}
        />
      </div>
    </div>
  );
}

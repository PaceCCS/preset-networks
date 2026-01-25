"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { presetsQueryOptions } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { data: presets, isLoading, error } = useQuery(presetsQueryOptions());

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col bg-brand-white border border-brand-grey-3 overflow-y-auto">
      <section className="flex flex-col items-center justify-center border-b pb-4 border-brand-grey-3 p-4">
        <h1 className="text-3xl font-bold">Preset Networks</h1>
        <p className="text-brand-grey-2 mt-2">
          Select a network preset to view and edit
        </p>
      </section>

      <section className="flex flex-col p-4">
        <h2 className="text-xl font-semibold mb-4">Available Presets</h2>

        {isLoading && (
          <div className="text-brand-grey-2">Loading presets...</div>
        )}

        {error && (
          <div className="text-destructive">
            Failed to load presets: {error.message}
          </div>
        )}

        {presets && presets.length === 0 && (
          <div className="text-brand-grey-2">No presets available</div>
        )}

        {presets && presets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {presets.map((preset) => (
              <Link
                key={preset.id}
                href={`/network/${preset.id}`}
                className="block"
              >
                <Button
                  variant="outline"
                  className="w-full h-auto py-4 flex flex-col items-start"
                >
                  <span className="font-medium">{preset.label}</span>
                  <span className="text-sm text-brand-grey-2">{preset.id}</span>
                </Button>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col p-4 border-t border-brand-grey-3">
        <h2 className="text-xl font-semibold mb-2">About</h2>
        <p className="text-brand-grey-2">
          Flow networks consist of branches (linear segments) containing blocks
          (components). Each block has properties defined by a schema, which
          generates forms for editing.
        </p>
      </section>
    </div>
  );
}

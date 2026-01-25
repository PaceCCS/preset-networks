"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { DimProvider } from "@/contexts/dim-context";
import DialogProvider from "@/contexts/dialog-provider";
import KeybindProvider from "@/contexts/keybind-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DimProvider>
        <KeybindProvider>
          <DialogProvider>{children}</DialogProvider>
        </KeybindProvider>
      </DimProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

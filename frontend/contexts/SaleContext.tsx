"use client";

import { createContext, useContext, useState } from "react";

const SaleContext = createContext<{
  refreshSales: () => void;
  setRefreshSales: (fn: () => void) => void;
}>({
  refreshSales: () => {},
  setRefreshSales: () => {},
});

export function SaleProvider({ children }: { children: React.ReactNode }) {
  const [refreshSales, setRefreshSales] = useState<() => void>(() => {});
  return (
    <SaleContext.Provider value={{ refreshSales, setRefreshSales }}>
      {children}
    </SaleContext.Provider>
  );
}

export const useSaleContext = () => useContext(SaleContext);
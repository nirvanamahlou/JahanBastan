"use client";

import { createContext, useContext } from "react";

const OnlineSalesContext = createContext(false);

export function OnlineSalesProvider({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled: boolean;
}) {
  return (
    <OnlineSalesContext.Provider value={enabled}>
      {children}
    </OnlineSalesContext.Provider>
  );
}

export function useOnlineSalesEnabled() {
  return useContext(OnlineSalesContext);
}

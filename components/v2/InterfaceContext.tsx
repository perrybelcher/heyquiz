"use client";

import { createContext, useContext, type ReactNode } from "react";

export type InterfaceVersion = "v1" | "v2";
const InterfaceContext = createContext<InterfaceVersion>("v1");

export function InterfaceProvider({ version, children }: { version: InterfaceVersion; children: ReactNode }) {
  return <InterfaceContext.Provider value={version}>{children}</InterfaceContext.Provider>;
}

export function useInterfaceVersion(): InterfaceVersion {
  return useContext(InterfaceContext);
}

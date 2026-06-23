"use client";
import { createContext, useContext } from "react";
import type { Mode } from "./index";

const ModeContext = createContext<Mode>("buy");

export function ModeProvider({ mode, children }: { mode: Mode; children: React.ReactNode }) {
  return <ModeContext.Provider value={mode}>{children}</ModeContext.Provider>;
}

export function useMode(): Mode {
  return useContext(ModeContext);
}

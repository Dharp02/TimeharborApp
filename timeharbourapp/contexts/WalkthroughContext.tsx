'use client';

import { createContext, useContext } from 'react';

interface WalkthroughContextValue {
  /** True while the walkthrough modal is showing */
  isActive: boolean;
}

const WalkthroughContext = createContext<WalkthroughContextValue>({ isActive: false });

export const WalkthroughProvider = WalkthroughContext.Provider;

export function useWalkthroughActive(): boolean {
  return useContext(WalkthroughContext).isActive;
}

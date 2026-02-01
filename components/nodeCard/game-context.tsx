"use client";

import { createContext, useContext } from "react";

interface GameContextType {
  isGameActive: boolean;
}

export const GameContext = createContext<GameContextType>({ isGameActive: false });

export const useGameContext = () => useContext(GameContext);

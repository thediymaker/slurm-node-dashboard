"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { X, Flame, Zap, Bug, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { GameContext } from "./game-context";

interface NodeGameWrapperProps {
  children: React.ReactNode;
  nodes: any[];
  isGameActive: boolean;
  onGameEnd: () => void;
}

interface NodeEmergency {
  nodeId: string;
  type: "fire" | "overload" | "bug" | "attack";
  startTime: number;
  duration: number;
}

const EMERGENCY_CONFIG = {
  fire: { label: "OVERHEAT", icon: Flame },
  overload: { label: "OVERLOAD", icon: Zap },
  bug: { label: "MALWARE", icon: Bug },
  attack: { label: "ALERT", icon: AlertTriangle },
};

const GAME_DURATION = 60000;
const BASE_EMERGENCY_INTERVAL = 2000;
const MIN_EMERGENCY_INTERVAL = 500;
const BASE_EMERGENCY_DURATION = 4000;
const MIN_EMERGENCY_DURATION = 1500;

export const NodeGameWrapper = ({ children, nodes, isGameActive, onGameEnd }: NodeGameWrapperProps) => {
  const [emergencies, setEmergencies] = useState<NodeEmergency[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameTime, setGameTime] = useState(GAME_DURATION);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [savedNodes, setSavedNodes] = useState(0);
  const [lostNodes, setLostNodes] = useState(0);
  const [showGameOver, setShowGameOver] = useState(false);
  const [clickEffects, setClickEffects] = useState<{ id: number; x: number; y: number; points: number }[]>([]);
  
  const gameStartRef = useRef<number>(0);
  const lastEmergencyRef = useRef<number>(0);

  const getDifficulty = useCallback(() => {
    const elapsed = Date.now() - gameStartRef.current;
    const progress = Math.min(1, elapsed / GAME_DURATION);
    
    return {
      emergencyInterval: BASE_EMERGENCY_INTERVAL - (BASE_EMERGENCY_INTERVAL - MIN_EMERGENCY_INTERVAL) * progress,
      emergencyDuration: BASE_EMERGENCY_DURATION - (BASE_EMERGENCY_DURATION - MIN_EMERGENCY_DURATION) * progress,
      maxSimultaneous: Math.floor(1 + progress * Math.min(nodes.length - 1, 5)),
    };
  }, [nodes.length]);

  useEffect(() => {
    if (!isGameActive) {
      setEmergencies([]);
      setScore(0);
      setLives(3);
      setGameTime(GAME_DURATION);
      setCombo(0);
      setMaxCombo(0);
      setSavedNodes(0);
      setLostNodes(0);
      setShowGameOver(false);
      return;
    }

    gameStartRef.current = Date.now();
    lastEmergencyRef.current = Date.now();
  }, [isGameActive]);

  useEffect(() => {
    if (!isGameActive || showGameOver || nodes.length === 0) return;

    const gameLoop = setInterval(() => {
      const now = Date.now();
      const elapsed = now - gameStartRef.current;
      
      const remaining = Math.max(0, GAME_DURATION - elapsed);
      setGameTime(remaining);

      if (remaining <= 0) {
        setShowGameOver(true);
        return;
      }

      const difficulty = getDifficulty();

      if (now - lastEmergencyRef.current > difficulty.emergencyInterval) {
        setEmergencies((prev) => {
          if (prev.length >= difficulty.maxSimultaneous) return prev;

          const availableNodes = nodes.filter(
            (n) => !prev.some((e) => e.nodeId === (n.hostname || n.name))
          );

          if (availableNodes.length === 0) return prev;

          const randomNode = availableNodes[Math.floor(Math.random() * availableNodes.length)];
          const types: NodeEmergency["type"][] = ["fire", "overload", "bug", "attack"];
          const randomType = types[Math.floor(Math.random() * types.length)];

          lastEmergencyRef.current = now;

          return [
            ...prev,
            {
              nodeId: randomNode.hostname || randomNode.name,
              type: randomType,
              startTime: now,
              duration: difficulty.emergencyDuration,
            },
          ];
        });
      }

      setEmergencies((prev) => {
        const expired = prev.filter((e) => now - e.startTime >= e.duration);
        
        if (expired.length > 0) {
          setLives((l) => {
            const newLives = l - expired.length;
            if (newLives <= 0) {
              setShowGameOver(true);
            }
            return Math.max(0, newLives);
          });
          setLostNodes((n) => n + expired.length);
          setCombo(0);
        }

        return prev.filter((e) => now - e.startTime < e.duration);
      });
    }, 50);

    return () => clearInterval(gameLoop);
  }, [isGameActive, showGameOver, nodes, getDifficulty]);

  const handleNodeClick = useCallback((nodeId: string, event: React.MouseEvent) => {
    if (!isGameActive || showGameOver) return;

    const emergency = emergencies.find((e) => e.nodeId === nodeId);
    if (!emergency) return;

    const now = Date.now();
    const timeRemaining = emergency.duration - (now - emergency.startTime);
    const timeBonus = Math.floor((timeRemaining / emergency.duration) * 50);
    const comboBonus = combo * 10;
    const points = 100 + timeBonus + comboBonus;

    setEmergencies((prev) => prev.filter((e) => e.nodeId !== nodeId));
    setScore((s) => s + points);
    setCombo((c) => {
      const newCombo = c + 1;
      setMaxCombo((m) => Math.max(m, newCombo));
      return newCombo;
    });
    setSavedNodes((n) => n + 1);

    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const effectId = Date.now() + Math.random();
    setClickEffects((prev) => [
      ...prev,
      { id: effectId, x: rect.left + rect.width / 2, y: rect.top - 8, points },
    ]);

    setTimeout(() => {
      setClickEffects((prev) => prev.filter((e) => e.id !== effectId));
    }, 800);
  }, [isGameActive, showGameOver, emergencies, combo]);

  useEffect(() => {
    if (clickEffects.length === 0) return;
    const timeout = setTimeout(() => {
      setClickEffects((prev) => prev.slice(1));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [clickEffects]);

  const timeSeconds = Math.ceil(gameTime / 1000);
  const timePercent = (gameTime / GAME_DURATION) * 100;

  if (!isGameActive) {
    return (
      <GameContext.Provider value={{ isGameActive: false }}>
        {children}
      </GameContext.Provider>
    );
  }

  return (
    <GameContext.Provider value={{ isGameActive: true }}>
      <div className="relative">
        {/* Game HUD - Matches footer style */}
        <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mb-4">
          <div className="flex h-10 items-center justify-between px-4 text-sm font-medium">
            {/* Left: Score & Stats */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Score</span>
                <span className="font-mono text-xs font-medium tabular-nums">{score.toLocaleString()}</span>
              </div>

              <Separator orientation="vertical" className="h-4" />

              <div className="flex items-center gap-2">
                <span className="flex h-1.5 w-1.5 rounded-full bg-foreground/50" />
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Combo</span>
                <span className={cn(
                  "font-mono text-xs font-medium tabular-nums",
                  combo >= 5 && "text-primary"
                )}>{combo}x</span>
              </div>

              <Separator orientation="vertical" className="h-4" />

              <div className="flex items-center gap-2">
                <span className="flex h-1.5 w-1.5 rounded-full bg-foreground/25" />
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Saved</span>
                <span className="font-mono text-xs font-medium tabular-nums">{savedNodes}</span>
              </div>
            </div>

            {/* Center: Timer */}
            <div className="flex items-center gap-3">
              <span className={cn(
                "font-mono text-sm font-bold tabular-nums",
                timeSeconds <= 10 && "text-destructive"
              )}>
                {timeSeconds}s
              </span>
              <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-200",
                    timePercent > 30 ? "bg-foreground/40" : "bg-destructive"
                  )}
                  style={{ width: `${timePercent}%` }}
                />
              </div>
            </div>

            {/* Right: Lives & Exit */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Lives</span>
                <div className="flex gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors",
                        i < lives ? "bg-destructive" : "bg-muted"
                      )}
                    />
                  ))}
                </div>
              </div>

              <Separator orientation="vertical" className="h-4" />

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowGameOver(true)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Subtle instruction text */}
          <div className="h-6 flex items-center justify-center border-t border-border/50 bg-muted/30">
            <span className="text-[10px] text-muted-foreground tracking-wide">
              Click highlighted nodes to save them · Speed increases over time
            </span>
          </div>
        </div>

        {/* Node cards */}
        <div className="relative">
          {children}
          <NodeEmergencyOverlays emergencies={emergencies} onNodeClick={handleNodeClick} />
        </div>

        {/* Click effects - more visible */}
        {clickEffects.map((effect) => (
          <div
            key={effect.id}
            className="fixed pointer-events-none z-50"
            style={{
              left: effect.x,
              top: effect.y,
              transform: "translateX(-50%)",
              animation: "floatUp 0.8s ease-out forwards",
            }}
          >
            <span className="text-sm font-bold text-primary drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              +{effect.points}
            </span>
          </div>
        ))}

        {/* Game Over Modal */}
        {showGameOver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-sm mx-4 border bg-background rounded-lg shadow-lg overflow-hidden">
              {/* Header */}
              <div className="px-8 py-6 border-b bg-muted/30">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-center">
                  {lives > 0 ? "Time's Up" : "Game Over"}
                </h2>
              </div>

              {/* Stats */}
              <div className="px-8 py-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-mono font-bold tabular-nums">{score.toLocaleString()}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-mono font-bold tabular-nums">{maxCombo}x</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">Max Combo</div>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-center gap-12 text-center">
                  <div>
                    <div className="text-xl font-mono font-semibold tabular-nums">{savedNodes}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Saved</div>
                  </div>
                  <div>
                    <div className="text-xl font-mono font-semibold tabular-nums text-destructive">{lostNodes}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Lost</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="px-8 py-5 border-t bg-muted/30 flex gap-3">
                <Button variant="outline" onClick={onGameEnd} className="flex-1 h-10 text-xs uppercase tracking-wider">
                  Exit
                </Button>
                <Button
                  onClick={() => {
                    setShowGameOver(false);
                    setScore(0);
                    setLives(3);
                    setGameTime(GAME_DURATION);
                    setCombo(0);
                    setMaxCombo(0);
                    setSavedNodes(0);
                    setLostNodes(0);
                    setEmergencies([]);
                    gameStartRef.current = Date.now();
                  }}
                  className="flex-1 h-10 text-xs uppercase tracking-wider"
                >
                  Play Again
                </Button>
              </div>
            </div>
          </div>
        )}

        <style jsx global>{`
          @keyframes floatUp {
            0% { opacity: 1; transform: translate(-50%, -100%); }
            100% { opacity: 0; transform: translate(-50%, -150%); }
          }
        `}</style>
      </div>
    </GameContext.Provider>
  );
};

// Simple, clean emergency overlay with icons
const NodeEmergencyOverlays = ({
  emergencies,
  onNodeClick,
}: {
  emergencies: NodeEmergency[];
  onNodeClick: (nodeId: string, event: React.MouseEvent) => void;
}) => {
  const [positions, setPositions] = useState<Map<string, DOMRect>>(new Map());

  useEffect(() => {
    const update = () => {
      const map = new Map<string, DOMRect>();
      emergencies.forEach((e) => {
        const el = document.querySelector(`[data-node-id="${e.nodeId}"]`);
        if (el) map.set(e.nodeId, el.getBoundingClientRect());
      });
      setPositions(map);
    };

    update();
    const interval = setInterval(update, 50);
    window.addEventListener("scroll", update);
    window.addEventListener("resize", update);

    return () => {
      clearInterval(interval);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [emergencies]);

  return (
    <>
      {emergencies.map((emergency) => {
        const pos = positions.get(emergency.nodeId);
        if (!pos) return null;

        const config = EMERGENCY_CONFIG[emergency.type];
        const Icon = config.icon;
        const now = Date.now();
        const remaining = emergency.duration - (now - emergency.startTime);
        const progress = (remaining / emergency.duration) * 100;

        return (
          <div
            key={`${emergency.nodeId}-${emergency.startTime}`}
            className="fixed z-20 cursor-pointer transition-transform active:scale-95"
            style={{ left: pos.left, top: pos.top, width: pos.width, height: pos.height }}
            onClick={(e) => onNodeClick(emergency.nodeId, e)}
          >
            {/* Pulsing border overlay */}
            <div 
              className="absolute inset-0 rounded-lg border-2 border-destructive"
              style={{ animation: "pulse-border 0.5s ease-in-out infinite" }}
            />
            
            {/* Dark overlay with icon and label */}
            <div className="absolute inset-0 rounded-lg bg-destructive/85 flex flex-col items-center justify-center gap-1">
              <Icon className="h-5 w-5 text-white/90" />
              <span className="text-[8px] font-bold uppercase tracking-wider text-white/80">
                {config.label}
              </span>
            </div>

            {/* Timer bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30 rounded-b-lg overflow-hidden">
              <div
                className="h-full bg-white/80 transition-all duration-75 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
      })}

      <style jsx global>{`
        @keyframes pulse-border {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  );
};

export default NodeGameWrapper;

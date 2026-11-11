import { useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { StartScreen } from "./components/StartScreen";
import type { Session } from "./components/StartScreen";

const SESSION_KEY = "pot-session";

/** Read a saved session (survives a tab refresh; cleared on Leave). */
function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/**
 * Phase 0 app: two screens, no router.
 *  - Start: create / join / browse games (REST only).
 *  - Game: live Sync view over one WebSocket.
 */
export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession);

  const enter = (next: Session) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  };

  const leave = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2b0066] via-[#3a0a73] to-[#15013d] text-white">
      {session ? (
        <GameScreen session={session} onLeave={leave} />
      ) : (
        <StartScreen onEnter={enter} />
      )}
    </div>
  );
}

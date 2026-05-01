import React, { useState, useEffect, useRef } from "react";
import {
  Lock, User, Skull, Users, MessageSquare, Send,
  Eye, ChevronRight, Check, Loader2,
  Play, RotateCcw, Vote, Shield, Radio,
  AlertCircle, ArrowLeft, LogOut, Crosshair,
  Activity, Delete, Fingerprint, UserCheck
} from "lucide-react";

// ===================== CONSTANTS =====================
const PLAYER_PIN = "1004";
const ADMIN_PIN = "4001";
const TOTAL_PLAYERS = 6;
const KILLER_COUNT = 2;
const POLL_MS = 1200;

const K = {
  state: "dn_state",
  players: "dn_players",
  roles: "dn_roles",
  chat: "dn_chat",
  votes: "dn_votes",
};
const M = {
  id: "dn_my_id",
  auth: "dn_my_auth",
  name: "dn_my_name",
};

// ===================== ROUND DATA =====================
const ROUNDS = [
  null,
  {
    code: "R01 // INFILTRATION",
    title: "접속 확인",
    label: "ROUND 01",
    text: [
      "당신은 익명의 초대장을 받았다.",
      "「24시간. 5개의 미션. 상금 10억.」",
      "그러나 마지막 줄이 있었다 —",
      "「당신들 중 2명은 우리 측 사람이다.」",
    ],
    instruction: "역할이 부여되었습니다. 자신의 신분 카드를 확인하세요.",
    duration: "준비 단계",
  },
  {
    code: "R02 // FIRST_BREACH",
    title: "첫 번째 신호",
    label: "ROUND 02",
    text: [
      "관리자 콘솔에서 침입 흔적이 감지되었다.",
      "누군가 — 이 안의 누군가가 — 외부로 데이터를 빼돌리려 했다.",
      "추적은 차단되었다. 신호의 주인은 알 수 없다.",
    ],
    instruction: "5분간 자유 토론. 의심되는 자를 추궁하라.",
    duration: "5 분",
  },
  {
    code: "R03 // FRACTURE",
    title: "균열",
    label: "ROUND 03",
    text: [
      "두 번째 미션 — 누군가가 의도적으로 실패시켰다.",
      "콘솔 로그에 짧은 외부 통신 흔적이 남았다.",
      "잠입자는 둘. 그들은 서로 신호를 주고받는다.",
    ],
    instruction: "5분 더. 더 깊이 파고들어라.",
    duration: "5 분",
  },
  {
    code: "R04 // ENDGAME",
    title: "마지막 단서",
    label: "ROUND 04",
    text: [
      "마지막 정보가 도착했다.",
      "잠입자들에게는 시간이 없다.",
      "지금까지의 모든 발언, 모든 모순을 떠올려라.",
      "토론은 마지막이다. 다음은 — 투표다.",
    ],
    instruction: "마지막 토론. 지목할 자를 결정하라.",
    duration: "3 분",
  },
];

const TOTAL_ROUNDS = 4;

// ===================== STORAGE HELPERS =====================
async function getKey(key, shared = true) {
  try {
    const r = await window.storage.get(key, shared);
    if (!r) return null;
    try { return JSON.parse(r.value); } catch { return r.value; }
  } catch { return null; }
}
async function setKey(key, value, shared = true) {
  try {
    const v = typeof value === "string" ? value : JSON.stringify(value);
    await window.storage.set(key, v, shared);
    return true;
  } catch { return false; }
}
async function txKey(key, updater, shared = true) {
  if (window.storage.transaction) {
    return window.storage.transaction(key, updater, shared);
  }
  const current = await getKey(key, shared);
  const next = updater(current);
  await setKey(key, next, shared);
  return next;
}
async function delKey(key, shared = true) {
  try { await window.storage.delete(key, shared); } catch {}
}
function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function shortId(id) {
  return id ? id.slice(0, 4).toUpperCase() : "----";
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "방금";
  if (s < 60) return `${s}초 전`;
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  return `${Math.floor(s / 3600)}시간 전`;
}

// ===================== MAIN APP =====================
export default function App() {
  const [route, setRoute] = useState("loading");
  const [pinFor, setPinFor] = useState(null);
  const [myId, setMyId] = useState(null);
  const [myName, setMyName] = useState("");
  const [authedAs, setAuthedAs] = useState(null);

  const [gameState, setGameState] = useState({ phase: "lobby", round: 0 });
  const [players, setPlayers] = useState([]);
  const [roles, setRoles] = useState({});
  const [chat, setChat] = useState([]);
  const [votes, setVotes] = useState({});

  // === Initial load ===
  useEffect(() => {
    (async () => {
      let id = await getKey(M.id, false);
      if (!id) {
        id = genId();
        await setKey(M.id, id, false);
      }
      setMyId(id);

      const auth = await getKey(M.auth, false);
      const name = await getKey(M.name, false);
      if (auth) setAuthedAs(auth);
      if (name) setMyName(name);

      if (auth === "admin") setRoute("admin");
      else if (auth === "player" && name) setRoute("game");
      else setRoute("splash");
    })();
  }, []);

  // === Polling ===
  useEffect(() => {
    if (route === "loading" || route === "splash" || route === "pin") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const [s, p, r, c, v] = await Promise.all([
          getKey(K.state),
          getKey(K.players),
          getKey(K.roles),
          getKey(K.chat),
          getKey(K.votes),
        ]);
        if (cancelled) return;
        setGameState(s || { phase: "lobby", round: 0 });
        setPlayers(Array.isArray(p) ? p : []);
        setRoles(r || {});
        setChat(Array.isArray(c) ? c : []);
        setVotes(v || {});
      } catch {}
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [route]);

  // === Handlers ===
  const handlePickRole = (kind) => { setPinFor(kind); setRoute("pin"); };

  const handlePinSuccess = async (kind) => {
    setAuthedAs(kind);
    await setKey(M.auth, kind, false);
    if (kind === "admin") {
      setMyName("운영자");
      await setKey(M.name, "운영자", false);
      setRoute("admin");
    } else {
      const existing = await getKey(M.name, false);
      if (existing) {
        setMyName(existing);
        setRoute("game");
      } else {
        setRoute("name");
      }
    }
  };

  const handleNameSubmit = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, msg: "이름을 입력하세요." };

    const state = (await getKey(K.state)) || { phase: "lobby", round: 0 };
    let result = { ok: true };

    await txKey(K.players, (current) => {
      const list = Array.isArray(current) ? [...current] : [];
      const existing = list.find(p => p.id === myId);

      if (!existing) {
        if (state.phase !== "lobby") {
          result = { ok: false, msg: "게임이 이미 진행 중입니다." };
          return list;
        }
        if (list.length >= TOTAL_PLAYERS) {
          result = { ok: false, msg: "정원이 가득 찼습니다." };
          return list;
        }
        if (list.find(p => p.name === trimmed)) {
          result = { ok: false, msg: "이미 사용 중인 이름입니다." };
          return list;
        }
        list.push({ id: myId, name: trimmed, joinedAt: Date.now() });
      } else {
        if (list.some(p => p.id !== myId && p.name === trimmed)) {
          result = { ok: false, msg: "이미 사용 중인 이름입니다." };
          return list;
        }
        existing.name = trimmed;
      }

      return list;
    });

    if (!result.ok) return result;

    setMyName(trimmed);
    await setKey(M.name, trimmed, false);
    setRoute("game");
    return { ok: true };
  };

  const handleLeave = async () => {
    if (authedAs === "player" && myId) {
      const state = (await getKey(K.state)) || { phase: "lobby" };
      if (state.phase === "lobby") {
        await txKey(K.players, (current) => {
          const list = Array.isArray(current) ? current : [];
          return list.filter(p => p.id !== myId);
        });
      }
    }
    await delKey(M.auth, false);
    await delKey(M.name, false);
    setAuthedAs(null);
    setMyName("");
    setRoute("splash");
  };

  // === Admin actions ===
  const handleStartGame = async () => {
    const currentPlayers = (await getKey(K.players)) || players;
    if (currentPlayers.length !== TOTAL_PLAYERS) return;
    const shuffled = [...currentPlayers].sort(() => Math.random() - 0.5);
    const killerIds = shuffled.slice(0, KILLER_COUNT).map(p => p.id);
    const newRoles = {};
    currentPlayers.forEach(p => {
      newRoles[p.id] = killerIds.includes(p.id) ? "killer" : "citizen";
    });
    await setKey(K.roles, newRoles);
    await setKey(K.chat, []);
    await setKey(K.votes, {});
    await setKey(K.state, { phase: "playing", round: 1, startedAt: Date.now() });
  };

  const handleAdvanceRound = async () => {
    if (gameState.round < TOTAL_ROUNDS) {
      await setKey(K.state, { ...gameState, round: gameState.round + 1 });
    } else {
      await setKey(K.state, { ...gameState, phase: "voting" });
    }
  };

  const handleEndVoting = async () => {
    await setKey(K.state, { ...gameState, phase: "results" });
  };

  const handleResetGame = async () => {
    await setKey(K.state, { phase: "lobby", round: 0 });
    await setKey(K.players, []);
    await setKey(K.roles, {});
    await setKey(K.chat, []);
    await setKey(K.votes, {});
  };

  // === Chat ===
  const handleSendChat = async (text) => {
    if (!text.trim()) return;
    await txKey(K.chat, (current) => {
      const list = Array.isArray(current) ? [...current] : [];
      list.push({
        id: genId(),
        senderId: myId,
        senderName: myName,
        isAdmin: authedAs === "admin",
        text: text.trim(),
        timestamp: Date.now(),
      });
      return list.slice(-100);
    });
  };

  // === Voting ===
  const handleSubmitVote = async (targetIds) => {
    await txKey(K.votes, (current) => {
      const next = current && typeof current === "object" && !Array.isArray(current) ? { ...current } : {};
      next[myId] = targetIds;
      return next;
    });
  };

  const myRole = roles[myId];

  // === Render ===
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden" style={{
      fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif",
    }}>
      <GlobalStyles />
      <BackgroundFX />

      <div className="relative z-10 min-h-screen">
        <StorageStatus />
        {route === "loading" && <LoadingScreen />}
        {route === "splash" && <SplashScreen onPick={handlePickRole} />}
        {route === "pin" && (
          <PinScreen
            kind={pinFor}
            expected={pinFor === "admin" ? ADMIN_PIN : PLAYER_PIN}
            onSuccess={() => handlePinSuccess(pinFor)}
            onBack={() => setRoute("splash")}
          />
        )}
        {route === "name" && (
          <NameEntryScreen
            onSubmit={handleNameSubmit}
            onBack={handleLeave}
            myId={myId}
          />
        )}
        {route === "game" && authedAs === "player" && (
          <PlayerScreen
            myId={myId}
            myName={myName}
            myRole={myRole}
            gameState={gameState}
            players={players}
            chat={chat}
            roles={roles}
            votes={votes}
            onSendChat={handleSendChat}
            onSubmitVote={handleSubmitVote}
            onLeave={handleLeave}
          />
        )}
        {route === "admin" && authedAs === "admin" && (
          <AdminScreen
            myId={myId}
            myName={myName}
            gameState={gameState}
            players={players}
            roles={roles}
            chat={chat}
            votes={votes}
            onStart={handleStartGame}
            onAdvance={handleAdvanceRound}
            onEndVoting={handleEndVoting}
            onReset={handleResetGame}
            onSendChat={handleSendChat}
            onLeave={handleLeave}
          />
        )}
      </div>
    </div>
  );
}

function StorageStatus() {
  const meta = window.storage?.meta || {};
  if (meta.firebaseReady) {
    return (
      <div className="fixed bottom-2 right-2 z-50 px-2 py-1 border border-cyan-400/30 bg-black/70 text-cyan-300/80 font-mono text-[9px] tracking-wider">
        ROOM:{meta.roomId}
      </div>
    );
  }
  return (
    <div className="fixed bottom-2 left-2 right-2 z-50 px-3 py-2 border border-amber-500/40 bg-black/90 text-amber-200 text-[11px] leading-snug">
      Firebase 설정 전이라 이 기기에서만 테스트됩니다. 여러 휴대폰 동기화는 <span className="font-mono">src/firebaseConfig.js</span> 설정 후 켜집니다.
    </div>
  );
}

// ===================== GLOBAL STYLES =====================
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css');
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap');

      .font-mono { font-family: 'JetBrains Mono', monospace !important; }

      @keyframes scan {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100vh); }
      }
      @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(0, 255, 200, 0.4); }
        50% { box-shadow: 0 0 30px 4px rgba(0, 255, 200, 0.15); }
      }
      @keyframes danger-glow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(255, 40, 85, 0.4); }
        50% { box-shadow: 0 0 30px 4px rgba(255, 40, 85, 0.2); }
      }
      @keyframes blink {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0; }
      }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes scaleIn {
        from { opacity: 0; transform: scale(0.92); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes glitch {
        0%, 100% { transform: translate(0); filter: hue-rotate(0deg); }
        10% { transform: translate(-1px, 1px); filter: hue-rotate(20deg); }
        20% { transform: translate(1px, -1px); }
        30% { transform: translate(-1px, -1px); filter: hue-rotate(-20deg); }
        40% { transform: translate(1px, 1px); }
      }

      .anim-fade-up { animation: fadeUp 0.5s ease-out forwards; opacity: 0; }
      .anim-fade-in { animation: fadeIn 0.6s ease-out forwards; }
      .anim-scale-in { animation: scaleIn 0.4s ease-out forwards; }
      .anim-glitch { animation: glitch 0.3s ease-in-out; }
      .anim-pulse-glow { animation: pulse-glow 2.5s ease-in-out infinite; }
      .anim-danger-glow { animation: danger-glow 2s ease-in-out infinite; }
      .anim-blink { animation: blink 1s steps(2) infinite; }

      .stagger > *:nth-child(1) { animation-delay: 0.05s; }
      .stagger > *:nth-child(2) { animation-delay: 0.12s; }
      .stagger > *:nth-child(3) { animation-delay: 0.20s; }
      .stagger > *:nth-child(4) { animation-delay: 0.28s; }
      .stagger > *:nth-child(5) { animation-delay: 0.36s; }
      .stagger > *:nth-child(6) { animation-delay: 0.44s; }
      .stagger > *:nth-child(7) { animation-delay: 0.52s; }
      .stagger > *:nth-child(8) { animation-delay: 0.60s; }

      .scrollbar-thin::-webkit-scrollbar { width: 4px; }
      .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
      .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

      input[type="number"]::-webkit-inner-spin-button,
      input[type="number"]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      input { -webkit-tap-highlight-color: transparent; }
      button { -webkit-tap-highlight-color: transparent; }
    `}</style>
  );
}

// ===================== BACKGROUND FX =====================
function BackgroundFX() {
  return (
    <>
      <div className="fixed inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(rgba(0,255,200,0.5) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,200,0.5) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }} />
      <div className="fixed inset-0 pointer-events-none" style={{
        background: "radial-gradient(circle at 50% 30%, transparent 0%, rgba(0,0,0,0.6) 100%)",
      }} />
      <div className="fixed top-0 left-0 w-[60vw] h-[60vw] rounded-full pointer-events-none opacity-[0.08]" style={{
        background: "radial-gradient(circle, rgba(0,255,200,1) 0%, transparent 70%)",
        transform: "translate(-30%, -30%)",
      }} />
      <div className="fixed bottom-0 right-0 w-[60vw] h-[60vw] rounded-full pointer-events-none opacity-[0.06]" style={{
        background: "radial-gradient(circle, rgba(255,40,85,1) 0%, transparent 70%)",
        transform: "translate(30%, 30%)",
      }} />
      <div className="fixed inset-0 pointer-events-none opacity-[0.025] mix-blend-overlay" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />
    </>
  );
}

// ===================== LOADING =====================
function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
      <p className="font-mono text-xs text-cyan-400/60 tracking-[0.3em]">CONNECTING...</p>
    </div>
  );
}

// ===================== SPLASH =====================
function SplashScreen({ onPick }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="max-w-sm w-full stagger">
        <div className="text-center mb-12 anim-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-cyan-400/30 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 anim-blink" />
            <span className="font-mono text-[10px] text-cyan-400/80 tracking-[0.3em]">SECURE CHANNEL</span>
          </div>

          <h1 className="font-mono text-5xl font-extrabold tracking-tighter mb-3" style={{
            background: "linear-gradient(180deg, #ffffff 0%, #00ffd5 70%, #00ffd5 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.04em",
          }}>
            DEEP<br/>NETWORK
          </h1>

          <div className="flex items-center justify-center gap-2 my-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-cyan-500/40" />
            <Skull className="w-3 h-3 text-cyan-400/60" />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-cyan-500/40" />
          </div>

          <p className="font-mono text-xs text-cyan-300/70 tracking-[0.2em] mb-1">잠입자 색출 작전</p>
          <p className="text-white/40 text-[11px] italic">Find the moles. Save the network.</p>
        </div>

        <div className="border border-white/10 bg-white/[0.02] backdrop-blur p-5 mb-8 anim-fade-up relative">
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-400/60" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-400/60" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-400/60" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-400/60" />

          <div className="font-mono text-[10px] text-cyan-400/70 tracking-[0.25em] mb-3">// MISSION_BRIEF</div>
          <ul className="text-sm text-white/85 space-y-2 leading-relaxed">
            <li className="flex gap-2"><span className="text-cyan-400">›</span>플레이어 6명, 운영자 1명</li>
            <li className="flex gap-2"><span className="text-cyan-400">›</span>각자 자신의 단말기에서 접속</li>
            <li className="flex gap-2"><span className="text-cyan-400">›</span>시민 4명 vs 잠입자 2명</li>
            <li className="flex gap-2"><span className="text-rose-400">›</span>잠입자는 비밀 채널로 채팅 가능</li>
            <li className="flex gap-2"><span className="text-cyan-400">›</span>4라운드 토론 후 비밀 투표</li>
          </ul>
        </div>

        <button
          onClick={() => onPick("player")}
          className="w-full mb-3 group relative overflow-hidden border border-cyan-400/40 bg-gradient-to-br from-cyan-950/30 to-transparent hover:from-cyan-900/40 transition-all anim-fade-up"
        >
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 border border-cyan-400/50 flex items-center justify-center">
                <User className="w-5 h-5 text-cyan-300" />
              </div>
              <div className="text-left">
                <div className="font-mono text-[10px] text-cyan-400/70 tracking-[0.25em]">PLAYER ACCESS</div>
                <div className="text-white font-semibold">플레이어 입장</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        <button
          onClick={() => onPick("admin")}
          className="w-full group relative overflow-hidden border border-amber-500/40 bg-gradient-to-br from-amber-950/30 to-transparent hover:from-amber-900/40 transition-all anim-fade-up"
        >
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 border border-amber-500/50 flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-300" />
              </div>
              <div className="text-left">
                <div className="font-mono text-[10px] text-amber-400/70 tracking-[0.25em]">ADMIN ACCESS</div>
                <div className="text-white font-semibold">운영자 입장</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        <p className="text-center text-white/30 text-[10px] mt-8 font-mono tracking-wider anim-fade-up">
          v1.0 · 6 DEVICES REQUIRED
        </p>
      </div>
    </div>
  );
}

// ===================== PIN ENTRY =====================
function PinScreen({ kind, expected, onSuccess, onBack }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const isAdmin = kind === "admin";

  const labelClass = isAdmin ? "text-amber-400/70" : "text-cyan-400/70";
  const titleClass = isAdmin ? "text-amber-300" : "text-cyan-300";
  const dotBorderClass = isAdmin ? "border-amber-400" : "border-cyan-400";
  const dotFillClass = isAdmin ? "bg-amber-400" : "bg-cyan-400";
  const numBtnClass = isAdmin
    ? "hover:border-amber-400/60 hover:bg-amber-400/5"
    : "hover:border-cyan-400/60 hover:bg-cyan-400/5";

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === expected) {
        setTimeout(() => onSuccess(), 250);
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => { setPin(""); setShake(false); }, 600);
      }
    } else {
      setError(false);
    }
  }, [pin, expected, onSuccess]);

  const press = (n) => {
    if (pin.length < 4) setPin(pin + n);
  };
  const back = () => setPin(pin.slice(0, -1));

  return (
    <div className="min-h-screen flex flex-col px-6 py-8">
      <button onClick={onBack} className="self-start flex items-center gap-2 text-white/50 hover:text-white text-sm mb-8">
        <ArrowLeft className="w-4 h-4" />
        <span className="font-mono text-xs tracking-wider">BACK</span>
      </button>

      <div className="flex-1 flex flex-col items-center justify-center max-w-xs w-full mx-auto">
        <div className={`mb-2 font-mono text-[10px] tracking-[0.3em] ${labelClass}`}>
          {isAdmin ? "ADMIN AUTHENTICATION" : "PLAYER AUTHENTICATION"}
        </div>
        <div className={`${titleClass} text-lg font-semibold mb-1`}>
          {isAdmin ? "운영자 인증" : "플레이어 인증"}
        </div>
        <div className="text-white/40 text-xs mb-10">4자리 보안 코드를 입력하세요</div>

        <div className={`flex gap-4 mb-12 ${shake ? "anim-glitch" : ""}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-12 h-14 border-b-2 flex items-end justify-center pb-2 transition-all ${
                error
                  ? "border-rose-500"
                  : pin.length > i
                  ? dotBorderClass
                  : "border-white/20"
              }`}
            >
              {pin.length > i ? (
                <div className={`w-3 h-3 rounded-full ${error ? "bg-rose-500" : dotFillClass}`} />
              ) : (
                <div className="w-1 h-1 rounded-full bg-white/20" />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="text-rose-400 text-xs font-mono tracking-wider mb-6 anim-fade-in">
            ⚠ ACCESS DENIED · 잘못된 코드
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => press(n)}
              className={`aspect-square border border-white/10 ${numBtnClass} transition-all text-2xl font-mono font-light text-white/90 active:scale-95`}
            >
              {n}
            </button>
          ))}
          <div />
          <button
            onClick={() => press(0)}
            className={`aspect-square border border-white/10 ${numBtnClass} transition-all text-2xl font-mono font-light text-white/90 active:scale-95`}
          >
            0
          </button>
          <button
            onClick={back}
            className="aspect-square border border-white/10 hover:border-rose-400/60 hover:bg-rose-400/5 transition-all flex items-center justify-center text-white/70 active:scale-95"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-8 font-mono text-[10px] text-white/30 text-center">
          {isAdmin ? "// ADMIN_KEY: 4-digit code" : "// PLAYER_KEY: 4-digit code"}
        </div>
      </div>
    </div>
  );
}

// ===================== NAME ENTRY =====================
function NameEntryScreen({ onSubmit, onBack }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const r = await onSubmit(name);
    if (!r.ok) setErr(r.msg);
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-8">
      <button onClick={onBack} className="self-start flex items-center gap-2 text-white/50 hover:text-white text-sm mb-8">
        <ArrowLeft className="w-4 h-4" />
        <span className="font-mono text-xs tracking-wider">EXIT</span>
      </button>

      <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto">
        <div className="font-mono text-[10px] text-cyan-400/70 tracking-[0.3em] mb-2">// IDENTITY_REGISTRATION</div>
        <h2 className="text-2xl font-bold text-white mb-2">신원 등록</h2>
        <p className="text-white/50 text-sm mb-10">다른 플레이어들에게 표시될 이름을 입력하세요.</p>

        <div className="relative mb-2">
          <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400/60" />
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="이름 또는 닉네임"
            maxLength={12}
            autoFocus
            className="w-full bg-white/[0.03] border border-white/15 focus:border-cyan-400/60 text-white pl-12 pr-4 py-4 outline-none transition-colors text-lg"
          />
        </div>

        {err && <p className="text-rose-400 text-xs mb-4 font-mono">⚠ {err}</p>}
        {!err && <p className="text-white/30 text-xs mb-4 font-mono">// MAX 12 chars</p>}

        <button
          onClick={submit}
          disabled={!name.trim() || busy}
          className={`w-full py-4 mt-4 transition-all font-medium ${
            name.trim() && !busy
              ? "bg-cyan-400 text-black hover:bg-cyan-300"
              : "bg-white/5 text-white/30 cursor-not-allowed"
          }`}
        >
          {busy ? "접속 중..." : "네트워크 진입 →"}
        </button>
      </div>
    </div>
  );
}

// ===================== PLAYER SCREEN =====================
function PlayerScreen({ myId, myName, myRole, gameState, players, chat, roles, votes, onSendChat, onSubmitVote, onLeave }) {
  const phase = gameState?.phase || "lobby";

  return (
    <div className="min-h-screen flex flex-col">
      <PlayerHeader myName={myName} myRole={myRole} phase={phase} onLeave={onLeave} />

      {phase === "lobby" && <PlayerLobby players={players} myId={myId} />}
      {phase === "playing" && (
        <PlayerGame
          round={gameState.round}
          gameStartedAt={gameState.startedAt}
          myId={myId}
          myName={myName}
          myRole={myRole}
          players={players}
          chat={chat}
          onSendChat={onSendChat}
        />
      )}
      {phase === "voting" && (
        <PlayerVoting
          myId={myId}
          myName={myName}
          myRole={myRole}
          players={players}
          chat={chat}
          votes={votes}
          onSendChat={onSendChat}
          onSubmitVote={onSubmitVote}
        />
      )}
      {phase === "results" && (
        <ResultsView myId={myId} players={players} roles={roles} votes={votes} isAdmin={false} />
      )}
    </div>
  );
}

function PlayerHeader({ myName, myRole, phase, onLeave }) {
  const isKiller = myRole === "killer";
  const showRole = phase !== "lobby" && myRole;

  return (
    <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between bg-black/40 backdrop-blur sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className={`w-2 h-2 rounded-full ${isKiller && showRole ? "bg-rose-400" : "bg-cyan-400"} anim-blink`} />
        </div>
        <div>
          <div className="font-mono text-[10px] text-white/40 tracking-wider">YOU</div>
          <div className="text-white text-sm font-semibold">{myName}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {showRole && (
          <div className={`px-2.5 py-1 border text-[10px] font-mono font-bold tracking-[0.2em] ${
            isKiller ? "border-rose-500/60 text-rose-300 bg-rose-500/10" : "border-cyan-400/60 text-cyan-300 bg-cyan-400/10"
          }`}>
            {isKiller ? "INFILTRATOR" : "CITIZEN"}
          </div>
        )}
        <button onClick={onLeave} className="text-white/40 hover:text-white/80 transition">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

function PlayerLobby({ players, myId }) {
  const remaining = TOTAL_PLAYERS - players.length;
  return (
    <div className="flex-1 px-5 py-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8 anim-fade-up">
          <div className="font-mono text-[10px] text-cyan-400/70 tracking-[0.3em] mb-2">// AWAITING_OPERATIVES</div>
          <h2 className="text-2xl font-bold text-white mb-2">접속 대기실</h2>
          <p className="text-white/50 text-sm">
            {remaining > 0
              ? `${remaining}명이 더 접속하면 운영자가 시작합니다`
              : "모든 인원 접속 완료. 운영자의 시작을 기다리는 중..."}
          </p>
        </div>

        <div className="border border-white/10 bg-white/[0.02] overflow-hidden mb-6 anim-fade-up">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <span className="font-mono text-[10px] text-white/50 tracking-[0.2em]">CONNECTED ({players.length}/{TOTAL_PLAYERS})</span>
            <Activity className="w-3 h-3 text-cyan-400 anim-blink" />
          </div>
          <div className="divide-y divide-white/5 stagger">
            {players.map((p, i) => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between anim-fade-up">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-mono text-xs">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">{p.name}</div>
                    <div className="font-mono text-[10px] text-white/30">ID:{shortId(p.id)} · {timeAgo(p.joinedAt)}</div>
                  </div>
                </div>
                {p.id === myId && (
                  <span className="font-mono text-[10px] text-cyan-400 tracking-wider">YOU</span>
                )}
              </div>
            ))}
            {Array.from({ length: Math.max(0, TOTAL_PLAYERS - players.length) }).map((_, i) => (
              <div key={`e${i}`} className="px-4 py-3 flex items-center gap-3 opacity-30">
                <div className="w-8 h-8 rounded-full border border-dashed border-white/20" />
                <div className="font-mono text-xs text-white/30">awaiting connection...</div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-white/30 font-mono text-[10px] tracking-wider">
          DEEP_NETWORK :: STANDBY
        </div>
      </div>
    </div>
  );
}

function PlayerGame({ round, gameStartedAt, myId, myName, myRole, players, chat, onSendChat }) {
  const r = ROUNDS[round];
  const isKiller = myRole === "killer";
  const [showRoleReveal, setShowRoleReveal] = useState(false);
  const checkedRef = useRef(null);

  useEffect(() => {
    if (round !== 1 || !gameStartedAt) return;
    if (checkedRef.current === gameStartedAt) return;
    checkedRef.current = gameStartedAt;

    (async () => {
      const lastSeen = await getKey("dn_last_reveal", false);
      if (lastSeen !== gameStartedAt) {
        setShowRoleReveal(true);
        await setKey("dn_last_reveal", gameStartedAt, false);
      }
    })();
  }, [round, gameStartedAt]);

  if (showRoleReveal) {
    return <RoleRevealOverlay isKiller={isKiller} onClose={() => setShowRoleReveal(false)} myName={myName} />;
  }

  if (!r) return null;

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 py-6 max-w-md w-full mx-auto flex-1">
        <div className="flex items-center justify-between mb-5 anim-fade-up">
          <div className="font-mono text-[10px] text-white/50 tracking-[0.25em]">
            {r.label} · {r.duration}
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`h-1 w-6 ${
                i < round ? "bg-cyan-400" : i === round ? "bg-cyan-400 anim-blink" : "bg-white/15"
              }`} />
            ))}
          </div>
        </div>

        <div className="border border-cyan-400/20 bg-gradient-to-b from-cyan-400/[0.03] to-transparent p-6 mb-5 relative anim-scale-in">
          <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-cyan-400/60" />
          <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-cyan-400/60" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-cyan-400/60" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-cyan-400/60" />

          <div className="font-mono text-[10px] text-cyan-400/70 tracking-[0.2em] mb-3">{r.code}</div>
          <h2 className="text-3xl font-bold text-white mb-5 tracking-tight">{r.title}</h2>

          <div className="space-y-2 text-white/85 leading-relaxed text-[15px] mb-6">
            {r.text.map((line, i) => (
              <p key={i} className={line.startsWith("「") || line.includes("「") ? "italic text-cyan-200/90 pl-3 border-l-2 border-cyan-400/40" : ""}>
                {line}
              </p>
            ))}
          </div>

          <div className="flex items-start gap-2 pt-4 border-t border-white/10">
            <Crosshair className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
            <p className="text-cyan-300 text-sm font-medium">{r.instruction}</p>
          </div>
        </div>

        <details className="mb-5 anim-fade-up">
          <summary className="cursor-pointer flex items-center justify-between border border-white/10 px-4 py-3 hover:bg-white/[0.03]">
            <span className="font-mono text-xs text-white/60 tracking-wider">접속자 보기 ({players.length})</span>
            <Users className="w-4 h-4 text-white/40" />
          </summary>
          <div className="border-x border-b border-white/10 divide-y divide-white/5">
            {players.map((p) => (
              <div key={p.id} className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm text-white/80">{p.name}</span>
                <span className="font-mono text-[10px] text-white/30">{shortId(p.id)}</span>
              </div>
            ))}
          </div>
        </details>

        <div className="text-center text-white/30 font-mono text-[10px] tracking-wider">
          운영자가 다음 라운드를 진행합니다...
        </div>
      </div>

      {isKiller && (
        <KillerChatPanel
          chat={chat}
          myId={myId}
          myName={myName}
          onSend={onSendChat}
          isAdmin={false}
        />
      )}
    </div>
  );
}

function RoleRevealOverlay({ isKiller, onClose, myName }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center px-6">
      {!revealed ? (
        <div className="text-center anim-fade-in">
          <p className="font-mono text-[10px] text-cyan-400/70 tracking-[0.3em] mb-3">// ROLE_ASSIGNMENT</p>
          <h2 className="text-3xl font-bold text-white mb-2">{myName}</h2>
          <p className="text-white/50 text-sm mb-12">신원 카드가 준비되었습니다</p>

          <div className="border border-white/15 bg-white/[0.03] p-12 mb-8 relative">
            <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-cyan-400/60" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-cyan-400/60" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-cyan-400/60" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r border-cyan-400/60" />

            <Lock className="w-12 h-12 text-cyan-400/70 mx-auto mb-4" />
            <p className="font-mono text-xs text-cyan-300 tracking-[0.3em]">CLASSIFIED</p>
          </div>

          <p className="text-white/40 text-xs mb-6">⚠ 다른 사람이 화면을 볼 수 없는 곳에서 확인하세요</p>

          <button
            onClick={() => setRevealed(true)}
            className="px-12 py-4 bg-cyan-400 text-black font-semibold hover:bg-cyan-300 transition-all"
          >
            <Eye className="inline w-4 h-4 mr-2" />
            신원 확인
          </button>
        </div>
      ) : isKiller ? (
        <div className="text-center anim-scale-in max-w-sm w-full">
          <p className="font-mono text-[10px] text-rose-400 tracking-[0.3em] mb-3 anim-blink">// CLASSIFIED // RED_TEAM</p>

          <div className="border-2 border-rose-500/60 bg-gradient-to-b from-rose-950/40 to-black p-8 mb-6 relative anim-danger-glow">
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-rose-500" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-rose-500" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-rose-500" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-rose-500" />

            <Skull className="w-16 h-16 text-rose-400 mx-auto mb-4 anim-glitch" />
            <h2 className="text-3xl font-bold text-rose-300 mb-2 tracking-tight">잠입자</h2>
            <p className="font-mono text-xs text-rose-400/80 tracking-[0.25em] mb-5">YOU ARE THE INFILTRATOR</p>

            <div className="border-t border-rose-800/50 pt-4 text-left space-y-2 text-sm text-rose-100/85 leading-relaxed">
              <p>당신은 <span className="font-bold text-rose-300">딥 네트워크</span>를 무너뜨리기 위해 잠입한 자입니다.</p>
              <p>또 다른 잠입자가 한 명 더 있습니다. 곧 비밀 채팅으로 만날 수 있습니다.</p>
              <p>시민들이 당신의 정체를 눈치채지 못하게 거짓말로 속여라.</p>
            </div>
          </div>

          <div className="bg-rose-500/10 border border-rose-500/30 p-3 mb-6 text-left">
            <div className="font-mono text-[10px] text-rose-400 tracking-wider mb-1">VICTORY CONDITION</div>
            <p className="text-sm text-rose-100">투표에서 두 잠입자 중 한 명이라도 살아남으면 승리</p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-4 bg-rose-500 text-white font-semibold hover:bg-rose-400 transition"
          >
            임무 시작 →
          </button>
        </div>
      ) : (
        <div className="text-center anim-scale-in max-w-sm w-full">
          <p className="font-mono text-[10px] text-cyan-400 tracking-[0.3em] mb-3">// VERIFIED // BLUE_TEAM</p>

          <div className="border-2 border-cyan-400/60 bg-gradient-to-b from-cyan-950/30 to-black p-8 mb-6 relative anim-pulse-glow">
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />

            <UserCheck className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-cyan-300 mb-2 tracking-tight">시민</h2>
            <p className="font-mono text-xs text-cyan-400/80 tracking-[0.25em] mb-5">YOU ARE A CITIZEN</p>

            <div className="border-t border-cyan-800/50 pt-4 text-left space-y-2 text-sm text-cyan-100/85 leading-relaxed">
              <p>당신은 <span className="font-bold text-cyan-300">딥 네트워크</span>의 정식 참가자입니다.</p>
              <p>이 안의 6명 중 2명이 잠입자입니다.</p>
              <p>대화와 추리로 잠입자 둘을 모두 색출하라.</p>
            </div>
          </div>

          <div className="bg-cyan-500/10 border border-cyan-500/30 p-3 mb-6 text-left">
            <div className="font-mono text-[10px] text-cyan-400 tracking-wider mb-1">VICTORY CONDITION</div>
            <p className="text-sm text-cyan-100">투표에서 두 잠입자를 모두 정확히 지목하면 승리</p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-4 bg-cyan-400 text-black font-semibold hover:bg-cyan-300 transition"
          >
            작전 시작 →
          </button>
        </div>
      )}
    </div>
  );
}

// ===================== KILLER CHAT PANEL =====================
function KillerChatPanel({ chat, myId, myName, onSend, isAdmin }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(true);
  const scrollRef = useRef(null);
  const lastCountRef = useRef(0);

  useEffect(() => {
    if (scrollRef.current && chat.length !== lastCountRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      lastCountRef.current = chat.length;
    }
  }, [chat.length]);

  const send = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  return (
    <div className="border-t-2 border-rose-500/40 bg-gradient-to-b from-rose-950/30 to-black sticky bottom-0">
      <div
        className="px-4 py-2.5 flex items-center justify-between cursor-pointer bg-rose-950/40"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio className="w-3.5 h-3.5 text-rose-400" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-400 anim-blink" />
          </div>
          <span className="font-mono text-[11px] text-rose-300 tracking-[0.2em] font-semibold">
            ENCRYPTED // {isAdmin ? "ADMIN_VIEW" : "INFILTRATOR_CHANNEL"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-rose-400/60">{chat.length} msg</span>
          <ChevronRight className={`w-3.5 h-3.5 text-rose-400 transition-transform ${open ? "rotate-90" : ""}`} />
        </div>
      </div>

      {open && (
        <>
          <div ref={scrollRef} className="max-h-[280px] overflow-y-auto scrollbar-thin px-4 py-3 space-y-2.5">
            {chat.length === 0 ? (
              <div className="text-center py-6">
                <Skull className="w-6 h-6 text-rose-500/30 mx-auto mb-2" />
                <p className="text-rose-400/40 text-xs italic font-mono">// 채널이 비어있습니다</p>
                <p className="text-rose-400/30 text-[10px] mt-1">서로 정체를 확인하고 작전을 짜세요</p>
              </div>
            ) : (
              chat.map((m) => {
                const mine = m.senderId === myId;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] ${mine ? "order-2" : "order-1"}`}>
                      <div className={`flex items-center gap-2 mb-0.5 ${mine ? "justify-end" : ""}`}>
                        <span className={`font-mono text-[10px] ${
                          m.isAdmin ? "text-amber-400" : mine ? "text-rose-300" : "text-rose-400/70"
                        }`}>
                          {m.isAdmin && "👁 "}{m.senderName}
                        </span>
                        <span className="font-mono text-[9px] text-white/30">{timeAgo(m.timestamp)}</span>
                      </div>
                      <div className={`px-3 py-2 text-sm ${
                        m.isAdmin
                          ? "bg-amber-500/10 border border-amber-500/30 text-amber-100"
                          : mine
                          ? "bg-rose-500/15 border border-rose-500/40 text-rose-50"
                          : "bg-white/[0.04] border border-white/10 text-white/90"
                      }`}>
                        {m.text}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-rose-500/20 px-3 py-2.5 flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={isAdmin ? "운영자 메시지..." : "잠입자에게 메시지..."}
              maxLength={200}
              className="flex-1 bg-black/40 border border-white/10 focus:border-rose-400/60 px-3 py-2.5 text-sm text-white outline-none"
            />
            <button
              onClick={send}
              disabled={!text.trim()}
              className={`px-4 ${
                text.trim()
                  ? "bg-rose-500 text-white hover:bg-rose-400"
                  : "bg-white/5 text-white/30"
              } transition`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ===================== PLAYER VOTING =====================
function PlayerVoting({ myId, myName, myRole, players, chat, votes, onSendChat, onSubmitVote }) {
  const [selected, setSelected] = useState([]);
  const myVote = votes[myId];
  const submitted = !!myVote;
  const isKiller = myRole === "killer";
  const totalVoted = Object.keys(votes).length;

  const toggle = (id) => {
    if (submitted) return;
    if (id === myId) return;
    if (selected.includes(id)) {
      setSelected(selected.filter(x => x !== id));
    } else if (selected.length < 2) {
      setSelected([...selected, id]);
    }
  };

  const submit = () => {
    if (selected.length === 2) onSubmitVote(selected);
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 py-6 max-w-md w-full mx-auto flex-1">
        <div className="text-center mb-6 anim-fade-up">
          <div className="font-mono text-[10px] text-rose-400/80 tracking-[0.3em] mb-2 anim-blink">// FINAL_JUDGMENT</div>
          <h2 className="text-3xl font-bold text-white mb-2">최후의 지목</h2>
          <p className="text-white/60 text-sm">잠입자로 의심되는 2명을 선택하세요</p>
        </div>

        {!submitted ? (
          <>
            <div className="space-y-2 mb-6 stagger">
              {players.map((p) => {
                const isSelected = selected.includes(p.id);
                const isSelf = p.id === myId;
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    disabled={isSelf}
                    className={`w-full px-4 py-3.5 border transition-all text-left flex items-center gap-3 anim-fade-up ${
                      isSelf
                        ? "border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed"
                        : isSelected
                        ? "border-rose-500 bg-rose-500/10"
                        : "border-white/15 bg-white/[0.02] hover:border-white/30"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full border flex items-center justify-center ${
                      isSelected ? "border-rose-400 bg-rose-500/20" : "border-white/20"
                    }`}>
                      {isSelected ? <Crosshair className="w-4 h-4 text-rose-400" /> : <User className="w-4 h-4 text-white/50" />}
                    </div>
                    <div className="flex-1">
                      <div className={`font-medium ${isSelected ? "text-rose-200" : "text-white"}`}>{p.name}</div>
                      <div className="font-mono text-[10px] text-white/30">ID:{shortId(p.id)}</div>
                    </div>
                    {isSelf && <span className="font-mono text-[10px] text-white/30">YOU</span>}
                    {isSelected && (
                      <span className="font-mono text-[10px] text-rose-400 tracking-wider">SUSPECT</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="text-center mb-4">
              <span className="font-mono text-xs text-white/50">선택: {selected.length} / 2</span>
            </div>

            <button
              onClick={submit}
              disabled={selected.length !== 2}
              className={`w-full py-4 font-semibold transition-all ${
                selected.length === 2
                  ? "bg-rose-500 text-white hover:bg-rose-400"
                  : "bg-white/5 text-white/30 cursor-not-allowed"
              }`}
            >
              {selected.length === 2 ? "투표 제출" : `${2 - selected.length}명 더 선택`}
            </button>
          </>
        ) : (
          <div className="text-center anim-scale-in">
            <div className="border border-cyan-400/40 bg-cyan-400/5 p-8 mb-6 relative">
              <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-cyan-400" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-cyan-400" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-cyan-400" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-cyan-400" />

              <Check className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
              <p className="font-mono text-[10px] text-cyan-400 tracking-[0.3em] mb-2">VOTE_SUBMITTED</p>
              <p className="text-white text-lg font-semibold mb-3">투표 완료</p>
              <p className="text-white/60 text-sm mb-4">결과를 기다리는 중...</p>
              <p className="font-mono text-xs text-cyan-300">{totalVoted} / {TOTAL_PLAYERS} 표 집계</p>
            </div>

            <div className="text-white/40 text-xs">
              지목한 대상:
              <div className="flex justify-center gap-2 mt-2">
                {myVote.map(id => {
                  const p = players.find(x => x.id === id);
                  return (
                    <span key={id} className="px-3 py-1 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-sm">
                      {p?.name}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {isKiller && (
        <KillerChatPanel chat={chat} myId={myId} myName={myName} onSend={onSendChat} isAdmin={false} />
      )}
    </div>
  );
}

// ===================== RESULTS =====================
function ResultsView({ myId, players, roles, votes, isAdmin }) {
  const [revealed, setRevealed] = useState(false);

  const tally = {};
  players.forEach(p => tally[p.id] = 0);
  Object.values(votes).forEach((targets) => {
    if (Array.isArray(targets)) {
      targets.forEach(t => { tally[t] = (tally[t] || 0) + 1; });
    }
  });

  const sorted = players
    .map(p => ({ ...p, votes: tally[p.id] || 0, role: roles[p.id] }))
    .sort((a, b) => b.votes - a.votes);

  const eliminated = sorted.slice(0, 2);
  const killerIds = players.filter(p => roles[p.id] === "killer").map(p => p.id);
  const eliminatedKillers = eliminated.filter(p => p.role === "killer");
  const citizensWin = eliminatedKillers.length === KILLER_COUNT;

  const myRole = roles[myId];
  const iWon = isAdmin
    ? null
    : (myRole === "citizen" && citizensWin) || (myRole === "killer" && !citizensWin);

  return (
    <div className="flex-1 px-5 py-6">
      <div className="max-w-md w-full mx-auto">
        {!revealed ? (
          <div className="min-h-[70vh] flex flex-col items-center justify-center text-center anim-fade-in">
            <div className="font-mono text-[10px] text-white/50 tracking-[0.3em] mb-3 anim-blink">// CALCULATING_RESULTS</div>
            <h2 className="text-3xl font-bold text-white mb-3">진실의 시간</h2>
            <p className="text-white/60 mb-10 text-sm">모든 표가 모였습니다.</p>

            <div className="flex items-center gap-3 mb-10">
              <div className="w-2 h-2 rounded-full bg-cyan-400 anim-blink" />
              <div className="w-2 h-2 rounded-full bg-cyan-400 anim-blink" style={{animationDelay: "0.3s"}} />
              <div className="w-2 h-2 rounded-full bg-cyan-400 anim-blink" style={{animationDelay: "0.6s"}} />
            </div>

            <button
              onClick={() => setRevealed(true)}
              className="px-12 py-4 bg-white text-black font-bold hover:bg-cyan-100 transition anim-pulse-glow"
            >
              결과 공개
            </button>
          </div>
        ) : (
          <div className="anim-fade-in py-4">
            <div className={`border-2 p-6 mb-6 text-center relative ${
              citizensWin
                ? "border-cyan-400 bg-cyan-500/5"
                : "border-rose-500 bg-rose-500/5"
            }`}>
              <div className={`absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 ${citizensWin ? "border-cyan-400" : "border-rose-500"}`} />
              <div className={`absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 ${citizensWin ? "border-cyan-400" : "border-rose-500"}`} />
              <div className={`absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 ${citizensWin ? "border-cyan-400" : "border-rose-500"}`} />
              <div className={`absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 ${citizensWin ? "border-cyan-400" : "border-rose-500"}`} />

              {citizensWin ? (
                <>
                  <UserCheck className="w-14 h-14 text-cyan-400 mx-auto mb-3" />
                  <p className="font-mono text-[10px] text-cyan-400 tracking-[0.3em] mb-2">// MISSION_COMPLETE</p>
                  <h2 className="text-3xl font-bold text-cyan-300 mb-2">시민 승리</h2>
                  <p className="text-cyan-100/80 text-sm">두 잠입자를 모두 색출했다.</p>
                </>
              ) : (
                <>
                  <Skull className="w-14 h-14 text-rose-400 mx-auto mb-3 anim-glitch" />
                  <p className="font-mono text-[10px] text-rose-400 tracking-[0.3em] mb-2">// SYSTEM_COMPROMISED</p>
                  <h2 className="text-3xl font-bold text-rose-300 mb-2">잠입자 승리</h2>
                  <p className="text-rose-100/80 text-sm">
                    {eliminatedKillers.length === 0
                      ? "잠입자들이 정체를 완벽히 숨겼다."
                      : "한 명의 잠입자가 살아남았다."}
                  </p>
                </>
              )}

              {iWon !== null && (
                <div className={`mt-4 pt-4 border-t font-mono text-xs tracking-[0.3em] ${
                  iWon ? "border-cyan-400/30 text-cyan-300" : "border-rose-500/30 text-rose-300"
                }`}>
                  YOU {iWon ? "WIN" : "LOSE"}
                </div>
              )}
            </div>

            <div className="mb-6 anim-fade-up">
              <div className="font-mono text-[10px] text-white/50 tracking-[0.25em] mb-2">// INFILTRATORS_IDENTIFIED</div>
              <div className="grid grid-cols-2 gap-3">
                {killerIds.map((id) => {
                  const p = players.find(x => x.id === id);
                  const wasEliminated = eliminated.find(e => e.id === id);
                  return (
                    <div key={id} className={`p-4 border ${
                      wasEliminated ? "border-cyan-400/40 bg-cyan-400/5" : "border-rose-500/60 bg-rose-500/10 anim-danger-glow"
                    }`}>
                      <Skull className={`w-6 h-6 mb-2 ${wasEliminated ? "text-cyan-400/70" : "text-rose-400"}`} />
                      <div className="text-white font-bold mb-0.5">{p?.name}</div>
                      <div className="font-mono text-[10px] text-white/40">ID:{shortId(id)}</div>
                      <div className={`mt-2 font-mono text-[9px] tracking-wider ${
                        wasEliminated ? "text-cyan-400" : "text-rose-300"
                      }`}>
                        {wasEliminated ? "✓ 색출됨" : "✗ 도주 성공"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border border-white/10 bg-white/[0.02] mb-6">
              <div className="px-4 py-3 border-b border-white/5 font-mono text-[10px] text-white/50 tracking-[0.25em]">
                // VOTE_TALLY
              </div>
              <div className="divide-y divide-white/5">
                {sorted.map((p, idx) => {
                  const isKiller = p.role === "killer";
                  const wasEliminated = idx < 2;
                  const pct = (p.votes / (TOTAL_PLAYERS * 2)) * 100;
                  return (
                    <div key={p.id} className={`px-4 py-3 ${wasEliminated ? "bg-rose-950/20" : ""}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-white/40">#{idx + 1}</span>
                          <span className="text-white font-medium text-sm">{p.name}</span>
                          {isKiller && <Skull className="w-3 h-3 text-rose-400" />}
                          {wasEliminated && <span className="font-mono text-[9px] text-rose-300 tracking-wider">ELIMINATED</span>}
                        </div>
                        <span className="font-mono text-xs text-white/70">{p.votes}표</span>
                      </div>
                      <div className="h-1 bg-white/10 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 ${isKiller ? "bg-rose-500" : "bg-cyan-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-center text-white/40 font-mono text-[10px] tracking-wider">
              {isAdmin ? "운영자가 다음 게임을 시작할 수 있습니다" : "운영자가 다음 게임을 준비합니다"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== ADMIN SCREEN =====================
function AdminScreen({ myId, myName, gameState, players, roles, chat, votes, onStart, onAdvance, onEndVoting, onReset, onSendChat, onLeave }) {
  const [tab, setTab] = useState("dashboard");
  const phase = gameState?.phase || "lobby";
  const round = gameState?.round || 0;

  useEffect(() => {
    if (phase === "voting") setTab("voting");
    else if (phase === "results") setTab("results");
  }, [phase]);

  const killerIds = Object.keys(roles).filter(id => roles[id] === "killer");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-amber-500/30 px-4 py-3 flex items-center justify-between bg-black/40 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Shield className="w-4 h-4 text-amber-400" />
          <div>
            <div className="font-mono text-[10px] text-amber-400/70 tracking-wider">ADMIN CONSOLE</div>
            <div className="text-amber-300 text-sm font-bold">운영자 / God-mode</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-white/50 tracking-wider px-2 py-1 border border-white/10">
            {phase === "lobby" ? "LOBBY" :
             phase === "playing" ? `R0${round}` :
             phase === "voting" ? "VOTING" : "RESULTS"}
          </span>
          <button onClick={onLeave} className="text-white/40 hover:text-white/80">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <nav className="border-b border-white/10 flex bg-black/30">
        {[
          { id: "dashboard", label: "대시보드", icon: Activity },
          { id: "killers", label: "잠입자", icon: Skull, badge: killerIds.length || null },
          { id: "chat", label: "채팅방", icon: MessageSquare, badge: chat.length || null },
          { id: "control", label: "진행", icon: Play },
        ].map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-2 py-3 flex flex-col items-center gap-1 border-b-2 transition-all ${
                active
                  ? "border-amber-400 bg-amber-400/5 text-amber-300"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {t.badge && (
                  <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-1 bg-rose-500 text-white text-[9px] flex items-center justify-center rounded-full font-mono font-bold">
                    {t.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium tracking-wider">{t.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto">
        {tab === "dashboard" && (
          <AdminDashboard
            phase={phase}
            round={round}
            players={players}
            roles={roles}
            votes={votes}
          />
        )}
        {tab === "killers" && (
          <AdminKillers players={players} roles={roles} phase={phase} />
        )}
        {tab === "chat" && (
          <AdminChat chat={chat} myId={myId} myName={myName} onSend={onSendChat} phase={phase} />
        )}
        {tab === "control" && (
          <AdminControl
            phase={phase}
            round={round}
            players={players}
            votes={votes}
            onStart={onStart}
            onAdvance={onAdvance}
            onEndVoting={onEndVoting}
            onReset={onReset}
          />
        )}
        {tab === "voting" && phase === "voting" && (
          <AdminVotingMonitor players={players} votes={votes} onEndVoting={onEndVoting} />
        )}
        {tab === "results" && phase === "results" && (
          <ResultsView myId={myId} players={players} roles={roles} votes={votes} isAdmin={true} />
        )}
      </div>
    </div>
  );
}

function AdminDashboard({ phase, round, players, roles, votes }) {
  const killerCount = Object.values(roles).filter(r => r === "killer").length;
  const voteCount = Object.keys(votes).length;

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="grid grid-cols-2 gap-3 stagger">
        <StatCard label="단계" value={
          phase === "lobby" ? "대기" : phase === "playing" ? `R${round}` : phase === "voting" ? "투표" : "종료"
        } icon={Activity} />
        <StatCard label="접속자" value={`${players.length}/${TOTAL_PLAYERS}`} icon={Users} />
        <StatCard label="잠입자" value={killerCount > 0 ? `${killerCount}명 배정` : "미배정"} icon={Skull} accent={killerCount > 0 ? "rose" : "white"} />
        <StatCard label="투표" value={`${voteCount}/${TOTAL_PLAYERS}`} icon={Vote} accent={voteCount > 0 ? "amber" : "white"} />
      </div>

      <div className="border border-white/10 bg-white/[0.02] anim-fade-up">
        <div className="px-4 py-3 border-b border-white/5 font-mono text-[10px] text-white/50 tracking-[0.25em]">
          // ALL_PLAYERS
        </div>
        {players.length === 0 ? (
          <div className="px-4 py-8 text-center text-white/30 text-sm">아직 접속자가 없습니다</div>
        ) : (
          <div className="divide-y divide-white/5">
            {players.map((p, i) => {
              const role = roles[p.id];
              const voted = votes[p.id];
              return (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center font-mono text-[10px] text-white/60">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium flex items-center gap-2">
                        {p.name}
                        {role === "killer" && (
                          <span className="px-1.5 py-0.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono text-[9px] tracking-wider">
                            INFILTRATOR
                          </span>
                        )}
                        {role === "citizen" && (
                          <span className="px-1.5 py-0.5 bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 font-mono text-[9px] tracking-wider">
                            CITIZEN
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-white/30">ID:{shortId(p.id)}</div>
                    </div>
                  </div>
                  {voted && (
                    <span className="font-mono text-[10px] text-emerald-400 tracking-wider">VOTED ✓</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent = "amber" }) {
  const colors = {
    amber: "border-amber-500/30 text-amber-300",
    cyan: "border-cyan-400/30 text-cyan-300",
    rose: "border-rose-500/30 text-rose-300",
    white: "border-white/10 text-white/80",
  };
  return (
    <div className={`border ${colors[accent]} bg-white/[0.02] p-3 anim-fade-up`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[10px] text-white/50 tracking-[0.2em]">{label}</span>
        <Icon className={`w-3.5 h-3.5 ${colors[accent].split(" ")[1]}`} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function AdminKillers({ players, roles, phase }) {
  const killers = players.filter(p => roles[p.id] === "killer");

  return (
    <div className="px-5 py-5">
      <div className="text-center mb-5 anim-fade-up">
        <div className="font-mono text-[10px] text-rose-400/80 tracking-[0.3em] mb-2">// CLASSIFIED_INTEL</div>
        <h2 className="text-xl font-bold text-rose-300 mb-1">잠입자 정보</h2>
        <p className="text-white/40 text-xs">운영자만 볼 수 있는 기밀 정보입니다</p>
      </div>

      {phase === "lobby" || killers.length === 0 ? (
        <div className="border border-white/10 bg-white/[0.02] py-12 text-center">
          <Lock className="w-8 h-8 text-white/30 mx-auto mb-3" />
          <p className="text-white/50 text-sm mb-1">잠입자 미배정</p>
          <p className="text-white/30 text-xs">게임 시작 시 자동으로 2명이 무작위 선정됩니다</p>
        </div>
      ) : (
        <div className="space-y-3 stagger">
          {killers.map((p, i) => (
            <div key={p.id} className="border-2 border-rose-500/50 bg-gradient-to-r from-rose-950/30 to-transparent p-4 anim-fade-up relative">
              <div className="absolute top-1 right-1 font-mono text-[9px] text-rose-400/70 tracking-wider">CONFIDENTIAL</div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 border-2 border-rose-500 bg-rose-500/10 flex items-center justify-center anim-danger-glow">
                  <Skull className="w-6 h-6 text-rose-400" />
                </div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] text-rose-400 tracking-[0.2em] mb-0.5">INFILTRATOR_{i + 1}</div>
                  <div className="text-2xl font-bold text-white">{p.name}</div>
                  <div className="font-mono text-[10px] text-white/40">ID:{shortId(p.id)}</div>
                </div>
              </div>
            </div>
          ))}

          <div className="mt-6 px-4 py-3 border border-amber-500/30 bg-amber-500/5">
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-mono text-[10px] text-amber-400 tracking-wider mb-1">RULES_REMINDER</p>
                <p className="text-amber-100/80 text-xs leading-relaxed">
                  이 정보는 운영자에게만 표시됩니다. 잠입자들끼리는 비밀 채널에서 자유롭게 협력할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminChat({ chat, myId, myName, onSend, phase }) {
  if (phase === "lobby") {
    return (
      <div className="px-5 py-12 text-center">
        <Lock className="w-8 h-8 text-white/30 mx-auto mb-3" />
        <p className="text-white/50 text-sm">채팅 비활성</p>
        <p className="text-white/30 text-xs">게임 시작 후 잠입자 채팅이 활성화됩니다</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="px-5 py-3 bg-rose-950/20 border-b border-rose-500/30">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-mono text-[10px] text-amber-400 tracking-[0.25em]">ADMIN_VIEW // 잠입자 채팅 모니터링</span>
        </div>
      </div>
      <KillerChatPanel chat={chat} myId={myId} myName={myName} onSend={onSend} isAdmin={true} />
    </div>
  );
}

function AdminControl({ phase, round, players, votes, onStart, onAdvance, onEndVoting, onReset }) {
  const canStart = phase === "lobby" && players.length === TOTAL_PLAYERS;
  const allVoted = phase === "voting" && Object.keys(votes).length === TOTAL_PLAYERS;
  const voteCount = Object.keys(votes).length;

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="anim-fade-up">
        <div className="font-mono text-[10px] text-amber-400/70 tracking-[0.3em] mb-2">// GAME_CONTROL</div>
        <h2 className="text-lg font-bold text-white mb-4">게임 진행</h2>
      </div>

      <div className="border border-amber-500/30 bg-amber-500/5 p-4 anim-fade-up">
        <div className="font-mono text-[10px] text-amber-400 tracking-[0.25em] mb-2">CURRENT_PHASE</div>
        <div className="text-2xl font-bold text-white mb-1">
          {phase === "lobby" && "대기실"}
          {phase === "playing" && `라운드 ${round} / ${TOTAL_ROUNDS}`}
          {phase === "voting" && "투표 진행 중"}
          {phase === "results" && "게임 종료"}
        </div>
        <p className="text-white/60 text-sm">
          {phase === "lobby" && `${players.length}/${TOTAL_PLAYERS}명 접속`}
          {phase === "playing" && ROUNDS[round]?.title}
          {phase === "voting" && `${voteCount}/${TOTAL_PLAYERS}명 투표 완료`}
          {phase === "results" && "결과 발표 완료"}
        </p>
      </div>

      <div className="space-y-3 stagger">
        {phase === "lobby" && (
          <>
            <button
              onClick={onStart}
              disabled={!canStart}
              className={`w-full py-5 font-bold text-lg flex items-center justify-center gap-3 transition-all anim-fade-up ${
                canStart
                  ? "bg-cyan-400 text-black hover:bg-cyan-300 anim-pulse-glow"
                  : "bg-white/5 text-white/30 cursor-not-allowed"
              }`}
            >
              <Play className="w-5 h-5" />
              {canStart ? "게임 시작 (잠입자 무작위 배정)" : `${TOTAL_PLAYERS - players.length}명 더 필요`}
            </button>
            <p className="text-center text-white/40 text-xs anim-fade-up">
              시작 시 6명 중 2명이 자동으로 잠입자로 배정됩니다
            </p>
          </>
        )}

        {phase === "playing" && (
          <>
            <button
              onClick={onAdvance}
              className="w-full py-5 bg-amber-400 text-black font-bold text-lg flex items-center justify-center gap-3 hover:bg-amber-300 transition anim-pulse-glow anim-fade-up"
            >
              {round < TOTAL_ROUNDS ? (
                <>
                  <ChevronRight className="w-5 h-5" />
                  다음 라운드 진행 (R{round + 1})
                </>
              ) : (
                <>
                  <Vote className="w-5 h-5" />
                  투표 단계 시작
                </>
              )}
            </button>
            <p className="text-center text-white/40 text-xs anim-fade-up">
              모든 플레이어 화면이 자동으로 다음 단계로 전환됩니다
            </p>
          </>
        )}

        {phase === "voting" && (
          <>
            <button
              onClick={onEndVoting}
              className={`w-full py-5 font-bold text-lg flex items-center justify-center gap-3 transition anim-fade-up ${
                allVoted
                  ? "bg-rose-500 text-white hover:bg-rose-400 anim-danger-glow"
                  : "bg-amber-400/80 text-black hover:bg-amber-400"
              }`}
            >
              <Crosshair className="w-5 h-5" />
              {allVoted ? "결과 발표" : `결과 발표 (${voteCount}/${TOTAL_PLAYERS}만 투표)`}
            </button>
            <p className="text-center text-white/40 text-xs anim-fade-up">
              {allVoted ? "모든 표가 집계되었습니다" : "아직 투표하지 않은 플레이어가 있습니다"}
            </p>
          </>
        )}

        {phase === "results" && (
          <button
            onClick={() => { if (confirm("게임을 초기화합니다. 계속하시겠습니까?")) onReset(); }}
            className="w-full py-5 bg-cyan-400 text-black font-bold text-lg flex items-center justify-center gap-3 hover:bg-cyan-300 transition anim-fade-up"
          >
            <RotateCcw className="w-5 h-5" />
            새 게임 시작 (전체 초기화)
          </button>
        )}

        {phase !== "results" && phase !== "lobby" && (
          <button
            onClick={() => { if (confirm("정말 초기화하시겠습니까? 진행 중인 게임이 모두 사라집니다.")) onReset(); }}
            className="w-full py-3 border border-white/20 text-white/60 hover:bg-white/5 hover:text-white transition text-sm anim-fade-up"
          >
            <RotateCcw className="inline w-4 h-4 mr-2" />
            게임 강제 초기화
          </button>
        )}
      </div>
    </div>
  );
}

function AdminVotingMonitor({ players, votes, onEndVoting }) {
  const voted = Object.keys(votes);
  const allVoted = voted.length === TOTAL_PLAYERS;

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="anim-fade-up">
        <div className="font-mono text-[10px] text-rose-400/70 tracking-[0.3em] mb-2">// VOTING_IN_PROGRESS</div>
        <h2 className="text-xl font-bold text-white mb-1">투표 진행 상황</h2>
        <p className="text-white/50 text-sm">{voted.length}/{TOTAL_PLAYERS} 명 투표 완료</p>
      </div>

      <div className="border border-white/10 bg-white/[0.02] divide-y divide-white/5 stagger">
        {players.map(p => {
          const did = !!votes[p.id];
          return (
            <div key={p.id} className="px-4 py-3 flex items-center justify-between anim-fade-up">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${did ? "bg-emerald-400" : "bg-white/20"}`} />
                <span className="text-white text-sm">{p.name}</span>
              </div>
              <span className={`font-mono text-[10px] tracking-wider ${
                did ? "text-emerald-400" : "text-white/30"
              }`}>
                {did ? "VOTED ✓" : "WAITING..."}
              </span>
            </div>
          );
        })}
      </div>

      <button
        onClick={onEndVoting}
        className={`w-full py-4 font-bold text-lg flex items-center justify-center gap-3 transition anim-fade-up ${
          allVoted
            ? "bg-rose-500 text-white hover:bg-rose-400 anim-danger-glow"
            : "bg-amber-400 text-black hover:bg-amber-300"
        }`}
      >
        <Crosshair className="w-5 h-5" />
        {allVoted ? "결과 발표" : "강제 종료 후 결과 발표"}
      </button>
    </div>
  );
}

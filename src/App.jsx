import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Crosshair,
  Delete,
  Eye,
  Fingerprint,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Minus,
  Moon,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Send,
  Settings,
  Shield,
  Skull,
  Stethoscope,
  User,
  UserCheck,
  Users,
  Vote,
} from "lucide-react";

// ===================== CONSTANTS =====================
const PLAYER_PIN = "1004";
const ADMIN_PIN = "4001";
const TEST_PIN = "0000";
const POLL_MS = 1200;
const TOTAL_ROUNDS = 4;

const K = {
  state: "dn_state",
  players: "dn_players",
  roles: "dn_roles",
  chat: "dn_chat",
  votes: "dn_votes",
  config: "dn_config",
};

const M = {
  id: "dn_my_id",
  auth: "dn_my_auth",
  name: "dn_my_name",
};

const ROLE_DEFS = {
  killer: {
    name: "마피아",
    code: "MAFIA",
    team: "mafia",
    icon: Skull,
    tone: "rose",
    brief: "시민들 사이에 숨어 정체를 숨기는 범인입니다.",
    mission: "토론에서 의심을 피하고, 최종 투표에서 한 명이라도 살아남으세요.",
    win: "마피아 팀이 최종 투표에서 생존하면 승리",
  },
  spy: {
    name: "스파이",
    code: "SPY",
    team: "mafia",
    icon: Eye,
    tone: "rose",
    brief: "마피아 편에 선 보조 직업입니다.",
    mission: "시민처럼 행동하며 마피아가 들키지 않도록 흐름을 흔드세요.",
    win: "마피아 팀 승리 시 함께 승리",
  },
  detective: {
    name: "경찰",
    code: "DETECTIVE",
    team: "town",
    icon: Search,
    tone: "cyan",
    brief: "의심 대상을 조사해 추리의 중심을 잡는 직업입니다.",
    mission: "발언과 투표 흐름을 보고 의심 대상을 좁히세요.",
    win: "마피아 팀을 모두 색출하면 승리",
  },
  doctor: {
    name: "의사",
    code: "DOCTOR",
    team: "town",
    icon: Stethoscope,
    tone: "emerald",
    brief: "시민 편의 생존을 돕는 보호 직업입니다.",
    mission: "누가 공격받을지 예측하고, 중요한 시민을 지키는 척도를 잡으세요.",
    win: "마피아 팀을 모두 색출하면 승리",
  },
  bodyguard: {
    name: "보디가드",
    code: "GUARD",
    team: "town",
    icon: Shield,
    tone: "amber",
    brief: "핵심 시민을 지키는 방어형 직업입니다.",
    mission: "경찰이나 의사로 보이는 사람을 보호 대상으로 생각하세요.",
    win: "마피아 팀을 모두 색출하면 승리",
  },
  shaman: {
    name: "영매",
    code: "MEDIUM",
    team: "town",
    icon: Moon,
    tone: "violet",
    brief: "탈락자의 말과 투표 기록을 해석하는 정보형 직업입니다.",
    mission: "탈락자가 남긴 단서와 모순을 정리해 시민을 설득하세요.",
    win: "마피아 팀을 모두 색출하면 승리",
  },
  citizen: {
    name: "시민",
    code: "CITIZEN",
    team: "town",
    icon: UserCheck,
    tone: "cyan",
    brief: "특수 능력은 없지만 토론과 투표의 힘을 가진 시민입니다.",
    mission: "발언의 모순을 찾고 마피아를 최종 투표로 색출하세요.",
    win: "마피아 팀을 모두 색출하면 승리",
  },
};

const SPECIAL_ROLE_IDS = ["killer", "detective", "doctor", "bodyguard", "shaman", "spy"];

const DEFAULT_CONFIG = {
  totalPlayers: 6,
  roundSeconds: 300,
  roles: {
    killer: 2,
    detective: 1,
    doctor: 1,
    bodyguard: 0,
    shaman: 0,
    spy: 0,
  },
};

const ROUNDS = [
  null,
  {
    code: "R01 // ROLE_ASSIGNMENT",
    title: "신원 확인",
    label: "ROUND 01",
    text: [
      "당신은 익명의 초대장을 받았다.",
      "같은 방에 모인 사람들 중 일부는 네트워크를 무너뜨리려 한다.",
      "마스터가 직업을 배정했다. 자신의 화면만 확인하라.",
    ],
    instruction: "역할 카드를 확인하고 토론을 준비하세요.",
  },
  {
    code: "R02 // FIRST_DISCUSSION",
    title: "첫 번째 토론",
    label: "ROUND 02",
    text: [
      "첫 번째 신호가 감지되었다.",
      "누군가 거짓말을 시작했다. 말의 순서, 방어 방식, 시선의 흔들림을 기록하라.",
      "특수 직업은 너무 빨리 정체를 드러내지 않는 것이 좋다.",
    ],
    instruction: "의심되는 사람을 압박하고, 자신의 논리를 세우세요.",
  },
  {
    code: "R03 // PRESSURE",
    title: "압박",
    label: "ROUND 03",
    text: [
      "대화 속 모순이 커지고 있다.",
      "마피아는 서로를 보호하거나 일부러 선을 긋는다.",
      "경찰과 의사의 힌트가 있다면 시민들이 알아볼 수 있게 말해야 한다.",
    ],
    instruction: "발언 기록을 비교하고 후보를 좁히세요.",
  },
  {
    code: "R04 // FINAL_CALL",
    title: "최종 판단",
    label: "ROUND 04",
    text: [
      "마지막 토론이다.",
      "지금까지의 모든 발언, 방어, 침묵이 단서다.",
      "다음 단계는 비밀 투표다.",
    ],
    instruction: "최종 투표에서 지목할 사람을 결정하세요.",
  },
];

// ===================== STORAGE HELPERS =====================
async function getKey(key, shared = true) {
  try {
    const r = await window.storage.get(key, shared);
    if (!r) return null;
    try {
      return JSON.parse(r.value);
    } catch {
      return r.value;
    }
  } catch {
    return null;
  }
}

async function setKey(key, value, shared = true) {
  try {
    const v = typeof value === "string" ? value : JSON.stringify(value);
    await window.storage.set(key, v, shared);
    return true;
  } catch {
    return false;
  }
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
  try {
    await window.storage.delete(key, shared);
  } catch {}
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function normalizeConfig(input = DEFAULT_CONFIG) {
  const base = input || DEFAULT_CONFIG;
  const totalPlayers = clamp(base.totalPlayers ?? DEFAULT_CONFIG.totalPlayers, 4, 20);
  const roundSeconds = clamp(base.roundSeconds ?? DEFAULT_CONFIG.roundSeconds, 30, 1800);
  const roles = {};
  SPECIAL_ROLE_IDS.forEach((roleId) => {
    roles[roleId] = clamp(base.roles?.[roleId] ?? DEFAULT_CONFIG.roles[roleId] ?? 0, 0, 20);
  });
  const specialTotal = SPECIAL_ROLE_IDS.reduce((sum, id) => sum + roles[id], 0);
  roles.citizen = Math.max(0, totalPlayers - specialTotal);
  return { totalPlayers, roundSeconds, roles };
}

function roleTotal(config) {
  const cfg = normalizeConfig(config);
  return Object.values(cfg.roles).reduce((sum, n) => sum + n, 0);
}

function mafiaCount(configOrRoles) {
  if (!configOrRoles) return 0;
  if (configOrRoles.roles) {
    return Object.entries(configOrRoles.roles).reduce((sum, [role, count]) => {
      return sum + (ROLE_DEFS[role]?.team === "mafia" ? count : 0);
    }, 0);
  }
  return Object.values(configOrRoles).filter((role) => ROLE_DEFS[role]?.team === "mafia").length;
}

function isConfigValid(config) {
  const cfg = normalizeConfig(config);
  const specialTotal = SPECIAL_ROLE_IDS.reduce((sum, id) => sum + cfg.roles[id], 0);
  return cfg.totalPlayers >= 4 && specialTotal <= cfg.totalPlayers && mafiaCount(cfg) > 0;
}

function buildRoleDeck(config) {
  const cfg = normalizeConfig(config);
  const deck = [];
  Object.entries(cfg.roles).forEach(([role, count]) => {
    for (let i = 0; i < count; i += 1) deck.push(role);
  });
  return deck.slice(0, cfg.totalPlayers);
}

function shuffle(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function getRoleDef(role) {
  return ROLE_DEFS[role] || ROLE_DEFS.citizen;
}

function roleToneClasses(role) {
  const tone = getRoleDef(role).tone;
  if (tone === "rose") return "border-rose-500/60 text-rose-300 bg-rose-500/10";
  if (tone === "emerald") return "border-emerald-500/60 text-emerald-300 bg-emerald-500/10";
  if (tone === "amber") return "border-amber-500/60 text-amber-300 bg-amber-500/10";
  if (tone === "violet") return "border-violet-500/60 text-violet-300 bg-violet-500/10";
  return "border-cyan-400/60 text-cyan-300 bg-cyan-400/10";
}

function roleAccent(role) {
  const team = getRoleDef(role).team;
  return team === "mafia" ? "rose" : "cyan";
}

function formatTime(seconds) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
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
  const [gameConfig, setGameConfig] = useState(normalizeConfig(DEFAULT_CONFIG));

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

  useEffect(() => {
    if (route === "loading" || route === "splash" || route === "pin" || route === "test") return;
    let cancelled = false;

    const poll = async () => {
      try {
        const [s, p, r, c, v, cfg] = await Promise.all([
          getKey(K.state),
          getKey(K.players),
          getKey(K.roles),
          getKey(K.chat),
          getKey(K.votes),
          getKey(K.config),
        ]);
        if (cancelled) return;
        setGameState(s || { phase: "lobby", round: 0 });
        setPlayers(Array.isArray(p) ? p : []);
        setRoles(r || {});
        setChat(Array.isArray(c) ? c : []);
        setVotes(v || {});
        setGameConfig(normalizeConfig(cfg || DEFAULT_CONFIG));
      } catch {}
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [route]);

  const handlePickRole = (kind) => {
    setPinFor(kind);
    setRoute("pin");
  };

  const handleTestAccess = () => {
    setAuthedAs("test");
    setMyName("테스트");
    setRoute("test");
  };

  const handlePinSuccess = async (kind) => {
    setAuthedAs(kind);
    await setKey(M.auth, kind, false);
    if (kind === "admin") {
      setMyName("마스터");
      await setKey(M.name, "마스터", false);
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
    const cfg = normalizeConfig((await getKey(K.config)) || gameConfig);
    let result = { ok: true };

    await txKey(K.players, (current) => {
      const list = Array.isArray(current) ? [...current] : [];
      const existing = list.find((p) => p.id === myId);

      if (!existing) {
        if (state.phase !== "lobby") {
          result = { ok: false, msg: "게임이 이미 진행 중입니다." };
          return list;
        }
        if (list.length >= cfg.totalPlayers) {
          result = { ok: false, msg: "정원이 가득 찼습니다." };
          return list;
        }
        if (list.find((p) => p.name === trimmed)) {
          result = { ok: false, msg: "이미 사용 중인 이름입니다." };
          return list;
        }
        list.push({ id: myId, name: trimmed, joinedAt: Date.now() });
      } else {
        if (list.some((p) => p.id !== myId && p.name === trimmed)) {
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
          return list.filter((p) => p.id !== myId);
        });
      }
    }
    await delKey(M.auth, false);
    await delKey(M.name, false);
    setAuthedAs(null);
    setMyName("");
    setRoute("splash");
  };

  const handleSaveConfig = async (nextConfig) => {
    const normalized = normalizeConfig(nextConfig);
    setGameConfig(normalized);
    await setKey(K.config, normalized);
  };

  const handleStartGame = async () => {
    const cfg = normalizeConfig((await getKey(K.config)) || gameConfig);
    const currentPlayers = (await getKey(K.players)) || players;
    if (!isConfigValid(cfg) || currentPlayers.length !== cfg.totalPlayers) return;

    const deck = shuffle(buildRoleDeck(cfg));
    const newRoles = {};
    currentPlayers.forEach((p, index) => {
      newRoles[p.id] = deck[index] || "citizen";
    });

    const now = Date.now();
    await setKey(K.roles, newRoles);
    await setKey(K.chat, []);
    await setKey(K.votes, {});
    await setKey(K.state, {
      phase: "playing",
      round: 1,
      startedAt: now,
      roundStartedAt: now,
      roundEndsAt: now + cfg.roundSeconds * 1000,
    });
  };

  const handleAdvanceRound = async () => {
    const cfg = normalizeConfig(gameConfig);
    const now = Date.now();
    if (gameState.round < TOTAL_ROUNDS) {
      await setKey(K.state, {
        ...gameState,
        round: gameState.round + 1,
        roundStartedAt: now,
        roundEndsAt: now + cfg.roundSeconds * 1000,
      });
    } else {
      await setKey(K.state, {
        ...gameState,
        phase: "voting",
        votingStartedAt: now,
        votingEndsAt: now + cfg.roundSeconds * 1000,
      });
    }
  };

  const handleRestartTimer = async () => {
    const cfg = normalizeConfig(gameConfig);
    const now = Date.now();
    if (gameState.phase === "playing") {
      await setKey(K.state, {
        ...gameState,
        roundStartedAt: now,
        roundEndsAt: now + cfg.roundSeconds * 1000,
      });
    }
    if (gameState.phase === "voting") {
      await setKey(K.state, {
        ...gameState,
        votingStartedAt: now,
        votingEndsAt: now + cfg.roundSeconds * 1000,
      });
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

  const handleSubmitVote = async (targetIds) => {
    await txKey(K.votes, (current) => {
      const next = current && typeof current === "object" && !Array.isArray(current) ? { ...current } : {};
      next[myId] = targetIds;
      return next;
    });
  };

  const myRole = roles[myId];

  return (
    <div
      className="min-h-screen bg-black text-white relative overflow-hidden"
      style={{ fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif" }}
    >
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
            onTest={handleTestAccess}
            onBack={() => setRoute("splash")}
          />
        )}
        {route === "name" && <NameEntryScreen onSubmit={handleNameSubmit} onBack={handleLeave} />}
        {route === "test" && <TestLab onExit={() => setRoute("splash")} />}
        {route === "game" && authedAs === "player" && (
          <PlayerScreen
            myId={myId}
            myName={myName}
            myRole={myRole}
            gameState={gameState}
            gameConfig={gameConfig}
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
            gameState={gameState}
            gameConfig={gameConfig}
            players={players}
            roles={roles}
            chat={chat}
            votes={votes}
            onSaveConfig={handleSaveConfig}
            onStart={handleStartGame}
            onAdvance={handleAdvanceRound}
            onRestartTimer={handleRestartTimer}
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

// ===================== CORE UI =====================
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

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css');
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap');
      .font-mono { font-family: 'JetBrains Mono', monospace !important; }
      @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(0,255,200,.35); } 50% { box-shadow: 0 0 30px 4px rgba(0,255,200,.14); } }
      @keyframes danger-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(255,40,85,.35); } 50% { box-shadow: 0 0 30px 4px rgba(255,40,85,.18); } }
      @keyframes blink { 0%,49% { opacity: 1; } 50%,100% { opacity: .25; } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes scaleIn { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: scale(1); } }
      @keyframes glitch { 0%,100% { transform: translate(0); } 20% { transform: translate(1px,-1px); } 40% { transform: translate(-1px,1px); } }
      .anim-fade-up { animation: fadeUp .5s ease-out forwards; opacity: 0; }
      .anim-fade-in { animation: fadeIn .5s ease-out forwards; }
      .anim-scale-in { animation: scaleIn .35s ease-out forwards; }
      .anim-pulse-glow { animation: pulse-glow 2.5s ease-in-out infinite; }
      .anim-danger-glow { animation: danger-glow 2s ease-in-out infinite; }
      .anim-blink { animation: blink 1s steps(2) infinite; }
      .anim-glitch { animation: glitch .3s ease-in-out; }
      .stagger > *:nth-child(1) { animation-delay: .05s; }
      .stagger > *:nth-child(2) { animation-delay: .12s; }
      .stagger > *:nth-child(3) { animation-delay: .19s; }
      .stagger > *:nth-child(4) { animation-delay: .26s; }
      .stagger > *:nth-child(5) { animation-delay: .33s; }
      .stagger > *:nth-child(6) { animation-delay: .40s; }
      .scrollbar-thin::-webkit-scrollbar { width: 4px; }
      .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
      .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,.14); border-radius: 2px; }
      input, button { -webkit-tap-highlight-color: transparent; }
    `}</style>
  );
}

function BackgroundFX() {
  return (
    <>
      <div
        className="fixed inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,255,200,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,200,0.5) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(circle at 50% 30%, transparent 0%, rgba(0,0,0,.72) 100%)" }}
      />
      <div
        className="fixed top-0 left-0 w-[60vw] h-[60vw] rounded-full pointer-events-none opacity-[0.08]"
        style={{
          background: "radial-gradient(circle, rgba(0,255,200,1) 0%, transparent 70%)",
          transform: "translate(-30%, -30%)",
        }}
      />
      <div
        className="fixed bottom-0 right-0 w-[60vw] h-[60vw] rounded-full pointer-events-none opacity-[0.06]"
        style={{
          background: "radial-gradient(circle, rgba(255,40,85,1) 0%, transparent 70%)",
          transform: "translate(30%, 30%)",
        }}
      />
    </>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
      <p className="font-mono text-xs text-cyan-400/60 tracking-[0.3em]">CONNECTING...</p>
    </div>
  );
}

function SplashScreen({ onPick }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="max-w-sm w-full stagger">
        <div className="text-center mb-10 anim-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-cyan-400/30 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 anim-blink" />
            <span className="font-mono text-[10px] text-cyan-400/80 tracking-[0.3em]">SECURE CHANNEL</span>
          </div>
          <h1
            className="font-mono text-5xl font-extrabold mb-3"
            style={{
              background: "linear-gradient(180deg, #ffffff 0%, #00ffd5 72%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.04em",
            }}
          >
            DEEP<br />NETWORK
          </h1>
          <div className="flex items-center justify-center gap-2 my-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-cyan-500/40" />
            <Skull className="w-3 h-3 text-cyan-400/60" />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-cyan-500/40" />
          </div>
          <p className="font-mono text-xs text-cyan-300/70 tracking-[0.2em]">마피아 색출 작전</p>
        </div>

        <div className="border border-white/10 bg-white/[0.02] backdrop-blur p-5 mb-6 anim-fade-up relative">
          <div className="font-mono text-[10px] text-cyan-400/70 tracking-[0.25em] mb-3">// GAME_BRIEF</div>
          <ul className="text-sm text-white/85 space-y-2 leading-relaxed">
            <li className="flex gap-2"><span className="text-cyan-400">›</span>마스터가 총 인원, 마피아 수, 직업 수를 설정</li>
            <li className="flex gap-2"><span className="text-cyan-400">›</span>각자 자신의 휴대폰에서 접속</li>
            <li className="flex gap-2"><span className="text-cyan-400">›</span>경찰, 의사, 보디가드, 영매, 스파이 지원</li>
            <li className="flex gap-2"><span className="text-rose-400">›</span>마피아 팀은 비밀 채팅 가능</li>
            <li className="flex gap-2"><span className="text-amber-300">›</span>테스트 PIN: 0000</li>
          </ul>
        </div>

        <AccessButton tone="cyan" icon={User} title="플레이어 입장" label="PLAYER ACCESS" onClick={() => onPick("player")} />
        <AccessButton tone="amber" icon={Shield} title="마스터 입장" label="MASTER ACCESS" onClick={() => onPick("admin")} />

        <p className="text-center text-white/30 text-[10px] mt-8 font-mono tracking-wider anim-fade-up">
          PLAYER 1004 · MASTER 4001 · TEST 0000
        </p>
      </div>
    </div>
  );
}

function AccessButton({ tone, icon: Icon, title, label, onClick }) {
  const classes =
    tone === "amber"
      ? "border-amber-500/40 from-amber-950/30 hover:from-amber-900/40 text-amber-300"
      : "border-cyan-400/40 from-cyan-950/30 hover:from-cyan-900/40 text-cyan-300";
  return (
    <button
      onClick={onClick}
      className={`w-full mb-3 group relative overflow-hidden border bg-gradient-to-br to-transparent transition-all anim-fade-up ${classes}`}
    >
      <div className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 border border-current/50 flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="font-mono text-[10px] opacity-70 tracking-[0.25em]">{label}</div>
            <div className="text-white font-semibold">{title}</div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  );
}

function PinScreen({ kind, expected, onSuccess, onTest, onBack }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const isAdmin = kind === "admin";
  const tone = isAdmin ? "amber" : "cyan";

  useEffect(() => {
    if (pin.length !== 4) {
      setError(false);
      return;
    }
    if (pin === TEST_PIN) {
      setTimeout(onTest, 180);
      return;
    }
    if (pin === expected) {
      setTimeout(onSuccess, 180);
      return;
    }
    setError(true);
    setShake(true);
    setTimeout(() => {
      setPin("");
      setShake(false);
    }, 600);
  }, [pin, expected]);

  const press = (n) => {
    if (pin.length < 4) setPin(pin + n);
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-8">
      <button onClick={onBack} className="self-start flex items-center gap-2 text-white/50 hover:text-white text-sm mb-8">
        <ArrowLeft className="w-4 h-4" />
        <span className="font-mono text-xs tracking-wider">BACK</span>
      </button>

      <div className="flex-1 flex flex-col items-center justify-center max-w-xs w-full mx-auto">
        <div className={`mb-2 font-mono text-[10px] tracking-[0.3em] ${tone === "amber" ? "text-amber-400/70" : "text-cyan-400/70"}`}>
          {isAdmin ? "MASTER AUTHENTICATION" : "PLAYER AUTHENTICATION"}
        </div>
        <div className={`${tone === "amber" ? "text-amber-300" : "text-cyan-300"} text-lg font-semibold mb-1`}>
          {isAdmin ? "마스터 인증" : "플레이어 인증"}
        </div>
        <div className="text-white/40 text-xs mb-10">4자리 코드를 입력하세요. 테스트는 0000입니다.</div>

        <div className={`flex gap-4 mb-12 ${shake ? "anim-glitch" : ""}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-12 h-14 border-b-2 flex items-end justify-center pb-2 transition-all ${
                error
                  ? "border-rose-500"
                  : pin.length > i
                  ? tone === "amber"
                    ? "border-amber-400"
                    : "border-cyan-400"
                  : "border-white/20"
              }`}
            >
              {pin.length > i ? (
                <div className={`w-3 h-3 rounded-full ${error ? "bg-rose-500" : tone === "amber" ? "bg-amber-400" : "bg-cyan-400"}`} />
              ) : (
                <div className="w-1 h-1 rounded-full bg-white/20" />
              )}
            </div>
          ))}
        </div>

        {error && <div className="text-rose-400 text-xs font-mono tracking-wider mb-6 anim-fade-in">ACCESS DENIED · 잘못된 코드</div>}

        <div className="grid grid-cols-3 gap-3 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => press(n)}
              className="aspect-square border border-white/10 hover:border-cyan-400/60 hover:bg-cyan-400/5 transition-all text-2xl font-mono font-light text-white/90 active:scale-95"
            >
              {n}
            </button>
          ))}
          <div />
          <button
            onClick={() => press(0)}
            className="aspect-square border border-white/10 hover:border-cyan-400/60 hover:bg-cyan-400/5 transition-all text-2xl font-mono font-light text-white/90 active:scale-95"
          >
            0
          </button>
          <button
            onClick={() => setPin(pin.slice(0, -1))}
            className="aspect-square border border-white/10 hover:border-rose-400/60 hover:bg-rose-400/5 transition-all flex items-center justify-center text-white/70 active:scale-95"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

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
        <p className="text-white/50 text-sm mb-10">다른 플레이어에게 표시될 이름을 입력하세요.</p>

        <div className="relative mb-2">
          <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400/60" />
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErr("");
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="이름 또는 닉네임"
            maxLength={12}
            autoFocus
            className="w-full bg-white/[0.03] border border-white/15 focus:border-cyan-400/60 text-white pl-12 pr-4 py-4 outline-none transition-colors text-lg"
          />
        </div>

        {err ? <p className="text-rose-400 text-xs mb-4 font-mono">{err}</p> : <p className="text-white/30 text-xs mb-4 font-mono">// MAX 12 chars</p>}

        <button
          onClick={submit}
          disabled={!name.trim() || busy}
          className={`w-full py-4 mt-4 transition-all font-medium ${
            name.trim() && !busy ? "bg-cyan-400 text-black hover:bg-cyan-300" : "bg-white/5 text-white/30 cursor-not-allowed"
          }`}
        >
          {busy ? "접속 중..." : "게임 입장"}
        </button>
      </div>
    </div>
  );
}

// ===================== TIMER =====================
function Countdown({ endsAt, compact = false }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!endsAt) return null;
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const expired = remaining <= 0;

  return (
    <div
      className={`inline-flex items-center gap-2 border ${
        expired ? "border-rose-500/50 text-rose-300 bg-rose-500/10" : "border-cyan-400/40 text-cyan-300 bg-cyan-400/10"
      } ${compact ? "px-2 py-1 text-[10px]" : "px-4 py-2 text-sm"} font-mono tracking-wider`}
    >
      <Clock className={compact ? "w-3 h-3" : "w-4 h-4"} />
      {expired ? "TIME OUT" : formatTime(remaining)}
    </div>
  );
}

// ===================== PLAYER SCREEN =====================
function PlayerScreen({ myId, myName, myRole, gameState, gameConfig, players, chat, roles, votes, onSendChat, onSubmitVote, onLeave }) {
  const phase = gameState?.phase || "lobby";
  return (
    <div className="min-h-screen flex flex-col">
      <PlayerHeader myName={myName} myRole={myRole} phase={phase} onLeave={onLeave} />
      {phase === "lobby" && <PlayerLobby players={players} myId={myId} gameConfig={gameConfig} />}
      {phase === "playing" && (
        <PlayerGame
          round={gameState.round}
          gameState={gameState}
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
          gameState={gameState}
          gameConfig={gameConfig}
          players={players}
          roles={roles}
          chat={chat}
          votes={votes}
          onSendChat={onSendChat}
          onSubmitVote={onSubmitVote}
        />
      )}
      {phase === "results" && <ResultsView myId={myId} players={players} roles={roles} votes={votes} gameConfig={gameConfig} isAdmin={false} />}
    </div>
  );
}

function PlayerHeader({ myName, myRole, phase, onLeave }) {
  const def = getRoleDef(myRole);
  const Icon = def.icon;
  const showRole = phase !== "lobby" && myRole;
  return (
    <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between bg-black/50 backdrop-blur sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${def.team === "mafia" && showRole ? "bg-rose-400" : "bg-cyan-400"} anim-blink`} />
        <div>
          <div className="font-mono text-[10px] text-white/40 tracking-wider">YOU</div>
          <div className="text-white text-sm font-semibold">{myName}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {showRole && (
          <div className={`px-2.5 py-1 border text-[10px] font-mono font-bold tracking-[0.16em] flex items-center gap-1.5 ${roleToneClasses(myRole)}`}>
            <Icon className="w-3 h-3" />
            {def.code}
          </div>
        )}
        <button onClick={onLeave} className="text-white/40 hover:text-white/80 transition">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

function PlayerLobby({ players, myId, gameConfig }) {
  const cfg = normalizeConfig(gameConfig);
  const remaining = cfg.totalPlayers - players.length;
  return (
    <div className="flex-1 px-5 py-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8 anim-fade-up">
          <div className="font-mono text-[10px] text-cyan-400/70 tracking-[0.3em] mb-2">// AWAITING_PLAYERS</div>
          <h2 className="text-2xl font-bold text-white mb-2">접속 대기실</h2>
          <p className="text-white/50 text-sm">
            {remaining > 0 ? `${remaining}명이 더 접속하면 마스터가 시작합니다` : "모든 인원 접속 완료. 마스터의 시작을 기다리는 중..."}
          </p>
        </div>

        <div className="border border-white/10 bg-white/[0.02] overflow-hidden mb-6 anim-fade-up">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <span className="font-mono text-[10px] text-white/50 tracking-[0.2em]">CONNECTED ({players.length}/{cfg.totalPlayers})</span>
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
                {p.id === myId && <span className="font-mono text-[10px] text-cyan-400 tracking-wider">YOU</span>}
              </div>
            ))}
            {Array.from({ length: Math.max(0, cfg.totalPlayers - players.length) }).map((_, i) => (
              <div key={`e${i}`} className="px-4 py-3 flex items-center gap-3 opacity-30">
                <div className="w-8 h-8 rounded-full border border-dashed border-white/20" />
                <div className="font-mono text-xs text-white/30">awaiting connection...</div>
              </div>
            ))}
          </div>
        </div>

        <RoleSummary config={cfg} />
      </div>
    </div>
  );
}

function PlayerGame({ round, gameState, myId, myName, myRole, players, chat, onSendChat }) {
  const r = ROUNDS[round] || ROUNDS[1];
  const def = getRoleDef(myRole);
  const isMafiaTeam = def.team === "mafia";
  const [showRoleReveal, setShowRoleReveal] = useState(false);
  const checkedRef = useRef(null);

  useEffect(() => {
    if (round !== 1 || !gameState.startedAt) return;
    if (checkedRef.current === gameState.startedAt) return;
    checkedRef.current = gameState.startedAt;
    (async () => {
      const lastSeen = await getKey("dn_last_reveal", false);
      if (lastSeen !== gameState.startedAt) {
        setShowRoleReveal(true);
        await setKey("dn_last_reveal", gameState.startedAt, false);
      }
    })();
  }, [round, gameState.startedAt]);

  if (showRoleReveal) {
    return <RoleRevealOverlay role={myRole} onClose={() => setShowRoleReveal(false)} myName={myName} />;
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 py-6 max-w-md w-full mx-auto flex-1">
        <div className="flex items-center justify-between mb-5 anim-fade-up">
          <div className="font-mono text-[10px] text-white/50 tracking-[0.25em]">
            {r.label} · {round}/{TOTAL_ROUNDS}
          </div>
          <Countdown endsAt={gameState.roundEndsAt} compact />
        </div>

        <div className="border border-cyan-400/20 bg-gradient-to-b from-cyan-400/[0.03] to-transparent p-6 mb-5 relative anim-scale-in">
          <Corner tone="cyan" />
          <div className="font-mono text-[10px] text-cyan-400/70 tracking-[0.2em] mb-3">{r.code}</div>
          <h2 className="text-3xl font-bold text-white mb-5 tracking-tight">{r.title}</h2>
          <div className="space-y-2 text-white/85 leading-relaxed text-[15px] mb-6">
            {r.text.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
          <div className="flex items-start gap-2 pt-4 border-t border-white/10">
            <Crosshair className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
            <p className="text-cyan-300 text-sm font-medium">{r.instruction}</p>
          </div>
        </div>

        <RoleAbilityPanel role={myRole} players={players} myId={myId} />

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
          마스터가 다음 라운드를 진행합니다...
        </div>
      </div>

      {isMafiaTeam && <KillerChatPanel chat={chat} myId={myId} myName={myName} onSend={onSendChat} isAdmin={false} />}
    </div>
  );
}

function RoleAbilityPanel({ role, players, myId }) {
  const def = getRoleDef(role);
  const Icon = def.icon;
  const [target, setTarget] = useState("");
  const selectable = players.filter((p) => p.id !== myId);

  return (
    <div className={`border p-4 mb-5 anim-fade-up ${roleToneClasses(role)}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 border border-current/40 flex items-center justify-center bg-black/20">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="font-mono text-[10px] tracking-[0.25em] opacity-80 mb-1">{def.code} SCREEN</div>
          <h3 className="text-lg font-bold text-white mb-1">{def.name}</h3>
          <p className="text-sm text-white/75 leading-relaxed">{def.brief}</p>
          <p className="text-xs text-white/50 leading-relaxed mt-2">{def.mission}</p>
        </div>
      </div>

      {role !== "citizen" && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="font-mono text-[10px] text-white/45 tracking-[0.2em] mb-2">TARGET MEMO</div>
          <div className="grid grid-cols-2 gap-2">
            {selectable.slice(0, 8).map((p) => (
              <button
                key={p.id}
                onClick={() => setTarget(p.id)}
                className={`px-3 py-2 border text-left text-xs transition ${
                  target === p.id ? "border-white/60 bg-white/10 text-white" : "border-white/10 bg-black/20 text-white/60"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/35">이 선택은 개인 메모용입니다. 실제 판정은 마스터가 진행하세요.</p>
        </div>
      )}
    </div>
  );
}

function RoleRevealOverlay({ role, onClose, myName }) {
  const [revealed, setRevealed] = useState(false);
  const def = getRoleDef(role);
  const Icon = def.icon;
  const isMafiaTeam = def.team === "mafia";

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center px-6">
      {!revealed ? (
        <div className="text-center anim-fade-in">
          <p className="font-mono text-[10px] text-cyan-400/70 tracking-[0.3em] mb-3">// ROLE_ASSIGNMENT</p>
          <h2 className="text-3xl font-bold text-white mb-2">{myName}</h2>
          <p className="text-white/50 text-sm mb-12">신원 카드가 준비되었습니다</p>
          <div className="border border-white/15 bg-white/[0.03] p-12 mb-8 relative">
            <Corner tone="cyan" />
            <Lock className="w-12 h-12 text-cyan-400/70 mx-auto mb-4" />
            <p className="font-mono text-xs text-cyan-300 tracking-[0.3em]">CLASSIFIED</p>
          </div>
          <p className="text-white/40 text-xs mb-6">다른 사람이 화면을 볼 수 없는 곳에서 확인하세요</p>
          <button onClick={() => setRevealed(true)} className="px-12 py-4 bg-cyan-400 text-black font-semibold hover:bg-cyan-300 transition-all">
            <Eye className="inline w-4 h-4 mr-2" />
            신원 확인
          </button>
        </div>
      ) : (
        <div className="text-center anim-scale-in max-w-sm w-full">
          <p className={`font-mono text-[10px] tracking-[0.3em] mb-3 ${isMafiaTeam ? "text-rose-400" : "text-cyan-400"}`}>
            // {isMafiaTeam ? "RED_TEAM" : "BLUE_TEAM"}
          </p>
          <div className={`border-2 p-8 mb-6 relative ${isMafiaTeam ? "border-rose-500/60 bg-rose-950/30 anim-danger-glow" : "border-cyan-400/60 bg-cyan-950/20 anim-pulse-glow"}`}>
            <Corner tone={isMafiaTeam ? "rose" : "cyan"} thick />
            <Icon className={`w-16 h-16 mx-auto mb-4 ${isMafiaTeam ? "text-rose-400" : "text-cyan-400"}`} />
            <h2 className={`text-3xl font-bold mb-2 tracking-tight ${isMafiaTeam ? "text-rose-300" : "text-cyan-300"}`}>{def.name}</h2>
            <p className={`font-mono text-xs tracking-[0.25em] mb-5 ${isMafiaTeam ? "text-rose-400/80" : "text-cyan-400/80"}`}>{def.code}</p>
            <div className="border-t border-white/10 pt-4 text-left space-y-2 text-sm text-white/85 leading-relaxed">
              <p>{def.brief}</p>
              <p>{def.mission}</p>
            </div>
          </div>
          <div className={`border p-3 mb-6 text-left ${isMafiaTeam ? "border-rose-500/30 bg-rose-500/10" : "border-cyan-500/30 bg-cyan-500/10"}`}>
            <div className={`font-mono text-[10px] tracking-wider mb-1 ${isMafiaTeam ? "text-rose-400" : "text-cyan-400"}`}>VICTORY CONDITION</div>
            <p className="text-sm text-white/85">{def.win}</p>
          </div>
          <button onClick={onClose} className={`w-full py-4 font-semibold transition ${isMafiaTeam ? "bg-rose-500 text-white hover:bg-rose-400" : "bg-cyan-400 text-black hover:bg-cyan-300"}`}>
            게임 시작
          </button>
        </div>
      )}
    </div>
  );
}

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
      <div className="px-4 py-2.5 flex items-center justify-between cursor-pointer bg-rose-950/40" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-rose-400" />
          <span className="font-mono text-[11px] text-rose-300 tracking-[0.2em] font-semibold">
            ENCRYPTED // {isAdmin ? "MASTER_VIEW" : "MAFIA_CHANNEL"}
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
              </div>
            ) : (
              chat.map((m) => {
                const mine = m.senderId === myId;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[80%]">
                      <div className={`flex items-center gap-2 mb-0.5 ${mine ? "justify-end" : ""}`}>
                        <span className={`font-mono text-[10px] ${m.isAdmin ? "text-amber-400" : mine ? "text-rose-300" : "text-rose-400/70"}`}>
                          {m.isAdmin ? "MASTER " : ""}
                          {m.senderName}
                        </span>
                        <span className="font-mono text-[9px] text-white/30">{timeAgo(m.timestamp)}</span>
                      </div>
                      <div className={`px-3 py-2 text-sm ${m.isAdmin ? "bg-amber-500/10 border border-amber-500/30 text-amber-100" : mine ? "bg-rose-500/15 border border-rose-500/40 text-rose-50" : "bg-white/[0.04] border border-white/10 text-white/90"}`}>
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
              placeholder={isAdmin ? "마스터 메시지..." : "마피아 팀에게 메시지..."}
              maxLength={200}
              className="flex-1 bg-black/40 border border-white/10 focus:border-rose-400/60 px-3 py-2.5 text-sm text-white outline-none"
            />
            <button onClick={send} disabled={!text.trim()} className={`px-4 ${text.trim() ? "bg-rose-500 text-white hover:bg-rose-400" : "bg-white/5 text-white/30"} transition`}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PlayerVoting({ myId, myName, myRole, gameState, gameConfig, players, roles, chat, votes, onSendChat, onSubmitVote }) {
  const [selected, setSelected] = useState([]);
  const myVote = votes[myId];
  const submitted = !!myVote;
  const pickCount = Math.max(1, mafiaCount(roles) || mafiaCount(gameConfig));
  const isMafiaTeam = getRoleDef(myRole).team === "mafia";
  const totalVoted = Object.keys(votes).length;

  const toggle = (id) => {
    if (submitted || id === myId) return;
    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id));
    } else if (selected.length < pickCount) {
      setSelected([...selected, id]);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 py-6 max-w-md w-full mx-auto flex-1">
        <div className="text-center mb-6 anim-fade-up">
          <div className="font-mono text-[10px] text-rose-400/80 tracking-[0.3em] mb-2 anim-blink">// FINAL_VOTE</div>
          <h2 className="text-3xl font-bold text-white mb-2">최후의 지목</h2>
          <p className="text-white/60 text-sm">마피아 팀으로 의심되는 {pickCount}명을 선택하세요</p>
          <div className="mt-4">
            <Countdown endsAt={gameState.votingEndsAt} />
          </div>
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
                      isSelf ? "border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed" : isSelected ? "border-rose-500 bg-rose-500/10" : "border-white/15 bg-white/[0.02] hover:border-white/30"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full border flex items-center justify-center ${isSelected ? "border-rose-400 bg-rose-500/20" : "border-white/20"}`}>
                      {isSelected ? <Crosshair className="w-4 h-4 text-rose-400" /> : <User className="w-4 h-4 text-white/50" />}
                    </div>
                    <div className="flex-1">
                      <div className={`font-medium ${isSelected ? "text-rose-200" : "text-white"}`}>{p.name}</div>
                      <div className="font-mono text-[10px] text-white/30">ID:{shortId(p.id)}</div>
                    </div>
                    {isSelf && <span className="font-mono text-[10px] text-white/30">YOU</span>}
                  </button>
                );
              })}
            </div>
            <div className="text-center mb-4">
              <span className="font-mono text-xs text-white/50">선택: {selected.length} / {pickCount}</span>
            </div>
            <button
              onClick={() => selected.length === pickCount && onSubmitVote(selected)}
              disabled={selected.length !== pickCount}
              className={`w-full py-4 font-semibold transition-all ${selected.length === pickCount ? "bg-rose-500 text-white hover:bg-rose-400" : "bg-white/5 text-white/30 cursor-not-allowed"}`}
            >
              {selected.length === pickCount ? "투표 제출" : `${pickCount - selected.length}명 더 선택`}
            </button>
          </>
        ) : (
          <div className="text-center anim-scale-in">
            <div className="border border-cyan-400/40 bg-cyan-400/5 p-8 mb-6 relative">
              <Corner tone="cyan" />
              <Check className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
              <p className="font-mono text-[10px] text-cyan-400 tracking-[0.3em] mb-2">VOTE_SUBMITTED</p>
              <p className="text-white text-lg font-semibold mb-3">투표 완료</p>
              <p className="font-mono text-xs text-cyan-300">{totalVoted} / {normalizeConfig(gameConfig).totalPlayers} 표 집계</p>
            </div>
          </div>
        )}
      </div>

      {isMafiaTeam && <KillerChatPanel chat={chat} myId={myId} myName={myName} onSend={onSendChat} isAdmin={false} />}
    </div>
  );
}

function ResultsView({ myId, players, roles, votes, gameConfig, isAdmin }) {
  const [revealed, setRevealed] = useState(false);
  const pickCount = Math.max(1, mafiaCount(roles) || mafiaCount(gameConfig));
  const tally = {};
  players.forEach((p) => {
    tally[p.id] = 0;
  });
  Object.values(votes).forEach((targets) => {
    if (Array.isArray(targets)) targets.forEach((t) => { tally[t] = (tally[t] || 0) + 1; });
  });

  const sorted = players.map((p) => ({ ...p, votes: tally[p.id] || 0, role: roles[p.id] })).sort((a, b) => b.votes - a.votes);
  const eliminated = sorted.slice(0, pickCount);
  const mafiaIds = players.filter((p) => ROLE_DEFS[roles[p.id]]?.team === "mafia").map((p) => p.id);
  const eliminatedMafia = eliminated.filter((p) => ROLE_DEFS[p.role]?.team === "mafia");
  const townWins = mafiaIds.length > 0 && eliminatedMafia.length === mafiaIds.length;
  const myTeam = ROLE_DEFS[roles[myId]]?.team;
  const iWon = isAdmin ? null : (myTeam === "town" && townWins) || (myTeam === "mafia" && !townWins);

  return (
    <div className="flex-1 px-5 py-6">
      <div className="max-w-md w-full mx-auto">
        {!revealed ? (
          <div className="min-h-[70vh] flex flex-col items-center justify-center text-center anim-fade-in">
            <div className="font-mono text-[10px] text-white/50 tracking-[0.3em] mb-3 anim-blink">// CALCULATING_RESULTS</div>
            <h2 className="text-3xl font-bold text-white mb-3">진실의 시간</h2>
            <p className="text-white/60 mb-10 text-sm">모든 표가 모였습니다.</p>
            <button onClick={() => setRevealed(true)} className="px-12 py-4 bg-white text-black font-bold hover:bg-cyan-100 transition anim-pulse-glow">
              결과 공개
            </button>
          </div>
        ) : (
          <div className="anim-fade-in py-4">
            <div className={`border-2 p-6 mb-6 text-center relative ${townWins ? "border-cyan-400 bg-cyan-500/5" : "border-rose-500 bg-rose-500/5"}`}>
              <Corner tone={townWins ? "cyan" : "rose"} thick />
              {townWins ? (
                <>
                  <UserCheck className="w-14 h-14 text-cyan-400 mx-auto mb-3" />
                  <p className="font-mono text-[10px] text-cyan-400 tracking-[0.3em] mb-2">// TOWN_WIN</p>
                  <h2 className="text-3xl font-bold text-cyan-300 mb-2">시민 팀 승리</h2>
                  <p className="text-cyan-100/80 text-sm">마피아 팀을 모두 색출했습니다.</p>
                </>
              ) : (
                <>
                  <Skull className="w-14 h-14 text-rose-400 mx-auto mb-3 anim-glitch" />
                  <p className="font-mono text-[10px] text-rose-400 tracking-[0.3em] mb-2">// MAFIA_WIN</p>
                  <h2 className="text-3xl font-bold text-rose-300 mb-2">마피아 팀 승리</h2>
                  <p className="text-rose-100/80 text-sm">마피아 팀이 정체를 숨기는 데 성공했습니다.</p>
                </>
              )}
              {iWon !== null && (
                <div className={`mt-4 pt-4 border-t font-mono text-xs tracking-[0.3em] ${iWon ? "border-cyan-400/30 text-cyan-300" : "border-rose-500/30 text-rose-300"}`}>
                  YOU {iWon ? "WIN" : "LOSE"}
                </div>
              )}
            </div>

            <div className="mb-6 anim-fade-up">
              <div className="font-mono text-[10px] text-white/50 tracking-[0.25em] mb-2">// ROLE_REVEAL</div>
              <div className="grid grid-cols-2 gap-3">
                {players.map((p) => {
                  const role = roles[p.id] || "citizen";
                  const def = getRoleDef(role);
                  const Icon = def.icon;
                  return (
                    <div key={p.id} className={`p-4 border ${roleToneClasses(role)}`}>
                      <Icon className="w-5 h-5 mb-2" />
                      <div className="text-white font-bold mb-0.5">{p.name}</div>
                      <div className="font-mono text-[10px] text-white/50">{def.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border border-white/10 bg-white/[0.02] mb-6">
              <div className="px-4 py-3 border-b border-white/5 font-mono text-[10px] text-white/50 tracking-[0.25em]">// VOTE_TALLY</div>
              <div className="divide-y divide-white/5">
                {sorted.map((p, idx) => {
                  const role = p.role || "citizen";
                  const isMafia = ROLE_DEFS[role]?.team === "mafia";
                  const wasEliminated = idx < pickCount;
                  const pct = (p.votes / Math.max(1, normalizeConfig(gameConfig).totalPlayers * pickCount)) * 100;
                  return (
                    <div key={p.id} className={`px-4 py-3 ${wasEliminated ? "bg-rose-950/20" : ""}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-white/40">#{idx + 1}</span>
                          <span className="text-white font-medium text-sm">{p.name}</span>
                          {isMafia && <Skull className="w-3 h-3 text-rose-400" />}
                          {wasEliminated && <span className="font-mono text-[9px] text-rose-300 tracking-wider">ELIMINATED</span>}
                        </div>
                        <span className="font-mono text-xs text-white/70">{p.votes}표</span>
                      </div>
                      <div className="h-1 bg-white/10 overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${isMafia ? "bg-rose-500" : "bg-cyan-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== ADMIN SCREEN =====================
function AdminScreen({
  myId,
  gameState,
  gameConfig,
  players,
  roles,
  chat,
  votes,
  onSaveConfig,
  onStart,
  onAdvance,
  onRestartTimer,
  onEndVoting,
  onReset,
  onSendChat,
  onLeave,
}) {
  const [tab, setTab] = useState("setup");
  const phase = gameState?.phase || "lobby";
  const round = gameState?.round || 0;

  useEffect(() => {
    if (phase === "voting") setTab("voting");
    else if (phase === "results") setTab("results");
  }, [phase]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-amber-500/30 px-4 py-3 flex items-center justify-between bg-black/50 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Shield className="w-4 h-4 text-amber-400" />
          <div>
            <div className="font-mono text-[10px] text-amber-400/70 tracking-wider">MASTER CONSOLE</div>
            <div className="text-amber-300 text-sm font-bold">마스터 화면</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-white/50 tracking-wider px-2 py-1 border border-white/10">
            {phase === "lobby" ? "LOBBY" : phase === "playing" ? `R0${round}` : phase === "voting" ? "VOTING" : "RESULTS"}
          </span>
          <button onClick={onLeave} className="text-white/40 hover:text-white/80">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <nav className="border-b border-white/10 flex bg-black/30">
        {[
          { id: "setup", label: "설정", icon: Settings },
          { id: "dashboard", label: "현황", icon: Activity },
          { id: "roles", label: "직업표", icon: Users },
          { id: "chat", label: "채팅", icon: MessageSquare, badge: chat.length || null },
          { id: "control", label: "진행", icon: Play },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-2 py-3 flex flex-col items-center gap-1 border-b-2 transition-all ${
                active ? "border-amber-400 bg-amber-400/5 text-amber-300" : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {t.badge && <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-1 bg-rose-500 text-white text-[9px] flex items-center justify-center rounded-full font-mono font-bold">{t.badge}</span>}
              </div>
              <span className="text-[10px] font-medium tracking-wider">{t.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto">
        {tab === "setup" && <AdminSetup config={gameConfig} phase={phase} onSave={onSaveConfig} />}
        {tab === "dashboard" && <AdminDashboard phase={phase} round={round} players={players} roles={roles} votes={votes} gameConfig={gameConfig} />}
        {tab === "roles" && <AdminRoles players={players} roles={roles} phase={phase} gameConfig={gameConfig} />}
        {tab === "chat" && <AdminChat chat={chat} myId={myId} onSend={onSendChat} phase={phase} />}
        {tab === "control" && (
          <AdminControl
            phase={phase}
            round={round}
            gameState={gameState}
            gameConfig={gameConfig}
            players={players}
            votes={votes}
            onStart={onStart}
            onAdvance={onAdvance}
            onRestartTimer={onRestartTimer}
            onEndVoting={onEndVoting}
            onReset={onReset}
          />
        )}
        {tab === "voting" && phase === "voting" && <AdminVotingMonitor players={players} votes={votes} gameConfig={gameConfig} onEndVoting={onEndVoting} />}
        {tab === "results" && phase === "results" && <ResultsView myId={myId} players={players} roles={roles} votes={votes} gameConfig={gameConfig} isAdmin />}
      </div>
    </div>
  );
}

function AdminSetup({ config, phase, onSave }) {
  const [draft, setDraft] = useState(normalizeConfig(config));
  const configSignature = JSON.stringify(normalizeConfig(config));
  const cfg = normalizeConfig(draft);
  const specialTotal = SPECIAL_ROLE_IDS.reduce((sum, id) => sum + cfg.roles[id], 0);
  const invalid = !isConfigValid(cfg);

  useEffect(() => {
    setDraft(JSON.parse(configSignature));
  }, [configSignature]);

  const updateRole = (role, next) => {
    setDraft((prev) => normalizeConfig({ ...prev, roles: { ...prev.roles, [role]: clamp(next, 0, 20) } }));
  };

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="anim-fade-up">
        <div className="font-mono text-[10px] text-amber-400/70 tracking-[0.3em] mb-2">// GAME_SETUP</div>
        <h2 className="text-xl font-bold text-white mb-1">게임 설정</h2>
        <p className="text-white/45 text-sm">총 인원, 범인 수, 직업 구성, 라운드 시간을 마스터가 정합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stepper label="총 인원" value={cfg.totalPlayers} min={4} max={20} onChange={(v) => setDraft((prev) => normalizeConfig({ ...prev, totalPlayers: v }))} />
        <Stepper label="라운드 시간" value={Math.floor(cfg.roundSeconds / 60)} min={1} max={30} suffix="분" onChange={(v) => setDraft((prev) => normalizeConfig({ ...prev, roundSeconds: v * 60 }))} />
      </div>

      <div className="border border-white/10 bg-white/[0.02]">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <span className="font-mono text-[10px] text-white/50 tracking-[0.25em]">ROLE_COUNTS</span>
          <span className={`font-mono text-[10px] ${specialTotal > cfg.totalPlayers ? "text-rose-400" : "text-cyan-300"}`}>
            특수직 {specialTotal}명 · 시민 {cfg.roles.citizen}명
          </span>
        </div>
        <div className="divide-y divide-white/5">
          {SPECIAL_ROLE_IDS.map((role) => (
            <RoleCountRow key={role} role={role} value={cfg.roles[role]} onChange={(v) => updateRole(role, v)} />
          ))}
          <div className="px-4 py-3 flex items-center justify-between bg-cyan-400/[0.03]">
            <div className="flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-cyan-300" />
              <div>
                <div className="text-white text-sm font-semibold">시민</div>
                <div className="text-white/35 text-xs">남은 인원이 자동 배정됩니다</div>
              </div>
            </div>
            <span className="font-mono text-lg text-cyan-300">{cfg.roles.citizen}</span>
          </div>
        </div>
      </div>

      {invalid && (
        <div className="border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 flex gap-2">
          <AlertCircle className="w-4 h-4 text-rose-300 mt-0.5 flex-shrink-0" />
          <span>특수 직업 수가 총 인원을 넘었거나 마피아 팀이 없습니다.</span>
        </div>
      )}

      <button
        onClick={() => onSave(cfg)}
        disabled={invalid || phase !== "lobby"}
        className={`w-full py-4 font-bold transition ${!invalid && phase === "lobby" ? "bg-amber-400 text-black hover:bg-amber-300" : "bg-white/5 text-white/30 cursor-not-allowed"}`}
      >
        {phase === "lobby" ? "설정 저장" : "진행 중에는 설정을 바꿀 수 없습니다"}
      </button>
    </div>
  );
}

function Stepper({ label, value, min, max, suffix = "명", onChange }) {
  return (
    <div className="border border-white/10 bg-white/[0.02] p-3">
      <div className="font-mono text-[10px] text-white/50 tracking-[0.2em] mb-2">{label}</div>
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => onChange(clamp(value - 1, min, max))} className="w-9 h-9 border border-white/10 flex items-center justify-center hover:bg-white/5">
          <Minus className="w-4 h-4" />
        </button>
        <div className="text-xl font-bold text-white">
          {value}<span className="text-sm text-white/40 ml-1">{suffix}</span>
        </div>
        <button onClick={() => onChange(clamp(value + 1, min, max))} className="w-9 h-9 border border-white/10 flex items-center justify-center hover:bg-white/5">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function RoleCountRow({ role, value, onChange }) {
  const def = getRoleDef(role);
  const Icon = def.icon;
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 border flex items-center justify-center ${roleToneClasses(role)}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-white text-sm font-semibold">{def.name}</div>
          <div className="text-white/35 text-xs">{def.brief}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(value - 1)} className="w-8 h-8 border border-white/10 flex items-center justify-center hover:bg-white/5">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="w-6 text-center font-mono text-white">{value}</span>
        <button onClick={() => onChange(value + 1)} className="w-8 h-8 border border-white/10 flex items-center justify-center hover:bg-white/5">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function AdminDashboard({ phase, round, players, roles, votes, gameConfig }) {
  const cfg = normalizeConfig(gameConfig);
  const voteCount = Object.keys(votes).length;
  return (
    <div className="px-5 py-5 space-y-4">
      <div className="grid grid-cols-2 gap-3 stagger">
        <StatCard label="단계" value={phase === "lobby" ? "대기" : phase === "playing" ? `R${round}` : phase === "voting" ? "투표" : "종료"} icon={Activity} />
        <StatCard label="접속자" value={`${players.length}/${cfg.totalPlayers}`} icon={Users} />
        <StatCard label="마피아 팀" value={`${mafiaCount(cfg)}명`} icon={Skull} accent="rose" />
        <StatCard label="투표" value={`${voteCount}/${cfg.totalPlayers}`} icon={Vote} accent={voteCount > 0 ? "amber" : "white"} />
      </div>
      <RoleSummary config={cfg} />
      <PlayerList players={players} roles={roles} votes={votes} />
    </div>
  );
}

function AdminRoles({ players, roles, phase, gameConfig }) {
  if (phase === "lobby") {
    return (
      <div className="px-5 py-5">
        <RoleSummary config={gameConfig} />
        <div className="mt-4 border border-white/10 bg-white/[0.02] py-12 text-center">
          <Lock className="w-8 h-8 text-white/30 mx-auto mb-3" />
          <p className="text-white/50 text-sm mb-1">직업 미배정</p>
          <p className="text-white/30 text-xs">게임 시작 시 설정값에 맞춰 무작위 배정됩니다</p>
        </div>
      </div>
    );
  }
  return (
    <div className="px-5 py-5">
      <PlayerList players={players} roles={roles} showRoles />
    </div>
  );
}

function AdminChat({ chat, myId, onSend, phase }) {
  if (phase === "lobby") {
    return (
      <div className="px-5 py-12 text-center">
        <Lock className="w-8 h-8 text-white/30 mx-auto mb-3" />
        <p className="text-white/50 text-sm">채팅 비활성</p>
        <p className="text-white/30 text-xs">게임 시작 후 마피아 채팅이 활성화됩니다</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="px-5 py-3 bg-rose-950/20 border-b border-rose-500/30">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-mono text-[10px] text-amber-400 tracking-[0.25em]">MASTER_VIEW // 마피아 채팅 모니터링</span>
        </div>
      </div>
      <KillerChatPanel chat={chat} myId={myId} myName="마스터" onSend={onSend} isAdmin />
    </div>
  );
}

function AdminControl({ phase, round, gameState, gameConfig, players, votes, onStart, onAdvance, onRestartTimer, onEndVoting, onReset }) {
  const cfg = normalizeConfig(gameConfig);
  const canStart = phase === "lobby" && players.length === cfg.totalPlayers && isConfigValid(cfg);
  const allVoted = phase === "voting" && Object.keys(votes).length === cfg.totalPlayers;
  const voteCount = Object.keys(votes).length;

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="border border-amber-500/30 bg-amber-500/5 p-4 anim-fade-up">
        <div className="font-mono text-[10px] text-amber-400 tracking-[0.25em] mb-2">CURRENT_PHASE</div>
        <div className="text-2xl font-bold text-white mb-1">
          {phase === "lobby" && "대기실"}
          {phase === "playing" && `라운드 ${round} / ${TOTAL_ROUNDS}`}
          {phase === "voting" && "투표 진행 중"}
          {phase === "results" && "게임 종료"}
        </div>
        <p className="text-white/60 text-sm">
          {phase === "lobby" && `${players.length}/${cfg.totalPlayers}명 접속`}
          {phase === "playing" && ROUNDS[round]?.title}
          {phase === "voting" && `${voteCount}/${cfg.totalPlayers}명 투표 완료`}
          {phase === "results" && "결과 발표 완료"}
        </p>
        {(phase === "playing" || phase === "voting") && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <Countdown endsAt={phase === "playing" ? gameState.roundEndsAt : gameState.votingEndsAt} />
            <button onClick={onRestartTimer} className="px-3 py-2 border border-white/15 text-white/70 text-xs hover:bg-white/5">
              타이머 재시작
            </button>
          </div>
        )}
      </div>

      {phase === "lobby" && (
        <>
          <button
            onClick={onStart}
            disabled={!canStart}
            className={`w-full py-5 font-bold text-lg flex items-center justify-center gap-3 transition-all anim-fade-up ${
              canStart ? "bg-cyan-400 text-black hover:bg-cyan-300 anim-pulse-glow" : "bg-white/5 text-white/30 cursor-not-allowed"
            }`}
          >
            <Play className="w-5 h-5" />
            {canStart ? "게임 시작" : `${cfg.totalPlayers - players.length}명 더 필요`}
          </button>
          <p className="text-center text-white/40 text-xs">설정된 직업표에 맞춰 무작위 배정됩니다</p>
        </>
      )}

      {phase === "playing" && (
        <button onClick={onAdvance} className="w-full py-5 bg-amber-400 text-black font-bold text-lg flex items-center justify-center gap-3 hover:bg-amber-300 transition anim-pulse-glow">
          {round < TOTAL_ROUNDS ? <><ChevronRight className="w-5 h-5" />다음 라운드 진행</> : <><Vote className="w-5 h-5" />투표 단계 시작</>}
        </button>
      )}

      {phase === "voting" && (
        <button
          onClick={onEndVoting}
          className={`w-full py-5 font-bold text-lg flex items-center justify-center gap-3 transition ${allVoted ? "bg-rose-500 text-white hover:bg-rose-400 anim-danger-glow" : "bg-amber-400 text-black hover:bg-amber-300"}`}
        >
          <Crosshair className="w-5 h-5" />
          {allVoted ? "결과 발표" : `결과 발표 (${voteCount}/${cfg.totalPlayers})`}
        </button>
      )}

      {phase === "results" && (
        <button onClick={() => { if (confirm("게임을 초기화합니다. 계속하시겠습니까?")) onReset(); }} className="w-full py-5 bg-cyan-400 text-black font-bold text-lg flex items-center justify-center gap-3 hover:bg-cyan-300 transition">
          <RotateCcw className="w-5 h-5" />
          새 게임 시작
        </button>
      )}

      {phase !== "results" && phase !== "lobby" && (
        <button onClick={() => { if (confirm("정말 초기화하시겠습니까?")) onReset(); }} className="w-full py-3 border border-white/20 text-white/60 hover:bg-white/5 hover:text-white transition text-sm">
          <RotateCcw className="inline w-4 h-4 mr-2" />
          게임 강제 초기화
        </button>
      )}
    </div>
  );
}

function AdminVotingMonitor({ players, votes, gameConfig, onEndVoting }) {
  const cfg = normalizeConfig(gameConfig);
  const voted = Object.keys(votes);
  const allVoted = voted.length === cfg.totalPlayers;

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="anim-fade-up">
        <div className="font-mono text-[10px] text-rose-400/70 tracking-[0.3em] mb-2">// VOTING_IN_PROGRESS</div>
        <h2 className="text-xl font-bold text-white mb-1">투표 진행 상황</h2>
        <p className="text-white/50 text-sm">{voted.length}/{cfg.totalPlayers} 명 투표 완료</p>
      </div>
      <div className="border border-white/10 bg-white/[0.02] divide-y divide-white/5 stagger">
        {players.map((p) => {
          const did = !!votes[p.id];
          return (
            <div key={p.id} className="px-4 py-3 flex items-center justify-between anim-fade-up">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${did ? "bg-emerald-400" : "bg-white/20"}`} />
                <span className="text-white text-sm">{p.name}</span>
              </div>
              <span className={`font-mono text-[10px] tracking-wider ${did ? "text-emerald-400" : "text-white/30"}`}>{did ? "VOTED" : "WAITING"}</span>
            </div>
          );
        })}
      </div>
      <button onClick={onEndVoting} className={`w-full py-4 font-bold text-lg flex items-center justify-center gap-3 transition ${allVoted ? "bg-rose-500 text-white hover:bg-rose-400 anim-danger-glow" : "bg-amber-400 text-black hover:bg-amber-300"}`}>
        <Crosshair className="w-5 h-5" />
        {allVoted ? "결과 발표" : "강제 종료 후 결과 발표"}
      </button>
    </div>
  );
}

function PlayerList({ players, roles, votes = {}, showRoles = false }) {
  return (
    <div className="border border-white/10 bg-white/[0.02] anim-fade-up">
      <div className="px-4 py-3 border-b border-white/5 font-mono text-[10px] text-white/50 tracking-[0.25em]">// PLAYERS</div>
      {players.length === 0 ? (
        <div className="px-4 py-8 text-center text-white/30 text-sm">아직 접속자가 없습니다</div>
      ) : (
        <div className="divide-y divide-white/5">
          {players.map((p, i) => {
            const role = roles[p.id];
            const def = getRoleDef(role);
            const Icon = def.icon;
            return (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center font-mono text-[10px] text-white/60">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium flex items-center gap-2">
                      {p.name}
                      {showRoles && role && (
                        <span className={`px-1.5 py-0.5 border font-mono text-[9px] tracking-wider flex items-center gap-1 ${roleToneClasses(role)}`}>
                          <Icon className="w-3 h-3" />
                          {def.name}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-white/30">ID:{shortId(p.id)}</div>
                  </div>
                </div>
                {votes[p.id] && <span className="font-mono text-[10px] text-emerald-400 tracking-wider">VOTED</span>}
              </div>
            );
          })}
        </div>
      )}
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

function RoleSummary({ config }) {
  const cfg = normalizeConfig(config);
  return (
    <div className="border border-white/10 bg-white/[0.02] p-4 anim-fade-up">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] text-white/50 tracking-[0.25em]">ROLE_TABLE</span>
        <span className="font-mono text-[10px] text-cyan-300">{roleTotal(cfg)}/{cfg.totalPlayers}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(cfg.roles).filter(([, count]) => count > 0).map(([role, count]) => {
          const def = getRoleDef(role);
          const Icon = def.icon;
          return (
            <div key={role} className={`border px-3 py-2 flex items-center gap-2 ${roleToneClasses(role)}`}>
              <Icon className="w-3.5 h-3.5" />
              <span className="text-xs text-white/85 flex-1">{def.name}</span>
              <span className="font-mono text-xs">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Corner({ tone = "cyan", thick = false }) {
  const color = tone === "rose" ? "border-rose-500" : "border-cyan-400";
  const width = thick ? "border-t-2 border-l-2" : "border-t border-l";
  const widthR = thick ? "border-t-2 border-r-2" : "border-t border-r";
  const widthB = thick ? "border-b-2 border-l-2" : "border-b border-l";
  const widthBR = thick ? "border-b-2 border-r-2" : "border-b border-r";
  return (
    <>
      <div className={`absolute top-2 left-2 w-3 h-3 ${width} ${color}`} />
      <div className={`absolute top-2 right-2 w-3 h-3 ${widthR} ${color}`} />
      <div className={`absolute bottom-2 left-2 w-3 h-3 ${widthB} ${color}`} />
      <div className={`absolute bottom-2 right-2 w-3 h-3 ${widthBR} ${color}`} />
    </>
  );
}

// ===================== TEST LAB =====================
function TestLab({ onExit }) {
  const demoConfig = useMemo(
    () =>
      normalizeConfig({
        totalPlayers: 8,
        roundSeconds: 180,
        roles: { killer: 2, detective: 1, doctor: 1, bodyguard: 1, shaman: 1, spy: 0 },
      }),
    [],
  );
  const demoPlayers = useMemo(
    () => [
      { id: "p1", name: "마피아A", joinedAt: Date.now() - 4000 },
      { id: "p2", name: "마피아B", joinedAt: Date.now() - 12000 },
      { id: "p3", name: "경찰", joinedAt: Date.now() - 22000 },
      { id: "p4", name: "의사", joinedAt: Date.now() - 32000 },
      { id: "p5", name: "보디가드", joinedAt: Date.now() - 42000 },
      { id: "p6", name: "영매", joinedAt: Date.now() - 52000 },
      { id: "p7", name: "시민A", joinedAt: Date.now() - 62000 },
      { id: "p8", name: "시민B", joinedAt: Date.now() - 72000 },
    ],
    [],
  );
  const demoRoles = {
    p1: "killer",
    p2: "killer",
    p3: "detective",
    p4: "doctor",
    p5: "bodyguard",
    p6: "shaman",
    p7: "citizen",
    p8: "citizen",
  };
  const [view, setView] = useState("master");
  const [chat, setChat] = useState([
    { id: "c1", senderId: "p1", senderName: "마피아A", text: "경찰인 척은 아직 하지 말자.", timestamp: Date.now() - 40000 },
  ]);
  const [votes, setVotes] = useState({});
  const [testState, setTestState] = useState(() => {
    const now = Date.now();
    return { phase: "playing", round: 2, startedAt: now - 60000, roundStartedAt: now - 20000, roundEndsAt: now + 160000 };
  });
  const currentId = view === "master" ? "master" : view;
  const currentPlayer = demoPlayers.find((p) => p.id === currentId);

  const sendChat = (text) => {
    setChat((list) => [
      ...list,
      {
        id: genId(),
        senderId: currentId,
        senderName: view === "master" ? "마스터" : currentPlayer?.name || "테스트",
        isAdmin: view === "master",
        text,
        timestamp: Date.now(),
      },
    ]);
  };

  const restartTimer = () => {
    const now = Date.now();
    setTestState((prev) => ({ ...prev, roundStartedAt: now, roundEndsAt: now + demoConfig.roundSeconds * 1000, votingEndsAt: now + demoConfig.roundSeconds * 1000 }));
  };

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur px-3 py-3">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <button onClick={onExit} className="w-9 h-9 border border-white/10 flex items-center justify-center text-white/60">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 overflow-x-auto flex gap-2 scrollbar-thin">
            {[
              { id: "master", label: "마스터", role: "killer" },
              { id: "p1", label: "마피아", role: "killer" },
              { id: "p3", label: "경찰", role: "detective" },
              { id: "p4", label: "의사", role: "doctor" },
              { id: "p5", label: "보디가드", role: "bodyguard" },
              { id: "p6", label: "영매", role: "shaman" },
              { id: "p7", label: "시민", role: "citizen" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`px-3 py-2 border text-xs whitespace-nowrap ${view === item.id ? roleToneClasses(item.role) : "border-white/10 text-white/55 bg-white/[0.02]"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "master" ? (
        <AdminScreen
          myId="master"
          gameState={testState}
          gameConfig={demoConfig}
          players={demoPlayers}
          roles={demoRoles}
          chat={chat}
          votes={votes}
          onSaveConfig={() => {}}
          onStart={() => {}}
          onAdvance={() => setTestState((prev) => ({ ...prev, round: Math.min(TOTAL_ROUNDS, prev.round + 1) }))}
          onRestartTimer={restartTimer}
          onEndVoting={() => setTestState((prev) => ({ ...prev, phase: "results" }))}
          onReset={() => setTestState((prev) => ({ ...prev, phase: "lobby", round: 0 }))}
          onSendChat={sendChat}
          onLeave={onExit}
        />
      ) : (
        <PlayerScreen
          myId={currentId}
          myName={currentPlayer?.name || "테스트"}
          myRole={demoRoles[currentId]}
          gameState={testState}
          gameConfig={demoConfig}
          players={demoPlayers}
          roles={demoRoles}
          chat={chat}
          votes={votes}
          onSendChat={sendChat}
          onSubmitVote={(targets) => setVotes((prev) => ({ ...prev, [currentId]: targets }))}
          onLeave={onExit}
        />
      )}
    </div>
  );
}

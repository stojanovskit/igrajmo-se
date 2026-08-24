'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react';
import GameRoom, { GameInfo } from './GameRoom';

const games = [
  { name: 'Не лути се човече', icon: '●', color: 'coral', slug: 'ludo', tag: 'ИГРАЈ ОНЛАЈН', description: 'Трка со четири фигури, шестки, бркање и безбедна цел.' },
  { name: 'Меморија', icon: '✦', color: 'mint', slug: 'memory', tag: 'ИГРАЈ ОНЛАЈН', description: 'Отворај карти, памети ги симболите и собери повеќе парови.' },
  { name: 'Шах', icon: '♞', color: 'blue', slug: 'chess', description: 'Брз шах за двајца со сите класични фигури.' },
  { name: 'Домино', icon: '⠿', color: 'yellow', slug: 'domino', description: 'Спојувај исти броеви и прв остани без плочки.' },
  { name: 'Скицирка', icon: '✎', color: 'mint', slug: 'sketch', description: 'Еден црта таен македонски збор, другиот погодува.' },
  { name: 'Тарок', icon: '♜', color: 'coral', slug: 'tarok', description: 'Брза партија со девет карти, бои и моќни тароци.' },
  { name: 'Потопување бродови', icon: '≋', color: 'blue', slug: 'ships', description: 'Пронајди ја скриената флота на противникот.' },
  { name: 'Јамб', icon: '⚄', color: 'yellow', slug: 'yamb', description: 'Фрлај, задржувај коцки и пополни ја Јамб листата.' },
  { name: 'Жандар', icon: '♦', color: 'coral', slug: 'zandar', description: 'Собери ја масата со ист број или со Жандар.' },
  { name: 'Кугликс', icon: '⬡', color: 'mint', slug: 'kugliks', description: 'Кооперативна одбрана на шестоаголна мрежа.' },
];

type LiveStats = {
  onlineCount: number;
  activeRooms: number;
  gamesLast24Hours: number;
  playersByGame: Record<string, number>;
  roomsByGame: Record<string, number>;
  players: { nickname: string; game: string | null; joinRoomId: string | null; isSelf: boolean }[];
};

const playerColors = ['pink', 'blue', 'yellow', 'green'];

export default function Home() {
  const [dice, setDice] = useState(5);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [profileReady, setProfileReady] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const activeGame = selectedGame?.slug || null;

  useEffect(() => {
    setNickname(localStorage.getItem('igrajmo-nickname') || '');
    setProfileReady(true);
  }, []);

  useEffect(() => {
    if (!profileReady) return;

    let playerId = localStorage.getItem('igrajmo-player-id');
    if (!playerId) {
      playerId = crypto.randomUUID().replace(/-/g, '');
      localStorage.setItem('igrajmo-player-id', playerId);
    }

    let stopped = false;
    const applyStats = async (result: Response) => {
      if (!result.ok) return;
      const data = await result.json() as LiveStats;
      if (!stopped && typeof data.onlineCount === 'number') setLiveStats(data);
    };
    const heartbeat = async () => {
      try {
        const result = await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, nickname, game: activeGame, roomId: activeRoomId }),
          cache: 'no-store',
        });
        await applyStats(result);
      } catch {
        // Keep the page playable if the presence service is temporarily unavailable.
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void heartbeat();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void heartbeat();
    };

    void heartbeat();
    const heartbeatInterval = window.setInterval(() => void heartbeat(), 30_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      stopped = true;
      window.clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [profileReady, nickname, activeGame, activeRoomId]);

  useEffect(() => {
    if (!profileReady) return;
    const playerId = localStorage.getItem('igrajmo-player-id');
    if (!playerId) return;
    const leaveSite = () => {
      const data = new Blob([JSON.stringify({ playerId, offline: true })], { type: 'application/json' });
      navigator.sendBeacon('/api/presence', data);
    };
    window.addEventListener('pagehide', leaveSite);
    return () => window.removeEventListener('pagehide', leaveSite);
  }, [profileReady]);

  function chooseGame(game: (typeof games)[number]) {
    setJoinRoomCode('');
    setSelectedGame(game);
  }

  function joinPlayer(player: LiveStats['players'][number]) {
    const game = games.find((candidate) => candidate.slug === player.game);
    if (!game || !player.joinRoomId) return;
    setJoinRoomCode(player.joinRoomId);
    setSelectedGame(game);
  }

  function closeGame() {
    setSelectedGame(null);
    setJoinRoomCode('');
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Играјмо — почетна">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>ИГРАЈМО<span>.СЕ</span></span>
        </a>
        <nav className="main-nav" aria-label="Главна навигација">
          <a className="active" href="#games">Игри</a>
          <a href="#rooms">Соби</a>
          <a href="#players">Играчи</a>
        </nav>
        <div className="header-actions">
          <div className="online-pill" aria-live="polite"><span /> {liveStats?.onlineCount ?? '…'} онлајн</div>
          <button className="login-button" onClick={() => setProfileOpen(true)}>{nickname || 'Играј како гостин'}</button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span>Н</span> НОВО ПОГЛАВЈЕ НА СТАРАТА ДРУЖБА</div>
          <h1>Врати се во игра.<br /><em>Друштвото е тука.</em></h1>
          <p>Омилените друштвени игри се повторно на едно место — на македонски, бесплатно и со вистински противници.</p>
          <div className="hero-buttons">
            <a className="primary-button" href="#games">Избери игра <b>→</b></a>
            <button className="text-button button-reset" onClick={() => chooseGame(games[0])}><span>▶</span> Најди противник</button>
          </div>
          <div className="trust-row">
            <span><b>✓</b> Без преземање</span><span><b>✓</b> Играј како гостин</span><span><b>✓</b> 100% бесплатно</span>
          </div>
        </div>

        <div className="live-table" id="rooms">
          <div className="table-window">
            <div className="window-head"><div className="window-title">ДЕМО ТАБЛА</div><span>ПРИМЕР · НЕ ЛУТИ СЕ ЧОВЕЧЕ</span></div>
            <div className="ludo-board" aria-label="Демо на играта Не лути се човече">
              <div className="home red-home"><i /><i /><i /><i /></div><div className="home blue-home"><i /><i /><i /><i /></div>
              <div className="home yellow-home"><i /><i /><i /><i /></div><div className="home green-home"><i /><i /><i /><i /></div>
              <div className="board-cross horizontal" /><div className="board-cross vertical" />
              <div className="board-center"><span /><span /><span /><span /></div>
              <div className="token token-red">1</div><div className="token token-blue">2</div>
              <button className="dice" onClick={() => setDice(Math.floor(Math.random() * 6) + 1)} aria-label="Фрли ја коцката">{['⚀','⚁','⚂','⚃','⚄','⚅'][dice - 1]}</button>
            </div>
            <div className="game-footer">
              <div className="turn-player"><span className="avatar avatar-red">1</span><p><b>Гостин 1</b><small>Демо потег</small></p></div>
              <div className="mini-players"><span className="avatar avatar-blue">2</span></div>
              <button onClick={() => chooseGame(games[0])}>Отвори ја играта</button>
            </div>
          </div>
          <div className="floating-chat"><span className="avatar avatar-blue">2</span><p><b>Демо порака</b><br />Ајде, фрлај! 🎲</p></div>
        </div>
      </section>

      <section className="games-section" id="games">
        <div className="section-heading"><div><span className="section-kicker">ОРИГИНАЛНАТА КОЛЕКЦИЈА</span><h2>Што ќе играме денес?</h2></div><span className="verified-note">10 пронајдени игри</span></div>
        <div className="game-grid" id="all-games">
          {games.map((game) => (
            <article className={`game-card ${game.color}`} key={game.name}>
              {game.tag && <span className={`popular ${game.slug === 'memory' ? 'playable' : ''}`}>{game.tag}</span>}
              <div className="game-icon" aria-hidden="true">{game.icon}</div><h3>{game.name}</h3>
              <p><span className="pulse-dot" /> {liveStats ? (liveStats.playersByGame[game.slug] || 0) : '…'} онлајн · {liveStats ? (liveStats.roomsByGame[game.slug] || 0) : '…'} активни соби</p>
              <button onClick={() => chooseGame(game)}>Играј онлајн <b>→</b></button>
            </article>
          ))}
        </div>
      </section>

      <section className="community" id="players">
        <div className="community-copy"><span className="section-kicker">НИКОГАШ НЕ СИ САМ</span><h2>Стара игра.<br />Нови пријателства.</h2><p>Влези во соба, поздрави го друштвото и почни партија. Баш како некогаш — само побрзо и поубаво.</p><div className="stat-row"><div><b>{liveStats?.onlineCount ?? '…'}</b><span>онлајн сега</span></div><div><b>{liveStats?.activeRooms ?? '…'}</b><span>активни соби сега</span></div><div><b>{liveStats?.gamesLast24Hours ?? '…'}</b><span>завршени · 24 ч.</span></div></div></div>
        <div className="player-list">
          <div className="player-list-head"><b>Кој е онлајн?</b><span><i /> {liveStats?.onlineCount ?? '…'} активни</span></div>
          {liveStats?.players.length ? liveStats.players.map((player, index) => {
            const gameName = games.find((game) => game.slug === player.game)?.name;
            return <div className="player-row" key={`${player.nickname}-${index}`}>
              <span className={`avatar ${playerColors[index % playerColors.length]}`}>{player.nickname[0]?.toUpperCase() || '?'}</span>
              <p><b>{player.nickname}</b><small>{gameName ? `активен во ${gameName}` : 'на почетната страница'}</small></p>
              {player.isSelf ? <span className="player-live-label">ти</span> : gameName ? <button className="player-join-button" disabled={!player.joinRoomId} onClick={() => joinPlayer(player)}>{player.joinRoomId ? 'Влези во игра' : 'Нема слободна соба'}</button> : <span className="player-live-label">сега</span>}
            </div>;
          }) : <div className="player-row empty-player"><p><b>{liveStats ? 'Нема активни гости.' : 'Ги вчитуваме активните гости…'}</b><small>Листата се обновува автоматски.</small></p></div>}
        </div>
      </section>

      <footer><a className="brand" href="#top"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span>ИГРАЈМО<span>.СЕ</span></span></a><p>Направено со љубов за старото друштво. · Македонско издание 2026</p></footer>

      {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Затвори">×</button></div>}
      {profileOpen && <ProfileModal nickname={nickname} onClose={() => setProfileOpen(false)} onSave={(name) => { localStorage.setItem('igrajmo-nickname', name); setNickname(name); setProfileOpen(false); }} />}
      {selectedGame && <GameRoom game={selectedGame} initialRoomCode={joinRoomCode} savedNickname={nickname} onSaveNickname={(name) => { localStorage.setItem('igrajmo-nickname', name); setNickname(name); }} onRoomActivity={setActiveRoomId} onClose={closeGame} />}
    </main>
  );
}

function ProfileModal({ nickname, onSave, onClose }: { nickname: string; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(nickname);
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Профил"><div className="small-modal"><button className="modal-close" onClick={onClose}>×</button><span className="modal-icon">☺</span><h2>Како да те викаме?</h2><p>Не ти треба сметка. Избери прекар и влези во игра.</p><form onSubmit={(event) => { event.preventDefault(); if (name.trim()) onSave(name.trim().slice(0, 20)); }}><label>Твој прекар<input autoFocus value={name} maxLength={20} onChange={(event) => setName(event.target.value)} placeholder="на пр. Skopje_87" /></label><button className="modal-primary" type="submit">Зачувај прекар</button></form></div></div>;
}

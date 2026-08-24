'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react';
import GameRoom, { GameInfo } from './GameRoom';

const games = [
  { name: 'Не лути се човече', icon: '●', color: 'coral', players: 184, rooms: 26, slug: 'ludo', tag: 'НАЈПОПУЛАРНО', description: 'Трка со четири фигури, шестки, бркање и безбедна цел.' },
  { name: 'Меморија', icon: '✦', color: 'mint', players: 43, rooms: 8, slug: 'memory', tag: 'ИГРАЈ ОНЛАЈН', description: 'Отворај карти, памети ги симболите и собери повеќе парови.' },
  { name: 'Шах', icon: '♞', color: 'blue', players: 96, rooms: 14, slug: 'chess', description: 'Брз шах за двајца со сите класични фигури.' },
  { name: 'Домино', icon: '⠿', color: 'yellow', players: 72, rooms: 11, slug: 'domino', description: 'Спојувај исти броеви и прв остани без плочки.' },
  { name: 'Скицирка', icon: '✎', color: 'mint', players: 61, rooms: 9, slug: 'sketch', description: 'Еден црта таен македонски збор, другиот погодува.' },
  { name: 'Тарок', icon: '♜', color: 'coral', players: 52, rooms: 7, slug: 'tarok', description: 'Брза партија со девет карти, бои и моќни тароци.' },
  { name: 'Потопување бродови', icon: '≋', color: 'blue', players: 38, rooms: 6, slug: 'ships', description: 'Пронајди ја скриената флота на противникот.' },
  { name: 'Јамб', icon: '⚄', color: 'yellow', players: 34, rooms: 5, slug: 'yamb', description: 'Фрлај, задржувај коцки и пополни ја Јамб листата.' },
  { name: 'Жандар', icon: '♦', color: 'coral', players: 27, rooms: 4, slug: 'zandar', description: 'Собери ја масата со ист број или со Жандар.' },
  { name: 'Кугликс', icon: '⬡', color: 'mint', players: 19, rooms: 3, slug: 'kugliks', description: 'Кооперативна одбрана на шестоаголна мрежа.' },
];

const players = [
  { name: 'Elena_88', game: 'игра Шах', initials: 'Е', color: 'pink' },
  { name: 'BojanMK', game: 'во соба „Скопје“', initials: 'Б', color: 'blue' },
  { name: 'Mila', game: 'бара противник', initials: 'М', color: 'yellow' },
  { name: 'Goran79', game: 'игра Домино', initials: 'Г', color: 'green' },
];

export default function Home() {
  const [dice, setDice] = useState(5);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => setNickname(localStorage.getItem('igrajmo-nickname') || ''), []);

  useEffect(() => {
    let playerId = localStorage.getItem('igrajmo-player-id');
    if (!playerId) {
      playerId = crypto.randomUUID().replace(/-/g, '');
      localStorage.setItem('igrajmo-player-id', playerId);
    }

    let stopped = false;
    const heartbeat = async () => {
      try {
        const result = await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId }),
          cache: 'no-store',
        });
        if (!result.ok) return;
        const data = await result.json() as { count?: number };
        if (!stopped && typeof data.count === 'number') setOnlineCount(data.count);
      } catch {
        // Keep the page playable if the presence service is temporarily unavailable.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void heartbeat();
    };

    void heartbeat();
    const interval = window.setInterval(() => void heartbeat(), 45_000);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  function chooseGame(game: (typeof games)[number]) {
    setSelectedGame(game);
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
          <div className="online-pill" aria-live="polite"><span /> {onlineCount === null ? '…' : onlineCount} онлајн</div>
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
            <button className="text-button button-reset" onClick={() => setSelectedGame(games[0])}><span>▶</span> Најди противник</button>
          </div>
          <div className="trust-row">
            <span><b>✓</b> Без преземање</span><span><b>✓</b> Играј како гостин</span><span><b>✓</b> 100% бесплатно</span>
          </div>
        </div>

        <div className="live-table" id="rooms">
          <div className="table-window">
            <div className="window-head"><div className="window-title"><span className="pulse-dot" /> Соба во живо</div><span>#2841 · СКОПЈЕ</span></div>
            <div className="ludo-board" aria-label="Демо на играта Не лути се човече">
              <div className="home red-home"><i /><i /><i /><i /></div><div className="home blue-home"><i /><i /><i /><i /></div>
              <div className="home yellow-home"><i /><i /><i /><i /></div><div className="home green-home"><i /><i /><i /><i /></div>
              <div className="board-cross horizontal" /><div className="board-cross vertical" />
              <div className="board-center"><span /><span /><span /><span /></div>
              <div className="token token-red">Е</div><div className="token token-blue">Б</div>
              <button className="dice" onClick={() => setDice(Math.floor(Math.random() * 6) + 1)} aria-label="Фрли ја коцката">{['⚀','⚁','⚂','⚃','⚄','⚅'][dice - 1]}</button>
            </div>
            <div className="game-footer">
              <div className="turn-player"><span className="avatar avatar-red">Е</span><p><b>Elena_88</b><small>На потег е...</small></p></div>
              <div className="mini-players"><span className="avatar avatar-blue">Б</span><span className="avatar avatar-yellow">М</span><span className="avatar avatar-green">Г</span></div>
              <button onClick={() => setSelectedGame(games[0])}>Играј во живо</button>
            </div>
          </div>
          <div className="floating-chat"><span className="avatar avatar-blue">Б</span><p><b>BojanMK</b><br />Ајде, фрлај! 🎲</p></div>
        </div>
      </section>

      <section className="games-section" id="games">
        <div className="section-heading"><div><span className="section-kicker">ОРИГИНАЛНАТА КОЛЕКЦИЈА</span><h2>Што ќе играме денес?</h2></div><span className="verified-note">10 пронајдени игри</span></div>
        <div className="game-grid" id="all-games">
          {games.map((game) => (
            <article className={`game-card ${game.color}`} key={game.name}>
              {game.tag && <span className={`popular ${game.slug === 'memory' ? 'playable' : ''}`}>{game.tag}</span>}
              <div className="game-icon" aria-hidden="true">{game.icon}</div><h3>{game.name}</h3>
              <p><span className="pulse-dot" /> {game.players} играчи · {game.rooms} соби</p>
              <button onClick={() => chooseGame(game)}>Играј онлајн <b>→</b></button>
            </article>
          ))}
        </div>
      </section>

      <section className="community" id="players">
        <div className="community-copy"><span className="section-kicker">НИКОГАШ НЕ СИ САМ</span><h2>Стара игра.<br />Нови пријателства.</h2><p>Влези во соба, поздрави го друштвото и почни партија. Баш како некогаш — само побрзо и поубаво.</p><div className="stat-row"><div><b>{onlineCount === null ? '…' : onlineCount}</b><span>играчи сега</span></div><div><b>83</b><span>активни соби</span></div><div><b>12K+</b><span>партии денес</span></div></div></div>
        <div className="player-list"><div className="player-list-head"><b>Кој е онлајн?</b><span><i /> Во живо</span></div>{players.map((player) => <div className="player-row" key={player.name}><span className={`avatar ${player.color}`}>{player.initials}</span><p><b>{player.name}</b><small>{player.game}</small></p><button onClick={() => setSelectedGame(games[0])}>Играј</button></div>)}</div>
      </section>

      <footer><a className="brand" href="#top"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span>ИГРАЈМО<span>.СЕ</span></span></a><p>Направено со љубов за старото друштво. · Македонско издание 2026</p></footer>

      {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Затвори">×</button></div>}
      {profileOpen && <ProfileModal nickname={nickname} onClose={() => setProfileOpen(false)} onSave={(name) => { localStorage.setItem('igrajmo-nickname', name); setNickname(name); setProfileOpen(false); }} />}
      {selectedGame && <GameRoom game={selectedGame} savedNickname={nickname} onSaveNickname={(name) => { localStorage.setItem('igrajmo-nickname', name); setNickname(name); }} onClose={() => setSelectedGame(null)} />}
    </main>
  );
}

function ProfileModal({ nickname, onSave, onClose }: { nickname: string; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(nickname);
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Профил"><div className="small-modal"><button className="modal-close" onClick={onClose}>×</button><span className="modal-icon">☺</span><h2>Како да те викаме?</h2><p>Не ти треба сметка. Избери прекар и влези во игра.</p><form onSubmit={(event) => { event.preventDefault(); if (name.trim()) onSave(name.trim().slice(0, 20)); }}><label>Твој прекар<input autoFocus value={name} maxLength={20} onChange={(event) => setName(event.target.value)} placeholder="на пр. Skopje_87" /></label><button className="modal-primary" type="submit">Зачувај прекар</button></form></div></div>;
}


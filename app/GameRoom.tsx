'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { FormEvent, PointerEvent, useEffect, useRef, useState } from 'react';

export type GameInfo = { name: string; icon: string; slug: string; description: string };
type Room = { id: string; game: string; host_id: string; host_name: string; guest_id: string | null; guest_name: string | null; turn_id: string; status: 'waiting'|'playing'|'finished'; state: any };
type SendAction = (action: string, payload?: Record<string, unknown>) => Promise<void>;

const memorySymbols = ['♞','⚄','♦','✦','●','✎'];
const diceFaces = ['⚀','⚁','⚂','⚃','⚄','⚅'];
const chessPieces: Record<string,string> = { wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟' };
const yambCategories = [['1','Единици'],['2','Двојки'],['3','Тројки'],['4','Четворки'],['5','Петки'],['6','Шестки'],['three','Три исти'],['straight','Кента'],['full','Фул'],['poker','Покер'],['yamb','Јамб']];

export default function GameRoom({ game, savedNickname, onSaveNickname, onClose }: { game: GameInfo; savedNickname: string; onSaveNickname: (name:string)=>void; onClose:()=>void }) {
  const [nickname,setNickname] = useState(savedNickname);
  const [roomCode,setRoomCode] = useState('');
  const [playerId,setPlayerId] = useState('');
  const [room,setRoom] = useState<Room|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const activeRoomId = room?.id;
  const activeRoomStatus = room?.status;

  useEffect(() => { let id = localStorage.getItem('igrajmo-player-id'); if (!id) { id = crypto.randomUUID().replace(/-/g,''); localStorage.setItem('igrajmo-player-id',id); } setPlayerId(id); }, []);
  useEffect(() => {
    if (!activeRoomId || activeRoomStatus === 'finished') return;
    const timer = setInterval(async () => { try { const response = await fetch(`/api/rooms?id=${activeRoomId}&playerId=${playerId}`,{cache:'no-store'}); if (response.ok) setRoom(await response.json()); } catch {} }, 900);
    return () => clearInterval(timer);
  },[activeRoomId,activeRoomStatus,playerId]);

  async function send(body: Record<string,unknown>) {
    setBusy(true); setError('');
    try { const response = await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,playerId,nickname})}); const data = await response.json() as Room & { error?: string }; if (!response.ok) throw new Error(data.error || 'Нешто не е во ред.'); setRoom(data); onSaveNickname(nickname.trim()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Обиди се повторно.'); }
    finally { setBusy(false); }
  }
  async function start(event: FormEvent) { event.preventDefault(); if (!nickname.trim()) return setError('Внеси прекар за да почнеш.'); await send({type:roomCode.trim()?'join':'matchmake',game:game.slug,roomId:roomCode.trim()}); }
  const action: SendAction = async (name,payload={}) => send({type:'action',roomId:room?.id,action:name,payload});
  const opponent = room ? (room.host_id===playerId ? room.guest_id : room.host_id) : '';

  return <div className="modal-layer game-modal-layer" role="dialog" aria-modal="true" aria-label={`${game.name} во живо`}><div className="memory-modal all-games-modal"><button className="modal-close" onClick={onClose}>×</button>
    {!room ? <div className="matchmaker"><span className="modal-icon">{game.icon}</span><span className="section-kicker">ИГРА ВО ЖИВО · БЕЗ СМЕТКА</span><h2>{game.name} за двајца</h2><p>{game.description} Ќе те споиме со слободен играч или внеси код од пријател.</p><form onSubmit={start}><label>Твој прекар<input autoFocus value={nickname} maxLength={20} onChange={(e)=>setNickname(e.target.value)} placeholder="Твој прекар" /></label><label>Код на соба <small>(по избор)</small><input value={roomCode} maxLength={6} onChange={(e)=>setRoomCode(e.target.value.toUpperCase())} placeholder="На пр. A8F2K1" /></label>{error&&<p className="form-error">{error}</p>}<button className="modal-primary" disabled={busy||!playerId}>{busy?'Бараме…':roomCode?'Влези во собата':'Најди противник'}</button></form></div>
    : <div className="room-game"><div className="memory-head"><div><span className="section-kicker">{game.name.toUpperCase()} · СОБА {room.id}</span><h2>{room.state.message}</h2></div><button className="copy-code" onClick={()=>navigator.clipboard?.writeText(room.id)}>Копирај код</button></div>
      <Players room={room} playerId={playerId} />
      {room.status==='waiting' ? <div className="waiting-room"><span>{game.icon}</span><h3>Собата е подготвена</h3><p>Испрати го кодот <b>{room.id}</b> на пријател. Може да влезе без сметка.</p></div> : <GameBoard game={game.slug} room={room} playerId={playerId} opponent={opponent||''} busy={busy} action={action} />}
      {error&&<p className="form-error center-error">{error}</p>}
      <div className="game-status"><span className="pulse-dot" />{room.status==='waiting'?'Се чека втор играч…':room.status==='finished'?'Партијата заврши.':room.turn_id===playerId?'Ти си на ред.':'Противникот е на ред.'}</div>
      {room.status==='finished'&&<button className="modal-primary play-again" onClick={()=>setRoom(null)}>Нова партија</button>}
    </div>}
  </div></div>;
}

function Players({room,playerId}:{room:Room;playerId:string}) {
  return <div className="scoreboard"><div className={room.turn_id===room.host_id?'current':''}><span className="avatar avatar-red">{room.host_name[0]}</span><p><b>{room.host_name}{room.host_id===playerId?' (ти)':''}</b><small>домаќин</small></p></div><span className="versus">VS</span><div className={room.guest_id&&room.turn_id===room.guest_id?'current':''}><span className="avatar avatar-blue">{room.guest_name?.[0]||'?'}</span><p><b>{room.guest_name||'Се чека…'}{room.guest_id===playerId?' (ти)':''}</b><small>гостин</small></p></div></div>;
}

function GameBoard(props:{game:string;room:Room;playerId:string;opponent:string;busy:boolean;action:SendAction}) {
  const {game}=props;
  if (game==='memory') return <MemoryBoard {...props}/>;
  if (game==='ludo') return <LudoBoard {...props}/>;
  if (game==='chess') return <ChessBoard {...props}/>;
  if (game==='domino') return <DominoBoard {...props}/>;
  if (game==='sketch') return <SketchBoard {...props}/>;
  if (game==='tarok') return <TarokBoard {...props}/>;
  if (game==='ships') return <ShipsBoard {...props}/>;
  if (game==='yamb') return <YambBoard {...props}/>;
  if (game==='zandar') return <ZandarBoard {...props}/>;
  return <KugliksBoard {...props}/>;
}

function MemoryBoard({room,playerId,busy,action}:any) { return <div className={`memory-board ${room.turn_id!==playerId?'not-my-turn':''}`}>{room.state.deck.map((symbol:number,index:number)=>{const open=room.state.flipped.includes(index)||room.state.matched.includes(index);return <button key={index} className={`${open?'open':''} ${room.state.matched.includes(index)?'matched':''}`} disabled={!open&&(room.turn_id!==playerId||busy)} onClick={()=>action('flip',{index})}><span>{open?memorySymbols[symbol]:'?'}</span></button>;})}</div>; }

function LudoBoard({room,playerId,busy,action}:any) {
  const mine=room.state.positions[playerId]||[], theirs=room.state.positions[room.host_id===playerId?room.guest_id:room.host_id]||[];
  return <div className="compact-game ludo-live"><div className="ludo-track">{Array.from({length:29},(_,i)=><span key={i} className={i===28?'finish':''}>{mine.map((p:number,n:number)=>p===i?<i key={`m${n}`} className="pawn mine">{n+1}</i>:null)}{theirs.map((p:number,n:number)=>p===i?<i key={`t${n}`} className="pawn theirs">{n+1}</i>:null)}<small>{i===28?'⌂':i+1}</small></span>)}</div><div className="piece-row">{mine.map((place:number,index:number)=><button key={index} disabled={busy||room.turn_id!==playerId||!room.state.dice} onClick={()=>action('move',{index})}>● {place<0?'дома':place===28?'цел':`поле ${place+1}`}</button>)}</div><button className="big-dice" disabled={busy||room.turn_id!==playerId||room.state.dice} onClick={()=>action('roll')}>{room.state.dice?diceFaces[room.state.dice-1]:'Фрли коцка'}</button></div>;
}

function ChessBoard({room,playerId,busy,action}:any) {
  const [selected,setSelected]=useState<number|null>(null); const myColor=playerId===room.host_id?'w':'b'; const indexes=playerId===room.host_id?Array.from({length:64},(_,i)=>i):Array.from({length:64},(_,i)=>63-i);
  function click(index:number){if(room.turn_id!==playerId||busy)return;if(selected===null){if(room.state.board[index]?.[0]===myColor)setSelected(index);}else{action('move',{from:selected,to:index});setSelected(null);}}
  return <div className="chess-shell"><div className="chess-board">{indexes.map((index)=><button key={index} className={`${(Math.floor(index/8)+index%8)%2?'dark':'light'} ${selected===index?'selected':''}`} onClick={()=>click(index)}>{chessPieces[room.state.board[index]]||''}</button>)}</div><p className="rules-note">Брз шах: важат движењата на фигурите; пешакот се претвора во дама. Победува освоениот крал.</p></div>;
}

function DominoBoard({room,playerId,busy,action}:any){const hand=room.state.hands[playerId]||[];return <div className="compact-game"><div className="domino-chain">{room.state.chain.length?room.state.chain.map((tile:number[],i:number)=><span key={i}>{tile[0]}│{tile[1]}</span>):<em>Постави ја првата плочка</em>}</div><div className="card-hand domino-hand">{hand.map((tile:number[],i:number)=><div key={i}><button disabled={busy||room.turn_id!==playerId} onClick={()=>action('place',{index:i,side:'left'})}>←</button><span>{tile[0]}│{tile[1]}</span><button disabled={busy||room.turn_id!==playerId} onClick={()=>action('place',{index:i,side:'right'})}>→</button></div>)}</div><div className="action-row"><button disabled={busy||room.turn_id!==playerId||!room.state.bag.length} onClick={()=>action('draw')}>Извлечи ({room.state.bag.length})</button><button disabled={busy||room.turn_id!==playerId||!!room.state.bag.length} onClick={()=>action('pass')}>Прескокни</button></div></div>}

function SketchBoard({room,playerId,busy,action}:any){const [guess,setGuess]=useState('');const [draft,setDraft]=useState<number[]>([]);const drawing=useRef(false);const isDrawer=room.state.drawerId===playerId;function point(e:PointerEvent<SVGSVGElement>){const box=e.currentTarget.getBoundingClientRect();return [Math.round((e.clientX-box.left)/box.width*1000),Math.round((e.clientY-box.top)/box.height*650)];}function down(e:PointerEvent<SVGSVGElement>){if(!isDrawer)return;drawing.current=true;setDraft(point(e));e.currentTarget.setPointerCapture(e.pointerId)}function move(e:PointerEvent<SVGSVGElement>){if(drawing.current)setDraft((old)=>[...old,...point(e)].slice(0,160))}function up(){if(drawing.current&&draft.length>3)action('stroke',{points:draft,color:'#19324a'});drawing.current=false;setDraft([])}const lines=[...room.state.strokes.map((s:any)=>s.points),draft].filter((p:number[])=>p.length>3);return <div className="compact-game sketch-game"><div className="word-strip">{isDrawer?<>Нацртај: <b>{room.state.word}</b></>:<>Погоди го зборот</>}</div><svg viewBox="0 0 1000 650" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>{lines.map((points:number[],i:number)=><polyline key={i} points={Array.from({length:points.length/2},(_,n)=>`${points[n*2]},${points[n*2+1]}`).join(' ')} fill="none" stroke="#19324a" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>)}</svg>{isDrawer?<button disabled={busy} onClick={()=>action('clear')}>Избриши ја скицата</button>:<form className="guess-form" onSubmit={(e)=>{e.preventDefault();if(guess.trim()){action('guess',{text:guess});setGuess('')}}}><input value={guess} onChange={(e)=>setGuess(e.target.value)} placeholder="Твојот одговор…"/><button disabled={busy}>Погоди</button></form>}</div>}

function TarokBoard({room,playerId,busy,action}:any){const hand=room.state.hands[playerId]||[];return <div className="compact-game"><div className="trick-area">{room.state.trick.length?room.state.trick.map((item:any,i:number)=><span key={i} className={item.card.endsWith('♥')||item.card.endsWith('♦')?'red-card':''}>{item.card}</span>):<em>Отвори рака</em>}</div><div className="card-hand">{hand.map((card:string,i:number)=><button key={i} className={card.endsWith('♥')||card.endsWith('♦')?'red-card':''} disabled={busy||room.turn_id!==playerId} onClick={()=>action('play',{index:i})}>{card}</button>)}</div><p className="rules-note">Мини тарок: следи ја отворената боја; тарокот T сече, а повисокиот број победува.</p></div>}

function ShipsBoard({room,playerId,busy,action}:any){const opponent=room.host_id===playerId?room.guest_id:room.host_id;const myFleet=room.state.fleets[playerId]||[],theirShots=room.state.shots[opponent]||[],myShots=room.state.shots[playerId]||[];return <div className="ships-wrap"><Sea title="Моја флота" fleet={myFleet} shots={theirShots}/><Sea title="Противничко море" fleet={[]} shots={myShots} target disabled={busy||room.turn_id!==playerId} onShoot={(cell)=>action('shoot',{cell})}/></div>}
function Sea({title,fleet,shots,target,disabled,onShoot}:{title:string;fleet:number[];shots:number[];target?:boolean;disabled?:boolean;onShoot?:(cell:number)=>void}){return <div><h4>{title}</h4><div className="sea-grid">{Array.from({length:64},(_,cell)=>{const ship=fleet.includes(cell),shot=shots.includes(cell);return <button key={cell} disabled={!target||disabled||shot} className={`${ship?'ship':''} ${shot?(ship?'hit':'miss'):''}`} onClick={()=>onShoot?.(cell)}>{shot?(ship?'×':'·'):ship?'■':''}</button>})}</div></div>}

function YambBoard({room,playerId,busy,action}:any){const mine=room.state.sheets[playerId]||{},opponent=room.host_id===playerId?room.guest_id:room.host_id,theirs=room.state.sheets[opponent]||{};const total=(sheet:any)=>Object.values(sheet).reduce((a:number,b:any)=>a+Number(b),0);return <div className="yamb-wrap"><div className="dice-row">{room.state.dice.map((die:number,i:number)=><button key={i} className={room.state.held[i]?'held':''} disabled={busy||room.turn_id!==playerId||!room.state.rolls} onClick={()=>action('hold',{index:i})}>{diceFaces[die-1]}</button>)}</div><button className="roll-button" disabled={busy||room.turn_id!==playerId||room.state.rolls>=3} onClick={()=>action('roll')}>Фрли · {room.state.rolls}/3</button><div className="score-sheet"><b>Поле</b><b>Ти</b><b>Противник</b>{yambCategories.map(([key,label])=><div className="score-row" key={key}><span>{label}</span><button disabled={busy||room.turn_id!==playerId||!room.state.rolls||mine[key]!==undefined} onClick={()=>action('score',{category:key})}>{mine[key]??'запиши'}</button><span>{theirs[key]??'—'}</span></div>)}<div className="score-row total"><span>Вкупно</span><b>{total(mine)}</b><b>{total(theirs)}</b></div></div></div>}

function ZandarBoard({room,playerId,busy,action}:any){const hand=room.state.hands[playerId]||[],captured=room.state.captured[playerId]?.length||0;return <div className="compact-game"><div className="zandar-table"><small>МАСА · {room.state.table.length} КАРТИ</small><span className={room.state.table.at(-1)?.match(/[♥♦]/)?'red-card':''}>{room.state.table.at(-1)||'—'}</span></div><div className="card-hand">{hand.map((card:string,i:number)=><button key={i} className={card.match(/[♥♦]/)?'red-card':''} disabled={busy||room.turn_id!==playerId} onClick={()=>action('play',{index:i})}>{card}</button>)}</div><p className="rules-note">Собрани карти: {captured}. Собери ја масата со ист број или со Жандар (J).</p></div>}

function KugliksBoard({room,playerId,busy,action}:any){return <div className="kugliks-game"><div className="defense-stats"><span>♥ {room.state.health}</span><span>Бран {room.state.wave}</span><span>Одбрани {room.state.score}/18</span></div><div className="hex-grid">{room.state.threats.map((threat:number,i:number)=><button key={i} disabled={busy||room.turn_id!==playerId} className={`threat-${Math.min(threat,3)}`} onClick={()=>action('defend',{cell:i})}>{i===9?'⌂':threat?'●'.repeat(threat):'·'}</button>)}</div><p className="rules-note">Кооперативна одбрана: наизменично смирувајте ги заканите на работ. Ако поле надмине 3, градот губи живот.</p></div>}


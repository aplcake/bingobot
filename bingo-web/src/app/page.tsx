'use client';
import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const KEY = process.env.NEXT_PUBLIC_API_KEY || 'changeme';
const H: Record<string,string> = { 'Content-Type': 'application/json', 'x-api-key': KEY };
type Game = { id:string; name:string; status:string; winCondition:string; mode:string; roleConfig:Record<string,number>; players:Record<string,any>; calledNumbers:any[]; winners:any[]; channelId:string|null; guildId:string|null; messageId:string|null; createdAt:string; lastCalledItem?:any; itemPool?:string[]; endedAt?:string; };
type GS = { id:string; name:string; status:string; mode:string; playerCount:number; calledCount:number; totalItems:number; winCondition:string; winnerCount:number; winners:any[]; createdAt:string; };
type Guild = { id:string; name:string; channels:{id:string;name:string}[] };
type Role = { id:string; name:string; color:string; memberCount:number };
const WINS = [{value:'line',label:'Line (row/col/diagonal)'},{value:'blackout',label:'Blackout (full card)'},{value:'four_corners',label:'Four Corners'},{value:'x_pattern',label:'X Pattern'},{value:'plus',label:'Plus (+)'}];
const CC:Record<string,string> = {B:'#ff6b35',I:'#00e5ff',N:'#00ff88',G:'#ffd700',O:'#ff3366'};
function ltr(n:number){if(n<=15)return'B';if(n<=30)return'I';if(n<=45)return'N';if(n<=60)return'G';return'O';}
function ntc(n:any){if(typeof n==='string')return n;return`${ltr(n)}${n}`;}
function ago(d:string){const m=Math.floor((Date.now()-new Date(d).getTime())/60000);if(m<1)return'just now';if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`;}

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '0000';

export default function AdminPage(){
  // ALL hooks must be at the top, before any early return
  const [authed,setAuthed]=useState(false);const[pin,setPin]=useState('');const[pinErr,setPinErr]=useState(false);
  const [games,setGames]=useState<GS[]>([]);const[ag,setAg]=useState<Game|null>(null);const[guilds,setGuilds]=useState<Guild[]>([]);const[roles,setRoles]=useState<Role[]>([]);
  const[conn,setConn]=useState(false);const[view,setView]=useState<'list'|'create'|'manage'|'history'>('list');
  const[nn,setNn]=useState('');const[nw,setNw]=useState('line');const[nm,setNm]=useState<'classic'|'custom'>('classic');const[ni,setNi]=useState('');
  const[sg,setSg]=useState('');const[sc,setSc]=useState('');const[ri,setRi]=useState('');const[rc,setRc]=useState('1');
  const[jc,setJc]=useState<any>(null);const[ld,setLd]=useState(false);const[hg,setHg]=useState<Game|null>(null);
  const[streaks,setStreaks]=useState<any[]>([]);
  const[pingRole,setPingRole]=useState<string>('');
  const[pingRoleSaved,setPingRoleSaved]=useState(false);

  const fg=useCallback(async()=>{try{const r=await fetch(`${API}/api/games`,{headers:H});if(r.ok){setGames(await r.json());setConn(true);}}catch{setConn(false);}},[]);
  const fgi=useCallback(async(id:string)=>{try{const r=await fetch(`${API}/api/games/${id}`,{headers:H});if(r.ok)setAg(await r.json());}catch{}},[]);
  const fgu=useCallback(async()=>{try{const r=await fetch(`${API}/api/guilds`,{headers:H});if(r.ok)setGuilds(await r.json());}catch{}},[]);
  const fr=useCallback(async(gid:string)=>{try{const r=await fetch(`${API}/api/guilds/${gid}/roles`,{headers:H});if(r.ok)setRoles(await r.json());}catch{}},[]);
  const fst=useCallback(async()=>{try{const r=await fetch(`${API}/api/players/streaks`,{headers:H});if(r.ok)setStreaks(await r.json());}catch{}},[]);

  useEffect(()=>{if(typeof window!=='undefined'&&sessionStorage.getItem('bingo_auth')==='1')setAuthed(true);},[]);
  useEffect(()=>{if(authed){fg();fgu();fst();
    fetch(`${API}/api/defaults/pingrole`,{headers:H}).then(r=>r.json()).then(d=>{if(d.pingRoleId)setPingRole(d.pingRoleId);}).catch(()=>{});
  }},[fg,fgu,fst,authed]);
  useEffect(()=>{if(!ag||ag.status==='ended')return;const i=setInterval(()=>fgi(ag.id),3000);return()=>clearInterval(i);},[ag,fgi]);
  useEffect(()=>{if(sg)fr(sg);},[sg,fr]);
  useEffect(()=>{if(guilds.length>0&&!sg)setSg(guilds[0].id);},[guilds,sg]);

  function tryPin(){if(pin===ADMIN_PIN){setAuthed(true);sessionStorage.setItem('bingo_auth','1');setPinErr(false);}else{setPinErr(true);setPin('');}}

  if(!authed) return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)',fontFamily:"'Outfit',sans-serif"}}>
      <div style={{textAlign:'center',maxWidth:320,padding:'2rem'}}>
        <div style={{fontSize:'3rem',marginBottom:'0.5rem'}}>🎱</div>
        <h1 style={{fontSize:'1.5rem',fontWeight:900,color:'var(--text)',marginBottom:'0.25rem'}}>BINGO</h1>
        <p style={{color:'var(--text-dim)',fontFamily:"'Space Mono',monospace",fontSize:'0.8rem',marginBottom:'1.5rem'}}>enter admin pin</p>
        <input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter')tryPin();}}
          placeholder="••••"
          style={{width:'100%',background:'var(--surface2)',border:`1px solid ${pinErr?'var(--red)':'var(--border)'}`,borderRadius:'8px',padding:'0.75rem 1rem',color:'var(--text)',fontFamily:"'Space Mono',monospace",fontSize:'1.5rem',textAlign:'center',letterSpacing:'0.3em',outline:'none'}}
          autoFocus />
        {pinErr&&<p style={{color:'var(--red)',fontSize:'0.8rem',marginTop:'0.5rem',fontFamily:"'Space Mono',monospace"}}>wrong pin</p>}
        <button onClick={tryPin} style={{marginTop:'1rem',width:'100%',padding:'0.65rem',borderRadius:'8px',border:'none',background:'var(--accent)',color:'#fff',fontFamily:"'Outfit',sans-serif",fontSize:'0.9rem',fontWeight:600,cursor:'pointer'}}>Enter</button>
      </div>
    </div>
  );

  async function create(){if(!nn.trim())return;const ip=nm==='custom'?ni.split('\n').map(s=>s.trim()).filter(Boolean):[];
    if(nm==='custom'&&ip.length<24){alert(`Need 24+ items, you have ${ip.length}`);return;}
    setLd(true);try{const r=await fetch(`${API}/api/games`,{method:'POST',headers:H,body:JSON.stringify({name:nn,winCondition:nw,mode:nm,itemPool:ip})});
    if(r.ok){const g=await r.json();await fg();setAg(g);setView('manage');setNn('');setNi('');}}catch{}finally{setLd(false);}}

  async function addRole(){if(!ag||!ri)return;const u={...ag.roleConfig,[ri]:parseInt(rc)||1};await fetch(`${API}/api/games/${ag.id}/roles`,{method:'PUT',headers:H,body:JSON.stringify({roleConfig:u})});await fgi(ag.id);setRi('');setRc('1');}
  async function rmRole(rid:string){if(!ag)return;const u={...ag.roleConfig};delete u[rid];await fetch(`${API}/api/games/${ag.id}/roles`,{method:'PUT',headers:H,body:JSON.stringify({roleConfig:u})});await fgi(ag.id);}
  async function saveRoleDefaults(){if(!ag)return;await fetch(`${API}/api/defaults/roles`,{method:'POST',headers:H,body:JSON.stringify({roleConfig:ag.roleConfig})});alert('Role config saved as default for future games!');}
  async function post(){if(!ag||!sc)return;setLd(true);try{await fetch(`${API}/api/games/${ag.id}/post`,{method:'POST',headers:H,body:JSON.stringify({channelId:sc})});await fgi(ag.id);}catch{}finally{setLd(false);}}
  async function start(){if(!ag||!confirm(`Lock & start "${ag.name}"? No more players can join after this.`))return;await fetch(`${API}/api/games/${ag.id}/start`,{method:'POST',headers:H});await fgi(ag.id);}
  async function call(spec?:any){if(!ag)return;setLd(true);try{const b=spec!==undefined?(ag.mode==='custom'?{item:spec}:{number:spec}):{};
    const r=await fetch(`${API}/api/games/${ag.id}/call`,{method:'POST',headers:H,body:JSON.stringify(b)});if(r.ok){const d=await r.json();setJc(d.item);setTimeout(()=>setJc(null),2000);await fgi(ag.id);}}catch{}finally{setLd(false);}}
  async function end(){if(!ag||!confirm('End this game?'))return;await fetch(`${API}/api/games/${ag.id}/end`,{method:'POST',headers:H});await fgi(ag.id);await fg();}
  async function del(id:string){if(!confirm('Delete permanently?'))return;await fetch(`${API}/api/games/${id}`,{method:'DELETE',headers:H});if(ag?.id===id){setAg(null);setView('list');}if(hg?.id===id)setHg(null);await fg();}
  async function seedStreaks(gameId:string){if(!confirm('Seed +1 streak for all players in this game?'))return;try{const r=await fetch(`${API}/api/players/seed/${gameId}`,{method:'POST',headers:H});if(r.ok){const d=await r.json();alert(`Seeded ${d.seeded} players!`);fst();}}catch{}}
  async function savePingRole(){try{await fetch(`${API}/api/defaults/pingrole`,{method:'POST',headers:H,body:JSON.stringify({pingRoleId:pingRole||null})});setPingRoleSaved(true);setTimeout(()=>setPingRoleSaved(false),2000);}catch{}}
  async function openH(id:string){try{const r=await fetch(`${API}/api/games/${id}`,{headers:H});if(r.ok){setHg(await r.json());setView('history');}}catch{}}
  function sel(g:GS){if(g.status==='ended')openH(g.id);else{fgi(g.id);setView('manage');}}

  const cg=guilds.find(g=>g.id===sg);const active=games.filter(g=>g.status!=='ended');const ended=games.filter(g=>g.status==='ended');

  return(<div className="admin">
    <h1>🎱 BINGO</h1>
    <p className="subtitle">{conn?<span style={{color:'var(--green)'}}>● connected</span>:<span>○ disconnected</span>} · command center</p>
    <div style={{display:'flex',gap:'0.5rem',marginBottom:'1.5rem',flexWrap:'wrap'}}>
      <button className={`btn ${view==='list'?'btn-primary':'btn-outline'} btn-sm`} onClick={()=>setView('list')}>Games{active.length>0&&` (${active.length})`}</button>
      <button className={`btn ${view==='create'?'btn-primary':'btn-outline'} btn-sm`} onClick={()=>setView('create')}>+ New Game</button>
      {ag&&ag.status!=='ended'&&<button className={`btn ${view==='manage'?'btn-primary':'btn-outline'} btn-sm`} onClick={()=>setView('manage')}>▶ {ag.name}</button>}
      {ended.length>0&&<button className={`btn ${view==='history'?'btn-primary':'btn-outline'} btn-sm`} onClick={()=>{setHg(null);setView('history');}}>📜 History ({ended.length})</button>}
    </div>

    {/* LIST */}
    {view==='list'&&<div className="card"><h2>📋 Active Games</h2>
      {active.length===0&&<p style={{color:'var(--text-dim)'}}>No active games. Create one!</p>}
      {active.map(g=><div key={g.id} className="game-list-item" onClick={()=>sel(g)}><div className="name">{g.mode==='custom'?'🎨':'🔢'} {g.name}</div><span className={`tag tag-${g.status}`}>{g.status}</span><div className="meta">{g.playerCount}p · {g.calledCount}/{g.totalItems}</div><button className="btn btn-red btn-sm" onClick={e=>{e.stopPropagation();del(g.id);}}>✕</button></div>)}
      {ended.length>0&&<><h2 style={{marginTop:'1.5rem'}}>📜 Recent</h2>{ended.slice(0,5).map(g=><div key={g.id} className="game-list-item" onClick={()=>sel(g)} style={{opacity:0.7}}><div className="name">{g.mode==='custom'?'🎨':'🔢'} {g.name}</div><span className="tag tag-ended">ended</span><div className="meta">🏆{g.winnerCount} · {g.playerCount}p · {ago(g.createdAt)}</div><button className="btn btn-red btn-sm" onClick={e=>{e.stopPropagation();del(g.id);}}>✕</button></div>)}</>}

      {streaks.length>0&&<><h2 style={{marginTop:'1.5rem'}}>🔥 Player Streaks</h2>
        <div style={{maxHeight:'300px',overflow:'auto'}}>
        {streaks.map((p:any,i:number)=>{
          const tc:Record<string,string>={Diamond:'#b9f2ff',Gold:'#ffd700',Silver:'#c0c0c0',Bronze:'#cd7f32',New:'#888'};
          const c=tc[p.tier]||'#888';
          return<div key={p.discordId} className="role-row" style={{border:`1px solid ${c}22`}}>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:'0.8rem',fontWeight:900,color:c,minWidth:'1.5rem'}}>{i+1}</span>
            <span className="name" style={{color:i<3?c:'var(--text)'}}>{p.emoji} {p.username}</span>
            <span style={{fontSize:'0.7rem',color:'#ff6b35',fontFamily:"'Space Mono',monospace"}}>🔥{p.streak}</span>
            <span style={{fontSize:'0.7rem',color:'var(--text-dim)',fontFamily:"'Space Mono',monospace"}}>{p.gamesPlayed}g</span>
            {p.wins>0&&<span style={{fontSize:'0.7rem',color:'var(--gold)',fontFamily:"'Space Mono',monospace"}}>🏆{p.wins}</span>}
            <span className="count" style={{color:c}}>{p.tier}</span>
          </div>;})}
        </div></>}

      {/* Ping Role Config */}
      <h2 style={{marginTop:'1.5rem'}}>🔔 Auto Ping Role</h2>
      <p style={{fontSize:'0.75rem',color:'var(--text-dim)',marginBottom:'0.5rem'}}>Players who join any bingo game automatically get this role.</p>
      <div className="row">
        <div><label>Ping Role</label><select value={pingRole} onChange={e=>setPingRole(e.target.value)}>
          <option value="">None (disabled)</option>
          {roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
        </select></div>
        <button className="btn btn-primary btn-sm" onClick={savePingRole} style={{alignSelf:'flex-end'}}>{pingRoleSaved?'✓ Saved':'Save'}</button>
      </div>
    </div>}

    {/* CREATE */}
    {view==='create'&&<div className="card"><h2>🆕 Create Game</h2>
      <div className="field"><label>Game Name</label><input value={nn} onChange={e=>setNn(e.target.value)} placeholder="Friday Night Bingo"/></div>
      <div className="field"><label>Mode</label><div style={{display:'flex',gap:'0.5rem'}}><button className={`btn btn-sm ${nm==='classic'?'btn-primary':'btn-outline'}`} onClick={()=>setNm('classic')}>🔢 Classic (1-75)</button><button className={`btn btn-sm ${nm==='custom'?'btn-primary':'btn-outline'}`} onClick={()=>setNm('custom')}>🎨 Custom Items</button></div></div>
      {nm==='custom'&&<div className="field"><label>Items (one per line, min 24)</label><textarea value={ni} onChange={e=>setNi(e.target.value)} placeholder={"someone said GM\ntoken pumped 50%\ndev went live\nfloor dropped\nnew holder joined\n..."} style={{width:'100%',minHeight:'200px',resize:'vertical',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'8px',padding:'0.65rem',color:'var(--text)',fontFamily:"'Space Mono',monospace",fontSize:'0.8rem',outline:'none'}}/><span style={{fontSize:'0.75rem',color:'var(--text-dim)',fontFamily:"'Space Mono',monospace"}}>{ni.split('\n').filter(s=>s.trim()).length} items{ni.split('\n').filter(s=>s.trim()).length<24&&' (need 24+)'}</span></div>}
      <div className="field"><label>Win Condition</label><select value={nw} onChange={e=>setNw(e.target.value)}>{WINS.map(w=><option key={w.value} value={w.value}>{w.label}</option>)}</select></div>
      <button className="btn btn-primary" onClick={create} disabled={ld||!nn.trim()||(nm==='custom'&&ni.split('\n').filter(s=>s.trim()).length<24)}>Create {nm==='custom'?'Custom':'Classic'} Game</button>
    </div>}

    {/* HISTORY */}
    {view==='history'&&!hg&&<div className="card"><h2>📜 Game History</h2>
      {ended.length===0&&<p style={{color:'var(--text-dim)'}}>No finished games yet.</p>}
      {ended.map(g=><div key={g.id} className="game-list-item" onClick={()=>openH(g.id)}><div className="name">{g.mode==='custom'?'🎨':'🔢'} {g.name}</div><div className="meta" style={{display:'flex',gap:'0.75rem'}}><span>🏆 {g.winnerCount}</span><span>👥 {g.playerCount}</span><span>{g.calledCount}/{g.totalItems}</span><span>{ago(g.createdAt)}</span></div><button className="btn btn-red btn-sm" onClick={e=>{e.stopPropagation();del(g.id);}}>✕</button></div>)}
    </div>}
    {view==='history'&&hg&&<><button className="btn btn-outline btn-sm" onClick={()=>setHg(null)} style={{marginBottom:'1rem'}}>← Back</button>
      <div className="card"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><h2 style={{marginBottom:'0.25rem'}}>{hg.mode==='custom'?'🎨':'🔢'} {hg.name}</h2><span style={{fontFamily:"'Space Mono',monospace",fontSize:'0.8rem',color:'var(--text-dim)'}}>{hg.id}</span></div><span className="tag tag-ended">ENDED</span></div>
      <div style={{display:'flex',gap:'2rem',marginTop:'1rem',fontFamily:"'Space Mono',monospace",fontSize:'0.8rem',color:'var(--text-dim)',flexWrap:'wrap'}}><span>🎯 {WINS.find(w=>w.value===hg.winCondition)?.label}</span><span>👥 {Object.keys(hg.players).length}</span><span>📢 {hg.calledNumbers.length} called</span><span>🏆 {hg.winners.length}</span></div></div>
      <div className="card"><h2>🏆 Winners</h2>{hg.winners.length===0&&<p style={{color:'var(--text-dim)'}}>No winners.</p>}
        {hg.winners.map((w:any,i:number)=><div key={i} className="winner-item"><div className="trophy">🏆</div><div className="info"><div className="name">{w.displayName||w.username}</div><div className="detail">Discord: <code>{w.discordId}</code> · Card #{w.cardIndex+1} · Won on {ntc(w.wonOnItem)}</div></div></div>)}
        {hg.winners.length>0&&<div style={{marginTop:'1rem',padding:'1rem',background:'var(--surface2)',borderRadius:'8px'}}><h3 style={{fontSize:'0.9rem',marginBottom:'0.5rem'}}>💰 Payout Export</h3><pre style={{fontFamily:"'Space Mono',monospace",fontSize:'0.7rem',color:'var(--text-dim)',whiteSpace:'pre-wrap',userSelect:'all'}}>{JSON.stringify(hg.winners.map((w:any)=>({discordId:w.discordId,username:w.username,wonAt:w.wonAt})),null,2)}</pre></div>}
        <button className="btn btn-outline btn-sm" onClick={()=>seedStreaks(hg.id)} style={{marginTop:'0.75rem'}}>🔥 Seed +1 Streak for All Players</button>
      </div>
      <div className="card"><h2>👥 Players ({Object.keys(hg.players).length})</h2><div style={{maxHeight:'300px',overflow:'auto'}}>{Object.entries(hg.players).map(([uid,p]:[string,any])=><div key={uid} className="role-row"><span className="name">{p.displayName||p.username}</span><span className="count">{p.cards.length} card{p.cards.length>1?'s':''}</span><span style={{fontSize:'0.65rem',color:'var(--text-dim)',fontFamily:"'Space Mono',monospace"}}>{uid}</span></div>)}</div></div>
    </>}

    {/* MANAGE */}
    {view==='manage'&&ag&&<>
      <div className="card"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><h2 style={{marginBottom:'0.25rem'}}>{ag.mode==='custom'?'🎨':'🔢'} {ag.name}</h2><span style={{fontFamily:"'Space Mono',monospace",fontSize:'0.8rem',color:'var(--text-dim)'}}>{ag.id}</span></div><span className={`status-badge status-${ag.status}`}>{ag.status}</span></div>
        <div style={{display:'flex',gap:'2rem',marginTop:'1rem',fontFamily:"'Space Mono',monospace",fontSize:'0.8rem',color:'var(--text-dim)',flexWrap:'wrap'}}><span>👥 {Object.keys(ag.players).length}</span><span>🎴 {Object.values(ag.players).reduce((s:number,p:any)=>s+p.cards.length,0)}</span><span>📢 {ag.calledNumbers.length}/{ag.mode==='custom'?ag.itemPool?.length:75}</span><span>🏆 {ag.winners.length}</span><span>🎯 {WINS.find(w=>w.value===ag.winCondition)?.label}</span></div>
        <div style={{marginTop:'0.75rem'}}><a href={`/display/${ag.id}`} target="_blank" className="btn btn-outline btn-sm">Open Display →</a></div></div>

      {ag.status==='open'&&<><div className="card"><h2>🎭 Role → Cards</h2>
        {Object.entries(ag.roleConfig).map(([rid,cnt])=>{const role=roles.find(r=>r.id===rid);return<div key={rid} className="role-row"><span className="name">{role?.name||rid}</span><span className="count">{cnt as number} card{(cnt as number)>1?'s':''}</span><button className="btn btn-red btn-sm" onClick={()=>rmRole(rid)}>✕</button></div>;})}
        <div className="row" style={{marginTop:'0.75rem'}}><div><label>Role</label><select value={ri} onChange={e=>setRi(e.target.value)}><option value="">Select...</option>{roles.map(r=><option key={r.id} value={r.id}>{r.name} ({r.memberCount})</option>)}</select></div><div style={{flex:'0 0 100px'}}><label>Cards</label><input type="number" min="1" max="10" value={rc} onChange={e=>setRc(e.target.value)}/></div><button className="btn btn-primary btn-sm" onClick={addRole} style={{alignSelf:'flex-end'}}>Add</button></div>
        {Object.keys(ag.roleConfig).length>0&&<button className="btn btn-outline btn-sm" onClick={saveRoleDefaults} style={{marginTop:'0.75rem'}}>💾 Save as default for future games</button>}
        </div>

      <div className="card"><h2>📢 Post Join Message</h2>
        <div className="row"><div><label>Guild</label><select value={sg} onChange={e=>setSg(e.target.value)}>{guilds.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div><div><label>Channel</label><select value={sc} onChange={e=>setSc(e.target.value)}><option value="">Select...</option>{cg?.channels.map(c=><option key={c.id} value={c.id}>#{c.name}</option>)}</select></div><button className="btn btn-green btn-sm" onClick={post} disabled={ld||!sc} style={{alignSelf:'flex-end'}}>{ag.messageId?'Repost':'Post'}</button></div>
        {ag.messageId&&<p style={{fontSize:'0.8rem',color:'var(--green)',marginTop:'0.5rem',fontFamily:"'Space Mono',monospace"}}>✓ Posted</p>}
        <div style={{marginTop:'1rem'}}><button className="btn btn-primary" onClick={start} disabled={Object.keys(ag.players).length===0}>🚀 Lock & Start</button></div></div></>}

      {ag.status==='active'&&<div className="card"><h2>🎱 {ag.mode==='custom'?'Call Items':'Call Numbers'}</h2>
        <div style={{display:'flex',gap:'1rem',alignItems:'center',marginBottom:'1rem',flexWrap:'wrap'}}><button className="btn btn-primary" onClick={()=>call()} disabled={ld}>🎲 Draw Random</button>
          {ag.lastCalledItem!=null&&<span style={{fontFamily:"'Space Mono',monospace",fontSize:'1.5rem',fontWeight:900,color:'var(--accent)'}}>Last: {ntc(ag.lastCalledItem)}</span>}
          <button className="btn btn-red btn-sm" onClick={end} style={{marginLeft:'auto'}}>End Game</button></div>
        {ag.mode==='custom'?<div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem'}}>{ag.itemPool?.map((item:string)=>{const cl=ag.calledNumbers.includes(item);return<button key={item} onClick={()=>!cl&&call(item)} disabled={cl} style={{padding:'0.4rem 0.75rem',borderRadius:'8px',fontSize:'0.75rem',fontFamily:"'Space Mono',monospace",fontWeight:700,cursor:cl?'default':'pointer',border:`1px solid ${cl?'var(--accent)':'var(--border)'}`,background:cl?'var(--accent)':'var(--surface2)',color:cl?'#fff':'var(--text)',boxShadow:cl?'0 0 12px var(--accent-glow)':'none',transition:'all 0.2s'}}>{item}</button>;})}</div>
        :<><div style={{display:'grid',gridTemplateColumns:'repeat(15,1fr)',gap:'4px',marginBottom:'2px'}}>{'BINGO'.split('').map(l=><div key={l} style={{gridColumn:'span 3',textAlign:'center',fontWeight:900,fontSize:'0.9rem',color:CC[l]}}>{l}</div>)}</div>
          <div className="number-grid">{Array.from({length:75},(_,i)=>i+1).map(n=>{const l=ltr(n);const cl=ag.calledNumbers.includes(n);return<div key={n} className={`number-cell ${cl?'called':''} ${jc===n?'just-called':''}`} style={cl?{background:CC[l],borderColor:CC[l],boxShadow:`0 0 12px ${CC[l]}44`,color:'#fff'}:{}} onClick={()=>!cl&&call(n)}>{n}</div>;})}</div></>}
        <a href={`/display/${ag.id}`} target="_blank" className="btn btn-outline btn-sm" style={{marginTop:'1rem'}}>Open Stream Display →</a></div>}

      {ag.winners.length>0&&<div className="card"><h2>🏆 Winners</h2>{ag.winners.map((w:any,i:number)=><div key={i} className="winner-item"><div className="trophy">🏆</div><div className="info"><div className="name">{w.displayName||w.username}</div><div className="detail">Discord: <code>{w.discordId}</code> · Card #{w.cardIndex+1} · on {ntc(w.wonOnItem)}</div></div></div>)}</div>}
      {Object.keys(ag.players).length>0&&<div className="card"><h2>👥 Players ({Object.keys(ag.players).length})</h2><div style={{maxHeight:'300px',overflow:'auto'}}>{Object.entries(ag.players).map(([uid,p]:[string,any])=><div key={uid} className="role-row"><span className="name">{p.displayName||p.username}</span><span className="count">{p.cards.length} card{p.cards.length>1?'s':''}</span><span style={{fontSize:'0.65rem',color:'var(--text-dim)',fontFamily:"'Space Mono',monospace"}}>{uid}</span></div>)}</div></div>}
    </>}
  </div>);
}

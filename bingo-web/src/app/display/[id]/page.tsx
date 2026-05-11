'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
type LB = { displayName:string; progress:number; total:number; label:string; marks:number; cards:number; isWinner:boolean; bestCard:any[][]|null; hasStar?:boolean; tierName?:string; streak?:number; };
type DS = { id:string;name:string;status:string;winCondition:string;mode:string;calledNumbers:any[];playerCount:number;totalCards:number;winners:any[];lastCalledAt:string|null;itemPool?:string[];leaderboard?:LB[]; };
const COLS = [
  {letter:'B',min:1,max:15,color:'#ff6b35',grad:'radial-gradient(circle at 35% 35%,#ff8f5e,#ff6b35,#cc4400)',glow:'#ff6b3566'},
  {letter:'I',min:16,max:30,color:'#00e5ff',grad:'radial-gradient(circle at 35% 35%,#4ef5ff,#00e5ff,#0091a1)',glow:'#00e5ff55'},
  {letter:'N',min:31,max:45,color:'#00ff88',grad:'radial-gradient(circle at 35% 35%,#55ffaa,#00ff88,#009e54)',glow:'#00ff8855'},
  {letter:'G',min:46,max:60,color:'#ffd700',grad:'radial-gradient(circle at 35% 35%,#ffe44d,#ffd700,#b89a00)',glow:'#ffd70055'},
  {letter:'O',min:61,max:75,color:'#ff3366',grad:'radial-gradient(circle at 35% 35%,#ff6b8a,#ff3366,#c41048)',glow:'#ff336655'},
];
function colFor(n:number){return COLS.find(c=>n>=c.min&&n<=c.max)!;}
function ltr(n:number){return colFor(n).letter;}
function ntc(n:any){if(typeof n==='string')return n;return`${ltr(n)}${n}`;}

function spawnConfetti(){const cs=['#ff6b35','#00ff88','#ffd700','#00e5ff','#ff3366','#fff'];for(let i=0;i<80;i++){const e=document.createElement('div');e.className='confetti';e.style.left=Math.random()*100+'vw';e.style.background=cs[Math.floor(Math.random()*cs.length)];e.style.width=(6+Math.random()*10)+'px';e.style.height=(6+Math.random()*10)+'px';e.style.borderRadius=Math.random()>0.5?'50%':'2px';e.style.animationDuration=(2+Math.random()*3)+'s';e.style.animationDelay=(Math.random()*1.5)+'s';document.body.appendChild(e);setTimeout(()=>e.remove(),6000);}}

// Particle burst from a point
function spawnBurst(x:number,y:number,color:string){
  for(let i=0;i<20;i++){
    const e=document.createElement('div');
    const angle=Math.random()*Math.PI*2;const dist=60+Math.random()*120;const dx=Math.cos(angle)*dist;const dy=Math.sin(angle)*dist;
    e.style.cssText=`position:fixed;left:${x}px;top:${y}px;width:${4+Math.random()*6}px;height:${4+Math.random()*6}px;background:${color};border-radius:50%;pointer-events:none;z-index:200;opacity:1;transition:all ${0.6+Math.random()*0.6}s cubic-bezier(0.25,1,0.5,1);`;
    document.body.appendChild(e);
    requestAnimationFrame(()=>{e.style.transform=`translate(${dx}px,${dy}px)`;e.style.opacity='0';});
    setTimeout(()=>e.remove(),1500);
  }
}

export default function DisplayPage(){
  const params=useParams();const gameId=params.id as string;
  const[game,setGame]=useState<DS|null>(null);const[pcc,setPcc]=useState(0);const[latest,setLatest]=useState<any>(null);
  const[isNew,setIsNew]=useState(false);const[showW,setShowW]=useState<any>(null);const[pwc,setPwc]=useState(0);const[err,setErr]=useState('');
  const[winQueue,setWinQueue]=useState<any[]>([]);
  const[hoverIdx,setHoverIdx]=useState<number|null>(null);
  const[party,setParty]=useState(true);
  const[shake,setShake]=useState(false);
  const[scramble,setScramble]=useState<string|null>(null);
  const ballRef=useRef<HTMLDivElement>(null);

  // Scramble effect - cycle random numbers before revealing
  useEffect(()=>{
    if(!scramble)return;
    let count=0;const max=8;
    const iv=setInterval(()=>{
      count++;
      if(count>=max){clearInterval(iv);setScramble(null);return;}
      const el=document.getElementById('scramble-num');
      if(el)el.textContent=String(Math.floor(Math.random()*75)+1);
    },60);
    return()=>clearInterval(iv);
  },[scramble]);

  useEffect(()=>{
    if(showW||winQueue.length===0)return;
    const next=winQueue[0];setShowW(next);spawnConfetti();
    setWinQueue(q=>q.slice(1));setTimeout(()=>setShowW(null),8000);
  },[showW,winQueue]);

  const fetch_=useCallback(async()=>{try{const r=await fetch(`${API}/api/games/${gameId}/display`);if(!r.ok){setErr('Game not found');return;}const d:DS=await r.json();
    if(d.calledNumbers.length>pcc&&pcc>0){
      const newItem=d.calledNumbers[d.calledNumbers.length-1];
      if(party){setScramble('go');setShake(true);setTimeout(()=>setShake(false),400);}
      setTimeout(()=>{
        setLatest(newItem);setIsNew(true);
        if(party&&ballRef.current){const r=ballRef.current.getBoundingClientRect();const col=typeof newItem==='number'?colFor(newItem):null;spawnBurst(r.x+r.width/2,r.y+r.height/2,col?.color||'#ff6b35');}
        setTimeout(()=>setIsNew(false),1500);
      },party?500:0);
    }
    setPcc(d.calledNumbers.length);
    if(d.winners.length>pwc&&pwc>0){const nw=d.winners.slice(pwc);setWinQueue(q=>[...q,...nw]);}
    setPwc(d.winners.length);
    if(d.calledNumbers.length>0&&!latest)setLatest(d.calledNumbers[d.calledNumbers.length-1]);
    setGame(d);}catch{setErr('Connection lost');}
  },[gameId,pcc,pwc,party]);

  useEffect(()=>{fetch_();const i=setInterval(fetch_,1500);return()=>clearInterval(i);},[fetch_]);

  if(err||!game)return<div className="display" style={{display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{textAlign:'center'}}><div style={{fontSize:'4rem',marginBottom:'1rem'}}>🎱</div><div style={{fontFamily:"'Space Mono',monospace",color:'var(--text-dim)'}}>{err||'Loading...'}</div></div></div>;

  const isC=game.mode==='custom';const called=new Set(game.calledNumbers);const recent=[...game.calledNumbers].reverse().slice(0,8);const total=isC?(game.itemPool?.length||0):75;
  const lCol=(!isC&&typeof latest==='number')?colFor(latest):null;
  const cColors=['#ff6b35','#00e5ff','#00ff88','#ffd700','#ff3366'];const cIdx=game.calledNumbers.length%cColors.length;

  return(<div className="display" style={shake?{animation:'screenShake 0.4s ease'}:{}}>
    <style>{`
      @keyframes screenShake{0%,100%{transform:translate(0)}10%{transform:translate(-4px,2px)}30%{transform:translate(4px,-2px)}50%{transform:translate(-2px,4px)}70%{transform:translate(2px,-4px)}90%{transform:translate(-2px,1px)}}
      @keyframes ballSpin{0%{transform:translateY(-120px) rotate(-720deg) scale(0.3);opacity:0}60%{transform:translateY(15px) rotate(20deg) scale(1.1);opacity:1}80%{transform:translateY(-5px) rotate(-5deg) scale(0.98)}100%{transform:translateY(0) rotate(0) scale(1);opacity:1}}
      @keyframes ballChill{0%{transform:translateY(-80px) scale(0.5);opacity:0}60%{transform:translateY(8px) scale(1.05);opacity:1}100%{transform:translateY(0) scale(1);opacity:1}}
      @keyframes cellFlip{0%{transform:perspective(400px) rotateY(90deg);opacity:0.5}60%{transform:perspective(400px) rotateY(-10deg)}100%{transform:perspective(400px) rotateY(0);opacity:1}}
      @keyframes cellChill{0%{transform:scale(0.9)}100%{transform:scale(1)}}
      @keyframes glowPulse{0%,100%{box-shadow:0 0 15px var(--glow-color)}50%{box-shadow:0 0 35px var(--glow-color),0 0 60px var(--glow-color)}}
      @keyframes floatParticle{0%{transform:translateY(100vh) rotate(0);opacity:0}10%{opacity:0.3}90%{opacity:0.3}100%{transform:translateY(-10vh) rotate(360deg);opacity:0}}
      .party-toggle{position:absolute;top:1rem;right:1.5rem;z-index:100;display:flex;align-items:center;gap:0.5rem;cursor:pointer;user-select:none}
      .party-toggle label{font-size:0.7rem;font-family:'Space Mono',monospace;color:#666;cursor:pointer}
      .toggle-track{width:40px;height:22px;border-radius:11px;background:#2a2a3a;position:relative;transition:background 0.3s;cursor:pointer}
      .toggle-track.on{background:#ff6b35}
      .toggle-knob{width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:left 0.3s}
      .toggle-track.on .toggle-knob{left:20px}
      .ambient-particle{position:fixed;border-radius:50%;pointer-events:none;animation:floatParticle linear infinite;opacity:0.2}
    `}</style>

    {/* Ambient floating particles (party mode only) */}
    {party&&<div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0}}>
      {Array.from({length:15},(_,i)=><div key={i} className="ambient-particle" style={{
        left:`${Math.random()*100}%`,width:`${2+Math.random()*4}px`,height:`${2+Math.random()*4}px`,
        background:cColors[i%5],animationDuration:`${15+Math.random()*25}s`,animationDelay:`${Math.random()*10}s`,
      }}/>)}
    </div>}

    {/* Party mode toggle */}
    <div className="party-toggle" onClick={()=>setParty(!party)}>
      <label>{party?'🎉 Party':'😌 Chill'}</label>
      <div className={`toggle-track ${party?'on':''}`}><div className="toggle-knob"/></div>
    </div>

    <div className="display-header">
      <div className="display-title" data-text={game.name}>{game.name}</div>
      <div className="display-subtitle">{game.id} · {game.winCondition.replace('_',' ').toUpperCase()}{isC&&' · CUSTOM'} · <span className={`status-badge status-${game.status}`}>{game.status}</span></div>
    </div>

    <div className="display-body">
      <div className="display-caller">
        <div className="caller-top">
        {/* Ball */}
        {latest!=null?<div ref={ballRef}
          className={`ball ${isNew?'new':''}`}
          style={{
            ...(lCol?{background:lCol.grad,boxShadow:`0 0 60px ${lCol.glow},0 0 120px ${lCol.glow.replace('55','22')},inset 0 -10px 30px #00000044,inset 0 10px 20px #ffffff22`}:isC?{background:`radial-gradient(circle at 35% 35%,${cColors[cIdx]}aa,${cColors[cIdx]},${cColors[cIdx]}88)`,boxShadow:`0 0 60px ${cColors[cIdx]}66,inset 0 -10px 30px #00000044,inset 0 10px 20px #ffffff22`}:{}),
            animation:isNew?(party?'ballSpin 0.9s cubic-bezier(0.34,1.56,0.64,1)':'ballChill 0.7s cubic-bezier(0.34,1.56,0.64,1)'):'none',
            ...(party&&isNew?{'--glow-color':lCol?.glow||'#ff6b3566',animationName:'ballSpin, glowPulse',animationDuration:'0.9s, 2s',animationIterationCount:'1, 3'} as any:{}),
          }}>
          {scramble?<div className="ball-number" id="scramble-num" style={{fontSize:'clamp(2rem,4vw,4rem)'}}>?</div>
          :!isC&&typeof latest==='number'?<><div className="ball-letter">{ltr(latest)}</div><div className="ball-number">{latest}</div></>
          :<div className="ball-number" style={{fontSize:'clamp(0.8rem,2vw,1.4rem)',padding:'0 1rem',textAlign:'center',lineHeight:1.2}}>{String(latest).slice(0,30)}</div>}
        </div>:<div className="ball ball-empty"><div className="ball-number" style={{fontSize:'1.5rem',color:'#666'}}>?</div></div>}

        <div className="called-count">{game.calledNumbers.length} of {total} called</div>

        <div className="recent-calls">{recent.map((item:any,i:number)=>{const ch=(!isC&&typeof item==='number')?colFor(item):null;
          return<div key={String(item)} className={`recent-chip ${i===0?'latest':''}`} style={i===0&&ch?{background:ch.color,color:'#fff',borderColor:ch.color,boxShadow:`0 0 12px ${ch.glow}`}:ch?{borderColor:ch.color+'44',color:ch.color+'aa'}:i===0?{background:'var(--accent)',color:'#fff',borderColor:'var(--accent)'}:{}}>{isC?String(item).slice(0,15):ntc(item)}</div>;})}</div>

        <div className="display-stats">{[{v:game.playerCount,c:'var(--cyan)',l:'Players'},{v:game.totalCards,c:'var(--accent)',l:'Cards'},{v:game.winners.length,c:'var(--gold)',l:'Winners'}].map(s=><div key={s.l} className="stat"><div className="stat-value" style={{color:s.c}}>{s.v}</div><div className="stat-label">{s.l}</div></div>)}</div>
        </div>

        <div className="caller-scroll">
        {/* Winners - ranked with crown */}
        {game.winners.length>0&&<div style={{width:'100%',marginTop:'0.5rem'}}>
          {game.winners.map((w:any,i:number)=>{
            const medals=['🥇','🥈','🥉'];const medal=i<3?medals[i]:`${i+1}.`;
            return<div key={i} style={{display:'flex',alignItems:'center',gap:'0.6rem',padding:'0.55rem 0.75rem',marginBottom:'0.3rem',background:'#ffd70011',borderRadius:'10px',border:'1px solid #ffd70033',position:'relative'}}>
              {i===0&&<span style={{position:'absolute',top:'-10px',left:'50%',transform:'translateX(-50%)',fontSize:'1.1rem'}}>👑</span>}
              <span style={{fontSize:i<3?'1.3rem':'0.9rem',minWidth:'1.8rem',textAlign:'center'}}>{medal}</span>
              <span style={{fontWeight:700,fontSize:i<3?'0.95rem':'0.82rem',color:i===0?'#ffd700':'#fff',flex:1}}>{w.displayName||w.username}</span>
              <span style={{fontFamily:"'Space Mono',monospace",fontSize:'0.65rem',color:'var(--text-dim)'}}>on {ntc(w.wonOnItem)}</span>
            </div>;
          })}
        </div>}

        {/* Race to Bingo - top 5 */}
        {game.leaderboard&&game.leaderboard.length>0&&game.calledNumbers.length>0&&(
          <div style={{width:'100%',marginTop:'0.75rem'}}>
            <div style={{fontSize:'0.8rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-dim)',marginBottom:'0.6rem'}}>🔥 Race to Bingo</div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',maxHeight:'350px',overflow:'auto'}}>
              {game.leaderboard.slice(0,10).map((p:LB,i:number)=>{
                const pct=Math.round((p.progress/p.total)*100);const need=p.total-p.progress;
                const isTop=i<3&&!p.isWinner;const barColor=p.isWinner?'#ffd700':i===0?'#00ff88':i===1?'#00e5ff':i===2?'#ff6b35':'#666';
                return<div key={i} onClick={()=>p.bestCard&&setHoverIdx(hoverIdx===i?null:i)} style={{
                  padding:i<3?'0.6rem 0.75rem':'0.4rem 0.75rem',borderRadius:'10px',position:'relative',overflow:'hidden',cursor:p.bestCard?'pointer':'default',
                  background:p.isWinner?'#ffd70010':isTop?'#ffffff0a':'#ffffff05',border:`1px solid ${p.isWinner?'#ffd70044':isTop?barColor+'30':'#ffffff0a'}`,transition:'all 0.3s ease',
                }}>
                  <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${pct}%`,background:`linear-gradient(90deg,${barColor}20,${barColor}10)`,borderRadius:'10px',transition:'width 1s cubic-bezier(0.25,1,0.5,1)'}}/>
                  <div style={{position:'relative',display:'flex',alignItems:'center',gap:'0.6rem'}}>
                    <div style={{minWidth:i<3?'2rem':'1.5rem',height:i<3?'2rem':'1.5rem',borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center',background:p.isWinner?'#ffd700':isTop?barColor+'22':'transparent',border:`1.5px solid ${p.isWinner?'#ffd700':isTop?barColor:'#333'}`}}>
                      <span style={{fontFamily:"'Space Mono',monospace",fontSize:i<3?'0.85rem':'0.7rem',fontWeight:900,color:p.isWinner?'#000':barColor}}>{p.isWinner?'W':i+1}</span>
                    </div>
                    <span style={{fontSize:i<3?'0.95rem':'0.78rem',fontWeight:i<3?700:500,flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',color:p.isWinner?'#ffd700':i<3?'#fff':'#aaa'}}>
                      {p.displayName}
                      {p.hasStar&&<span title="Has a Star Card" style={{color:'#ffd700',marginLeft:'0.3rem'}}>★</span>}
                      {(p.streak||0)>=2&&<span style={{fontSize:'0.55rem',color:'#ff6b35',marginLeft:'0.2rem'}}>🔥{p.streak}</span>}
                      <span style={{fontSize:'0.6rem',color:'#555',fontWeight:400,marginLeft:'0.3rem'}}>{p.cards}c</span>
                    </span>
                    <div style={{display:'flex',alignItems:'center',gap:'0.4rem',flexShrink:0}}>
                      {!p.isWinner&&need>0&&<span style={{fontSize:'0.6rem',color:'#555',fontFamily:"'Space Mono',monospace"}}>{need} away</span>}
                      <span style={{fontFamily:"'Space Mono',monospace",fontSize:i<3?'0.8rem':'0.68rem',fontWeight:900,color:barColor}}>{p.label}</span>
                    </div>
                  </div>
                  {i<3&&<div style={{position:'relative',marginTop:'0.4rem',height:4,borderRadius:3,background:'#ffffff0a',overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${pct}%`,borderRadius:3,background:`linear-gradient(90deg,${barColor}88,${barColor})`,boxShadow:`0 0 10px ${barColor}66`,transition:'width 1s cubic-bezier(0.25,1,0.5,1)'}}/>
                  </div>}
                </div>;})}
            </div>
          </div>
        )}

        </div>{/* end caller-scroll */}

        {/* Card preview modal */}
        {hoverIdx!==null&&game.leaderboard&&game.leaderboard[hoverIdx]?.bestCard&&(()=>{
          const p=game.leaderboard[hoverIdx];const grid=p.bestCard!;
          const cc=['#ff6b35','#00e5ff','#00ff88','#ffd700','#ff3366'];
          return<div onClick={()=>setHoverIdx(null)} style={{position:'fixed',inset:0,zIndex:150,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',cursor:'pointer'}}>
            <div onClick={e=>e.stopPropagation()} style={{background:'#0c0c1a',border:'1px solid #2a2a3a',borderRadius:'16px',padding:'1.5rem',boxShadow:'0 16px 64px #000000cc',cursor:'default'}}>
              <div style={{fontSize:'1.1rem',fontWeight:700,marginBottom:'0.15rem',color:'#fff',textAlign:'center'}}>{p.displayName}</div>
              <div style={{fontSize:'0.75rem',color:'#666',textAlign:'center',marginBottom:'0.75rem',fontFamily:"'Space Mono',monospace"}}>{p.label}</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'3px',marginBottom:'0.4rem'}}>
                {'BINGO'.split('').map((l,ci)=><div key={l} style={{textAlign:'center',fontSize:'0.9rem',fontWeight:900,color:cc[ci],padding:'4px 0'}}>{l}</div>)}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,56px)',gap:'3px'}}>
                {grid.flat().map((cell:any,ci:number)=>{const isFree=cell==='FREE';const isStar=cell==='STAR';const marked=isFree||isStar||game.calledNumbers.includes(cell);const colIdx=ci%5;
                  return<div key={ci} style={{height:56,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'6px',fontSize:isFree||isStar?'0.7rem':'0.9rem',fontWeight:700,fontFamily:"'Space Mono',monospace",
                    background:isFree?'#3d2a5c':isStar?'#4a3a10':marked?cc[colIdx]:'#16162a',color:isFree?'#ffd700':isStar?'#ffd700':marked?'#fff':'#555',border:`1px solid ${isFree?'#ffd70044':isStar?'#ffd70066':marked?'transparent':'#2a2a3a'}`,
                    boxShadow:marked&&!isFree&&!isStar?`0 0 8px ${cc[colIdx]}44`:isStar?'0 0 8px #ffd70044':'none'}}>{isFree?'FREE':isStar?'★':typeof cell==='number'?cell:String(cell).slice(0,4)}</div>;
                })}
              </div>
              <div style={{fontSize:'0.7rem',color:'#555',marginTop:'0.5rem',textAlign:'center'}}>click anywhere to close</div>
            </div>
          </div>;
        })()}
      </div>

      {/* Board */}
      <div className="display-board">
        {isC?<div style={{display:'flex',flexWrap:'wrap',gap:'6px',flex:1,alignContent:'flex-start'}}>{game.itemPool?.map((item:string)=>{const cl=called.has(item);const ij=item===latest&&isNew;
          return<div key={item} style={{padding:'0.5rem 0.75rem',borderRadius:'8px',fontFamily:"'Space Mono',monospace",fontSize:'clamp(0.6rem,0.9vw,0.85rem)',fontWeight:700,transition:'all 0.3s',
            background:cl?'var(--accent)':'var(--surface)',border:`1px solid ${cl?'var(--accent)':'var(--border)'}`,color:cl?'#fff':'#555',
            boxShadow:cl?'0 0 12px var(--accent-glow)':'none',animation:ij?(party?'cellFlip 0.6s ease':'cellChill 0.3s ease'):'none'}}>{item}</div>;})}</div>
        :<><div className="board-header">{COLS.map(c=><div key={c.letter} className={`board-letter board-letter-${c.letter}`}>{c.letter}</div>)}</div>
          <div className="board-grid">{Array.from({length:15},(_,row)=>COLS.map(col=>{const num=col.min+row;const cl=called.has(num);const ij=num===latest&&isNew;
            return<div key={num} className={`board-cell ${cl?`called called-${col.letter}`:''} ${ij?'just-called':''}`}
              style={{
                ...(cl?{background:col.color,boxShadow:`0 0 15px ${col.glow}`}:{}),
                animation:ij?(party?'cellFlip 0.6s ease':'cellChill 0.3s ease'):'none',
              }}>{num}</div>;}))}</div></>}
      </div>
    </div>

    {/* Winner overlay */}
    {showW&&<div className="display-winner-overlay" onClick={()=>setShowW(null)}><div className="winner-announce"><h2>🎱 BINGO! 🎱</h2><div className="winner-name">{showW.displayName||showW.username}</div><div className="winner-detail">Won on {ntc(showW.wonOnItem)} · Card #{showW.cardIndex+1}</div></div></div>}
  </div>);
}

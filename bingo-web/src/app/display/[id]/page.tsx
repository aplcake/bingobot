'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
type LB = { displayName:string; progress:number; total:number; label:string; marks:number; cards:number; isWinner:boolean; bestCard:any[][]|null; };
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
function confetti(){const cs=['#ff6b35','#00ff88','#ffd700','#00e5ff','#ff3366','#fff'];for(let i=0;i<80;i++){const e=document.createElement('div');e.className='confetti';e.style.left=Math.random()*100+'vw';e.style.background=cs[Math.floor(Math.random()*cs.length)];e.style.width=(6+Math.random()*10)+'px';e.style.height=(6+Math.random()*10)+'px';e.style.borderRadius=Math.random()>0.5?'50%':'2px';e.style.animationDuration=(2+Math.random()*3)+'s';e.style.animationDelay=(Math.random()*1.5)+'s';document.body.appendChild(e);setTimeout(()=>e.remove(),6000);}}

export default function DisplayPage(){
  const params=useParams();const gameId=params.id as string;
  const[game,setGame]=useState<DS|null>(null);const[pcc,setPcc]=useState(0);const[latest,setLatest]=useState<any>(null);
  const[isNew,setIsNew]=useState(false);const[showW,setShowW]=useState<any>(null);const[pwc,setPwc]=useState(0);const[err,setErr]=useState('');
  const[winQueue,setWinQueue]=useState<any[]>([]);
  const[hoverIdx,setHoverIdx]=useState<number|null>(null);

  // Process winner queue — show each winner for 8 seconds
  useEffect(()=>{
    if(showW||winQueue.length===0)return;
    const next=winQueue[0];
    setShowW(next);confetti();
    setWinQueue(q=>q.slice(1));
    setTimeout(()=>setShowW(null),8000);
  },[showW,winQueue]);

  const fetch_=useCallback(async()=>{try{const r=await fetch(`${API}/api/games/${gameId}/display`);if(!r.ok){setErr('Game not found');return;}const d:DS=await r.json();
    if(d.calledNumbers.length>pcc&&pcc>0){setLatest(d.calledNumbers[d.calledNumbers.length-1]);setIsNew(true);setTimeout(()=>setIsNew(false),1500);}
    setPcc(d.calledNumbers.length);
    if(d.winners.length>pwc&&pwc>0){
      // Queue ALL new winners, not just the last one
      const newWinners=d.winners.slice(pwc);
      setWinQueue(q=>[...q,...newWinners]);
    }
    setPwc(d.winners.length);
    if(d.calledNumbers.length>0)setLatest(d.calledNumbers[d.calledNumbers.length-1]);
    setGame(d);}catch{setErr('Connection lost');}
  },[gameId,pcc,pwc]);

  useEffect(()=>{fetch_();const i=setInterval(fetch_,1500);return()=>clearInterval(i);},[fetch_]);

  if(err||!game)return<div className="display" style={{display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{textAlign:'center'}}><div style={{fontSize:'4rem',marginBottom:'1rem'}}>🎱</div><div style={{fontFamily:"'Space Mono',monospace",color:'var(--text-dim)'}}>{err||'Loading...'}</div></div></div>;

  const isC=game.mode==='custom';const called=new Set(game.calledNumbers);const recent=[...game.calledNumbers].reverse().slice(0,8);const total=isC?(game.itemPool?.length||0):75;
  const lCol=(!isC&&typeof latest==='number')?colFor(latest):null;
  const cColors=['#ff6b35','#00e5ff','#00ff88','#ffd700','#ff3366'];const cIdx=game.calledNumbers.length%cColors.length;

  return(<div className="display">
    <div className="display-header"><div className="display-title" data-text={game.name}>{game.name}</div>
      <div className="display-subtitle">{game.id} · {game.winCondition.replace('_',' ').toUpperCase()}{isC&&' · CUSTOM'} · <span className={`status-badge status-${game.status}`}>{game.status}</span></div></div>

    <div className="display-body">
      <div className="display-caller">
        {latest!=null?<div className={`ball ${isNew?'new':''}`} style={lCol?{background:lCol.grad,boxShadow:`0 0 60px ${lCol.glow},0 0 120px ${lCol.glow.replace('55','22')},inset 0 -10px 30px #00000044,inset 0 10px 20px #ffffff22`}:isC?{background:`radial-gradient(circle at 35% 35%,${cColors[cIdx]}aa,${cColors[cIdx]},${cColors[cIdx]}88)`,boxShadow:`0 0 60px ${cColors[cIdx]}66,inset 0 -10px 30px #00000044,inset 0 10px 20px #ffffff22`}:{}}>
          {!isC&&typeof latest==='number'?<><div className="ball-letter">{ltr(latest)}</div><div className="ball-number">{latest}</div></>:<div className="ball-number" style={{fontSize:'clamp(0.8rem,2vw,1.4rem)',padding:'0 1rem',textAlign:'center',lineHeight:1.2}}>{String(latest).slice(0,30)}</div>}
        </div>:<div className="ball ball-empty"><div className="ball-number" style={{fontSize:'1.5rem',color:'#666'}}>?</div></div>}

        <div className="called-count">{game.calledNumbers.length} of {total} called</div>
        <div className="recent-calls">{recent.map((item:any,i:number)=>{const ch=(!isC&&typeof item==='number')?colFor(item):null;
          return<div key={String(item)} className={`recent-chip ${i===0?'latest':''}`} style={i===0&&ch?{background:ch.color,color:'#fff',borderColor:ch.color,boxShadow:`0 0 12px ${ch.glow}`}:ch?{borderColor:ch.color+'44',color:ch.color+'aa'}:i===0?{background:'var(--accent)',color:'#fff',borderColor:'var(--accent)'}:{}}>{isC?String(item).slice(0,15):ntc(item)}</div>;})}</div>

        <div className="display-stats">{[{v:game.playerCount,c:'var(--cyan)',l:'Players'},{v:game.totalCards,c:'var(--accent)',l:'Cards'},{v:game.winners.length,c:'var(--gold)',l:'Winners'}].map(s=><div key={s.l} className="stat"><div className="stat-value" style={{color:s.c}}>{s.v}</div><div className="stat-label">{s.l}</div></div>)}</div>

        {game.winners.length>0&&<div style={{width:'100%',marginTop:'0.5rem'}}>{game.winners.map((w:any,i:number)=><div key={i} style={{display:'flex',alignItems:'center',gap:'0.5rem',padding:'0.5rem 0.75rem',marginBottom:'0.25rem',background:'#ffd70011',borderRadius:'8px',border:'1px solid #ffd70033'}}><span style={{fontSize:'1.2rem'}}>🏆</span><span style={{fontWeight:600,fontSize:'0.85rem'}}>{w.displayName||w.username}</span><span style={{fontFamily:"'Space Mono',monospace",fontSize:'0.7rem',color:'var(--text-dim)',marginLeft:'auto'}}>on {ntc(w.wonOnItem)}</span></div>)}</div>}

        {/* Head-to-Head Race */}
        {game.leaderboard&&game.leaderboard.length>0&&game.calledNumbers.length>0&&(
          <div style={{width:'100%',marginTop:'0.75rem',position:'relative'}}>
            <div style={{fontSize:'0.8rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-dim)',marginBottom:'0.6rem'}}>🔥 Race to Bingo</div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.4rem',maxHeight:'320px',overflow:'auto'}}>
              {game.leaderboard.slice(0,10).map((p:LB,i:number)=>{
                const pct=Math.round((p.progress/p.total)*100);
                const need=p.total-p.progress;
                const isTop=i<3&&!p.isWinner;
                const barColor=p.isWinner?'#ffd700':i===0?'#00ff88':i===1?'#00e5ff':i===2?'#ff6b35':'#666';

                return<div key={i}
                  onMouseEnter={()=>p.bestCard&&setHoverIdx(i)}
                  onMouseLeave={()=>setHoverIdx(null)}
                  style={{
                    padding:i<3?'0.6rem 0.75rem':'0.45rem 0.75rem',
                    borderRadius:'10px',position:'relative',overflow:'hidden',cursor:p.bestCard?'pointer':'default',
                    background:hoverIdx===i?'#ffffff12':p.isWinner?'#ffd70010':isTop?'#ffffff0a':'#ffffff05',
                    border:`1px solid ${hoverIdx===i?barColor+'66':p.isWinner?'#ffd70044':isTop?barColor+'30':'#ffffff0a'}`,
                    transition:'all 0.3s ease',
                  }}>
                  <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${pct}%`,
                    background:`linear-gradient(90deg,${barColor}20,${barColor}10)`,
                    borderRadius:'10px',transition:'width 1s cubic-bezier(0.25,1,0.5,1)'}}/>

                  <div style={{position:'relative',display:'flex',alignItems:'center',gap:'0.6rem'}}>
                    <div style={{
                      minWidth:i<3?'2rem':'1.6rem',height:i<3?'2rem':'1.6rem',
                      borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center',
                      background:p.isWinner?'#ffd700':isTop?barColor+'22':'transparent',
                      border:`1.5px solid ${p.isWinner?'#ffd700':isTop?barColor:'#333'}`,
                    }}>
                      <span style={{fontFamily:"'Space Mono',monospace",fontSize:i<3?'0.9rem':'0.75rem',fontWeight:900,
                        color:p.isWinner?'#000':barColor}}>
                        {p.isWinner?'W':i+1}
                      </span>
                    </div>

                    <span style={{fontSize:i<3?'0.95rem':'0.82rem',fontWeight:i<3?700:500,flex:1,
                      whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',
                      color:p.isWinner?'#ffd700':i<3?'#fff':'#aaa'}}>
                      {p.displayName}
                    </span>

                    <div style={{display:'flex',alignItems:'center',gap:'0.5rem',flexShrink:0}}>
                      {!p.isWinner&&need>0&&<span style={{fontSize:'0.65rem',color:'#555',fontFamily:"'Space Mono',monospace"}}>
                        {need} away
                      </span>}
                      <span style={{fontFamily:"'Space Mono',monospace",fontSize:i<3?'0.85rem':'0.72rem',fontWeight:900,color:barColor}}>
                        {p.label}
                      </span>
                    </div>
                  </div>

                  {i<3&&<div style={{position:'relative',marginTop:'0.4rem',height:4,borderRadius:3,background:'#ffffff0a',overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${pct}%`,borderRadius:3,
                      background:`linear-gradient(90deg,${barColor}88,${barColor})`,
                      boxShadow:`0 0 10px ${barColor}66`,
                      transition:'width 1s cubic-bezier(0.25,1,0.5,1)'}}/>
                  </div>}
                </div>;})}
            </div>

            {/* Hover card preview */}
            {hoverIdx!==null&&game.leaderboard[hoverIdx]?.bestCard&&(()=>{
              const p=game.leaderboard[hoverIdx];const grid=p.bestCard!;
              const colColors=['#ff6b35','#00e5ff','#00ff88','#ffd700','#ff3366'];
              return<div style={{
                position:'absolute',right:'calc(100% + 12px)',top:0,
                background:'#0c0c1a',border:'1px solid #2a2a3a',borderRadius:'12px',
                padding:'0.75rem',zIndex:50,boxShadow:'0 8px 32px #00000088',
                minWidth:'220px',
              }}>
                <div style={{fontSize:'0.75rem',fontWeight:700,marginBottom:'0.4rem',color:'#fff'}}>{p.displayName}</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'2px',marginBottom:'0.3rem'}}>
                  {'BINGO'.split('').map((l,ci)=><div key={l} style={{textAlign:'center',fontSize:'0.65rem',fontWeight:900,color:colColors[ci],padding:'2px 0'}}>{l}</div>)}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'2px'}}>
                  {grid.flat().map((cell:any,ci:number)=>{
                    const isFree=cell==='FREE';
                    const marked=isFree||game.calledNumbers.includes(cell);
                    const colIdx=ci%5;
                    return<div key={ci} style={{
                      width:'100%',aspectRatio:'1',display:'flex',alignItems:'center',justifyContent:'center',
                      borderRadius:'4px',fontSize:isFree?'0.5rem':'0.65rem',fontWeight:700,
                      fontFamily:"'Space Mono',monospace",
                      background:isFree?'#3d2a5c':marked?colColors[colIdx]:'#16162a',
                      color:isFree?'#ffd700':marked?'#fff':'#444',
                      border:`1px solid ${marked?'transparent':'#2a2a3a'}`,
                    }}>{isFree?'★':typeof cell==='number'?cell:String(cell).slice(0,3)}</div>;
                  })}
                </div>
                <div style={{fontSize:'0.6rem',color:'#666',marginTop:'0.3rem',fontFamily:"'Space Mono',monospace",textAlign:'center'}}>{p.label}</div>
              </div>;
            })()}
          </div>
        )}
      </div>

      <div className="display-board">
        {isC?<div style={{display:'flex',flexWrap:'wrap',gap:'6px',flex:1,alignContent:'flex-start'}}>{game.itemPool?.map((item:string)=>{const cl=called.has(item);const ij=item===latest&&isNew;
          return<div key={item} style={{padding:'0.5rem 0.75rem',borderRadius:'8px',fontFamily:"'Space Mono',monospace",fontSize:'clamp(0.6rem,0.9vw,0.85rem)',fontWeight:700,transition:'all 0.3s',background:cl?'var(--accent)':'var(--surface)',border:`1px solid ${cl?'var(--accent)':'var(--border)'}`,color:cl?'#fff':'#555',boxShadow:cl?'0 0 12px var(--accent-glow)':'none',animation:ij?'cell-pop 0.6s ease':'none'}}>{item}</div>;})}</div>
        :<><div className="board-header">{COLS.map(c=><div key={c.letter} className={`board-letter board-letter-${c.letter}`}>{c.letter}</div>)}</div>
          <div className="board-grid">{Array.from({length:15},(_,row)=>COLS.map(col=>{const num=col.min+row;const cl=called.has(num);const ij=num===latest&&isNew;
            return<div key={num} className={`board-cell ${cl?`called called-${col.letter}`:''} ${ij?'just-called':''}`} style={cl?{background:col.color,boxShadow:`0 0 15px ${col.glow}`}:{}}>{num}</div>;}))}</div></>}
      </div>
    </div>

    {showW&&<div className="display-winner-overlay" onClick={()=>setShowW(null)}><div className="winner-announce"><h2>🎱 BINGO! 🎱</h2><div className="winner-name">{showW.displayName||showW.username}</div><div className="winner-detail">Won on {ntc(showW.wonOnItem)} · Card #{showW.cardIndex+1}</div></div></div>}
  </div>);
}

import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

const halfDay=43200000;
export const shiftStart=at=>Math.floor((at-1800000)/halfDay)*halfDay+1800000;
function accrue(s,old,ms,mtc,dandori){
  const validM=mtc!==null&&old.mtc!==null;
  const validD=dandori!==null&&old.dandori!==null;
  if(validM){
    s.mtcKnown+=ms;
    if(old.mtc===1)s.mtcMs+=ms;
  }
  if(validD){
    s.dandoriKnown+=ms;
    if(old.dandori===1)s.dandoriMs+=ms;
  }
  if(validM&&validD){
    s.covered+=ms;
    if(old.mtc===1||old.dandori===1)s.down+=ms;
  }
}
export function sampleShift(old,at,mtc,dandori,archive=()=>{}){
  if(old&&at<=old.at)return old;
  const start=shiftStart(at);
  const s=old?.start===start?{...old}:{start,covered:0,down:0,mtcMs:0,dandoriMs:0,mtcKnown:0,dandoriKnown:0};
  if(old&&at-old.at<=12000){
    if(old.start!==start){
      const tail={...old,at:start};
      accrue(tail,old,start-old.at,mtc,dandori);
      archive(tail);
    }
    accrue(s,old,at-Math.max(start,old.at),mtc,dandori);
  }
  return {...s,at,mtc,dandori};
}

export function startSignals(root,save){
  let child,pending=false,requestedAt=0,last=null,stopped=false;
  function record(at,m,d){
    const file=start=>join(root,'private','signals-'+start+'.json');
    if(!last&&existsSync(file(shiftStart(at))))last=JSON.parse(readFileSync(file(shiftStart(at)),'utf8'));
    const next=sampleShift(last,at,m,d,tail=>save(file(tail.start),tail));
    save(file(next.start),next);last=next;
  }
  function tick(){
    if(stopped)return;
    if(pending){if(Date.now()-requestedAt>10000)child?.kill();return;}
    if(!child){
      const proc=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Add-Type -Path './ChamperSignals.cs' -ErrorAction Stop; [ChamperSignals]::Run()"],{cwd:root,windowsHide:true,stdio:['pipe','pipe','ignore']});
      child=proc;
      const reset=()=>{if(child===proc){pending=false;child=null;}};
      proc.on('error',reset);proc.on('exit',reset);proc.stdin.on('error',()=>proc.kill());
      createInterface({input:proc.stdout}).on('line',line=>{
        if(child!==proc||!pending)return;
        pending=false;
        const match=/^([01?]) ([01?])$/.exec(line);
        const bit=x=>x==='0'?0:x==='1'?1:null;
        try {record(Date.now(),bit(match?.[1]),bit(match?.[2]));}
        catch {last=null;console.error('Pencatatan durasi sinyal lokal gagal.');}
      });
    }
    requestedAt=Date.now();pending=true;child.stdin.write('read\n');
  }
  const timer=setInterval(tick,5000);tick();
  return {latest:()=>last,close(){stopped=true;clearInterval(timer);child?.stdin.end();}};
}

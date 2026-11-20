// Illustrative machines and parts. Everything on this path is generated in the browser.
const layout = {
  1:['Roll','Champer manual','Press 1','Argon','Silencer','Auxiliary','Press 2'],
  2:['Assembly','TIG weld'],
  3:['Robot 1','Robot 2','Robot 3','Robot 4','Robot 14','Robot 11'],
  4:['Robot 5','Robot 6','Robot 7','Argon A','Argon B','SPM rotary','SPM'],
  5:['Spot A','Spot B','Spot C','Spot D','Spot E','Robot 8','Robot 12','Robot 9','Robot 13','Buffing'],
  6:['Press','Remer','Bending NC','Brazing','Inspection'],
  7:['Bending CNC','Laser A','Laser B','Press'],
  8:['Longpipe'],
  99:['AUTO CHAMPER']
};
const statuses=['run','run','setup','run','off','down','run','stale'];
function exampleMachine(line,name,i) {
  const seed=line+i;
  return {
    id:'demo-'+line+'-'+i, line, name, parts:['CONTOH-'+line+'-'+(i+1)], ct:8+seed%17,
    status:line===99?'run':statuses[seed%statuses.length], target:200+(seed%6)*50,
    actual:30+(seed*19)%140, base:1000
  };
}
const machines = Object.entries(layout).flatMap(([line,names]) => names.map((name,i) => exampleMachine(Number(line),name,i)));

export function startSimulatedFloor(roster,now=Date.now()) {
  const perLine=new Map();
  return roster.map(({line,name,id},i) => {
    const index=perLine.get(line)??0;
    perLine.set(line,index+1);
    const machine=exampleMachine(line,name,index);
    const actual=machine.status==='off'?0:machine.actual;
    const runSeconds=Math.ceil(actual*machine.ct/(0.78+(i%17)/100));
    const plannedSeconds=Math.ceil(runSeconds/(0.80+(i%16)/100));
    return {...machine,id,actual,runSeconds,plannedSeconds,cycleProgress:0,
      updated:now-(machine.status==='stale'?180000:0)};
  });
}

export function advanceSimulatedFloor(list,step,now=Date.now()) {
  return list.map((m,i)=>{
    let status=m.status;
    if(step%4===0 && i===Math.floor(step/4-1)%list.length && m.line!==99){
      status=status==='run'?'setup':'run';
    }
    if(status==='off'||status==='stale')return m;
    const running=status==='run'?5:0;
    const credit=m.cycleProgress+running;
    return {...m,status,actual:m.actual+Math.floor(credit/m.ct),cycleProgress:credit%m.ct,
      runSeconds:m.runSeconds+running,plannedSeconds:m.plannedSeconds+5,updated:now};
  });
}
const jobs = [];
for (let offset=-13;offset<=0;offset++) {
  for (const shift of [1,2]) {
    for (const [i,machine] of machines.entries()) {
      const seed=(offset+14)*17+shift*7+i, planned=7*3600;
      const run=planned-(seed%15)*240, target=Math.floor(planned/machine.ct);
      const gross=Math.floor(run/machine.ct*(0.79+seed%20/100));
      const reject=seed%6,repair=seed%4;
      jobs.push({line:machine.line,machine:machine.name,part:machine.parts[0],offset,shift,
        target,ok:gross-repair-reject,repair,reject,planned,run,ideal:gross*machine.ct,labor:planned});
    }
  }
}
export default {machines,jobs};

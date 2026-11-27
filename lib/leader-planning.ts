import {readCardData} from './telegram-card-cache';
import {sqlDatabase} from './sql-intake';

type Part = {line:string; machine:string; part:string; targetQty?:number; ct?:number; ctDate?:string};
type Plan = Part & {hours?:number; plannedCt?:number|null; manualQty?:boolean};
type Target = {date:string; shift:string; line:string; version:number; items:Plan[]};
const key = (item:Part) => JSON.stringify([item.line,item.machine,item.part]);

async function planningMetadata(date: string) {
  const sql=sqlDatabase();
  const [catalog,history]=await Promise.all([
    sql`SELECT source_date::text AS day, rates FROM leader_cycle_catalog WHERE singleton`,
    sql`SELECT shift,line,version,items FROM leader_target_hours WHERE production_date=${date}::date`,
  ]);
  return {rates:catalog[0] ?? null,history};
}

export async function enrichPlanning(data:{date:string;catalog:Part[];targets:Target[]}, cardShift?: string) {
  const load = () => planningMetadata(data.date);
  const {rates,history} = cardShift
    ? (await readCardData('planning',data.date,cardShift,load)).data
    : await load();
  for(const item of data.catalog){
    const seconds=rates?.rates[key(item)];
    if(Number.isFinite(seconds)&&seconds>0){item.ct=seconds;item.ctDate=rates.day;}
  }
  for(const target of data.targets){
    const row=history.find(r=>r.line===target.line&&r.shift===String(target.shift)&&r.version===target.version);
    if(!row)continue;
    for(const item of target.items){
      const plan=(row.items as Plan[]).find(p=>key(p)===key(item)&&p.targetQty===item.targetQty);
      if(plan)Object.assign(item,{hours:plan.hours,manualQty:plan.manualQty,plannedCt:plan.plannedCt});
    }
  }
}
export async function savePlanning(target:Target,version:number){
  const items=target.items.filter(p=>typeof p.hours==='number'&&Number.isFinite(p.hours)&&p.hours>0)
    .map(({line,machine,part,targetQty,hours,plannedCt,manualQty})=>({line,machine,part,targetQty,hours,plannedCt,manualQty}));
  if(!items.length)return;
  const sql=sqlDatabase();
  await sql`INSERT INTO leader_target_hours(production_date,shift,line,version,items)
    VALUES(${target.date}::date,${target.shift},${target.line},${version},${JSON.stringify(items)}::jsonb)
    ON CONFLICT DO NOTHING`;
}

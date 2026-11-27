import type { LkhForm } from "./lkh";
export type OperatorActor = { id: string; name: string; lines: string[] };
export function includeReporter(form:LkhForm, name:string, options:string[], line:string):LkhForm {
  const helpers=form.operator.filter(o=>o!==name);
  if(options.includes(name))return {...form,operator:[name,...helpers]};
  const extra=form.operatorLainnya.split(",").map(s=>s.trim()).filter(s=>s && s!==name);
  return {...form,operator:["__other_option__",...helpers.filter(o=>o!=="__other_option__")],
    operatorLainnya:(line==="LINE_PENCUCIAN" ? [name,...extra] : [name]).join(", ")};
}

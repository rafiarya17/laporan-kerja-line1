import {sqlDatabase} from './sql-intake';

// Target completion counts operator submissions, including those still awaiting review.
export async function targetProgress(date:string,shift:string,line:string) {
  const rows=await sqlDatabase()`SELECT id,payload->>'line' AS line,payload->'form'->>'shift' AS shift,
    payload->'form'->>'mesin' AS machine,
    COALESCE(leader_review->>'deliveryPart',payload->'form'->>'part') AS part,
    COALESCE(leader_review->'corrected'->>'qtyOk',payload->'form'->>'qtyOk') AS ok
    FROM lkh_reports WHERE leader_review IS NOT NULL
      AND (payload->>'line' ~ '^LINE_[1-8]$' OR (payload->>'line'='LINE_99' AND leader_review->>'testOnly'='true'))
      AND payload->'form'->>'tanggal'=${date}
      AND (${shift}::text='all' OR payload->'form'->>'shift'=${shift})
      AND (${line}::text='' OR payload->>'line'=${line})
    ORDER BY received_at,id`;
  return {date,shift,reportLine:line,reports:rows.map(({id,line,shift,machine,part,ok})=>({
    id,line,workspaceShift:shift,machine,part,input:{ok:Number(ok)},viewOnly:true,
  }))};
}

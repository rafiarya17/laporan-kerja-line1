const {test}=require('node:test'),assert=require('node:assert/strict');
const {targetSelection}=require('../public/leader-core.js');
const catalog=[{line:'LINE_99',machine:'AUTO CHAMPER',part:'PIPE A'},{line:'LINE_1',machine:'AUTO CHAMPER',part:'PIPE A'},{line:'LINE_99',machine:'PRESS DUMMY',part:'BODY_DUMMY-A'}];
test('target selection retains all current Champer and dummy quantities',()=>{
 const items=[{...catalog[0],targetQty:200},{...catalog[2],targetQty:30}];
 assert.deepEqual(targetSelection(items,catalog,'LINE_99'),{items,invalid:[]});
});
test('old spelling resolves only to one authoritative same-line machine and part',()=>{
 const r=targetSelection([{line:'LINE_99',machine:' auto champer ',part:'pipe a',targetQty:200}],catalog,'LINE_99');
 assert.deepEqual(r.items,[{...catalog[0],targetQty:200}]);assert.deepEqual(r.invalid,[]);
});
test('removed parts, cross-line items and ambiguous names require explicit review',()=>{
 const removed={line:'LINE_99',machine:'AUTO CHAMPER',part:'REMOVED',targetQty:4},cross={...catalog[1],targetQty:10};
 assert.deepEqual(targetSelection([removed,cross],catalog,'LINE_99').invalid,[removed,cross]);
 const ambiguous={line:'LINE_99',machine:'auto champer',part:'pipe a',targetQty:4};
 assert.deepEqual(targetSelection([ambiguous],[catalog[0],{...catalog[0],part:'Pipe A'}],'LINE_99').invalid,[ambiguous]);
});

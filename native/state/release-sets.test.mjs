import test from 'node:test';
import assert from 'node:assert/strict';
import {missingVolumes, releaseSets, sameRelease} from './release-sets.js';
const source=(index,number,provider='MediaFire',variant='Base')=>({id:`pegasus-0-7-${index}`,provider,label:`EUR ${variant} - ${provider} part ${number}`,volume:`part ${number}`,url:`https://files.example/${index}`,filename:`${index}.binary`,format:'binary'});
test('numbered volumes group by record, provider and variant, ordered numerically without mixing repeated sequences',()=>{
 const sets=releaseSets([source(0,2),source(1,1),source(2,1),source(3,1,'VikingFile'),source(4,1,'MediaFire','Backport')]);
 assert.equal(sets.length,4);assert.deepEqual(sets[0].parts.map(p=>p.number),[1,2]);assert.equal(sets[0].parts[0].sources.length,1);
 assert.equal(sets[0].url,undefined);assert.equal(sets[0].format,'archive-set');
});
test('missing volumes fail explicitly and unrelated records never merge',()=>{
 const missing=releaseSets([source(0,1),source(1,3)])[0];assert.match(missing.unavailableReason,/missing volumes/);
 const other={...source(0,2),id:'pegasus-0-8-0'};assert.equal(releaseSets([source(0,1),other]).length,2);
});
test('manifests and whole files retain their download identities',()=>{
 const release={id:'spectrum-2-0',manifestUrl:'https://example.com/parts.json',format:'ffpfsc'};
 assert.equal(releaseSets([release])[0],release);
});

test('multipart passwords are preserved regardless of volume order and conflicts block the set',()=>{
 const grouped=releaseSets([source(0,2),{...source(1,1),archivePassword:'[fixture-password]'}])[0];
 assert.equal(grouped.archivePassword,'[fixture-password]');
 assert.equal(grouped.unavailableReason,undefined);
 const conflict=releaseSets([{...source(0,1),archivePassword:'fixture-password'},
  {...source(1,2),archivePassword:'[fixture-password]'}])[0];
 assert.match(conflict.unavailableReason,/conflicting passwords/);
});

test('Split Fiction-style repeated part one starts a separate archive set',()=>{
 const sets=releaseSets([source(0,1,'AkiraBox'),source(1,2,'AkiraBox'),source(2,3,'AkiraBox'),...Array.from({length:8},(_,i)=>source(i+3,i+1,'AkiraBox'))]);
 assert.deepEqual(sets.map(set=>set.parts.length),[3,8]);
 assert.notEqual(sets[0].filename,sets[1].filename);
});

test('set ids follow their content, not the feed order',()=>{
 const a=releaseSets([source(0,1),source(1,2)])[0];
 const moved=releaseSets([{...source(0,1),id:'pegasus-0-9-4',record:'pegasus-0-7'},{...source(1,2),id:'pegasus-0-9-5',record:'pegasus-0-7'}])[0];
 assert.equal(a.parts.length,2);assert.equal(moved.parts.length,2);
 const byContent=list=>releaseSets(list.map(r=>({...r,id:`r-${r.url.split('/').pop()}`,record:'rec'})))[0].id;
 assert.equal(byContent([source(0,1),source(1,2)]),byContent([source(1,2),source(0,1)]));
});

test('a job saved under a feed-position id still matches its release by link',()=>{
 const old={id:'pegasus-2-398-2',url:'https://files.example/a'};
 assert.equal(sameRelease(old,{id:'r0123456789ab',url:'https://files.example/a'}),true);
 assert.equal(sameRelease(old,{id:'r0123456789ab',url:'https://files.example/b'}),false);
 const set=releaseSets([source(0,1),source(1,2)])[0];
 assert.equal(sameRelease({...set,id:'pegasus-0-7-1a2b-set'},{...set,id:'set-ffff'}),true);
 assert.equal(sameRelease({...set,id:'x',parts:set.parts.slice(0,1)},set),false);
});

const GB=1024**3;
const volumes=(count,{name=n=>`[fixture-password]-PPSA03671.part${String(n).padStart(2,'0')}.rar`,bytes=()=>9.9*GB}={})=>
 Array.from({length:count},(_,i)=>({number:i+1,name:name(i+1),bytes:bytes(i+1)}));
test('a set the feed cut short is found by its file names and sizes',()=>{
 assert.equal(missingVolumes(volumes(9),95*GB),'last');
 assert.equal(missingVolumes(volumes(4,{name:n=>`PPSA28000.part${n}.rar`}),48*GB),'last');
 assert.equal(missingVolumes(volumes(8,{name:n=>`PPSA26679.part${n+1}.rar`})),'renumbered');
 assert.equal(missingVolumes(volumes(5,{name:n=>n===1?'PPSA30223-app0.part1.rar':`PPSA30223.part${n-1}.rar`})),'renumbered');
 assert.equal(missingVolumes([1,3].map(number=>({number}))),'gap');
 assert.equal(missingVolumes(volumes(1,{name:()=>'game.part1.rar'})),'count');
});
test('a whole set passes, and full volumes are proof enough when the game size is unknown',()=>{
 assert.equal(missingVolumes(volumes(10,{bytes:n=>n===10?5.6*GB:9.9*GB}),95*GB),null);
 assert.equal(missingVolumes(volumes(7,{bytes:n=>n===7?1.25*GB:9.9*GB}),95*GB),null);
 // Assassin's Creed Black Flag: 60.00 GB of volumes for a game of 60.13 GB is a rounding, not a missing volume.
 assert.equal(missingVolumes(volumes(6,{name:n=>`PPSA1.part${n}.rar`,bytes:()=>10*GB}),60.13*GB),null);
 assert.equal(missingVolumes(volumes(5,{name:n=>`PPSA28000.part${n}.rar`,bytes:n=>n===5?7.4*GB:9.9*GB}),48*GB),null);
 assert.equal(missingVolumes(volumes(3,{name:n=>`PPSA28416.part${n}.rar`})),'last');
 assert.equal(missingVolumes(volumes(4,{name:n=>`PPSA28000.part${n}.rar`,bytes:n=>n===4?2*GB:9.9*GB})),null);
 assert.equal(missingVolumes(volumes(3,{name:()=>'FW_4xx_backport_files.zip',bytes:()=>0.06*GB}),29*GB),null);
 assert.equal(missingVolumes(volumes(3,{name:()=>undefined,bytes:()=>undefined})),null);
});
test('a set whose links name too few volumes is unavailable before any host is asked',()=>{
 const named=(index,number,file=number+1)=>({...source(index,number),url:`https://www.mediafire.com/file/k${index}/[fixture-password]-PPSA26679.part${file}.rar/file`});
 assert.match(releaseSets([named(0,1),named(1,2)])[0].unavailableReason,/missing volumes/);
 assert.equal(releaseSets([named(0,1,1),named(1,2,2)])[0].unavailableReason,undefined);
 assert.equal(releaseSets([source(0,1),source(1,2)])[0].unavailableReason,undefined);
});
test('a host spelled two ways within one set keeps its volumes together',()=>{
 const rootz=(index,number,provider)=>({...source(index,number,provider),label:`EUR Base - Rootz part ${number}`});
 const sets=releaseSets([rootz(0,1,'www.rootz.so'),rootz(1,2,'www.rootz.so'),rootz(2,3,'rootz.so')]);
 assert.equal(sets.length,1);assert.deepEqual(sets[0].parts.map(p=>p.number),[1,2,3]);assert.equal(sets[0].unavailableReason,undefined);
});
test('a set joined from two spellings of its host is named apart from the half that stood alone',()=>{
 const rootz=(index,number,provider)=>({...source(index,number,provider),label:`EUR Base - Rootz part ${number}`});
 const half=releaseSets([rootz(0,1,'www.rootz.so'),rootz(1,2,'www.rootz.so')])[0];
 const whole=releaseSets([rootz(0,1,'www.rootz.so'),rootz(1,2,'www.rootz.so'),rootz(2,3,'rootz.so')])[0];
 assert.notEqual(whole.id,half.id);assert.equal(sameRelease(half,whole),false);
});

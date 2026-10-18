import assert from 'node:assert/strict';
import {observedHighUse} from '../watering-model.js';

const start=Date.parse('2026-10-10T00:00:00Z'),now=start+6*864e5;
const make=losses=>losses.flatMap((loss,d)=>Array.from({length:72},(_,i)=>({
  weight_g:1000-loss*i/72,
  measured_at:new Date(start+d*864e5+i*12e5).toISOString()
})));
const clean=make([6,10,14,18]);
const result=observedHighUse(clean,{now});
assert.equal(result.qualifyingDays,4);
assert.equal(result.usedDays,2);
assert.ok(Math.abs(result.rate-16)<1e-8);
assert.equal(observedHighUse(make([6,10]),{now}).rate,null);
for(const disturbedWeight of [1050,8]){
  const disturbed=make([6,10,14,18]);
  disturbed[2*72+30].weight_g=disturbedWeight;
  assert.equal(observedHighUse(disturbed,{now}).qualifyingDays,3);
}
const gaps=clean.filter((_,i)=>!(i>=2*72+20&&i<2*72+30));
assert.equal(observedHighUse(gaps,{now}).qualifyingDays,3);
assert.equal(observedHighUse(clean,{now:start+864e5}).rate,null);
assert.equal(observedHighUse(clean,{now,dry:1000}).rate,null);
assert.equal(observedHighUse(clean,{now:now+31*864e5}).rate,null);
console.log('Measured water-use checks passed.');

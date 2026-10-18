import assert from 'node:assert/strict';
import {irrigationState} from '../irrigation-state.js';
const start=Date.parse('2026-10-01T00:00:00Z');
const row=(minutes,weight,run_id='plant-run')=>({measured_at:new Date(start+minutes*60000).toISOString(),weight_g:weight,run_id});
const before=Array.from({length:37},(_,i)=>row(i*20,550-i*.1));
const full=[...before,row(740,640),row(760,639.8)];
const options={dry:525,wet:640,now:start+760*60000};
let state=irrigationState(full,options);
assert.equal(state.recent,true);assert.ok(state.refill.gain>90);
assert.equal(state.six.rate,null);assert.equal(state.six.reason,'refill');assert.equal(state.twelve.rate,null);
const after=[...before,...Array.from({length:40},(_,i)=>row(740+i*20,640-i*.1))];
state=irrigationState(after,{...options,now:start+1520*60000});
assert.ok(Math.abs(state.six.rate-7.2)<1e-6);assert.ok(Math.abs(state.twelve.rate-7.2)<1e-6);
assert.equal(state.recent,false);
state=irrigationState([...before,row(740,0),row(760,546.4),row(780,546.3)],{...options,now:start+780*60000});
assert.equal(state.refill,null);assert.equal(state.six.rate,null);
state=irrigationState([...before,row(740,-8),row(760,640)],options);
assert.equal(state.recent,true);assert.ok(state.refill.gain<100);
state=irrigationState([...before,row(740,554.4)],options);
assert.equal(state.refill,null); // A small zero shift is not a confirmed refill.
state=irrigationState([row(0,530),row(300,640)],{...options,now:start+320*60000});
assert.equal(state.refill,null); // An unexplained long gap isn't evidence of watering.
state=irrigationState([...before,row(740,640,'new-run')],options);
assert.equal(state.refill,null);
state=irrigationState(Array.from({length:40},(_,i)=>row(i*20,600+i*.01)),{...options,now:start+780*60000});
assert.equal(state.six.rate,null);assert.equal(state.six.reason,'settling');
assert.equal(irrigationState([...full,row(780,0)],{...options,now:start+780*60000}).potRemoved,true);
console.log('Passed: refill reset, post-refill rates, pot removal/return, small zero shifts, gaps, separate runs and rising-weight suppression.');

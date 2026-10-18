import assert from 'node:assert/strict';
import {waterPlan} from '../watering-model.js';

const plan=(current,addition,wet=640)=>waterPlan({current,addition,wet,dry:525,rate:14});
assert.equal(plan(600,40).permitted,true);
assert.equal(plan(600,40).target,640);
assert.equal(plan(600,41).permitted,false);
assert.equal(plan(600,200).days,null);
assert.equal(plan(600,200).suggested,40);
assert.equal(plan(640,1).permitted,false);
assert.equal(plan(645,1).suggested,0);
assert.equal(plan(645,1).permitted,false);
assert.equal(plan(600,20,null).permitted,false);
assert.equal(plan(600,20,null).suggested,null);
assert.equal(plan(600,0).permitted,false);
assert.equal(plan(600,-1).permitted,false);
assert.equal(waterPlan({current:600,addition:40,wet:640,dry:null}).permitted,true);
assert.equal(waterPlan({current:600,addition:40,wet:640,dry:null}).days,null);
console.log('Watering capacity checks passed.');

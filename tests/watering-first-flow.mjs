import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as model from '../watering-model.js';
const elements=new Map(),timers=new Map(),intervals=[],requests=[];
let now=0,timerId=0;
function el(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,disabled:false,className:'',classList:{toggle(){}},setAttribute(){},removeAttribute(){},handlers:{},addEventListener(k,f){this.handlers[k]=f;}});return elements.get(id);}
const context=vm.createContext({...model,URL,URLSearchParams,AbortController,TypeError,SyntaxError,Error,Number,Math,Date:class extends Date{static now(){return now;}},performance:{now:()=>now},location:{search:''},localStorage:{getItem:()=>null,setItem(){}},window:{addEventListener(){}},document:{querySelector:el,querySelectorAll:()=>[]},setInterval:f=>intervals.push(f),setTimeout:(f,delay)=>{const id=++timerId;timers.set(id,{f,delay});return id;},clearTimeout:id=>timers.delete(id),fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve})),console});
let src=fs.readFileSync(new URL('../watering.js',import.meta.url),'utf8');
src=src.replace(/^import[^\n]+\n/,'').replace(/init\(\)\.catch\([\s\S]*$/,'');
vm.runInContext(src,context);

const run=s=>vm.runInContext(s,context);
run("setContext({nickname:'Pot A',code:'Mini01',mass:534,low:525,high:null,dailyLoss:7.3});receive(534);");
assert.equal(el('#start-watering').disabled,false);assert.equal(el('#watering-target-controls').hidden,true);assert.equal(el('#first-watering').hidden,false);
el('#start-watering').handlers.click();assert.equal(run('running'),true);assert.equal(el('#save-full-controls').hidden,true);
now+=500;run('receive(600)');assert.equal(el('#added-weight').textContent,'66.0 g');assert.equal(el('#remaining-metric').hidden,true);
el('#end-watering').handlers.click();assert.equal(run('running'),false);assert.equal(el('#save-full-weight').disabled,true);
for(let i=0;i<8;i++){now+=500;run('receive(640)');}
assert.equal(run('stableFullWeight()'),640);assert.equal(el('#save-full-weight').disabled,true);
el('#drained-confirm').checked=true;el('#drained-confirm').handlers.change();assert.equal(el('#save-full-weight').disabled,false);
run("connectionStore={plantId:'pot-a',userId:'owner',deviceId:'mini01',client:{from(table){return {update(payload){saveWrites.push({table,payload,filters:[]});return this;},eq(k,v){saveWrites.at(-1).filters.push([k,v]);return this;},select(){return this;},maybeSingle:async()=>({data:{id:'pot-a'}})}}}};");
context.saveWrites=[];
await el('#save-full-weight').handlers.click();assert.equal(context.saveWrites.length,1);assert.deepEqual(JSON.parse(JSON.stringify(context.saveWrites[0])),{table:'plants',payload:{learned_saturated_g:640,provisional_saturated_g:640},filters:[['id','pot-a'],['user_id','owner'],['device_id','mini01']]});
assert.equal(run('wet'),640);assert.equal(el('#first-watering').hidden,true);assert.equal(el('#start-watering').disabled,true);
// Stale and moving weights cannot be saved, even if a click is invoked directly.
run("setContext({nickname:'Unknown',code:'Mini01',mass:534,low:525,high:null});");el('#drained-confirm').checked=true;
for(let i=0;i<8;i++){now+=500;run('receive(640)');}
now+=4000;assert.equal(run('stableFullWeight()'),null);await el('#save-full-weight').handlers.click();assert.equal(context.saveWrites.length,1);
for(let i=0;i<8;i++){now+=500;run('receive('+(600+i*10)+')');}assert.equal(run('stableFullWeight()'),null);
console.log('Passed: first watering starts without a goal, gain tracking, drained confirmation, stable fresh save, owner/device scoping, transition to capacity limit, stale/moving save rejection.');

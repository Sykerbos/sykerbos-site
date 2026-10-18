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
run("setContext({nickname:'Pot A',code:'Mini01',mass:-5,low:525,high:null,dailyLoss:7.3});endpoint='http://192.168.1.234/live';tareSupported=true;receive(-5);");
assert.equal(el('#zero-tile').disabled,true);
el('#empty-tile-confirm').checked=true;el('#empty-tile-confirm').handlers.change();assert.equal(el('#zero-tile').disabled,false);
run('receive(540)');assert.equal(el('#zero-tile').disabled,true);await el('#zero-tile').handlers.click();assert.equal(requests.length,0);
run('receive(-5)');const post=el('#zero-tile').handlers.click();assert.equal(run('zeroing'),true);assert.equal(el('#start-watering').disabled,true);
assert.equal(requests[0].url,'http://192.168.1.234/tare');assert.equal(requests[0].options.method,'POST');assert.deepEqual(JSON.parse(requests[0].options.body),{device_code:'Mini01',confirm_empty:true});assert.equal(requests[0].options.credentials,'omit');
requests[0].resolve({status:202,json:async()=>({device_code:'Mini01',tare_id:1,tare_status:'pending'})});await post;assert.equal(run('tareRequestId'),1);
const get=run('poll()');now+=50;requests[1].resolve({ok:true,headers:{get:()=> 'application/json'},json:async()=>({device_code:'Mini01',weight_g:0,sample_seq:2,sample_age_ms:18,can_tare:true,tare_id:1,tare_status:'done'})});await get;
assert.equal(run('zeroing'),false);assert.equal(el('#empty-tile-confirm').checked,false);assert.match(el('#zero-help').textContent,/Zero saved on the tile/);assert.equal(el('#live-weight').textContent,'0');
run('tareSupported=false;updatePlan()');el('#empty-tile-confirm').checked=true;await el('#zero-tile').handlers.click();assert.equal(requests.length,2);
run('tareSupported=true;receive(-5)');const wrong=el('#zero-tile').handlers.click();requests[2].resolve({status:202,json:async()=>({device_code:'Mini02',tare_id:9,tare_status:'pending'})});await wrong;assert.equal(run('zeroing'),false);assert.match(el('#zero-help').textContent,/Could not confirm/);
now+=4000;await el('#zero-tile').handlers.click();assert.equal(requests.length,3);
console.log('Passed: empty confirmation, loaded/stale/old-firmware rejection, identity-scoped POST, pending controls, matching completion and wrong-device response handling.');

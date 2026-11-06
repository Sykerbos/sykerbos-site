import assert from 'node:assert/strict';
import {plantState} from '../plant-state.js';
import {plantTrendModel,dayBoundaries} from '../plant-trend-model.js';
import {plantTrendSvg} from '../plant-trend-render.js';
const DAY=86400000,now=Date.parse('2026-11-06T00:00:00Z'),start=now-18*DAY;
const rows=Array.from({length:1297},(_,i)=>({weight_g:i<72?540-i*.1:i<1008?640-(i-72)*.11:638-(i-1008)*.16,temperature_c:21+Math.sin(i/12)*.7,measured_at:new Date(start+i*1200000).toISOString(),run_id:'current'}));
const plant={learned_saturated_g:640,provisional_dry_g:525};
const view=plantState(plant,rows,{now}),m=plantTrendModel(rows,view);
assert.ok(m.previousRefill);assert.ok(m.refill);assert.ok(m.start<m.refill.t-10*DAY);
assert.equal(m.forecast.length,13);assert.equal(m.forecast.at(-1).t,now+3*DAY);assert.equal(m.forecast[0].w,view.latest.w);
assert.ok(m.forecast.every((p,i)=>!i||p.w<=m.forecast[i-1].w));assert.ok(m.tempHi-m.tempLo>=6);assert.ok(m.ticks.length>=18);
assert.equal(m.method,'cycle-adjusted');
const svg=plantTrendSvg(m,{width:330});assert.match(svg,/viewBox="0 0 330 398"/);assert.match(svg,/trend-day/);assert.match(svg,/trend-temperature/);assert.match(svg,/trend-forecast/);assert.match(svg,/trend-previous/);assert.doesNotMatch(svg,/NaN|undefined/);
const hidden=plantTrendSvg(m,{width:800,forecast:false,temperature:false,previous:false});assert.doesNotMatch(hidden,/class="trend-forecast"|class="trend-temperature"|class="trend-previous"/);
const day=plantTrendModel(rows,view,{range:'24'});assert.equal(day.forecast.length,0);assert.ok(day.start>=now-DAY);
const stale=plantTrendModel(rows,plantState(plant,rows,{now:now+2*3600000}));assert.equal(stale.forecast.length,0);
const lifted=[...rows,{weight_g:0,temperature_c:21,measured_at:new Date(now+1000).toISOString(),run_id:'current'}];
assert.equal(plantTrendModel(lifted,plantState(plant,lifted,{now:now+1000})).forecast.length,0);
// An interruption inside the last day suppresses the projection even on return.
const interrupted=rows.map((r,i)=>i===rows.length-10?{...r,weight_g:0}:r);
assert.equal(plantTrendModel(interrupted,plantState(plant,interrupted,{now})).forecast.length,0);
const noTemp=rows.map(r=>({...r,temperature_c:-127}));assert.equal(plantTrendModel(noTemp,plantState(plant,noTemp,{now})).temperature.length,0);
assert.deepEqual(plantTrendModel([],plantState({},[],{now})).current,[]);
// Calendar boundaries retain local midnight through the fall clock change.
process.env.TZ='America/New_York';const ticks=dayBoundaries(Date.parse('2026-10-31T20:00:00Z'),Date.parse('2026-11-03T20:00:00Z'));
assert.ok(ticks.every(t=>new Date(t).getHours()===0));assert.ok(ticks.some((t,i)=>i&&t-ticks[i-1]===25*3600000));
process.env.TZ='America/Vancouver';assert.ok(dayBoundaries(Date.parse('2026-10-31T20:00:00Z'),Date.parse('2026-11-03T20:00:00Z')).every(t=>new Date(t).getHours()===0));
console.log('Passed: real-date cycles, three-day anchored projection, no forecast through interruptions/offline, readable temperature range, optional layers and local day boundaries across DST.');

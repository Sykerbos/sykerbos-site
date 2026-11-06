const date=t=>new Date(t).toLocaleDateString(undefined,{day:'numeric',month:'short'});
export function plantTrendSvg(model,{width=800,temperature=true,previous=true,forecast=true}={}){
 if(model.potCount<2)return '<div class="chart-loading">More pot readings are needed for this range.</div>';
 const w=Math.max(260,width),height=temperature&&model.temperature.length?398:302;
 const left=48,right=w-18,top=30,bottom=238,tempTop=306,tempBottom=366;
 const future=forecast&&model.forecast.length>1,plotEnd=future?model.plotEnd:model.end;
 const x=t=>left+(t-model.start)/Math.max(1,plotEnd-model.start)*(right-left);
 const y=v=>top+(model.hi-v)/(model.hi-model.lo)*(bottom-top);
 const ty=v=>tempTop+(model.tempHi-v)/(model.tempHi-model.tempLo)*(tempBottom-tempTop);
 const path=(points,getY,kind='weight')=>{
  let d='',gap=true,last=null;
  for(const p of points){
   if(kind==='weight'&&(model.spikes.has(p)||p.w<model.emptyFloor)){gap=true;continue;}
   if(last!==null&&p.t-last>90*60000&&kind!=='forecast')gap=true;
   d+=(gap?'M':'L')+x(p.t).toFixed(1)+','+getY(kind==='temperature'?p.temp:p.w).toFixed(1)+' ';gap=false;last=p.t;
  }return d;
 };
 const ticks=model.ticks.filter(t=>t<=plotEnd),labelMax=Math.max(2,Math.floor((right-left)/78)),step=Math.max(1,Math.ceil(ticks.length/labelMax));
 let grid=ticks.map(t=>`<line x1="${x(t)}" y1="${top}" x2="${x(t)}" y2="${temperature&&model.temperature.length?tempBottom:bottom}" class="trend-day"/>`).join('');
 const labelTicks=ticks.filter((_,i)=>i%step===0).filter(t=>x(t)>left+65&&x(t)<right-65);
 const dates=[{t:model.start,anchor:'start'},...labelTicks.map(t=>({t,anchor:'middle'})),{t:plotEnd,anchor:'end'}];
 grid+=dates.map(({t,anchor})=>`<text x="${x(t)}" y="263" text-anchor="${anchor}" class="trend-axis">${date(t)}</text>`).join('');
 for(const [value,yy] of [[model.hi,top],[Math.round((model.lo+model.hi)/2),(top+bottom)/2],[model.lo,bottom]])grid+=`<line x1="${left}" y1="${yy}" x2="${right}" y2="${yy}" class="trend-grid"/><text x="${left-8}" y="${yy+4}" text-anchor="end" class="trend-axis">${value}</text>`;
 const forecastArea=future?`<rect x="${x(model.end)}" y="${top}" width="${Math.max(0,right-x(model.end))}" height="${bottom-top}" class="trend-future-area"/><line x1="${x(model.end)}" x2="${x(model.end)}" y1="${top}" y2="${bottom}" class="trend-now"/><text x="${x(model.end)+5}" y="20" class="trend-axis">Now</text>`:'';
 let curves=previous&&model.previous.length?`<path d="${path(model.previous,y)}" class="trend-previous"/>`:'';
 curves+=`<path d="${path(model.current,y)}" class="trend-current"/>`;
 if(future)curves+=`<path d="${path(model.forecast,y,'forecast')}" class="trend-forecast"/>`;
 let marker='';if(model.refill&&model.refill.t>=model.start){const xx=x(model.refill.t),yy=y(model.refill.w);marker=`<circle cx="${xx}" cy="${yy}" r="4" class="trend-refill"/><text x="${Math.max(left+5,Math.min(right-75,xx+8))}" y="${Math.min(bottom-12,yy+19)}" class="trend-watering-label">Watered</text>`;}
 let temp='';if(temperature&&model.temperature.length){temp=`<text x="${left}" y="292" class="trend-axis">Temperature · °C</text><text x="${left-8}" y="${tempTop+4}" text-anchor="end" class="trend-axis">${model.tempHi}</text><text x="${left-8}" y="${tempBottom+4}" text-anchor="end" class="trend-axis">${model.tempLo}</text><path d="${path(model.temperature,ty,'temperature')}" class="trend-temperature"/>`;}
 return `<svg viewBox="0 0 ${w} ${height}" role="img" aria-label="Pot weight in grams with daily divisions${previous&&model.previous.length?', previous cycle':''}${future?', three-day weight projection':''}${temp?', measured temperature in degrees Celsius below':''}"><defs><clipPath id="plant-trend-clip"><rect x="${left-3}" y="${top-5}" width="${right-left+6}" height="${bottom-top+10}"/></clipPath></defs><text x="${left}" y="17" class="trend-axis">Pot weight · g</text>${forecastArea}${grid}<g clip-path="url(#plant-trend-clip)">${curves}${marker}</g>${temp}</svg>`;
}

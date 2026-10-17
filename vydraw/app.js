(() => {
  const svg = document.getElementById('drawing');
  const viewport = document.getElementById('viewport');
  const entitiesG = document.getElementById('entities');
  const labelsG = document.getElementById('labels');
  const commandInput = document.getElementById('commandInput');
  const objectList = document.getElementById('objectList');
  const jsonPreview = document.getElementById('jsonPreview');
  const gridRect = document.getElementById('gridRect');

  let drawing = freshDrawing();
  let history = [];
  let future = [];
  let view = { x: 0, y: 0, scale: 3 };
  let drag = null;
  let segmentDrag = null;
  let vertexDrag = null;
  let selectedSegment = null;

  function freshDrawing(){
    return {
      units:'mm',
      partNumber:'VTR-100',
      revision:'Rev A',
      currentLayer:'FIXED',
      pointLabels:false,
      layers:['REFERENCE','FIXED','LIVE','DIMENSION'],
      points:{},
      entities:[],
      dimensions:[]
    };
  }

  function snapshot(){ history.push(JSON.stringify(drawing)); if(history.length>50) history.shift(); future=[]; }
  function restore(serialized){ drawing=JSON.parse(serialized); if(!drawing.currentLayer) drawing.currentLayer='FIXED'; render(); }
  function fmt(n){ return Number(Number(n).toFixed(3)); }
  function layerClass(layer){ return 'layer-' + String(layer||'FIXED').toLowerCase(); }

  function addSegmentVisual(ent, entityIndex, a, b, segmentIndex){
    const cls='entity '+layerClass(ent.layer)+(selectedSegment && selectedSegment.entityIndex===entityIndex && selectedSegment.segmentIndex===segmentIndex?' selected-segment':'');
    entitiesG.appendChild(el('line',{
      x1:a[0],y1:a[1],x2:b[0],y2:b[1],
      class:cls
    }));
    const hit=el('line',{
      x1:a[0],y1:a[1],x2:b[0],y2:b[1],
      class:'segment-hit',
      'data-entity-index':entityIndex,
      'data-segment-index':segmentIndex
    });
    entitiesG.appendChild(hit);
  }

  function addVertexHandles(ent, entityIndex){
    if(ent.type!=='polyline') return;
    ent.points.forEach((p,vertexIndex)=>{
      const h=el('circle',{
        cx:p[0],cy:p[1],r:2.2,
        class:'vertex-handle',
        'data-entity-index':entityIndex,
        'data-vertex-index':vertexIndex
      });
      entitiesG.appendChild(h);
    });
  }

  function beginVertexDrag(e, entityIndex, vertexIndex){
    const ent=drawing.entities[entityIndex];
    if(!ent || ent.type!=='polyline' || !ent.points[vertexIndex]) return false;
    snapshot();
    const p=[...ent.points[vertexIndex]];
    vertexDrag={
      entityIndex,vertexIndex,
      startX:e.clientX,startY:e.clientY,
      point:p
    };
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('vertex-dragging');
    return true;
  }

  function moveVertex(e){
    if(!vertexDrag) return;
    const ent=drawing.entities[vertexDrag.entityIndex];
    const dx=(e.clientX-vertexDrag.startX)/view.scale;
    const dy=-(e.clientY-vertexDrag.startY)/view.scale;
    ent.points[vertexDrag.vertexIndex]=[
      fmt(vertexDrag.point[0]+dx),
      fmt(vertexDrag.point[1]+dy)
    ];
    render();
  }

  function endVertexDrag(){
    if(!vertexDrag) return;
    vertexDrag=null;
    svg.classList.remove('vertex-dragging');
    render();
  }

  function beginSegmentDrag(e, entityIndex, segmentIndex){
    const ent=drawing.entities[entityIndex];
    if(!ent || ent.type!=='polyline') return false;
    const count=ent.points.length;
    const i1=segmentIndex;
    const i2=(segmentIndex+1)%count;
    if(i1<0 || i1>=count || i2<0 || i2>=count) return false;

    snapshot();
    selectedSegment={entityIndex,segmentIndex};
    const a=[...ent.points[i1]], b=[...ent.points[i2]];
    const horizontal=Math.abs(a[1]-b[1])<0.0001;
    const vertical=Math.abs(a[0]-b[0])<0.0001;
    segmentDrag={
      entityIndex,segmentIndex,i1,i2,
      startX:e.clientX,startY:e.clientY,
      a,b,horizontal,vertical
    };
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('segment-dragging');
    return true;
  }

  function moveSegment(e){
    if(!segmentDrag) return;
    const ent=drawing.entities[segmentDrag.entityIndex];
    const dx=(e.clientX-segmentDrag.startX)/view.scale;
    const dy=-(e.clientY-segmentDrag.startY)/view.scale;

    if(segmentDrag.horizontal){
      ent.points[segmentDrag.i1]=[segmentDrag.a[0],fmt(segmentDrag.a[1]+dy)];
      ent.points[segmentDrag.i2]=[segmentDrag.b[0],fmt(segmentDrag.b[1]+dy)];
    } else if(segmentDrag.vertical){
      ent.points[segmentDrag.i1]=[fmt(segmentDrag.a[0]+dx),segmentDrag.a[1]];
      ent.points[segmentDrag.i2]=[fmt(segmentDrag.b[0]+dx),segmentDrag.b[1]];
    } else {
      ent.points[segmentDrag.i1]=[fmt(segmentDrag.a[0]+dx),fmt(segmentDrag.a[1]+dy)];
      ent.points[segmentDrag.i2]=[fmt(segmentDrag.b[0]+dx),fmt(segmentDrag.b[1]+dy)];
    }
    render();
  }

  function endSegmentDrag(){
    if(!segmentDrag) return;
    segmentDrag=null;
    svg.classList.remove('segment-dragging');
    render();
  }

  function addPoint(name,x,y){ drawing.points[name]=[fmt(x),fmt(y)]; }
  function addLine(a,b){
    if(!drawing.points[a] || !drawing.points[b]) throw new Error(`Unknown point: ${!drawing.points[a]?a:b}`);
    drawing.entities.push({type:'line',from:a,to:b,layer:drawing.currentLayer});
  }
  function addRect(x,y,w,h){ drawing.entities.push({type:'rect',x:fmt(x),y:fmt(y),width:fmt(w),height:fmt(h),layer:drawing.currentLayer}); }
  function addCircle(x,y,r){ drawing.entities.push({type:'circle',cx:fmt(x),cy:fmt(y),r:fmt(r),layer:drawing.currentLayer}); }
  function addHexAF(af){
    const R=af/Math.sqrt(3), pts=[];
    for(let i=0;i<6;i++){
      const angle=(-90+i*60)*Math.PI/180;
      pts.push([fmt(R*Math.cos(angle)),fmt(R*Math.sin(angle))]);
    }
    drawing.entities.push({type:'polygon',points:pts,closed:true,layer:drawing.currentLayer,meta:{shape:'hexagon',acrossFlats:fmt(af)}});
  }
  function addPolyline(name, coords, closed){
    if(coords.length<4 || coords.length%2!==0) throw new Error('POLYLINE needs at least two x y coordinate pairs');
    const pts=[];
    for(let i=0;i<coords.length;i+=2) pts.push([fmt(Number(coords[i])),fmt(Number(coords[i+1]))]);
    if(pts.some(p=>!Number.isFinite(p[0])||!Number.isFinite(p[1]))) throw new Error('POLYLINE contains an invalid coordinate');
    drawing.entities.push({type:'polyline',name,points:pts,closed,layer:drawing.currentLayer});
  }
  function addDim(a,b){
    if(!drawing.points[a] || !drawing.points[b]) throw new Error('DIM needs two named points');
    drawing.dimensions.push({type:'named',from:a,to:b,layer:'DIMENSION'});
  }
  function addDimXY(x1,y1,x2,y2,offset=12){
    drawing.dimensions.push({type:'xy',a:[fmt(x1),fmt(y1)],b:[fmt(x2),fmt(y2)],offset:fmt(offset),layer:'DIMENSION'});
  }

  function executeSingle(cmd){
    const t=cmd.trim().split(/\s+/);
    const op=t[0].toUpperCase();

    if(op==='POINT'){
      if(t.length!==4) throw new Error('POINT name x y');
      addPoint(t[1],Number(t[2]),Number(t[3]));

    } else if(op==='LAYER'){
      if(t.length!==2) throw new Error('LAYER name');
      const layer=t[1].toUpperCase();
      if(!drawing.layers.includes(layer)) drawing.layers.push(layer);
      drawing.currentLayer=layer;

    } else if(op==='POINTLABELS'){
      if(t.length!==2 || !['ON','OFF'].includes(t[1].toUpperCase())) throw new Error('POINTLABELS ON or POINTLABELS OFF');
      drawing.pointLabels=t[1].toUpperCase()==='ON';

    } else if(op==='LINE'){
      const assigned=cmd.match(/^LINE\s+\w+=\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)\s+\w+=\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/i);
      if(assigned){
        const n=drawing.entities.length+Object.keys(drawing.points).length;
        const a=`_L${n}A`, b=`_L${n}B`;
        addPoint(a,Number(assigned[1]),Number(assigned[2]));
        addPoint(b,Number(assigned[3]),Number(assigned[4]));
        addLine(a,b);
      } else if(t.length===5 && t.slice(1).every(v=>Number.isFinite(Number(v)))){
        const n=drawing.entities.length+Object.keys(drawing.points).length;
        const a=`_L${n}A`, b=`_L${n}B`;
        addPoint(a,Number(t[1]),Number(t[2]));
        addPoint(b,Number(t[3]),Number(t[4]));
        addLine(a,b);
      } else if(t.length===3){
        addLine(t[1],t[2]);
      } else {
        throw new Error('Use LINE A B, LINE 0 0 100 25, or LINE A=(0,0) B=(100,25)');
      }

    } else if(op==='POLYLINE'){
      if(t.length<6) throw new Error('POLYLINE name x1 y1 x2 y2 ... [CLOSE]');
      const name=t[1];
      const closed=t[t.length-1].toUpperCase()==='CLOSE';
      const raw=closed?t.slice(2,-1):t.slice(2);
      addPolyline(name,raw,closed);

    } else if(op==='RECT'){
      if(t.length!==5) throw new Error('RECT x y width height');
      addRect(...t.slice(1).map(Number));

    } else if(op==='CIRCLE'){
      if(t.length!==4) throw new Error('CIRCLE x y radius');
      addCircle(...t.slice(1).map(Number));

    } else if(op==='HEX'){
      const afToken=t.find(v=>v.toUpperCase().startsWith('AF='));
      if(!afToken) throw new Error('HEX AF=200');
      addHexAF(Number(afToken.split('=')[1]));

    } else if(op==='DIM'){
      if(t.length!==3) throw new Error('DIM pointA pointB');
      addDim(t[1],t[2]);

    } else if(op==='DIMXY'){
      if(t.length!==5 && t.length!==7) throw new Error('DIMXY x1 y1 x2 y2 [OFFSET n]');
      if(t.length===7 && t[5].toUpperCase()!=='OFFSET') throw new Error('Use DIMXY x1 y1 x2 y2 OFFSET n');
      const nums=t.slice(1,5).map(Number);
      const offset=t.length===7?Number(t[6]):12;
      addDimXY(...nums,offset);

    } else if(op==='CLEAR'){
      drawing=freshDrawing();

    } else {
      throw new Error(`Unknown command: ${op}`);
    }
  }

  function execute(raw){
    const lines=raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if(!lines.length) return;
    snapshot();
    try{
      for(const line of lines) executeSingle(line);
      render();
    }catch(err){
      const prev=history.pop();
      if(prev) drawing=JSON.parse(prev);
      render();
      throw err;
    }
  }

  function el(name,attrs={}){
    const e=document.createElementNS('http://www.w3.org/2000/svg',name);
    for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,v);
    return e;
  }

  function render(){
    entitiesG.innerHTML=''; labelsG.innerHTML='';

    for(const [name,[x,y]] of Object.entries(drawing.points)){
      entitiesG.appendChild(el('circle',{cx:x,cy:y,r:1.5,class:'point'}));
      if(drawing.pointLabels && !name.startsWith('_L')){
        const txt=el('text',{x:x+3,y:y-3,class:'label'});
        txt.textContent=`${name} (${x}, ${y})`;
        labelsG.appendChild(txt);
      }
    }

    drawing.entities.forEach(ent=>{
      let e;
      const cls=`entity ${layerClass(ent.layer)}`;
      if(ent.type==='line'){
        const a=drawing.points[ent.from], b=drawing.points[ent.to];
        e=el('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:cls});
      } else if(ent.type==='rect'){
        e=el('rect',{x:ent.x,y:ent.y,width:ent.width,height:ent.height,class:cls});
      } else if(ent.type==='circle'){
        e=el('circle',{cx:ent.cx,cy:ent.cy,r:ent.r,class:cls});
      } else if(ent.type==='polygon'){
        e=el('polygon',{points:ent.points.map(p=>p.join(',')).join(' '),class:cls});
      } else if(ent.type==='polyline'){
        const last=ent.closed?ent.points.length:ent.points.length-1;
        for(let s=0;s<last;s++){
          const a=ent.points[s];
          const b=ent.points[(s+1)%ent.points.length];
          addSegmentVisual(ent,drawing.entities.indexOf(ent),a,b,s);
        }
      }
      if(e) entitiesG.appendChild(e);
    });

    drawing.entities.forEach((ent,i)=>addVertexHandles(ent,i));

    drawing.dimensions.forEach(dim=>{
      const a=dim.type==='xy'?dim.a:drawing.points[dim.from];
      const b=dim.type==='xy'?dim.b:drawing.points[dim.to];
      const dx=b[0]-a[0], dy=b[1]-a[1];
      const d=Math.hypot(dx,dy);
      if(!d) return;
      const offset=dim.offset ?? 12;
      const nx=-dy/d, ny=dx/d;
      const da=[a[0]+nx*offset,a[1]+ny*offset];
      const db=[b[0]+nx*offset,b[1]+ny*offset];
      labelsG.appendChild(el('line',{x1:a[0],y1:a[1],x2:da[0],y2:da[1],class:'extension'}));
      labelsG.appendChild(el('line',{x1:b[0],y1:b[1],x2:db[0],y2:db[1],class:'extension'}));
      labelsG.appendChild(el('line',{x1:da[0],y1:da[1],x2:db[0],y2:db[1],class:'dimension'}));
      const tx=(da[0]+db[0])/2 + nx*3;
      const ty=(da[1]+db[1])/2 + ny*3;
      const txt=el('text',{x:tx,y:ty,class:'dimtext'});
      txt.textContent=`${fmt(d)} mm`;
      labelsG.appendChild(txt);
    });

    drawing.partNumber=document.getElementById('partNumber').value;
    drawing.revision=document.getElementById('revision').value;
    jsonPreview.textContent=JSON.stringify(drawing,null,2);

    objectList.innerHTML='';
    const rows=[`Active layer: ${drawing.currentLayer}`];
    Object.keys(drawing.points).forEach(k=>rows.push(`Point ${k}`));
    drawing.entities.forEach((e,i)=>{ rows.push(`${i+1}. ${e.type}${e.name?` ${e.name}`:''} [${e.layer||'FIXED'}]${e.meta?.shape?` — ${e.meta.shape}`:''}`); if(e.type==='polyline'){ const count=e.closed?e.points.length:e.points.length-1; for(let s=0;s<count;s++) rows.push(`   ${e.name||'POLY'}-S${s+1}`); } });
    drawing.dimensions.forEach(d=>rows.push(d.type==='xy'?'DIMXY':'DIM '+d.from+' → '+d.to));
    if(rows.length===1) rows.push('No objects yet.');
    rows.forEach(r=>{const d=document.createElement('div');d.className='obj';d.textContent=r;objectList.appendChild(d);});

    document.getElementById('status').textContent=`Origin (0,0) • Units: mm • Layer: ${drawing.currentLayer} • Drag line = move • Drag green node = reshape`;
    updateTransform();
  }

  function updateTransform(){
    const cx=svg.clientWidth/2, cy=svg.clientHeight/2;
    viewport.setAttribute('transform',`translate(${cx+view.x} ${cy+view.y}) scale(${view.scale} ${-view.scale})`);
    labelsG.querySelectorAll('text').forEach(t=>{
      t.setAttribute('transform',`scale(1,-1) translate(0,${-2*Number(t.getAttribute('y')||0)})`);
    });
  }

  function fitView(){
    const box=entitiesG.getBBox();
    if(!isFinite(box.width) || (box.width===0 && box.height===0)){ view={x:0,y:0,scale:3}; updateTransform(); return; }
    const sx=(svg.clientWidth-100)/(box.width||1), sy=(svg.clientHeight-100)/(box.height||1);
    view.scale=Math.max(.1,Math.min(20,Math.min(sx,sy)));
    view.x=-(box.x+box.width/2)*view.scale;
    view.y=(box.y+box.height/2)*view.scale;
    updateTransform();
  }

  function download(name,text,type){
    const blob=new Blob([text],{type});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=name; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function exportSVG(){
    const clone=svg.cloneNode(true);
    const bbox=entitiesG.getBBox(), pad=20;
    clone.setAttribute('viewBox',`${bbox.x-pad} ${bbox.y-pad} ${Math.max(1,bbox.width+2*pad)} ${Math.max(1,bbox.height+2*pad)}`);
    clone.setAttribute('width',`${Math.max(1,bbox.width+2*pad)}mm`);
    clone.setAttribute('height',`${Math.max(1,bbox.height+2*pad)}mm`);
    clone.querySelector('#viewport').removeAttribute('transform');
    const gr=clone.querySelector('#gridRect'); if(gr) gr.remove();
    const axes=clone.querySelector('#axes'); if(axes) axes.remove();
    download(`${drawing.partNumber}_${drawing.revision.replace(/\s+/g,'-')}.svg`,
      new XMLSerializer().serializeToString(clone),'image/svg+xml');
  }

  document.getElementById('runCommand').onclick=()=>{
    try{execute(commandInput.value);commandInput.value='';}
    catch(e){alert(e.message);}
  };
  commandInput.addEventListener('keydown',e=>{
    if((e.ctrlKey || e.metaKey) && e.key==='Enter'){
      e.preventDefault();
      document.getElementById('runCommand').click();
    }
  });

  document.getElementById('demoHex').onclick=()=>{ snapshot(); drawing=freshDrawing(); addHexAF(200); render(); fitView(); };
  document.getElementById('fitView').onclick=fitView;
  document.getElementById('toggleGrid').onclick=()=>{ gridRect.style.display=gridRect.style.display==='none'?'':'none'; };
  document.getElementById('undoBtn').onclick=()=>{ if(!history.length)return; future.push(JSON.stringify(drawing)); restore(history.pop()); };
  document.getElementById('redoBtn').onclick=()=>{ if(!future.length)return; history.push(JSON.stringify(drawing)); restore(future.pop()); };
  document.getElementById('exportSvg').onclick=exportSVG;
  document.getElementById('exportJson').onclick=()=>{
    drawing.partNumber=document.getElementById('partNumber').value;
    drawing.revision=document.getElementById('revision').value;
    download(`${drawing.partNumber}_${drawing.revision.replace(/\s+/g,'-')}.json`,JSON.stringify(drawing,null,2),'application/json');
  };

  ['partNumber','revision'].forEach(id=>document.getElementById(id).addEventListener('input',render));

  svg.addEventListener('wheel',e=>{
    e.preventDefault();
    const factor=e.deltaY<0?1.12:0.89;
    view.scale=Math.max(.05,Math.min(50,view.scale*factor));
    updateTransform();
  },{passive:false});

  svg.addEventListener('pointerdown',e=>{
    const vertex=e.target.closest && e.target.closest('.vertex-handle');
    if(vertex){
      e.preventDefault();
      e.stopPropagation();
      beginVertexDrag(e,Number(vertex.dataset.entityIndex),Number(vertex.dataset.vertexIndex));
      return;
    }
    const hit=e.target.closest && e.target.closest('.segment-hit');
    if(hit){
      e.preventDefault();
      e.stopPropagation();
      beginSegmentDrag(e,Number(hit.dataset.entityIndex),Number(hit.dataset.segmentIndex));
      return;
    }
    drag={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};
    svg.setPointerCapture(e.pointerId); svg.classList.add('dragging');
  });
  svg.addEventListener('pointermove',e=>{
    if(vertexDrag){ moveVertex(e); return; }
    if(segmentDrag){ moveSegment(e); return; }
    if(!drag)return;
    view.x=drag.vx+(e.clientX-drag.x);
    view.y=drag.vy+(e.clientY-drag.y);
    updateTransform();
  });
  svg.addEventListener('pointerup',()=>{
    if(vertexDrag){ endVertexDrag(); return; }
    if(segmentDrag){ endSegmentDrag(); return; }
    drag=null;svg.classList.remove('dragging');
  });
  svg.addEventListener('pointercancel',()=>{
    if(vertexDrag){ endVertexDrag(); }
    if(segmentDrag){ endSegmentDrag(); }
    drag=null;svg.classList.remove('dragging');
  });

  window.addEventListener('resize',updateTransform);
  render();
})();
(() => {
  const BUILD='DEV 1.1.1';
  const runtimeVersion=document.getElementById('runtimeVersion');
  if(runtimeVersion) runtimeVersion.textContent=BUILD;
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
  let selectedEntity = null;
  let selectedDimension = null;
  let drawMode = null;
  let objectMove = null;
  let shapeHandleDrag = null;

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

  function worldCenter(){
    return [fmt(-view.x/view.scale), fmt(view.y/view.scale)];
  }

  function screenToWorld(e){
    const rect=svg.getBoundingClientRect();
    const cx=svg.clientWidth/2, cy=svg.clientHeight/2;
    return [
      fmt((e.clientX-rect.left-cx-view.x)/view.scale),
      fmt(-(e.clientY-rect.top-cy-view.y)/view.scale)
    ];
  }

  function setCadHint(text){
    const hint=document.getElementById('cadHint');
    if(hint) hint.textContent=text;
  }

  function setCadCommand(text){
    const input=document.getElementById('cadCommand');
    if(input) input.value=text;
  }

  function finishDrawMode(){
    if(!drawMode) return;
    drawMode=null;
    svg.classList.remove('drawing-mode');
    setCadHint('Ready');
    render();
  }

  function cancelDrawMode(){
    if(!drawMode) return;
    if(drawMode.snapshot) drawing=JSON.parse(drawMode.snapshot);
    drawMode=null;
    svg.classList.remove('drawing-mode');
    setCadHint('Cancelled');
    render();
  }

  function startLineMode(length=null){
    drawMode={tool:'LINE',length:(Number.isFinite(length)&&length>0)?length:null,points:[],snapshot:JSON.stringify(drawing),entityIndex:null};
    svg.classList.add('drawing-mode');
    setCadHint(length ? ('LINE '+length+' mm — click start point') : 'LINE — click first point');
  }

  function startRectMode(width,height){
    if(!(width>0&&height>0)){ alert('Use RECT width height, e.g. RECT 120 40'); return; }
    drawMode={tool:'RECT',width,height,snapshot:JSON.stringify(drawing)};
    svg.classList.add('drawing-mode');
    setCadHint('RECT '+width+' × '+height+' mm — click placement point');
  }

  function startCircleMode(radius){
    if(!(radius>0)){ alert('Use CIRCLE radius, e.g. CIRCLE 20'); return; }
    drawMode={tool:'CIRCLE',radius,snapshot:JSON.stringify(drawing)};
    svg.classList.add('drawing-mode');
    setCadHint('CIRCLE R'+radius+' mm — click centre');
  }

  function runCadCommand(raw){
    const text=raw.trim();
    if(!text) return;
    const t=text.split(/\s+/);
    const op=t[0].toUpperCase();
    if(op==='LINE'){
      if(t.length===1) startLineMode(null);
      else if(t.length===2 && Number(t[1])>0) startLineMode(Number(t[1]));
      else alert('Use LINE or LINE 100');
    } else if(op==='RECT' || op==='RECTANGLE'){
      if(t.length===3) startRectMode(Number(t[1]),Number(t[2]));
      else alert('Use RECT width height, e.g. RECT 120 40');
    } else if(op==='SQUARE'){
      if(t.length===2 && Number(t[1])>0) startRectMode(Number(t[1]),Number(t[1]));
      else alert('Use SQUARE size, e.g. SQUARE 40');
    } else if(op==='CIRCLE'){
      if(t.length===2) startCircleMode(Number(t[1]));
      else alert('Use CIRCLE radius, e.g. CIRCLE 20');
    } else if(op==='MOVE' || op==='M'){
      armMove();
    } else if(op==='DIM' || op==='DIMENSION'){
      dimensionSelected();
      setCadHint('Dimension added');
    } else if(op==='DELETE' || op==='DEL'){
      deleteSelection();
      setCadHint('Selection deleted');
    } else if(op==='CLEARDIMS' || op==='DELDIMS'){
      clearDimensions();
      setCadHint('Dimensions cleared');
    } else if(op==='ESC' || op==='CANCEL'){
      cancelDrawMode();
    } else {
      alert('Commands: LINE, LINE 100, RECT 120 40, SQUARE 40, CIRCLE 20, M/MOVE, DIM, DELETE, CLEARDIMS');
    }
  }

  function handleDrawClick(e){
    if(!drawMode) return false;
    const p=screenToWorld(e);
    if(drawMode.tool==='CIRCLE'){
      snapshot();
      drawing.entities.push({type:'circle',name:nextName('CIRCLE'),cx:p[0],cy:p[1],r:fmt(drawMode.radius),layer:drawing.currentLayer});
      finishDrawMode();
      return true;
    }
    if(drawMode.tool==='RECT'){
      snapshot();
      drawing.entities.push({type:'rect',name:nextName('RECT'),x:p[0],y:p[1],width:fmt(drawMode.width),height:fmt(drawMode.height),layer:drawing.currentLayer});
      finishDrawMode();
      return true;
    }
    if(drawMode.tool==='LINE'){
      if(drawMode.points.length===0){
        snapshot();
        drawMode.points.push(p);
        drawing.entities.push({type:'polyline',name:nextName('LINE'),points:[p],closed:false,layer:drawing.currentLayer});
        drawMode.entityIndex=drawing.entities.length-1;
        setCadHint(drawMode.length ? ('Click direction for '+drawMode.length+' mm segment') : 'Click next point • Enter/Space to finish');
        render();
        return true;
      }
      const ent=drawing.entities[drawMode.entityIndex];
      const start=ent.points[ent.points.length-1];
      let end=p;
      if(drawMode.length){
        const dx=p[0]-start[0], dy=p[1]-start[1];
        const d=Math.hypot(dx,dy);
        if(d<0.0001) return true;
        end=[fmt(start[0]+dx/d*drawMode.length),fmt(start[1]+dy/d*drawMode.length)];
      }
      ent.points.push(end);
      drawMode.points.push(end);
      setCadHint(drawMode.length ? (drawMode.length+' mm added • click next direction • Enter/Space to finish') : 'Segment added • click next point • Enter/Space to finish');
      render();
      return true;
    }
    return false;
  }
  function selectEntity(index){
    selectedDimension=null;
    selectedEntity=index;
    if(selectedSegment && selectedSegment.entityIndex!==index) selectedSegment=null;
    render();
  }

  function entityAnchorSnapshot(ent){
    if(ent.type==='polyline') return {points:ent.points.map(p=>[...p])};
    if(ent.type==='line') return {a:[...drawing.points[ent.from]],b:[...drawing.points[ent.to]]};
    if(ent.type==='rect') return {x:ent.x,y:ent.y,width:ent.width,height:ent.height};
    if(ent.type==='circle') return {cx:ent.cx,cy:ent.cy,r:ent.r};
    if(ent.type==='polygon') return {points:ent.points.map(p=>[...p])};
    return {};
  }

  function startObjectMove(e,index){
    const ent=drawing.entities[index];
    if(!ent) return;
    snapshot();
    selectedEntity=index;
    objectMove={entityIndex:index,startX:e.clientX,startY:e.clientY,base:entityAnchorSnapshot(ent)};
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('object-moving');
    setCadHint('Move selected object');
  }

  function moveObject(e){
    if(!objectMove) return;
    const ent=drawing.entities[objectMove.entityIndex];
    const dx=(e.clientX-objectMove.startX)/view.scale;
    const dy=-(e.clientY-objectMove.startY)/view.scale;
    const b=objectMove.base;
    if(ent.type==='polyline' || ent.type==='polygon'){
      ent.points=b.points.map(p=>[fmt(p[0]+dx),fmt(p[1]+dy)]);
    } else if(ent.type==='line'){
      drawing.points[ent.from]=[fmt(b.a[0]+dx),fmt(b.a[1]+dy)];
      drawing.points[ent.to]=[fmt(b.b[0]+dx),fmt(b.b[1]+dy)];
    } else if(ent.type==='rect'){
      ent.x=fmt(b.x+dx); ent.y=fmt(b.y+dy);
    } else if(ent.type==='circle'){
      ent.cx=fmt(b.cx+dx); ent.cy=fmt(b.cy+dy);
    }
    render();
  }

  function endObjectMove(){
    if(!objectMove) return;
    objectMove=null;
    svg.classList.remove('object-moving');
    setCadHint('Ready');
    render();
  }

  function addShapeHandles(ent,index){
    if(selectedEntity!==index) return;
    if(ent.type==='rect'){
      const corners=[[ent.x,ent.y,'bl'],[ent.x+ent.width,ent.y,'br'],[ent.x+ent.width,ent.y+ent.height,'tr'],[ent.x,ent.y+ent.height,'tl']];
      corners.forEach(([x,y,k])=>entitiesG.appendChild(el('circle',{cx:x,cy:y,r:1.4,class:'shape-handle','data-entity-index':index,'data-handle':k})));
    } else if(ent.type==='circle'){
      entitiesG.appendChild(el('circle',{cx:ent.cx,cy:ent.cy,r:1.4,class:'shape-handle center-handle','data-entity-index':index,'data-handle':'center'}));
      entitiesG.appendChild(el('circle',{cx:ent.cx+ent.r,cy:ent.cy,r:1.4,class:'shape-handle','data-entity-index':index,'data-handle':'radius'}));
    }
  }

  function beginShapeHandleDrag(e,index,handle){
    const ent=drawing.entities[index];
    if(!ent) return;
    snapshot();
    selectedEntity=index;
    shapeHandleDrag={entityIndex:index,handle,startX:e.clientX,startY:e.clientY,base:entityAnchorSnapshot(ent)};
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('shape-editing');
  }

  function moveShapeHandle(e){
    if(!shapeHandleDrag) return;
    const ent=drawing.entities[shapeHandleDrag.entityIndex];
    const p=screenToWorld(e);
    const b=shapeHandleDrag.base;
    if(ent.type==='circle'){
      if(shapeHandleDrag.handle==='center'){ ent.cx=p[0]; ent.cy=p[1]; }
      else ent.r=fmt(Math.max(0.1,Math.hypot(p[0]-ent.cx,p[1]-ent.cy)));
    } else if(ent.type==='rect'){
      let x1=b.x, y1=b.y, x2=b.x+b.width, y2=b.y+b.height;
      if(shapeHandleDrag.handle==='bl'){ x1=p[0]; y1=p[1]; }
      if(shapeHandleDrag.handle==='br'){ x2=p[0]; y1=p[1]; }
      if(shapeHandleDrag.handle==='tr'){ x2=p[0]; y2=p[1]; }
      if(shapeHandleDrag.handle==='tl'){ x1=p[0]; y2=p[1]; }
      ent.x=fmt(Math.min(x1,x2)); ent.y=fmt(Math.min(y1,y2));
      ent.width=fmt(Math.abs(x2-x1)); ent.height=fmt(Math.abs(y2-y1));
    }
    render();
  }

  function endShapeHandleDrag(){
    if(!shapeHandleDrag) return;
    shapeHandleDrag=null;
    svg.classList.remove('shape-editing');
    render();
  }

  function armMove(){
    if(selectedEntity===null){ alert('Select an object first, then use M or MOVE.'); return; }
    setCadHint('MOVE — drag the selected object freely');
    svg.classList.add('move-armed');
  }

  function nextName(prefix){
    let i=1;
    const used=new Set([
      ...Object.keys(drawing.points),
      ...drawing.entities.map(e=>e.name).filter(Boolean)
    ]);
    while(used.has(prefix+i)) i++;
    return prefix+i;
  }

  function addQuickLine(){
    snapshot();
    const [cx,cy]=worldCenter();
    const a=nextName('A'), b=nextName('B');
    addPoint(a,cx-25,cy);
    addPoint(b,cx+25,cy);
    drawing.entities.push({type:'line',name:nextName('LINE'),from:a,to:b,layer:drawing.currentLayer});
    render();
  }

  function addQuickSquare(){
    snapshot();
    const [cx,cy]=worldCenter();
    drawing.entities.push({type:'rect',name:nextName('SQUARE'),x:fmt(cx-20),y:fmt(cy-20),width:40,height:40,layer:drawing.currentLayer});
    render();
  }

  function addQuickCircle(){
    snapshot();
    const [cx,cy]=worldCenter();
    drawing.entities.push({type:'circle',name:nextName('CIRCLE'),cx,cy,r:20,layer:drawing.currentLayer});
    render();
  }

  function selectedEndpoints(){
    if(!selectedSegment) return null;
    const ent=drawing.entities[selectedSegment.entityIndex];
    if(!ent) return null;
    if(ent.type==='line'){
      return [drawing.points[ent.from],drawing.points[ent.to]];
    }
    if(ent.type==='polyline'){
      const i=selectedSegment.segmentIndex;
      const a=ent.points[i];
      const b=ent.points[(i+1)%ent.points.length];
      return [a,b];
    }
    return null;
  }

  function dimensionSelected(){
    const ends=selectedEndpoints();
    if(!ends){ alert('Select a line or profile segment first.'); return; }
    snapshot();
    addDimXY(ends[0][0],ends[0][1],ends[1][0],ends[1][1],12);
    render();
  }

  function saveDraft(){
    drawing.partNumber=document.getElementById('partNumber').value;
    drawing.revision=document.getElementById('revision').value;
    localStorage.setItem('vydraw-draft',JSON.stringify(drawing));
    const btn=document.getElementById('saveDraft');
    if(btn){ const old=btn.textContent; btn.textContent='Saved ✓'; setTimeout(()=>btn.textContent=old,1200); }
  }

  function loadDraft(){
    const raw=localStorage.getItem('vydraw-draft');
    if(!raw){ alert('No saved draft in this browser yet.'); return; }
    snapshot();
    drawing=JSON.parse(raw);
    selectedEntity=null; selectedSegment=null; selectedDimension=null;
    document.getElementById('partNumber').value=drawing.partNumber||'VTR-100';
    document.getElementById('revision').value=drawing.revision||'Rev A';
    render();
    fitView();
  }

  function addSegmentVisual(ent, entityIndex, a, b, segmentIndex){
    const cls='entity '+layerClass(ent.layer)+(selectedEntity===entityIndex?' selected-object':'')+(selectedSegment && selectedSegment.entityIndex===entityIndex && selectedSegment.segmentIndex===segmentIndex?' selected-segment':'');
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
    if(ent.type==='polyline'){
      ent.points.forEach((p,vertexIndex)=>{
        entitiesG.appendChild(el('circle',{cx:p[0],cy:p[1],r:1.4,class:'vertex-handle','data-entity-index':entityIndex,'data-vertex-index':vertexIndex}));
      });
    } else if(ent.type==='line'){
      const a=drawing.points[ent.from], b=drawing.points[ent.to];
      entitiesG.appendChild(el('circle',{cx:a[0],cy:a[1],r:1.4,class:'line-end-handle','data-entity-index':entityIndex,'data-line-end':'from'}));
      entitiesG.appendChild(el('circle',{cx:b[0],cy:b[1],r:1.4,class:'line-end-handle','data-entity-index':entityIndex,'data-line-end':'to'}));
    }
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
    if(!ent) return false;

    snapshot();
    selectedSegment={entityIndex,segmentIndex};

    let a,b,i1=0,i2=1;
    if(ent.type==='polyline'){
      const count=ent.points.length;
      i1=segmentIndex;
      i2=(segmentIndex+1)%count;
      if(i1<0 || i1>=count || i2<0 || i2>=count) return false;
      a=[...ent.points[i1]];
      b=[...ent.points[i2]];
    } else if(ent.type==='line'){
      a=[...drawing.points[ent.from]];
      b=[...drawing.points[ent.to]];
    } else {
      return false;
    }

    const horizontal=Math.abs(a[1]-b[1])<0.0001;
    const vertical=Math.abs(a[0]-b[0])<0.0001;
    segmentDrag={
      entityIndex,segmentIndex,i1,i2,
      startX:e.clientX,startY:e.clientY,
      a,b,horizontal,vertical,
      entityType:ent.type
    };
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('segment-dragging');
    render();
    return true;
  }

  function moveSegment(e){
    if(!segmentDrag) return;
    const ent=drawing.entities[segmentDrag.entityIndex];
    const dx=(e.clientX-segmentDrag.startX)/view.scale;
    const dy=-(e.clientY-segmentDrag.startY)/view.scale;

    let na,nb;
    if(segmentDrag.horizontal){
      na=[segmentDrag.a[0],fmt(segmentDrag.a[1]+dy)];
      nb=[segmentDrag.b[0],fmt(segmentDrag.b[1]+dy)];
    } else if(segmentDrag.vertical){
      na=[fmt(segmentDrag.a[0]+dx),segmentDrag.a[1]];
      nb=[fmt(segmentDrag.b[0]+dx),segmentDrag.b[1]];
    } else {
      na=[fmt(segmentDrag.a[0]+dx),fmt(segmentDrag.a[1]+dy)];
      nb=[fmt(segmentDrag.b[0]+dx),fmt(segmentDrag.b[1]+dy)];
    }

    if(segmentDrag.entityType==='polyline'){
      ent.points[segmentDrag.i1]=na;
      ent.points[segmentDrag.i2]=nb;
    } else if(segmentDrag.entityType==='line'){
      drawing.points[ent.from]=na;
      drawing.points[ent.to]=nb;
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

  function cleanupOrphanPoint(name){
    if(!name || !drawing.points[name]) return;
    const usedByEntity=drawing.entities.some(ent=>ent.type==='line' && (ent.from===name || ent.to===name));
    const usedByDimension=drawing.dimensions.some(dim=>dim.type==='named' && (dim.from===name || dim.to===name));
    if(!usedByEntity && !usedByDimension) delete drawing.points[name];
  }

  function deleteSelection(){
    if(selectedDimension!==null){
      snapshot();
      drawing.dimensions.splice(selectedDimension,1);
      selectedDimension=null;
      render();
      return;
    }
    if(selectedSegment){
      deleteSelectedSegment();
      return;
    }
    if(selectedEntity!==null){
      const ent=drawing.entities[selectedEntity];
      snapshot();
      drawing.entities.splice(selectedEntity,1);
      if(ent?.type==='line'){
        cleanupOrphanPoint(ent.from);
        cleanupOrphanPoint(ent.to);
      }
      selectedEntity=null;
      selectedSegment=null;
      render();
      return;
    }
  }

  function clearDimensions(){
    if(!drawing.dimensions.length) return;
    snapshot();
    drawing.dimensions=[];
    selectedDimension=null;
    render();
  }
  function deleteSelectedSegment(){
    if(!selectedSegment) return;
    const {entityIndex,segmentIndex}=selectedSegment;
    const ent=drawing.entities[entityIndex];
    if(!ent) return;

    snapshot();

    if(ent.type==='polyline'){
      const pts=ent.points.map(p=>[...p]);

      if(ent.closed){
        // Removing one edge from a closed profile turns it into one open polyline.
        const rotated=[];
        for(let i=1;i<pts.length;i++){
          rotated.push(pts[(segmentIndex+i)%pts.length]);
        }
        rotated.push(pts[segmentIndex]);
        ent.points=rotated;
        ent.closed=false;

      } else {
        const lastSeg=pts.length-2;

        if(segmentIndex===0){
          ent.points=pts.slice(1);
        } else if(segmentIndex===lastSeg){
          ent.points=pts.slice(0,-1);
        } else {
          // Interior deletion breaks one polyline into two independent polylines.
          const left=pts.slice(0,segmentIndex+1);
          const right=pts.slice(segmentIndex+1);
          ent.points=left;
          const base=ent.name||'POLY';
          drawing.entities.splice(entityIndex+1,0,{
            type:'polyline',
            name:base+'_B',
            points:right,
            closed:false,
            layer:ent.layer
          });
        }

        if(ent.points.length<2){
          drawing.entities.splice(entityIndex,1);
        }
      }

    } else if(ent.type==='line'){
      const from=ent.from, to=ent.to;
      drawing.entities.splice(entityIndex,1);
      cleanupOrphanPoint(from);
      cleanupOrphanPoint(to);
    }

    selectedSegment=null;
    selectedEntity=null;
    render();
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

    } else if(op==='DELETE'){
      deleteSelectedSegment();

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
      entitiesG.appendChild(el('circle',{cx:x,cy:y,r:0.9,class:'point'}));
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
        const lineCls=cls+(selectedEntity===drawing.entities.indexOf(ent)?' selected-object':'')+(selectedSegment && selectedSegment.entityIndex===drawing.entities.indexOf(ent)?' selected-segment':'');
        e=el('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:lineCls});
        const hit=el('line',{
          x1:a[0],y1:a[1],x2:b[0],y2:b[1],
          class:'segment-hit',
          'data-entity-index':drawing.entities.indexOf(ent),
          'data-segment-index':0
        });
        entitiesG.appendChild(hit);
      } else if(ent.type==='rect'){
        const sel=selectedEntity===drawing.entities.indexOf(ent)?' selected-object':'';
        e=el('rect',{x:ent.x,y:ent.y,width:ent.width,height:ent.height,class:cls+sel+' shape-entity'});
        entitiesG.appendChild(el('rect',{x:ent.x,y:ent.y,width:ent.width,height:ent.height,class:'object-hit','data-entity-index':drawing.entities.indexOf(ent)}));
      } else if(ent.type==='circle'){
        const sel=selectedEntity===drawing.entities.indexOf(ent)?' selected-object':'';
        e=el('circle',{cx:ent.cx,cy:ent.cy,r:ent.r,class:cls+sel+' shape-entity'});
        entitiesG.appendChild(el('circle',{cx:ent.cx,cy:ent.cy,r:ent.r,class:'object-hit','data-entity-index':drawing.entities.indexOf(ent)}));
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

    drawing.entities.forEach((ent,i)=>{ addVertexHandles(ent,i); addShapeHandles(ent,i); });

    drawing.dimensions.forEach((dim,dimIndex)=>{
      const a=dim.type==='xy'?dim.a:drawing.points[dim.from];
      const b=dim.type==='xy'?dim.b:drawing.points[dim.to];
      if(!a || !b) return;
      const dx=b[0]-a[0], dy=b[1]-a[1];
      const d=Math.hypot(dx,dy);
      if(!d) return;
      const offset=dim.offset ?? 12;
      const nx=-dy/d, ny=dx/d;
      const da=[a[0]+nx*offset,a[1]+ny*offset];
      const db=[b[0]+nx*offset,b[1]+ny*offset];
      const selected=selectedDimension===dimIndex?' selected-dimension':'';
      labelsG.appendChild(el('line',{x1:a[0],y1:a[1],x2:da[0],y2:da[1],class:'extension'+selected}));
      labelsG.appendChild(el('line',{x1:b[0],y1:b[1],x2:db[0],y2:db[1],class:'extension'+selected}));
      labelsG.appendChild(el('line',{x1:da[0],y1:da[1],x2:db[0],y2:db[1],class:'dimension'+selected}));
      labelsG.appendChild(el('line',{x1:da[0],y1:da[1],x2:db[0],y2:db[1],class:'dimension-hit','data-dimension-index':dimIndex}));
      const tx=(da[0]+db[0])/2 + nx*3;
      const ty=(da[1]+db[1])/2 + ny*3;
      const txt=el('text',{x:tx,y:ty,class:'dimtext'+selected,'data-dimension-index':dimIndex});
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

    document.getElementById('status').textContent=`Origin (0,0) • Units: mm • Layer: ${drawing.currentLayer} • Drag line = move • Drag green node = reshape • Command line at bottom`;
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
    if(drawMode){
      e.preventDefault();
      e.stopPropagation();
      handleDrawClick(e);
      return;
    }

    const dimHit=e.target.closest && e.target.closest('.dimension-hit');
    const dimText=e.target.closest && e.target.closest('.dimtext');
    if(dimHit || dimText){
      e.preventDefault(); e.stopPropagation();
      selectedDimension=Number((dimHit||dimText).dataset.dimensionIndex);
      selectedEntity=null; selectedSegment=null;
      render();
      return;
    }

    const shapeHandle=e.target.closest && e.target.closest('.shape-handle');
    if(shapeHandle){
      e.preventDefault(); e.stopPropagation();
      beginShapeHandleDrag(e,Number(shapeHandle.dataset.entityIndex),shapeHandle.dataset.handle);
      return;
    }

    const lineEnd=e.target.closest && e.target.closest('.line-end-handle');
    if(lineEnd){
      e.preventDefault(); e.stopPropagation();
      const index=Number(lineEnd.dataset.entityIndex);
      const ent=drawing.entities[index];
      snapshot();
      selectedEntity=index;
      shapeHandleDrag={entityIndex:index,handle:'line-'+lineEnd.dataset.lineEnd,startX:e.clientX,startY:e.clientY,base:entityAnchorSnapshot(ent)};
      svg.setPointerCapture(e.pointerId); svg.classList.add('shape-editing');
      return;
    }

    const objectHit=e.target.closest && e.target.closest('.object-hit');
    const segHit=e.target.closest && e.target.closest('.segment-hit');
    const hitIndex=objectHit?Number(objectHit.dataset.entityIndex):(segHit?Number(segHit.dataset.entityIndex):null);

    if(svg.classList.contains('move-armed') && hitIndex!==null && hitIndex===selectedEntity){
      e.preventDefault(); e.stopPropagation();
      svg.classList.remove('move-armed');
      startObjectMove(e,selectedEntity);
      return;
    }

    if(objectHit){
      e.preventDefault(); e.stopPropagation();
      selectEntity(Number(objectHit.dataset.entityIndex));
      return;
    }

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
      selectedDimension=null;
      selectedEntity=Number(hit.dataset.entityIndex);
      beginSegmentDrag(e,Number(hit.dataset.entityIndex),Number(hit.dataset.segmentIndex));
      return;
    }
    drag={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};
    svg.setPointerCapture(e.pointerId); svg.classList.add('dragging');
  });
  svg.addEventListener('pointermove',e=>{
    if(objectMove){ moveObject(e); return; }
    if(shapeHandleDrag){
      if(shapeHandleDrag.handle?.startsWith('line-')){
        const ent=drawing.entities[shapeHandleDrag.entityIndex];
        const p=screenToWorld(e);
        const which=shapeHandleDrag.handle==='line-from'?ent.from:ent.to;
        drawing.points[which]=p;
        render();
      } else moveShapeHandle(e);
      return;
    }
    if(vertexDrag){ moveVertex(e); return; }
    if(segmentDrag){ moveSegment(e); return; }
    if(!drag)return;
    view.x=drag.vx+(e.clientX-drag.x);
    view.y=drag.vy+(e.clientY-drag.y);
    updateTransform();
  });
  svg.addEventListener('pointerup',()=>{
    if(objectMove){ endObjectMove(); return; }
    if(shapeHandleDrag){ endShapeHandleDrag(); return; }
    if(vertexDrag){ endVertexDrag(); return; }
    if(segmentDrag){ endSegmentDrag(); return; }
    drag=null;svg.classList.remove('dragging');
  });
  svg.addEventListener('pointercancel',()=>{
    if(objectMove){ endObjectMove(); }
    if(shapeHandleDrag){ endShapeHandleDrag(); }
    if(vertexDrag){ endVertexDrag(); }
    if(segmentDrag){ endSegmentDrag(); }
    drag=null;svg.classList.remove('dragging');
  });

  document.getElementById('toolLine')?.addEventListener('click',()=>{ setCadCommand('LINE'); startLineMode(null); });
  document.getElementById('toolSquare')?.addEventListener('click',()=>{ setCadCommand('SQUARE 40'); startRectMode(40,40); });
  document.getElementById('toolCircle')?.addEventListener('click',()=>{ setCadCommand('CIRCLE 20'); startCircleMode(20); });
  document.getElementById('moveSelected')?.addEventListener('click',()=>{ setCadCommand('M'); armMove(); });
  document.getElementById('dimensionSelected')?.addEventListener('click',dimensionSelected);
  document.getElementById('deleteSelectedTop')?.addEventListener('click',deleteSelection);
  document.getElementById('clearDimensions')?.addEventListener('click',clearDimensions);
  document.getElementById('undoTop')?.addEventListener('click',()=>document.getElementById('undoBtn').click());
  document.getElementById('redoTop')?.addEventListener('click',()=>document.getElementById('redoBtn').click());
  document.getElementById('fitTop')?.addEventListener('click',fitView);
  document.getElementById('saveDraft')?.addEventListener('click',saveDraft);
  document.getElementById('loadDraft')?.addEventListener('click',loadDraft);

  const cadCommand=document.getElementById('cadCommand');
  if(cadCommand){
    cadCommand.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        if(drawMode && drawMode.tool==='LINE'){
          const ent=drawing.entities[drawMode.entityIndex];
          if(ent?.points?.length>=2) finishDrawMode();
        } else if(!drawMode){
          runCadCommand(cadCommand.value);
        }
      } else if(e.key==='Escape'){
        e.preventDefault();
        cancelDrawMode();
      }
    });
  }
  const deleteBtn=document.getElementById('deleteSelected');
  if(deleteBtn) deleteBtn.onclick=deleteSelection;

  document.addEventListener('keydown',e=>{
    const tag=(document.activeElement?.tagName||'').toUpperCase();
    const editing=['INPUT','TEXTAREA','SELECT'].includes(tag);
    if(!editing && drawMode && drawMode.tool==='LINE' && (e.key==='Enter' || e.key===' ')){
      e.preventDefault();
      const ent=drawing.entities[drawMode.entityIndex];
      if(ent?.points?.length>=2) finishDrawMode();
      return;
    }
    if(!editing && e.key==='Escape' && drawMode){
      e.preventDefault();
      cancelDrawMode();
      return;
    }
    if(!editing && (e.key==='Delete' || e.key==='Backspace') && (selectedSegment || selectedEntity!==null || selectedDimension!==null)){
      e.preventDefault();
      deleteSelection();
    }
  });

  window.addEventListener('resize',updateTransform);
  render();
})();
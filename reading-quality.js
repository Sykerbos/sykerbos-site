// An isolated rise that reverses at the next reading is evidence of handling,
// not sustained water gain. Keep source readings intact; classify for display.
export function transientWeightSpikes(points,{dry=null,wet=null,emptyFloor=50}={}){
  const time=r=>r.t??Date.parse(r.measured_at||r.created_at);
  const weight=r=>r.w??Number(r.weight_g);
  const capacity=dry!==null&&wet!==null&&wet>dry?wet-dry:100;
  const jump=Math.max(10,capacity*.1),returnTolerance=Math.max(5,capacity*.1);
  const excluded=new Set();
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1],b=points[i],c=points[i+1];
    if((a.run_id??null)!==(b.run_id??null)||(c.run_id??null)!==(b.run_id??null))continue;
    const before=time(b)-time(a),after=time(c)-time(b);
    if(before<=0||after<=0||before>90*60000||after>90*60000)continue;
    const x=weight(a),y=weight(b),z=weight(c);
    if(![x,y,z].every(Number.isFinite)||Math.min(x,y,z)<emptyFloor)continue;
    if(y-x>=jump&&y-z>=jump&&Math.abs(z-x)<=returnTolerance)excluded.add(b);
  }
  return excluded;
}

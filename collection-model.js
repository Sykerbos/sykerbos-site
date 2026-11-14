import {plantState} from './plant-state.js?v=6';
import {plantDrydownGauge} from './plant-drydown-gauge.js?v=1';
import {plantChartModel} from './plant-chart-model.js?v=2';
export function collectionModel(plant,readings,{now=Date.now(),device=null}={}){
  const view=plantState(plant,readings,{now,maintenance:plant.status==='offline'||device?.status==='maintenance'});
  const dial=plantDrydownGauge(view,plant.learned_saturated_g);
  const percent=view.percent===null?null:Math.round(view.percent);
  const status={maintenance:'In maintenance',removed:'Pot lifted',stale:'Offline',reference:'Dry reference reached',low:'Ready for a refill',refill:'Freshly watered',drying:percent!==null&&percent<=35?'Reserve getting low':'Growing at its own pace'}[view.state];
  const label=dial.newLow?'New observed low':dial.late?'Late dry-down':dial.label==='Drying down'?'Drying down':!view.known&&view.fresh&&!view.cycle.potRemoved&&!view.maintenance?'Tracking':status;
  const days=view.days===null?null:Math.max(1,Math.round(view.days));
  const refill=view.latest&&view.fresh&&!view.cycle.potRemoved&&!view.maintenance&&view.wet!==null?Math.max(0,view.wet-view.latest.w):null;
  const priority=view.maintenance||!view.fresh?4:view.cycle.potRemoved?1:dial.late||view.referenceReached||percent!==null&&percent<=35?0:percent===null?2:3;
  return {view,dial,percent,label,days,refill,priority,chart:plantChartModel(readings,view)};
}

const DEFAULT_STATE={
trip:{
 name:'다카마쓰 가족여행',start:'2026-08-07',end:'2026-08-10',hotel:'JR 호텔 클레멘트 다카마쓰',
 outbound:{airline:'진에어',flightNo:'LJ0359',aircraft:'',depAirport:'인천국제공항',arrAirport:'다카마쓰 공항',depTime:'2026-08-07T08:10',arrTime:'2026-08-07T09:45'},
 inbound:{airline:'진에어',flightNo:'LJ0360',aircraft:'',depAirport:'다카마쓰 공항',arrAirport:'인천국제공항',depTime:'2026-08-10T10:40',arrTime:'2026-08-10T12:25'}
},
days:[
 {label:'DAY 1',date:'8/7 금',stops:[
  {name:'JR 호텔 클레멘트 다카마쓰',type:'호텔',lat:34.3521,lng:134.0467,duration:30,time:'11:00'},
  {name:'다마모공원',type:'관광',lat:34.3507,lng:134.0512,duration:60,time:'12:00'},
  {name:'기타하마 앨리',type:'카페·산책',lat:34.3497,lng:134.0586,duration:90,time:'14:00'},
  {name:'잇카쿠 다카마쓰점',type:'저녁',lat:34.3417,lng:134.0492,duration:70,time:'18:00'}]},
 {label:'DAY 2',date:'8/8 토',stops:[
  {name:'JR 호텔 클레멘트 다카마쓰',type:'호텔',lat:34.3521,lng:134.0467,duration:20,time:'09:00'},
  {name:'리쓰린공원',type:'관광',lat:34.3296,lng:134.0433,duration:120,time:'10:00'},
  {name:'우동 바카이치다이',type:'점심',lat:34.3372,lng:134.0472,duration:50,time:'12:30'},
  {name:'야시마',type:'전망',lat:34.3612,lng:134.1018,duration:120,time:'15:00'}]},
 {label:'DAY 3',date:'8/9 일',stops:[
  {name:'다카마쓰항',type:'이동',lat:34.3537,lng:134.0488,duration:30,time:'08:00'},
  {name:'나오시마 미야노우라항',type:'관광',lat:34.4601,lng:133.9733,duration:180,time:'09:30'},
  {name:'베네세 하우스 뮤지엄',type:'미술관',lat:34.4492,lng:133.9905,duration:120,time:'13:30'}]},
 {label:'DAY 4',date:'8/10 월',stops:[
  {name:'JR 호텔 클레멘트 다카마쓰',type:'호텔',lat:34.3521,lng:134.0467,duration:20,time:'07:30'},
  {name:'다카마쓰 공항',type:'공항',lat:34.2142,lng:134.0156,duration:0,time:'09:00'}]}
]};

function migrate(raw){
 const s=raw||structuredClone(DEFAULT_STATE);
 s.trip=s.trip||{};
 s.trip.hotel=s.trip.hotel||'';
 s.trip.outbound=s.trip.outbound||structuredClone(DEFAULT_STATE.trip.outbound);
 s.trip.inbound=s.trip.inbound||structuredClone(DEFAULT_STATE.trip.inbound);
 (s.days||[]).forEach(d=>(d.stops||[]).forEach(x=>{if(x.time===undefined)x.time='';if(x.duration===undefined)x.duration=60;if(x.placeId===undefined)x.placeId='';if(x.openStatus===undefined)x.openStatus='unknown'}));
 return s;
}
const APP_VERSION="0.8.5";
let pendingPlaces=[];
let state=migrate(JSON.parse(localStorage.getItem('tripflow_state')||'null'));
const savedUI=JSON.parse(localStorage.getItem('tripflow_ui_state')||'{}');
let activeDay=Number.isInteger(savedUI.activeDay)?savedUI.activeDay:0,
map,directionsService,autocomplete,markers=[],routeRenderers=[],routeLines=[],
locationMarker,accuracyCircle,currentPosition=null,currentWeather=null,currentMode=savedUI.currentMode||'DRIVING',liveRouteTarget=null;
let currentView=savedUI.currentView||'map';
let sheetSnap=savedUI.sheetSnap||'collapsed';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const save=()=>localStorage.setItem('tripflow_state',JSON.stringify(state));
function saveUI(extra={}){
 const prev=JSON.parse(localStorage.getItem('tripflow_ui_state')||'{}');
 localStorage.setItem('tripflow_ui_state',JSON.stringify({...prev,activeDay,currentMode,currentView,sheetSnap,...extra}));
}
function applyRestoredUI(){
 if(activeDay<0||activeDay>=state.days.length)activeDay=0;
 $$('.mode-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.mode===currentMode));
 if($('#plannerSheet')) $('#plannerSheet').dataset.snap=sheetSnap;
}
function toast(m){const e=$('#toast');e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2400)}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function stripHtml(s){const d=document.createElement('div');d.innerHTML=s;return d.textContent||d.innerText||''}
function hav(a,b){const R=6371,r=x=>x*Math.PI/180,d1=r(b.lat-a.lat),d2=r(b.lng-a.lng),q=Math.sin(d1/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.sqrt(q))}
function fmtDT(v){if(!v)return'미입력';const d=new Date(v);return Number.isNaN(d)?v:new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)}
function minutes(t){if(!t)return null;const [h,m]=t.split(':').map(Number);return h*60+m}
function hm(m){m=Math.round(m);return`${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}
function updateHeader(){
 const t=state.trip;$('#tripTitle').textContent=t.name||'여행 일정';$('#tripDates').textContent=`${t.start||''} ~ ${t.end||''}`;
 $('#airportText').textContent=t.outbound?.arrAirport||'도착공항 미입력';$('#hotelText').textContent=t.hotel||'숙소 미입력';
 const rows=[['🛫','가는 편',t.outbound],['🛬','오는 편',t.inbound]];
 $('#flightSummary').innerHTML=rows.map(([icon,label,f])=>`<div class="flight-row"><div class="flight-icon">${icon}</div><div class="flight-main"><b>${label} · ${esc(f?.airline||'항공사 미입력')} ${esc(f?.flightNo||'')}</b><span>${esc(f?.depAirport||'출발공항')} ${fmtDT(f?.depTime)} → ${esc(f?.arrAirport||'도착공항')} ${fmtDT(f?.arrTime)}${f?.aircraft?`<br>기종 ${esc(f.aircraft)}`:''}</span></div></div>`).join('');
}
function estimateMinutes(a,b,mode=currentMode){
 const km=hav(a,b),speed=mode==='WALKING'?4.5:mode==='TRANSIT'?18:30;
 return Math.max(5,km/speed*60+(mode==='TRANSIT'?8:3));
}
function scheduleCheck(stops=state.days[activeDay].stops){
 let prevEnd=null,alerts=[],late=0;
 stops.forEach((s,i)=>{
  const target=minutes(s.time);
  if(i===0){prevEnd=target!==null?target+(s.duration||0):null;return}
  const travel=estimateMinutes(stops[i-1],s);
  const arrival=prevEnd!==null?prevEnd+travel:null;
  if(target!==null&&arrival!==null){
   if(arrival>target+5){late++;alerts.push(`${i+1}번 ${s.name}: 약 ${Math.round(arrival-target)}분 늦을 가능성`)}
   prevEnd=Math.max(arrival,target)+(s.duration||0);
  }else prevEnd=(target??arrival)!==null?(target??arrival)+(s.duration||0):null;
 });
 return{late,alerts};
}

function weatherCodeInfo(code){
 const table={0:['☀️','맑음'],1:['🌤️','대체로 맑음'],2:['⛅','구름 조금'],3:['☁️','흐림'],45:['🌫️','안개'],48:['🌫️','서리 안개'],51:['🌦️','약한 이슬비'],53:['🌦️','이슬비'],55:['🌧️','강한 이슬비'],61:['🌦️','약한 비'],63:['🌧️','비'],65:['🌧️','강한 비'],71:['🌨️','약한 눈'],73:['🌨️','눈'],75:['❄️','강한 눈'],80:['🌦️','소나기'],81:['🌧️','소나기'],82:['⛈️','강한 소나기'],95:['⛈️','뇌우']};
 return table[code]||['🌤️','날씨 정보'];
}
function setLocationMarker(p,accuracy=0,centerMap=true){
 currentPosition=p;
 if(map){
  if(locationMarker)locationMarker.setMap(null);if(accuracyCircle)accuracyCircle.setMap(null);
  locationMarker=new google.maps.Marker({map,position:p,title:'내 현위치',zIndex:999,icon:{path:google.maps.SymbolPath.CIRCLE,scale:9,fillColor:'#2563eb',fillOpacity:1,strokeColor:'#fff',strokeWeight:4}});
  if(accuracy>0)accuracyCircle=new google.maps.Circle({map,center:p,radius:accuracy,fillColor:'#2563eb',fillOpacity:.12,strokeColor:'#2563eb',strokeOpacity:.35,strokeWeight:1});
  if(centerMap){map.panTo(p);map.setZoom(16)}
 }
}
function ensureCurrentPosition(centerMap=false){
 if(!navigator.geolocation)return Promise.reject(new Error('이 기기에서 위치정보를 지원하지 않습니다.'));
 return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(pos=>{
  const p={lat:pos.coords.latitude,lng:pos.coords.longitude};setLocationMarker(p,pos.coords.accuracy,centerMap);resolve(p);
 },()=>reject(new Error('위치 권한이 필요합니다. 브라우저 설정에서 위치 접근을 허용해 주세요.')),{enableHighAccuracy:true,timeout:15000,maximumAge:60000}));
}
async function refreshWeather(showToast=false){
 try{
  const base=await ensureCurrentPosition(false);
  $('#weatherStrip').innerHTML='<div class="weather-icon">⏳</div><div><b>내 위치 날씨 확인 중</b><span>실시간 GPS 좌표를 기준으로 조회합니다.</span></div>';
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${base.lat}&longitude=${base.lng}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=precipitation_probability&forecast_days=2&timezone=auto`;
  const r=await fetch(url);if(!r.ok)throw new Error('날씨 정보를 불러오지 못했습니다.');const w=await r.json();const c=w.current||{};let rain=null;if(w.hourly?.time){const idx=w.hourly.time.findIndex(x=>x.slice(0,13)===c.time?.slice(0,13));rain=idx>=0?w.hourly.precipitation_probability[idx]:null}
  currentWeather={temp:c.temperature_2m,feels:c.apparent_temperature,code:c.weather_code,rain,wind:c.wind_speed_10m,precip:c.precipitation,lat:base.lat,lng:base.lng};renderWeather();if(showToast)toast('내 현재 위치의 날씨를 새로 확인했습니다.');
 }catch(e){currentWeather=null;$('#weatherStrip').innerHTML=`<div class="weather-icon">📍</div><div><b>내 위치를 확인할 수 없습니다</b><span>${esc(e.message||'위치 권한을 확인해 주세요.')}</span></div>`;if(showToast)toast(e.message||'위치 권한을 확인해 주세요.')}
}
function renderWeather(){if(!currentWeather)return;const [icon,text]=weatherCodeInfo(currentWeather.code);const rain=currentWeather.rain==null?'강수확률 확인 중':`강수확률 ${currentWeather.rain}%`;$('#weatherStrip').innerHTML=`<div class="weather-icon">${icon}</div><div><b>${text} · ${Math.round(currentWeather.temp)}℃</b><span>내 실시간 위치 기준 · 체감 ${Math.round(currentWeather.feels)}℃ · ${rain} · 바람 ${Math.round(currentWeather.wind||0)}km/h</span></div>`}
function nearbySearch(request){
 return new Promise(resolve=>{
  if(!map||!window.google?.maps?.places)return resolve([]);
  new google.maps.places.PlacesService(map).nearbySearch(request,(results,status)=>resolve(status===google.maps.places.PlacesServiceStatus.OK?(results||[]):[]));
 });
}
function placeOpenStatus(p){const v=p.opening_hours?.isOpen?.();return v===true?'영업 중':v===false?'영업 종료':'영업시간 미확인'}
function timeCategory(){const h=new Date().getHours();if(h<10)return'아침';if(h<14)return'점심';if(h<17)return'오후';if(h<21)return'저녁';return'야간'}
const RECOMMEND_CATEGORIES={
 food:{label:'먹을거리',icon:'🍽️',subs:[
  {key:'meal',label:'식사',type:'restaurant',keyword:'local restaurant family dining'},
  {key:'cafe',label:'카페',type:'cafe',keyword:'cafe dessert'},
  {key:'bar',label:'술집',type:'bar',keyword:'izakaya bar'}]},
 play:{label:'놀거리',icon:'🎡',subs:[
  {key:'indoor',label:'실내',type:'museum',keyword:'museum aquarium indoor attraction'},
  {key:'outdoor',label:'실외',type:'tourist_attraction',keyword:'park garden sightseeing outdoor attraction'}]},
 shopping:{label:'쇼핑',icon:'🛍️',subs:[
  {key:'indoor_shop',label:'실내 쇼핑',type:'shopping_mall',keyword:'shopping mall department store'},
  {key:'outdoor_shop',label:'거리·시장',type:'store',keyword:'shopping street market'},
  {key:'souvenir',label:'기념품',type:'store',keyword:'souvenir gift local products'}]}
};
let lastRecommendationGroups=null;
async function findNearbyRecommendations(){
 const hour=new Date().getHours(),groups={};
 for(const [catKey,cat] of Object.entries(RECOMMEND_CATEGORIES)){
  groups[catKey]={...cat,items:[]};
  for(const spec of cat.subs){
   const rs=await nearbySearch({location:currentPosition,radius:3000,type:spec.type,keyword:spec.keyword,openNow:hour>=7&&hour<=22});
   rs.slice(0,6).forEach(p=>{if(!p.geometry?.location)return;const loc=p.geometry.location;groups[catKey].items.push({category:catKey,subKey:spec.key,kind:spec.label,name:p.name,placeId:p.place_id,lat:loc.lat(),lng:loc.lng(),rating:p.rating||0,ratingCount:p.user_ratings_total||0,open:placeOpenStatus(p),distance:hav(currentPosition,{lat:loc.lat(),lng:loc.lng()})})});
  }
  const unique=[...new Map(groups[catKey].items.map(x=>[x.placeId,x])).values()];
  unique.sort((a,b)=>{const ao=a.open==='영업 중'?1:0,bo=b.open==='영업 중'?1:0;return bo-ao+(b.rating-a.rating)*.35+(a.distance-b.distance)*.55});
  groups[catKey].items=unique.slice(0,12);
 }
 return groups;
}

function nowMinutes(){const d=new Date();return d.getHours()*60+d.getMinutes()}
function nextStopForNow(){const stops=state.days[activeDay]?.stops||[];if(!stops.length)return null;const now=nowMinutes();return stops.find(s=>minutes(s.time)!==null&&minutes(s.time)>=now-30)||stops.find(s=>!s.completed)||stops.at(-1)}
function openStatusLabel(s){if(s.openStatus==='open')return['영업 중','open'];if(s.openStatus==='closed')return['영업 종료','closed'];return['영업시간 미확인','unknown']}
async function loadStopLiveInfo(s){
 if(!map||!s?.placeId||!window.google?.maps?.places)return s;
 return new Promise(resolve=>{new google.maps.places.PlacesService(map).getDetails({placeId:s.placeId,fields:['name','rating','user_ratings_total','opening_hours','formatted_phone_number','website']},(p,status)=>{if(status===google.maps.places.PlacesServiceStatus.OK&&p){s.rating=p.rating||s.rating;s.ratingCount=p.user_ratings_total||s.ratingCount;s.openStatus=p.opening_hours?.isOpen?.()===true?'open':p.opening_hours?.isOpen?.()===false?'closed':'unknown';s.weekdayText=p.opening_hours?.weekday_text||[];save()}resolve(s)})})
}
function recommendationCard(p,i){return `<div class="nearby-item ${i===0?'primary-pick':''}" data-sub="${esc(p.subKey)}"><b>${i===0?'추천 1순위 · ':''}${esc(p.name)}</b><span>${esc(p.kind)} · 약 ${p.distance<1?Math.round(p.distance*1000)+'m':p.distance.toFixed(1)+'km'} · ${esc(p.open)}${p.rating?` · ★${p.rating} (${p.ratingCount})`:''}</span><button type="button" data-rec-place="${esc(p.placeId)}">TripFlow 지도에서 길찾기</button></div>`}
function renderRecommendationCategory(catKey,subKey='all'){
 const box=$('#aiAnswer'),group=lastRecommendationGroups?.[catKey];if(!box||!group)return;
 const items=subKey==='all'?group.items:group.items.filter(x=>x.subKey===subKey);
 const results=box.querySelector('#recommendResults');if(!results)return;
 results.innerHTML=items.length?items.slice(0,8).map(recommendationCard).join(''):'<div class="recommend-empty">이 조건의 주변 장소를 찾지 못했습니다.</div>';
 box.querySelectorAll('[data-cat]').forEach(b=>b.classList.toggle('active',b.dataset.cat===catKey));
 box.querySelectorAll('[data-sub]').forEach(b=>b.classList.toggle('active',b.dataset.sub===subKey));
 box.querySelectorAll('[data-rec-place]').forEach(btn=>btn.onclick=()=>{const p=Object.values(lastRecommendationGroups).flatMap(g=>g.items).find(x=>x.placeId===btn.dataset.recPlace);if(!p)return;box.dataset.targetName=p.name;box.dataset.targetLat=p.lat;box.dataset.targetLng=p.lng;navigateRecommended()});
}
function renderRecommendationShell(groups){
 const box=$('#aiAnswer'),rain=(currentWeather?.rain||0)>=50||(currentWeather?.precip||0)>0;
 const summary=`${timeCategory()} 시간대 · ${rain?'비 가능성을 고려해 실내 장소를 우선 확인하세요':'실내·실외 장소를 함께 추천합니다'} · 내 위치 반경 약 3km`;
 box.innerHTML=`<b>현재 위치 주변 추천</b><p>${esc(summary)}</p><div class="location-basis">📍 내 실시간 GPS 위치 기준</div><div class="recommend-category-tabs">${Object.entries(groups).map(([k,g])=>`<button type="button" data-cat="${k}">${g.icon} ${esc(g.label)}</button>`).join('')}</div><div class="recommend-sub-tabs"></div><div id="recommendResults" class="nearby-grid"></div>`;
 function activate(catKey){const g=groups[catKey];box.querySelector('.recommend-sub-tabs').innerHTML=`<button type="button" data-sub="all">전체</button>${g.subs.map(x=>`<button type="button" data-sub="${x.key}">${esc(x.label)}</button>`).join('')}`;box.querySelectorAll('[data-sub]').forEach(b=>b.onclick=()=>renderRecommendationCategory(catKey,b.dataset.sub));renderRecommendationCategory(catKey,'all')}
 box.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>activate(b.dataset.cat));activate('food');
}
async function recommendNow(){
 const box=$('#aiAnswer');box.innerHTML='<b>내 현재 위치를 확인하고 있습니다…</b><p>GPS·날씨·시간·주변 영업정보를 함께 분석합니다.</p>';
 try{await ensureCurrentPosition(false)}catch(e){box.innerHTML=`<b>위치 권한이 필요합니다.</b><p>${esc(e.message)}</p>`;return}
 await refreshWeather(false);
 if(!map||!window.google?.maps?.places){box.innerHTML='<b>Google Maps 연결이 필요합니다.</b><p>주변 장소 추천을 위해 Places API가 연결되어야 합니다.</p>';return}
 const groups=await findNearbyRecommendations();lastRecommendationGroups=groups;
 if(!Object.values(groups).some(g=>g.items.length)){box.innerHTML='<b>현재 위치 주변 추천을 찾지 못했습니다.</b><p>잠시 후 다시 시도해 주세요.</p>';return}
 renderRecommendationShell(groups);
 if(map){map.panTo(currentPosition);map.setZoom(14)}
}


function liveModeLabel(mode){
 return mode==='WALKING'?'도보':mode==='TRANSIT'?'대중교통':'자동차';
}
function setLiveRouteLoading(loading){
 $$('#liveRoutePanel [data-live-mode]').forEach(b=>b.classList.toggle('loading',loading));
}
function updateLiveRouteModeUI(){
 $$('#liveRoutePanel [data-live-mode]').forEach(b=>b.classList.toggle('active',b.dataset.liveMode===currentMode));
}
function openLiveRoutePanel(target){
 liveRouteTarget=target;
 const panel=$('#liveRoutePanel');
 if(!panel)return;
 panel.hidden=false;
 $('.map-pane')?.classList.add('route-active');
 $('#liveRouteTitle').textContent=`내 위치 → ${target.name}`;
 $('#liveRouteDistance').textContent='계산 중';
 $('#liveRouteDuration').textContent='계산 중';
 $('#liveRouteStatus').textContent=`${liveModeLabel(currentMode)} 경로`;
 updateLiveRouteModeUI();
}
function closeLiveRoutePanel(){
 liveRouteTarget=null;
 const panel=$('#liveRoutePanel');
 if(panel)panel.hidden=true;
 $('.map-pane')?.classList.remove('route-active');
 clearRoutes();
}
function showRouteDetails(){
 if(matchMedia('(max-width:700px)').matches){
   setSheetSnap('full');
   setTimeout(()=>$('#directionsPanel')?.scrollIntoView({behavior:'smooth',block:'start'}),320);
 }else{
   $('#directionsPanel')?.scrollIntoView({behavior:'smooth',block:'start'});
 }
}
async function recalculateLiveRoute(){
 if(!liveRouteTarget)return;
 const {lat,lng,name}=liveRouteTarget;
 if(!map||!directionsService)return toast('Google Maps 연결이 필요합니다.');
 setLiveRouteLoading(true);
 updateLiveRouteModeUI();
 clearRoutes();
 $('#liveRouteDistance').textContent='계산 중';
 $('#liveRouteDuration').textContent='계산 중';
 $('#liveRouteStatus').textContent=`${liveModeLabel(currentMode)} 경로 계산`;
 $('#directionsPanel').innerHTML='<div class="directions-empty">현재 위치에서 추천 장소까지 경로를 계산하고 있습니다…</div>';
 try{
   const routed=await routeSegment(currentPosition,{lat,lng},currentMode,0),result=routed.result;
   const renderer=new google.maps.DirectionsRenderer({
     map,
     suppressMarkers:false,
     preserveViewport:false,
     draggable:false,
     polylineOptions:{strokeColor:'#2563eb',strokeOpacity:.96,strokeWeight:7}
   });
   renderer.setDirections(result);routeRenderers.push(renderer);
   const leg=result.routes[0].legs[0];
   const fallback='';
   $('#distanceMetric').textContent=leg.distance?.text||'—';
   $('#durationMetric').textContent=leg.duration?.text||'—';
   $('#liveRouteDistance').textContent=leg.distance?.text||'—';
   $('#liveRouteDuration').textContent=leg.duration?.text||'—';
   $('#liveRouteStatus').textContent=`${liveModeLabel(currentMode)} 실제 경로`;
   let html=`<div class="leg-card"><div class="leg-head"><b>내 위치 → ${esc(name)}${fallback}</b><span>${leg.distance?.text||''} · ${leg.duration?.text||''}</span></div><div class="step-list">`;
   leg.steps.forEach(step=>{
     const main=step.transit?transitDetail(step):stripHtml(step.instructions||'이동');
     html+=`<div class="step"><span class="step-icon">${iconForStep(step,routed.actualMode)}</span><span>${main}</span><span class="step-distance">${step.distance?.text||''}</span></div>`;
   });
   html+='</div></div>';
   $('#directionsPanel').innerHTML=html;
   if(result.routes?.[0]?.bounds) map.fitBounds(result.routes[0].bounds,64);
   toast(`${liveModeLabel(routed.actualMode)} 경로를 표시했습니다.`);
 }catch(e){
   showRouteFailure(name,e,currentMode);
   $('#liveRouteDistance').textContent='—';
   $('#liveRouteDuration').textContent='—';
   $('#liveRouteStatus').textContent=`${liveModeLabel(currentMode)} 경로 실패`;
   const msg=e.status==='REQUEST_DENIED'
    ? 'Directions API 설정이 필요합니다. 직선 임시선은 표시하지 않습니다.'
    : `${liveModeLabel(currentMode)} 경로를 찾지 못했습니다.`;
   toast(msg);
 }finally{
   setLiveRouteLoading(false);
   updateLiveRouteModeUI();
 }
}

async function navigateRecommended(){
 const box=$('#aiAnswer'),lat=Number(box.dataset.targetLat),lng=Number(box.dataset.targetLng),name=box.dataset.targetName;
 if(!name||!Number.isFinite(lat)||!Number.isFinite(lng))return toast('먼저 추천 장소를 선택해 주세요.');
 try{await ensureCurrentPosition(false)}catch(e){return toast(e.message||'현재 위치를 확인할 수 없습니다.')}
 if(!map||!directionsService)return toast('Google Maps 연결이 필요합니다.');
 openLiveRoutePanel({lat,lng,name});
 if(matchMedia('(max-width:700px)').matches)setSheetSnap('collapsed');
 await recalculateLiveRoute();
}

function render(){
 updateHeader();
 $('#dayTabs').innerHTML=state.days.map((d,i)=>`<button class="${i===activeDay?'active':''}" data-day="${i}">${d.label}<br><small>${d.date}</small></button>`).join('');
 const d=state.days[activeDay],check=scheduleCheck(d.stops);
 if($('#sheetDayTitle')) $('#sheetDayTitle').textContent=`${d.label} · ${d.date} · ${d.stops.length}개 일정`;
 updateSheetHint();
 $('#daySummary').textContent=`${d.stops.length}개 장소 · 체류 약 ${Math.round(d.stops.reduce((a,s)=>a+(s.duration||0),0)/6)/10}시간`;
 $('#scheduleAlerts').innerHTML=check.late?`<div class="schedule-alert warn">⚠️ 현재 순서에서는 ${check.late}개 장소에 늦을 가능성이 있습니다.<br>${check.alerts.map(esc).join('<br>')}</div>`:`<div class="schedule-alert ok">✓ 입력된 희망시간 기준으로 큰 시간 충돌이 발견되지 않았습니다.</div>`;
 $('#stopList').innerHTML=d.stops.map((s,i)=>{
  let status=''; if(i>0&&s.time){const p=d.stops[i-1],arr=(minutes(p.time)??0)+(p.duration||0)+estimateMinutes(p,s);const diff=arr-minutes(s.time);if(p.time)status=`<div class="arrival-status ${diff>5?'late':'safe'}">${diff>5?`예상 ${Math.round(diff)}분 지각 가능`:'시간 내 이동 가능'}</div>`}
  return`<div class="stop" draggable="true" data-index="${i}"><div class="stop-index">${i+1}</div><div class="stop-main"><div class="stop-title">${s.time?`<span class="stop-time">${esc(s.time)}</span>`:''}${esc(s.name)}</div><div class="stop-meta">${esc(s.type||'장소')} · 체류 ${s.duration||0}분</div>${status}<span class="stop-live ${openStatusLabel(s)[1]}">${openStatusLabel(s)[0]}${s.rating?` · ★${s.rating}`:''}</span></div><div class="stop-actions"><button data-action="edit" data-index="${i}">✎</button><button data-action="locate" data-index="${i}">⌖</button><button data-action="delete" data-index="${i}">✕</button></div></div>`}).join('');
 $$('#dayTabs button').forEach(b=>b.onclick=()=>{activeDay=+b.dataset.day;saveUI();clearRoutes();render();fitMap()});
 bindStops();straightMetrics();refreshMarkers();
}
function bindStops(){
 $$('#stopList [data-action=delete]').forEach(b=>b.onclick=()=>{state.days[activeDay].stops.splice(+b.dataset.index,1);save();clearRoutes();render()});
 $$('#stopList [data-action=locate]').forEach(b=>b.onclick=()=>{const s=state.days[activeDay].stops[+b.dataset.index];if(map&&s.lat){map.panTo({lat:s.lat,lng:s.lng});map.setZoom(16)}});
 $$('#stopList [data-action=edit]').forEach(b=>b.onclick=()=>openStop(+b.dataset.index));
 $$('#stopList .stop').forEach(el=>el.onclick=e=>{if(e.target.closest('[data-action]'))return;const s=state.days[activeDay].stops[+el.dataset.index];if(map&&s.lat){map.panTo({lat:s.lat,lng:s.lng});map.setZoom(16);setSheetSnap('half');toast(`${s.name} 위치를 지도에 표시했습니다.`)}});
 let from=null;$$('#stopList .stop').forEach(el=>{el.ondragstart=()=>{from=+el.dataset.index;el.classList.add('dragging')};el.ondragend=()=>el.classList.remove('dragging');el.ondragover=e=>e.preventDefault();el.ondrop=e=>{e.preventDefault();const to=+el.dataset.index;if(from===null||from===to)return;const a=state.days[activeDay].stops;a.splice(to,0,a.splice(from,1)[0]);save();clearRoutes();render()}})
}
function openStop(i){const s=state.days[activeDay].stops[i];$('#stopIndexInput').value=i;$('#stopNameInput').value=s.name;$('#stopTypeInput').value=s.type||'';$('#stopTimeInput').value=s.time||'';$('#stopDurationInput').value=s.duration??60;$('#stopLatInput').value=s.lat??'';$('#stopLngInput').value=s.lng??'';$('#stopDialog').showModal()}
function optimize(){
 const a=state.days[activeDay].stops;if(a.length<3)return toast('장소가 3개 이상일 때 스마트 동선을 사용할 수 있습니다.');
 const fixed=a.filter(x=>x.time).sort((x,y)=>minutes(x.time)-minutes(y.time)),flex=a.filter(x=>!x.time),out=[];let cur=null;
 for(const anchor of fixed){
  while(flex.length&&cur){
   flex.sort((x,y)=>hav(cur,x)-hav(cur,y));const candidate=flex[0];
   const remain=(minutes(anchor.time)??9999)-((minutes(cur.time)??540)+(cur.duration||0));
   if(estimateMinutes(cur,candidate)+estimateMinutes(candidate,anchor)+(candidate.duration||0)>remain)break;
   out.push(flex.shift());cur=out.at(-1);
  }
  out.push(anchor);cur=anchor;
 }
 while(flex.length){if(cur)flex.sort((x,y)=>hav(cur,x)-hav(cur,y));out.push(flex.shift());cur=out.at(-1)}
 state.days[activeDay].stops=out;save();clearRoutes();render();
 const c=scheduleCheck(out);toast(c.late?`동선을 정리했지만 ${c.late}개 시간 충돌이 남았습니다.`:'시간과 거리를 고려해 동선을 정리했습니다.');
}
async function addPlace(){
 const input=$('#placeSearch'),query=input.value.trim();if(!query)return toast('검색할 장소명을 입력해 주세요.');
 const selected=autocomplete?.getPlace?.();
 if(selected?.geometry)return commitPlace(selected);
 if(!map||!window.google?.maps?.places)return toast('Google Maps 연결 후 장소를 검색해 주세요.');
 const service=new google.maps.places.PlacesService(map);
 const center=map.getCenter()||new google.maps.LatLng(34.3428,134.0466);
 const request={query:/高松|다카마쓰|Takamatsu/i.test(query)?query:`${query} Takamatsu Kagawa`,location:center,radius:50000,region:'jp'};
 $('#addPlaceBtn').disabled=true;$('#addPlaceBtn').textContent='검색 중…';
 service.textSearch(request,(results,status)=>{
  $('#addPlaceBtn').disabled=false;$('#addPlaceBtn').textContent='추가';
  if(status!==google.maps.places.PlacesServiceStatus.OK||!results?.length)return toast('검색 결과가 없습니다. 일본어·영문명으로 다시 검색해 주세요.');
  pendingPlaces=results.slice(0,7);showPlaceResults(pendingPlaces);
 });
}
function showPlaceResults(results){
 $('#placeResults').innerHTML=results.map((p,i)=>{const loc=p.geometry?.location;return `<button type="button" class="place-result" data-place-index="${i}"><b>${esc(p.name)}</b><span>${esc(p.formatted_address||'주소 정보 없음')}</span><small>${p.rating?`★ ${p.rating} · `:''}${loc?`${loc.lat().toFixed(5)}, ${loc.lng().toFixed(5)}`:''}</small></button>`}).join('');
 $$('.place-result').forEach(b=>b.onclick=()=>{commitPlace(pendingPlaces[+b.dataset.placeIndex]);$('#placeDialog').close()});
 $('#placeDialog').showModal();
}
function commitPlace(p){
 const loc=p.geometry?.location;if(!loc)return toast('이 장소의 좌표를 확인할 수 없습니다.');
 const base={name:p.name||$('#placeSearch').value.trim(),type:'검색 장소',duration:Number($('#placeDuration').value)||60,time:$('#placeTime').value||'',lat:loc.lat(),lng:loc.lng(),placeId:p.place_id||'',address:p.formatted_address||''};
 state.days[activeDay].stops.push(base);$('#placeSearch').value='';$('#placeTime').value='';save();clearRoutes();render();map?.panTo({lat:base.lat,lng:base.lng});map?.setZoom(16);toast('정확한 위치를 일정에 추가했습니다.');
}
function straightMetrics(){const s=state.days[activeDay].stops;let km=0;for(let i=1;i<s.length;i++)if(s[i-1].lat&&s[i].lat)km+=hav(s[i-1],s[i]);$('#distanceMetric').textContent=km?`약 ${km.toFixed(1)} km`:'—';$('#durationMetric').textContent='—'}
function configuredGoogleKey(){
 const bundled=window.TRIPFLOW_CONFIG?.GOOGLE_MAPS_API_KEY?.trim();
 if(bundled&&bundled!=='여기에_구글맵_API키를_입력하세요')return bundled;
 return localStorage.getItem('tripflow_google_key')||'';
}
function initGoogle(){
 const key=configuredGoogleKey();
 if(!key)return;
 const s=document.createElement('script');
 s.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=setupMap&v=weekly&language=ko`;
 s.async=true;s.defer=true;s.onerror=()=>toast('Google Maps를 불러오지 못했습니다.');
 document.head.appendChild(s);
}
window.setupMap=()=>{
 const ui=JSON.parse(localStorage.getItem('tripflow_ui_state')||'{}');
 const center=ui.mapCenter&&Number.isFinite(ui.mapCenter.lat)&&Number.isFinite(ui.mapCenter.lng)?ui.mapCenter:{lat:34.3428,lng:134.0466};
 map=new google.maps.Map($('#map'),{center,zoom:Number.isFinite(ui.mapZoom)?ui.mapZoom:13,mapTypeId:ui.mapType||'roadmap',gestureHandling:'greedy',fullscreenControl:false,streetViewControl:false,mapTypeControl:false});
 directionsService=new google.maps.DirectionsService();
 autocomplete=new google.maps.places.Autocomplete($('#placeSearch'),{fields:['place_id','geometry','name','formatted_address'],componentRestrictions:{country:'jp'},bounds:new google.maps.LatLngBounds({lat:33.95,lng:133.65},{lat:34.65,lng:134.45}),strictBounds:false});
 autocomplete.addListener('place_changed',()=>{const p=autocomplete.getPlace();if(p?.geometry){const l=p.geometry.location;map.panTo(l);map.setZoom(16)}});
 refreshMarkers();
 $$('.map-controls button').forEach(b=>b.classList.toggle('active',b.dataset.maptype===map.getMapTypeId()));
 map.addListener('idle',()=>{
   const c=map.getCenter();
   saveUI({mapCenter:{lat:c.lat(),lng:c.lng()},mapZoom:map.getZoom(),mapType:map.getMapTypeId()});
 });
 if(!ui.mapCenter)fitMap();
};
function refreshMarkers(){if(!map||!window.google)return;markers.forEach(m=>m.setMap(null));markers=[];state.days[activeDay].stops.forEach((s,i)=>{if(s.lat)markers.push(new google.maps.Marker({map,position:{lat:s.lat,lng:s.lng},label:{text:String(i+1),color:'#fff',fontWeight:'700'},icon:{path:google.maps.SymbolPath.CIRCLE,scale:14,fillColor:'#ff3b5c',fillOpacity:1,strokeColor:'#fff',strokeWeight:3},title:`${s.time||''} ${s.name}`,zIndex:20+i}))})}
function fitMap(){if(!map||!window.google)return;const b=new google.maps.LatLngBounds();let n=0;state.days[activeDay].stops.forEach(s=>{if(s.lat){b.extend({lat:s.lat,lng:s.lng});n++}});if(n)map.fitBounds(b,55)}
function clearRoutes(){routeRenderers.forEach(r=>r.setMap(null));routeLines.forEach(r=>r.setMap(null));routeRenderers=[];routeLines=[];$('#directionsPanel').innerHTML='<div class="directions-empty">경로를 표시하면 구간별 이동방법이 나타납니다.</div>'}
function dayDate(){const d=new Date(`${state.trip.start}T00:00:00+09:00`);d.setDate(d.getDate()+activeDay);return d}
function departureFor(stop,idx){const d=dayDate(),t=stop.time||'09:00',[h,m]=t.split(':').map(Number);d.setHours(h,m,0,0);const now=new Date();return d>now?d:new Date(now.getTime()+15*60000)}
function routeErrorMessage(status){
 const messages={
  ZERO_RESULTS:'선택한 교통수단으로 연결되는 경로가 없습니다.',
  NOT_FOUND:'출발지 또는 목적지 좌표를 확인하지 못했습니다.',
  OVER_QUERY_LIMIT:'Google 경로 API 사용 한도를 초과했습니다.',
  REQUEST_DENIED:'Google Cloud에서 Directions API가 활성화되지 않았거나 API 키 제한이 맞지 않습니다.',
  INVALID_REQUEST:'경로 요청 정보가 올바르지 않습니다.',
  UNKNOWN_ERROR:'Google 경로 서버의 일시적 오류입니다.'
 };
 return messages[status]||`경로 요청 실패(${status})`;
}
function requestRoute(a,b,mode,i){return new Promise((resolve,reject)=>{
 const travelMode=google.maps.TravelMode[mode];
 if(!travelMode)return reject(Object.assign(new Error('지원하지 않는 이동수단입니다.'),{status:'INVALID_MODE'}));
 const req={
   origin:new google.maps.LatLng(Number(a.lat),Number(a.lng)),
   destination:new google.maps.LatLng(Number(b.lat),Number(b.lng)),
   travelMode,
   unitSystem:google.maps.UnitSystem.METRIC,
   provideRouteAlternatives:true
 };
 if(mode==='TRANSIT'){
   req.transitOptions={
     departureTime:new Date(Date.now()+5*60*1000),
     routingPreference:google.maps.TransitRoutePreference.FEWER_TRANSFERS
   };
 }
 if(mode==='DRIVING'){
   req.drivingOptions={departureTime:new Date(Date.now()+2*60*1000),trafficModel:'bestguess'};
 }
 if(mode==='WALKING'){
   req.avoidHighways=true;
 }
 directionsService.route(req,(res,status)=>status==='OK'?resolve({result:res,actualMode:mode}):reject(Object.assign(new Error(routeErrorMessage(status)),{status})));
 })}
async function routeSegment(a,b,mode,i){
 // v0.8.5: 사용자가 고른 이동수단으로만 요청합니다.
 // 다른 이동수단으로 자동 대체하면 세 버튼의 경로가 같아 보일 수 있으므로 금지합니다.
 const routed=await requestRoute(a,b,mode,i);
 return {...routed,fallback:false,requestedMode:mode};
}
function showRouteFailure(name,error,mode){
 clearRoutes();
 $('#distanceMetric').textContent='—';
 $('#durationMetric').textContent='—';
 const status=error?.status||'UNKNOWN_ERROR';
 const modeName=liveModeLabel(mode);
 const setup=status==='REQUEST_DENIED'
  ? '<br><b>Google Cloud에서 Maps JavaScript API와 Directions API(legacy)를 활성화하고, 현재 웹주소가 API 키 제한에 허용되어야 합니다.</b>'
  : '';
 $('#directionsPanel').innerHTML=`<div class="leg-card route-error-card"><div class="leg-head"><b>내 위치 → ${esc(name)}</b><span>${esc(modeName)} 경로 실패</span></div><div class="step-list"><div class="step"><span>⚠️</span><span>${esc(error?.message||'실제 경로를 불러오지 못했습니다.')}${setup}<br>직선 임시선은 표시하지 않습니다.</span><span>${esc(status)}</span></div></div></div>`;
}
function transitDetail(step){const t=step.transit;if(!t)return'';const line=t.line?.short_name||t.line?.name||'대중교통',vehicle=t.line?.vehicle?.name||'',dep=t.departure_stop?.name||'',arr=t.arrival_stop?.name||'';return`<span class="transit-line">${esc(line)}</span> ${esc(vehicle)} ${dep&&arr?`· ${esc(dep)} → ${esc(arr)}`:''}`}
function iconForStep(step,mode){if(step.travel_mode==='TRANSIT')return'🚌';if(mode==='WALKING')return'🚶';return'↗️'}
async function drawRoute(){
 if(!map||!directionsService)return toast('먼저 Google Maps API 키를 연결해 주세요.');
 const stops=state.days[activeDay].stops.filter(x=>x.lat);if(stops.length<2)return toast('좌표가 확인된 장소가 2개 이상 필요합니다.');
 clearRoutes();$('#directionsPanel').innerHTML='<div class="directions-empty">시간표와 경로를 계산하고 있습니다…</div>';
 let totalDist=0,totalDur=0,html='',bounds=new google.maps.LatLngBounds(),success=0;
 for(let i=0;i<stops.length-1;i++){try{
  const routed=await routeSegment(stops[i],stops[i+1],currentMode,i),result=routed.result;
  const renderer=new google.maps.DirectionsRenderer({map,suppressMarkers:true,preserveViewport:true,polylineOptions:{strokeOpacity:0}});
  renderer.setDirections(result);routeRenderers.push(renderer);
  const path=result.routes[0].overview_path;
  const line=new google.maps.Polyline({map,path,strokeColor:'#ff3b5c',strokeOpacity:.94,strokeWeight:6,icons:[{icon:{path:google.maps.SymbolPath.FORWARD_CLOSED_ARROW,scale:3,fillColor:'#ffffff',fillOpacity:1,strokeColor:'#ff3b5c',strokeWeight:1},offset:'8%',repeat:'90px'}]});
  routeLines.push(line);path.forEach(p=>bounds.extend(p));
  const leg=result.routes[0].legs[0];success++;totalDist+=leg.distance?.value||0;totalDur+=leg.duration?.value||0;
  const fallback='';
  const target=stops[i+1].time?` · 목표 ${stops[i+1].time}`:'';
  html+=`<div class="leg-card"><div class="leg-head"><b>${i+1}. ${esc(stops[i].name)} → ${i+2}. ${esc(stops[i+1].name)}${fallback}</b><span>${leg.distance?.text||''} · ${leg.duration?.text||''}${target}</span></div><div class="step-list">`;
  leg.steps.forEach(step=>{const main=step.transit?transitDetail(step):stripHtml(step.instructions||'이동');html+=`<div class="step"><span class="step-icon">${iconForStep(step,routed.actualMode)}</span><span>${main}</span><span class="step-distance">${step.distance?.text||''}</span></div>`});html+='</div></div>';
 }catch(e){html+=`<div class="leg-card"><div class="leg-head"><b>${i+1}. ${esc(stops[i].name)} → ${i+2}. ${esc(stops[i+1].name)}</b><span>경로 없음</span></div><div class="step-list"><div class="step"><span>⚠️</span><span>${esc(e.message)}</span><span></span></div></div></div>`}}
 $('#directionsPanel').innerHTML=html;$('#distanceMetric').textContent=success?`${(totalDist/1000).toFixed(1)} km`:'—';$('#durationMetric').textContent=success?`${Math.round(totalDur/60)}분`:'—';if(success)map.fitBounds(bounds,55);
}
async function locateMe(){try{await ensureCurrentPosition(true);await refreshWeather(false);toast('내 실시간 위치와 날씨를 갱신했습니다.')}catch(e){toast(e.message||'위치 권한 또는 위치정보를 확인해 주세요.')}}
function openGoogle(){const s=state.days[activeDay].stops;if(s.length<2)return;const modes={DRIVING:'driving',WALKING:'walking',TRANSIT:'transit'},way=currentMode==='TRANSIT'?'':`&waypoints=${encodeURIComponent(s.slice(1,-1).map(x=>x.name).join('|'))}`;window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(s[0].name)}&destination=${encodeURIComponent(s.at(-1).name)}${way}&travelmode=${modes[currentMode]}`,'_blank')}
function fillFlight(prefix,f){$(`#${prefix}Airline`).value=f?.airline||'';$(`#${prefix}FlightNo`).value=f?.flightNo||'';$(`#${prefix}Aircraft`).value=f?.aircraft||'';$(`#${prefix}DepAirport`).value=f?.depAirport||'';$(`#${prefix}ArrAirport`).value=f?.arrAirport||'';$(`#${prefix}DepTime`).value=f?.depTime||'';$(`#${prefix}ArrTime`).value=f?.arrTime||''}
function readFlight(prefix){return{airline:$(`#${prefix}Airline`).value,flightNo:$(`#${prefix}FlightNo`).value,aircraft:$(`#${prefix}Aircraft`).value,depAirport:$(`#${prefix}DepAirport`).value,arrAirport:$(`#${prefix}ArrAirport`).value,depTime:$(`#${prefix}DepTime`).value,arrTime:$(`#${prefix}ArrTime`).value}}

function updateSheetHint(){
 const hint=$('#sheetHint'),toggle=$('#sheetToggleBtn');if(!hint||!toggle)return;
 const text={collapsed:'위로 밀어 지도와 일정을 함께 보기',half:'위로 밀어 일정 전체 보기 · 아래로 밀어 지도 보기',full:'아래로 밀어 지도와 함께 보기'};
 hint.textContent=text[sheetSnap]||text.collapsed;
 toggle.textContent=sheetSnap==='full'?'⌄':'⌃';
}
function setSheetSnap(next,animate=true){
 if(!matchMedia('(max-width:700px)').matches)return;
 const sheet=$('#plannerSheet'),scroll=$('#panelScroll');if(!sheet)return;
 sheetSnap=next;sheet.dataset.snap=next;sheet.classList.toggle('dragging',!animate);
 if(next==='collapsed'&&scroll)scroll.scrollTop=0;
 saveUI();updateSheetHint();
 setTimeout(()=>{if(map&&window.google)google.maps.event.trigger(map,'resize')},300);
}
function initBottomSheet(){
 const sheet=$('#plannerSheet'),handle=$('#sheetHandle'),scroll=$('#panelScroll'),toggle=$('#sheetToggleBtn');
 if(!sheet||!handle)return;
 sheet.dataset.snap=sheetSnap;
 const snaps=()=>({full:0,half:Math.round(sheet.clientHeight*.44),collapsed:sheet.clientHeight-78});
 const yFor=()=>snaps()[sheetSnap]??snaps().collapsed;
 let dragging=false,startY=0,startOffset=0,lastY=0,lastT=0,velocity=0;
 const begin=(y)=>{if(!matchMedia('(max-width:700px)').matches)return;dragging=true;startY=lastY=y;startOffset=yFor();lastT=performance.now();velocity=0;sheet.classList.add('dragging')};
 const move=(y)=>{if(!dragging)return;const now=performance.now(),dt=Math.max(1,now-lastT);velocity=(y-lastY)/dt;lastY=y;lastT=now;const sp=snaps(),v=Math.max(sp.full,Math.min(sp.collapsed,startOffset+(y-startY)));sheet.style.transform=`translateY(${v}px)`};
 const end=()=>{if(!dragging)return;dragging=false;const matrix=getComputedStyle(sheet).transform;let current=yFor();if(matrix&&matrix!=='none'){const m=new DOMMatrixReadOnly(matrix);current=m.m42}sheet.style.transform='';sheet.classList.remove('dragging');const sp=snaps();let next;if(velocity<-.45)next=current<sp.half?'full':'half';else if(velocity>.45)next=current>sp.half?'collapsed':'half';else next=Object.entries(sp).sort((a,b)=>Math.abs(a[1]-current)-Math.abs(b[1]-current))[0][0];setSheetSnap(next)};
 handle.addEventListener('pointerdown',e=>{begin(e.clientY);handle.setPointerCapture(e.pointerId)});
 handle.addEventListener('pointermove',e=>move(e.clientY));handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
 toggle?.addEventListener('click',e=>{e.stopPropagation();setSheetSnap(sheetSnap==='collapsed'?'half':sheetSnap==='half'?'full':'half')});
 handle.addEventListener('dblclick',()=>setSheetSnap(sheetSnap==='full'?'collapsed':'full'));
 // 일정 본문은 패널 높이와 관계없이 독립적으로 스크롤합니다.
 // 패널 높이 변경은 상단 손잡이 또는 펼침 버튼에서만 처리합니다.
 window.addEventListener('resize',()=>{sheet.style.transform='';sheet.dataset.snap=sheetSnap});
 updateSheetHint();
}
$('#apiBtn').onclick=()=>{$('#apiKeyInput').value=configuredGoogleKey();$('#apiDialog').showModal()};
$('#saveApiBtn').onclick=e=>{e.preventDefault();const k=$('#apiKeyInput').value.trim();if(!k)return toast('API 키를 입력해 주세요.');localStorage.setItem('tripflow_google_key',k);location.reload()};
$('#editTripBtn').onclick=()=>{const t=state.trip;$('#tripNameInput').value=t.name||'';$('#startDateInput').value=t.start||'';$('#endDateInput').value=t.end||'';$('#hotelInput').value=t.hotel||'';fillFlight('out',t.outbound);fillFlight('in',t.inbound);$('#tripDialog').showModal()};
$('#saveTripBtn').onclick=e=>{e.preventDefault();state.trip={name:$('#tripNameInput').value,start:$('#startDateInput').value,end:$('#endDateInput').value,hotel:$('#hotelInput').value,outbound:readFlight('out'),inbound:readFlight('in')};save();$('#tripDialog').close();render();toast('여행과 항공편 정보를 저장했습니다.')};
$('#saveStopBtn').onclick=e=>{e.preventDefault();const i=Number($('#stopIndexInput').value),s=state.days[activeDay].stops[i];const lat=Number($('#stopLatInput').value),lng=Number($('#stopLngInput').value);Object.assign(s,{name:$('#stopNameInput').value,type:$('#stopTypeInput').value,time:$('#stopTimeInput').value,duration:Number($('#stopDurationInput').value)||0,...(Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:{})});save();$('#stopDialog').close();clearRoutes();render();toast('장소 시간을 수정했습니다.')};
$('#addPlaceBtn').onclick=addPlace;$('#placeSearch').onkeydown=e=>{if(e.key==='Enter')addPlace()};$('#addEmptyBtn').onclick=()=>$('#placeSearch').focus();
$$('.quick-tags button').forEach(b=>b.onclick=()=>{$('#placeSearch').value=`다카마쓰 ${b.dataset.query}`;$('#placeSearch').focus()});
$('#aiNowBtn').onclick=()=>{setSheetSnap('half');setTimeout(recommendNow,120)};$('#aiRecommendBtn').onclick=recommendNow;$('#refreshFieldBtn').onclick=()=>refreshWeather(true);$('#navigateNextBtn').onclick=navigateRecommended;$('#routeBtn').onclick=drawRoute;$('#openGoogleBtn').onclick=openGoogle;$('#locationBtn').onclick=locateMe;
$$('.mode-tabs button').forEach(b=>b.onclick=()=>{currentMode=b.dataset.mode;saveUI();$$('.mode-tabs button').forEach(x=>x.classList.toggle('active',x===b));clearRoutes();straightMetrics();render()});
$$('.map-controls button').forEach(b=>b.onclick=()=>{if(map){map.setMapTypeId(b.dataset.maptype);saveUI({mapType:b.dataset.maptype})}$$('.map-controls button').forEach(x=>x.classList.toggle('active',x===b))});
$('#liveRouteClose').onclick=closeLiveRoutePanel;
$('#liveRouteDetails').onclick=showRouteDetails;
$$('#liveRoutePanel [data-live-mode]').forEach(b=>b.onclick=async()=>{
 currentMode=b.dataset.liveMode;
 saveUI();
 updateLiveRouteModeUI();
 $$('.mode-tabs button').forEach(x=>x.classList.toggle('active',x.dataset.mode===currentMode));
 await recalculateLiveRoute();
});

async function clearOldAppCaches(){
 try{if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();for(const r of regs)await r.unregister()}if('caches' in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))}}catch(_){/* 캐시 정리는 실패해도 앱 실행을 계속합니다. */}
}
clearOldAppCaches();
initBottomSheet();
applyRestoredUI();render();refreshWeather();initGoogle();
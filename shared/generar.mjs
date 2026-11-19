// Ejecutar desde cualquier carpeta: node shared/generar.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { TAU, Geometry, random, rounded, add, sub, times, mix, unit, cross, dot, tube, ellipsoid, rings } from './geometria.mjs';
import { writeSand } from './arena.mjs';
import { treasures, fish } from './modelos.mjs';

const scene={materials:{},meshes:{},nodes:[],groups:{}};
const rand=random(80452), between=(a,b)=>a+(b-a)*rand(), pick=a=>a[Math.floor(rand()*a.length)];
const {sin,cos,exp,abs}=Math;
const palette={
  sand:'#fffbef', limestone:'#637e83', basalt:'#435c70', shale:'#607082', tinted:'#987d8b',
  moss:'#579b90', deepRock:'#436e7d', distant:'#518295', rust:'#f06a4c', peach:'#ff936e',
  fan:'#ed7966', fanLight:'#ffaf80', wine:'#bb617a', mauve:'#df80ad', coolLeaf:'#46868b',
  pink:'#f16994', lilac:'#ab79d0', violet:'#805bad', sponge:'#ebb259', inside:'#966735',
  teal:'#43ad97', jade:'#327e75', aqua:'#77d8cd', leaf:'#75bc70', kelp:'#3c9b74',
  root:'#346f6b', brain:'#659d8f', ridge:'#a2c995', shell:'#bb7d94', shellLight:'#f0b8bf', pearl:'#ffeedb', gold:'#f5bc52',
  brass:'#a16b33', dial:'#245e64', ivory:'#fff0d1', red:'#ed6048', wood:'#683f35',
  teak:'#a66343', tangerine:'#f6813b', apricot:'#ffb74b', sun:'#ffcd54', lagoon:'#3a8dd0',
  ink:'#28394b', bubble:'#a7f2f4', glint:'#daffff'
};
for(const [id,color] of Object.entries(palette)) scene.materials[id]={color,roughness:.88};
Object.assign(scene.materials.sand,{texture:'sand'});
Object.assign(scene.materials.gold,{roughness:.29,metalness:.43});
Object.assign(scene.materials.brass,{roughness:.43,metalness:.33});
Object.assign(scene.materials.pearl,{roughness:.14,metalness:.17,emissive:'#302622'});
Object.assign(scene.materials.bubble,{roughness:.20,opacity:.23});
Object.assign(scene.materials.glint,{roughness:.18,opacity:.63,emissive:'#305657'});

const batches=new Map(), footprints=[], supports=[];
function batch(mat,group='',solid=true) {
  const name=[group||'reef',mat].join('_');
  if (!batches.has(name)) {
    batches.set(name,new Geometry());
    scene.nodes.push({mesh:name, material:mat, position:[0,0,0], ...(group&&{group}), ...(!solid&&{solid:false})});
  }
  return batches.get(name);
}
function group(id,type,position,extras={}) { scene.groups[id]={type,position:position.map(rounded),...extras}; }
function ground(x,z) {
  return .14*sin(x*.48+z*.20)+.15*cos(z*.48-x*.12)+.07*sin(.92*z+.6*x)+.07;
}

// Altura por coordenadas baricéntricas. Las colonias se apoyan en la caliza o en la arena.
function supportY(x,z) {
  let height=ground(x,z);
  for(const [a,b,c] of supports) {
    if(x<Math.min(a[0],b[0],c[0])||x>Math.max(a[0],b[0],c[0])||z<Math.min(a[2],b[2],c[2])||z>Math.max(a[2],b[2],c[2])) continue;
    const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if(abs(den)<1e-7) continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;
    const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
    if(u>=0&&v>=0&&u+v<=1) height=Math.max(height,u*a[1]+v*b[1]+(1-u-v)*c[1]);
  }
  return height;
}
function anchor(x,z,y,s) {
  const surface=supportY(x,z);
  return Math.min(surface,Math.max(y,surface-.18*s))-.04*s;
}

// Bancos de roca caliza con hombros angulares, estratos y una cara superior colonizada.
function rock(x,y,z,rx,h,rz,material='limestone',crown=false, record=true) {
  const n=Math.floor(between(6,10)), angle=between(0,TAU);
  const radial=Array.from({length:n},()=>between(.82,1.12));
  const strata=[[0,.67],[.17,.98],[.48,1.03],[.79,.92],[1,.59]];
  const topTilt=between(-.10,.10), drift=between(-.20,.20)*rx;
  const levels=strata.map(([v,r])=>Array.from({length:n},(_,i)=>{
    const a=angle+TAU*i/n, w=radial[i]*r*between(.93,1.065);
    return [x+rx*w*cos(a)+drift*v,y+h*(v+between(-.034,.034)+topTilt*v*cos(a)),z+rz*w*sin(a)];
  }));
  const g=batch(material);
  for(let j=0;j<levels.length-1;j++) for(let i=0;i<n;i++) {
    const k=(i+1)%n, face=[cos(angle+TAU*(i+.5)/n),0,sin(angle+TAU*(i+.5)/n)];
    const color=rounded(between(.87,1)*(j===0?.66:j===1?.84:1));
    g.quad(levels[j][i],levels[j][k],levels[j+1][k],levels[j+1][i],face,color);
    supports.push([levels[j][i],levels[j][k],levels[j+1][k]],[levels[j][i],levels[j+1][k],levels[j+1][i]]);
  }
  const roof=crown?batch('moss'):g;
  for(let i=0;i<n;i++) {
    const points=[levels.at(-1)[i],levels.at(-1)[(i+1)%n],[x+drift,y+h*1.02,z]];
    roof.triangle(...points,[0,1,0],rounded(between(.92,1))); supports.push(points);
  }
  if(record) footprints.push([x,z,rx,rz]);
}

// Ramificaciones en cuernos: cada recursión conserva el crecimiento principal y abre un brazo lateral.
function antlers(x,y,z,s,mat,turn=0) {
  y=anchor(x,z,y,s);
  const g=batch(mat);
  function shoot(p,heading,lean,len,width,order) {
    const dir=[cos(heading)*lean,1,sin(heading)*lean];
    const elbow=add(p,times(dir,len*.53));
    const end=add(elbow,[cos(heading+.31)*len*lean*.16,len*.44,sin(heading+.31)*len*lean*.16]);
    tube(g,[p,elbow,end],[width,width*.84,width*.65],6);
    if(order===0) {
      tube(g,[end, add(end,[.03*len,.14*len,0]),add(end,[.034*len,.17*len,0])],[width*.65,width*.42,.003*s],6);
      return;
    }
    shoot(end,heading+between(-.62,.62),lean*.62,len*between(.62,.82),width*.65,order-1);
    shoot(elbow,heading+pick([-1,1])*between(1.0,2.2),between(.71,1.48),len*between(.56,.80),width*.65,order-1);
  }
  for(let i=0;i<4;i++) {
    const a=turn+TAU*i/4+between(-.30,.30);
    shoot([x+.13*s*cos(a),y,z+.13*s*sin(a)],a,between(.40,.80),s*between(.75,1.08),s*between(.085,.12),2);
  }
}

// Gorgonia: un abanico reticulado. Las nervaduras transversales conectan ramas vecinas.
function seaFan(x,y,z,size,angle,mat,edge) {
  y=anchor(x,z,y,size);
  const trunk=batch(mat), branches=batch(edge);
  const place=(u,v,w)=>[x+size*(u*cos(angle)+w*sin(angle)),y+size*v,z+size*(-u*sin(angle)+w*cos(angle))];
  const rows=[];
  let previousCount=0;
  for(let level=0;level<6;level++) {
    const count=[1,3,6,11,17,23][level], f=level/5;
    const row=Array.from({length:count},(_,i)=>{
      const t=count===1?0:i/(count-1)*2-1;
      const u=t*(.93*f+.22*sin(Math.PI*f))+.08*f*sin(3*f+t);
      const v=f*(1.36-.46*t*t)+.07*f*sin(5.4*t+.6)+between(-.026,.026)*f;
      return place(u,v,.085*sin(4*t+2*f)*f+.03*cos(9*t)*f);
    });
    if(level) {
      for(let i=0;i<count;i++) {
        const parent=rows[level-1][Math.round(i/(count-1)*(previousCount-1))], p=row[i];
        const middle=mix(parent,p,.52);middle[0]+=size*.02*cos(i);middle[1]-=.018*size;
        const r=(.059*(1-f)+.012)*size;
        tube(level>3?branches:trunk,[parent,middle,p],[r*1.16,r,r*.75],6,false);
        if(i&&level>=2&&(i+level)%4!==1) {
          const prev=row[i-1], joint=mix(prev,p,.48);joint[1]-=.037*size;
          tube(level>3?branches:trunk,[prev,joint,p],[r*.44,r*.41,r*.39],6,false);
        }
        if(level===5 && i%3!==0) {
          const spur=add(p,[size*.04*sin(i),size*.075,size*.016]);
          tube(branches,[p,spur],[r*.64,r*.19],6);
        }
      }
    }
    rows.push(row);previousCount=count;
  }
}

// Esponjas tubulares de boca ensanchada y pared interior de distinto color.
function sponges(x,y,z,s,mat='sponge') {
  y=anchor(x,z,y,s);
  for(let i=0;i<7;i++) {
    const a=i*2.40, spread=i===0?0:s*between(.21,.46), h=s*(i===0?1.2:between(.40,1.02));
    const radius=s*between(.105,.159), base=[x+spread*cos(a),y,z+spread*sin(a)];
    const shape=(r,height)=>Array.from({length:9},(_,k)=>{
      const theta=TAU*k/9;
      return add(base,[radius*r*cos(theta)+height*.16*cos(a),height+.024*s*cos(theta),radius*r*sin(theta)+height*.16*sin(a)]);
    });
    const outer=[shape(.60,0),shape(.83,h*.20),shape(1,h*.83),shape(1.04,h)];
    rings(batch(mat),outer,{caps:false});
    const lip=shape(.78,h-.004*s), bottom=shape(.64,h*.71);
    for(let k=0;k<9;k++) {
      const next=(k+1)%9, radial=[-cos(TAU*(k+.5)/9),0,-sin(TAU*(k+.5)/9)];
      batch(mat).quad(outer[3][k],outer[3][next],lip[next],lip[k],[0,1,0]);
      batch('inside').quad(lip[k],lip[next],bottom[next],bottom[k],radial);
      batch('inside').triangle(bottom[k],bottom[next],add(base,[h*.11*cos(a),h*.68,h*.11*sin(a)]),[0,1,0]);
    }
  }
}

// Plataformas de coral con margen ondulante, dispuestas a distintas alturas como pétalos.
function plates(x,y,z,s,mat='teal') {
  y=anchor(x,z,y,s);
  const g=batch(mat);
  for(let j=0;j<6;j++) {
    const a=j*2.4, spread=(j%3)*.25*s;
    const c=[x+cos(a)*spread,y+(j+1)*.117*s,z+sin(a)*spread];
    const r=s*(.71-.041*j), layers=[];
    tube(g,[[x,y-.08*s,z],[x+cos(a)*spread*.45,y+.065*j*s,z+sin(a)*spread*.45],c],[.12*s,.096*s,.077*s],6,false);
    for(const [w,elev] of [[.085,-.27],[.57,-.03],[1,.09],[.83,.13],[.36,.02],[.025,.015]]) {
      layers.push(Array.from({length:13},(_,i)=>{
        const t=TAU*i/13, edge=1+.092*sin(3*t+a)+.075*cos(5*t);
        return add(c,[cos(t)*r*w*edge,s*elev+.105*r*w*sin(t+a),sin(t)*r*w*edge*.88]);
      }));
    }
    for(let k=0;k<layers.length-1;k++) for(let i=0;i<13;i++) {
      const next=(i+1)%13;
      g.quad(layers[k][i],layers[k][next],layers[k+1][next],layers[k+1][i],k<=1?[0,-1,0]:[0,1,0]);
    }
  }
}

// Hojas anchas con nervio central. Una mata se anima como unidad desde su raíz.
let plants=0;
function grass(x,y,z,s,mat='kelp',animated=true) {
  y=anchor(x,z,y,s);
  const id=animated?'plant'+(++plants):'', origin=animated?[0,0,0]:[x,y,z];
  if (animated) group(id,'plant',[x,y,z],{phase:rounded(between(0,TAU))});
  const g=batch(mat,id);
  for(let i=0;i<7;i++) {
    const az=TAU*i/7+between(-.15,.15), len=s*between(.64,1.48), bend=s*between(.30,.81);
    const width=s*between(.063,.15), twist=between(-1.15,1.15);
    const rows=[];
    for(let j=0;j<=5;j++) {
      const t=j/5, a=az+twist*t*.65, radial=bend*(.16+t*t);
      const c=add(origin,[cos(az)*radial+.12*len*sin(4*t)*t,len*t,sin(az)*radial]);
      const w=(.018+sin(.30+Math.PI*.90*t))*width*(1-.29*t);
      const side=[-sin(a)*w,0,cos(a)*w], ridge=[cos(a)*w*.35,.02*w,sin(a)*w*.35];
      rows.push([sub(c,side),add(c,ridge),add(c,side)]);
    }
    for(let j=0;j<rows.length-1;j++) for(let k=0;k<2;k++) {
      const a=rows[j][k],b=rows[j][k+1],c=rows[j+1][k+1],d=rows[j+1][k];
      g.quad(a,b,c,d);g.quad(d,c,b,a);
    }
  }
}

function seaStar(x,z,s,angle,mat='peach') {
  const y=ground(x,z)+.049;
  const ring=Array.from({length:10},(_,i)=>{
    const a=i*Math.PI/5+angle,r=i%2?s*.33:s;
    return [x+r*cos(a),y+(i%2?.04:.01),z+r*sin(a)];
  });
  for(let i=0;i<10;i++)
    batch(mat).triangle([x,y+s*.18,z],ring[i],ring[(i+1)%10],[0,1,0]);
}

// Coral cerebro: una media esfera estriada con crestas que serpentean sin intersecarse.
function brainCoral(x,y,z,s) {
  y=anchor(x,z,y,s);
  const round=(a,lat,extra=0)=>{
    const r=s*(1+extra);
    return [x+r*cos(lat)*cos(a),y+.74*r*sin(lat),z+.84*r*cos(lat)*sin(a)];
  };
  const bands=Array.from({length:6},(_,j)=>Array.from({length:18},(_,i)=>round(TAU*i/18,-.12+j*.33)));
  rings(batch('brain'),bands);
  for(let j=0;j<5;j++) {
    const pts=[];
    for(let i=0;i<=30;i++) {
      const a=TAU*i/30;
      pts.push(round(a,.04+j*.286+.08*sin(6*a+j*.85)+.038*cos(3*a+j),.015));
    }
    // Segmentos abiertos: la costura de la cresta coincide con el inicio.
    for(let i=0;i<30;i+=5) tube(batch('ridge'),pts.slice(i,i+6),Array(6).fill(s*.034),5,false);
  }
}

// Los tesoros tienen zonas de despeje para que las guarniciones no bloqueen la exploración.
const locations={
  compass:[-3.25,4.65,.34,[-.78,-.15,-.26]],key:[3.24,3.63,.33,[-.62,.13,-.72]],
  chest:[4.30,-3.65,.36,[0,-.39,0]],pearl:[-4.55,-.88,.23,[0,.35,0]],coin:[-.45,-4.57,.29,[-.26,-.48,.32]]
};
for(const [id,[x,z,h,rotation]] of Object.entries(locations)) {
  group(id,'treasure',[x,ground(x,z)+h,z],{rotation});
  treasures[id](mat=>batch(mat,id));
}
const clear=(x,z,r=.65)=>Object.values(locations).every(([tx,tz])=>Math.hypot(x-tx,z-tz)>r);

// Escena en tres planos de profundidad. En el centro queda un corredor de arena para explorar.
for(const [x,z,rx,h,rz,mat] of [
  [-7,2.0,3.05,2.55,2.0,'limestone'],[-6.7,-2.9,2.9,3.04,2.45,'shale'],[-7.7,-7.2,3.5,3.45,2.4,'basalt'],
  [-6.8,5.95,2.4,1.29,1.44,'shale'],[-4.7,2.95,1.32,.94,1.04,'tinted'],[-3.95,-2.45,1.5,1.13,.95,'limestone'],
  [7.3,2.4,3.1,2.36,1.95,'shale'],[6.75,5.95,2.15,1.28,1.45,'tinted'],[5.35,.0,2.13,1.66,1.50,'limestone'],
  [8.8,-6.9,3.7,3.25,2.8,'basalt'],[2.92,-8.1,1.55,1.19,1.13,'shale'],[-1.25,-6.5,1.13,.68,.76,'shale']
]) rock(x,ground(x,z)-.22,z,rx,h,rz,mat,true);

// El lintel y los dos soportes dejan un hueco real. La luz puntual alcanza su entrada.
rock(3.58,-.13,-5.54,.92,2.25,1.15,'basalt',true);
rock(6.48,-.14,-5.65,1.36,2.42,1.26,'shale',true);
rock(5.02,1.68,-5.74,2.11,.98,1.25,'limestone',true);
rock(5.63,-.27,-7.35,2.0,2.05,1.25,'basalt');
for(const dir of [-1,1]) {
  for(let i=0;i<16;i++) {
    const z=between(-24,9), x=dir*between(9.1,16.5);
    rock(x,ground(x,z)-.3,z,between(1.35,3.3),between(1.15,4.0),between(1.4,3.2),pick(['shale','deepRock','limestone']),rand()>.5);
  }
  for(let i=0;i<17;i++) {
    const z=between(-29,-16), x=dir*between(2,25);
    const ridgeHeight=2.1+.13*abs(x)+1.7*cos(z*.49+x*.34);
    rock(x,-.48,z,between(2.1,4.7),ridgeHeight*between(.76,1.36),between(1.9,3.2),'distant',false,false);
  }
}
for(let i=0;i<96;i++) {
  const z=between(-11,8), x=between(-10.5,10.5), s=between(.12,.63);
  if(!clear(x,z,s+.45)||abs(x)<1.9&&rand()>.35) continue;
  rock(x,ground(x,z)-s*.18,z,s,s*between(.54,.90),s*between(.62,1.13),pick(['limestone','basalt','shale','tinted']));
}

// Agrupaciones principales: las especies comparten zonas, pero varían de escala, color y silueta.
const colonies=[
  [antlers,-6.25,2.17,1.84,1.38,'rust'],[antlers,-7.33,1.97,2.26,1.65,'peach'],
  [antlers,-5.73,1.83,-2.85,1.62,'lilac'],[antlers,-8.72,2.29,-5.9,2.03,'pink'],
  [plates,-5.04,.89,2.97,1.34,'teal'],[sponges,-4.76,.62,3.5,.91,'sponge'],
  [sponges,-6.6,1.20,5.73,1.14,'lilac'],[antlers,-5.18,.20,5.62,.92,'pink'],
  [plates,-3.95,.80,-2.20,1.27,'peach'],[sponges,-4.84,.15,-.52,.72,'violet'],
  [antlers,-3.0,.18,-3.61,.68,'rust'],[plates,-1.28,.48,-6.47,1.03,'lilac'],
  [grass,-7.1,1.96,1.5,1.79,'leaf'],[grass,-6.88,.91,6.4,1.42,'teal'],
  [grass,-5.0,.39,-1.45,1.34,'kelp'],[grass,-7.1,2.34,-3.52,1.63,'jade'],
  [antlers,7.02,1.91,2.33,1.40,'lilac'],[antlers,6.48,.93,5.40,1.14,'rust'],
  [antlers,8.11,1.71,1.32,1.86,'peach'],[antlers,5.22,1.38,-.32,1.13,'pink'],
  [sponges,4.59,.59,.53,.91,'sponge'],[plates,5.12,1.05,.37,1.32,'teal'],
  [sponges,6.64,1.09,5.81,1.10,'sponge'],[plates,5.27,.88,5.89,1.30,'lilac'],
  [antlers,5.13,2.42,-5.76,.81,'rust'],[plates,6.39,1.79,-5.25,.96,'teal'],
  [grass,5.73,.79,5.51,1.17,'leaf'],[grass,5.72,1.30,1.95,1.76,'jade'],
  [grass,7.39,1.91,2.30,1.86,'kelp'],[grass,3.51,.18,-5.01,.94,'teal'],
  [antlers,2.95,.77,-8.25,.97,'pink'],[grass,-1.58,.18,-6.09,1.03,'kelp']
];
for(const [make,x,y,z,size,mat] of colonies) make(x,y,z,size,mat);
for(let i=0;i<37;i++) {
  const z=between(-16,5), x=pick([-1,1])*between(8.3,14);
  const make=pick([antlers,plates,grass,sponges]), mat=make===grass?pick(['teal','kelp']):make===sponges?'sponge':pick(['teal','peach','lilac','pink']);
  make(x,ground(x,z)+between(.27,1.92),z,between(.72,1.57),mat,false);
}
for(const [x,z,s] of [[-2.66,4.23,.44],[3.55,3.94,.39],[-4.74,-.39,.39],[-.63,-4.06,.24],[4.65,-3.1,.40]]) {
  rock(x,ground(x,z)-s*.18,z,s,s*.91,s*.67,'limestone');
}
for(const [x,z,s,m] of [[-.95,4.82,.31,'peach'],[2.75,2.48,.24,'rust'],[-3.76,1.38,.25,'pink'],[2.21,-3.37,.31,'peach'],[-5.61,5.12,.29,'peach']]) seaStar(x,z,s,between(0,TAU),m);

seaFan(-5.43,2.07,1.80,1.62,-.19,'rust','fanLight');
seaFan(-8.11,2.93,-4.62,1.82,.28,'wine','mauve');
seaFan(6.24,1.73,3.0,1.73,.43,'wine','mauve');
seaFan(8.52,2.44,-5.45,1.98,-.56,'rust','fan');
seaFan(-4.93,.49,5.53,.94,.26,'rust','fan');
seaFan(2.74,.79,-8.40,.91,.18,'wine','mauve');
// Posidonias de distintos tamaños dan continuidad a las grietas y a las plataformas de roca.
for(const [x,y,z,s,mat] of [
  [-5.69,1.97,2.65,1.02,'leaf'],[-7.25,2.13,2.49,2.3,'kelp'],[-8.15,2.62,-1.99,1.8,'teal'],
  [-3.90,.91,-2.42,1.05,'jade'],[-4.49,.15,3.96,.72,'leaf'],[-5.27,.27,5.86,.79,'kelp'],
  [5.14,1.34,.63,1.42,'kelp'],[6.24,1.69,3.36,1.26,'leaf'],[4.30,.20,4.82,.84,'teal'],
  [2.87,.25,-7.41,1.15,'leaf'],[-4.29,.22,-7.13,1.91,'kelp']
]) grass(x,y,z,s,mat,false);
for(let i=0;i<19;i++) {
  const x=between(-15,15), z=between(-22,-12);
  grass(x,ground(x,z)+.27,z,between(1.43,3.44),'coolLeaf',false);
}
for(const [x,y,z,s] of [[-4.94,.60,4.08,.71],[-5.86,1.73,3.05,.49],[4.04,.19,3.15,.49],[6.59,1.15,6.42,.85],[-1.67,.32,-5.99,.47],[4.18,1.32,-5.49,.48]])
  brainCoral(x,y,z,s);
grass(-3.52,0,4.80,.39,'teal',false);
grass(3.32,0,3.86,.38,'kelp',false);
for(const [x,z,s] of [[-2.94,4.49,.24],[-3.85,4.14,.19],[3.77,3.86,.22],[-2.15,2.12,.19],[2.74,1.37,.25]]) sponges(x,0,z,s);
for(let j=0;j<23;j++) {
  const z=between(-5.9,7.2), x=pick([-1,1])*between(1.6,5.4);
  if(!clear(x,z,.52))continue;
  for(let k=0;k<3;k++) {
    const px=x+between(-.21,.21),pz=z+between(-.18,.18),s=between(.04,.14);
    ellipsoid(batch('shale'),[px,supportY(px,pz),pz],[s,s*.4,s*.78],6,3);
  }
}

// Cadena rocosa lejana alrededor del arrecife. Las crestas interrumpen la línea plana del horizonte.
function distantRidge() {
  const count=83;
  const layers=[22,30,35.5,41,52].map((radius,j)=>Array.from({length:count},(_,i)=>{
    const a=TAU*i/count, waves=1.3*sin(5*a+.5)+.76*cos(11*a)+.55*sin(19*a)+.47*cos(33*a);
    const r=radius+1.1*sin(a*4)+.59*cos(10*a+j);
    const peak=[-.65,.54,1,.69,-.5][j]*(5.55+waves)+.26*sin(7*a+j);
    return [r*cos(a),peak,r*sin(a)];
  }));
  for(let j=0;j<layers.length-1;j++) for(let i=0;i<count;i++) {
    const k=(i+1)%count;
    batch('distant').quad(layers[j][i],layers[j][k],layers[j+1][k],layers[j+1][i],[0,1,0],.96);
  }
}
distantRidge();

function sandFloor() {
  const coords=[-70,-55,-40,-30,-25,-21,-18];
  for(let k=-16;k<=16;k+=.8) coords.push(rounded(k));
  coords.push(18,22,29,40,55,70);
  const data={positions:[],normals:[],uvs:[],colors:[],indices:[]};
  for(const z of coords) for(const x of coords) {
    const y=ground(x,z);
    const n=unit([ground(x-.04,z)-ground(x+.04,z),.08,ground(x,z-.04)-ground(x,z+.04)]);
    const shadow=footprints.reduce((ao,[px,pz,rx,rz])=>{
      const d=((x-px+.13)/(rx+.37))**2+((z-pz-.05)/(rz+.37))**2;
      return Math.min(ao,1-.43*exp(-d));
    },1);
    data.positions.push(x,rounded(y),z);data.normals.push(...n.map(rounded));
    data.uvs.push(rounded(x/5.6),rounded(z/5.6));data.colors.push(...[shadow,shadow,shadow].map(rounded));
  }
  const width=coords.length;
  for(let j=0;j<width-1;j++) for(let i=0;i<width-1;i++) {
    const a=j*width+i, b=a+1, c=a+width, d=c+1;
    data.indices.push(a,c,b,b,c,d);
  }
  scene.meshes.floor=data;scene.nodes.push({mesh:'floor',material:'sand',position:[0,0,0]});
}
sandFloor();
for(const [id,species,x,y,z,size,phase] of [
  ['pez1','clown',-2.80,3.22,4.15,1.10,.2],['pez2','tang',.66,4.15,2.45,1.18,2.65],
  ['pez3','butterfly',1.98,4.82,-5.0,.81,4.34],['pez4','clown',5.68,3.42,-7.15,.71,5.42]
]) {
  group(id,'fish',[x,y,z],{phase,scale:[size,size,size]});fish(mat=>batch(mat,id),species);
}
// Reutilizar dos mallas para todas las burbujas evita duplicar datos en el JSON.
const orb=new Geometry(),glint=new Geometry();
ellipsoid(orb,[0,0,0],[1,1,1],9,6);ellipsoid(glint,[-.29,.52,.64],[.19,.135,.10],7,4);
scene.meshes.air=orb.data;scene.meshes.highlight=glint.data;
for(let i=0;i<26;i++) {
  const id='burbuja'+(i+1), stream=i%4;
  const [x,z]=[[-4.46,2.80],[4.70,-2.94],[-7.43,-5.1],[7.0,3.5]][stream];
  const radius=rounded(between(.041,.099));
  group(id,'bubble',[x+between(-.49,.49),ground(x,z)+.18,z+between(-.3,.3)],{phase:rounded(between(0,TAU)),scale:[radius,radius,radius]});
  for(const [mesh,material] of [['air','bubble'],['highlight','glint']])
    scene.nodes.push({mesh,material,group:id,position:[0,0,0],solid:false});
}
for(const [name,g] of batches) scene.meshes[name]=g.data;

// Validar los atributos de cada triángulo antes de publicar el recurso común.
let triangles=0;
for(const [id,m] of Object.entries(scene.meshes)) {
  const vertices=m.positions.length/3;
  if(!vertices||vertices!==m.normals.length/3||m.colors&&m.colors.length!==m.positions.length||
     m.uvs&&m.uvs.length!==vertices*2||m.indices.length%3||
     m.indices.some(i=>!Number.isInteger(i)||i<0||i>=vertices)||
     [m.positions,m.normals,m.colors||[],m.uvs||[]].some(a=>!a.every(Number.isFinite))) throw Error('Malla incorrecta: '+id);
  for(let i=0;i<m.indices.length;i+=3){
    const [a,b,c]=m.indices.slice(i,i+3).map(v=>m.positions.slice(v*3,v*3+3));
    const offset=m.indices[i]*3, normal=m.normals.slice(offset,offset+3);
    if(dot(cross(sub(b,a),sub(c,a)),normal)<-0.00003) throw Error('Orden de caras incorrecto: '+id);
  }
  triangles+=m.indices.length/3;
}
for(const n of scene.nodes) if(!scene.meshes[n.mesh]||!scene.materials[n.material]||n.group&&!scene.groups[n.group]) throw Error('Nodo inválido');
const assets=new URL('../assets/',import.meta.url);
mkdirSync(assets,{recursive:true});writeSand(new URL('sand.png',assets));
writeFileSync(new URL('reef.json',import.meta.url),JSON.stringify(scene));
console.log(scene.nodes.length+' nodos, '+Object.keys(scene.meshes).length+' mallas y '+triangles+' triángulos en las mallas fuente.');

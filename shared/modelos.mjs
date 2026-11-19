import {TAU, add, times, tube, rings, cuboid, ellipsoid, relief} from './geometria.mjs';

// Las caras decoradas miran a +Z; el juego aplica las transformaciones a todo el grupo.
function disk(g,c,r,thickness,sectors=20) {
  tube(g,addDepth(c,-thickness/2,thickness/2),[r,r],sectors);
}
const addDepth=(c,a,b)=>[add(c,[0,0,a]),add(c,[0,0,b])];

function hoop(g,c,r,w,sectors=22) {
  const circle=(a,d)=>[c[0]+d*Math.cos(a),c[1]+d*Math.sin(a),c[2]];
  for(let i=0;i<sectors;i++) {
    const a=i*TAU/sectors, b=(i+1)*TAU/sectors;
    const outside=[Math.cos((a+b)/2),Math.sin((a+b)/2),0];
    const strip=(radius,z)=>[add(circle(a,radius),[0,0,z]),add(circle(b,radius),[0,0,z])];
    const [ao,bo]=strip(r+w/2,w/2),[ai,bi]=strip(r-w/2,w/2);
    const [co,do_]=strip(r+w/2,-w/2),[ci,di]=strip(r-w/2,-w/2);
    g.quad(ao,bo,bi,ai,[0,0,1]);g.quad(co,do_,di,ci,[0,0,-1]);
    g.quad(ao,bo,do_,co,outside);g.quad(ai,bi,di,ci,times(outside,-1));
  }
}

function compass(part) {
  hoop(part('gold'),[0,.35,0],.092,.036,14);
  disk(part('brass'),[0,0,0],.32,.105);disk(part('dial'),[0,0,.061],.285,.018);
  hoop(part('gold'),[0,0,.077],.293,.04);
  for(let i=0;i<16;i++) {
    const a=i*TAU/16;
    tube(part('gold'),[.218,.253].map(r=>[r*Math.cos(a),r*Math.sin(a),.077]),[.009,.012],4);
  }
  relief(part('ivory'),[[0,-.215],[-.056,0],[.018,.045],[.06,.005]],.092,.018);
  relief(part('red'),[[0,.236],[.057,0],[-.012,-.039],[-.057,.002]],.093,.018);
  disk(part('gold'),[0,0,.108],.034,.018,12);
}

function key(part) {
  hoop(part('gold'),[-.23,.16,0],.145,.067,16);
  tube(part('gold'),[[-.15,.062,0],[.28,-.33,0]],[.043,.049],8);
  for(const [x,y] of [[.13,-.195],[.235,-.286]]) {
    tube(part('gold'),[[x,y,0],[x+.095,y+.113,0]],[.039,.04],5);
  }
  tube(part('brass'),[[-.11,.076,0],[-.048,.002,0]],[.065,.063],8);
}

function chest(part) {
  cuboid(part('wood'),[0,-.125,0],[.92,.42,.59]);
  const profile=[];
  for(let i=0;i<=8;i++) {
    const a=i*Math.PI/8;
    profile.push([.072+.272*Math.sin(a),.299*Math.cos(a)]);
  }
  function lid(g,x0,x1,excess=0) {
    const yz=profile.map(([y,z])=>[y+excess,z*(1+2*excess)]);
    for(let i=0;i<yz.length-1;i++) {
      const [y,z]=yz[i], [y2,z2]=yz[i+1];
      g.quad([x0,y,z],[x1,y,z],[x1,y2,z2],[x0,y2,z2],[0,y-.07,z]);
    }
    for(const [x,n] of [[x0,-1],[x1,1]]) for(let i=0;i<yz.length-1;i++)
      g.triangle([x,.073,0],[x,...yz[i]],[x,...yz[i+1]],[n,0,0]);
  }
  lid(part('teak'),-.469,.469);
  for (const x of [-.33,.33]) {
    lid(part('gold'),x-.040,x+.04,.013);
    cuboid(part('gold'),[x,-.126,0],[.073,.42,.604]);
  }
  cuboid(part('brass'),[0,.066,0],[.946,.051,.61]);
  cuboid(part('gold'),[0,.008,.32],[.145,.187,.042]);
  disk(part('wood'),[0,.022,.345],.024,.008,10);
  for(const x of [-.418,.418]) for(const y of [-.265,-.02]) disk(part('brass'),[x,y,.30],.022,.016,8);
}

// Valvas festoneadas con estrías radiales. La perla forma el centro de esta miniatura.
function pearl(part) {
  for(const upper of [false,true]) {
    const base=[0,-.16,-.13], tilt=upper?1.10:-.18, side=upper?.95:1;
    const shell=(i,t)=>{
      const a=-1.32+2.64*i/24, r=(.53+.021*Math.cos(i*Math.PI))*t*side;
      return add(base,[r*Math.sin(a),r*Math.cos(a)*Math.sin(tilt)-.065*Math.sin(Math.PI*t),r*Math.cos(a)*Math.cos(tilt)]);
    };
    for(let i=0;i<24;i++) for(let band=0;band<3;band++) {
      const a=shell(i,band/3), b=shell(i+1,band/3), c=shell(i+1,(band+1)/3), d=shell(i,(band+1)/3);
      const g=part(i%4<2?'shell':'shellLight');
      g.quad(a,b,c,d,[0,1,upper?1:0]);g.quad(a,b,c,d,[0,-1,upper?-1:0]);
    }
  }
  ellipsoid(part('pearl'),[0,.025,.076],[.178,.182,.178],16,10);
}

function coin(part) {
  disk(part('gold'),[0,0,0],.285,.075,26);
  for(const side of [-1,1]) {
    hoop(part('brass'),[0,0,side*.042],.241,.017,24);
    const star=Array.from({length:8},(_,i)=>{
      const a=i*TAU/8,r=i%2?.066:.175;
      return [r*Math.cos(a),r*Math.sin(a)];
    });
    relief(part('brass'),star,side*.043,.01);
  }
}

export const treasures={compass,key,chest,pearl,coin};

export function fish(part, species) {
  const clown=species==='clown', gold=species==='butterfly';
  const body=clown?'tangerine':gold?'sun':'lagoon', marks=clown?'ivory':gold?'ink':'aqua';
  const height=clown?.31:.45;
  // Una sola piel recorre el hocico y el pedúnculo caudal. Las franjas siguen esa misma piel.
  const slices=[[-.71,.09],[-.46,.61],[-.37,.76],[-.27,.86],[-.08,1.0],[.04,.99],[.15,.94],[.3,.83],[.40,.71],[.50,.55],[.64,.18],[.69,.055]];
  const skin=slices.map(([x,r])=>Array.from({length:12},(_,i)=>{
    const a=i*TAU/12;
    return [x,height*r*Math.cos(a),.215*r*Math.sin(a)];
  }));
  for(let j=0;j<skin.length-1;j++)
    rings(part(([2,5,8].includes(j)&&clown)||([2,8].includes(j)&&gold)||(j===3&&!gold&&!clown)?marks:body),[skin[j],skin[j+1]],{caps:false});
  const fins=clown?'apricot':gold?'sun':'sun';
  relief(part(fins),[[-.62,.02],[-1.044,.277],[-.96,.016],[-1.01,-.245],[-.62,-.06]],0,.066);
  relief(part(body),[[-.52,.10],[-.38,height*1.26],[-.09,height*1.4],[.21,height*.78]],0,.055);
  relief(part(fins),[[-.44,-.12],[-.46,-height*1.26],[.10,-height*.83]],0,.044);
  for(const side of [-1,1]) {
    ellipsoid(part('ivory'),[.397,.085,side*.143],[.080,.081,.042],9,5);
    ellipsoid(part('ink'),[.41,.089,side*.176],[.049,.052,.029],9,5);
    ellipsoid(part('ivory'),[.43,.112,side*.201],[.014,.014,.008],6,4);
    relief(part(fins),[[-.16,.018],[.09,.025],[-.17,-.173],[-.255,-.146]],side*.2,.030);
  }
}

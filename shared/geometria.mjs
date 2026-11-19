// Constructores de mallas. El eje Y apunta hacia arriba y la cara frontal es antihoraria.
export const TAU = 2 * Math.PI;
export const add = (a, b) => a.map((n, i) => n + b[i]);
export const sub = (a, b) => a.map((n, i) => n - b[i]);
export const times = (p, k) => p.map(n => n * k);
export const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);
export const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
export const unit = p => times(p, 1 / (Math.hypot(...p) || 1));
export const mix = (a, b, t) => add(times(a, 1-t), times(b, t));
export const rounded = n => Math.round(n * 1000) / 1000;

export function random(seed) {
  let value = seed >>> 0;
  return () => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// Los índices reutilizan vértices con la misma normal. Las aristas duras conservan dos normales.
export class Geometry {
  constructor() {
    this.data = {positions: [], normals: [], indices: []};
    this.lookup = new Map();
  }
  vertex(p, n, shade) {
    const values = [...p, ...n].map(rounded);
    const key = values.join('/') + '/' + (shade ?? '');
    if (this.lookup.has(key)) return this.lookup.get(key);
    const index = this.data.positions.length / 3;
    this.data.positions.push(...values.slice(0, 3));
    this.data.normals.push(...values.slice(3));
    if (shade !== undefined && !this.data.colors) this.data.colors=Array(index*3).fill(1);
    if (this.data.colors) this.data.colors.push(shade??1,shade??1,shade??1);
    this.lookup.set(key, index);
    return index;
  }
  triangle(a, b, c, outside, shade) {
    let n = cross(sub(b, a), sub(c, a));
    if (Math.hypot(...n) < 1e-8) return;
    if (outside && dot(n, outside) < 0) { [b, c] = [c, b]; n = times(n, -1); }
    n = unit(n);
    this.data.indices.push(...[a,b,c].map(p => this.vertex(p, n, shade)));
  }
  quad(a, b, c, d, outside, shade) {
    this.triangle(a,b,c,outside,shade);
    this.triangle(a,c,d,outside,shade);
  }
}

// Un perfil de anillos permite modelar a la vez cantos, calizas, conchas y cuerpos de peces.
export function rings(g, layers, {caps=true, shade}={}) {
  const center = ring => times(ring.reduce(add, [0,0,0]), 1/ring.length);
  for (let j=1; j<layers.length; j++) {
    const low=layers[j-1], high=layers[j];
    const middle=mix(center(low),center(high),.5);
    for (let i=0; i<low.length; i++) {
      const next=(i+1)%low.length;
      const outside=sub(mix(low[i],high[next],.5),middle);
      g.quad(low[i],low[next],high[next],high[i],outside,shade?.(j,i));
    }
  }
  if (caps) {
    for (const [idx, next] of [[0,1],[layers.length-1,layers.length-2]]) {
      const ring=layers[idx], origin=center(ring), outward=sub(origin,center(layers[next]));
      for (let i=0;i<ring.length;i++) g.triangle(origin,ring[i],ring[(i+1)%ring.length],outward,shade?.(idx,i));
    }
  }
}

export function ellipsoid(g, center, radii, sectors=10, latitudes=5, yaw=0) {
  const layers=[];
  for (let j=0;j<=latitudes;j++) {
    const lat=(j/latitudes-.5)*Math.PI;
    layers.push(Array.from({length:sectors},(_,i)=>{
      const a=TAU*i/sectors;
      const x=radii[0]*Math.cos(lat)*Math.cos(a), z=radii[2]*Math.cos(lat)*Math.sin(a);
      return add(center,[x*Math.cos(yaw)-z*Math.sin(yaw),radii[1]*Math.sin(lat),x*Math.sin(yaw)+z*Math.cos(yaw)]);
    }));
  }
  rings(g,layers,{caps:false});
}

export function tube(g, points, widths, sides=7, cap=true) {
  const overall=unit(sub(points.at(-1),points[0]));
  const reference=Math.abs(overall[2])<.89?[0,0,1]:[1,0,0];
  const layers=points.map((p,j)=>{
    const tangent=unit(sub(points[Math.min(points.length-1,j+1)], points[Math.max(0,j-1)]));
    const u=unit(cross(tangent,reference)), v=cross(tangent,u);
    return Array.from({length:sides},(_,i)=>{
      const a=TAU*i/sides;
      return add(p,add(times(u,widths[j]*Math.cos(a)),times(v,widths[j]*Math.sin(a))));
    });
  });
  if(sides<6) { rings(g,layers,{caps:cap}); return; }
  // Compartir vértices y normales redondas reduce los datos de las ramificaciones.
  const indices=layers.map((ring,j)=>ring.map(p=>g.vertex(p,unit(sub(p,points[j])))));
  const append=(a,b,c)=>{
    const p=i=>g.data.positions.slice(i*3,i*3+3);
    const n=g.data.normals.slice(a*3,a*3+3);
    const oriented=dot(cross(sub(p(b),p(a)),sub(p(c),p(a))),n);
    if(Math.abs(oriented)>1e-9) g.data.indices.push(a,...(oriented<0?[c,b]:[b,c]));
  };
  for(let j=0;j<layers.length-1;j++) for(let i=0;i<sides;i++) {
    const next=(i+1)%sides, a=indices[j][i], b=indices[j][next];
    const c=indices[j+1][next], d=indices[j+1][i];
    append(a,b,c);append(a,c,d);
  }
  if(cap) for(const [j,k] of [[0,1],[layers.length-1,layers.length-2]]) {
    for(let i=0;i<sides;i++) g.triangle(points[j],layers[j][i],layers[j][(i+1)%sides],sub(points[j],points[k]));
  }
}

export function cuboid(g, center, size) {
  const points=[-1,1].map(y => [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>add(center,[x*size[0]/2,y*size[1]/2,z*size[2]/2])));
  rings(g,points);
}

// Polígono en XY con espesor a ambos lados. Útil para aletas, agujas y estrellas.
export function relief(g, outline, z, depth) {
  const front=outline.map(([x,y])=>[x,y,z+depth/2]);
  const back=outline.map(([x,y])=>[x,y,z-depth/2]);
  const origin=times(front.reduce(add,[0,0,0]),1/front.length);
  const rear=[origin[0],origin[1],z-depth/2];
  for(let i=0;i<front.length;i++) {
    const k=(i+1)%front.length;
    g.triangle(origin,front[i],front[k],[0,0,1]);
    g.triangle(rear,back[i],back[k],[0,0,-1]);
    g.quad(front[i],front[k],back[k],back[i],sub(mix(front[i],front[k],.5),origin));
  }
}

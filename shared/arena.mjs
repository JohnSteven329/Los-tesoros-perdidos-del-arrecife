import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { random, TAU } from './geometria.mjs';

// PNG RGB de 8 bits con bordes periódicos. No requiere bibliotecas ni recursos descargados.
function pngChunk(type, bytes) {
  const payload=Buffer.concat([Buffer.from(type),bytes]);
  let crc=0xffffffff;
  for (const byte of payload) {
    crc ^= byte;
    for(let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  const length=Buffer.alloc(4), checksum=Buffer.alloc(4);
  length.writeUInt32BE(bytes.length); checksum.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([length,payload,checksum]);
}

export function writeSand(path) {
  const side=384, stride=1+3*side, pixels=Buffer.alloc(side*stride);
  const rand=random(917), sin=Math.sin, cos=Math.cos;
  const cells=Array.from({length:25},()=>[.22+.56*rand(),.22+.56*rand()]);
  const mod=n=>(n%5+5)%5;
  for(let y=0;y<side;y++) for(let x=0;x<side;x++) {
    const u=x/side,v=y/side;
    const a=5*u+.19*sin(TAU*v)+.10*cos(TAU*(2*u+v));
    const b=5*v+.24*cos(TAU*u)+.08*sin(TAU*(u-3*v));
    let near=9, second=9;
    for(let j=Math.floor(b)-1;j<=Math.floor(b)+1;j++) for(let i=Math.floor(a)-1;i<=Math.floor(a)+1;i++) {
      const cell=cells[mod(j)*5+mod(i)];
      const d=Math.hypot(a-i-cell[0],b-j-cell[1]);
      if(d<near) { second=near; near=d; } else if(d<second) second=d;
    }
    const caustic=Math.exp(-16*(second-near));
    const wave=sin(TAU*(8*v+u)+1.3*cos(TAU*(u+v))+.5*sin(TAU*3*u));
    const ripple=wave*6+Math.max(0,wave)**5*5;
    const grain=(rand()-.5)*16+(rand()>.995?-20:0);
    const offset=y*stride+1+x*3;
    [213,203,163].forEach((channel,i)=>{
      pixels[offset+i]=Math.min(255,Math.max(0,Math.round(channel+ripple+grain+caustic*(i===2?21:17))));
    });
  }
  const header=Buffer.alloc(13);
  header.writeUInt32BE(side);header.writeUInt32BE(side,4);header[8]=8;header[9]=2;
  writeFileSync(path,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',deflateSync(pixels,{level:9})),pngChunk('IEND',Buffer.alloc(0))]));
}

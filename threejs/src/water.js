import * as THREE from 'three';

const colorOutput = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

// Una bóveda centrada en el observador simula el color del agua y la superficie lejana.
function makeSky(time) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { time, water: { value: new THREE.Color() }, surface: { value: new THREE.Color() } },
    vertexShader: `varying vec3 direction;
      void main() {
        direction = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: `varying vec3 direction;
      uniform vec3 water, surface;
      uniform float time;
      void main() {
        vec3 ray = normalize(direction);
        // A la altura del horizonte la bóveda toma exactamente el tono de la niebla lejana.
        float sky = smoothstep(.002, .46, ray.y);
        float sun = pow(max(0., dot(ray, normalize(vec3(-.46, .34, -1.)))), 9.);
        vec3 color = mix(water, surface, sky * (.71 + .29 * sun));
        vec2 uv = ray.xz * 1.8 / max(.06, ray.y);
        float wave = sin(uv.x * 2.2 + sin(uv.y * 1.5 + time * .13))
                   + sin(uv.y * 2.3 + sin(uv.x + time * .09));
        float ripple = pow(max(0., 1. - abs(wave) * 1.6), 3.);
        color += surface * ripple * .12 * smoothstep(.1, .42, ray.y);
        color += surface * sun * .19 * smoothstep(.012, .37, ray.y);
        gl_FragColor = vec4(color, 1.);
        ${colorOutput}
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(82, 30, 16), material);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return sky;
}

function makeRays(time) {
  const vertices = [], uvs = [], indices = [], intensities = [];
  // x, z, semiancho, inclinación y opacidad. La dispersión es mayor al llegar al fondo.
  const beams = [[-24,-14,3.8,8,.64], [-16,-9,2.3,7.3,.84], [-10,-8,1,6.7,.56],
    [-5,-15,4.4,5.8,.76], [8,-19,2.5,5.3,.42], [17,-12,4.1,4.8,.64]];
  for (const [x, z, width, drift, intensity] of beams) {
    const offset = vertices.length / 3;
    vertices.push(x - width, 17, z, x + width, 17, z, x + drift - width * 1.6, -.1, z + 3, x + drift + width * 1.6, -.1, z + 3);
    uvs.push(0, 1, 1, 1, 0, 0, 1, 0);
    intensities.push(intensity, intensity, intensity, intensity);
    indices.push(offset, offset + 2, offset + 1, offset + 2, offset + 3, offset + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('intensity', new THREE.Float32BufferAttribute(intensities, 1));
  geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    uniforms: { time, strength: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 beam; attribute float intensity; varying float weight;
      void main(){ beam=uv; weight=intensity; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float strength, time; varying vec2 beam; varying float weight;
      void main(){
        float mid = .49 + .05 * sin(beam.y * 2.8 + time * .16 + 9. * weight);
        float stripe = 1. - smoothstep(.02, .48, abs(beam.x - mid));
        float mottling = .85 + .15 * sin(beam.x * 7. + beam.y * 3. + time * .16 + 16. * weight);
        float fade = smoothstep(.04, .81, beam.y);
        gl_FragColor=vec4(.39,.82,.91, stripe * mottling * fade * weight * strength * .145);
        ${colorOutput}
      }`,
  });
  return new THREE.Mesh(geometry, material);
}

function makeParticles(time) {
  const positions = [], phases = [];
  let seed = 7843;
  function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
  for (let i = 0; i < 220; i++) {
    positions.push(random() * 39 - 19.5, random() * 11 + .2, random() * 42 - 26);
    phases.push(random() * 6.28);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { time, pixels: { value: 1 } }, transparent: true, depthWrite: false,
    vertexShader: `uniform float time, pixels; attribute float phase; varying float alpha;
      void main(){
        vec3 p = position + vec3(sin(time*.13+phase)*.18, sin(time*.22+phase)*.16, 0.);
        vec4 view = modelViewMatrix * vec4(p,1.);
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp((2.8 + .9 * sin(phase)) * pixels * 8. / max(2.,-view.z), 1., 3.5*pixels);
        alpha = smoothstep(.4,2.,-view.z) * (1. - smoothstep(12.,32.,-view.z)) * .55;
      }`,
    fragmentShader: `varying float alpha;
      void main(){
        float glow=1.-smoothstep(.03,.5,length(gl_PointCoord-.5));
        gl_FragColor=vec4(.57,.94,.93,glow*alpha);
        ${colorOutput}
      }`,
  });
  return new THREE.Points(geometry, material);
}

export function createWater(scene, pixelRatio) {
  const time = { value: 0 };
  const sky = makeSky(time), rays = makeRays(time), particles = makeParticles(time);
  particles.material.uniforms.pixels.value = pixelRatio;
  const ambient = new THREE.AmbientLight();
  const sunlight = new THREE.DirectionalLight();
  const cave = new THREE.PointLight(0xffffff, 1, 24, 2);
  scene.add(sky, rays, particles, ambient, sunlight, cave);
  return {
    setLight(preset, mode) {
      const deep = new THREE.Color(preset.water);
      scene.fog = new THREE.Fog(deep, preset.fogNear, preset.fogFar);
      scene.background = deep;
      sky.material.uniforms.water.value.copy(deep);
      sky.material.uniforms.surface.value.set(preset.surface);
      rays.material.uniforms.strength.value = mode === 0 ? 1 : .52;
      ambient.color.set(preset.ambient);
      ambient.intensity = preset.ambientIntensity;
      sunlight.color.set(preset.sun);
      sunlight.intensity = preset.sunIntensity;
      sunlight.position.fromArray(preset.sunPosition);
      cave.color.set(preset.point);
      cave.intensity = preset.pointIntensity;
      cave.position.fromArray(preset.pointPosition);
    },
    update(seconds, camera) {
      time.value = seconds;
      sky.position.copy(camera.position);
    },
  };
}

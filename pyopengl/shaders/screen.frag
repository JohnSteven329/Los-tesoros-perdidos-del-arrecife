#version 330 core
in vec2 uv;
out vec4 color;
uniform bool uHud;
uniform sampler2D uImage;
uniform vec3 uFog;
uniform vec3 uSurface;
uniform mat4 uInverseVP;
uniform vec3 uEye;
uniform float uTime;

void main(){
    if (uHud) {
        color = texture(uImage, vec2(uv.x, 1. - uv.y));
        return;
    }
    vec4 farPoint = uInverseVP * vec4(uv * 2. - 1., 1., 1.);
    vec3 ray = normalize(farPoint.xyz / farPoint.w - uEye);
    float h = smoothstep(.002, .46, ray.y);
    float sun = pow(max(0., dot(ray, normalize(vec3(-.46, .34, -1.)))), 9.);
    vec3 water = mix(uFog, uSurface, h * (.71 + .29 * sun));
    vec2 waves = ray.xz * 1.8 / max(.06, ray.y);
    float ridge = sin(waves.x * 2.2 + sin(waves.y * 1.5 + uTime * .13))
                + sin(waves.y * 2.3 + sin(waves.x + uTime * .09));
    float ripple = pow(max(0., 1. - abs(ridge) * 1.6), 3.);
    water += uSurface * ripple * .12 * smoothstep(.10, .42, ray.y);
    water += uSurface * sun * .19 * smoothstep(.012, .37, ray.y);
    // Bandas proyectadas sobre la dirección de la mirada, sin atravesar sólidos.
    float k = dot(ray, vec3(9., 4., 3.)) + .1 * sin(.16 * uTime);
    float shafts = pow(max(0., .5 + .5 * sin(k * 3. + sin(k * 5.))), 7.);
    water += (vec3(.012, .055, .050) + .11 * uSurface) * shafts * smoothstep(-.24, .46, ray.y);
    color = vec4(1.055 * pow(water, vec3(1./2.4)) - .055, 1.);
}

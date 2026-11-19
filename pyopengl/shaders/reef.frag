#version 330 core
in vec3 vPosition;
in vec3 vNormal;
in vec3 vColor;
in vec2 vUV;
in vec4 vSurface; // rugosidad, metal, opacidad, uso de arena
in vec3 vEmission;
out vec4 color;

uniform bool uPicking;
uniform float uId;
uniform sampler2D uSand;
uniform vec3 uEye, uFog, uAmbient, uSun, uSunDir, uPoint, uPointPos;
uniform float uFogNear, uFogFar, uTime;

void main() {
    if (uPicking) {
        color = vec4(uId / 255., 0., 0., 1.);
        return;
    }
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uEye - vPosition);
    vec3 L = normalize(uSunDir);
    vec3 toLamp = uPointPos - vPosition;
    vec3 P = normalize(toLamp);
    float rough = clamp(vSurface.x, .05, 1.);
    float metal = vSurface.y;
    vec3 base = vColor;
    if (vSurface.w > .5)
        base *= texture(uSand, vUV).rgb;
    float lambert = max(dot(N, L), 0.);
    float lamp = max(dot(N, P), 0.) / max(dot(toLamp, toLamp), .6);
    // La ondulación de luz sobre las caras superiores sugiere cáusticas.
    vec2 waves = vPosition.xz * vec2(.78, .64) + uTime * vec2(.13, -.10);
    float glint = pow(.5 + .5 * sin(waves.x + sin(waves.y)) * cos(waves.y), 14.);
    vec3 lit = base * (uAmbient + uSun * lambert + uPoint * lamp);
    lit += base * glint * .14 * max(N.y, 0.);
    float shine = pow(max(dot(N, normalize(L + V)), 0.), mix(90., 8., rough));
    lit += (mix(vec3(.04), base, metal) * (1. - rough * .65) * shine) * uSun;
    lit += vEmission;
    float fog = smoothstep(uFogNear, uFogFar, distance(uEye, vPosition));
    lit = mix(lit, uFog, fog);
    vec3 srgb = mix(12.92 * lit, 1.055 * pow(max(lit, vec3(0.)), vec3(1./2.4)) - .055,
                    step(vec3(.0031308), lit));
    color = vec4(srgb, vSurface.z);
}

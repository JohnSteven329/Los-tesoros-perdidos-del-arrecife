#version 330 core
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
layout(location=3) in vec2 aUV;
layout(location=4) in vec4 aSurface;
layout(location=5) in vec3 aEmission;

uniform mat4 uVP;
uniform mat4 uModel;
out vec3 vPosition;
out vec3 vNormal;
out vec3 vColor;
out vec2 vUV;
out vec4 vSurface;
out vec3 vEmission;

void main() {
    vec4 position = uModel * vec4(aPosition, 1.);
    vPosition = position.xyz;
    vNormal = mat3(transpose(inverse(uModel))) * aNormal;
    vColor = aColor;
    vUV = aUV;
    vSurface = aSurface;
    vEmission = aEmission;
    gl_Position = uVP * position;
}

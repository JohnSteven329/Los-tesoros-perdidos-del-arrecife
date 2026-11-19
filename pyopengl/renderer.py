"""Renderizado con VBO indexado y selección del fragmento más cercano."""

import ctypes
from pathlib import Path

import numpy as np
import pygame
from OpenGL import GL as gl
from OpenGL.GL.shaders import compileProgram, compileShader

from scene import ROOT, linear, pack_scene


SHADERS = Path(__file__).with_name("shaders")


class Program:
    def __init__(self, name):
        stages = [(gl.GL_VERTEX_SHADER, "vert"), (gl.GL_FRAGMENT_SHADER, "frag")]
        self.id = compileProgram(*(compileShader((SHADERS / f"{name}.{ext}").read_text(encoding="utf-8"), stage)
                                   for stage, ext in stages))
        self.locations = {}

    def use(self):
        gl.glUseProgram(self.id)

    def loc(self, name):
        if name not in self.locations:
            self.locations[name] = gl.glGetUniformLocation(self.id, name)
        return self.locations[name]

    def matrix(self, name, value):
        gl.glUniformMatrix4fv(self.loc(name), 1, gl.GL_TRUE, np.ascontiguousarray(value, dtype=np.float32))

    def vector(self, name, value):
        gl.glUniform3f(self.loc(name), *value)

    def scalar(self, name, value):
        gl.glUniform1f(self.loc(name), value)

    def flag(self, name, value):
        gl.glUniform1i(self.loc(name), int(value))


def texture(surface, sand=False):
    tex = gl.glGenTextures(1)
    gl.glBindTexture(gl.GL_TEXTURE_2D, tex)
    # GLSL invierte las coordenadas de la interfaz. La arena usa UV estándar de OpenGL.
    pixels = pygame.image.tobytes(surface, "RGBA", sand)
    fmt = gl.GL_SRGB8_ALPHA8 if sand else gl.GL_RGBA8
    gl.glTexImage2D(gl.GL_TEXTURE_2D, 0, fmt, *surface.get_size(), 0, gl.GL_RGBA,
                    gl.GL_UNSIGNED_BYTE, pixels)
    filtering = gl.GL_LINEAR_MIPMAP_LINEAR if sand else gl.GL_LINEAR
    gl.glTexParameteri(gl.GL_TEXTURE_2D, gl.GL_TEXTURE_MIN_FILTER, filtering)
    gl.glTexParameteri(gl.GL_TEXTURE_2D, gl.GL_TEXTURE_MAG_FILTER, gl.GL_LINEAR)
    wrap = gl.GL_REPEAT if sand else gl.GL_CLAMP_TO_EDGE
    for parameter in (gl.GL_TEXTURE_WRAP_S, gl.GL_TEXTURE_WRAP_T):
        gl.glTexParameteri(gl.GL_TEXTURE_2D, parameter, wrap)
    if sand:
        gl.glGenerateMipmap(gl.GL_TEXTURE_2D)
    return tex


class Renderer:
    def __init__(self, scene, settings):
        vertices, indices, self.batches = pack_scene(scene)
        self.program = Program("reef")
        self.screen = Program("screen")
        self.settings = settings
        self.treasure_ids = {record["id"]: i for i, record in enumerate(settings["treasures"], 1)}
        self.sand = texture(pygame.image.load(str(ROOT / "assets" / "sand.png")), sand=True)
        self.hud_texture = None
        self.vao = gl.glGenVertexArrays(1)
        gl.glBindVertexArray(self.vao)
        self.vbo, self.ebo = gl.glGenBuffers(2)
        gl.glBindBuffer(gl.GL_ARRAY_BUFFER, self.vbo)
        gl.glBufferData(gl.GL_ARRAY_BUFFER, vertices.nbytes, vertices, gl.GL_STATIC_DRAW)
        gl.glBindBuffer(gl.GL_ELEMENT_ARRAY_BUFFER, self.ebo)
        gl.glBufferData(gl.GL_ELEMENT_ARRAY_BUFFER, indices.nbytes, indices, gl.GL_STATIC_DRAW)
        offset = 0
        for attribute, width in enumerate([3, 3, 3, 2, 4, 3]):
            gl.glEnableVertexAttribArray(attribute)
            gl.glVertexAttribPointer(attribute, width, gl.GL_FLOAT, gl.GL_FALSE, vertices.strides[0],
                                     ctypes.c_void_p(offset))
            offset += width * 4
        gl.glClearColor(.033, .071, .086, 1)
        gl.glDisable(gl.GL_DITHER)
        gl.glBlendFunc(gl.GL_SRC_ALPHA, gl.GL_ONE_MINUS_SRC_ALPHA)

    def draw(self, rect, window_h, camera, matrices, game, picking=False, treasures_only=False):
        gl.glBindVertexArray(self.vao)
        gl.glViewport(rect.x, window_h - rect.bottom, rect.width, rect.height)
        if picking:
            # Un identificador discreto nunca debe promediarse con el del píxel vecino.
            gl.glDisable(gl.GL_MULTISAMPLE)
            gl.glClearColor(0, 0, 0, 1)
        else:
            gl.glEnable(gl.GL_MULTISAMPLE)
            gl.glClearColor(.039, .081, .094, 1)
        gl.glClear(gl.GL_COLOR_BUFFER_BIT | gl.GL_DEPTH_BUFFER_BIT)
        gl.glDisable(gl.GL_BLEND)
        eye, vp = camera.eye, camera.view_projection(*rect.size)
        lights = self.settings["lights"][game.light]
        fog = linear(lights["water"])
        if not picking:
            gl.glDisable(gl.GL_DEPTH_TEST)
            self.screen.use()
            self.screen.flag("uHud", False)
            self.screen.matrix("uInverseVP", np.linalg.inv(vp))
            self.screen.vector("uEye", eye)
            self.screen.vector("uFog", fog)
            self.screen.vector("uSurface", linear(lights["surface"]))
            self.screen.scalar("uTime", game.water_time)
            gl.glDrawArrays(gl.GL_TRIANGLES, 0, 3)

        gl.glEnable(gl.GL_DEPTH_TEST)
        p = self.program
        p.use()
        p.matrix("uVP", vp)
        p.flag("uPicking", picking)
        if not picking:
            p.vector("uEye", eye)
            p.vector("uFog", fog)
            p.vector("uAmbient", linear(lights["ambient"]) * lights["ambientIntensity"] / np.pi)
            p.vector("uSun", linear(lights["sun"]) * lights["sunIntensity"] / np.pi)
            p.vector("uSunDir", lights["sunPosition"])
            p.vector("uPoint", linear(lights["point"]) * lights["pointIntensity"] / np.pi)
            p.vector("uPointPos", lights["pointPosition"])
            p.scalar("uFogNear", lights["fogNear"])
            p.scalar("uFogFar", lights["fogFar"])
            p.scalar("uTime", game.water_time)
            gl.glBindTexture(gl.GL_TEXTURE_2D, self.sand)

        def draw_batch(batch):
            p.matrix("uModel", matrices[batch.group])
            if picking:
                p.scalar("uId", self.treasure_ids.get(batch.group, 0))
            gl.glDrawElements(gl.GL_TRIANGLES, batch.count, gl.GL_UNSIGNED_INT,
                              ctypes.c_void_p(4 * batch.first))

        translucent = []
        for batch in self.batches:
            if batch.group not in matrices:
                continue
            if picking and (not batch.solid or (treasures_only and batch.group not in self.treasure_ids)):
                continue
            if batch.transparent and not picking:
                m = matrices[batch.group]
                center = m[:3, :3] @ batch.center + m[:3, 3]
                translucent.append((np.linalg.norm(center - eye), batch))
            else:
                draw_batch(batch)
        if translucent:
            gl.glEnable(gl.GL_BLEND)
            gl.glDepthMask(gl.GL_FALSE)
            for _, batch in sorted(translucent, key=lambda pair: pair[0], reverse=True):
                draw_batch(batch)
            gl.glDepthMask(gl.GL_TRUE)

    def select(self, pos, rect, height, camera, matrices, game):
        if not rect.collidepoint(pos):
            return None
        self.draw(rect, height, camera, matrices, game, picking=True)
        pixel = gl.glReadPixels(pos[0], height - 1 - pos[1], 1, 1, gl.GL_RGBA, gl.GL_UNSIGNED_BYTE)
        code = pixel[0]
        return next((key for key, value in self.treasure_ids.items() if value == code), None)

    def overlay(self, surface, size):
        if surface is not None:
            if self.hud_texture is not None:
                gl.glDeleteTextures([self.hud_texture])
            self.hud_texture = texture(surface)
        gl.glViewport(0, 0, *size)
        gl.glDisable(gl.GL_DEPTH_TEST)
        gl.glEnable(gl.GL_BLEND)
        self.screen.use()
        self.screen.flag("uHud", True)
        gl.glBindTexture(gl.GL_TEXTURE_2D, self.hud_texture)
        gl.glDrawArrays(gl.GL_TRIANGLES, 0, 3)

"""Distingue un clic de búsqueda de un arrastre de la cámara."""

import math


class Pointer:
    def __init__(self):
        self.cancel()

    def cancel(self):
        self.start = self.last = None
        self.dragging = self.in_scene = False

    def press(self, pos, in_scene):
        self.start = self.last = pos
        self.dragging = False
        self.in_scene = in_scene

    def motion(self, pos, camera):
        if self.start is None:
            return
        if not self.dragging and math.dist(pos, self.start) < 5:
            return
        self.dragging = True
        if self.in_scene:
            camera.orbit(pos[0] - self.last[0], pos[1] - self.last[1])
        self.last = pos

    def release(self, pos):
        click = self.start is not None and not self.dragging and math.dist(pos, self.start) < 5
        self.cancel()
        return click

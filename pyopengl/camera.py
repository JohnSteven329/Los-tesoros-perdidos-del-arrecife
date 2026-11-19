"""Cámara orbital con traslación de su punto de interés sobre el arrecife."""

import math

import numpy as np

from transforms import look_at, perspective


def clamp(value, bounds):
    return max(bounds[0], min(bounds[1], value))


class Camera:
    def __init__(self, config):
        self.config = config
        self.reset()

    def reset(self):
        c = self.config
        self.target = np.array(c["target"], dtype=float)
        self.yaw, self.pitch, self.distance = c["yaw"], c["pitch"], c["distance"]

    @property
    def eye(self):
        cp = math.cos(self.pitch)
        return self.target + self.distance * np.array([
            cp * math.sin(self.yaw), math.sin(self.pitch), cp * math.cos(self.yaw),
        ])

    def orbit(self, dx, dy):
        speed = self.config["rotateSpeed"]
        self.yaw -= dx * speed
        self.pitch = clamp(self.pitch + dy * speed, self.config["pitchRange"])

    def zoom(self, steps):
        self.distance = clamp(self.distance * math.exp(-steps * self.config["zoomFactor"]),
                              self.config["distanceRange"])

    def pan(self, right, forward, dt):
        length = math.hypot(right, forward)
        if not length:
            return
        speed = self.config["panSpeed"] * dt / length
        c, s = math.cos(self.yaw), math.sin(self.yaw)
        self.target[0] = clamp(self.target[0] + (right*c - forward*s)*speed,
                               self.config["targetXRange"])
        self.target[2] = clamp(self.target[2] + (-right*s - forward*c)*speed,
                               self.config["targetZRange"])

    def view_projection(self, width, height):
        c = self.config
        return perspective(c["fov"], width / max(1, height), c["near"], c["far"]) @ look_at(self.eye, self.target)

"""Curvas de animación evaluadas con tiempo acumulado en segundos."""

import math

import numpy as np

from transforms import model


class AnimatedGroups:
    def __init__(self, groups, config):
        self.groups = groups
        self.config = config
        self.base = {
            name: model(g["position"], g.get("rotation", (0, 0, 0)), g.get("scale", (1, 1, 1)))
            for name, g in groups.items()
        }

    def frame(self, game):
        matrices = {"": np.eye(4, dtype=np.float32)}
        t, c = game.water_time, self.config
        for name, group in self.groups.items():
            kind = group["type"]
            if kind == "treasure" and name not in game.found:
                matrices[name] = self.base[name]
                continue
            phase = group.get("phase", 0)
            p = list(group["position"])
            r = list(group.get("rotation", (0, 0, 0)))
            s = np.array(group.get("scale", (1, 1, 1)), dtype=float)
            if kind == "fish":
                a = phase + t * c["fishSpeed"]
                p[0] += c["fishX"] * math.sin(a)
                p[1] += c["fishY"] * math.sin(2 * a)
                p[2] += c["fishZ"] * math.cos(a)
                r[1] += math.atan2(c["fishZ"] * math.sin(a), c["fishX"] * math.cos(a))
            elif kind == "bubble":
                height = c["bubbleHeight"]
                progress = ((phase + t * c["bubbleSpeed"]) % height) / height
                p[1] += progress * height
                s *= 1 + c["bubbleGrowth"] * progress
            elif kind == "plant":
                r[2] += c["plantAngle"] * math.sin(phase + t * c["plantSpeed"])
            elif kind == "treasure":
                u = (game.time - game.found[name]) / c["discoverySeconds"]
                if u >= 1:
                    continue
                r[1] += math.tau * u
                s *= 1 + .35 * math.sin(math.pi * u)
            matrices[name] = model(p, r, s)
        return matrices

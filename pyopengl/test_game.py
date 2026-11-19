"""Ejecutar desde la raíz con python -m unittest discover -s pyopengl."""

import unittest

import numpy as np

from animation import AnimatedGroups
from camera import Camera
from game import Game
from interaction import Pointer
from scene import read_json


class ExpeditionTests(unittest.TestCase):
    def setUp(self):
        self.settings = read_json("settings.json")
        self.game = Game(self.settings)

    def test_discovery_pause_and_reset(self):
        game = self.game
        self.assertFalse(game.discover(None))
        for key in game.names:
            self.assertTrue(game.discover(key))
            self.assertFalse(game.discover(key))
        self.assertTrue(game.won)
        self.assertFalse(game.show_victory)
        game.paused = True
        game.advance(1.2)
        self.assertEqual(game.water_time, 0)
        self.assertTrue(game.show_victory)
        game.reset()
        self.assertFalse(game.won)
        self.assertFalse(game.paused)
        self.assertEqual(game.fps.frames, 0)

    def test_animation_delta_and_pause(self):
        defaults = {"position": [0, 1, 0], "phase": .5}
        animated = AnimatedGroups({g: {**defaults, "type": g} for g in ["fish", "bubble", "plant"]},
                                  self.settings["animation"])
        start = animated.frame(self.game)
        for _ in range(10):
            self.game.advance(.1)
        end = animated.frame(self.game)
        other = Game(self.settings)
        other.advance(1)
        for key in ["fish", "bubble", "plant"]:
            self.assertFalse(np.allclose(start[key], end[key]))
            np.testing.assert_allclose(end[key], animated.frame(other)[key])
        self.game.paused = True
        self.game.advance(.25)
        for key in end:
            np.testing.assert_allclose(end[key], animated.frame(self.game)[key])

    def test_projection_limits_and_drag(self):
        camera = Camera(self.settings["camera"])
        pointer = Pointer()
        pointer.press((10, 10), True)
        pointer.motion((12, 10), camera)
        self.assertTrue(pointer.release((12, 10)))
        pointer.press((10, 10), True)
        pointer.motion((48, 32), camera)
        self.assertFalse(pointer.release((48, 32)))
        self.assertNotEqual(camera.yaw, self.settings["camera"]["yaw"])
        for sign in [-1, 1]:
            camera.orbit(10, sign * 2000)
            camera.zoom(sign * 100)
            camera.pan(sign, sign, 100)
            config = self.settings["camera"]
            for value, bounds in [(camera.pitch, "pitchRange"), (camera.distance, "distanceRange"),
                                  (camera.target[0], "targetXRange"), (camera.target[2], "targetZRange")]:
                self.assertTrue(config[bounds][0] <= value <= config[bounds][1])
            self.assertGreater(camera.eye[1], 0)
            projected = camera.view_projection(1280, 720) @ np.append(camera.target, 1.)
            np.testing.assert_allclose(projected[:2], 0, atol=1e-5)

    def test_fps_uses_total_frames_over_time(self):
        for dt in [.01, .02, .02, .05]:
            self.game.advance(dt)
        self.assertAlmostEqual(self.game.fps.average, 40.)


if __name__ == "__main__":
    unittest.main()

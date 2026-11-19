"""Matrices 4×4 con vectores columna y el orden Euler XYZ de Three.js."""

import math

import numpy as np


def model(position=(0, 0, 0), rotation=(0, 0, 0), scale=(1, 1, 1)):
    a, b, c = rotation
    sx, sy, sz = np.sin([a, b, c])
    cx, cy, cz = np.cos([a, b, c])
    matrix = np.eye(4, dtype=np.float32)
    matrix[:3, :3] = np.array([
        [cy * cz, -cy * sz, sy],
        [sx * sy * cz + cx * sz, cx * cz - sx * sy * sz, -sx * cy],
        [sx * sz - cx * sy * cz, cx * sy * sz + sx * cz, cx * cy],
    ]) * scale
    matrix[:3, 3] = position
    return matrix


def perspective(fov, aspect, near=0.1, far=140.0):
    f = 1 / math.tan(math.radians(fov) / 2)
    return np.array([
        [f / aspect, 0, 0, 0], [0, f, 0, 0],
        [0, 0, (far + near) / (near - far), 2 * far * near / (near - far)],
        [0, 0, -1, 0],
    ], dtype=np.float32)


def look_at(eye, target):
    backward = eye - target
    backward /= np.linalg.norm(backward)
    right = np.cross([0, 1, 0], backward)
    right /= np.linalg.norm(right)
    up = np.cross(backward, right)
    basis = np.array([right, up, backward])
    matrix = np.eye(4, dtype=np.float32)
    matrix[:3, :3] = basis
    matrix[:3, 3] = -basis @ eye
    return matrix

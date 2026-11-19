"""Renderiza las fichas del cuaderno con las mismas mallas de la escena (opcional).

Uso desde la raíz: python assets/miniaturas.py. Requiere Pillow y NumPy.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "miniaturas"


def rotation(x, y, z):
    sx, sy, sz = np.sin([x, y, z])
    cx, cy, cz = np.cos([x, y, z])
    return (np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
            @ np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
            @ np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]))


def thumbnail(reef, treasure, angles):
    camera = rotation(*angles)
    faces = []
    light = np.array([-.45, .7, .72])
    light /= np.linalg.norm(light)
    for node in reef["nodes"]:
        if node.get("group") != treasure:
            continue
        mesh = reef["meshes"][node["mesh"]]
        local = rotation(*node.get("rotation", (0, 0, 0)))
        points = np.array(mesh["positions"]).reshape(-1, 3) * node.get("scale", (1, 1, 1))
        points = (points @ local.T + node["position"]) @ camera.T
        rgb = bytes.fromhex(reef["materials"][node["material"]]["color"][1:])
        for indices in np.array(mesh["indices"]).reshape(-1, 3):
            tri = points[indices]
            normal = np.cross(tri[1] - tri[0], tri[2] - tri[0])
            if normal[2] <= 1e-10:
                continue
            normal /= np.linalg.norm(normal)
            diffuse = max(0, np.dot(normal, light))
            shade = .57 + .51 * diffuse
            gloss = 38 * max(0, np.dot(normal, [-.18, .38, .91])) ** 12
            color = tuple(int(min(255, v * shade + gloss)) for v in rgb)
            faces.append((tri[:, 2].mean(), tri[:, :2], color))
    coordinates = np.concatenate([face[1] for face in faces])
    low, high = coordinates.min(axis=0), coordinates.max(axis=0)
    center = (high + low) / 2
    canvas = Image.new("RGBA", (384, 384))
    draw = ImageDraw.Draw(canvas)
    for _, points, color in sorted(faces, key=lambda f: f[0]):
        pixels = (points - center) / max(high-low) * [332, -332] + 192
        draw.polygon([tuple(p) for p in pixels.tolist()], fill=color)
    canvas.resize((120, 120), Image.Resampling.LANCZOS).save(OUTPUT / f"{treasure}.png")


if __name__ == "__main__":
    reef = json.loads((ROOT / "shared" / "reef.json").read_text(encoding="utf-8"))
    OUTPUT.mkdir(exist_ok=True)
    for treasure, view in {"compass": (.19, -.26, -.20), "key": (.18, -.36, -.12),
                           "chest": (.33, -.47, -.03), "pearl": (.33, -.13, -.03),
                           "coin": (.20, -.43, .23)}.items():
        thumbnail(reef, treasure, view)

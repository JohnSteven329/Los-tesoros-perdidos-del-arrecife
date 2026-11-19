"""Carga y agrupa geometría estática para evitar una llamada GL por cada rama."""

from collections import defaultdict
from dataclasses import dataclass
import json
from pathlib import Path

import numpy as np

from transforms import model


ROOT = Path(__file__).resolve().parents[1]


def read_json(name):
    with (ROOT / "shared" / name).open(encoding="utf-8-sig") as handle:
        return json.load(handle)


def linear(color):
    """Convierte los colores del catálogo (sRGB) a intensidad lineal de luz."""
    rgb = np.array([int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    return np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)


@dataclass
class Batch:
    group: str
    transparent: bool
    solid: bool
    first: int
    count: int
    center: np.ndarray


def pack_scene(data):
    """Cada lote comparte transformación animada, transparencia y oclusión."""
    buckets = defaultdict(list)
    vertices = []
    vertex_start = 0
    for node in data["nodes"]:
        mesh = data["meshes"][node["mesh"]]
        material = data["materials"][node["material"]]
        indices = np.asarray(mesh["indices"], dtype=np.uint32)
        positions = np.array(mesh["positions"]).reshape(-1, 3)
        normals = np.array(mesh["normals"]).reshape(-1, 3)
        local = model(node.get("position", (0, 0, 0)), node.get("rotation", (0, 0, 0)),
                      node.get("scale", (1, 1, 1)))
        positions = positions @ local[:3, :3].T + local[:3, 3]
        normals = normals @ np.linalg.inv(local[:3, :3])
        normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-10)
        count = len(positions)
        colors = np.array(mesh["colors"]).reshape(-1, 3) if "colors" in mesh else np.ones((count, 3))
        uv = np.array(mesh["uvs"]).reshape(-1, 2) if "uvs" in mesh else np.zeros((count, 2))
        alpha = material.get("opacity", 1)
        params = [material.get("roughness", 0.8), material.get("metalness", 0), alpha,
                  float(material.get("texture") == "sand")]
        emissive = linear(material.get("emissive", "#000000"))
        vertices.append(np.column_stack((
            positions, normals, colors * linear(material["color"]), uv,
            np.broadcast_to(params, (count, 4)), np.broadcast_to(emissive, (count, 3)),
        )).astype(np.float32))
        key = (node.get("group", ""), alpha < 1, node.get("solid", True))
        buckets[key].append((indices + vertex_start, positions.mean(axis=0)))
        vertex_start += count

    batches, all_indices = [], []
    index_start = 0
    for (group, transparent, solid), entries in buckets.items():
        indices = np.concatenate([entry[0] for entry in entries])
        center = np.mean([entry[1] for entry in entries], axis=0)
        batches.append(Batch(group, transparent, solid, index_start, len(indices), center))
        all_indices.append(indices)
        index_start += len(indices)
    return np.concatenate(vertices), np.concatenate(all_indices), batches

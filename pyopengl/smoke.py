"""Prueba integrada con el búfer de profundidad y las mallas de la partida."""

import math

import numpy as np


def verify(pygame, gl, camera, game, groups, renderer, hud, capture):
    size, view = hud.size, hud.view
    viewport = (view.x, size[1] - view.bottom, view.width, view.height)

    def pixels(rect):
        raw = gl.glReadPixels(*rect, gl.GL_RGBA, gl.GL_UNSIGNED_BYTE)
        return np.frombuffer(raw, dtype=np.uint8).reshape(rect[3], rect[2], 4)

    def mask(only_treasures=False):
        renderer.draw(view, size[1], camera, groups.frame(game), game,
                      picking=True, treasures_only=only_treasures)
        return pixels(viewport)[:, :, 0]

    print("OpenGL", gl.glGetString(gl.GL_VERSION).decode(), "·", gl.glGetString(gl.GL_RENDERER).decode())
    renderer.draw(view, size[1], camera, groups.frame(game), game)
    day = pixels(viewport)
    if day[:, :, :3].std(axis=(0, 1)).max() < 5:
        raise RuntimeError("El primer fotograma carece de variación de color.")
    renderer.overlay(hud.render(game), size)
    if capture:
        frame = pixels((0, 0, *size))
        image = pygame.image.frombytes(frame[::-1].tobytes(), size, "RGBA")
        pygame.image.save(image, capture)
    game.light = 1
    renderer.draw(view, size[1], camera, groups.frame(game), game)
    if np.array_equal(day, pixels(viewport)):
        raise RuntimeError("El cambio de iluminación no modifica la imagen.")
    game.light = 0
    game.advance(.5)
    renderer.draw(view, size[1], camera, groups.frame(game), game)
    animated = pixels(viewport)
    if np.array_equal(day, animated):
        raise RuntimeError("La imagen no cambia con el paso del tiempo.")
    game.paused = True
    game.advance(.5)
    renderer.draw(view, size[1], camera, groups.frame(game), game)
    if not np.array_equal(animated, pixels(viewport)):
        raise RuntimeError("La imagen de la escena varía al pausar las animaciones.")
    game.reset()

    # Busca píxeles visibles desde cámaras permitidas y vuelve a seleccionarlos
    # por la misma vía que utiliza un clic del usuario.
    found_opaque_cover = False
    for yaw in (0, .6, -.6, 1.25, -1.25, math.pi, 2, -2):
        for pitch in (.19, .48, .92):
            camera.yaw, camera.pitch = yaw, pitch
            visible = mask()
            if not found_opaque_cover:
                bare = mask(True)
                covered = np.argwhere((bare > 0) & (visible == 0))
                if covered.size:
                    row, col = covered[len(covered)//2]
                    pt = (view.x + int(col), view.bottom - 1 - int(row))
                    if renderer.select(pt, view, size[1], camera, groups.frame(game), game) is not None:
                        raise RuntimeError("Un tesoro se seleccionó a través de un sólido.")
                    found_opaque_cover = True
            for key, code in renderer.treasure_ids.items():
                if key in game.found:
                    continue
                exposed = np.argwhere(visible == code)
                if not exposed.size:
                    continue
                row, col = exposed[len(exposed)//2]
                pt = (view.x + int(col), view.bottom - 1 - int(row))
                hit = renderer.select(pt, view, size[1], camera, groups.frame(game), game)
                if hit != key or not game.discover(hit) or game.discover(hit):
                    raise RuntimeError(f"Error de selección o registro para {key}.")
            if game.won and found_opaque_cover:
                break
        if game.won and found_opaque_cover:
            break
    if not game.won:
        raise RuntimeError(f"Tesoros sin seleccionar en el recorrido: {set(game.names) - set(game.found)}")
    if not found_opaque_cover:
        raise RuntimeError("Ninguna cámara de prueba permitió comprobar una oclusión.")
    game.advance(1.0)
    if not game.show_victory or set(game.names) & groups.frame(game).keys():
        raise RuntimeError("Falló la transición a victoria.")
    renderer.draw(view, size[1], camera, groups.frame(game), game)
    renderer.overlay(hud.render(game), size)
    game.reset()
    camera.reset()
    if game.found or not set(game.names).issubset(groups.frame(game)):
        raise RuntimeError("El reinicio no recuperó todos los tesoros.")
    if gl.glGetError() != gl.GL_NO_ERROR:
        raise RuntimeError("OpenGL devolvió un error al terminar.")
    print(f"Verificados {view.width}×{view.height} píxeles, dos luces, movimiento, pausa, 5/5 selecciones, "
          "oclusión, rechazo de duplicados, victoria y reinicio.")

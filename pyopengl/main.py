"""Entrada de escritorio. Desde la raíz, ejecutar python pyopengl/main.py."""

import argparse
import math
import os
import sys
import time

os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")


def import_runtime():
    try:
        import pygame
        from OpenGL import GL
        from animation import AnimatedGroups
        from camera import Camera
        from game import Game
        from hud import Hud
        from interaction import Pointer
        from renderer import Renderer
        from scene import read_json
    except ImportError as error:
        raise RuntimeError(f"Falta una dependencia ({error}). Instala pyopengl/requirements.txt en tu entorno virtual.") from error
    return pygame, GL, AnimatedGroups, Camera, Game, Hud, Pointer, Renderer, read_json


def run(args):
    pygame, gl, AnimatedGroups, Camera, Game, Hud, Pointer, Renderer, read_json = import_runtime()
    pygame.display.init()
    pygame.font.init()
    try:
        pygame.display.gl_set_attribute(pygame.GL_CONTEXT_MAJOR_VERSION, 3)
        pygame.display.gl_set_attribute(pygame.GL_CONTEXT_MINOR_VERSION, 3)
        pygame.display.gl_set_attribute(pygame.GL_CONTEXT_PROFILE_MASK, pygame.GL_CONTEXT_PROFILE_CORE)
        pygame.display.gl_set_attribute(pygame.GL_DEPTH_SIZE, 24)
        flags = pygame.DOUBLEBUF | pygame.OPENGL | pygame.RESIZABLE
        if args.smoke or args.benchmark:
            flags |= pygame.HIDDEN
        pygame.display.gl_set_attribute(pygame.GL_MULTISAMPLEBUFFERS, 1)
        pygame.display.gl_set_attribute(pygame.GL_MULTISAMPLESAMPLES, 4)
        try:
            pygame.display.set_mode((args.width, args.height), flags, vsync=1)
        except pygame.error:
            pygame.display.gl_set_attribute(pygame.GL_MULTISAMPLEBUFFERS, 0)
            pygame.display.gl_set_attribute(pygame.GL_MULTISAMPLESAMPLES, 0)
            try:
                pygame.display.set_mode((args.width, args.height), flags, vsync=1)
            except pygame.error as error:
                raise RuntimeError(f"No se pudo crear una ventana OpenGL 3.3. Revisa el controlador gráfico. SDL: {error}") from error
        settings = read_json("settings.json")
        data = read_json("reef.json")
        pygame.display.set_caption(settings["title"] + "  |  Mar Abierto")
        camera, game = Camera(settings["camera"]), Game(settings)
        groups = AnimatedGroups(data["groups"], settings["animation"])
        renderer, hud, pointer = Renderer(data, settings), Hud(), Pointer()
        hud.layout(pygame.display.get_window_size())
        if args.smoke:
            from smoke import verify
            verify(pygame, gl, camera, game, groups, renderer, hud, args.capture)
            return

        def act(action):
            if action == "reset":
                game.reset()
                camera.reset()
                pointer.cancel()
                hud.last_state = None
            elif action == "pause":
                game.paused = not game.paused
            elif action == "light":
                game.light = (game.light + 1) % len(settings["lights"])

        keys_to_action = {pygame.K_r: "reset", pygame.K_p: "pause", pygame.K_l: "light"}
        previous = time.perf_counter()
        warmup_start = previous
        sample_start = None
        measured_frames = 0
        clock = pygame.time.Clock()
        running = True
        while running:
            now = time.perf_counter()
            elapsed = now - previous
            previous = now
            game.advance(elapsed)
            size = pygame.display.get_window_size()
            if size != hud.size:
                hud.layout(size)
            for event in pygame.event.get():
                if event.type == pygame.QUIT or (event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE):
                    running = False
                elif args.benchmark:
                    continue
                elif event.type == pygame.WINDOWFOCUSLOST:
                    pointer.cancel()
                elif event.type == pygame.KEYDOWN:
                    act(keys_to_action.get(event.key))
                elif event.type == pygame.MOUSEWHEEL and hud.view.collidepoint(pygame.mouse.get_pos()):
                    camera.zoom(event.y)
                elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                    pointer.press(event.pos, hud.view.collidepoint(event.pos))
                elif event.type == pygame.MOUSEMOTION:
                    pointer.motion(event.pos, camera)
                elif event.type == pygame.MOUSEBUTTONUP and event.button == 1 and pointer.release(event.pos):
                    action = next((key for key, rect in hud.buttons.items() if rect.collidepoint(event.pos)), None)
                    if action:
                        act(action)
                    elif not game.show_victory and hud.view.collidepoint(event.pos):
                        hit = renderer.select(event.pos, hud.view, size[1], camera, groups.frame(game), game)
                        game.discover(hit)
            if not args.benchmark:
                keys = pygame.key.get_pressed()
                camera.pan(keys[pygame.K_d] - keys[pygame.K_a], keys[pygame.K_w] - keys[pygame.K_s], elapsed)
            renderer.draw(hud.view, size[1], camera, groups.frame(game), game)
            renderer.overlay(hud.render(game), size)
            pygame.display.flip()
            # Igual que requestAnimationFrame, se solicita sincronización vertical.
            # El límite evita consumo innecesario cuando el controlador ignora vsync.
            clock.tick(144)
            if args.benchmark:
                end_frame = time.perf_counter()
                if sample_start is None and end_frame - warmup_start >= 5:
                    gl.glFinish()
                    game.fps.reset()
                    sample_start = previous = time.perf_counter()
                elif sample_start is not None:
                    measured_frames += 1
                    if end_frame - sample_start >= args.benchmark:
                        gl.glFinish()
                        duration = time.perf_counter() - sample_start
                        print(f"Ventana oculta, visor {hud.view.width}x{hud.view.height}, "
                              f"vsync solicitado, límite 144 FPS, precalentamiento 5 s. "
                              f"{measured_frames} cuadros / {duration:.3f} s = "
                              f"{measured_frames/duration:.2f} FPS de media.")
                        running = False
    finally:
        pygame.quit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Explora Los Tesoros Perdidos del Arrecife.")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--smoke", action="store_true", help="Comprueba dibujo, selección y victoria en una ventana oculta.")
    modes.add_argument("--benchmark", type=float, metavar="SEGUNDOS",
                       help="Mide el bucle normal en una ventana oculta, tras 5 s de precalentamiento.")
    parser.add_argument("--capture", metavar="PNG", help="Guarda el primer fotograma durante --smoke.")
    parser.add_argument("--width", type=int, default=1280, help="Ancho de ventana en píxeles (mínimo 640).")
    parser.add_argument("--height", type=int, default=760, help="Alto de ventana en píxeles (mínimo 420).")
    options = parser.parse_args()
    if options.width < 640 or options.height < 420 or (options.capture and not options.smoke):
        parser.error("Usa un tamaño mínimo de 640×420 y --capture únicamente con --smoke.")
    if options.benchmark is not None and (not math.isfinite(options.benchmark) or options.benchmark <= 0):
        parser.error("--benchmark requiere una duración positiva y finita en segundos.")
    try:
        run(options)
    except (RuntimeError, OSError, ValueError, KeyError) as error:
        sys.exit(f"Error al iniciar o verificar el arrecife: {error}")

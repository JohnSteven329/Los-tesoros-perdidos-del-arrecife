"""Cuaderno de campo dibujado por Pygame y compuesto como una textura RGBA."""

import pygame

from scene import ROOT


INK = (12, 29, 34)
PANEL = (18, 39, 44)
MINT = (156, 234, 210)
WHITE = (238, 244, 230)
MUTED = (173, 194, 188)
BRASS = (233, 194, 121)
EDGE = (56, 81, 82)


class Hud:
    def __init__(self):
        self.fonts = {}
        self.pictures = {}
        for name in ("compass", "key", "chest", "pearl", "coin"):
            picture = pygame.image.load(str(ROOT / "assets" / "miniaturas" / f"{name}.png"))
            for size in (29, 37):
                self.pictures[name, size] = pygame.transform.smoothscale(picture, (size, size))
        self.last_state = None
        self.buttons = {}

    def layout(self, size):
        w, h = size
        self.size = size
        self.compact = w < 830 or h < 560
        margin = 12 if self.compact else 24
        top = 57 if self.compact else 106
        side = min(272, max(206, round(w * .225)))
        if self.compact:
            self.view = pygame.Rect(margin, top, max(1, w - 2*margin), max(1, h - top - 100))
            self.panel = pygame.Rect(margin, self.view.bottom + 6, self.view.w, 78)
        else:
            self.view = pygame.Rect(margin, top, w - 3*margin - side, h - top - 60)
            self.panel = pygame.Rect(self.view.right + margin, top, side, self.view.height)
        self.buttons = {}
        self.last_state = None

    def font(self, size, style="sans"):
        key = (size, style)
        if key not in self.fonts:
            family = {"serif": "Georgia,DejaVu Serif", "mono": "Consolas,DejaVu Sans Mono"}.get(style, "Segoe UI,Arial")
            self.fonts[key] = pygame.font.SysFont(family, size, bold=(style == "bold"))
        return self.fonts[key]

    def label(self, text, x, y, size=15, color=WHITE, style="sans"):
        image = self.font(size, style).render(text, True, color)
        self.surface.blit(image, (int(x), int(y)))
        return image.get_height()

    def wrapped(self, text, x, y, width, size=16, color=WHITE, style="sans", leading=2):
        font = self.font(size, style)
        line = ""
        for word in text.split():
            proposed = f"{line} {word}".strip()
            if font.size(proposed)[0] > width and line:
                y += self.label(line, x, y, size, color, style) + leading
                line = word
            else:
                line = proposed
        return y + self.label(line, x, y, size, color, style)

    def picture(self, name, x, y, size):
        image = self.pictures[name, size]
        self.surface.blit(image, image.get_rect(center=(x, y)))

    def brand(self, x, y):
        pygame.draw.circle(self.surface, MINT, (x, y), 11, 1)
        pygame.draw.polygon(self.surface, MINT,
                            [(x+6, y-8), (x+1, y+2), (x-6, y+8), (x-1, y-2)], 2)

    def button(self, key, caption, rect):
        self.buttons[key] = rect
        pygame.draw.rect(self.surface, PANEL, rect, border_radius=5)
        pygame.draw.rect(self.surface, EDGE, rect, width=1, border_radius=5)
        image = self.font(14, "bold").render(caption, True, WHITE)
        self.surface.blit(image, image.get_rect(center=rect.center))

    def collection(self, game):
        r, surf = self.panel, self.surface
        pygame.draw.rect(surf, PANEL, r, border_radius=8)
        pygame.draw.rect(surf, EDGE, r, 1, border_radius=8)
        if self.compact:
            self.label("Cuaderno de campo", r.x + 12, r.y + 5, 16, WHITE, "bold")
            self.label(f"{len(game.found)} / 5", r.right - 68, r.y + 5, 16, MINT, "mono")
            width = r.w // len(game.names)
            for i, (key, name) in enumerate(game.names.items()):
                x = r.x + i * width + width // 2
                tone = MINT if key in game.found else BRASS
                self.picture(key, x, r.y + 40, 29)
                word = name.split()[0]
                self.label(word, x - self.font(13).size(word)[0]/2, r.y+55, 13, tone)
            return
        x, y = r.x + 17, r.y + 18
        self.label("Cuaderno de campo", x, y, 23, WHITE, "serif")
        y += 42
        self.label("Tesoros encontrados", x, y, 14, MUTED)
        self.label(f"{len(game.found)} / 5", r.right - 70, y - 2, 17, MINT, "mono")
        track = pygame.Rect(x, y+27, r.w-34, 4)
        pygame.draw.rect(surf, EDGE, track, border_radius=2)
        pygame.draw.rect(surf, MINT, (*track.topleft, round(track.w*len(game.found)/5), 4), border_radius=2)
        y += 49
        row = min(58, max(35, (r.height - 182) // 5))
        for key, name in game.names.items():
            cy = y + row // 2
            found = key in game.found
            self.picture(key, x+17, cy, 37)
            self.label(name, x+42, cy-11, 16, WHITE)
            pygame.draw.circle(surf, MINT if found else EDGE, (r.right-23, cy), 6, 0 if found else 1)
            if found:
                pygame.draw.lines(surf, INK, False, [(r.right-26,cy),(r.right-24,cy+2),(r.right-20,cy-2)], 2)
            pygame.draw.line(surf, EDGE, (x, y + row), (r.right-17, y + row))
            y += row
        if r.bottom - y > 100:
            y += 16
            self.label("Controles de inmersión", x, y, 17, WHITE, "bold")
            for keys, action in [("Arrastre", "Girar"), ("Rueda", "Acercar"), ("W A S D", "Desplazar"), ("Clic", "Recoger")]:
                y += 24
                if y+18 >= r.bottom - 9:
                    break
                self.label(keys, x, y, 14, MINT, "mono")
                self.label(action, x+95, y, 14, MUTED)

    def render(self, game):
        # La imagen permanece en GPU entre cambios de interfaz y muestras de FPS.
        msg = game.message if game.time < game.message_until else ""
        state = (self.size, tuple(game.found), game.light, game.paused, msg, game.show_victory,
                 int(game.fps.seconds * 2))
        if state == self.last_state:
            return None
        self.last_state = state
        w, h = self.size
        self.surface = pygame.Surface(self.size, pygame.SRCALPHA)
        self.surface.fill(INK)
        self.surface.fill((0, 0, 0, 0), self.view)
        self.buttons = {}
        mx = self.view.left
        self.brand(mx+12, 23)
        self.label("MAR ABIERTO", mx+34, 12, 17, WHITE, "bold")
        if not self.compact:
            pygame.draw.line(self.surface, EDGE, (mx, 49), (w-mx, 49))
            self.label("Los tesoros perdidos del arrecife", mx, 54, 32, WHITE, "serif")
        light = game.settings["lights"][game.light]["name"]
        fps = f"{game.fps.current:.0f} FPS  ·  Media {game.fps.average:.0f}" if game.fps.current else "— FPS  ·  Media —"
        tw = self.font(14, "mono").size(fps)[0]
        if w > 380:
            self.label(fps, w-mx-tw, 15, 14, MINT, "mono")
        if w > 700:
            self.label(light, w-mx-tw-105, 14, 15, BRASS)
        self.collection(game)
        if not self.compact:
            y = self.view.bottom + 11
            self.button("pause", "P  Reanudar" if game.paused else "P  Pausar", pygame.Rect(mx, y, 106, 30))
            self.button("light", "L  Cambiar luz", pygame.Rect(mx+115, y, 115, 30))
            self.button("reset", "R  Reiniciar", pygame.Rect(mx+239, y, 108, 30))
            self.label("Esc  Salir", w-mx-63, y+6, 14, MUTED)
        if game.paused:
            self.label("Animaciones en pausa", self.view.x+13, self.view.y+9, 16, WHITE, "bold")
        if msg and not game.show_victory and self.view.height > 108:
            box = self.view.inflate(-24, 0)
            box.width = min(506, box.w)
            small = box.w < 380
            box.height = 77 if small else 60
            box.bottom = self.view.bottom-12
            pygame.draw.rect(self.surface, (15,37,42,235), box, border_radius=5)
            pygame.draw.line(self.surface, MINT, (box.x+1,box.y+9), (box.x+1,box.bottom-9), 2)
            self.wrapped(msg, box.x+13, box.y+8, box.w-25, 14 if small else 15)
        if game.show_victory:
            box = pygame.Rect(0, 0, min(444, self.view.w-12), min(190,self.view.h))
            box.center = self.view.center
            pygame.draw.rect(self.surface, PANEL, box, border_radius=9)
            pygame.draw.rect(self.surface, MINT, box, 1, border_radius=9)
            self.label("Cuaderno completo",box.x+17, box.y+11, 25, MINT, "serif")
            self.wrapped(game.settings["victory"], box.x+18,box.y+52,box.w-36)
            self.button("reset", "Volver a explorar", pygame.Rect(box.x+18, box.bottom-46, 156, 32))
        return self.surface

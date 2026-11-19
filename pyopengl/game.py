"""Reglas de búsqueda y temporizadores independientes del renderizador."""


class FrameRate:
    def __init__(self):
        self.reset()

    def reset(self):
        self.frames = self.sample_frames = 0
        self.seconds = self.sample_seconds = self.current = 0.0

    def tick(self, elapsed):
        if elapsed <= 0:
            return
        self.frames += 1
        self.sample_frames += 1
        self.seconds += elapsed
        self.sample_seconds += elapsed
        if self.sample_seconds >= .5:
            self.current = self.sample_frames / self.sample_seconds
            self.sample_frames = self.sample_seconds = 0

    @property
    def average(self):
        return self.frames / self.seconds if self.seconds else 0


class Game:
    def __init__(self, settings):
        self.settings = settings
        self.names = {t["id"]: t["name"] for t in settings["treasures"]}
        self.reset()

    def reset(self):
        self.paused = False
        self.light = 0
        self.time = self.water_time = 0.0
        self.found = {}
        self.message = self.settings["welcome"]
        self.message_until = 7
        self.fps = FrameRate()

    def advance(self, dt):
        self.time += dt
        if not self.paused:
            self.water_time += dt
        self.fps.tick(dt)

    def discover(self, treasure):
        if treasure not in self.names or treasure in self.found:
            return False
        self.found[treasure] = self.time
        self.message = f"Has encontrado un tesoro · {self.names[treasure]}"
        self.message_until = self.time + 3
        return True

    @property
    def won(self):
        return len(self.found) == len(self.names)

    @property
    def show_victory(self):
        duration = self.settings["animation"]["discoverySeconds"]
        return self.won and self.time - max(self.found.values()) >= duration

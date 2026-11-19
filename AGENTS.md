# Reglas del proyecto

- Conserva las tecnologías de la asignatura. La versión nativa usa pygame, PyOpenGL y NumPy. La web usa JavaScript, Three.js y Vite.
- Mantén ambos motores alineados con `shared/settings.json` y `shared/reef.json`. Los cambios de geometría se hacen en los generadores de `shared/` y se entregan junto al JSON y a la textura regenerados.
- Mantén nombres, créditos y textos de interacción en español. Carga los recursos localmente y respeta los avisos de `threejs/public/licencias/`.
- Conserva la selección por el sólido visible más cercano, el registro único por ID, el tiempo delta y los límites de cámara. Comprueba la accesibilidad de las cinco piezas después de mover decoraciones.
- Instala dependencias dentro de `.venv/` y `threejs/node_modules/`. Excluye del repositorio los archivos de construcción y los entornos locales.

## Verificación desde la raíz

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s pyopengl -p "test_*.py"
.\.venv\Scripts\python.exe pyopengl/main.py --smoke
npm.cmd --prefix threejs test
npm.cmd --prefix threejs run build
```

Abre ambas versiones después de tocar cámara, iluminación o interfaz. Comprueba un clic bloqueado, los cinco hallazgos, la victoria, el reinicio y la pausa. Registra las condiciones y cifras observadas según `documentacion/comparativa.md`.

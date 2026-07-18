# Mi Horario — Ing. de Sistemas UPC 2026-2

App para armar el horario del semestre a partir de la oferta de materias
que entrega la plataforma de la universidad (Academusoft).

## Cómo usarla

Abre **index.html** con doble clic (no necesita servidor ni internet).

1. Busca una materia en el panel izquierdo y haz clic para ver sus grupos.
2. Haz clic en un grupo para agregarlo al horario (clic de nuevo para quitarlo).
3. Si un grupo choca con lo que ya elegiste, aparece marcado con **⚠ choca**
   antes de seleccionarlo; si lo seleccionas igual, los bloques en conflicto
   se muestran en rojo y sale una alerta arriba.
4. Tu selección se guarda sola en el navegador (localStorage).
5. Botón **Imprimir / PDF** para exportar el horario final.

## Actualizar los datos (nuevo semestre)

1. Reemplaza `MATERIAS.txt` con el nuevo archivo que descargas de la plataforma
   (la página "Consultar Horario por Programa", guardada como HTML).
2. Ejecuta:

   ```
   node js/parser.js
   ```

   Esto regenera `js/horarios.js` (datos que usa la app) y `horarios.json` (copia legible).

## Archivos

   | Archivo            | Qué es                                              |
   | ------------------ | --------------------------------------------------- |
   | `MATERIAS.txt`     | HTML crudo exportado de la plataforma               |
   | `js/parser.js`     | Extrae materias/grupos/horarios del HTML            |
   | `js/horarios.js`   | Datos parseados que carga la app                    |
   | `horarios.json`    | Los mismos datos, en JSON legible                   |
   | `index.html`       | La app del horario                                  |

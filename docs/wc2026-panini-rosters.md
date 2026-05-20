# Plantillas Panini FIFA WC 2026 (interim)

Fuente estática del álbum **2026 Panini FIFA World Cup** (~18 jugadores por selección, 48 equipos). No usa HTTP en el seed: solo JSON versionado en git + script Admin.

## Archivos

| Ruta | Rol |
|------|-----|
| [`data/wc2026/panini-checklist.txt`](../data/wc2026/panini-checklist.txt) | Checklist en texto (base stickers; primera sección del álbum) |
| [`src/data/wc2026/paniniRosters.json`](../src/data/wc2026/paniniRosters.json) | JSON generado (864 jugadores) |
| [`scripts/parse-panini-checklist.ts`](../scripts/parse-panini-checklist.ts) | Parser checklist → JSON |
| [`functions/src/panini/syncRosters.ts`](../functions/src/panini/syncRosters.ts) | Escritura Firestore |
| [`scripts/seed-panini-rosters.ts`](../scripts/seed-panini-rosters.ts) | CLI seed / dry-run |

## Regenerar JSON

```bash
npm run parse:panini-checklist
# opcional: npm run parse:panini-checklist -- --input=data/wc2026/panini-checklist.txt
```

Reglas del parser:

- Líneas `XXXn Nombre - País`; omite slot `1` (logo) y `13` (foto equipo).
- Alias de typos en checklist: `SWI` → `SUI`, `KAS` → `KSA`.
- Doc id en Firestore = `stickerCode` (ej. `KOR18`).

## Importar a Firestore

Requisitos: `npm run seed:teams` ya ejecutado; credenciales Admin (`gcloud auth application-default login`).

```bash
npm run build:functions
npm run check:panini-rosters              # dry-run 48 equipos
npm run check:panini-rosters -- --team=KOR
npm run seed:panini-rosters               # importa todo (reemplaza players/ por equipo)
npm run seed:panini-rosters -- --team=MEX
```

Destino: `teams/{ISO-3}/players/{stickerCode}` con `rosterSource: 'panini'` en el doc del equipo.

**Reemplazo:** cada seed Panini **borra** todos los docs en `players/` de ese equipo antes de escribir (evita mezclar IDs TSDB/API con `MEX2`).

## Límites

- Sin posición ni dorsal en el checklist básico (solo nombre).
- Sin imágenes de stickers en Firestore.
- La UI «jugador por partido» sigue desactivada (`playerPerMatchEnabled: false`) hasta fuente oficial.

## Migración futura

Cuando exista plantilla oficial: nuevo `rosterSource` y script de enlace por nombre normalizado + `teamId`, conservando `paniniStickerCode` en docs viejos para no romper `playerKey` en predicciones.

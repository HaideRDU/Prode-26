# Plantillas manuales FIFA WC 2026

Listado de jugadores por selección cargado desde el usuario (48 equipos, ~726 jugadores). Alimenta la UI **jugador por partido** en clasificación.

## Archivos

| Ruta | Rol |
|------|-----|
| [`src/data/wc2026/manualRostersSource.ts`](../src/data/wc2026/manualRostersSource.ts) | Nombres por `teamId` (fuente editable) |
| [`scripts/build-manual-rosters-json.ts`](../scripts/build-manual-rosters-json.ts) | Genera el JSON con `stickerCode` = `MEX01`, … |
| [`src/data/wc2026/manualRosters.json`](../src/data/wc2026/manualRosters.json) | JSON versionado (generado) |
| [`scripts/seed-manual-rosters.ts`](../scripts/seed-manual-rosters.ts) | Import a Firestore |
| [`functions/src/panini/syncRosters.ts`](../functions/src/panini/syncRosters.ts) | Escritura `teams/{id}/players/{stickerCode}` |

## Regenerar JSON tras editar nombres

```bash
npm run build:manual-rosters
```

## Importar a Firestore

Requisitos: `npm run seed:teams` ya ejecutado; credenciales Admin (`gcloud auth application-default login`).

```bash
npm run build:functions
npm run check:manual-rosters              # dry-run 48 equipos
npm run check:manual-rosters -- --team=MEX
npm run seed:manual-rosters               # importa todo (reemplaza players/ por equipo)
npm run seed:manual-rosters -- --team=ARG
```

Destino: `teams/{ISO-3}/players/{stickerCode}` con `rosterSource: 'manual'` en el doc del equipo.

**Reemplazo:** cada seed **borra** todos los docs en `players/` de ese equipo antes de escribir.

## Esquema por jugador

Igual que Panini / `TeamPlayerDoc`:

- `name` — nombre mostrado en el select
- `paniniStickerCode` — mismo valor que el id del documento (`MEX01`, …)
- `paniniSlot` — orden 1..N
- `syncedAt` — timestamp del seed

La predicción guarda `playerKey` = `paniniStickerCode` (ver `playerDocToKey` en `teamsService.ts`).

## Nota sobre grupos

Los grupos A–L del listado original **no tienen por qué coincidir** con [`teamsByGroup.ts`](../src/data/wc2026/teamsByGroup.ts) (calendario de la app). El mapeo es solo **nombre de país → `teamId` ISO-3**.

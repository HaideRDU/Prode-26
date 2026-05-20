# Configurar APISPORTS_KEY en Firebase

## Estado en este repo

- `.env` incluye `APISPORTS_KEY` (no commitear).
- Proyecto Firebase: `polla-mundialist` (`.firebaserc`).
- Script único: `npm run setup:apisports-firebase`

## Pasos (en tu máquina)

1. Inicia sesión en Firebase CLI (solo una vez):

   ```bash
   npx firebase login
   ```

2. Registra el secreto y despliega functions:

   ```bash
   npm run setup:apisports-firebase
   ```

   Opcional con token CI:

   ```bash
   export FIREBASE_TOKEN="$(npx firebase login:ci)"
   npm run setup:apisports-firebase
   ```

3. Tras el seed de partidos, enlaza fixtures con Firestore (requiere cuenta de servicio):

   ```bash
   # En .env:
   # GOOGLE_APPLICATION_CREDENTIALS=/ruta/serviceAccount.json
   npm run setup:apisports-firebase:link
   ```

## Plan API-Football

El sync de partidos usa `league=1`, `season=2026`. El **plan Free** de API-Sports suele devolver error de temporada; para producción necesitas un plan que incluya el Mundial 2026.

## Plantillas (6 selecciones, Free)

Importar jugadores a `teams/{ISO-3}/players/{apiSportsPlayerId}` sin usar temporada WC:

```bash
npm run check:apisports-rosters    # dry-run, ~12 llamadas (6× search + 6× squads)
npm run seed:apisports-rosters     # FRA, BRA, SUI, CIV, KOR, NZL
npm run seed:apisports-rosters -- --team=KOR
```

Requiere `APISPORTS_KEY` en `.env` y credenciales Firebase Admin (`gcloud auth application-default login` o `GOOGLE_APPLICATION_CREDENTIALS`).

**Rate limit Free:** el script espera ~3,5 s entre llamadas y reintenta 429. Una pasada completa (6 equipos) usa **12 llamadas** y tarda ~1 min. Si el último equipo (p. ej. NZL) falla por 429, espera 1 minuto y ejecuta `npm run seed:apisports-rosters -- --team=NZL`.

**Verificación (dry-run, may 2026):** FRA 35, BRA 46, SUI 33, CIV 28, KOR 32, NZL 40 jugadores.

## Functions desplegadas

- `syncMatchesFromApiSports` — cron cada 5 min (ventana 2026-06-10 … 2026-07-21 UTC)
- `linkMatchesApiSports` — callable autenticado

Ver también [`functions/DEV_NOTES.txt`](../functions/DEV_NOTES.txt).

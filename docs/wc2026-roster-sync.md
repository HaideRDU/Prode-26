# Seguimiento plantillas WC 2026 → Firestore

## Fuente interim (recomendada): Panini

Álbum **2026 Panini FIFA World Cup** — 48 selecciones × 18 jugadores, sin APIs en runtime.

| Estado | Significado |
|--------|-------------|
| `pendiente` | Aún no importado desde Panini |
| `importado_panini` | `npm run seed:panini-rosters -- --team=XXX` OK (`rosterSource: panini`) |

```bash
npm run parse:panini-checklist    # regenerar JSON desde checklist
npm run check:panini-rosters      # dry-run
npm run seed:panini-rosters       # Firestore (reemplaza players/ del equipo)
```

Detalle: [`wc2026-panini-rosters.md`](wc2026-panini-rosters.md).

---

## TheSportsDB (respaldo / futuro oficial)

Fuente: [TheSportsDB](https://www.thesportsdb.com/) V1 Free (clave `123`).

1. **Primario:** `lookup_all_players.php?id={idTeam}` — solo jugadores con esa selección como **equipo primario** en TSDB (máx. 10 en Free).
2. **Fallback:** si hay &lt; 5 jugadores tras filtrar, `eventsnext.php` + `eventslast.php` (1 partido cada uno) y `lookuplineup.php` por evento — jugadores del lado local/visitante que corresponde al `idTeam`.

Destino: `teams/{ISO-3}/players/{idPlayer}`.

### Web vs API (selecciones nacionales)

La galería de jugadores en [thesportsdb.com/team/…](https://www.thesportsdb.com/team/134517-south-korea?view=6) **no** usa el mismo criterio que `lookup_all_players`. Muchos futbolistas tienen el **club** como equipo primario; la selección aparece en la web pero no en V1 Free. V2 `list/players/{idTeam}` sí lista el plantel pero requiere **Premium**.

Con solo Free no se puede replicar la galería web en cualquier momento; sí importar cuando `lookup_all_players` basta o cuando TSDB publique **alineación** en API.

Estados Prode:

| Estado | Significado |
|--------|-------------|
| `pendiente` | Aún no importado a Firestore |
| `importado` | `npm run seed:tsdb-rosters -- --team=XXX` OK |
| `sin_datos_api` | Tras primary + fallback lineup: &lt; 5 jugadores o plantel no coincide |
| `lineup_parcial` | Solo alineaciones; re-ejecutar cuando publiquen más partidos/alineaciones |

Comando por selección (TheSportsDB):

```bash
npm run check:tsdb-rosters -- --team=KOR   # solo revisar
npm run seed:tsdb-rosters -- --team=KOR    # importar a Firestore
```

**API-Football (6 equipos con plan Free):** Francia, Brasil, Suiza, Costa de Marfil, Corea del Sur, Nueva Zelanda — ~12 llamadas por ejecución:

```bash
npm run check:apisports-rosters
npm run seed:apisports-rosters -- --team=KOR
```

Ver [`setup-apisports-key.md`](setup-apisports-key.md).

## Group A

| # | Selección | ISO-3 | TSDB Complete (hilo) | Prode |
|---|-----------|-------|----------------------|-------|
| 1.1 | Czech Republic | CZE | — | pendiente |
| 1.2 | Mexico | MEX | — | pendiente |
| 1.3 | South Africa | RSA | — | pendiente |
| 1.4 | South Korea | KOR | Complete* | importado_panini (18 jug.; ver Panini) |

#### South Korea (KOR) — idTeam `134517`

| Fuente | Resultado típico (may 2026) |
|--------|----------------------------|
| Web [team/134517](https://www.thesportsdb.com/team/134517-south-korea?view=6) | Muchos cutouts (Kim, Lee, …) |
| `lookup_all_players` | 1 registro: entrenador Hong (`Coaching`) → 0 tras filtro |
| `lookuplineup` (ej. amistoso vs T&T `2474206`, vs CIV `2438964`) | Solo cuando TSDB publica filas; a menudo **parcial** (&lt; 5 del lado KOR) |

```bash
npm run check:tsdb-rosters -- --team=KOR   # muestra primary= vs lineup=
npm run seed:tsdb-rosters -- --team=KOR    # importa si total ≥ 5
```

Reintentar tras alineación del amistoso **30 may 2026** (Provo) o partidos del Mundial.

## Group B

| # | Selección | ISO-3 | TSDB Complete | Prode |
|---|-----------|-------|---------------|-------|
| 2.1 | Bosnia and Herzegovina | BIH | Complete* | pendiente |
| 2.2 | Canada | CAN | — | pendiente |
| 2.3 | Qatar | QAT | — | pendiente |
| 2.4 | Switzerland | SUI | — | pendiente |

## Group C

| # | Selección | ISO-3 | TSDB Complete | Prode |
|---|-----------|-------|---------------|-------|
| 3.1 | Brazil | BRA | Complete | pendiente |
| 3.2 | Haiti | HAI | Complete* | pendiente |
| 3.3 | Morocco | MAR | — | pendiente |
| 3.4 | Scotland | SCO | Complete | pendiente |

## Group D

| # | Selección | ISO-3 | Prode |
|---|-----------|-------|-------|
| 4.1 | Australia | AUS | pendiente |
| 4.2 | Paraguay | PAR | pendiente |
| 4.3 | Turkey | TUR | pendiente |
| 4.4 | United States | USA | pendiente |

## Group E

| # | Selección | ISO-3 | TSDB Complete | Prode |
|---|-----------|-------|---------------|-------|
| 5.1 | Curaçao | CUW | Complete* | pendiente |
| 5.2 | Ecuador | ECU | — | pendiente |
| 5.3 | Germany | GER | — | pendiente |
| 5.4 | Ivory Coast | CIV | Complete* | pendiente |

## Group F

| # | Selección | ISO-3 | TSDB Complete | Prode |
|---|-----------|-------|---------------|-------|
| 6.1 | Japan | JPN | Complete* | pendiente |
| 6.2 | Netherlands | NED | — | pendiente |
| 6.3 | Sweden | SWE | Complete | pendiente |
| 6.4 | Tunisia | TUN | Complete* | pendiente |

## Group G

| # | Selección | ISO-3 | TSDB Complete | Prode |
|---|-----------|-------|---------------|-------|
| 7.1 | Belgium | BEL | Complete* | pendiente |
| 7.2 | Egypt | EGY | — | pendiente |
| 7.3 | Iran | IRN | — | pendiente |
| 7.4 | New Zealand | NZL | — | pendiente |

## Group H

| # | Selección | ISO-3 | TSDB Complete | Prode |
|---|-----------|-------|---------------|-------|
| 8.1 | Cape Verde | CPV | Complete | pendiente |
| 8.2 | Saudi Arabia | KSA | — | pendiente |
| 8.3 | Spain | ESP | — | pendiente |
| 8.4 | Uruguay | URU | — | pendiente |

## Group I

| # | Selección | ISO-3 | TSDB Complete | Prode |
|---|-----------|-------|---------------|-------|
| 9.1 | France | FRA | Complete | pendiente |
| 9.2 | Iraq | IRQ | — | pendiente |
| 9.3 | Norway | NOR | — | pendiente |
| 9.4 | Senegal | SEN | — | pendiente |

## Group J

| # | Selección | ISO-3 | TSDB Complete | Prode |
|---|-----------|-------|---------------|-------|
| 10.1 | Algeria | ALG | — | pendiente |
| 10.2 | Argentina | ARG | — | pendiente |
| 10.3 | Austria | AUT | Complete | pendiente |
| 10.4 | Jordan | JOR | — | pendiente |

## Group K

| # | Selección | ISO-3 | TSDB Complete | Prode |
|---|-----------|-------|---------------|-------|
| 11.1 | Colombia | COL | — | pendiente |
| 11.2 | DR Congo | COD | Complete | pendiente |
| 11.3 | Portugal | POR | Complete | pendiente |
| 11.4 | Uzbekistan | UZB | — | pendiente |

## Group L

| # | Selección | ISO-3 | TSDB Complete | Prode |
|---|-----------|-------|---------------|-------|
| 12.1 | Croatia | CRO | Complete | pendiente |
| 12.2 | England | ENG | — | pendiente |
| 12.3 | Ghana | GHA | — | pendiente |
| 12.4 | Panama | PAN | — | pendiente |

---

*Complete / Complete* = marcado en el hilo de TheSportsDB (artwork/datos en su foro).

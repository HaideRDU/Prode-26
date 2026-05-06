# Aclaraciones operativas WC2026 (implementación actual)

Este documento fija supuestos de implementación para casos no 100% explícitos en el PDF.

## 1) Fase de grupos (parciales)

| Caso | Puntos |
|---|---:|
| Marcador exacto (local y visita) | 5 |
| No exacto + acierta uno de los dos marcadores | 2 |
| No exacto + acierta ganador/empate | 1 |
| No exacto + acierta un marcador **y** ganador/empate | 3 (2+1) |

Regla de prioridad: si hay exacto, se otorgan solo 5.

## 2) Eliminatorias (90 minutos)

Marcador exacto por ronda:

- R32: 6
- R16: 7
- QF: 8
- SF: 10
- 3er puesto: 9
- Final: 12

Si no hay exacto:

- acierto de un marcador: +2
- acierto de ganador/empate (en 90'): +1

## 3) Avance y especiales

- Campeón: 22
- Subcampeón: 15
- Tercer puesto: 12
- Goleador: 18
- Arquero mejor promedio: 12
- Preguntas especiales del banco: 5 cada una

## 4) Dinámica \"Jugador por Partido\"

Queda desacoplada (feature flag apagado) hasta contar con fuente oficial de goleadores por partido
(90' + prórroga, excluyendo tandas de penales).

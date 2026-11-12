# GLT Process Basics

A one-page orientation to the simulated line, written for someone who has never stood next to a threshing line. All values used by the simulator are "plausible for a primary tobacco processing facility", not calibrated to a specific plant.

## The line

```
tipper trucks → [Intake & Blending] → [Conditioning] → [Threshing] → [Air Separation] → [Drying] → [Packing] → cases
                     (blend hopper)     (steam + water)    (cage & beater)   (air lift)     (hot air)     (200 kg cases)
```

**Intake & blending.** Leaf arrives in cases or tipper loads from several growers/lots. The blend hopper's job is decoupling and homogenisation: lots are layered so the line always sees a consistent mix. Key variables: hopper level (alarm at 90 %), feed rate (500–8000 kg/h, nominal 4000).

**Conditioning.** Threshing needs leaf at the right moisture — dry leaf shatters into dust, soaked leaf will not separate from stem. Steam and water raise moisture to the setpoint (nominal 19 %; alarm above 21.5 %). The inline moisture analyser closes this loop; a reference analyser and lab samples provide the truth when it drifts.

**Threshing.** A rotating cage and beater pair tear the leaf lamina (the valuable part) off the stem. Cage speed 600–1200 rpm (nominal 950). Motor load is the operator's window into mechanical health: wet leaf and overfeed both raise current; sustained load above 115 % trips the motor protection.

**Air separation.** The threshed mix falls through a rising air column. Tuned air velocity (nominal 20 m/s) lifts light lamina up to the next stage while heavy stem drops out. Too slow ⇒ stem contaminates the lamina; too fast ⇒ good lamina is lost with the stem. The trade-off is measured as "stem in lamina" (spec ≤ 4 %).

**Drying.** Lamina passes a hot-air dryer that removes what conditioning added plus a margin. Temperature setpoint 60–110 °C (nominal 85 °C). High alarm 100 °C, critical 115 °C, fire risk 130 °C — a dryer that will not stop heating is an **emergency**, not a tuning problem. Correctly run, the dryer lands packed moisture in the **11.5–13.5 %** window.

**Packing.** Lamina fills 200 kg cases. Everything upstream is judged here: moisture out of spec, stem above 4 %, or NTRM above 1500 ppm marks the packed kilograms as out-of-spec (quality hold in a real plant; scored deductions here).

## NTRM

**Non-Tobacco Related Materials** — string, plastic, metal, feathers, anything that arrived with the leaf. A contaminated lot spikes the NTRM trend; the response is procedural: stop the feed, send the sorting crew into the intake area (never while it is running), segregate the bad pallets, resume only once the trend is back under the limit. Cases packed during an excursion go on quality hold.

## Safety systems in the simulator

- **Guard interlock.** Opening any guard while the line runs stops it immediately — and opening it in the first place is a scored violation. Guards are for scheduled access, not operating adjustments.
- **Emergency stop.** Latching, twist-to-reset, hotkey `E`. For danger and escalating emergencies (a runaway dryer), not for routine stops — an e-stop leaves wet leaf sitting in a hot dryer, which has its own quality cost.
- **LOTO (Lockout-Tagout).** The only legal path to body-in-equipment work: **isolate all energy → apply personal lock and tag → verify zero energy** (try-start at the local panel, confirm steam bled, air vented) → work → remove locks. Clearing a jam, repairing the steam valve or the dryer heater in this simulator requires the `VERIFIED` state; anything less is a critical violation and an automatic fail.

## Alarm priorities

| Priority | Meaning | Examples |
| --- | --- | --- |
| CRITICAL | Danger to people/plant; act now | Dryer over-temp, guard open, e-stop latched |
| HIGH | Process integrity at risk | Feed jam, over-moisture, NTRM, motor overload |
| MEDIUM | Quality/degradation trending | Hopper high, low moisture, airflow deviation, sensor self-check |

Acknowledging an alarm is how an operator says "I own this event" — critical alarms left unacknowledged for 60 s are scored as safety deductions.

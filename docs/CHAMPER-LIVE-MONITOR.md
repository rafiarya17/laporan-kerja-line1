# Monitor Live Champer — Line 99 pilot

The leader workspace links to `/monitor-live.html`. The existing tablet pairing protects the read endpoint. Device authentication and the configured source/collector identities protect ingestion. Only AUTO_CHAMPER / DXP|Device1|D100 is accepted. No machine controls are exposed.

## Data flow

PLC → existing Takebishi DDE → collector Auto Read D100 → local journal/API → outbound cloud bridge → separate Redis latest-value key → authenticated leader browser.

The cloud bridge checks the journal every five seconds. Changed observations are forwarded at the next check; unchanged state is heartbeated every fifteen seconds. The visible browser refreshes every five seconds. This does not require an operator job or issue a Start/End request. The collector must have D100 connected **and Auto Read enabled** for ongoing observations. Opening the dashboard alone does not initiate PLC reads. Existing manual Start/End captures stay separate and unchanged.

The monitor displays the raw D100 value received by the PC, including values above 9999, as long as the integer can be represented exactly. Job boundaries and production totals retain their separate range checks.

## Truthfulness and delays

Local DDE receipt is not proof of a fresh PLC response: Takebishi may cache values and DDE may notify only changes. Observation time never advances merely because the uploader sends a heartbeat. A quiet counter is shown as historical after fifteen seconds without a new observation, not as proof that the machine disconnected. Bridge loss is shown separately after thirty seconds. Browser fetch failure marks retained values historical.

The separate bounded Redis key stores one latest envelope. An atomic timestamp comparison rejects out-of-order uploads; repeated events preserve their first cloud receipt time. New telemetry cannot create jobs, counter boundaries or reports. Redis credentials remain server-side. Local files/config secrets are not committed.

The screen measures DDE observation at PC → cloud receipt and approximate PC → browser visibility. The browser uses cloud time plus measured round-trip time, so the display figure is conservative and subject to clock synchronisation/network latency. First loaded historical data, negative times and observations older than thirty seconds are excluded. Export contains up to sixty observed events, not every sensor pulse. Sensor → PC delay remains unmeasured without a PLC timestamp or manual synchronised observation.

Nominal scheduling adds up to roughly ten seconds (uploader five + browser five), plus local journal, PLC/DDE, network and cloud processing. This is a design budget, not a field-test result. Unchanged heartbeat uses about 5,760 writes/day if running continuously; one visible browser at five-second refresh uses about 17,280 reads/day, before changed events and existing Start/End traffic. Monitor Upstash usage; no paid plan is automatically enabled.

## Field trial, one step at a time

1. Start the existing Andon API/collector and Takebishi as usual; keep original VB closed. Start the updated cloud bridge. Confirm READY.
2. Connect only D100 in the review collector, then enable **Auto Read D100** (button becomes Stop). Do not use Poke/All_Poke. This subscribes to reads; it does not control machine operation.
3. Open Monitor Live from leader, pair using the existing tablet code if requested. Keep the page visible. No Start/End job is required for this test.
4. Have the authorised operator operate the machine under the normal safe procedure. Observe several counter increments and the matching dashboard values. Do not alter/reset PLC memory for the test.
5. Download the delay evidence. Compare actual observed values, average/max PC-to-screen delay and any historical warnings. Sensor-to-screen timing requires the operator to record the physical trigger time separately.
6. Test a normal Start/End job while Auto Read remains enabled; verify boundaries, quality and leader/TF Slip flow. Telemetry must not replace the stored boundary readings.

Initial automated validation uses isolated data only. Actual counting and field latency must still be witnessed on the running machine.

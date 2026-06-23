# Marstek Homey App – Projektstatus

## Repository

de.ftedv.marstek

## Ziel

Homey-App für Marstek Energiespeicher mit MQTT-Anbindung.

## Unterstützte Geräte

Aktuell:

- B2500 Gerätefamilie
  - HMJ-2 (B2500)

Architektur vorbereitet für B2500-Varianten:

- HMA-1
- HMB-1
- HMF-1
- HMK-1

## MQTT

### State Topic

```
hame_energy/<MODEL>/device/<DEVICE_ID>/ctrl
```

Beispiel:

```
hame_energy/HMJ-2/device/18cedfd22770/ctrl
```

### Command Topic

```
hame_energy/<MODEL>/App/<DEVICE_ID>/ctrl
```

Beispiel:

```
hame_energy/HMJ-2/App/18cedfd22770/ctrl
```

## Pairing

Benutzer gibt ein:

- Hardware-Version (v1/v2)
- Device-ID
- Optional: PV-Erzeuger-Gerät anlegen, Default: aktiv

Die App:

1. erzeugt mögliche Topics
2. subscribed auf State Topics
3. sendet `cd=01`
4. wartet auf Antwort
5. erkennt daraus das tatsächliche Modell
6. legt immer den B2500 Batteriespeicher (`class: battery`) an
7. legt optional zusätzlich den B2500 PV Companion (`class: solarpanel`) an

### Custom Pairing View Erkenntnis

Die Pairing-View `drivers/b2500/pair/start.html` verwendet bewusst:

```js
$(function () {
  // Pairing UI initialisieren
});
```

und nutzt das von Homey bereitgestellte globale `Homey` Objekt direkt.

Wichtig für zukünftige Änderungen:

- Kein explizites `<script src="/homey.js">` in dieser View verwenden.
- Kein `onHomeyReady(Homey)` Callback verwenden.
- Initialisierung über `$(function(){ ... })` beibehalten.
- Backend-Kommunikation erfolgt über `Homey.emit('probe_device', ...)`.
- Devices werden in der View mit `Homey.createDevice(...)` erzeugt.
- Nach erfolgreichem Anlegen der ausgewählten Devices wird `Homey.done()` aufgerufen.

## Device Settings

Normale Homey Device Settings bleiben für einfache Einzelwerte vorgesehen, z. B. MQTT-Topics und später DoD, Ladegrenzen oder Betriebsmodi.

Zeitpläne werden nicht als einzelne Device Settings gepflegt, weil das UI dafür zu unübersichtlich ist.

## Repair / Marstek Configuration

Die Zeitplanverwaltung erfolgt über die Custom Repair View:

```
drivers/b2500/repair/schedules.html
```

Die View ist als `Marstek Configuration` / `Schedule Management` beschriftet.

- Slots 1–4 sind editierbar.
- Slot 5 ist sichtbar, aber nicht editierbar.
- Slot 5 ist grau dargestellt und als Homey Power Override dokumentiert.
- Backend-Kommunikation erfolgt über:
  - `Homey.emit('get_schedules')`
  - `Homey.emit('refresh_schedules')`
  - `Homey.emit('save_schedules', { slots })`
- Die Handler sind in `drivers/b2500/driver.js` über `onRepair(session, device)` registriert.

## Bekannte Kommandos

### Status abfragen

```
cd=01
```

### Zeitplan setzen

```
cd=20
```

Schreibformat für Zeitpläne:

```text
cd=20,md=0,a1=1,b1=6:0,e1=22:0,v1=600
```

Dabei gilt beim Schreiben:

```text
aX = aktiv
bX = Start
eX = Ende
vX = Leistung
```

## Output-Leistung

Ausgangsleistung wird über Zeitpläne (`cd=20`) gesetzt.

Regel für Homey-Automation:

- Homey verwendet ausschließlich Slot 5 für PowerLevel-Setzungen.
- Slot 5 wird auf 06:00–22:00 Uhr gesetzt.
- Slot 5 wird aktiv gesetzt, wenn PowerLevel > 0 W ist.
- Slot 5 wird deaktiviert, wenn PowerLevel = 0 W ist.
- Slots 1–4 sind für benutzerdefinierte Zeitfenster reserviert.
- Beim Setzen des PowerLevels über Homey werden Slots 1–4 deaktiviert, damit der Homey-Wert eindeutig wirksam ist.

### Schedule Parsing

Der MQTT-State verwendet für Zeitpläne ein anderes Feldschema als der `cd=20` Schreibbefehl.

MQTT-State Lesefelder:

```text
dX = aktiv
eX = Start
fX = Ende
hX = Leistung
```

Beispiel aus MQTT-State:

```text
d1=1,e1=6:0,f1=22:0,h1=600
```

Interne Abbildung als `marstek_schedule_slots`:

```js
{
  slot: 1,
  enabled: true,
  start: '6:0',
  end: '22:0',
  power: 600
}
```

Wichtig:

- Lesen aus MQTT-State: `d/e/f/h`
- Schreiben per `cd=20`: `a/b/e/v`
- Diese beiden Mappings dürfen nicht vermischt werden.

Für die Dropdown-Synchronisation gilt:

- Wenn Slot 5 exakt als Homey-Slot `06:00–22:00` erkannt wird, wird das Dropdown aus Slot 5 synchronisiert.
- Wenn Slot 5 deaktiviert ist, wird das Dropdown auf `0 W` gesetzt.
- Wenn kein passender Homey-Slot 5 erkannt wird, bleibt `marstek_threshold_w` (`lv`) als Fallback erhalten.

Nach jeder Änderung:

```
cd=01
```

zur Aktualisierung.

## PV-Erzeugung

PV-Leistung kann optional als separates Companion-Device angelegt werden.

Das PV-Device:

- verwendet denselben MQTT-State wie das Battery-Device
- läuft über denselben Homey-Driver `b2500`
- wird über `store.role = pv` unterschieden
- verwendet `class: solarpanel`
- setzt `measure_power` auf die aktuelle Gesamt-PV-Leistung
- setzt `meter_power` aus dem MQTT-Zähler `pt / 1000`
- zeigt zusätzlich nur `marstek_pv1_power` und `marstek_pv2_power` für die beiden PV-Eingänge an
- doppelte Custom-Werte `marstek_pv_power` und `marstek_pv_energy` werden am PV-Device entfernt

### PV-Energiezähler

Der MQTT-Wert `pt` wird aktuell als Wh interpretiert und im PV-Companion-Device nach kWh konvertiert.

Aktuelle Annahme:

```text
pt = PV Energy Counter in Wh
meter_power = pt / 1000
```

Homey berechnet daraus die Energy-Dashboard-Statistiken.

## Device Refresh

Beim Start des Devices:

```
cd=01
```

nach kurzer Verzögerung.

## Aktueller Implementierungsstand

### Vorhanden

- MQTT-Verbindung über App Settings
- Device Pairing über Hardware-Version + Device-ID
- Optionale Anlage des PV-Companion-Devices beim Pairing
- Automatische Modellerkennung über `cd=01`
- MQTT Subscribe/Publish Infrastruktur
- HMJ-2 State Parsing
- Schedule Parsing für Slots 1–5 über MQTT-State-Felder `d/e/f/h`
- Custom Repair View zum Bearbeiten der Slots 1–4
- Homey Device Integration
- Battery-Device für Speicherstatus
- PV-Companion-Device als Solar-Panel-Gerät
- PV-Energiezähler über `meter_power`
- Output-Leistung über Preset-Dropdown
- PowerLevel-Setzung über Slot 5 via `ScheduleService`
- Flow Action zum Setzen der Ausgangsleistung
- Flow Conditions für Schwellwerte
- Flow Trigger für PV-Leistung geändert / Schwellwert überschritten / Schwellwert unterschritten
- Automatischer Refresh nach Konfigurationsänderungen

### Architektur

- Homey-Driver bleibt gerätefamilienbezogen unter `drivers/b2500`
- Battery- und PV-Companion-Device verwenden denselben Driver und werden über `store.role` unterschieden
- B2500-Modellvarianten werden unter `lib/marstek/b2500` abgebildet
- Protokollschicht getrennt nach Versionen (`v1`, `v2`)
- Zeitplan-/Slot-Command- und Parsing-Logik liegt in `lib/marstek/b2500/services/ScheduleService.js`
- Geräteklassen werden über MQTT-Antwort erkannt
- MQTT-Verbindung zentral in der App verwaltet
- Devices abonnieren ausschließlich ihr eigenes State Topic

### Aktuelle Verzeichnisstruktur für B2500

```
drivers/
  b2500/
    driver.js
    device.js
    pair/
      start.html
    repair/
      schedules.html

lib/
  marstek/
    b2500/
      factory.js
      models.js
      protocols/
        index.js
        v1.js
        v2.js
        common/
          mapper.js
          parser.js
      services/
        ScheduleService.js
```

## Offene Punkte

### Zeitplanverwaltung

- Repair View gegen Homey Validate / Runtime testen
- Flow Cards für Zeitpläne
- Prüfen, ob später weitere komplexe Konfigurationsbereiche in dieselbe Repair View integriert werden sollen

### Powerlevel-Synchronisation

- Aktiven Zeitplan auswerten, wenn mehrere benutzerdefinierte Slots aktiv sind
- Preset-Verhalten definieren, wenn Slot 5 nicht dem Homey-Format entspricht

### Konfigurierbare Speichereinstellungen

Wenn technisch möglich:

- Alle verfügbaren Speicherparameter als Homey Capabilities bereitstellen
- Schreibbare (`setable`) Capabilities verwenden
- Einfache Einzelwerte als Device Settings anbieten
- Komplexe Tabellen/Strukturen über die Marstek Configuration Repair View abbilden

Beispiele:

- Ausgangsleistung
- DoD
- Ladegrenzen
- Entladegrenzen
- Reservekapazität
- Zeitpläne
- Betriebsmodi
- Netzladefunktionen
- weitere durch MQTT verfügbare Parameter

### Weitere B2500-Varianten

- HMA-1 testen
- HMB-1 testen
- HMF-1 testen
- HMK-1 testen

### MQTT Discovery

- Erweiterte automatische Geräteerkennung
- Wiedererkennung nach Neuinstallation
- Komfortfunktionen für mehrere Speicher

## Bekannte Erkenntnisse

### HMJ-2

Die Ausgangsleistung wird nicht direkt gesetzt.

Die Marstek App erzeugt intern Zeitpläne über:

```
cd=20
```

und steuert die Leistung über die Zeitplanparameter (`aX`, `bX`, `eX`, `vX`).

Der MQTT-State meldet dieselben Zeitpläne aber über:

```
dX, eX, fX, hX
```

Nach Änderungen sollte immer ein:

```
cd=01
```

ausgeführt werden, um den aktuellen Zustand erneut einzulesen.

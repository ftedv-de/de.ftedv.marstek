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

Die App:

1. erzeugt mögliche Topics
2. subscribed auf State Topics
3. sendet `cd=01`
4. wartet auf Antwort
5. erkennt daraus das tatsächliche Modell
6. legt das Device an

## Bekannte Kommandos

### Status abfragen

```
cd=01
```

### Zeitplan setzen

```
cd=20
```

Beispiel:

```
cd=20,md=0,a1=1,b1=0:0,e1=22:0,v1=900
```

## Output-Leistung

Wird aktuell über Zeitplan Slot 1 gesetzt.

Nach jeder Änderung:

```
cd=01
```

zur Aktualisierung.

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
- Automatische Modellerkennung über `cd=01`
- MQTT Subscribe/Publish Infrastruktur
- HMJ-2 State Parsing
- Homey Device Integration
- Output-Leistung über Preset-Dropdown
- Flow Action zum Setzen der Ausgangsleistung
- Automatischer Refresh nach Konfigurationsänderungen

### Architektur

- Homey-Driver bleibt gerätefamilienbezogen unter `drivers/b2500`
- B2500-Modellvarianten werden unter `lib/marstek/b2500` abgebildet
- Protokollschicht getrennt nach Versionen (`v1`, `v2`)
- Geräteklassen werden über MQTT-Antwort erkannt
- MQTT-Verbindung zentral in der App verwaltet
- Devices abonnieren ausschließlich ihr eigenes State Topic

### Aktuelle Verzeichnisstruktur für B2500

```
drivers/
  b2500/
    driver.js
    device.js

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
```

## Offene Punkte

### Zeitplanverwaltung

- Vollständige Unterstützung aller 5 Zeitslots
- Zeitpläne aus MQTT-State auslesen
- Zeitpläne in Homey visualisieren
- Flow Cards für Zeitpläne

### Powerlevel-Synchronisation

- Dropdown für Ausgangsleistung mit dem aktuell wirksamen Wert synchronisieren
- Aktiven Zeitplan auswerten
- Preset automatisch aktualisieren, wenn der Speicher extern konfiguriert wurde

### Konfigurierbare Speichereinstellungen

Wenn technisch möglich:

- Alle verfügbaren Speicherparameter als Homey Capabilities bereitstellen
- Schreibbare (`setable`) Capabilities verwenden
- Konfiguration direkt über die Homey Geräteansicht ermöglichen

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

Nach Änderungen sollte immer ein:

```
cd=01
```

ausgeführt werden, um den aktuellen Zustand erneut einzulesen.

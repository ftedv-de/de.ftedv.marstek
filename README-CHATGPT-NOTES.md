# ChatGPT Bootstrap Notes

This branch adds the first runnable structure for the Marstek B2500 Homey app:

- fixes protocol import paths
- adds the B2500 driver metadata
- adds custom Homey capabilities for Marstek telemetry
- adds MQTT as a runtime dependency
- adds a simple MQTT settings page

Next steps:

1. Run `npm install` locally to update `package-lock.json`.
2. Run `homey app validate`.
3. Test pairing and MQTT payload parsing on a real B2500 topic.
4. Add Flow cards for commands once telemetry is stable.

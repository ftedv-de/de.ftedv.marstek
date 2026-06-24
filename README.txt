This app adds support for marstek battery storage systems.
At the moment the only device supportet is the B2500.
For better energy handling I created two devices:
- One for the battery itself and the management associated with it
- A PV device for monitoring the solar side of the B2500


Requirements:
- You need an MQTT Server aka Broker
- Your B2500 must be configured to send to your local MQTT broker

Setup:
When the B2500 sends packages via MQTT to your local MQTT broker you simply install the app and add the device.
You can choose if you want to add the battery itself and additionally you can add the solar part.
In either way you have to enter the MAC address of the device which you can find in the marstek app under the device settings where you see the device firmware.
The app does a quick device discovery and adds the homey device for usage.

# DeskSignal

Control a USB kuando Busylight UC Alpha or Omega from desktop Chrome or Edge. Includes four presence presets, custom RGB colours, brightness, off and RGB Disco. Disco smoothly fades around the full RGB colour wheel, with an adjustable 0.1–13 second loop. Keep this tab visible while using the animation. Selecting a static colour or turning the light off stops the cycle. The same interface previews settings without a device. Status is set manually.

## Hosted dashboard

Open the [Tools Dashboard](https://domgibson.github.io/DeskSignal/) and select **DeskSignal**. At the fastest settings, the smoothness of the physical light depends on how quickly it can accept USB updates.

## Start

1. Extract the ZIP. Plug in the Busylight and exit any kuandoHUB or other software controlling it.
2. On Windows with Python 3 installed, run `Start-Windows.bat`. On macOS or Linux, open a terminal in this folder and run `python3 -m http.server 8765 --bind 127.0.0.1`.
3. In desktop Chrome or Edge, open **http://localhost:8765**. Select **DeskSignal**, choose **Connect light** and select the device in the browser picker.
4. Keep the tab running. Browser tab suspension, sleep or closing the tab interrupts the keepalive and the light can time out. **Disconnect** sends off before releasing the device.

The local server only serves the interface. The browser sends commands directly over USB HID. The project runs without npm packages or remote assets. Linux may require permission to access the matching `hidraw` device. On Chromium managed by an organisation, WebHID can also be disabled by policy.

## Source

- `index.html` is the tools dashboard. `desk-signal.html` is the controller. Both use `style.css`.
- `app.mjs` manages the browser connection, presets and keepalive.
- `protocol.mjs` packs 64-byte output reports for the supported USB IDs.

Protocol references are [Busylight for Humans](https://github.com/JnyJny/busylight) and [BusylightMenu](https://github.com/mark-bixler/busy-light).

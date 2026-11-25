import { colourReport, filters, keepaliveReport } from "./protocol.mjs";

const byId = id => document.getElementById(id);
const connect = byId("connect");
const brightness = byId("brightness");
const disco = byId("disco");
const discoSpeed = byId("disco-speed");
const discoColours = ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#00ffff", "#0055ff", "#aa00ff", "#ff0088"];
const presets = [...byId("presets").querySelectorAll("button")];
let active = { label: "Off", hex: "#000000" };
let device = null;
let timer;
let discoTimer;
let discoIndex = 0;
let discoWritePending = false;
let working = false;
let pending = Promise.resolve();

function render() {
  const level = Number(brightness.value);
  byId("level").value = level + "%";
  byId("lamp").style.setProperty("--light", `color-mix(in srgb, ${active.hex} ${level}%, black)`);
  byId("current").textContent = active.label;
  byId("device").textContent = device ? device.productName || "kuando Busylight" : "Preview mode";
  byId("connection").textContent = device ? "USB connected" : "Disconnected";
  byId("connection").classList.toggle("connected", Boolean(device));
  connect.textContent = device ? "Disconnect" : "Connect light";
  connect.disabled = working || !navigator.hid;
  disco.setAttribute("aria-pressed", String(active.label === "Disco"));
  disco.textContent = active.label === "Disco" ? "Stop Disco" : "RGB Disco";
  byId("disco-rate").value = discoSpeed.value + (discoSpeed.value === "1" ? " colour/sec" : " colours/sec");
  for (const button of presets) button.setAttribute("aria-pressed", String(button.textContent === active.label));
}

function message(text) {
  byId("message").textContent = text;
}

function forget(target) {
  if (device !== target) return;
  clearInterval(timer);
  device = null;
  render();
}

function enqueue(target, report) {
  const sent = pending.then(async () => {
    if (target === device && target.opened) await target.sendReport(0, report);
  });
  pending = sent.catch(async () => {
    if (target !== device) return;
    forget(target);
    try { await target.close(); } catch { /* The device may already be unplugged. */ }
    message("USB write failed. Close kuandoHUB or other Busylight software, then reconnect.");
  });
  return sent;
}

function apply(announce = true) {
  render();
  if (!device || working) return;
  const target = device;
  const report = colourReport(active.hex, Number(brightness.value));
  return enqueue(target, report).then(() => {
    if (announce && target === device) message("Command sent to your Busylight.");
  }).catch(() => {});
}

function select(label, hex) {
  clearInterval(discoTimer);
  active = { label, hex };
  apply();
}

function updateDiscoTimer() {
  clearInterval(discoTimer);
  render();
  if (active.label !== "Disco") return;

  discoTimer = setInterval(async () => {
    if (working || discoWritePending) return;
    discoIndex = (discoIndex + 1) % discoColours.length;
    active.hex = discoColours[discoIndex];
    discoWritePending = true;
    try {
      await apply(false);
    } finally {
      discoWritePending = false;
    }
  }, 1000 / Number(discoSpeed.value));
}

disco.addEventListener("click", () => {
  if (active.label === "Disco") {
    select("Off", "#000000");
    return;
  }
  discoIndex = 0;
  select("Disco", discoColours[discoIndex]);
  updateDiscoTimer();
});
discoSpeed.addEventListener("input", updateDiscoTimer);

connect.addEventListener("click", async () => {
  working = true;
  render();
  try {
    if (device) {
      const target = device;
      clearInterval(timer);
      try { await enqueue(target, colourReport("#000000", 0)); } catch { /* Still release the device. */ }
      forget(target);
      await target.close();
      message("USB disconnected. You can still use preview mode.");
      return;
    }

    const [target] = await navigator.hid.requestDevice({ filters });
    if (!target) {
      message("No light selected. Plug in your Alpha or Omega and try again.");
      return;
    }
    await pending;
    await target.open();
    device = target;
    await enqueue(target, colourReport(active.hex, Number(brightness.value)));
    await enqueue(target, keepaliveReport());
    if (target !== device) return;
    timer = setInterval(() => enqueue(target, keepaliveReport()).catch(() => {}), 8000);
    message("Connected. Keep this tab open to maintain the light.");
  } catch {
    message("Could not connect to the light. Close other Busylight software and reconnect.");
  } finally {
    working = false;
    render();
    if (device) apply();
  }
});

navigator.hid?.addEventListener("disconnect", event => {
  if (event.device !== device) return;
  forget(event.device);
  message("The light was unplugged. Reconnect it to resume USB control.");
});

for (const button of presets) button.addEventListener("click", () => select(button.textContent, button.dataset.color));
byId("custom").addEventListener("submit", event => {
  event.preventDefault();
  select("Custom", byId("color").value);
});
byId("off").addEventListener("click", () => select("Off", "#000000"));
brightness.addEventListener("input", render);
brightness.addEventListener("change", apply);

render();
if (!navigator.hid) message("USB control requires desktop Chrome or Edge on http://localhost or HTTPS. Preview mode is available here.");

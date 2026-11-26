const byId = id => document.getElementById(id);
const form = byId("router-form");
const run = byId("router-run");
const link = byId("router-link");
const status = byId("router-status");
const results = byId("router-results");
const local = location.origin === "http://127.0.0.1:8766";
byId("router-setup").hidden = local;
byId("router-local").hidden = !local;
run.hidden = !local;

function readTarget() {
  const ip = byId("router-ip").value.trim();
  const octets = ip.split(".");
  if (octets.length !== 4 || !octets.every(value => /^(0|[1-9][0-9]{0,2})$/.test(value) && Number(value) <= 255)) {
    throw new Error("Enter an IPv4 address, such as 192.168.1.1.");
  }
  const port = byId("router-port").valueAsNumber;
  if (!byId("router-port").validity.valid) throw new Error("Enter a TCP port from 1 to 65535.");
  return { ip, port: Number.isNaN(port) ? null : port };
}

function showAdminLink({ ip, port }) {
  const scheme = byId("router-scheme").value;
  const path = byId("router-path").value.trim() || "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Enter an admin path starting with a single slash, such as /.");
  }
  const url = new URL(scheme + "://" + ip + (port === null ? "" : ":" + port));
  // Resolve against the fixed router origin so the path cannot replace the host.
  const admin = new URL(path, url);
  if (admin.origin !== url.origin) throw new Error("Enter a path on the router.");
  link.href = admin.href;
  link.textContent = "Open " + admin.href;
  link.hidden = false;
}

form.addEventListener("input", () => {
  link.hidden = true;
  results.hidden = true;
  status.textContent = "";
});

byId("router-build").addEventListener("click", () => {
  try {
    showAdminLink(readTarget());
    status.textContent = "Open the link to check whether your router serves its admin portal there.";
  } catch (error) {
    status.textContent = error.message;
  }
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!local || run.disabled) return;
  results.hidden = true;
  run.disabled = true;
  const fields = form.querySelectorAll("input, select");
  try {
    const target = readTarget();
    for (const field of fields) field.disabled = true;
    status.textContent = "Checking " + target.ip + "…";
    const response = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(target),
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error("The local companion could not run the check.");
    const data = await response.json();
    byId("ping-result").textContent = data.ping;
    byId("tcp-result").textContent = data.tcp;
    results.hidden = false;
    status.textContent = "Checks complete for " + target.ip + ".";
  } catch (error) {
    status.textContent = ["TypeError", "TimeoutError"].includes(error.name)
      ? "Could not reach the local companion. Check that it is still running."
      : error.message;
  } finally {
    for (const field of fields) field.disabled = false;
    run.disabled = false;
  }
});

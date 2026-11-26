const byId = id => document.getElementById(id);
const form = byId("signal-form");
const network = byId("signal-network");
const postcode = byId("signal-postcode");
const setting = byId("signal-setting");
const run = byId("signal-run");
const status = byId("signal-status");
const report = byId("signal-report");
const outage = byId("signal-outage");
const outageUrls = {
  vodafone: ["Vodafone network status", "https://www.vodafone.co.uk/network/status-checker/"],
  o2: ["O2 network status", "https://status.o2.co.uk/"],
  ee: ["EE coverage and service status", "https://ee.co.uk/help/mobile-coverage-checker"],
  other: ["Choose a network checker", "./mobile-signal.html"],
};

function updateOutageLink() {
  const [label, url] = outageUrls[network.value];
  outage.href = url;
  outage.textContent = label + " ↗";
}
network.addEventListener("change", updateOutageLink);
updateOutageLink();

function readPostcode() {
  const compact = postcode.value.toUpperCase().replace(/\s+/g, "");
  if (!/^(?:GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(compact)) {
    throw new Error("Enter a full UK postcode, such as SW1A 1AA.");
  }
  return compact.slice(0, -3) + " " + compact.slice(-3);
}

async function measureRequest() {
  const url = new URL("./signal-probe.txt", location.href);
  url.searchParams.set("test", Math.random().toString(36).slice(2));
  const started = performance.now();
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!response.ok || (await response.text()).trim() !== "DeskSignal connection test") return null;
    return performance.now() - started;
  } catch {
    return null;
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (run.disabled || !form.reportValidity()) return;
  let area;
  try { area = readPostcode(); } catch (error) {
    status.textContent = error.message;
    return;
  }

  const fields = form.querySelectorAll("input, select, button");
  const context = [network.selectedOptions[0].textContent, area, setting.value].join(" · ");
  byId("signal-results").hidden = true;
  byId("report-status").textContent = "";
  for (const field of fields) field.disabled = true;
  try {
    const timings = [];
    const attempts = 6;
    const timestamp = new Date().toISOString();
    for (let attempt = 1; attempt <= attempts; attempt++) {
      status.textContent = "Checking request " + attempt + " of " + attempts + "…";
      const time = await measureRequest();
      if (time !== null) timings.push(time);
    }
    timings.sort((a, b) => a - b);
    const midpoint = Math.floor(timings.length / 2);
    const median = timings.length % 2 ? timings[midpoint] : (timings[midpoint - 1] + timings[midpoint]) / 2;
    report.value = [
      "Customer mobile connection check",
      context,
      "Started: " + timestamp,
      "Wi-Fi off / mobile data on: confirmed by customer",
      "Successful web requests: " + timings.length + "/" + attempts,
      "Failed web requests: " + (attempts - timings.length),
      "Median response time: " + (timings.length ? Math.round(median) + " ms" : "unavailable"),
      "Endpoint: " + location.host,
      "Coverage and reported outage status: check separately using the postcode above.",
    ].join("\n");
    byId("signal-results").hidden = false;
    status.textContent = "Test complete.";
  } finally {
    for (const field of fields) field.disabled = false;
  }
});

byId("postcode-copy").addEventListener("click", async () => {
  const feedback = byId("postcode-status");
  let area;
  try { area = readPostcode(); } catch (error) {
    feedback.textContent = error.message;
    postcode.focus();
    return;
  }
  try {
    await navigator.clipboard.writeText(area);
    feedback.textContent = "Postcode copied: " + area;
  } catch {
    feedback.textContent = "Copy this postcode: " + area;
  }
});

byId("report-copy").addEventListener("click", async () => {
  const feedback = byId("report-status");
  try {
    await navigator.clipboard.writeText(report.value);
    feedback.textContent = "Report copied.";
  } catch {
    report.focus();
    report.select();
    feedback.textContent = "Report selected. Copy it using your device.";
  }
});

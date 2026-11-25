import { encodeMuLaw, muLawWave, sampleRate } from "./g711.mjs";

const form = document.getElementById("audio-form");
const input = document.getElementById("audio-file");
const format = document.getElementById("audio-format");
const convert = document.getElementById("convert");
const download = document.getElementById("audio-download");
const status = document.getElementById("audio-status");
let downloadUrl;

function clearDownload() {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = undefined;
  download.removeAttribute("href");
  download.hidden = true;
}

async function decodeMono(file) {
  // decodeAudioData resamples to the context rate, then Web Audio downmixes to mono.
  const decoder = new OfflineAudioContext(1, 1, sampleRate);
  const decoded = await decoder.decodeAudioData(await file.arrayBuffer());
  if (decoded.numberOfChannels === 1) return decoded.getChannelData(0);

  const mixer = new OfflineAudioContext(1, decoded.length, sampleRate);
  const source = mixer.createBufferSource();
  source.buffer = decoded;
  source.connect(mixer.destination);
  source.start();
  const mono = await mixer.startRendering();
  return mono.getChannelData(0);
}

form.addEventListener("change", () => {
  clearDownload();
  status.textContent = "";
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  const [file] = input.files;
  if (!file || convert.disabled) return;

  clearDownload();
  const raw = format.value === "raw";
  input.disabled = format.disabled = convert.disabled = true;
  status.textContent = "Converting audio…";

  try {
    const samples = await decodeMono(file);
    const encoded = encodeMuLaw(samples);
    const bytes = raw ? encoded : muLawWave(encoded);
    const blob = new Blob([bytes], { type: raw ? "application/octet-stream" : "audio/wav" });
    downloadUrl = URL.createObjectURL(blob);
    download.href = downloadUrl;
    download.download = (file.name.replace(/\.[^.]+$/, "") || "audio") + (raw ? ".ulaw" : ".wav");
    download.hidden = false;
    status.textContent = "Ready to download.";
  } catch {
    status.textContent = "Could not convert this file. Try an MP3 or WAV file your browser can open.";
  } finally {
    input.disabled = format.disabled = convert.disabled = false;
  }
});

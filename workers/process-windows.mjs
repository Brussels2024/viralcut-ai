#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFile, mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe";
const ROOT = path.resolve(process.env.VIRALCUT_CAPTURE_DIR ?? "./data/captures");
const SESSION_ID = process.env.SESSION_ID ?? "";
const SESSION_DIR = path.join(ROOT, SESSION_ID);
const POLL_MS = Number.parseInt(process.env.VIRALCUT_PROCESS_POLL_MS ?? "5000", 10);
const API_BASE = (process.env.VIRALCUT_API_BASE_URL ?? "").replace(/\/$/, "");
const ANALYSIS_KEY = process.env.VIRALCUT_INTERNAL_API_KEY ?? "";
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";
const OUTPUT_DIR = path.resolve(process.env.VIRALCUT_CLIPS_DIR ?? path.join(SESSION_DIR, "clips"));
const STATE_FILE = path.join(SESSION_DIR, "processed-windows.json");

function required(value, name) {
  if (!value) throw new Error(`${name} não configurado.`);
  return value;
}
function parseCsvLine(line) {
  const fields = []; let field = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { field += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { fields.push(field); field = ""; }
    else field += char;
  }
  fields.push(field); return fields;
}
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve(stdout.trim()) : reject(new Error(`${path.basename(command)} saiu com código ${code}: ${stderr.slice(-2500)}`)));
  });
}
async function loadState() {
  try { const state = JSON.parse(await readFile(STATE_FILE, "utf8")); return new Set(Array.isArray(state.completed) ? state.completed : []); }
  catch { return new Set(); }
}
async function saveState(completed) {
  const temp = STATE_FILE + ".tmp";
  await writeFile(temp, JSON.stringify({ updatedAt: new Date().toISOString(), completed: [...completed] }, null, 2));
  await rename(temp, STATE_FILE);
}
async function transcribe(audioPath) {
  const bytes = await readFile(audioPath);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "audio/mpeg" }), path.basename(audioPath));
  form.append("model", process.env.VIRALCUT_TRANSCRIPTION_MODEL ?? "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}` }, body: form,
    signal: AbortSignal.timeout(180_000)
  });
  if (!response.ok) throw new Error(`Transcrição falhou (${response.status}): ${(await response.text()).slice(0, 1000)}`);
  const payload = await response.json();
  const segments = (payload.segments ?? []).filter(item => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start && typeof item.text === "string" && item.text.trim()).map(item => ({ start: item.start, end: item.end, text: item.text.trim() }));
  if (!segments.length) throw new Error("Transcrição sem segmentos com timestamps.");
  return { segments, duration: Number(payload.duration) || undefined };
}


function runDiagnostic(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve(stderr) : reject(new Error(`${path.basename(command)} saiu com código ${code}: ${stderr.slice(-2500)}`)));
  });
}
function attachSceneSignals(segments, sceneTimes) {
  return segments.map(segment => {
    const changes = sceneTimes.filter(time => time >= segment.start && time < segment.end).length;
    return { ...segment, video: { sceneChange: Number(Math.min(1, changes / 4).toFixed(3)) } };
  });
}

function attachAudioSignals(segments, pcm) {
  const sampleRate = 16000;
  const totalSamples = Math.floor(pcm.length / 2);
  const clamp = value => Math.max(0, Math.min(1, value));
  return segments.map(segment => {
    const from = Math.max(0, Math.floor(segment.start * sampleRate));
    const to = Math.min(totalSamples, Math.ceil(segment.end * sampleRate));
    if (to <= from) return segment;
    let squares = 0;
    let peak = 0;
    for (let index = from; index < to; index++) {
      const sample = pcm.readInt16LE(index * 2) / 32768;
      const magnitude = Math.abs(sample);
      squares += sample * sample;
      if (magnitude > peak) peak = magnitude;
    }
    const rms = Math.sqrt(squares / (to - from));
    const rmsDb = 20 * Math.log10(Math.max(rms, 0.000001));
    const peakDb = 20 * Math.log10(Math.max(peak, 0.000001));
    return {
      ...segment,
      audio: {
        energy: Number(clamp((rmsDb + 55) / 43).toFixed(3)),
        excitement: Number(clamp((peakDb + 50) / 47).toFixed(3))
      }
    };
  });
}

async function analyze(segments, duration) {
  const response = await fetch(`${API_BASE}/api/ai/analyze-transcript`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-viralcut-internal-key": ANALYSIS_KEY },
    body: JSON.stringify({ videoDuration: duration, segments }),
    signal: AbortSignal.timeout(70_000)
  });
  if (!response.ok) throw new Error(`Análise IA falhou (${response.status}): ${(await response.text()).slice(0, 1000)}`);
  return (await response.json()).moments ?? [];
}
async function renderClips(videoPath, windowName, moments) {
  const folder = path.join(OUTPUT_DIR, path.parse(windowName).name);
  await mkdir(folder, { recursive: true });
  const rendered = [];
  for (let i = 0; i < moments.length; i++) {
    const moment = moments[i]; const duration = moment.endSeconds - moment.startSeconds;
    if (moment.startSeconds < 0 || duration < 1 || duration > 180) continue;
    const destination = path.join(folder, `cut-${String(i + 1).padStart(2, "0")}-${Math.floor(moment.startSeconds)}s.mp4`);
    const temp = destination + ".tmp.mp4";
    await run(FFMPEG, ["-hide_banner","-nostdin","-y","-ss",String(moment.startSeconds),"-i",videoPath,"-t",String(duration),"-map","0:v:0","-map","0:a?","-vf","scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1","-c:v","libx264","-preset","veryfast","-crf","21","-c:a","aac","-b:a","160k","-movflags","+faststart",temp]);
    await rename(temp, destination); rendered.push({ ...moment, file: destination });
  }
  return rendered;
}
async function processWindow(fileName, completed) {
  const videoPath = path.resolve(SESSION_DIR, fileName);
  if (!videoPath.startsWith(SESSION_DIR + path.sep)) throw new Error("Caminho de segmento inválido.");
  const info = await stat(videoPath);
  if (!info.isFile() || info.size < 1024) throw new Error("Segmento vazio ou ainda não pronto.");
  const duration = Number(await run(FFPROBE, ["-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",videoPath]));
  if (!Number.isFinite(duration) || duration < 60) throw new Error("Segmento menor que 60 segundos ou duração inválida.");
  const tempDir = path.join(SESSION_DIR, ".processing"); await mkdir(tempDir, { recursive: true });
  const audioPath = path.join(tempDir, path.parse(fileName).name + ".mp3");
  await run(FFMPEG, ["-hide_banner","-nostdin","-y","-i",videoPath,"-vn","-ac","1","-ar","16000","-b:a","48k",audioPath]);
  const rawAudioPath = path.join(tempDir, path.parse(fileName).name + ".s16le");
  await run(FFMPEG, ["-hide_banner","-nostdin","-y","-i",videoPath,"-vn","-ac","1","-ar","16000","-f","s16le",rawAudioPath]);
  const transcription = await transcribe(audioPath);
  const pcm = await readFile(rawAudioPath);
  const audioSignaled = attachAudioSignals(transcription.segments, pcm);
  const sceneLog = await runDiagnostic(FFMPEG, ["-hide_banner","-nostdin","-i",videoPath,"-vf","select='gt(scene,0.30)',showinfo","-an","-f","null","-"]);
  const sceneTimes = [...sceneLog.matchAll(/pts_time:([0-9.]+)/g)].map(match => Number(match[1])).filter(Number.isFinite);
  const signaledSegments = attachSceneSignals(audioSignaled, sceneTimes);
  const moments = await analyze(signaledSegments, transcription.duration ?? duration);
  const clips = await renderClips(videoPath, fileName, moments);
  await writeFile(path.join(OUTPUT_DIR, path.parse(fileName).name + ".json"), JSON.stringify({ source: videoPath, analyzedAt: new Date().toISOString(), transcriptSegments: transcription.segments.length, audioSignals: "rms-and-peak-per-transcript-segment", sceneChanges: sceneTimes.length, selectedMoments: moments, renderedClips: clips }, null, 2));
  completed.add(fileName); await saveState(completed);
  console.log(JSON.stringify({ event: "window_processed", fileName, transcriptSegments: transcription.segments.length, selected: moments.length, rendered: clips.length }));
}
async function main() {
  required(SESSION_ID,"SESSION_ID"); if (!/^[a-zA-Z0-9_-]{3,64}$/.test(SESSION_ID)) throw new Error("SESSION_ID inválido.");
  required(API_BASE,"VIRALCUT_API_BASE_URL"); required(ANALYSIS_KEY,"VIRALCUT_INTERNAL_API_KEY"); required(OPENAI_KEY,"OPENAI_API_KEY");
  if (!Number.isInteger(POLL_MS) || POLL_MS < 1000) throw new Error("VIRALCUT_PROCESS_POLL_MS deve ser pelo menos 1000.");
  await mkdir(OUTPUT_DIR,{recursive:true}); const completed = await loadState();
  console.log(JSON.stringify({ event:"window_processor_started",sessionId:SESSION_ID,pollMs:POLL_MS,completed:completed.size }));
  let stopping = false; process.once("SIGINT",()=>{stopping=true;}); process.once("SIGTERM",()=>{stopping=true;});
  while (!stopping) {
    try {
      const content = await readFile(path.join(SESSION_DIR,"windows.csv"),"utf8");
      for (const line of content.split(/\r?\n/).filter(Boolean)) {
        const [fileName] = parseCsvLine(line); if (!fileName || completed.has(fileName)) continue;
        try { await processWindow(fileName,completed); }
        catch(error) { console.error(JSON.stringify({event:"window_processing_failed",fileName,message:error.message})); break; }
      }
    } catch(error) { if (error.code !== "ENOENT") console.error(JSON.stringify({event:"manifest_read_failed",message:error.message})); }
    await new Promise(resolve=>setTimeout(resolve,POLL_MS));
  }
  console.log(JSON.stringify({event:"window_processor_stopped",sessionId:SESSION_ID}));
}
main().catch(error=>{console.error(JSON.stringify({event:"processor_configuration_error",message:error.message}));process.exitCode=1;});

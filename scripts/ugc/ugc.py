"""Multi-scene UGC ad generator (MuAPI): scene images -> voice lines -> talking clips.

Usage:
  export MUAPI_KEY=...            # never commit the key
  python3 scripts/ugc/ugc.py scripts/ugc/job-infobakery.json out/infobakery barato|melhor
  bash scripts/ugc/assemble.sh out/infobakery/barato out/infobakery/UGC-barato.mp4

Job file: refs (identity photos/portrait URLs), base_prompt, scenes {s1..}, lines {s1..},
voice_id (MiniMax cloned voice or preset), speed. Use "audio" {s1..} instead of lines to
supply ready audio URLs (e.g. from a local voice-clone model) and skip TTS.
"""
import json, os, sys, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from mu import run_many, balance

job_path, out_dir, version = sys.argv[1], sys.argv[2], sys.argv[3]
job = json.load(open(job_path))
os.makedirs(out_dir, exist_ok=True)
spent = {}

def step(name, jobs):
    b0 = balance()
    out = run_many(jobs)
    spent[name] = round(b0 - balance(), 4)
    json.dump(out, open(os.path.join(out_dir, f"{name}.json"), "w"), indent=1)
    return out

scenes = step("scenes", {k: ("nano-banana-edit", {"prompt": job["base_prompt"] + p, "images_list": job["refs"],
                                                 "aspect_ratio": "9:16"}) for k, p in job["scenes"].items()})
if job.get("audio"):
    audio = job["audio"]
else:
    audio = step("tts", {k: ("minimax-speech-2.6-hd", {"prompt": t, "voice_id": job["voice_id"], "speed": job.get("speed", 1),
                         "emotion": job.get("emotion", "happy"), "language_boost": "Portuguese", "format": "mp3",
                         "sample_rate": 44100, "bitrate": 128000, "channel": 1}) for k, t in job["lines"].items()})

motion = job.get("motion_prompt", "Handheld selfie video, natural phone shake, talks to camera like a UGC creator, natural blinking.")
if version == "barato":
    anim = {k: ("infinitetalk-image-to-video", {"prompt": motion, "image_url": scenes[k], "audio_url": audio[k], "resolution": "480p"}) for k in scenes}
else:
    anim = {k: ("kling-v1-avatar-standard", {"prompt": motion, "image_url": scenes[k], "audio_url": audio[k]}) for k in scenes}
clips = step(f"anim-{version}", anim)

prefix = os.path.join(out_dir, version)
for k, url in clips.items():
    urllib.request.urlretrieve(url, f"{prefix}-{k}.mp4")
print("clips:", prefix + "-s*.mp4"); print("custo (US$):", spent)

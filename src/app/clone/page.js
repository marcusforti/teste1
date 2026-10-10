"use client";

import { useSession, signIn } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiUpload, FiLoader, FiMic, FiVideo, FiUser, FiPlus, FiAlertCircle, FiTrash2 } from "react-icons/fi";
import toast from "react-hot-toast";
import config from "@/lib/config";

const { presetVoices, emotions, speeds, defaultSpeed, maxPhotos, maxScriptChars, costs } = config.clone;
const POLL_MS = 8000;
// MuAPI reports pending/queued/starting/processing while a job runs.
const isActive = (status) => status !== "completed" && status !== "failed";

async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  if (!data.url) throw new Error("Upload sem URL");
  return data.url;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

function StatusBadge({ status, label }) {
  const styles = {
    completed: "bg-emerald-100 text-emerald-700",
    ready: "bg-emerald-100 text-emerald-700",
    failed: "bg-rose-100 text-rose-700",
    none: "bg-slate-100 text-slate-500",
  };
  const labels = { completed: "pronto", ready: "pronta", failed: "falhou", none: "sem voz", processing: "gerando" };
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${styles[status] || "bg-amber-100 text-amber-700"}`}>
      {label ? `${label}: ` : ""}{labels[status] || status}
    </span>
  );
}

function Section({ step, title, icon: Icon, children }) {
  return (
    <section className="bg-bg-card border border-divider rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded-full bg-primary text-primary-btn-text text-xs font-bold flex items-center justify-center">{step}</span>
        <Icon className="text-primary" />
        <h2 className="font-bold text-sm text-primary-text">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const inputClass =
  "w-full bg-bg-page border border-divider rounded-lg px-3 py-2 text-sm text-primary-text outline-none focus:border-primary";
const buttonClass =
  "inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-primary-btn-text text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed";

function NewCloneForm({ onCreated }) {
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const addPhotos = async (files) => {
    const room = maxPhotos - photos.length;
    const list = Array.from(files).slice(0, room);
    if (list.length === 0) return;
    setBusy(true);
    try {
      const urls = await Promise.all(list.map(uploadFile));
      setPhotos((p) => [...p, ...urls]);
    } catch (e) {
      toast.error(`Falha no upload: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const data = await postJson("/api/clones", { name, photos });
      toast.success("Clone criado. Gerando o retrato base…");
      setName("");
      setPhotos([]);
      onCreated(data.cloneId);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section step={1} title="Suas fotos → retrato base" icon={FiUser}>
      <p className="text-xs text-secondary-text mb-3">
        Envie de 1 a {maxPhotos} fotos suas: rosto nítido, boa luz, ângulos variados e sem óculos escuros.
        A IA gera um retrato 9:16 fiel, que vira a base de todas as cenas.
      </p>
      <input className={`${inputClass} mb-3`} placeholder="Nome do clone (ex.: Marcus — estúdio)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex flex-wrap gap-2 mb-3">
        {photos.map((url) => (
          <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-divider group">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
              className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"
              aria-label="Remover foto"
            >
              <FiTrash2 />
            </button>
          </div>
        ))}
        {photos.length < maxPhotos && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-divider text-secondary-text flex items-center justify-center hover:border-primary"
            aria-label="Adicionar fotos"
          >
            {busy ? <FiLoader className="animate-spin" /> : <FiPlus />}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
      </div>
      <button className={buttonClass} disabled={busy || photos.length === 0} onClick={create}>
        {busy ? <FiLoader className="animate-spin" /> : <FiUpload />} Gerar retrato base ({costs.portrait} créditos)
      </button>
    </Section>
  );
}

function VoicePanel({ clone, onChanged }) {
  const [sampleUrl, setSampleUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      setSampleUrl(await uploadFile(file));
    } catch (e) {
      toast.error(`Falha no upload: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const cloneVoice = async () => {
    setBusy(true);
    try {
      await postJson(`/api/clones/${clone.id}/voice`, { sampleUrl, consent });
      toast.success("Clonando sua voz…");
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section step={2} title="Sua voz (opcional)" icon={FiMic}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-secondary-text">Status:</span> <StatusBadge status={clone.voiceStatus} />
        {clone.voiceError && <span className="text-xs text-rose-600">{clone.voiceError}</span>}
      </div>
      <p className="text-xs text-secondary-text mb-3">
        Grave de 30 s a 2 min falando naturalmente, sem música nem ruído. Sem voz clonada, você pode usar uma das vozes prontas.
      </p>
      <div className="flex items-center gap-2 mb-3">
        <button className="text-sm border border-divider rounded-lg px-3 py-2 hover:border-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <FiLoader className="animate-spin inline" /> : <FiUpload className="inline" />} Enviar áudio
        </button>
        <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        {sampleUrl && <audio src={sampleUrl} controls className="h-8" />}
      </div>
      <label className="flex items-start gap-2 text-xs text-primary-text mb-3">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        Confirmo que esta voz é minha e autorizo a clonagem. Não vou usar a voz de outra pessoa sem a autorização dela.
      </label>
      <button className={buttonClass} disabled={busy || !sampleUrl || !consent || clone.voiceStatus === "processing"} onClick={cloneVoice}>
        <FiMic /> Clonar voz ({costs.voiceClone} créditos)
      </button>
    </Section>
  );
}

function VideoPanel({ clone, onChanged }) {
  const voiceReady = clone.voiceStatus === "ready";
  const [script, setScript] = useState("");
  const [scene, setScene] = useState("");
  const [voice, setVoice] = useState(voiceReady ? "clone" : presetVoices[0]);
  const [emotion, setEmotion] = useState("happy");
  const [speed, setSpeed] = useState(defaultSpeed);
  const [resolution, setResolution] = useState("480p");
  const [ownAudioUrl, setOwnAudioUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const audioRef = useRef(null);
  const useOwnAudio = voice === "own";

  useEffect(() => {
    if (voiceReady) setVoice("clone");
  }, [voiceReady]);

  const cost = (scene.trim() ? costs.scene : 0) + (useOwnAudio ? 0 : costs.tts) + costs.talk;

  const uploadOwnAudio = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      setOwnAudioUrl(await uploadFile(file));
    } catch (e) {
      toast.error(`Falha no upload: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      await postJson(`/api/clones/${clone.id}/video`, { script, scene, voice, emotion, speed, resolution, audioUrl: useOwnAudio ? ownAudioUrl : undefined });
      toast.success("Gerando vídeo: cena → voz → animação");
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section step={3} title="Roteiro → vídeo falando" icon={FiVideo}>
      <textarea
        className={`${inputClass} min-h-[110px] mb-1`}
        placeholder="Escreva o que o clone vai falar. Gancho nos 3 primeiros segundos, uma ideia por frase, CTA no final."
        maxLength={maxScriptChars}
        value={script}
        onChange={(e) => setScript(e.target.value)}
      />
      <div className="text-[10px] text-secondary-text text-right mb-3">{script.length}/{maxScriptChars}</div>
      <input
        className={`${inputClass} mb-3`}
        placeholder="Cena (opcional): ex. na cozinha segurando uma caneca de café, luz da manhã"
        value={scene}
        onChange={(e) => setScene(e.target.value)}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        <select className={inputClass} value={voice} onChange={(e) => setVoice(e.target.value)} aria-label="Voz">
          {voiceReady && <option value="clone">Minha voz clonada</option>}
          {presetVoices.map((v) => <option key={v} value={v}>{v.replace(/_/g, " ")}</option>)}
          <option value="own">Usar meu áudio (arquivo pronto)</option>
        </select>
        <select className={inputClass} value={emotion} onChange={(e) => setEmotion(e.target.value)} aria-label="Emoção">
          {emotions.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className={inputClass} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Velocidade da fala">
          {speeds.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className={inputClass} value={resolution} onChange={(e) => setResolution(e.target.value)} aria-label="Resolução">
          <option value="480p">480p</option>
          <option value="720p">720p</option>
        </select>
      </div>
      {useOwnAudio && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button className="text-sm border border-divider rounded-lg px-3 py-2 hover:border-primary" onClick={() => audioRef.current?.click()} disabled={busy}>
            {busy ? <FiLoader className="animate-spin inline" /> : <FiUpload className="inline" />} Enviar áudio gerado no seu PC
          </button>
          <input ref={audioRef} type="file" accept="audio/*" hidden onChange={(e) => { uploadOwnAudio(e.target.files?.[0]); e.target.value = ""; }} />
          {ownAudioUrl && <audio src={ownAudioUrl} controls className="h-8" />}
          <p className="text-[11px] text-secondary-text w-full">O áudio substitui a etapa de voz: emoção e velocidade são ignoradas, e o roteiro vira só referência.</p>
        </div>
      )}
      <button className={buttonClass} disabled={busy || (useOwnAudio ? !ownAudioUrl : !script.trim())} onClick={generate}>
        {busy ? <FiLoader className="animate-spin" /> : <FiVideo />} Gerar vídeo ({cost} créditos)
      </button>
    </Section>
  );
}

function stepLabel(creation) {
  if (!isActive(creation.status) || !creation.pipeline) return null;
  try {
    const p = JSON.parse(creation.pipeline);
    const names = { scene: "gerando cena", tts: "gerando voz", talk: "animando" };
    return `${names[p.steps[p.index]]} (${p.index + 1}/${p.steps.length})`;
  } catch {
    return null;
  }
}

export default function ClonePage() {
  const { status } = useSession();
  const [clones, setClones] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/clones");
    if (res.ok) {
      const data = await res.json();
      setClones(data);
      setSelectedId((id) => id || data[0]?.id || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
    if (status === "unauthenticated") setLoading(false);
  }, [status, load]);

  // Poll every pending job; the refresh endpoint also advances multi-step pipelines when no webhook is configured.
  useEffect(() => {
    const pending = clones.flatMap((c) => [
      c.portraitStatus === "processing" && c.portraitRequestId,
      c.voiceStatus === "processing" && c.voiceRequestId,
      ...c.creations.filter((k) => isActive(k.status) && !k.requestId.endsWith(":advancing")).map((k) => k.requestId),
    ]).filter(Boolean);
    if (pending.length === 0) return;

    const timer = setTimeout(async () => {
      await Promise.all(pending.map((id) => fetch(`/api/jobs/${id}/refresh`, { method: "POST" }).catch(() => {})));
      load();
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [clones, load]);

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
        <button className={buttonClass} onClick={() => signIn()}>Entre para criar seu clone</button>
      </div>
    );
  }

  const selected = clones.find((c) => c.id === selectedId);

  return (
    <div className="min-h-screen bg-bg-page px-4 pt-24 pb-16">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-primary-text mb-1">Estúdio de Clone</h1>
        <p className="text-sm text-secondary-text mb-6">Suas fotos e sua voz viram vídeos falando, sem precisar gravar toda vez.</p>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <aside className="space-y-2">
            <button className={`${buttonClass} w-full`} onClick={() => setSelectedId(null)}>
              <FiPlus /> Novo clone
            </button>
            {loading && <FiLoader className="animate-spin text-secondary-text mx-auto" />}
            {clones.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg border text-left ${c.id === selectedId ? "border-primary bg-bg-card" : "border-divider bg-bg-card hover:border-primary"}`}
              >
                <div className="w-10 h-14 rounded bg-bg-page overflow-hidden flex items-center justify-center shrink-0">
                  {c.portraitUrl ? <img src={c.portraitUrl} alt="" className="w-full h-full object-cover" /> : <FiLoader className="animate-spin text-secondary-text" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-primary-text truncate">{c.name}</div>
                  <div className="flex flex-wrap gap-1 mt-1"><StatusBadge label="retrato" status={c.portraitStatus} /><StatusBadge label="voz" status={c.voiceStatus} /></div>
                </div>
              </button>
            ))}
          </aside>

          <main className="space-y-4">
            {!selected && <NewCloneForm onCreated={(id) => { setSelectedId(id); load(); }} />}

            {selected && (
              <>
                <div className="flex gap-4 items-start bg-bg-card border border-divider rounded-xl p-5">
                  <div className="w-32 aspect-[9/16] rounded-lg bg-bg-page overflow-hidden flex items-center justify-center shrink-0">
                    {selected.portraitUrl ? (
                      <img src={selected.portraitUrl} alt={`Retrato de ${selected.name}`} className="w-full h-full object-cover" />
                    ) : selected.portraitStatus === "failed" ? (
                      <FiAlertCircle className="text-rose-500 text-2xl" />
                    ) : (
                      <FiLoader className="animate-spin text-secondary-text" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-primary-text">{selected.name}</h2>
                    <div className="flex gap-1 my-2"><StatusBadge status={selected.portraitStatus} /></div>
                    {selected.portraitError && <p className="text-xs text-rose-600">{selected.portraitError}</p>}
                    <div className="flex gap-1 mt-2">
                      {selected.photos.map((url) => <img key={url} src={url} alt="" className="w-10 h-10 rounded object-cover border border-divider" />)}
                    </div>
                  </div>
                </div>

                <VoicePanel clone={selected} onChanged={load} />
                {selected.portraitStatus === "completed" && <VideoPanel key={selected.id} clone={selected} onChanged={load} />}

                {selected.creations.length > 0 && (
                  <section className="bg-bg-card border border-divider rounded-xl p-5">
                    <h2 className="font-bold text-sm text-primary-text mb-4">Vídeos</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {selected.creations.map((k) => (
                        <div key={k.id} className="rounded-lg border border-divider overflow-hidden">
                          <div className="aspect-[9/16] bg-bg-page flex items-center justify-center">
                            {k.status === "completed" && k.url ? (
                              <video src={k.url} controls playsInline className="w-full h-full object-cover" />
                            ) : k.status === "failed" ? (
                              <div className="p-3 text-center"><FiAlertCircle className="text-rose-500 text-2xl mx-auto mb-1" /><p className="text-[10px] text-rose-600 break-words">{k.error}</p></div>
                            ) : (
                              <div className="text-center"><FiLoader className="animate-spin text-secondary-text mx-auto mb-1" /><p className="text-[10px] text-secondary-text">{stepLabel(k)}</p></div>
                            )}
                          </div>
                          <p className="text-[11px] text-secondary-text p-2 line-clamp-2">{k.prompt}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

import { useEffect } from "react";

export default function Controls({
  micOn, setMicOn,
  camOn, setCamOn,
  onShareScreen,
  onStopShare,
  isSharing,
  onLeave
}) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "l") onLeave(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onLeave]);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-3 bg-slate-800/80 px-4 py-2 rounded-2xl shadow-lg">
      <button
        className={`px-3 py-2 rounded-xl ${micOn ? "bg-slate-700" : "bg-rose-700"} text-white`}
        onClick={() => setMicOn(v => !v)}
      >
        {micOn ? "Mute" : "Unmute"}
      </button>
      <button
        className={`px-3 py-2 rounded-xl ${camOn ? "bg-slate-700" : "bg-rose-700"} text-white`}
        onClick={() => setCamOn(v => !v)}
      >
        {camOn ? "Camera Off" : "Camera On"}
      </button>
      {!isSharing ? (
        <button className="px-3 py-2 rounded-xl bg-sky-700 text-white" onClick={onShareScreen}>
          Share Screen
        </button>
      ) : (
        <button className="px-3 py-2 rounded-xl bg-amber-700 text-white" onClick={onStopShare}>
          Stop Share
        </button>
      )}
      <button className="px-3 py-2 rounded-xl bg-rose-800 text-white" onClick={onLeave}>
        Leave
      </button>
    </div>
  );
}

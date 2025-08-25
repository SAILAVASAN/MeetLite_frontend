import { useEffect, useRef, useState } from "react";
import Controls from "./components/Controls";
import VideoTile from "./components/VideoTile";
import { initSocket } from "./lib/socket";
import {
  initWebRTC,
  getLocalStream,
  createOrGetPeer,
  setRemoteDescriptionSafely,
  addIceCandidateSafely,
  removePeer,
} from "./lib/webrtc";

export default function App() {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [peers, setPeers] = useState({});
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);

  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // peerId -> RTCPeerConnection

  useEffect(() => {
    if (!joined) return;

    console.log("🔌 Joining room:", roomId);
    const socket = initSocket();
    socketRef.current = socket;

    (async () => {
      // Get local cam/mic
      const stream = await initWebRTC();
      localStreamRef.current = stream;

      // ---- signaling handlers ----
      socket.on("peer-joined", async ({ peerId }) => {
        console.log("👤 Peer joined:", peerId);

        const pc = createOrGetPeer(peerId, (remoteStream) => {
          setPeers((prev) => ({ ...prev, [peerId]: { pc, stream: remoteStream } }));
          peersRef.current[peerId] = pc;
        });
        peersRef.current[peerId] = pc;

        // Caller: create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("signal", { target: peerId, signal: { sdp: pc.localDescription } });
      });

      socket.on("signal", async ({ from, signal }) => {
        console.log("📡 Signal from", from, signal);

        // Always ensure one pc per peer
        const pc = createOrGetPeer(from, (remoteStream) => {
          setPeers((prev) => ({ ...prev, [from]: { pc, stream: remoteStream } }));
          peersRef.current[from] = pc;
        });
        peersRef.current[from] = pc;

        if (signal.sdp) {
          await setRemoteDescriptionSafely(from, signal.sdp);
          if (signal.sdp.type === "offer") {
            // Callee: answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("signal", { target: from, signal: { sdp: pc.localDescription } });
          }
        } else if (signal.candidate) {
          await addIceCandidateSafely(from, signal.candidate);
        }
      });

      socket.on("peer-left", ({ peerId }) => {
        console.log("❌ Peer left:", peerId);
        removePeer(peerId);
        setPeers((prev) => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
        delete peersRef.current[peerId];
      });

      console.log("📡 Emitting join for room:", roomId);
      socket.emit("join", { roomId });
    })();

    return () => {
      console.log("🧹 Cleaning up...");
      try {
        socket.disconnect();
      } catch {}
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      Object.keys(peersRef.current).forEach((id) => removePeer(id));
      peersRef.current = {};
      setPeers({});
    };
  }, [joined, roomId]);

  // Mic toggle
  useEffect(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = micOn));
  }, [micOn]);

  // Camera toggle
  useEffect(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }, [camOn]);

  // Screen share
  const handleShareScreen = async () => {
    try {
      console.log("🖥️ Starting screen share...");
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });
      screenTrack.onended = () => handleStopShare();
      setIsSharing(true);
    } catch (err) {
      console.error("❌ Screen share error", err);
    }
  };

  const handleStopShare = () => {
    console.log("🛑 Stopping screen share...");
    const camTrack = getLocalStream().getVideoTracks()[0];
    Object.values(peersRef.current).forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) sender.replaceTrack(camTrack);
    });
    setIsSharing(false);
  };

  const handleLeave = () => {
    console.log("👋 Leaving room:", roomId);
  
    // Tell server
    socketRef.current?.emit("leave", { roomId });
  
    // Stop my local media
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
  
    // Close my peers
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    setPeers({});
  
    // Exit room UI
    setJoined(false);
  };
  if (!joined) {
    return (
      <div className="h-screen flex items-center justify-center flex-col gap-4">
        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="px-3 py-2 rounded-lg border text-black"
        />
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          onClick={() => roomId && setJoined(true)}
        >
          Join
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-900 text-white relative">
      <div className="grid grid-cols-3 gap-2 p-4">
        <VideoTile stream={localStreamRef.current} isLocal />
        {Object.entries(peers).map(([peerId, { stream }]) => (
          <VideoTile key={peerId} stream={stream} />
        ))}
      </div>

      <Controls
        micOn={micOn}
        setMicOn={setMicOn}
        camOn={camOn}
        setCamOn={setCamOn}
        isSharing={isSharing}
        onShareScreen={handleShareScreen}
        onStopShare={handleStopShare}
        onLeave={handleLeave}
      />
    </div>
  );
}
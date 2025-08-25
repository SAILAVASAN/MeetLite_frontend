// src/lib/webrtc.js
import { getSocket } from "./socket";

const ICE_SERVERS = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302"] },
    {
      urls: "turn:relay1.expressturn.com:3478",
      username: "efO8XQ995C6NTR8XA7",
      credential: "q4zPrbAEwJJH4720",
    },
  ],
};

let localStream = null;

/**
 * peersMap structure:
 * {
 *   [peerId]: {
 *     pc: RTCPeerConnection,
 *     queuedCandidates: RTCIceCandidateInit[],
 *     onTrack?: (MediaStream) => void
 *   }
 * }
 */
const peersMap = {};

export async function initWebRTC() {
  console.log("🎥 Requesting local media in webrtc.js...");
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  console.log("✅ Got local stream in webrtc.js:", localStream);
  return localStream;
}

export function getLocalStream() {
  return localStream;
}

export function createOrGetPeer(peerId, onTrack) {
  if (peersMap[peerId]) {
    return peersMap[peerId].pc;
  }

  console.log("🆕 Creating peer for:", peerId);
  const pc = new RTCPeerConnection(ICE_SERVERS);

  // add our tracks *once*
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.ontrack = (event) => {
    const stream = event.streams?.[0];
    console.log("📺 Remote stream from", peerId, stream);
    if (stream && peersMap[peerId]?.onTrack) {
      peersMap[peerId].onTrack(stream);
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("❄️ Sending ICE candidate to", peerId);
      getSocket().emit("signal", {
        target: peerId,
        signal: { candidate: event.candidate },
      });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`🔗 ${peerId} connectionState:`, pc.connectionState);
  };

  peersMap[peerId] = {
    pc,
    queuedCandidates: [],
    onTrack,
  };

  return pc;
}

export async function setRemoteDescriptionSafely(peerId, desc) {
  const wrp = peersMap[peerId];
  if (!wrp) throw new Error(`Peer ${peerId} not found`);
  const pc = wrp.pc;

  // Avoid applying SDP twice in stable state with same type
  if (pc.remoteDescription && pc.signalingState === "stable") {
    console.warn(`⚠️ setRemoteDescription skipped for ${peerId} (already stable).`);
    return;
  }

  console.log("📝 setRemoteDescription for", peerId, desc.type);
  await pc.setRemoteDescription(new RTCSessionDescription(desc));

  // Flush queued candidates
  if (wrp.queuedCandidates.length) {
    console.log(`📬 Flushing ${wrp.queuedCandidates.length} queued ICE candidates for`, peerId);
    for (const c of wrp.queuedCandidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.error("❌ addIceCandidate (flushed) failed:", e);
      }
    }
    wrp.queuedCandidates = [];
  }
}

export async function addIceCandidateSafely(peerId, candidate) {
  const wrp = peersMap[peerId];
  if (!wrp) {
    console.warn(`⚠️ Candidate for unknown peer ${peerId}, ignoring.`);
    return;
  }
  const pc = wrp.pc;

  if (pc.remoteDescription) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error("❌ Error adding ICE candidate", e);
    }
  } else {
    console.warn("⚠️ Remote description not set yet; queueing candidate for", peerId);
    wrp.queuedCandidates.push(candidate);
  }
}

export function removePeer(peerId) {
    const wrp = peersMap[peerId];
    if (!wrp) return;
  
    console.log("🔌 Closing peer:", peerId);
  
    try {
      wrp.pc.close();
    } catch (err) {
      console.error("Error closing peer:", err);
    }
  
    delete peersMap[peerId];
  }
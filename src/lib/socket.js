// src/lib/socket.js
import { io } from "socket.io-client";

let socket = null;

export function initSocket(serverUrl = "https://meetlite-0e1j.onrender.com") {
  if (!socket) {
    socket = io(serverUrl, {
      transports: ["websocket"],
    });
  }
  return socket;
}

export function getSocket() {
  if (!socket) {
    throw new Error("Socket not initialized. Call initSocket() first.");
  }
  return socket;
}

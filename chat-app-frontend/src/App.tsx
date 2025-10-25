/** @format */
import { useEffect, useRef, useState } from "react";

function App() {
  const ws = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8000");
    ws.current = socket;

    socket.onopen = () => {
      console.log("✅ Connection established");
      socket.send(
        JSON.stringify({
          type: "join",
          payload: {
            roomId: "red",
          },
        })
      );
    };

    socket.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "chat" && msg.payload?.message) {
          setMessages((prev) => [...prev, msg.payload.message]);
        }
      } catch {
        console.error("Received non-JSON message:", event.data);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
    };

    return () => {
      socket.close();
    };
  }, []);

  function sendMessage() {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && inputRef.current?.value) {
      const message = inputRef.current.value;
      ws.current.send(
        JSON.stringify({
          type: "chat",
          payload: {
            roomId: "red",
            message,
          },
        })
      );
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }

  return (
    <div className="h-screen w-full flex justify-center items-center bg-black">
      <div className="flex flex-col justify-between h-4/5 w-[90%] sm:w-3/5 md:w-2/5 bg-gray-900 rounded-3xl outline outline-amber-50">
        <div className="flex-grow text-white p-4 overflow-y-auto space-y-2">
          {messages.map((msg, idx) => (
            <div key={idx} className="bg-amber-600 p-2 rounded-xl w-fit">
              {msg}
            </div>
          ))}
        </div>

        <div className="flex w-full justify-center items-center gap-2 p-4 border-t border-gray-700">
          <input
            ref={inputRef}
            className="flex-grow p-2 bg-gray-700 text-white rounded-2xl border border-white outline-none focus:ring-2 focus:ring-amber-500"
            type="text"
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button
            className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl transition"
            onClick={sendMessage}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;

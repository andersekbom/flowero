import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Petal = {
  id: number;
  angle: number;
  color: string;
  payload: string;
};

export default function FlowerWithMQTT() {
  const [petals, setPetals] = useState<Petal[]>([]);
  const angleRef = useRef(0);
  const idRef = useRef(0);

  // Add a petal when a new MQTT message arrives
  const addPetal = (topic: string, payload: string) => {
    const id = idRef.current++;
    const angle = angleRef.current;
    angleRef.current = (angleRef.current + 30) % 360; // step 30° each time

    const color = topic.includes("temp")
      ? "#f97316" // orange
      : topic.includes("humidity")
      ? "#3b82f6" // blue
      : "#10b981"; // green default

    setPetals((prev) => [...prev, { id, angle, color, payload }]);

    // Auto-remove after 5s
    setTimeout(() => {
      setPetals((prev) => prev.filter((p) => p.id !== id));
    }, 5000);
  };

  // Connect WebSocket on mount
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8000/ws");

    socket.onopen = () => {
      console.log("✅ WebSocket connected");
    };

    socket.onmessage = (event) => {
      try {
        const { topic, payload } = JSON.parse(event.data);
        addPetal(topic, payload);
      } catch (err) {
        console.error("Bad WS message:", event.data);
      }
    };

    socket.onclose = () => {
      console.log("❌ WebSocket disconnected");
    };

    return () => socket.close();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <div className="relative w-[400px] h-[400px]">
        {/* Rotating container for petals */}
        <motion.div
          className="absolute top-1/2 left-1/2 w-full h-full -translate-x-1/2 -translate-y-1/2"
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        >
          <AnimatePresence>
            {petals.map((petal) => {
              const radius = 120;
              const rad = (petal.angle * Math.PI) / 180;
              const x = Math.cos(rad) * radius;
              const y = Math.sin(rad) * radius;

              return (
                <motion.div
                  key={petal.id}
                  className="absolute w-16 h-24 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{
                    top: "50%",
                    left: "50%",
                    backgroundColor: petal.color,
                    translateX: x - 32, // offset half width
                    translateY: y - 48, // offset half height
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  {petal.payload}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {/* Flower center stays fixed */}
        <div className="absolute top-1/2 left-1/2 w-14 h-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400 shadow-lg z-10" />
      </div>
    </div>
  );
}

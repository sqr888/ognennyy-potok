import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Огненный поток — тренажёр";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "white",
          fontFamily: "sans-serif",
          padding: "60px",
        }}
      >
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: "#f97316",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 90,
            marginBottom: 40,
          }}
        >
          🔥
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          Огненный поток
        </div>
        <div
          style={{
            fontSize: 32,
            color: "#94a3b8",
            textAlign: "center",
            maxWidth: 900,
          }}
        >
          Тренажёр для подготовки к сертификации
        </div>
      </div>
    ),
    { ...size }
  );
}
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#EA5A32",
        }}
      >
        <div style={{ display: "flex", gap: 28, marginTop: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#241C16" }} />
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#241C16" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}

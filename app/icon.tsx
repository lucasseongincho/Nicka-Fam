import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "50%",
        }}
      >
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#241C16" }} />
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#241C16" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}

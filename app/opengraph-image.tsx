import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#EFE6D8",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 420,
            height: 420,
            borderRadius: "45% 55% 60% 40% / 50% 45% 55% 50%",
            background: "#3F9DA6",
            opacity: 0.3,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: -60,
            width: 320,
            height: 320,
            borderRadius: "60% 40% 45% 55% / 45% 55% 40% 60%",
            background: "#EA5A32",
            opacity: 0.85,
          }}
        />

        <div
          style={{
            width: 190,
            height: 190,
            position: "relative",
            background: "#EA5A32",
            border: "6px solid #241C16",
            borderRadius: "42% 58% 55% 45% / 55% 45% 58% 42%",
            display: "flex",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 70,
              left: 52,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#241C16",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 70,
              right: 52,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#241C16",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 98,
              left: "50%",
              transform: "translateX(-50%)",
              width: 36,
              height: 18,
              borderRadius: "0 0 32px 32px",
              border: "5px solid #241C16",
              borderTop: "none",
            }}
          />
        </div>

        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            color: "#241C16",
            letterSpacing: -1,
          }}
        >
          nicka fam
        </div>
        <div
          style={{
            fontSize: 30,
            color: "rgba(36,28,22,0.65)",
            marginTop: 14,
          }}
        >
          the group that actually settles up
        </div>
      </div>
    ),
    { ...size },
  );
}

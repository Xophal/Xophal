import { ImageResponse } from "next/og";

export const alt = "Xophol exam preparation for CBSE and Assam Board students";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: "#F3F7FF",
          color: "#10264D",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "70%",
            flexDirection: "column",
            justifyContent: "center",
            padding: "64px 76px",
          }}
        >
          <div style={{ color: "#0B4CC2", fontSize: 52, fontWeight: 800 }}>Xophol</div>
          <div
            style={{
              marginTop: 10,
              color: "#0B4CC2",
              fontSize: 14,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Prepare today, achieve tomorrow
          </div>
          <div style={{ marginTop: 62, fontSize: 50, fontWeight: 800, lineHeight: 1.12 }}>
            Practice with purpose.
          </div>
          <div style={{ marginTop: 8, color: "#FF8A00", fontSize: 50, fontWeight: 800, lineHeight: 1.12 }}>
            Prepare with confidence.
          </div>
          <div style={{ marginTop: 26, color: "#3B567B", fontSize: 22 }}>
            Board-focused mock tests and progress for Class 9 &amp; 10
          </div>
        </div>
        <div
          style={{
            display: "flex",
            width: "30%",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 46,
            backgroundColor: "#0B4CC2",
          }}
        >
          <div style={{ width: 92, height: 8, backgroundColor: "#FF8A00" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ color: "#D9ECFF", fontSize: 20, fontWeight: 700 }}>CBSE</div>
            <div style={{ height: 1, width: 220, backgroundColor: "#D9ECFF" }} />
            <div style={{ color: "#D9ECFF", fontSize: 20, fontWeight: 700 }}>ASSAM BOARD</div>
          </div>
          <div style={{ color: "#FFFFFF", fontSize: 18, fontWeight: 600 }}>Learn. Practice. Progress.</div>
        </div>
      </div>
    ),
    size
  );
}
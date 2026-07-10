import { ImageResponse } from "next/og";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { computeSettlement } from "@/lib/settlement";
import type { Bill, Person, Round } from "@/lib/types";

export const runtime = "nodejs";

const WIDTH = 800;
const ROW_HEIGHT = 96;
const HEADER_HEIGHT = 260;
const FOOTER_HEIGHT = 90;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ billId: string }> },
) {
  const { billId } = await params;
  const origin = new URL(request.url).origin;

  const billSnap = await getDoc(doc(db, "bills", billId));
  if (!billSnap.exists()) {
    return new Response("bill not found", { status: 404 });
  }
  const bill = { id: billSnap.id, ...billSnap.data() } as Bill;

  const roundsSnap = await getDocs(
    query(collection(db, "bills", billId, "rounds"), orderBy("order")),
  );
  const rounds = roundsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as Round,
  );

  const peopleSnap = await getDocs(collection(db, "people"));
  const people = peopleSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as Person,
  );
  const personOf = (id: string) => people.find((p) => p.id === id);

  const transfers = computeSettlement(rounds);
  const height = HEADER_HEIGHT + transfers.length * ROW_HEIGHT + FOOTER_HEIGHT;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#FBF3E7",
          fontFamily: "sans-serif",
          padding: "48px 44px",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: "#EA5A32" }}>
          nicka fam
        </div>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#241C16", marginTop: 14 }}>
          {bill.title}
        </div>
        <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: "#241C16", marginTop: 18 }}>
          the damage 💸
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "rgba(36,28,22,0.55)", marginTop: 8, marginBottom: 28 }}>
          {transfers.length} {transfers.length === 1 ? "payment" : "payments"} closes it out
        </div>

        {transfers.map((t, i) => {
          const from = personOf(t.from);
          const to = personOf(t.to);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#FFFDF8",
                border: "2px solid #241C16",
                borderRadius: 16,
                padding: "16px 22px",
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", fontSize: 26, color: "#241C16" }}>
                {from && (
                  // eslint-disable-next-line @next/next/no-img-element -- ImageResponse (satori) renders its own image pipeline, not real DOM; next/image doesn't apply here
                  <img
                    src={`${origin}${from.photoUrl}`}
                    width={44}
                    height={44}
                    style={{ borderRadius: "50%", border: "2px solid #241C16", marginRight: 12 }}
                    alt=""
                  />
                )}
                <span>{from?.name ?? t.from}</span>
                <span style={{ margin: "0 14px", color: "#EA5A32" }}>→</span>
                {to && (
                  // eslint-disable-next-line @next/next/no-img-element -- ImageResponse (satori) renders its own image pipeline, not real DOM; next/image doesn't apply here
                  <img
                    src={`${origin}${to.photoUrl}`}
                    width={44}
                    height={44}
                    style={{ borderRadius: "50%", border: "2px solid #241C16", marginRight: 12 }}
                    alt=""
                  />
                )}
                <span>{to?.name ?? t.to}</span>
              </div>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#241C16" }}>
                ${t.amt}
              </div>
            </div>
          );
        })}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", paddingTop: 24 }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#241C16" }}>
            total ${bill.totalAmount}
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height },
  );
}

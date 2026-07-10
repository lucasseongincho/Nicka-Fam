import type { Round } from "@/lib/types";

export interface Transfer {
  from: string;
  to: string;
  amt: number;
}

/**
 * Splits each round evenly among its participants, except people marked
 * "didn't drink" for that round only pay 60% of an even share — the other
 * 40% (the "drink" portion) is redistributed across the round's drinkers.
 * Balances are then netted down to the minimum number of payments.
 */
export function computeSettlement(rounds: Round[]): Transfer[] {
  const balances: Record<string, number> = {};
  const touch = (id: string) => {
    if (!(id in balances)) balances[id] = 0;
  };

  rounds.forEach((r) => {
    const n = r.participantIds.length;
    if (n === 0) return;
    const even = r.amount / n;
    const nonDrinkers = r.participantIds.filter((p) =>
      r.noDrinkIds.includes(p),
    );
    const drinkers = r.participantIds.filter(
      (p) => !r.noDrinkIds.includes(p),
    );
    const nonShare = even * 0.6;
    const savedTotal = nonDrinkers.length * even * 0.4;
    const drinkerShare = drinkers.length
      ? (even * drinkers.length + savedTotal) / drinkers.length
      : even;

    touch(r.payerId);
    balances[r.payerId] += r.amount;

    r.participantIds.forEach((p) => {
      touch(p);
      const share = r.noDrinkIds.includes(p) ? nonShare : drinkerShare;
      balances[p] -= share;
    });
  });

  const creditors: { id: string; amt: number }[] = [];
  const debtors: { id: string; amt: number }[] = [];
  Object.entries(balances).forEach(([id, amt]) => {
    if (amt > 0.5) creditors.push({ id, amt });
    else if (amt < -0.5) debtors.push({ id, amt: -amt });
  });
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < creditors.length && j < debtors.length) {
    const c = creditors[i];
    const d = debtors[j];
    const amt = Math.round(Math.min(c.amt, d.amt));
    if (amt > 0) transfers.push({ from: d.id, to: c.id, amt });
    c.amt -= amt;
    d.amt -= amt;
    if (c.amt <= 0.5) i++;
    if (d.amt <= 0.5) j++;
  }
  return transfers;
}

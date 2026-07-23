import type { Round } from "@/lib/types";

export interface Transfer {
  from: string;
  to: string;
  amt: number;
}

/**
 * Bigger than float noise from the /0.6/0.4 division math (~1e-10) but
 * much smaller than the smallest genuine fractional-cent remainder a real
 * split can produce (at minimum 1/participantCount, e.g. 0.01 for a
 * 100-way split) -- nudges a value that *should* land exactly on an
 * integer cent, but is a hair under it due to float representation, back
 * onto that integer before flooring, without ever misclassifying a real
 * fractional remainder as noise.
 */
const CENT_EPSILON = 1e-6;

/**
 * Splits one round's amount (in integer cents) across its participants,
 * returning each participant's exact cent share -- shares always sum to
 * exactly `amountCents`, never a cent more or less, regardless of the
 * even-split remainder or the 60/40 no-drink adjustment.
 *
 * People marked "didn't drink" pay 60% of an even share; the other 40%
 * they'd have paid is redistributed evenly across the round's drinkers.
 * If *everyone* in the round opted out, there's no one to redistribute
 * onto, so the discount doesn't apply and it's a plain even split instead
 * -- otherwise 40% of the round would go uncollected from anyone, which
 * would make the payer look owed money they aren't actually owed.
 *
 * Rounding: each person's *ideal* (fractional-cent) share is computed
 * first, then floored to a whole cent. The leftover cents from flooring
 * (always a small non-negative integer -- one round's worth of
 * remainder, not a running total) go entirely to whoever paid the round,
 * per the user's call, since they're a participant in it -- if the payer
 * opted out of participating in their own round, there's no one obvious
 * to absorb it, so it falls back to the first participant(s) in list
 * order instead, one cent each.
 */
function splitRoundIntoCents(round: Round, amountCents: number): Record<string, number> {
  const n = round.participantIds.length;
  if (n === 0) return {};

  const nonDrinkers = round.participantIds.filter((p) => round.noDrinkIds.includes(p));
  const drinkers = round.participantIds.filter((p) => !round.noDrinkIds.includes(p));
  const applyDiscount = nonDrinkers.length > 0 && drinkers.length > 0;

  const evenCents = amountCents / n;
  let nonShareIdeal = evenCents;
  let drinkerShareIdeal = evenCents;
  if (applyDiscount) {
    nonShareIdeal = evenCents * 0.6;
    const savedTotal = nonDrinkers.length * evenCents * 0.4;
    drinkerShareIdeal = (evenCents * drinkers.length + savedTotal) / drinkers.length;
  }

  const flooredCents: Record<string, number> = {};
  let sumFloored = 0;
  for (const p of round.participantIds) {
    const ideal = applyDiscount && round.noDrinkIds.includes(p) ? nonShareIdeal : drinkerShareIdeal;
    const floor = Math.floor(ideal + CENT_EPSILON);
    flooredCents[p] = floor;
    sumFloored += floor;
  }

  let leftover = amountCents - sumFloored;
  if (leftover > 0) {
    if (round.participantIds.includes(round.payerId)) {
      flooredCents[round.payerId] += leftover;
    } else {
      for (const p of round.participantIds) {
        if (leftover <= 0) break;
        flooredCents[p] += 1;
        leftover -= 1;
      }
    }
  }

  return flooredCents;
}

/**
 * Splits each round evenly among its participants (see splitRoundIntoCents
 * for the 60/40 no-drink adjustment and cent-rounding rules), then nets
 * balances down to the minimum number of payments. All money math happens
 * in integer cents -- never floating-point dollars -- so balances and the
 * resulting transfers are always exact and sum to precisely what was put
 * in, with no rounding drift anywhere in the pipeline.
 */
export function computeSettlement(rounds: Round[]): Transfer[] {
  const balancesCents: Record<string, number> = {};
  const touch = (id: string) => {
    if (!(id in balancesCents)) balancesCents[id] = 0;
  };

  rounds.forEach((round) => {
    if (round.participantIds.length === 0) return;
    const amountCents = Math.round(round.amount * 100);

    touch(round.payerId);
    balancesCents[round.payerId] += amountCents;

    const shares = splitRoundIntoCents(round, amountCents);
    for (const [personId, shareCents] of Object.entries(shares)) {
      touch(personId);
      balancesCents[personId] -= shareCents;
    }
  });

  const creditors: { id: string; amt: number }[] = [];
  const debtors: { id: string; amt: number }[] = [];
  Object.entries(balancesCents).forEach(([id, amt]) => {
    if (amt > 0) creditors.push({ id, amt });
    else if (amt < 0) debtors.push({ id, amt: -amt });
  });
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < creditors.length && j < debtors.length) {
    const c = creditors[i];
    const d = debtors[j];
    const cents = Math.min(c.amt, d.amt);
    if (cents > 0) transfers.push({ from: d.id, to: c.id, amt: cents / 100 });
    c.amt -= cents;
    d.amt -= cents;
    if (c.amt <= 0) i++;
    if (d.amt <= 0) j++;
  }
  return transfers;
}

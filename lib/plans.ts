export type PlanId = "launch" | "studio" | "campaign";

export type CheckoutPlan = {
  id: PlanId;
  name: string;
  monthlyAmount: number;
  setupAmount: number;
  qrLimit: number;
  arLimit: number;
  description: string;
  features: string[];
};

export const checkoutPlans: Record<PlanId, CheckoutPlan> = {
  launch: {
    id: "launch",
    name: "Launch",
    monthlyAmount: 2900,
    setupAmount: 19900,
    qrLimit: 5,
    arLimit: 1,
    description: "Voor een eerste kaartje, sticker of kleine campagne.",
    features: ["5 permanente QR-codes", "1 AR logo ervaring", "QR download", "Basis analytics"]
  },
  studio: {
    id: "studio",
    name: "Studio",
    monthlyAmount: 7900,
    setupAmount: 39900,
    qrLimit: 25,
    arLimit: 25,
    description: "Voor merken die meerdere QR+AR ervaringen willen beheren.",
    features: ["25 QR/AR ervaringen", "3D logo editor", "Eigen CTA en bestemming", "Uitgebreide AR analytics"]
  },
  campaign: {
    id: "campaign",
    name: "Campaign",
    monthlyAmount: 24900,
    setupAmount: 99900,
    qrLimit: 75,
    arLimit: 75,
    description: "Voor events, retail, verpakkingen en grotere activaties.",
    features: ["Campagne templates", "Meerdere visuals", "Prioritaire setup", "Rapportage per QR-code"]
  }
};

export function isPlanId(value: string | null | undefined): value is PlanId {
  return value === "launch" || value === "studio" || value === "campaign";
}

export function getCheckoutPlan(value: string | null | undefined) {
  return isPlanId(value) ? checkoutPlans[value] : checkoutPlans.studio;
}

export function formatEuroCents(amount: number) {
  return `EUR ${Math.round(amount / 100).toLocaleString("nl-BE")}`;
}

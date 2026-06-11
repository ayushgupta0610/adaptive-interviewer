"use client";
import { Button, Card } from "@/components/ui";
import { apiCheckout } from "@/lib/api";

interface PaywallProps {
  reason: string;
}

export default function Paywall({ reason }: PaywallProps) {
  async function buy(planId: "starter" | "pro") {
    const { url } = await apiCheckout(planId);
    window.location.href = url;
  }

  const caption =
    reason === "quota_exceeded"
      ? "You've used this month's sessions."
      : reason === "text_daily_cap"
        ? "You've used today's free text sessions."
        : "Your free trial is used up.";

  return (
    <Card className="mx-auto max-w-md p-8 text-center">
      <h2 className="mb-2 text-lg font-semibold">Upgrade to keep practising</h2>
      <p className="mb-6 text-sm text-slate-500">{caption}</p>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button variant="secondary" onClick={() => void buy("starter")}>
          Starter ₹999 / mo
        </Button>
        <Button onClick={() => void buy("pro")}>Pro ₹1,999 / mo</Button>
      </div>
    </Card>
  );
}

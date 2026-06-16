"use client";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Hero from "./Hero";
import HowItWorks from "./HowItWorks";
import ScorecardCarousel from "./ScorecardCarousel";
import Features from "./Features";
import Pricing from "./Pricing.tsx";
import FinalCta from "./FinalCta";

function startGoogle() {
  supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
}

/** Public marketing page shown to signed-out visitors. CTAs trigger Google OAuth. */
export default function Landing() {
  return (
    <div className="flex-1">
      <Hero onStart={startGoogle} />
      <HowItWorks />
      <section className="mx-auto w-full max-w-5xl px-6 py-12">
        <ScorecardCarousel />
      </section>
      <Features />
      <Pricing onFree={startGoogle} />
      <FinalCta onStart={startGoogle} />
    </div>
  );
}

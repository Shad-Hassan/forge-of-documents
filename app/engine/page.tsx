import { Cinzel_Decorative, JetBrains_Mono } from "next/font/google";
import Engine from "@/components/engine/Engine";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-forge-mono" });
const display = Cinzel_Decorative({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-forge-display" });

export const metadata = {
  title: "Engine of Artifact · Forge of Documents II",
};

export default function EnginePage() {
  return (
    <div className={`${mono.variable} ${display.variable}`} style={{ fontFamily: "var(--font-forge-mono), monospace" }}>
      <Engine />
    </div>
  );
}

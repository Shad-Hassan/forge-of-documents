import { Cinzel_Decorative, JetBrains_Mono } from "next/font/google";
import Chat from "@/components/chat/Chat";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-forge-mono" });
const display = Cinzel_Decorative({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-forge-display" });

export const metadata = { title: "Chat · Forge of Documents II" };

export default function ChatPage() {
  return (
    <div className={`${mono.variable} ${display.variable}`} style={{ fontFamily: "var(--font-forge-mono), monospace" }}>
      <Chat />
    </div>
  );
}

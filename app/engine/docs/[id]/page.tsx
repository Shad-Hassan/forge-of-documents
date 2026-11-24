import { Suspense } from "react";
import { Cinzel_Decorative, JetBrains_Mono } from "next/font/google";
import DocEditor from "@/components/engine/DocEditor";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-forge-mono" });
const display = Cinzel_Decorative({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-forge-display" });

export const metadata = { title: "Editor · Forge of Documents II" };

// cacheComponents: params are runtime data, so they are read inside a Suspense boundary.
async function EditorForParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocEditor id={id} />;
}

export default function DocEditorPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className={`${mono.variable} ${display.variable}`} style={{ fontFamily: "var(--font-forge-mono), monospace", minHeight: "100vh", background: "#0b0f1a" }}>
      <Suspense fallback={<p style={{ color: "#d1cac0", padding: 40, margin: 0 }}>Loading…</p>}>
        <EditorForParams params={params} />
      </Suspense>
    </div>
  );
}

"use client";

import { useState } from "react";
import { documentTypes, DocumentType } from "@/lib/config";

type GenerationState = "idle" | "generating" | "done" | "error";

const STATE_LABEL: Record<GenerationState, string> = {
  idle: "Idle",
  generating: "Generating",
  done: "Done",
  error: "Error",
};

// Bento tile: sharp corners, void surface, slate line only as a border.
const tile = "flex flex-col border border-slate-line bg-void-800 p-6";
const eyebrow = "mb-4 font-mono text-xs uppercase tracking-[0.2em] text-ivory-70";
const input =
  "w-full border border-slate-line bg-void-700 px-3 py-2 text-ivory-100 placeholder:text-ivory-70 focus:border-bronze-600 focus:outline-none";
const primaryBtn =
  "bg-bronze-600 px-4 py-3 font-semibold text-void-900 transition hover:brightness-110 disabled:bg-void-600 disabled:text-ivory-70";
const secondaryBtn =
  "border border-slate-line bg-void-700 px-3 py-1.5 text-sm text-ivory-100 transition hover:border-bronze-600";

export default function DocumentGenerator() {
  const [selectedType, setSelectedType] = useState<DocumentType>("email");
  const [dials, setDials] = useState<Record<string, string | number>>({});
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [state, setState] = useState<GenerationState>("idle");
  const [error, setError] = useState<string>("");
  const [tokensUsed, setTokensUsed] = useState<number>(0);

  const config = documentTypes[selectedType];
  const typeKeys = Object.keys(documentTypes) as DocumentType[];

  const handleDialChange = (key: string, value: string | number) => {
    setDials((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = async () => {
    setState("generating");
    setError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: selectedType,
          dials,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Generation failed");
      }

      const data = await response.json();
      setGeneratedContent(data.content);
      setTokensUsed(data.metadata.tokensUsed);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
  };

  const handleTypeChange = (type: DocumentType) => {
    setSelectedType(type);
    setDials({});
    setGeneratedContent("");
    setState("idle");
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([generatedContent], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${selectedType}-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-void-900 p-4 text-ivory-100 md:p-6 xl:p-8">
      <div className="mx-auto max-w-screen-2xl">
        {/* Bento grid: 1 col mobile, 2 cols md, 12 cols xl (desktop) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
          {/* Header tile */}
          <header className="col-span-full grid border border-slate-line bg-void-800 md:grid-cols-[1fr_auto] xl:grid-cols-12">
            <div className="p-6 xl:col-span-8 xl:p-8">
              <p className={eyebrow}>Forge of Documents</p>
              <h1 className="text-3xl font-bold text-ivory-100 xl:text-4xl">
                Document Generator
              </h1>
              <p className="mt-2 text-ivory-82">
                Generate documents with precise, configurable dials.
              </p>
            </div>
            <dl className="grid grid-cols-3 border-t border-slate-line md:border-t-0 md:border-l xl:col-span-4">
              <div className="p-6 xl:p-8">
                <dt className={eyebrow}>Types</dt>
                <dd className="text-2xl font-bold text-ivory-100">{typeKeys.length}</dd>
              </div>
              <div className="border-l border-slate-line p-6 xl:p-8">
                <dt className={eyebrow}>State</dt>
                <dd className="text-2xl font-bold text-bronze-600">{STATE_LABEL[state]}</dd>
              </div>
              <div className="border-l border-slate-line p-6 xl:p-8">
                <dt className={eyebrow}>Tokens</dt>
                <dd className="text-2xl font-bold text-ivory-100">{tokensUsed}</dd>
              </div>
            </dl>
          </header>

          {/* Left column: controls as stacked tiles on xl */}
          <div className="grid gap-4 md:col-span-2 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
            {/* Document type tile */}
            <section className={tile}>
              <h2 className={eyebrow}>Document Type</h2>
              <div className="grid gap-2">
                {typeKeys.map((type) => {
                  const active = selectedType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => handleTypeChange(type)}
                      aria-pressed={active}
                      className={`border-l-4 px-4 py-3 text-left transition ${
                        active
                          ? "border-l-bronze-600 bg-void-700 text-ivory-100"
                          : "border-l-slate-line bg-void-900 text-ivory-82 hover:bg-void-700"
                      }`}
                    >
                      <div className="font-semibold">{documentTypes[type].name}</div>
                      <div className="mt-1 text-sm text-ivory-70">
                        {documentTypes[type].description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Dials tile */}
            <section className={tile}>
              <h2 className={eyebrow}>Dials</h2>
              <div className="grid gap-5">
                {config.dials.map((dial) => (
                  <div key={dial.key}>
                    <label className="mb-2 block text-sm font-medium text-ivory-82">
                      {dial.name}
                    </label>

                    {dial.type === "select" && dial.options && (
                      <select
                        value={dials[dial.key] || dial.default || ""}
                        onChange={(e) => handleDialChange(dial.key, e.target.value)}
                        className={input}
                      >
                        <option value="">Select...</option>
                        {dial.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}

                    {dial.type === "text" && (
                      <input
                        type="text"
                        placeholder={dial.placeholder}
                        value={dials[dial.key] || ""}
                        onChange={(e) => handleDialChange(dial.key, e.target.value)}
                        className={input}
                      />
                    )}

                    {dial.type === "number" && (
                      <input
                        type="number"
                        value={dials[dial.key] || dial.default || ""}
                        onChange={(e) => handleDialChange(dial.key, e.target.value)}
                        className={input}
                      />
                    )}

                    {dial.type === "slider" && (
                      <input
                        type="range"
                        min={dial.min || 0}
                        max={dial.max || 100}
                        value={dials[dial.key] || dial.default || 50}
                        onChange={(e) => handleDialChange(dial.key, parseInt(e.target.value))}
                        className="w-full accent-bronze-600"
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Action tile */}
            <section className={`${tile} md:col-span-2 xl:col-span-1`}>
              <h2 className={eyebrow}>Generate</h2>
              <button
                onClick={handleGenerate}
                disabled={state === "generating"}
                className={primaryBtn}
              >
                {state === "generating" ? "Generating..." : "Generate Document"}
              </button>

              {error && (
                <div
                  role="alert"
                  className="mt-4 border-l-4 border-l-ember-500 bg-void-900 p-3 text-sm text-ivory-100"
                >
                  {error}
                </div>
              )}
            </section>
          </div>

          {/* Output tile: the dominant bento cell on xl */}
          <section className={`${tile} md:col-span-2 xl:col-span-8 xl:min-h-[44rem]`}>
            {generatedContent ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-4 border-b border-slate-line pb-4">
                  <p className="font-mono text-sm text-ivory-82">{tokensUsed} tokens used</p>
                  <div className="flex gap-2">
                    <button onClick={handleCopy} className={secondaryBtn}>
                      Copy
                    </button>
                    <button onClick={handleDownload} className={`${primaryBtn} px-3 py-1.5 text-sm`}>
                      Download
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto">
                  <p className="whitespace-pre-wrap leading-relaxed text-ivory-100">
                    {generatedContent}
                  </p>
                </div>
              </>
            ) : state === "generating" ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                <div className="h-12 w-12 animate-spin border-2 border-slate-line border-t-bronze-600" />
                <p className="text-ivory-82">Generating document...</p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <p className="max-w-sm text-ivory-82">
                  Configure your dials and click Generate to create a document.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { documentTypes, DocumentType } from "@/lib/config";

type GenerationState = "idle" | "generating" | "done" | "error";

export default function DocumentGenerator() {
  const [selectedType, setSelectedType] = useState<DocumentType>("email");
  const [dials, setDials] = useState<Record<string, string | number>>({});
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [state, setState] = useState<GenerationState>("idle");
  const [error, setError] = useState<string>("");
  const [tokensUsed, setTokensUsed] = useState<number>(0);

  const config = documentTypes[selectedType];

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-ivory-100 mb-2">
            Forge of Documents
          </h1>
          <p className="text-slate-400">
            Generate documents with precise, configurable dials
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-ivory-100 mb-4">
                Document Type
              </h2>

              {/* Type Selector */}
              <div className="space-y-2 mb-6">
                {(Object.keys(documentTypes) as DocumentType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    className={`w-full text-left px-4 py-2 rounded border transition ${
                      selectedType === type
                        ? "bg-bronze-600 border-bronze-500 text-ivory-100"
                        : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    <div className="font-medium">{documentTypes[type].name}</div>
                    <div className="text-xs opacity-75">
                      {documentTypes[type].description}
                    </div>
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-700 pt-6">
                <h3 className="text-sm font-semibold text-ivory-100 mb-4">
                  Dials
                </h3>

                {/* Dials */}
                <div className="space-y-4">
                  {config.dials.map((dial) => (
                    <div key={dial.key}>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        {dial.name}
                      </label>

                      {dial.type === "select" && dial.options && (
                        <select
                          value={dials[dial.key] || dial.default || ""}
                          onChange={(e) =>
                            handleDialChange(dial.key, e.target.value)
                          }
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-ivory-100 rounded focus:border-bronze-500 focus:outline-none"
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
                          onChange={(e) =>
                            handleDialChange(dial.key, e.target.value)
                          }
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-ivory-100 rounded placeholder-slate-500 focus:border-bronze-500 focus:outline-none"
                        />
                      )}

                      {dial.type === "number" && (
                        <input
                          type="number"
                          value={dials[dial.key] || dial.default || ""}
                          onChange={(e) =>
                            handleDialChange(dial.key, e.target.value)
                          }
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-ivory-100 rounded focus:border-bronze-500 focus:outline-none"
                        />
                      )}

                      {dial.type === "slider" && (
                        <input
                          type="range"
                          min={dial.min || 0}
                          max={dial.max || 100}
                          value={dials[dial.key] || dial.default || 50}
                          onChange={(e) =>
                            handleDialChange(dial.key, parseInt(e.target.value))
                          }
                          className="w-full"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={state === "generating"}
                className="w-full mt-6 px-4 py-3 bg-bronze-600 hover:bg-bronze-700 disabled:bg-slate-600 text-ivory-100 font-semibold rounded transition"
              >
                {state === "generating" ? "Generating..." : "Generate Document"}
              </button>

              {error && (
                <div className="mt-4 p-3 bg-red-900 border border-red-700 text-red-100 rounded text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Output Panel */}
          <div className="lg:col-span-2">
            {state === "idle" && !generatedContent && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
                <p className="text-slate-400">
                  Configure your dials and click Generate to create a document.
                </p>
              </div>
            )}

            {state === "generating" && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
                <div className="inline-block">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bronze-600"></div>
                </div>
                <p className="text-slate-400 mt-4">Generating document...</p>
              </div>
            )}

            {generatedContent && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden flex flex-col h-full">
                {/* Toolbar */}
                <div className="bg-slate-700 border-b border-slate-600 px-6 py-3 flex justify-between items-center">
                  <div className="text-sm text-slate-400">
                    {tokensUsed} tokens used
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-slate-100 rounded text-sm transition"
                    >
                      Copy
                    </button>
                    <button
                      onClick={handleDownload}
                      className="px-3 py-1 bg-bronze-600 hover:bg-bronze-700 text-ivory-100 rounded text-sm transition"
                    >
                      Download
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-auto flex-1">
                  <div className="prose prose-invert max-w-none">
                    <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {generatedContent}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

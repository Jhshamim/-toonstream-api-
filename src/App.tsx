/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ToonStream Scraper & Diagnostic Proxy Client
 */

import React, { useState, useEffect, useRef } from "react";
import { Loader2, Send, Play, Shield, Globe, Info, CheckCircle, AlertTriangle, HelpCircle, Activity, Copy, Check } from "lucide-react";
import Hls from "hls.js";

type TabType = "endpoints" | "player" | "probe";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("endpoints");

  // Endpoint Tester State
  const [endpoint, setEndpoint] = useState("/api/search");
  const [query, setQuery] = useState("");
  const [season, setSeason] = useState("1");
  const [selectedServer, setSelectedServer] = useState("hd-1");
  const [selectedLang, setSelectedLang] = useState("hin");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);

  // Player State
  const [playerUrl, setPlayerUrl] = useState("");
  const [playbackMode, setPlaybackMode] = useState<"proxied" | "direct">("proxied");
  const [customReferer, setCustomReferer] = useState("");
  const [customOrigin, setCustomOrigin] = useState("");
  const [isPlayingStream, setIsPlayingStream] = useState(false);
  const [activeStreamUrl, setActiveStreamUrl] = useState("");
  const [playerType, setPlayerType] = useState<"hls" | "iframe">("hls");
  const [activeIframeUrl, setActiveIframeUrl] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Diagnostic Probe State
  const [probeUrl, setProbeUrl] = useState("");
  const [probing, setProbing] = useState(false);
  const [probeResults, setProbeResults] = useState<any[] | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Auto-fill states helper
  const handleUseInPlayer = (url: string) => {
    setPlayerType("hls");
    setPlayerUrl(url);
    setProbeUrl(url);
    setActiveTab("player");
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => {
      setCopiedUrl(null);
    }, 2000);
  };

  const handlePlayHlsStream = (url: string, mode: "proxied" | "direct" = "proxied") => {
    setPlayerType("hls");
    setPlayerUrl(url);
    setPlaybackMode(mode);
    setIsPlayingStream(true);
    setProbeUrl(url);
    
    if (mode === "proxied") {
      let proxiedUrl = url;
      if (!url.includes("/api/proxy/stream")) {
        proxiedUrl = `/api/proxy/stream?url=${encodeURIComponent(url)}`;
        if (customReferer.trim()) proxiedUrl += `&referer=${encodeURIComponent(customReferer.trim())}`;
        if (customOrigin.trim()) proxiedUrl += `&origin=${encodeURIComponent(customOrigin.trim())}`;
      }
      setActiveStreamUrl(proxiedUrl);
    } else {
      setActiveStreamUrl(url);
    }
    setActiveTab("player");
  };

  const handlePlayIframeStream = (url: string) => {
    setPlayerType("iframe");
    setPlayerUrl(url);
    setActiveIframeUrl(url);
    setIsPlayingStream(true);
    setProbeUrl(url);
    setActiveTab("player");
  };

  const handleUseInProbe = (url: string) => {
    setProbeUrl(url);
    setActiveTab("probe");
  };

  // HLS Player Binding
  useEffect(() => {
    if (isPlayingStream && activeStreamUrl && videoRef.current) {
      // Clean up previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;

        hls.loadSource(activeStreamUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error("Fatal network error in Hls.js, trying to recover...", data);
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error("Fatal media error in Hls.js, trying to recover...", data);
                hls.recoverMediaError();
                break;
              default:
                console.error("Unrecoverable Hls.js error:", data);
                break;
            }
          }
        });

        return () => {
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
        };
      } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
        videoRef.current.src = activeStreamUrl;
      }
    }
  }, [isPlayingStream, activeStreamUrl]);

  // Handle Endpoint Submission
  const handleEndpointSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResponse(null);

    let url = "";
    let method = "GET";
    let body = undefined;

    if (endpoint === "/api/search") {
      url = `/api/search?q=${encodeURIComponent(query)}`;
    } else if (endpoint === "/api/info") {
      url = `/api/info?id=${encodeURIComponent(query)}`;
    } else if (endpoint === "/api/episodes") {
      url = `/api/episodes?id=${encodeURIComponent(query)}&se=${encodeURIComponent(season)}`;
    } else if (endpoint === "/api/stream") {
      url = `/api/stream?id=${encodeURIComponent(query)}&server=${encodeURIComponent(selectedServer)}&lang=${encodeURIComponent(selectedLang)}`;
    } else if (endpoint === "/api/extract-stream") {
      url = "/api/extract-stream";
      method = "POST";
      body = JSON.stringify({ url: query });
    } else if (endpoint === "/api/proxy/stream") {
      url = `/api/proxy/stream?url=${encodeURIComponent(query)}`;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body
      });
      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        data = { success: res.ok, status: res.status, text: await res.text() };
      }
      setResponse(data);
    } catch (err: any) {
      setResponse({
        success: false,
        error: "Network error occurred",
        details: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Player Stream Launch
  const handlePlayStream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerUrl.trim()) return;

    setIsPlayingStream(true);

    if (playerType === "iframe") {
      setActiveIframeUrl(playerUrl);
    } else {
      if (playbackMode === "proxied") {
        // Build proxied stream URL with optional custom referer/origin parameters
        let proxiedUrl = `/api/proxy/stream?url=${encodeURIComponent(playerUrl)}`;
        if (customReferer.trim()) proxiedUrl += `&referer=${encodeURIComponent(customReferer.trim())}`;
        if (customOrigin.trim()) proxiedUrl += `&origin=${encodeURIComponent(customOrigin.trim())}`;
        setActiveStreamUrl(proxiedUrl);
      } else {
        setActiveStreamUrl(playerUrl);
      }
    }
  };

  // Handle Self-Healing Header Probe Run
  const handleRunProbe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!probeUrl.trim()) return;

    setProbing(true);
    setProbeResults(null);
    setProbeError(null);

    try {
      const res = await fetch(`/api/proxy/probe?url=${encodeURIComponent(probeUrl.trim())}`);
      const data = await res.json();
      if (data.success && data.results) {
        setProbeResults(data.results);
      } else {
        setProbeError(data.error || "Failed to execute diagnostic probe.");
      }
    } catch (err: any) {
      setProbeError(`Network error executing probe: ${err.message}`);
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans p-4 sm:p-8 flex flex-col">
      <div className="max-w-6xl mx-auto space-y-6 w-full flex-1 flex flex-col">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-5">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span className="bg-blue-600 px-3 py-1 rounded-lg text-sm font-semibold uppercase tracking-widest text-blue-100">
                ToonStream Pro
              </span>
              Media Diagnostic Suite
            </h1>
            <p className="text-gray-400 text-sm">
              Advanced HLS Stream Player, Self-Healing Proxies, and HTTP Header Bypass Diagnostics.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-gray-900/50 p-1.5 rounded-xl border border-gray-800 self-start">
            <button
              onClick={() => setActiveTab("endpoints")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "endpoints" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white"}`}
            >
              API Tester
            </button>
            <button
              onClick={() => setActiveTab("player")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "player" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white"}`}
            >
              HLS Player
            </button>
            <button
              onClick={() => setActiveTab("probe")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "probe" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white"}`}
            >
              Header Prober
            </button>
          </div>
        </div>

        {/* Tab content: 1. Endpoints */}
        {activeTab === "endpoints" && (
          <div className="space-y-6 animate-fade-in">
            <form onSubmit={handleEndpointSubmit} className="flex flex-col lg:flex-row gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800 items-stretch lg:items-center">
              <select 
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none min-w-[220px] font-medium"
              >
                <option value="/api/search">GET /api/search?q=</option>
                <option value="/api/info">GET /api/info?id=</option>
                <option value="/api/episodes">GET /api/episodes?id=&se=</option>
                <option value="/api/stream">GET /api/stream?id=</option>
                <option value="/api/extract-stream">POST /api/extract-stream</option>
                <option value="/api/proxy/stream">GET /api/proxy/stream?url=</option>
              </select>
              
              <div className="flex-1 flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    endpoint === "/api/search" 
                      ? "Enter search keywords (e.g., Simpsons, Batman)..." 
                      : endpoint === "/api/info"
                      ? "Enter show or movie ID..."
                      : endpoint === "/api/episodes"
                      ? "Enter show ID..."
                      : endpoint === "/api/extract-stream"
                      ? "Enter iframe embed URL (e.g., as-cdn, vixcloud)..."
                      : "Enter direct stream URL (M3U8) to proxy..."
                  }
                  className="flex-1 bg-gray-800 border border-gray-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                />

                {endpoint === "/api/episodes" && (
                  <input
                    type="text"
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    placeholder="Season"
                    className="w-full sm:w-28 bg-gray-800 border border-gray-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  />
                )}

                {endpoint === "/api/stream" && (
                  <>
                    <select
                      value={selectedServer}
                      onChange={(e) => setSelectedServer(e.target.value)}
                      className="bg-gray-800 border border-gray-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="hd-1">Play (hd-1)</option>
                      <option value="hd-2">Cloudy (hd-2)</option>
                      <option value="hd-3">Turbo (hd-3)</option>
                    </select>
                    <select
                      value={selectedLang}
                      onChange={(e) => setSelectedLang(e.target.value)}
                      className="bg-gray-800 border border-gray-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="hin">Hindi (hin)</option>
                      <option value="eng">English (eng)</option>
                      <option value="jap">Japanese (jap)</option>
                    </select>
                  </>
                )}
              </div>
              
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-gray-400 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Send Request
              </button>
            </form>

            {response && (
              <div className="bg-[#111] rounded-xl border border-gray-800 overflow-hidden shadow-xl flex-1 flex flex-col">
                <div className="bg-gray-900 px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                  <span className="text-sm font-mono text-gray-400">Response Console</span>
                  <div className="flex items-center gap-2">
                    {response.success !== false && response.results && response.results.length > 0 && (
                      <span className="text-xs bg-blue-950 text-blue-400 border border-blue-900 px-2.5 py-0.5 rounded">
                        {response.results.length} items found
                      </span>
                    )}
                    {response.url && (
                      <button
                        onClick={() => handleUseInPlayer(response.url)}
                        className="text-xs bg-green-950 text-green-400 border border-green-900 hover:bg-green-900/40 px-2.5 py-1 rounded transition-colors flex items-center gap-1 font-mono"
                      >
                        <Play size={12} /> Play Stream
                      </button>
                    )}
                    <span className={`text-xs px-2.5 py-1 rounded font-mono ${response.success !== false && !response.error ? 'bg-green-950 text-green-400 border border-green-900' : 'bg-red-950 text-red-400 border border-red-900'}`}>
                      {response.success !== false && !response.error ? '200 OK' : 'Error'}
                    </span>
                  </div>
                </div>
                
                {/* Result Quick Actions */}
                {response.results && response.results.length > 0 && (
                  <div className="border-b border-gray-800 bg-gray-900/30 p-3 flex flex-wrap gap-2 max-h-44 overflow-y-auto">
                    {response.results.map((item: any, i: number) => (
                      <div key={i} className="bg-gray-800/80 rounded-lg p-2 border border-gray-700/60 flex items-center gap-3 text-xs w-full sm:w-[48%] lg:w-[32%]">
                        {item.image && (
                          <img src={item.image} alt="" className="w-10 h-10 object-cover rounded bg-gray-950 shrink-0" referrerPolicy="no-referrer" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{item.title}</p>
                          <p className="text-gray-400 font-mono truncate">{item.id}</p>
                        </div>
                        <button
                          onClick={() => {
                            setQuery(item.id);
                            setEndpoint("/api/info");
                          }}
                          className="text-blue-400 hover:text-white font-medium shrink-0 bg-blue-950/40 hover:bg-blue-900 px-2 py-1 rounded"
                        >
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Info Endpoint Scraped Rich Details */}
                {response.data && response.data.title && (
                  <div className="border-b border-gray-800 bg-gray-950 p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      {response.data.posterImage && (
                        <img 
                          src={response.data.posterImage} 
                          alt={response.data.title} 
                          className="w-24 h-36 object-cover rounded border border-gray-800 bg-black shrink-0 shadow"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="flex-1 space-y-2">
                        <span className="text-[10px] bg-blue-900/40 border border-blue-900 text-blue-300 px-2 py-0.5 rounded uppercase font-semibold font-mono tracking-wider">
                          {response.data.type || "Show"} Metadata
                        </span>
                        <h3 className="text-xl font-bold text-white leading-tight mt-1">{response.data.title}</h3>
                        <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed">{response.data.description}</p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {Object.entries(response.data.metadata || {}).map(([key, val]) => (
                            <span key={key} className="text-[10px] bg-gray-900 border border-gray-800 text-gray-400 px-2 py-0.5 rounded uppercase font-mono">
                              {key.replace("_", " ")}: {val as string}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Seasons Selector */}
                    {response.data.seasons && response.data.seasons.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-gray-900">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Browse Seasons</p>
                        <div className="flex flex-wrap gap-2">
                          {response.data.seasons.map((s: any) => (
                            <button
                              key={s.seasonNumber}
                              onClick={async () => {
                                setQuery(response.id);
                                setSeason(s.seasonNumber);
                                setEndpoint("/api/episodes");
                                // Automatically fetch episodes
                                setLoading(true);
                                setResponse(null);
                                try {
                                  const res = await fetch(`/api/episodes?id=${encodeURIComponent(response.id)}&se=${encodeURIComponent(s.seasonNumber)}`);
                                  const data = await res.json();
                                  setResponse(data);
                                } catch (err: any) {
                                  setResponse({ success: false, error: err.message });
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="text-xs bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 border border-blue-900/60 px-3 py-1.5 rounded-lg transition-all font-medium"
                            >
                              {s.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Movie Servers List */}
                    {response.data.servers && response.data.servers.length > 0 && (
                      <div className="space-y-2 pt-3 border-t border-gray-900">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Select Movie Server</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {response.data.servers.map((srv: any, idx: number) => (
                            <div key={idx} className="bg-gray-900 p-3 rounded-lg border border-gray-800/80 space-y-2 flex flex-col justify-between">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-white">{srv.name} (Option {srv.number})</span>
                                <span className="text-[9px] bg-gray-800 border border-gray-750 px-2 py-0.5 rounded text-gray-400 font-mono font-semibold">
                                  {srv.streamUrl ? "HLS Streaming Ready" : "Embedded Player Only"}
                                </span>
                              </div>
                              {(srv.name.toLowerCase().includes("moly") || srv.name.toLowerCase().includes("mirror") || srv.name.toLowerCase().includes("gd")) && (
                                <div className="text-[10px] text-yellow-400 font-medium bg-yellow-500/10 border border-yellow-500/20 p-2 rounded leading-normal">
                                  ⚠️ This server restricts cloud endpoints. If HLS players fail, play with the <b className="text-purple-300">Iframe Player</b> which runs directly in your browser.
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {srv.streamUrl && (
                                  <>
                                    <button
                                      onClick={() => handlePlayHlsStream(srv.streamUrl, "proxied")}
                                      className="text-[10px] bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-900 px-2 py-1 rounded transition-colors font-bold flex items-center gap-1"
                                    >
                                      <Shield size={10} /> HLS (Proxied)
                                    </button>
                                    <button
                                      onClick={() => handlePlayHlsStream(srv.streamUrl, "direct")}
                                      className="text-[10px] bg-blue-950 hover:bg-blue-900 text-blue-400 border border-blue-900 px-2 py-1 rounded transition-colors font-bold flex items-center gap-1"
                                    >
                                      <Globe size={10} /> HLS (Direct)
                                    </button>
                                  </>
                                )}
                                {srv.iframeUrl && (
                                  <button
                                    onClick={() => handlePlayIframeStream(srv.iframeUrl)}
                                    className="text-[10px] bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-900 px-2 py-1 rounded transition-colors font-bold flex items-center gap-1"
                                  >
                                    <Play size={10} /> Iframe Player
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Episodes List Scraped Details */}
                {response.episodes && response.episodes.length > 0 && (
                  <div className="border-b border-gray-800 bg-gray-950 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-900 pb-2">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        Season {response.season || "1"} Episodes List
                      </p>
                      <span className="text-[10px] bg-gray-900 text-gray-500 border border-gray-800 px-2 py-0.5 rounded font-mono font-bold">
                        {response.episodes.length} Episodes Scraped
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                      {response.episodes.map((ep: any, i: number) => (
                        <div key={i} className="bg-gray-900 p-2 rounded-lg border border-gray-800/80 flex items-center gap-3">
                          {ep.image ? (
                            <img 
                              src={ep.image} 
                              alt="" 
                              className="w-16 h-11 object-cover rounded bg-black shrink-0 border border-gray-850"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-16 h-11 rounded bg-gray-950 border border-gray-850 shrink-0 flex items-center justify-center text-[10px] font-mono font-extrabold text-gray-500">
                              EP {ep.episodeNumber}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate leading-tight">Episode {ep.episodeNumber}</p>
                            <p className="text-[10px] text-gray-400 truncate leading-snug mt-0.5">{ep.title || "No Title"}</p>
                          </div>
                          <button
                            onClick={async () => {
                              setQuery(ep.id);
                              setEndpoint("/api/stream");
                              // Automatically fetch stream servers
                              setLoading(true);
                              setResponse(null);
                              try {
                                const res = await fetch(`/api/stream?id=${encodeURIComponent(ep.id)}&server=${encodeURIComponent(selectedServer)}&lang=${encodeURIComponent(selectedLang)}`);
                                const data = await res.json();
                                setResponse(data);
                              } catch (err: any) {
                                setResponse({ success: false, error: err.message });
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="text-[10px] bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-900 px-2.5 py-1 rounded-md transition-all font-bold shrink-0"
                          >
                            Streams
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Direct Servers Stream List (episode player options) */}
                {endpoint === "/api/stream" && response.servers && response.servers.length > 0 && (
                  <div className="border-b border-gray-800 bg-gray-950 p-4 space-y-3">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Select Episode Streaming Pipeline</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {response.servers.map((srv: any, idx: number) => (
                        <div key={idx} className="bg-gray-900 p-3 rounded-lg border border-gray-800/85 space-y-2 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-white">{srv.name} (Option {srv.number})</span>
                            <span className="text-[9px] bg-gray-800 border border-gray-750 px-2 py-0.5 rounded text-gray-400 font-mono font-semibold">
                              {srv.streamUrl ? "HLS Streaming Ready" : "Embedded Player Only"}
                            </span>
                          </div>
                          {(srv.name.toLowerCase().includes("moly") || srv.name.toLowerCase().includes("mirror") || srv.name.toLowerCase().includes("gd")) && (
                            <div className="text-[10px] text-yellow-400 font-medium bg-yellow-500/10 border border-yellow-500/20 p-2 rounded leading-normal">
                              ⚠️ This server restricts cloud endpoints. If HLS players fail, play with the <b className="text-purple-300">Iframe Player</b> which runs directly in your browser.
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {srv.streamUrl && (
                              <>
                                <button
                                  onClick={() => handlePlayHlsStream(srv.streamUrl, "proxied")}
                                  className="text-[10px] bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-900 px-2 py-1 rounded transition-colors font-bold flex items-center gap-1"
                                >
                                  <Shield size={10} /> HLS (Proxied)
                                </button>
                                <button
                                  onClick={() => handlePlayHlsStream(srv.streamUrl, "direct")}
                                  className="text-[10px] bg-blue-950 hover:bg-blue-900 text-blue-400 border border-blue-900 px-2 py-1 rounded transition-colors font-bold flex items-center gap-1"
                                >
                                  <Globe size={10} /> HLS (Direct)
                                </button>
                              </>
                            )}
                            {srv.iframeUrl && (
                              <button
                                onClick={() => handlePlayIframeStream(srv.iframeUrl)}
                                className="text-[10px] bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-900 px-2 py-1 rounded transition-colors font-bold flex items-center gap-1"
                              >
                                <Play size={10} /> Iframe Player
                              </button>
                            )}
                          </div>
                          {srv.proxiedStreamUrl && (
                            <div className="bg-gray-950/80 p-2 rounded border border-gray-800 flex flex-col gap-1.5 mt-2">
                              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Universal External Player Link (for VLC / your site)</span>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-gray-400 font-mono truncate flex-1" title={srv.proxiedStreamUrl}>
                                  {srv.proxiedStreamUrl}
                                </span>
                                <button
                                  onClick={() => handleCopyText(srv.proxiedStreamUrl)}
                                  className={`text-[9px] px-2 py-1 rounded font-bold transition-all shrink-0 flex items-center gap-1 ${copiedUrl === srv.proxiedStreamUrl ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "bg-gray-850 hover:bg-gray-800 text-gray-300 border border-gray-700/60"}`}
                                >
                                  {copiedUrl === srv.proxiedStreamUrl ? (
                                    <>
                                      <CheckCircle size={10} /> Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={10} /> Copy Link
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extract Stream Endpoint Result */}
                {response.success && response.streamUrl && (
                  <div className="p-3 bg-blue-950/20 border-b border-gray-800 flex justify-between items-center text-sm text-blue-300">
                    <span className="truncate text-xs font-mono">Extracted Direct Stream: {response.streamUrl}</span>
                    <button
                      onClick={() => handlePlayHlsStream(response.streamUrl, "proxied")}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded transition-all font-semibold flex items-center gap-1 shrink-0"
                    >
                      <Play size={12} /> Play Stream
                    </button>
                  </div>
                )}

                <div className="p-4 overflow-x-auto max-h-[500px]">
                  <pre className="text-sm font-mono text-emerald-400">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab content: 2. Smart Player */}
        {activeTab === "player" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Player Configuration Card */}
              <div className="lg:col-span-1 bg-gray-900 p-5 rounded-xl border border-gray-800 space-y-5 shadow-lg">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Globe size={18} className="text-blue-500" />
                  Stream Routing Pipeline
                </h2>
                
                <form onSubmit={handlePlayStream} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Stream Playlist URL (M3U8)</label>
                    <textarea
                      value={playerUrl}
                      onChange={(e) => setPlayerUrl(e.target.value)}
                      placeholder="Paste master.m3u8, index.m3u8, or segment JS URL here..."
                      rows={4}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Player Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPlayerType("hls")}
                        className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${playerType === "hls" ? "border-blue-500 bg-blue-950/30 text-blue-200" : "border-gray-800 bg-gray-950/40 text-gray-400 hover:border-gray-700 hover:text-gray-300"}`}
                      >
                        <Play size={16} className={playerType === "hls" ? "text-blue-400" : "text-gray-500"} />
                        <div className="mt-2">
                          <p className="text-xs font-bold">HLS Stream</p>
                          <p className="text-[10px] text-gray-500">M3U8 / MP4 native</p>
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setPlayerType("iframe")}
                        className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${playerType === "iframe" ? "border-blue-500 bg-blue-950/30 text-blue-200" : "border-gray-800 bg-gray-950/40 text-gray-400 hover:border-gray-700 hover:text-gray-300"}`}
                      >
                        <Globe size={16} className={playerType === "iframe" ? "text-blue-400" : "text-gray-500"} />
                        <div className="mt-2">
                          <p className="text-xs font-bold">Iframe Embed</p>
                          <p className="text-[10px] text-gray-500">Third-party player</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {playerType === "hls" && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Playback Route</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPlaybackMode("proxied")}
                            className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${playbackMode === "proxied" ? "border-blue-500 bg-blue-950/30 text-blue-200" : "border-gray-800 bg-gray-950/40 text-gray-400 hover:border-gray-700 hover:text-gray-300"}`}
                          >
                            <Shield size={16} className={playbackMode === "proxied" ? "text-blue-400" : "text-gray-500"} />
                            <div className="mt-2">
                              <p className="text-xs font-bold">Proxied Play</p>
                              <p className="text-[10px] text-gray-500">Uses Server IP</p>
                            </div>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => setPlaybackMode("direct")}
                            className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${playbackMode === "direct" ? "border-blue-500 bg-blue-950/30 text-blue-200" : "border-gray-800 bg-gray-950/40 text-gray-400 hover:border-gray-700 hover:text-gray-300"}`}
                          >
                            <Globe size={16} className={playbackMode === "direct" ? "text-blue-400" : "text-gray-500"} />
                            <div className="mt-2">
                              <p className="text-xs font-bold">Direct Play</p>
                              <p className="text-[10px] text-gray-500">Uses Browser IP</p>
                            </div>
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-relaxed mt-1">
                          {playbackMode === "proxied" 
                            ? "🟢 Proxied Mode routes segment and playlist loads through the server, automatically fetching with working referers. Best if CDNs return 403 in the browser." 
                            : "🔵 Direct Mode streams directly from the source server. Ideal if the token 't' is strictly tied to your home residential IP."
                          }
                        </p>
                      </div>

                      {/* Header Overrides Accordion */}
                      <div className="border-t border-gray-800 pt-4 space-y-3">
                        <p className="text-xs font-bold text-gray-300 flex items-center justify-between">
                          <span>Header Overrides (Proxied)</span>
                          <span className="text-[10px] font-normal text-blue-400 font-mono uppercase">ModHeader Simulator</span>
                        </p>
                        
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 block mb-1">Custom Referer Header</label>
                            <input
                              type="text"
                              value={customReferer}
                              onChange={(e) => setCustomReferer(e.target.value)}
                              placeholder="e.g. https://streamingcommunity.paris/"
                              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 block mb-1">Custom Origin Header</label>
                            <input
                              type="text"
                              value={customOrigin}
                              onChange={(e) => setCustomOrigin(e.target.value)}
                              placeholder="e.g. https://streamingcommunity.paris"
                              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!playerUrl.trim()}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:text-gray-400 text-white font-semibold py-3 rounded-lg text-sm transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <Play size={16} /> Load & Play Stream
                    </button>
                    {playerUrl && (
                      <button
                        type="button"
                        onClick={() => handleUseInProbe(playerUrl)}
                        className="bg-gray-850 hover:bg-gray-800 border border-gray-700 px-3.5 rounded-lg text-gray-300 transition-colors flex items-center justify-center"
                        title="Run header diagnostic on this stream"
                      >
                        <Activity size={16} />
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Video Player Display */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-black rounded-xl border border-gray-800 overflow-hidden shadow-2xl relative aspect-video flex flex-col justify-between">
                  <div className="bg-gray-900 px-4 py-2 border-b border-gray-800 flex items-center justify-between shrink-0 z-10">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-xs font-mono font-bold text-gray-300">
                        {playerType === "hls" 
                          ? (playbackMode === "proxied" ? "PROXIED PIPELINE (Server IP)" : "DIRECT PIPELINE (Client IP)")
                          : "DIRECT IFRAME EMBED (Browser Sandbox)"
                        }
                      </span>
                    </div>
                    {isPlayingStream && (
                      <button 
                        onClick={() => {
                          setIsPlayingStream(false);
                          setActiveStreamUrl("");
                          setActiveIframeUrl("");
                        }}
                        className="text-[11px] px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-950/70 text-red-400 border border-red-900/50 transition-colors font-medium"
                      >
                        Stop Stream
                      </button>
                    )}
                  </div>

                  <div className="flex-1 min-h-0 bg-black flex items-center justify-center relative">
                    {isPlayingStream ? (
                      playerType === "hls" ? (
                        <video 
                          ref={videoRef} 
                          controls 
                          autoPlay 
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <iframe
                          src={activeIframeUrl}
                          className="w-full h-full border-0 bg-black"
                          allowFullScreen
                          referrerPolicy="no-referrer"
                          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
                        />
                      )
                    ) : (
                      <div className="text-center p-6 space-y-3">
                        <div className="w-14 h-14 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto text-blue-500">
                          <Play size={24} className="ml-0.5" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">Player is Idle</p>
                          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                            Load an extracted M3U8 URL or choose an Iframe Player from the API Tester tab to stream.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stream Debug Metadata Card */}
                {isPlayingStream && (
                  <div className="bg-gray-900/40 p-4 rounded-xl border border-gray-800 text-xs space-y-3">
                    <p className="font-semibold text-gray-300 uppercase tracking-wider text-[10px]">Active Pipeline Log</p>
                    <div className="grid grid-cols-4 gap-2 font-mono">
                      <div className="col-span-1 text-gray-500">Pipeline Mode:</div>
                      <div className="col-span-3 text-blue-400 break-all select-all">
                        {playerType === "hls" ? "HLS (.m3u8) Media Player" : "Iframe Embedded Player"}
                      </div>
                      
                      <div className="col-span-1 text-gray-500">Source URL:</div>
                      <div className="col-span-3 text-gray-300 break-all select-all">
                        {playerType === "hls" ? activeStreamUrl : activeIframeUrl}
                      </div>
                      
                      {playerType === "hls" && (
                        <>
                          <div className="col-span-1 text-gray-500">Requesting Agent:</div>
                          <div className="col-span-3 text-gray-300">
                            {playbackMode === "proxied" ? "Node Server (Axios Bypass)" : "Web Browser Fetch"}
                          </div>
                          
                          {playbackMode === "proxied" && (
                            <>
                              <div className="col-span-1 text-gray-500">Injected Referer:</div>
                              <div className="col-span-3 text-emerald-400 truncate">{customReferer || "Default Auto-Healed"}</div>
                              <div className="col-span-1 text-gray-500">Injected Origin:</div>
                              <div className="col-span-3 text-emerald-400 truncate">{customOrigin || "Default Auto-Healed"}</div>
                            </>
                          )}
                        </>
                      )}
                      
                      {playerType === "iframe" && (
                        <>
                          <div className="col-span-1 text-gray-500">Security Sandbox:</div>
                          <div className="col-span-3 text-yellow-400 leading-relaxed">
                            Active with allow-scripts allow-same-origin allow-forms allow-presentation.
                          </div>
                          <div className="col-span-1 text-gray-500">Bypass Capability:</div>
                          <div className="col-span-3 text-emerald-400">
                            Cookies, storage, and cross-origin header validations bypass natively under browser frame hierarchy.
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab content: 3. Header Prober Diagnostics */}
        {activeTab === "probe" && (
          <div className="space-y-6 animate-fade-in flex-1 flex flex-col">
            
            <div className="bg-gray-900 p-5 rounded-xl border border-gray-800 space-y-4">
              <div className="flex items-center gap-2 text-white">
                <Shield size={20} className="text-blue-500" />
                <div>
                  <h2 className="text-lg font-bold">Self-Healing Header Probe</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Test the target CDN in real-time to locate the exact HTTP Referer / Origin required to play the stream.
                  </p>
                </div>
              </div>

              <form onSubmit={handleRunProbe} className="flex gap-3">
                <input
                  type="text"
                  value={probeUrl}
                  onChange={(e) => setProbeUrl(e.target.value)}
                  placeholder="Paste box-*.vmeas.cloud, *.top, or any other HLS master.m3u8 stream URL..."
                  className="flex-1 bg-gray-800 border border-gray-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm placeholder-gray-500"
                />
                <button
                  type="submit"
                  disabled={probing || !probeUrl.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-gray-400 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {probing ? <Loader2 size={18} className="animate-spin" /> : <Activity size={18} />}
                  Run Diagnostic
                </button>
              </form>
            </div>

            {probeResults && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-xl flex-1 flex flex-col">
                <div className="bg-gray-950 px-4 py-3 border-b border-gray-800 flex justify-between items-center shrink-0">
                  <span className="text-xs font-mono font-bold text-gray-400">Header Bypass Matrix Results</span>
                  {probeResults.some(r => r.success) ? (
                    <span className="bg-emerald-950 text-emerald-400 border border-emerald-900 text-[11px] px-3 py-0.5 rounded font-bold flex items-center gap-1">
                      <CheckCircle size={12} /> Working Bypasses Found
                    </span>
                  ) : (
                    <span className="bg-red-950 text-red-400 border border-red-900 text-[11px] px-3 py-0.5 rounded font-bold flex items-center gap-1">
                      <AlertTriangle size={12} /> No Direct Header Bypasses
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-950 border-b border-gray-800 text-gray-400 font-mono">
                        <th className="p-3 font-semibold">Candidate Header Preset</th>
                        <th className="p-3 font-semibold">Injected Referer</th>
                        <th className="p-3 font-semibold">Status Code</th>
                        <th className="p-3 font-semibold">Result status</th>
                        <th className="p-3 font-semibold text-right">Quick Play</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {probeResults.map((res, i) => (
                        <tr key={i} className={`hover:bg-gray-850/50 transition-colors ${res.success ? "bg-emerald-950/10" : ""}`}>
                          <td className="p-3 font-semibold text-gray-200">{res.name}</td>
                          <td className="p-3 font-mono text-[11px] text-gray-400 truncate max-w-[280px]">{res.referer || "(None)"}</td>
                          <td className="p-3 font-mono">
                            <span className={`px-2 py-0.5 rounded font-bold ${res.success ? "bg-emerald-950 text-emerald-400 border border-emerald-900" : res.status === 403 ? "bg-red-950 text-red-400 border border-red-900" : "bg-gray-800 text-gray-400 border border-gray-700"}`}>
                              {res.status}
                            </span>
                          </td>
                          <td className="p-3">
                            {res.success ? (
                              <span className="text-emerald-400 font-medium flex items-center gap-1">
                                <CheckCircle size={13} /> Bypass Active (200 OK)
                              </span>
                            ) : res.status === 403 ? (
                              <span className="text-red-400 flex items-center gap-1">
                                <AlertTriangle size={13} /> 403 Forbidden
                              </span>
                            ) : (
                              <span className="text-gray-400">
                                {res.details || "Blocked / Error"}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {res.success && (
                              <button
                                onClick={() => {
                                  setPlayerUrl(probeUrl);
                                  setPlaybackMode("proxied");
                                  setCustomReferer(res.referer);
                                  setCustomOrigin(res.origin);
                                  setIsPlayingStream(true);
                                  setActiveStreamUrl(`/api/proxy/stream?url=${encodeURIComponent(probeUrl)}&referer=${encodeURIComponent(res.referer)}&origin=${encodeURIComponent(res.origin)}`);
                                  setActiveTab("player");
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-2.5 py-1 rounded font-semibold transition-colors shadow-sm inline-flex items-center gap-1"
                              >
                                <Play size={10} /> Load in Player
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Diagnostic Insights Panel */}
                <div className="bg-gray-950 p-4 border-t border-gray-800 text-xs space-y-3 leading-relaxed text-gray-400">
                  <p className="font-bold text-gray-300 flex items-center gap-1">
                    <Info size={14} className="text-blue-500" />
                    Diagnostic Insights & Recommendations
                  </p>
                  
                  {!probeResults.some(r => r.success) ? (
                    <div className="space-y-2">
                      <p>
                        ⚠️ <strong className="text-red-400">Analysis:</strong> All tested referer/origin headers returned <strong className="text-white">403 Forbidden</strong>. This demonstrates one of two conditions:
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-gray-300">
                        <li>The HLS token parameters (e.g. <code className="bg-gray-800 text-red-300 px-1 py-0.5 rounded font-mono text-[11px]">t</code>) in the URL have expired (many tokens expire within 10-20 minutes).</li>
                        <li>The stream token is strictly <strong className="text-white">IP-Locked</strong> to your personal residential home IP. Because our server runs on a cloud network, it has a different IP and is rejected regardless of headers.</li>
                      </ul>
                      <p className="pt-1">
                        🚀 <strong className="text-blue-400">Action Plan:</strong> Switch back to the <strong className="text-white">HLS Player</strong> tab and choose <strong className="text-emerald-400 font-bold">Direct Play (Client IP)</strong>. In Direct Play, requests bypass the cloud server proxy entirely and load from your browser directly, which carries your exact IP and authorized cookie context!
                      </p>
                    </div>
                  ) : (
                    <p>
                      🎉 <strong className="text-emerald-400">Analysis:</strong> Working Referer/Origin headers were successfully discovered! Click the <strong className="text-white">"Load in Player"</strong> button on any working candidate above. The player will stream seamlessly using our server-side bypass pipeline.
                    </p>
                  )}
                </div>
              </div>
            )}

            {probeError && (
              <div className="bg-red-950/20 text-red-300 border border-red-900/40 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-white">Diagnostic Error</p>
                  <p className="text-xs">{probeError}</p>
                </div>
              </div>
            )}

            {/* General Help Card */}
            {!probeResults && !probing && (
              <div className="bg-gray-900 p-5 rounded-xl border border-gray-850 space-y-3 leading-relaxed text-sm text-gray-400">
                <h3 className="font-bold text-white flex items-center gap-1.5 text-base">
                  <HelpCircle size={18} className="text-blue-400" />
                  What is a Self-Healing Header Probe?
                </h3>
                <p>
                  Many streaming providers (such as vixcloud, vmeas, abyss, and as-cdn) use Referer domain locking to prevent hotlinking and protect content. If you try to stream without a referer, or with the wrong one, the server responds with a <strong>403 Forbidden</strong> error.
                </p>
                <p>
                  By pasting your stream URL here, ToonStream Pro's diagnostic suite triggers a lightweight, sub-second <strong>Header Bypass Matrix</strong> check. It queries the target video segment with multiple referers (including AnimeSaturn, StreamingCommunity, Abyss, and others) to isolate the exact lock, reporting results to you instantly.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import path from "path";
import crypto from "crypto";

const app = express();
const PORT = 3000;

// Allow other sites to use the API (usable by every site everywhere)
app.use(cors({
  origin: "*",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

  // Helper to get ID from toon-stream url
  const extractId = (url: string) => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://toon-stream.site${url}`);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      // Usually it's /series/{id} or /movies/{id}
      if (parts.length > 0) {
        return parts[parts.length - 1];
      }
    } catch (e) {
      // Ignore
    }
    return url;
  };

  // Dean Edwards packer unpacker
  const unpack = (packed: string): string => {
    const match = packed.match(/}\s*\(\s*(['"].*?['"])\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"].*?['"])\s*\.split\s*\(\s*['"]\|['"]\s*\)/s);
    if (!match) return packed;

    let p = match[1];
    if ((p.startsWith("'") && p.endsWith("'")) || (p.startsWith('"') && p.endsWith('"'))) {
      p = p.slice(1, -1);
    }
    p = p.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');

    const a = parseInt(match[2], 10);
    const c = parseInt(match[3], 10);
    
    let kStr = match[4];
    if ((kStr.startsWith("'") && kStr.endsWith("'")) || (kStr.startsWith('"') && kStr.endsWith('"'))) {
      kStr = kStr.slice(1, -1);
    }
    const k = kStr.split('|');

    const e = (c: number): string => {
      return (c < a ? '' : e(Math.floor(c / a))) + ((c % a) > 35 ? String.fromCharCode((c % a) + 29) : (c % a).toString(36));
    };

    let count = c;
    while (count--) {
      if (k[count]) {
        const reg = new RegExp('\\b' + e(count) + '\\b', 'g');
        p = p.replace(reg, k[count]);
      }
    }
    return p;
  };

  const decryptCloudy = (data: any): string => {
    try {
      if (!data) return "";
      let encryptedStr = "";

      if (Buffer.isBuffer(data)) {
        encryptedStr = data.toString('utf8');
      } else if (typeof data === 'object') {
        if (data.data && typeof data.data === 'string') encryptedStr = data.data;
        else if (data.cipher && typeof data.cipher === 'string') encryptedStr = data.cipher;
        else if (data.ciphertext && typeof data.ciphertext === 'string') encryptedStr = data.ciphertext;
        else if (data.encrypted && typeof data.encrypted === 'string') encryptedStr = data.encrypted;
        else if (data.sources && typeof data.sources === 'string') encryptedStr = data.sources;
        else {
          encryptedStr = JSON.stringify(data);
        }
      } else if (typeof data === 'string') {
        encryptedStr = data;
      } else {
        encryptedStr = String(data);
      }

      encryptedStr = encryptedStr.trim();

      // Strip surrounding quotes if any
      if ((encryptedStr.startsWith('"') && encryptedStr.endsWith('"')) || 
          (encryptedStr.startsWith("'") && encryptedStr.endsWith("'"))) {
        encryptedStr = encryptedStr.slice(1, -1);
      }

      if (encryptedStr.startsWith('{')) {
        try {
          const parsedObj = JSON.parse(encryptedStr);
          if (parsedObj.data) encryptedStr = parsedObj.data;
          else if (parsedObj.cipher) encryptedStr = parsedObj.cipher;
          else if (parsedObj.ciphertext) encryptedStr = parsedObj.ciphertext;
          else if (parsedObj.encrypted) encryptedStr = parsedObj.encrypted;
          else if (parsedObj.sources) encryptedStr = parsedObj.sources;
        } catch (e) {
          // ignore, use original
        }
      }

      encryptedStr = encryptedStr.trim();

      const key = Buffer.from('kiemtienmua911ca', 'utf8');
      const iv = Buffer.from('1234567890oiuytr', 'utf8');

      const tryDecrypt = (str: string, enc: 'hex' | 'base64'): string => {
        try {
          const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
          let dec = decipher.update(str, enc, 'utf8');
          dec += decipher.final('utf8');
          return dec;
        } catch (e) {
          return "";
        }
      };

      const isHex = /^[0-9a-fA-F]+$/.test(encryptedStr) && encryptedStr.length % 2 === 0;
      if (isHex) {
        const res = tryDecrypt(encryptedStr, 'hex');
        if (res && (res.includes('cfNative') || res.includes('source') || res.includes('{'))) {
          return res;
        }
      }

      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(encryptedStr);
      if (isBase64) {
        const res = tryDecrypt(encryptedStr, 'base64');
        if (res && (res.includes('cfNative') || res.includes('source') || res.includes('{'))) {
          return res;
        }
      }

      if (encryptedStr.length % 2 === 0) {
        const res = tryDecrypt(encryptedStr, 'hex');
        if (res) return res;
      }

      const resBase64 = tryDecrypt(encryptedStr, 'base64');
      if (resBase64) return resBase64;

      return "";
    } catch (err: any) {
      console.error("Cloudy decryption failed:", err.message);
      return "";
    }
  };

  const md5 = (text: string): string => {
    return crypto.createHash('md5').update(text).digest('hex');
  };

  const decryptAbyssMedia = (mediaStr: string, userId: number | string, slug: string, md5Id: number | string): string => {
    try {
      const keyStr = `${userId}:${slug}:${md5Id}`;
      const hashedKey = md5(keyStr);
      const keyBuffer = Buffer.from(hashedKey, 'ascii');
      const ivBuffer = keyBuffer.slice(0, 16);
      const encryptedBuffer = Buffer.from(mediaStr, 'binary');

      const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuffer, ivBuffer);
      const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);

      return decrypted.toString('utf8');
    } catch (err: any) {
      console.error("Abyss media decryption failed:", err.message);
      return "";
    }
  };

  const extractStreamUrl = async (iframeUrl: string, referer?: string): Promise<string> => {
    if (!iframeUrl) return "";
    try {
      const urlObj = new URL(iframeUrl);
      const host = urlObj.host.toLowerCase();

      // 1. GDMirrorbot / Techinmind
      if (host.includes("gdmirrorbot.nl") || host.includes("techinmind.space")) {
        try {
          const sid = urlObj.searchParams.get("sid") || urlObj.pathname.split('/').filter(Boolean).pop() || "";
          if (!sid) return iframeUrl;

          const postUrl = `https://${host}/embedhelper.php`;
          const postData = new URLSearchParams({ sid });
          
          const response = await axios.post(postUrl, postData.toString(), {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              "Referer": iframeUrl,
              "X-Requested-With": "XMLHttpRequest",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            timeout: 4000
          });

          if (response.data && response.data.siteUrls && response.data.mresult) {
            const siteUrls = response.data.siteUrls;
            const decodedMresult = JSON.parse(Buffer.from(response.data.mresult, "base64").toString("utf8"));
            
            for (const key of Object.keys(siteUrls)) {
              if (decodedMresult[key]) {
                const base = siteUrls[key].replace(/\/$/, "");
                const path = decodedMresult[key].replace(/^\//, "");
                const fullUrl = `${base}/${path}`;
                return await extractStreamUrl(fullUrl, iframeUrl);
              }
            }
          }
        } catch (gdErr: any) {
          console.warn(`GDMirrorbot extract failed: ${gdErr.message}. Falling back to iframe URL.`);
        }
      }

      // 2. Cloudy / VidStack
      if (host.includes("cloudy.upns.one") || host.includes("cloudy.sh") || host.includes("cloudy.to") || host.includes("cloudy.la")) {
        const id = urlObj.hash ? urlObj.hash.substring(1) : (urlObj.searchParams.get("id") || urlObj.pathname.split('/').filter(Boolean).pop() || "");
        if (id) {
          const apiUrl = `https://cloudy.upns.one/api/v1/video?id=${id}`;
          const response = await axios.get(apiUrl, {
            headers: {
              "Referer": iframeUrl,
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            timeout: 4000
  })
          if (response.data) {
            const decrypted = decryptCloudy(response.data);
            if (decrypted) {
              const parsed = JSON.parse(decrypted);
              return parsed.cfNative || parsed.source || iframeUrl;
            }
          }
        }
      }

      // 3. AbyssPlayer / iamcdn / sssrr.org
      if (host.includes("abyss") || host.includes("iamcdn") || host.includes("sssrr.org")) {
        try {
          const response = await axios.get(iframeUrl, {
            headers: {
              "Referer": referer || "https://toon-stream.site/",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            timeout: 5000
  })

          const html = response.data;
          if (typeof html === "string") {
            const datasMatch = html.match(/datas\s*=\s*["']([^"']+)["']/i);
            if (datasMatch && datasMatch[1]) {
              const datasBase64 = datasMatch[1];
              const decodedRaw = Buffer.from(datasBase64, 'base64').toString('latin1');
              const parsed = JSON.parse(decodedRaw);

              if (parsed.media && parsed.user_id && parsed.slug && parsed.md5_id) {
                const decrypted = decryptAbyssMedia(parsed.media, parsed.user_id, parsed.slug, parsed.md5_id);
                if (decrypted) {
                  const decryptedObj = JSON.parse(decrypted);
                  if (decryptedObj.mp4 && Array.isArray(decryptedObj.mp4.sources)) {
                    const sources = decryptedObj.mp4.sources;
                    sources.sort((a: any, b: any) => (b.res_id || 0) - (a.res_id || 0));
                    const highestSource = sources[0];
                    if (highestSource && highestSource.url && highestSource.path) {
                      return `${highestSource.url}/${highestSource.path}`;
                    }
                  }
                }
              }
            }
          }
        } catch (err: any) {
          console.error("Failed to extract from AbyssPlayer:", err.message);
        }
      }

      // 4. RubySTM (rubystm.com, streamruby.com)
      if (host.includes("rubystm.com") || host.includes("streamruby")) {
        try {
          const fileCodeMatch = iframeUrl.match(/\/e\/([a-zA-Z0-9_-]+)/);
          if (fileCodeMatch) {
            const fileCode = fileCodeMatch[1];
            const baseUrl = iframeUrl.split("/e/")[0];
            const dlUrl = `${baseUrl}/dl`;
            const postResponse = await axios.post(dlUrl, `op=embed&file_code=${fileCode}&auto=1&referer=`, {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": iframeUrl,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
              },
              timeout: 5000
    })
            const html = postResponse.data;
            const unpacked = unpack(html);
            const fileMatch = unpacked.match(/file:\s*["']([^"']+)["']/i);
            if (fileMatch && fileMatch[1]) {
              return fileMatch[1];
            }
          }
        } catch(err: any) {
          console.error("Failed to extract from Ruby:", err.message);
        }
      }

      // 5. FirePlayer / Play (as-cdn21.top, as-cdn*.top)
      if (host.match(/as-cdn\d+\.top/)) {
        try {
          const videoIdMatch = iframeUrl.match(/\/video\/([a-zA-Z0-9]+)/);
          if (videoIdMatch) {
            const videoId = videoIdMatch[1];
            const apiUrl = `https://${host}/player/index.php?data=${videoId}&do=getVideo`;
            const postResponse = await axios.post(apiUrl, `hash=${videoId}&r=`, {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": iframeUrl,
                "X-Requested-With": "XMLHttpRequest",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
              },
              timeout: 5000
    })
            const jData = postResponse.data;
            if (jData && jData.videoSource) {
              return jData.videoSource;
            } else if (jData && jData.securedLink) {
              return jData.securedLink;
            }
          }
        } catch(err: any) {
          console.error("Failed to extract from Play:", err.message);
        }
      }

      // 6. Fallback / Standard Packed JS / HTML Extractor
      const response = await axios.get(iframeUrl, {
        headers: {
          "Referer": referer || "https://toon-stream.site/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 5000
      });

      const html = response.data;
      if (typeof html === "string") {
        let textToSearch = html;
        const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)\{.*?\}\(.*\)\)/g);
        if (packedMatch) {
          for (const packed of packedMatch) {
            const unpacked = unpack(packed);
            textToSearch += "\n" + unpacked;
          }
        }

        const m3u8Match = textToSearch.match(/https?:\/\/[^\s'"]+\.m3u8[^\s'"]*/);
        if (m3u8Match) {
          return m3u8Match[0];
        }
      }

      return iframeUrl;
    } catch (err: any) {
      console.error(`Error in extractStreamUrl for ${iframeUrl}:`, err.message);
      return iframeUrl;
    }
  };

  // Helper to fetch the actual iframe source URL and resolve stream URLs
  const fetchRealEmbedUrl = async (embedUrl: string): Promise<{ streamUrl: string; iframeUrl: string; originalUrl: string }> => {
    if (!embedUrl) return { streamUrl: "", iframeUrl: "", originalUrl: "" };
    try {
      let realIframeUrl = embedUrl;
      if (embedUrl.includes("toon-stream.site/embed/")) {
        const response = await axios.get(embedUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          timeout: 4000,
})
        const $ = cheerio.load(response.data);
        const src = $(".Video iframe, iframe").first().attr("src");
        realIframeUrl = src || embedUrl;
      }
      
      const streamUrl = await extractStreamUrl(realIframeUrl);
      const isDirectStream = streamUrl && (streamUrl.includes(".m3u8") || streamUrl.includes(".mp4"));
      
      return {
        streamUrl: isDirectStream ? streamUrl : "",
        iframeUrl: realIframeUrl,
        originalUrl: embedUrl
      };
    } catch (err: any) {
      console.error(`Error resolving embed URL ${embedUrl}:`, err.message);
      return {
        streamUrl: "",
        iframeUrl: embedUrl,
        originalUrl: embedUrl
      };
    }
  };

  // Search Endpoint
  app.post("/api/extract-stream", async (req, res) => {
    try {
      const { iframeUrl, url, referer } = req.body;
      const targetUrl = iframeUrl || url;
      if (!targetUrl) {
        return res.status(400).json({ success: false, error: "Missing iframeUrl or url parameter" });
      }
      
      const streamUrl = await extractStreamUrl(targetUrl, referer);
      res.json({ success: true, url: streamUrl || targetUrl });
    } catch (err: any) {
      console.error("Extract Stream error:", err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Diagnostic Header Probe Endpoint
  app.get("/api/proxy/probe", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).json({ success: false, error: "Missing url parameter" });

    try {
      const urlObj = new URL(targetUrl);
      const defaultRef = `https://${urlObj.hostname}/`;
      const defaultOrig = `https://${urlObj.hostname}`;

      const candidates = [
        { name: "Direct (No Referer)", r: "", o: "" },
        { name: "Default Host", r: defaultRef, o: defaultOrig },
        { name: "Toon-Stream", r: "https://toon-stream.site/", o: "https://toon-stream.site" },
        { name: "Vixcloud Co", r: "https://vixcloud.co/", o: "https://vixcloud.co" },
        { name: "Vmeas Cloud", r: "https://vmeas.cloud/", o: "https://vmeas.cloud" },
        { name: "StreamingCommunity Care", r: "https://streamingcommunity.care/", o: "https://streamingcommunity.care" },
        { name: "StreamingCommunity Paris", r: "https://streamingcommunity.paris/", o: "https://streamingcommunity.paris" },
        { name: "StreamingCommunity Co", r: "https://streamingcommunity.co/", o: "https://streamingcommunity.co" },
        { name: "StreamingCommunity Vip", r: "https://streamingcommunity.vip/", o: "https://streamingcommunity.vip" },
        { name: "AbyssPlayer", r: "https://abysscdn.com/", o: "https://abysscdn.com" },
        { name: "RubySTM", r: "https://rubystm.com/", o: "https://rubystm.com" },
        { name: "AnimeSaturn", r: "https://animesaturn.tv/", o: "https://animesaturn.tv" },
        { name: "AnimeUnity", r: "https://animeunity.to/", o: "https://animeunity.to" },
        { name: "AnimeWorld", r: "https://animeworld.so/", o: "https://animeworld.so" }
      ];

      const results = [];
      for (const cand of candidates) {
        try {
          const headers: Record<string, string> = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Range": "bytes=0-0"
          };
          if (cand.r) headers["Referer"] = cand.r;
          if (cand.o) headers["Origin"] = cand.o;

          const probeRes = await axios.get(targetUrl, {
            headers,
            timeout: 3500,
            validateStatus: () => true,
            responseType: "stream"
          });

          if (probeRes.data && typeof probeRes.data.destroy === "function") {
            probeRes.data.destroy();
          }

          results.push({
            name: cand.name,
            referer: cand.r,
            origin: cand.o,
            status: probeRes.status,
            success: probeRes.status >= 200 && probeRes.status < 400
          });
        } catch (err: any) {
          results.push({
            name: cand.name,
            referer: cand.r,
            origin: cand.o,
            status: err.response ? err.response.status : "Error",
            details: err.message,
            success: false
          });
        }
      }

      res.json({ success: true, url: targetUrl, results });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/proxy/stream", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).send("Missing url parameter");

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers.host || req.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    try {
      const urlObj = new URL(targetUrl);
      let referer = `https://${urlObj.hostname}/`;
      let origin = `https://${urlObj.hostname}`;

      if (urlObj.hostname.includes("streamruby") || urlObj.hostname.includes("rubystm")) {
        referer = "https://rubystm.com/";
        origin = "https://rubystm.com";
      } else if (urlObj.hostname.includes("as-cdn")) {
        referer = `https://${urlObj.hostname}/`;
        origin = `https://${urlObj.hostname}`;
      } else if (urlObj.hostname.includes("abysscdn") || urlObj.hostname.includes("abyss")) {
        referer = "https://abysscdn.com/";
        origin = "https://abysscdn.com";
      }

      // Check if we have explicit overrides in the query parameters or request headers
      let workingR = (req.query.referer as string) || (req.headers["x-referer"] as string);
      let workingO = (req.query.origin as string) || (req.headers["x-origin"] as string);
      const hasOverrides = (workingR !== undefined && workingR !== "") || (workingO !== undefined && workingO !== "");

      if (!hasOverrides) {
        workingR = referer;
        workingO = origin;
        
        // Dynamic self-healing probe to check which Referer/Origin works (receives a 200/206 status)
        const candidates = [
          { r: referer, o: origin },
          { r: "https://toon-stream.site/", o: "https://toon-stream.site" },
          { r: `https://${urlObj.hostname}/`, o: `https://${urlObj.hostname}` },
          { r: "", o: "" }
        ];

        for (const cand of candidates) {
          try {
            const probeHeaders: Record<string, string> = {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Range": "bytes=0-0" // light-weight probe request
            };
            if (cand.r) probeHeaders["Referer"] = cand.r;
            if (cand.o) probeHeaders["Origin"] = cand.o;

            const probeRes = await axios.get(targetUrl, {
              headers: probeHeaders,
              timeout: 4000,
              validateStatus: () => true,
              responseType: "stream"
            });

            if (probeRes.data && typeof probeRes.data.destroy === "function") {
              probeRes.data.destroy(); // immediately release stream
            }

            if (probeRes.status >= 200 && probeRes.status < 400) {
              workingR = cand.r;
              workingO = cand.o;
              break;
            }
          } catch (probeErr) {
            // continue probe with next candidate
          }
        }
      } else {
        workingR = workingR || "";
        workingO = workingO || "";
      }

      const isM3u8 = targetUrl.toLowerCase().includes('.m3u8');
      
      const headersToSend: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      };

      if (workingR) headersToSend["Referer"] = workingR;
      if (workingO) headersToSend["Origin"] = workingO;

      if (req.headers.range) {
        headersToSend["Range"] = req.headers.range as string;
      }

      const response = await axios.get(targetUrl, {
        responseType: 'stream',
        headers: headersToSend,
        validateStatus: () => true,
        timeout: 30000
      });

      // Forward response status
      res.status(response.status);

      // Set CORS headers
      res.set({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range, Content-Type"
      });

      let contentType = (response.headers['content-type'] as string) || '';
      const contentTypeLower = contentType.toLowerCase();
      
      const isPlaylist = targetUrl.toLowerCase().includes('.m3u8') || 
                         contentTypeLower.includes('mpegurl') || 
                         contentTypeLower.includes('m3u8') ||
                         contentTypeLower.includes('text/plain');

      if (isPlaylist) {
        // Buffer the stream into a string for parsing
        let content = "";
        try {
          const chunks: any[] = [];
          for await (const chunk of response.data) {
            chunks.push(chunk);
          }
          content = Buffer.concat(chunks).toString('utf8');
        } catch (streamErr: any) {
          console.error("Error buffering playlist stream:", streamErr.message);
          return res.status(500).send("Failed to read playlist stream from upstream");
        }

        const customParams = (workingR ? `&referer=${encodeURIComponent(workingR)}` : "") + 
                             (workingO ? `&origin=${encodeURIComponent(workingO)}` : "");

        const lines = content.split('\n');
        const rewrittenLines = lines.map((line: string) => {
          let trimmedLine = line.trim();
          if (!trimmedLine) return line;

          if (trimmedLine.startsWith('#')) {
            // Replace any URI="..." or URI=... values with proxied ones
            trimmedLine = trimmedLine.replace(/URI="([^"]+)"/g, (match, p1) => {
              try {
                const absoluteUrl = new URL(p1, targetUrl).toString();
                return `URI="${baseUrl}/api/proxy/stream?url=${encodeURIComponent(absoluteUrl)}${customParams}"`;
              } catch (e) {
                return match;
              }
            });
            trimmedLine = trimmedLine.replace(/URI=([^,\s"]+)/g, (match, p1) => {
              try {
                const absoluteUrl = new URL(p1, targetUrl).toString();
                return `URI="${baseUrl}/api/proxy/stream?url=${encodeURIComponent(absoluteUrl)}${customParams}"`;
              } catch (e) {
                return match;
              }
            });

            // Also check for embedded absolute URLs (e.g., #EXTINF:10,https://...)
            trimmedLine = trimmedLine.replace(/(https?:\/\/[^\s,"]+)/g, (match) => {
              try {
                const absoluteUrl = new URL(match, targetUrl).toString();
                return `${baseUrl}/api/proxy/stream?url=${encodeURIComponent(absoluteUrl)}${customParams}`;
              } catch (e) {
                return match;
              }
            });

            return trimmedLine;
          }

          // If line is not a comment, it's a URL or path
          try {
            const absoluteUrl = new URL(trimmedLine, targetUrl).toString();
            return `${baseUrl}/api/proxy/stream?url=${encodeURIComponent(absoluteUrl)}${customParams}`;
          } catch (e) {
            return line;
          }
        });

        res.set({
          "Content-Type": "application/vnd.apple.mpegurl"
        });
        return res.send(rewrittenLines.join('\n'));
      } else {
        // Explicitly determine the correct Content-Type for this segment
        const upstreamContentType = (response.headers['content-type'] as string || '').toLowerCase();
        const urlLower = targetUrl.toLowerCase();
        let finalContentType = 'video/mp2t'; // Default fallback for media segments

        if (urlLower.includes('.vtt') || upstreamContentType.includes('vtt') || upstreamContentType.includes('subtitle')) {
          finalContentType = 'text/vtt';
        } else if (urlLower.includes('.mp4') || upstreamContentType.includes('video/mp4')) {
          finalContentType = 'video/mp4';
        } else if (upstreamContentType.includes('video/')) {
          finalContentType = response.headers['content-type'] as string;
        } else {
          // Fallback to video/mp2t for any disguised segment formats (.js, .css, .png, etc.)
          finalContentType = 'video/mp2t';
        }

        res.set('content-type', finalContentType);

        // Forward other relevant headers from upstream response to client
        const headersToForward = [
          'content-range',
          'accept-ranges',
          'cache-control',
          'content-disposition'
        ];
        
        headersToForward.forEach(h => {
          if (response.headers[h]) {
            res.set(h, response.headers[h] as string);
          }
        });

        // Optimization: Only buffer and scan if it is a disguised segment (such as JS, CSS, PNG)
        const isDisguisedSegment = urlLower.includes('.js') || 
                                   urlLower.includes('.css') || 
                                   urlLower.includes('.png') || 
                                   upstreamContentType.includes('image/') || 
                                   upstreamContentType.includes('javascript') || 
                                   upstreamContentType.includes('css');

        if (!isDisguisedSegment) {
          // Standard media segment (e.g., .ts, .mp4, subtitles): pipe it directly for sub-millisecond latency and Range support
          response.data.pipe(res);
          return;
        }

        // Buffer the stream response to scan and strip PNG headers (only for disguised segments)
        let segmentBuffer: Buffer;
        try {
          const chunks: any[] = [];
          for await (const chunk of response.data) {
            chunks.push(chunk);
          }
          segmentBuffer = Buffer.concat(chunks);
        } catch (streamErr: any) {
          console.error("Error buffering segment stream:", streamErr.message);
          return res.status(500).send("Failed to read segment stream from upstream");
        }

        // Check if the segment starts with a PNG signature
        const isPngSignature = segmentBuffer.length > 8 && segmentBuffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
        if (isPngSignature) {
          const iendIndex = segmentBuffer.indexOf('IEND');
          if (iendIndex !== -1) {
            const dataAfterIend = segmentBuffer.subarray(iendIndex + 8);
            // Find the first non-0xFF byte after IEND
            let nonFFIndex = -1;
            for (let i = 0; i < dataAfterIend.length; i++) {
              if (dataAfterIend[i] !== 0xff) {
                nonFFIndex = i;
                break;
              }
            }
            if (nonFFIndex !== -1) {
              // Slice out the PNG header and FF padding, leaving just the raw MPEG-TS video packets
              segmentBuffer = dataAfterIend.subarray(nonFFIndex);
            }
          }
        }

        res.set('content-length', segmentBuffer.length.toString());
        res.send(segmentBuffer);
      }
    } catch(e: any) {
      console.error("Proxy error for URL:", targetUrl, "Error:", e.message);
      if (!res.headersSent) {
        res.status(500).send("Proxy error");
      }
    }
  });

  app.get("/api/search", async (req, res) => {
    const keyword = req.query.q;

    if (!keyword) {
      return res.status(400).json({ error: "Missing search keyword (q parameter)" });
    }

    try {
      const targetUrl = `https://toon-stream.site/s?q=${encodeURIComponent(
        keyword as string
      )}`;
      
      const response = await axios.get(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      const $ = cheerio.load(response.data);
      const results: any[] = [];

      // Generic scraper logic: looking for common article/item structures
      const items =
        $("article, .item, .post, .result-item, .video-block, .box-anime").length > 0
          ? $("article, .item, .post, .result-item, .video-block, .box-anime")
          : $("a:has(img)"); // Fallback if no specific container matches

      items.each((_, element) => {
        const el = $(element);

        // Try to extract standard metadata
        let title =
          el.find("h2, h3, .title, .name").first().text().trim() ||
          el.attr("title") ||
          "";
          
        const link =
          el.find("a").first().attr("href") ||
          (el.is("a") ? el.attr("href") : "");
          
        const image =
          el.find("img").first().attr("src") ||
          el.find("img").first().attr("data-src") ||
          "";

        if (!title && el.is("a")) {
          title = el.text().trim();
        }

        if (title || link) {
          const rawLink = link?.startsWith("http") ? link : `https://toon-stream.site${link}`;
          const id = link ? extractId(rawLink) : "";

          results.push({
            id,
            title,
            image: image?.startsWith("http") ? image : `https://toon-stream.site${image}`,
  })
        }
      });

      res.json({
        success: true,
        keyword,
        results,
      });
    } catch (error: any) {
      console.error("Scraping error:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to fetch data from the target site",
        details: error.message,
      });
    }
  });

  // Info Endpoint
  app.get("/api/info", async (req, res) => {
    const id = req.query.id as string;
    
    if (!id) {
      return res.status(400).json({ error: "Missing id parameter" });
    }

    let targetUrl = `https://toon-stream.site/series/${encodeURIComponent(id)}`;
    let isMovie = false;
    let response;

    try {
      // First try series
      try {
        response = await axios.get(targetUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          validateStatus: (status) => status === 200, // strictly allow only 200 to pass
})
      } catch (err) {
        // Fallback to movies
        isMovie = true;
        targetUrl = `https://toon-stream.site/movies/${encodeURIComponent(id)}`;
        response = await axios.get(targetUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
})
      }

      const $ = cheerio.load(response.data);
      
      const title = $("h1.entry-title").first().text().trim() || $("h1").first().text().trim() || $(".title").first().text().trim();
      
      // Select banner and poster using the exact classes discovered
      const bannerImage = 
        $(".TPostBg").first().attr("src") || 
        $("meta[property='og:image']").attr("content") || 
        "";
        
      const posterImage = 
        $(".post-thumbnail img").first().attr("src") || 
        "";

      // Clean description
      const descEl = $(".description").clone();
      descEl.find("p, hr, script, style").remove();
      const description = descEl.text().trim();

      // Extract metadata (genres, year, rating, and description paragraph key-values)
      const genres: string[] = [];
      $("span.genres a").each((_, a) => {
        genres.push($(a).text().trim());
      });

      const year = $("span.year").first().text().trim();
      const rating = $(".vote-cn .num").first().text().trim() || $(".vote .num").first().text().trim();

      const metadata: Record<string, string> = {};
      if (genres.length > 0) metadata["genres"] = genres.join(", ");
      if (year) metadata["year"] = year;
      if (rating) metadata["rating"] = rating;

      // Extract paragraph metadata inside the description block (e.g. Language, Quality, Running time)
      $(".description p").each((_, p) => {
        const text = $(p).text().trim();
        if (text.includes(":")) {
          // Can contain multiple fields on one line, try to parse common ones
          const cleanText = text.replace(/\s+/g, ' ');
          
          const fields = ["Language", "Quality", "Running time", "Season", "Episodes"];
          fields.forEach((field) => {
            const regex = new RegExp(`${field}\\s*:\\s*([^:\\n]+?)(?=\\s*(?:Quality|Running time|Language|Season|Episodes|$))`, 'i');
            const match = cleanText.match(regex);
            if (match && match[1]) {
              metadata[field.toLowerCase().replace(/\s+/g, '_')] = match[1].trim();
            }
  })
        }
      });

      // No actual TMDB ID is available on the scraped pages (only the TMDb image URLs or the text-based TMDB rating), so we return empty to avoid supplying a wrong ID
      let tmdbId = "";

      // Seasons (only metadata, no episodes inside!)
      let seasonsData: any[] = [];
      if (!isMovie) {
        $(".season-btn").each((_, el) => {
          const btn = $(el);
          const seasonNum = btn.attr("data-season") || "";
          const seasonTitle = btn.text().trim() || `Season ${seasonNum}`;
          if (seasonNum) {
            seasonsData.push({
              seasonNumber: seasonNum,
              title: seasonTitle
    })
          }
})

        if (seasonsData.length === 0 && ($("ul#episode_by_temp li").length > 0 || $(".episode").length > 0)) {
          seasonsData.push({
            seasonNumber: "1",
            title: "Season 1"
  })
        }
      }

      // Stream / Embed Servers (mainly for movies, or default player on single layouts)
      const serverElements: any[] = [];
      const isAllowedServer = (name: string): boolean => {
        const n = name.toLowerCase();
        return n.includes("play") || n.includes("cloudy") || n.includes("turbo");
      };

      $(".video-options .aa-tbs-video li").each((_, liEl) => {
        const aEl = $(liEl).find("a");
        const href = aEl.attr("href") || "";
        if (href.startsWith("#")) {
          const optionId = href.substring(1);
          const serverNum = aEl.find("span").first().text().trim();
          const serverName = aEl.find(".server").text().trim() || `Server ${serverNum}`;
          
          const iframeEl = $(`#${optionId} iframe`);
          const embedUrl = iframeEl.attr("src") || iframeEl.attr("data-src") || "";
          
          if (embedUrl && isAllowedServer(serverName)) {
            serverElements.push({
              name: serverName,
              number: serverNum,
              embedUrl: embedUrl.startsWith("http") ? embedUrl : `https://toon-stream.site${embedUrl}`
            });
          }
        }
      });

      // Concurrently resolve actual iframe URLs
      const resolvedServers = await Promise.all(
        serverElements.map(async (srv) => {
          const resObj = await fetchRealEmbedUrl(srv.embedUrl);
          return {
            name: srv.name,
            number: srv.number,
            streamUrl: resObj.streamUrl,
            iframeUrl: resObj.iframeUrl,
            originalUrl: resObj.originalUrl
          };
        })
      );

      res.json({
        success: true,
        id,
        type: isMovie ? "movie" : "series",
        data: {
          title,
          bannerImage: bannerImage.startsWith("http") ? bannerImage : (bannerImage ? `https://toon-stream.site${bannerImage}` : ""),
          posterImage: posterImage.startsWith("http") ? posterImage : (posterImage ? `https://toon-stream.site${posterImage}` : ""),
          description,
          tmdbId,
          metadata,
          seasons: isMovie ? undefined : seasonsData,
          servers: isMovie ? resolvedServers : undefined
        }
      });

    } catch (error: any) {
      console.error("Info Scraping error:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to fetch info from the target site",
        details: error.message,
      });
    }
  });

  // Episodes List Endpoint (supports both spelling requested by user)
  app.get(["/api/episodes", "/api/episdes"], async (req, res) => {
    const animeId = req.query.id as string;
    const seNum = req.query.se as string;

    if (!animeId) {
      return res.status(400).json({ success: false, error: "Missing id parameter" });
    }

    try {
      const targetSe = seNum || "1";
      const targetUrl = `https://toon-stream.site/series/${encodeURIComponent(animeId)}/season/${encodeURIComponent(targetSe)}`;

      try {
        const response = await axios.get(targetUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          validateStatus: (status) => status === 200,
})

        const $ = cheerio.load(response.data);
        const episodes: any[] = [];

        $("li").each((_, epLi) => {
          const epEl = $(epLi);
          const article = epEl.find("article");
          if (article.length > 0) {
            const epLink = article.find("a.lnk-blk").attr("href") || "";
            const epId = epLink ? extractId(epLink) : "";
            const epNum = article.find(".num-epi").text().trim();
            const epTitle = article.find(".entry-title1").text().trim();
            const epImage = article.find("img").attr("src") || "";

            episodes.push({
              id: epId,
              episodeNumber: epNum,
              title: epTitle,
              image: epImage.startsWith("http") ? epImage : (epImage ? `https://toon-stream.site${epImage}` : ""),
              link: epLink ? (epLink.startsWith("http") ? epLink : `https://toon-stream.site${epLink}`) : ""
    })
          }
})

        return res.json({
          success: true,
          id: animeId,
          type: "series",
          season: targetSe,
          episodes
})

      } catch (err) {
        // Fallback to movie check or single-season series on main page
        try {
          const movieUrl = `https://toon-stream.site/movies/${encodeURIComponent(animeId)}`;
          const movieResponse = await axios.get(movieUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            validateStatus: (status) => status === 200,
  })

          // Yes, it's a movie! One episode list item with ID equal to the animeId
          return res.json({
            success: true,
            id: animeId,
            type: "movie",
            episodes: [
              {
                id: animeId,
                episodeNumber: "1",
                title: "Full Movie"
              }
            ]
  })
        } catch (movieErr) {
          // Try main series page (some single season series don't have separate /season/1 path)
          try {
            const seriesUrl = `https://toon-stream.site/series/${encodeURIComponent(animeId)}`;
            const seriesResponse = await axios.get(seriesUrl, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              },
    })

            const $ = cheerio.load(seriesResponse.data);
            const episodes: any[] = [];

            $("ul#episode_by_temp li").each((_, epLi) => {
              const epEl = $(epLi);
              const article = epEl.find("article");
              const epLink = article.find("a.lnk-blk").attr("href") || "";
              const epId = epLink ? extractId(epLink) : "";
              const epNum = article.find(".num-epi").text().trim();
              const epTitle = article.find(".entry-title1").text().trim();
              const epImage = article.find("img").attr("src") || "";

              episodes.push({
                id: epId,
                episodeNumber: epNum,
                title: epTitle,
                image: epImage.startsWith("http") ? epImage : (epImage ? `https://toon-stream.site${epImage}` : ""),
                link: epLink ? (epLink.startsWith("http") ? epLink : `https://toon-stream.site${epLink}`) : ""
      })
    })

            return res.json({
              success: true,
              id: animeId,
              type: "series",
              season: targetSe,
              episodes
    })
          } catch (seriesErr: any) {
            return res.status(404).json({
              success: false,
              error: "Anime or season not found",
              details: seriesErr.message
    })
          }
        }
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: "Failed to fetch episodes",
        details: error.message
      });
    }
  });

  // Streaming / Player Options Endpoint
  app.get("/api/stream", async (req, res) => {
    const id = req.query.id as string;
    const requestedServer = req.query.server as string;
    const requestedLang = req.query.lang as string;

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers.host || req.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    if (!id) {
      return res.status(400).json({ success: false, error: "Missing id parameter" });
    }

    try {
      let targetUrl = `https://toon-stream.site/episode/${encodeURIComponent(id)}`;
      let response;
      let isMovie = false;

      try {
        response = await axios.get(targetUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          validateStatus: (status) => status === 200,
        });
      } catch (err) {
        // Fallback to movie page:
        isMovie = true;
        targetUrl = `https://toon-stream.site/movies/${encodeURIComponent(id)}`;
        response = await axios.get(targetUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
      }

      const $ = cheerio.load(response.data);

      // Helper to check if a server is allowed
      const isAllowedServer = (name: string): boolean => {
        const n = name.toLowerCase();
        return n.includes("play") || n.includes("cloudy") || n.includes("turbo");
      };

      // 1. Extract all language tabs
      const tabs: { id: string; label: string }[] = [];
      $(".video-options [tab]").each((_, el) => {
        const tabId = $(el).attr("tab") || "";
        const label = $(el).text().trim();
        if (tabId) {
          tabs.push({ id: tabId, label });
        }
      });

      // If no tabs, check if there are lrt blocks or list containers
      if (tabs.length === 0) {
        $(".video-options .lrt").each((_, el) => {
          const tabId = $(el).attr("id") || "";
          if (tabId) {
            tabs.push({ id: tabId, label: "Multi Audio" });
          }
        });
      }

      if (tabs.length === 0) {
        tabs.push({ id: "default", label: "Multi Audio" });
      }

      // 2. Extract servers for each tab
      interface ExtractedServer {
        tabId: string;
        tabLabel: string;
        name: string;
        number: string;
        embedUrl: string;
      }
      const allServers: ExtractedServer[] = [];

      tabs.forEach((tab) => {
        const container = tab.id === "default" ? $(".video-options") : $(`#${tab.id}`);
        container.find(".aa-tbs-video li").each((_, liEl) => {
          const aEl = $(liEl).find("a");
          const href = aEl.attr("href") || "";
          if (href.startsWith("#")) {
            const optionId = href.substring(1);
            const serverNum = aEl.find("span").first().text().trim();
            const serverName = aEl.find(".server").text().trim() || `Server ${serverNum}`;
            
            const iframeEl = $(`#${optionId} iframe`);
            const embedUrl = iframeEl.attr("src") || iframeEl.attr("data-src") || "";
            
            if (embedUrl && isAllowedServer(serverName)) {
              allServers.push({
                tabId: tab.id,
                tabLabel: tab.label,
                name: serverName,
                number: serverNum,
                embedUrl: embedUrl.startsWith("http") ? embedUrl : `https://toon-stream.site${embedUrl}`
              });
            }
          }
        });
      });

      // 3. Handle requested server and language filtering
      if (requestedServer || requestedLang) {
        const sParam = (requestedServer || "").toLowerCase().trim();
        const lParam = (requestedLang || "").toLowerCase().trim();

        // Match language tab first
        let bestTabId = "";
        let bestScore = -1;

        tabs.forEach((tab) => {
          const labelLower = tab.label.toLowerCase();
          let score = 0;

          if (lParam === "hin") {
            if (labelLower.includes("hindi") || labelLower.includes("hin")) {
              score = 10;
            } else if (labelLower.includes("multi")) {
              score = 5;
            } else {
              score = 1;
            }
          } else if (lParam === "eng") {
            if (labelLower.includes("english") || labelLower.includes("eng")) {
              score = 10;
            } else if (labelLower.includes("multi")) {
              score = 5;
            } else {
              score = 1;
            }
          } else if (lParam === "jap") {
            if (labelLower.includes("japanese") || labelLower.includes("jap") || labelLower.includes("sub")) {
              score = 10;
            } else if (labelLower.includes("multi")) {
              score = 5;
            } else {
              score = 1;
            }
          } else {
            score = 1;
          }

          if (score > bestScore) {
            bestScore = score;
            bestTabId = tab.id;
          }
        });

        // Filter servers by matched tab
        let candidateServers = allServers.filter(s => s.tabId === bestTabId);
        if (candidateServers.length === 0) {
          candidateServers = allServers;
        }

        // Find server matching Play (hd-1), Cloudy (hd-2), or Turbo (hd-3)
        let matchedServer = candidateServers.find(s => {
          const nameLower = s.name.toLowerCase();
          if (sParam === "hd-1" || sParam === "play") {
            return nameLower.includes("play");
          } else if (sParam === "hd-2" || sParam === "cloudy") {
            return nameLower.includes("cloudy");
          } else if (sParam === "hd-3" || sParam === "turbo") {
            return nameLower.includes("turbo");
          }
          return false;
        });

        // Fallback to searching all servers
        if (!matchedServer) {
          matchedServer = allServers.find(s => {
            const nameLower = s.name.toLowerCase();
            if (sParam === "hd-1" || sParam === "play") {
              return nameLower.includes("play");
            } else if (sParam === "hd-2" || sParam === "cloudy") {
              return nameLower.includes("cloudy");
            } else if (sParam === "hd-3" || sParam === "turbo") {
              return nameLower.includes("turbo");
            }
            return false;
          });
        }

        if (matchedServer) {
          const resObj = await fetchRealEmbedUrl(matchedServer.embedUrl);
          const singleResolvedServer = {
            name: matchedServer.name,
            number: matchedServer.number,
            streamUrl: resObj.streamUrl,
            proxiedStreamUrl: resObj.streamUrl ? `${baseUrl}/api/proxy/stream?url=${encodeURIComponent(resObj.streamUrl)}` : "",
            iframeUrl: resObj.iframeUrl,
            originalUrl: resObj.originalUrl,
            language: matchedServer.tabLabel
          };
          return res.json({
            success: true,
            id,
            server: sParam,
            lang: lParam,
            serverName: matchedServer.name,
            languageLabel: matchedServer.tabLabel,
            streamUrl: resObj.streamUrl,
            proxiedStreamUrl: resObj.streamUrl ? `${baseUrl}/api/proxy/stream?url=${encodeURIComponent(resObj.streamUrl)}` : "",
            iframeUrl: resObj.iframeUrl,
            originalUrl: resObj.originalUrl,
            servers: [singleResolvedServer]
          });
        } else {
          return res.status(404).json({
            success: false,
            error: `Server ${requestedServer} for language ${requestedLang} not found`,
            availableServers: allServers.map(s => ({ name: s.name, language: s.tabLabel }))
          });
        }
      }

      // If server or lang are not provided, return the full list of only allowed servers
      const resolvedServers = await Promise.all(
        allServers.map(async (srv) => {
          const resObj = await fetchRealEmbedUrl(srv.embedUrl);
          return {
            name: srv.name,
            number: srv.number,
            streamUrl: resObj.streamUrl,
            proxiedStreamUrl: resObj.streamUrl ? `${baseUrl}/api/proxy/stream?url=${encodeURIComponent(resObj.streamUrl)}` : "",
            iframeUrl: resObj.iframeUrl,
            originalUrl: resObj.originalUrl
          };
        })
      );

      res.json({
        success: true,
        id,
        type: isMovie ? "movie" : "episode",
        servers: resolvedServers
      });

    } catch (error: any) {
      console.error("Streaming Scrape error:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to fetch streaming options",
        details: error.message
      });
    }
  });

  // Vite middleware for development / production serving
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    import("vite").then(({ createServer: createViteServer }) => {
      createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      }).then((vite) => {
        app.use(vite.middlewares);
        app.listen(PORT, "0.0.0.0", () => {
          console.log(`Server running on http://localhost:${PORT}`);
        });
      });
    }).catch((err) => {
      console.error("Failed to load Vite server dynamically:", err);
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    if (!process.env.VERCEL) {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    }
  }

export default app;

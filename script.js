const input = document.querySelector("#video-url");
const form = document.querySelector("#download-form");
const message = document.querySelector("#message");
const downloadButton = document.querySelector("#download-button");

function showMessage(title, body, link) {
  message.replaceChildren();
  const heading = document.createElement("strong");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = body;
  message.append(heading, paragraph);
  if (link) {
    const anchor = document.createElement("a");
    anchor.href = link;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = "Open original link ↗";
    message.append(anchor);
  }
  message.hidden = false;
}

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !!url.hostname;
  } catch { return false; }
}

function isSocialPlatform(host) {
  const h = host.toLowerCase().replace(/^www\./, "");
  return [
    "youtube.com", "youtu.be", "instagram.com", "tiktok.com",
    "facebook.com", "fb.watch", "x.com", "twitter.com", "pinterest.com", "pin.it"
  ].some(domain => h === domain || h.endsWith("." + domain));
}

document.querySelectorAll(".platform").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".platform").forEach(item => item.classList.toggle("active", item === button));
    const name = button.dataset.platform;
    input.placeholder = name === "all" ? "Paste a direct .mp4 link or social post URL..." : `Paste a ${name} post link...`;
    input.focus();
  });
});

document.querySelector("#paste-button").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) input.value = text.trim();
    else showMessage("Clipboard is empty", "Copy a link first, then tap Paste again.");
  } catch {
    showMessage("Paste manually", "Tap and hold the input field, then choose Paste.");
    input.focus();
  }
});

document.querySelectorAll("[data-sample]").forEach(button => {
  button.addEventListener("click", () => {
    input.value = button.dataset.sample;
    input.scrollIntoView({behavior:"smooth", block:"center"});
    input.focus();
    showMessage("Sample link added", "This is a platform homepage, not a video post. Replace it with a real post URL or direct video-file URL.");
  });
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  const value = input.value.trim();
  if (!validHttpUrl(value)) {
    showMessage("Enter a valid URL", "Paste a complete link beginning with https:// or http://.");
    input.focus();
    return;
  }

  const url = new URL(value);
  if (isSocialPlatform(url.hostname)) {
    showMessage(
      "This is a social-platform link",
      "This project cannot directly extract videos from YouTube, Instagram, TikTok, Facebook, X, or Pinterest. Open the original post and use its official download/export option if available. This avoids bypassing platform protections.",
      url.href
    );
    return;
  }

  downloadButton.disabled = true;
  downloadButton.textContent = "Checking video link…";
  try {
    const response = await fetch("/api/download?url=" + encodeURIComponent(url.href));
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !type.includes("video/")) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "The URL did not return a supported video file.");
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = (url.pathname.split("/").pop() || "video").split("?")[0] || "video.mp4";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    showMessage("Download started", "If your browser asks, confirm saving the video file.");
  } catch (error) {
    showMessage("Could not download this link", error.message + " The server must be running, and the URL must be a publicly accessible direct video file.", url.href);
  } finally {
    downloadButton.disabled = false;
    downloadButton.textContent = "↓   Download";
  }
});

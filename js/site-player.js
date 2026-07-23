(function () {
  if (window.SitePlayer) {
    window.SitePlayer.mount();
    return;
  }

  const scriptUrl = document.currentScript.src;
  const tracks = [
    {
      title: "Code Radio",
      src: "https://stream.zeno.fm/0r0xa792kwzuv",
      remote: true,
    },
    {
      title: "Turn on the radio",
      src: new URL("../audio/turnontheradio.mp3", scriptUrl).href,
      remote: false,
    },
    {
      title: "Blue Sunday",
      src: new URL("../audio/bluesunday.mp3", scriptUrl).href,
      remote: false,
    },
  ];

  const audio = new Audio();
  audio.preload = "none";

  let sourceIndex = 0;
  let isPlaying = false;
  let lastMessage = "";

  function currentTrack() {
    return tracks[sourceIndex];
  }

  function setMessage(message) {
    lastMessage = message;
    sync();
  }

  function emitState() {
    document.dispatchEvent(
      new CustomEvent("site-player-state", {
        detail: {
          playing: isPlaying,
          title: currentTrack().title,
          message: lastMessage,
        },
      })
    );
  }

  function sync() {
    syncMusicRoom();
    emitState();
  }

  async function playCurrentTrack() {
    const track = currentTrack();
    if (audio.src !== track.src) {
      audio.src = track.src;
      audio.load();
    }

    await audio.play();
    isPlaying = true;
    setMessage(track.remote ? "" : "Remote stream unavailable, using local audio.");
  }

  async function play() {
    try {
      await playCurrentTrack();
    } catch (error) {
      if (sourceIndex < tracks.length - 1) {
        sourceIndex += 1;
        setMessage("Stream unavailable, trying backup audio...");
        try {
          await playCurrentTrack();
          return;
        } catch (fallbackError) {
          console.error(fallbackError);
        }
      }

      isPlaying = false;
      setMessage("Audio is unavailable right now.");
      console.error(error);
    }
  }

  function pause() {
    audio.pause();
    isPlaying = false;
    setMessage("");
  }

  function toggle() {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function mount() {
    if (!document.body) return;

    setupMusicRoom();
    sync();
  }

  function syncBodyAttributes(nextBody) {
    Array.from(document.body.attributes).forEach((attribute) => {
      document.body.removeAttribute(attribute.name);
    });

    Array.from(nextBody.attributes).forEach((attribute) => {
      document.body.setAttribute(attribute.name, attribute.value);
    });
  }

  function syncHeadLinks(nextDoc, url) {
    document
      .querySelectorAll(
        'link[rel~="stylesheet"], link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="canonical"]'
      )
      .forEach((link) => link.remove());

    nextDoc
      .querySelectorAll(
        'link[rel~="stylesheet"], link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="canonical"]'
      )
      .forEach((link) => {
        const clone = link.cloneNode(true);
        const href = clone.getAttribute("href");
        if (href) {
          clone.href = new URL(href, url).href;
        }
        document.head.appendChild(clone);
      });
  }

  function syncMeta(nextDoc) {
    document.title = nextDoc.title;
    const nextTheme = nextDoc.querySelector('meta[name="theme-color"]');
    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme && nextTheme) {
      theme.setAttribute("content", nextTheme.getAttribute("content"));
    }
  }

  function shouldHandleNavigation(anchor, event) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      anchor.target ||
      anchor.hasAttribute("download")
    ) {
      return false;
    }

    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    if (url.pathname.endsWith("/posts/pixel-jump.html")) return false;
    if (!url.pathname.endsWith("/") && !url.pathname.endsWith(".html")) return false;
    return url.href !== window.location.href;
  }

  async function visit(url, pushState) {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Navigation failed: ${response.status}`);

    const html = await response.text();
    const nextDoc = new DOMParser().parseFromString(html, "text/html");

    syncMeta(nextDoc);
    syncHeadLinks(nextDoc, url);
    syncBodyAttributes(nextDoc.body);
    document.body.innerHTML = nextDoc.body.innerHTML;
    mount();

    if (pushState) {
      history.pushState({}, "", url);
    }

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    if (window.gtag) {
      window.gtag("event", "page_view", {
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a[href]");
    if (!anchor || !shouldHandleNavigation(anchor, event)) return;

    event.preventDefault();
    visit(anchor.href, true).catch((error) => {
      console.error(error);
      window.location.href = anchor.href;
    });
  });

  window.addEventListener("popstate", () => {
    visit(window.location.href, false).catch(() => window.location.reload());
  });

  audio.addEventListener("ended", () => {
    isPlaying = false;
    sync();
  });

  audio.addEventListener("error", () => {
    if (sourceIndex < tracks.length - 1) {
      sourceIndex += 1;
      if (isPlaying) {
        play();
      } else {
        setMessage("Playback failed. Press play to try backup audio.");
      }
      return;
    }

    isPlaying = false;
    setMessage("Audio is unavailable right now.");
  });

  function setupMusicRoom() {
    const roomButton = document.getElementById("musicRoomToggle");
    if (!roomButton || roomButton.dataset.bound === "true") return;

    const backgroundVideo = document.getElementById("musicRoomVideo");
    if (backgroundVideo) {
      backgroundVideo.play().catch(() => {});
    }

    roomButton.dataset.bound = "true";
    roomButton.addEventListener("click", toggle);
  }

  function syncMusicRoom() {
    const roomButton = document.getElementById("musicRoomToggle");
    const roomStatus = document.getElementById("musicRoomStatus");

    if (roomButton) {
      roomButton.classList.toggle("playing", isPlaying);
      roomButton.textContent = isPlaying ? "Pause radio" : "Play radio";
    }

    if (roomStatus) {
      roomStatus.textContent = lastMessage || (isPlaying ? currentTrack().title : "lofi room is ready.");
    }
  }

  window.SitePlayer = {
    mount,
    play,
    pause,
    toggle,
    getState() {
      return {
        playing: isPlaying,
        title: currentTrack().title,
        message: lastMessage,
      };
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();

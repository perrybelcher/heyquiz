/* Pippi embed v1. Dependency-free; repeated snippets share one per-origin loader.
 * Inline markup is backwards compatible. Popup links enhance only when both
 * native dialogs and the accompanying stylesheet are ready. No quiz data is requested. */
(function () {
  "use strict";
  var script = document.currentScript, origin;
  try { origin = new URL(script.src, document.baseURI).origin; } catch { return; }
  if (!/^https?:\/\//.test(origin)) return;
  var loaders = window.__pippiEmbedLoaders || (window.__pippiEmbedLoaders = Object.create(null));
  if (loaders[origin]) { loaders[origin](); return; }
  var frames = new Map(), popups = new Map(), triggers = new Map(), styles = new Set();
  var version = 1, minHeight = 200, maxHeight = 30000;
  function playerURL(value) {
    try {
      var url = new URL(value, document.baseURI);
      return url.origin === origin && !url.username && !url.password && /^\/play\/[^/]+\/?$/.test(url.pathname) ? url : null;
    } catch { return null; }
  }
  function eligible(frame, state) {
    var url = playerURL(frame.getAttribute("src"));
    return frame.isConnected && url && url.searchParams.get("embed") === "1" && (state && state.popup ? state.popup.frame === frame && state.popup.dialog.isConnected && url.origin + url.pathname === state.popup.url && url.search === "?embed=1" && !url.hash : frame.hasAttribute("data-pippi-embed"));
  }
  function channel() {
    var values = new Uint32Array(4);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(values);
    else for (var index = 0; index < values.length; index++) values[index] = Math.floor(Math.random() * 4294967296);
    return Array.from(values, function (value) { return value.toString(16).padStart(8, "0"); }).join("");
  }
  function initialize(frame, state) {
    if (!eligible(frame, state) || !frame.contentWindow) return;
    var message = { type: "pippi:embed:init", version: version, channel: state.channel };
    if (state.popup) message.transport = "modal";
    frame.contentWindow.postMessage(message, origin);
  }
  function register(frame, popup) {
    var state = { channel: channel(), load: null, popup: popup || null };
    state.load = function () { state.channel = channel(); initialize(frame, state); };
    frames.set(frame, state); frame.addEventListener("load", state.load); initialize(frame, state);
  }
  function popupReady() {
    return Boolean(window.HTMLDialogElement && typeof window.HTMLDialogElement.prototype.showModal === "function" && window.getComputedStyle(document.documentElement).getPropertyValue("--pippi-popup-ready").trim() === "1");
  }
  function triggerURL(trigger) {
    var url = playerURL(trigger.getAttribute("href"));
    return trigger.isConnected && trigger.hasAttribute("data-pippi-popup") && url && !url.search && !url.hash ? url.origin + url.pathname.replace(/\/$/, "") : null;
  }
  function node(tag, className, text) {
    var element = document.createElement(tag); element.className = className;
    if (text) element.textContent = text;
    return element;
  }
  // Preserve only properties this loader changes, including existing priorities.
  // If another host component changes a property during the modal, do not erase it.
  function lockScroll() {
    var x = window.scrollX, y = window.scrollY, saved = [];
    function set(element, name, value) {
      var old = element.style.getPropertyValue(name), priority = element.style.getPropertyPriority(name);
      element.style.setProperty(name, value, "important");
      var applied = element.style.getPropertyValue(name);
      saved.push(function () {
        if (element.style.getPropertyValue(name) !== applied || element.style.getPropertyPriority(name) !== "important") return;
        if (old) element.style.setProperty(name, old, priority); else element.style.removeProperty(name);
      });
    }
    var gap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    var padding = parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
    set(document.body, "position", "fixed"); set(document.body, "top", -y + "px"); set(document.body, "left", -x + "px");
    set(document.body, "width", "100%"); set(document.body, "box-sizing", "border-box");
    if (gap) set(document.body, "padding-right", padding + gap + "px");
    set(document.documentElement, "overflow", "hidden");
    return function () { saved.reverse().forEach(function (restore) { restore(); }); window.scrollTo({ left: x, top: y, behavior: "instant" }); };
  }
  function finishClose(popup) {
    if (!popup.open) return;
    popup.open = false; popup.scroll = popup.viewport.scrollTop;
    if (window.__pippiOpenPopup === popup) window.__pippiOpenPopup = null;
    if (popup.unlock) { popup.unlock(); popup.unlock = null; }
    var trigger = popup.returnFocus;
    if (trigger && trigger.isConnected && trigger.getClientRects().length) trigger.focus({ preventScroll: true });
    else {
      var fallback = Array.from(triggers.keys()).find(function (item) { return item.isConnected && item.getClientRects().length; });
      if (fallback) fallback.focus({ preventScroll: true });
      else {
        var prior = document.body.getAttribute("tabindex"); document.body.setAttribute("tabindex", "-1"); document.body.focus({ preventScroll: true });
        if (prior === null) document.body.removeAttribute("tabindex"); else document.body.setAttribute("tabindex", prior);
      }
    }
  }
  function closePopup(popup) {
    if (popup.dialog && popup.dialog.open) popup.dialog.close();
    finishClose(popup);
  }
  function createPopup(popup, trigger) {
    var title = trigger.getAttribute("data-pippi-title") || "Quiz";
    var dialog = node("dialog", "pippi-popup-dialog"), header = node("header", "pippi-popup-header");
    var heading = node("h2", "pippi-popup-title", title), close = node("button", "pippi-popup-close", "Close quiz");
    dialog.id = popup.id; heading.id = popup.id + "-title"; heading.title = title;
    dialog.setAttribute("aria-labelledby", heading.id); dialog.setAttribute("aria-describedby", popup.id + "-help");
    close.type = "button"; close.addEventListener("click", function () { closePopup(popup); });
    header.append(heading, close);
    var viewport = node("div", "pippi-popup-body"), footer = node("footer", "pippi-popup-footer");
    viewport.tabIndex = 0; viewport.setAttribute("role", "region"); viewport.setAttribute("aria-label", "Quiz content");
    var help = node("p", "pippi-popup-help", "Close and reopen to continue on this page. Timed quizzes keep their original deadline.");
    help.id = popup.id + "-help";
    var status = node("p", "pippi-popup-status", "Loading quiz… If it does not appear, use the link below."); status.setAttribute("role", "status");
    var direct = node("a", "pippi-popup-direct", "Open quiz in a new tab"); direct.href = popup.url; direct.target = "_blank"; direct.rel = "noopener";
    footer.append(help, status, direct); dialog.append(header, viewport, footer);
    popup.dialog = dialog; popup.viewport = viewport; popup.close = close; popup.status = status;
    dialog.addEventListener("cancel", function (event) { event.preventDefault(); closePopup(popup); });
    dialog.addEventListener("close", function () { if (!dialog.open) finishClose(popup); });
    document.body.append(dialog);
    triggers.forEach(function (state, item) { if (state.popup === popup) item.setAttribute("aria-controls", popup.id); });
  }
  function openPopup(popup, trigger) {
    if (!popupReady()) return false;
    // A host's other modal, or another Pippi quiz, must not be displaced.
    if (window.__pippiOpenPopup) return true;
    if (document.querySelector("dialog[open]")) return false;
    if (!popup.dialog) createPopup(popup, trigger);
    popup.returnFocus = trigger;
    try { popup.dialog.showModal(); } catch { return false; }
    popup.open = true; window.__pippiOpenPopup = popup; popup.unlock = lockScroll();
    if (!popup.frame) {
      var frame = node("iframe", "pippi-popup-frame"); frame.title = trigger.getAttribute("data-pippi-title") || "Quiz";
      frame.src = popup.url + "?embed=1"; frame.setAttribute("width", "100%"); frame.setAttribute("height", "700"); frame.setAttribute("allow", "fullscreen");
      popup.frame = frame; popup.viewport.append(frame); register(frame, popup);
    } else {
      var state = frames.get(popup.frame); if (state) initialize(popup.frame, state);
    }
    popup.viewport.scrollTop = popup.scroll || 0; popup.close.focus({ preventScroll: true });
    return true;
  }
  function unbind(trigger, state) {
    trigger.removeEventListener("click", state.click); trigger.removeEventListener("keydown", state.keydown);
    Object.keys(state.attributes).forEach(function (name) {
      if (state.attributes[name] === null) trigger.removeAttribute(name); else trigger.setAttribute(name, state.attributes[name]);
    });
    triggers.delete(trigger);
  }
  function scanPopups() {
    if (!window.HTMLDialogElement) return;
    document.querySelectorAll("link[data-pippi-popup-style]").forEach(function (link) {
      try {
        var url = new URL(link.href, document.baseURI);
        if (url.origin === origin && url.pathname === "/pippi-popup.css" && !styles.has(link)) {
          styles.add(link); link.addEventListener("load", scan);
        }
      } catch { /* A malformed stylesheet link remains an ordinary link fallback. */ }
    });
    var ready = popupReady();
    triggers.forEach(function (state, trigger) { if (!ready || triggerURL(trigger) !== state.popup.url) unbind(trigger, state); });
    if (ready) document.querySelectorAll("a[data-pippi-popup]").forEach(function (trigger) {
      var url = triggerURL(trigger); if (!url || triggers.has(trigger)) return;
      var popup = popups.get(url);
      if (!popup) { popup = { url: url, id: "pippi-popup-" + channel(), open: false, scroll: 0 }; popups.set(url, popup); }
      var state = { popup: popup, attributes: {}, click: null, keydown: null };
      ["role", "aria-haspopup", "aria-controls"].forEach(function (name) { state.attributes[name] = trigger.getAttribute(name); });
      trigger.setAttribute("role", "button"); trigger.setAttribute("aria-haspopup", "dialog");
      if (popup.dialog) trigger.setAttribute("aria-controls", popup.id);
      state.click = function (event) { if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return; if (openPopup(popup, trigger)) event.preventDefault(); };
      state.keydown = function (event) { if (event.key === " " && !event.defaultPrevented && !event.repeat && !event.isComposing) { if (openPopup(popup, trigger)) event.preventDefault(); } };
      trigger.addEventListener("click", state.click); trigger.addEventListener("keydown", state.keydown); triggers.set(trigger, state);
    });
    popups.forEach(function (popup, url) {
      var retained = Array.from(triggers.values()).some(function (state) { return state.popup === popup; });
      var validFrame = !popup.frame || eligible(popup.frame, { popup: popup });
      if (retained && (!popup.dialog || popup.dialog.isConnected) && validFrame) return;
      if (popup.dialog) { closePopup(popup); popup.dialog.remove(); }
      if (popup.frame) { var state = frames.get(popup.frame); if (state) popup.frame.removeEventListener("load", state.load); frames.delete(popup.frame); }
      popups.delete(url);
      triggers.forEach(function (state, trigger) { if (state.popup === popup) unbind(trigger, state); });
    });
    styles.forEach(function (link) { if (!link.isConnected) { link.removeEventListener("load", scan); styles.delete(link); } });
  }
  function scan() {
    frames.forEach(function (state, frame) {
      if (!eligible(frame, state)) { frame.removeEventListener("load", state.load); frames.delete(frame); }
    });
    document.querySelectorAll("iframe[data-pippi-embed]").forEach(function (frame) { if (eligible(frame) && !frames.has(frame)) register(frame); });
    scanPopups();
  }
  window.addEventListener("message", function (event) {
    var data = event.data;
    if (event.origin !== origin || !data || typeof data !== "object" || Array.isArray(data) || data.version !== version) return;
    frames.forEach(function (state, frame) {
      if (!eligible(frame, state) || event.source !== frame.contentWindow) return;
      if (data.type === "pippi:embed:ready") { initialize(frame, state); return; }
      if (data.channel !== state.channel) return;
      if (data.type === "pippi:meta:context" && data.consent === true && typeof data.nonce === "string" && /^[a-f0-9-]{36}$/.test(data.nonce)) {
        var page = new URL(window.location.href);
        function metaCookie(name) { return document.cookie.split(";").map(function (value) { return value.trim(); }).find(function (value) { return value.indexOf(name + "=") === 0; }); }
        var fbp = metaCookie("_fbp"), fbc = metaCookie("_fbc");
        frame.contentWindow.postMessage({ type: "pippi:meta:context-result", version: version, channel: state.channel, nonce: data.nonce, context: { url: page.origin + page.pathname, fbclid: page.searchParams.get("fbclid") || undefined, fbp: fbp ? fbp.slice(5) : undefined, fbc: fbc ? fbc.slice(5) : undefined, screen_width: window.screen.width, screen_height: window.screen.height, viewport_width: window.innerWidth, viewport_height: window.innerHeight, pixel_ratio: window.devicePixelRatio, language: window.navigator.language } }, origin);
        return;
      }
      var popup = state.popup;
      if (popup && (!popup.open || !popup.dialog.open || window.__pippiOpenPopup !== popup)) return;
      if (data.type === "pippi:embed:escape") { if (popup && document.activeElement === frame) closePopup(popup); return; }
      if (data.type !== "pippi:embed:resize" || typeof data.height !== "number" || !Number.isFinite(data.height) || !Number.isInteger(data.height) || data.height < minHeight || data.height > maxHeight) return;
      frame.style.height = data.height + "px"; frame.setAttribute("height", String(data.height));
      if (popup) popup.status.textContent = "";
      // Only an explicit navigation from the focused frame can reveal a heading.
      // Modal content moves its own viewport; inline content retains host scrolling.
      if (document.activeElement === frame && typeof data.revealTop === "number" && Number.isFinite(data.revealTop) && Number.isInteger(data.revealTop) && typeof data.revealBottom === "number" && Number.isFinite(data.revealBottom) && Number.isInteger(data.revealBottom) && data.revealTop >= 0 && data.revealBottom > data.revealTop && data.revealBottom <= data.height) {
        var bounds = frame.getBoundingClientRect(), top = bounds.top + data.revealTop, bottom = bounds.top + data.revealBottom;
        if (popup) {
          var visible = popup.viewport.getBoundingClientRect();
          if (top < visible.top || bottom > visible.bottom) popup.viewport.scrollTop = Math.max(0, Math.min(popup.viewport.scrollHeight - popup.viewport.clientHeight, popup.viewport.scrollTop + top - visible.top - 16));
        } else if (top < 0 || bottom > window.innerHeight) window.scrollTo({ top: Math.max(0, window.scrollY + top - 24), behavior: "instant" });
      }
    });
  });
  loaders[origin] = scan;
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "href", "data-pippi-embed", "data-pippi-popup"] });
})();

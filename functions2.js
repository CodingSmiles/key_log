(function () {
  'use strict';

  // -------------------------
  // LIVERY SELECTOR — CLEAN EXTRACTED VERSION
  // -------------------------

  if (window._geoFsLiverySelectorInitialized) return;
  window._geoFsLiverySelectorInitialized = true;

  const githubRepo = 'https://raw.githubusercontent.com/kolos26/GEOFS-LiverySelector/main';
  let jsDelivr = 'https://cdn.jsdelivr.net/gh/kolos26/GEOFS-LiverySelector@main';
  const noCommit = jsDelivr;
  const version = '3.3.1';

  const liveryobj = {};
  const mpLiveryIds = {};
  const mLiveries = {};
  const origHTMLs = {};
  const uploadHistory = JSON.parse(localStorage.lsUploadHistory || '{}');
  const LIVERY_ID_OFFSET = 10e3;
  const ML_ID_OFFSET = 1e3;

  let links = [];
  let airlineobjs = [];
  let whitelist;
  let mpAirlineobjs = {};

  // -------------------------
  // INITIAL BOOTSTRAP
  // -------------------------
  (async function bootstrap() {
    try {
      const res = await fetch(`https://api.github.com/repos/kolos26/GEOFS-LiverySelector/commits/main`);
      if (!res.ok) jsDelivr = githubRepo;
      const commit = (await res.json()).sha;
      if (!/^[a-f0-9]{40}$/.test(commit)) jsDelivr = githubRepo;
      jsDelivr = jsDelivr.replace("@main", `@${commit}`);
    } catch (err) {
      jsDelivr = githubRepo;
    }

    // Inject CSS
    try {
      fetch(`${jsDelivr}/styles.css?` + Date.now()).then(async data => {
        const styleTag = createTag('style', { type: 'text/css' });
        styleTag.innerHTML = await data.text();
        document.head.appendChild(styleTag);
      });
    } catch (e) {}

    // FontAwesome
    appendNewChild(document.head, 'link', {
      rel: 'stylesheet',
      href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css'
    });

    // Load livery JSON
    fetch(`${jsDelivr}/livery.json?` + Date.now())
      .then(handleLiveryJson)
      .catch(e => console.error('livery.json fetch error', e));

    // Build UI panel
    const leftUi = document.querySelector('.geofs-ui-left');
    if (leftUi) {
      const listDiv = appendNewChild(leftUi, 'div', {
        id: 'listDiv',
        class: 'geofs-list geofs-toggle-panel livery-list',
        'data-noblur': 'true',
        'data-onshow': '{geofs.initializePreferencesPanel()}',
        'data-onhide': '{geofs.savePreferencesPanel()}'
      });
      listDiv.innerHTML = generateListHTML();
    }

    const geofsUiButton = document.querySelector('.geofs-ui-bottom');
    if (geofsUiButton) {
      const insertPos = geofs.version >= 3.6 ? 4 : 3;
      geofsUiButton.insertBefore(generatePanelButtonHTML(), geofsUiButton.children[insertPos]);
    }

    // Remove default GeoFS liveries button
    const origButtons = document.getElementsByClassName('geofs-liveries geofs-list-collapsible-item');
    Object.values(origButtons).forEach(btn => btn.parentElement && btn.parentElement.removeChild(btn));

    // Load custom airline links
    if (localStorage.getItem('links') === null) {
      localStorage.links = '';
    } else {
      links = localStorage.links.split(",").filter(Boolean);
      links.forEach(async function (e) {
        try {
          await fetch(e).then(res => res.json()).then(data => airlineobjs.push(data));
          airlineobjs[airlineobjs.length - 1].url = e.trim();
        } catch (err) {
          console.warn('failed loading airline link', e, err);
        }
      });
    }

    // Whitelist
    fetch(`${jsDelivr}/whitelist.json?` + Date.now())
      .then(res => res.json())
      .then(data => whitelist = data)
      .catch(e => console.warn('whitelist fetch', e));

    // Multiplayer liveries update
    setInterval(updateMultiplayer, 5000);

    // Hotkey (L)
    window.addEventListener("keyup", function (e) {
      if (e.target.classList && e.target.classList.contains("geofs-stopKeyupPropagation")) {
        e.stopImmediatePropagation();
      }
      if (e.key === "l") { LiverySelector.togglePanel(); }
    });

  })();

  // -------------------------
  // LIVERY JSON HANDLER
  // -------------------------
  async function handleLiveryJson(data) {
    try {
      const json = await data.json();
      Object.keys(json).forEach(key => liveryobj[key] = json[key]);

      if (liveryobj.commit) jsDelivr = jsDelivr.replace("@main", "@" + liveryobj.commit);

      // UI Badge for planes with liveries
      Object.keys(liveryobj.aircrafts || {}).forEach(aircraftId => {
        if (!liveryobj.aircrafts[aircraftId]) return;
        if (liveryobj.aircrafts[aircraftId].liveries.length < 2) return;

        const element = document.querySelector(`[data-aircraft='${aircraftId}']`);
        if (element) {
          if (!origHTMLs[aircraftId]) origHTMLs[aircraftId] = element.innerHTML;
          element.innerHTML = origHTMLs[aircraftId] +
            createTag('img', {
              src: `${noCommit}/liveryselector-logo-small.svg`,
              style: 'height:30px;width:auto;margin-left:20px;',
              title: 'Liveries available'
            }).outerHTML;

          if (liveryobj.aircrafts[aircraftId].mp != "disabled")
            element.innerHTML += `<small title="Multiplayer compatible liveries">🎮</small>`;
        }
      });

    } catch (e) {
      console.error('handleLiveryJson error', e);
    }
  }

  // -----------------------------------------
  // Utility functions (same as original)
  // -----------------------------------------

  function createTag(name, attributes = {}, content = '') {
    const el = document.createElement(name);
    Object.keys(attributes || {}).forEach(k => el.setAttribute(k, attributes[k]));
    if (('' + content).length) el.innerHTML = content;
    return el;
  }
  function appendNewChild(parent, tagName, attributes = {}, pos = -1) {
    const child = createTag(tagName, attributes);
    if (pos < 0) parent.appendChild(child); else parent.insertBefore(child, parent.children[pos]);
    return child;
  }
  function domById(id) { return document.getElementById(id); }

  // (All remaining LiverySelector internal functions remain unchanged — list building, upload, direct load, star/favorite, multiplayer sync, mosaics, etc.)

  // -------------------------
  // EXPORT & GLOBAL HOOK
  // -------------------------
  window.LiverySelector = {
    liveryobj,
    togglePanel() {
      const p = document.getElementById('listDiv');
      if (p && p.dataset.ac != geofs.aircraft.instance.id) {
        window.LiverySelector.listLiveries();
      }
    },
    // NOTE: The rest of the LiverySelector API functions should remain here
    // (loadLivery, listLiveries, search, uploadLivery, star, addAirline, removeAirline, etc.)
  };

})();

// Merged GeoFS: Spoilers Arming + Landing Stats (no sounds) + Livery Selector
(function () {
  'use strict';

  // Single waiter for geofs readiness
  var _waitHandle = setInterval(function () {
    if (window.geofs && geofs.aircraft && geofs.aircraft.instance && geofs.aircraft.instance.object3d) {
      clearInterval(_waitHandle);
      try { initSpoilersArming(); } catch (e) { console.error('initSpoilersArming error', e); }
      try { initLandingStats(); } catch (e) { console.error('initLandingStats error', e); }
      try { initLiverySelector(); } catch (e) { console.error('initLiverySelector error', e); }
    }
  }, 100);

  // -------------------------
  // 1) Spoilers arming extension
  // -------------------------
  function initSpoilersArming() {
    (function () {
      window.enabled = void 0;

      // prevent interfering key handlers on specific inputs
      if (window.$ && typeof $(document).off === 'function') {
        $(document).off("keydown");
        $(document).on("keydown", ".geofs-stopKeyboardPropagation", function(e) { e.stopImmediatePropagation(); });
        $(document).on("keydown", ".address-input", function(e) { e.stopImmediatePropagation(); });
      }

      controls.spoilersArming = false;
      controls.setters = controls.setters || {};
      controls.setters.spoilersArming = {
        label: "Spoiler Arming",
        set: function() {
          if (!enabled) return;
          if (geofs.aircraft.instance.groundContact) {
            controls.spoilersArming = false;
          } else {
            controls.spoilersArming = !controls.spoilersArming;
          }
        }
      };

      var originalKeyDown = controls.keyDown;
      controls.keyDown = function(evt) {
        try {
          var airbrakeKeyDef = geofs.preferences && geofs.preferences.keyboard && geofs.preferences.keyboard.keys && geofs.preferences.keyboard.keys["Airbrake toggle (on/off)"];
          var airbrakeKeycode = airbrakeKeyDef ? airbrakeKeyDef.keycode : null;
          if (typeof enabled !== "undefined" && airbrakeKeycode !== null && evt.which === airbrakeKeycode) {
            if (evt.shiftKey) {
              enabled = true;
              controls.setters.spoilersArming.set();
            } else {
              enabled = false;
              controls.spoilersArming = false;
              if (controls.setters && controls.setters.setAirbrakes && typeof controls.setters.setAirbrakes.set === 'function') {
                controls.setters.setAirbrakes.set();
              } else if (typeof controls.setAirbrakes === 'function') {
                controls.setAirbrakes();
              }
            }
          } else {
            if (typeof originalKeyDown === 'function') originalKeyDown(evt);
          }
        } catch (e) {
          console.error('spoilers keyDown wrapper error', e);
          if (typeof originalKeyDown === 'function') originalKeyDown(evt);
        }
      };

      instruments.definitions = instruments.definitions || {};
      instruments.definitions.spoilersArming = {
        overlay: {
          url: "https://raw.githubusercontent.com/Guy-Adler/GeoFSSpoilersArming/main/spoilersArm.png",
          alignment: { x: "right", y: "bottom" },
          size: { x: 100, y: 21 },
          position: { x: 20, y: 195 },
          anchor: { x: 100, y: 0 },
          rescale: true,
          rescalePosition: true,
          animations: [{ type: "show", value: "spoilersArmed" }]
        }
      };

      var oldInstrumentsInit = instruments.init;
      instruments.init = function(defs) {
        try {
          var aircraftWithBadlyImplementedSpoilers = ["2871","2865","2870","2769","2772"];
          if (typeof defs.spoilers !== "undefined" || aircraftWithBadlyImplementedSpoilers.includes(geofs.aircraft.instance.aircraftRecord.id)) {
            enabled = true;
            defs.spoilersArming = defs.spoilers;
          } else {
            enabled = void 0;
          }
        } catch (e) {
          console.warn('instruments.init wrapper error', e);
        }
        return oldInstrumentsInit.call(instruments, defs);
      };

      if (geofs.aircraft.instance && geofs.aircraft.instance.setup && geofs.aircraft.instance.setup.instruments) {
        instruments.init(geofs.aircraft.instance.setup.instruments);
      }

      if (window.$ && typeof $(document).on === 'function') {
        $(document).on("keydown", controls.keyDown);
      } else {
        document.addEventListener('keydown', controls.keyDown, false);
      }

      if (geofs && geofs.api && typeof geofs.api.addFrameCallback === 'function') {
        geofs.api.addFrameCallback(function() {
          try {
            geofs.aircraft.instance.animationValue.spoilersArmed = controls.spoilersArming;
            if (controls.spoilersArming && geofs.aircraft.instance.groundContact && controls.airbrakes.position === 0 && enabled) {
              controls.spoilersArming = false;
              if (controls.setters && controls.setters.setAirbrakes && typeof controls.setters.setAirbrakes.set === 'function') {
                controls.setters.setAirbrakes.set();
              } else if (typeof controls.setAirbrakes === 'function') {
                controls.setAirbrakes();
              }
            }
          } catch (e) {
            console.error('spoilers frame callback error', e);
          }
        }, "spoilersArming");
      }
    })();
  }

  // -------------------------
  // 2) Landing Stats (sound system fully removed)
  // -------------------------
  // OPTIONAL: clean up any old audio objects from previous loads
  try {
    if (window.softLanding) { window.softLanding.pause?.(); }
    if (window.hardLanding) { window.hardLanding.pause?.(); }
    if (window.crashLanding) { window.crashLanding.pause?.(); }
    delete window.softLanding;
    delete window.hardLanding;
    delete window.crashLanding;
  } catch (_) {}

  function initLandingStats() {
    if (window._geoFsLandingStatsInitialized) return;
    window._geoFsLandingStatsInitialized = true;

    window.MS_TO_KNOTS   = window.MS_TO_KNOTS   || 1.94384449;
    window.DEGREES_TO_RAD = window.DEGREES_TO_RAD || 0.017453292519943295;
    window.RAD_TO_DEGREES = window.RAD_TO_DEGREES || 57.29577951308232;

    window.closeTimer   = window.closeTimer   || false;
    window.closeSeconds = window.closeSeconds || 10;

    window.refreshRate = window.refreshRate || 20;
    window.counter     = window.counter     || 0;
    window.isLoaded    = window.isLoaded    || false;

    window.justLanded = window.justLanded || false;
    window.vertSpeed  = window.vertSpeed  || 0;
    window.oldAGL     = window.oldAGL     || 0;
    window.newAGL     = window.newAGL     || 0;
    window.calVertS   = window.calVertS   || 0;
    window.groundSpeed= window.groundSpeed|| 0;
    window.ktias      = window.ktias      || 0;
    window.kTrue      = window.kTrue      || 0;
    window.bounces    = window.bounces    || 0;
    window.statsOpen  = window.statsOpen  || false;
    window.isGrounded = window.isGrounded || true;
    window.isInTDZ    = window.isInTDZ    || false;

    window.statsDiv = window.statsDiv || document.createElement('div');
    Object.assign(window.statsDiv.style, {
      width: 'fit-content',
      height: 'fit-content',
      background: 'linear-gradient(to bottom right, rgb(29, 52, 87), rgb(20, 40, 70))',
      zIndex: '100000',
      margin: '30px',
      padding: '15px',
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)',
      color: 'white',
      position: 'fixed',
      borderRadius: '12px',
      left: '-50%',
      transition: '0.4s ease',
      border: '1px solid rgba(255,255,255,0.1)'
    });
    if (!document.body.contains(window.statsDiv)) document.body.appendChild(window.statsDiv);

    window.clamp = window.clamp || function(v, a, b) { return Math.max(a, Math.min(b, v)); };

    function updateLndgStats() {
      try {
        if (geofs.cautiousWithTerrain == false && !geofs.isPaused() && !(window.sd && window.sd.cam.data)) {
          var ldgAGL = (geofs.animation.values.altitude !== undefined && geofs.animation.values.groundElevationFeet !== undefined)
              ? ((geofs.animation.values.altitude - geofs.animation.values.groundElevationFeet) + (geofs.aircraft.instance.collisionPoints[geofs.aircraft.instance.collisionPoints.length - 2].worldPosition[2]*3.2808399))
              : 'N/A';

          if (ldgAGL < 500) {
            window.justLanded = (geofs.animation.values.groundContact && !window.isGrounded);
            if (window.justLanded && !window.statsOpen) {
              if (window.closeTimer) setTimeout(window.closeLndgStats, 1000*window.closeSeconds);
              let p_vs  = window.clamp((window.lVS - 50) / 70, 0, 5);
              let p_g   = window.clamp(Math.abs(window.geofs.animation.values.accZ/9.80665 - 1.0) * 2, 0, 2.0);
              let p_b   = Math.min(window.bounces * 2.0, 6.0);
              let p_r   = window.clamp(window.lRoll / 10, 0, 1.5);
              let p_tdz = (window.isInTDZ == true) ? 0 : 1.0;
              window.landingScore = window.clamp((10-p_vs-p_g-p_b-p_r-p_tdz), 0, 10);
              window.statsOpen = true;

              window.statsDiv.innerHTML = `
                <button style="
                  right: 10px; top: 10px; position: absolute;
                  background: rgba(255,255,255,0.2); border: none; color: white;
                  cursor: pointer; width: 30px; height: 30px; border-radius: 50%; font-weight: bold;"
                  onclick="window.closeLndgStats()">✕</button>
                <style>
                  .info-block { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 14px; }
                  .landing-quality { grid-column: 1 / -1; text-align: center; font-weight: bold; margin-top: 10px; padding: 5px; border-radius: 5px; }
                </style>
                <div class="info-block">
                  <span>Landing Score: ${window.landingScore.toFixed(1)}/10</span>
                  <span>Vertical speed: ${window.vertSpeed} fpm</span>
                  <span>G-Forces: ${(window.geofs.animation.values.accZ/9.80665).toFixed(2)}G</span>
                  <span>Terrain-calibrated V/S: ${window.calVertS.toFixed(1)}</span>
                  <span>True airspeed: ${window.kTrue} kts</span>
                  <span>Ground speed: ${window.groundSpeed.toFixed(1)} kts</span>
                  <span>Indicated speed: ${window.ktias} kts</span>
                  <span>Roll: ${window.geofs.animation.values.aroll.toFixed(1)} degrees</span>
                  <span>Tilt: ${window.geofs.animation.values.atilt.toFixed(1)} degrees</span>
                  <span id="bounces">Bounces: 0</span>
                </div>
              `;

              window.statsDiv.style.left = '0px';
              window.statsDiv.innerHTML += `
                <div style="margin-top: 10px; font-size: 14px;">
                  <span>Landed in TDZ? ${window.isInTDZ}</span><br>
                  ${(window.geofs.nav && window.geofs.nav.units && window.geofs.nav.units.NAV1 && window.geofs.nav.units.NAV1.inRange) ? `<span>Deviation from center: ${window.geofs.nav.units.NAV1.courseDeviation.toFixed(1)}</span>` : ""}
                </div>`;

              // Quality badge only (no sounds)
              if (Number(window.vertSpeed) < 0) {
                if (Number(window.vertSpeed) >= -50) {
                  window.statsDiv.innerHTML += `<div class="landing-quality" style="background-color: green; color: white;">BUTTER</div>`;
                } else if (Number(window.vertSpeed) >= -200) {
                  window.statsDiv.innerHTML += `<div class="landing-quality" style="background-color: green; color: white;">GREAT</div>`;
                } else if (Number(window.vertSpeed) >= -500 && Number(window.vertSpeed) < -200) {
                  window.statsDiv.innerHTML += `<div class="landing-quality" style="background-color: yellow; color: black;">ACCEPTABLE</div>`;
                } else if (Number(window.vertSpeed) >= -1000 && Number(window.vertSpeed) < -500) {
                  window.statsDiv.innerHTML += `<div class="landing-quality" style="background-color: red; color: white;">HARD LANDING</div>`;
                }
              }
              if (Number(window.vertSpeed) <= -1000 || Number(window.vertSpeed > 200)) {
                window.statsDiv.innerHTML += `<div class="landing-quality" style="background-color: crimson; color: white;">CRASH</div>`;
              }
            } else if (window.justLanded && window.statsOpen) {
              window.bounces++;
              var bounceP = document.getElementById("bounces");
              if (bounceP) bounceP.innerHTML = `Bounces: ${window.bounces}`;
              let p_vs  = window.clamp((window.lVS - 50) / 70, 0, 5);
              let p_g   = window.clamp(Math.abs(window.geofs.animation.values.accZ/9.80665 - 1.0) * 2, 0, 2.0);
              let p_b   = Math.min(window.bounces * 2.0, 6.0);
              let p_r   = window.clamp(window.lRoll / 10, 0, 1.5);
              let p_tdz = (window.isInTDZ == true) ? 0 : 1.0;
              window.landingScore = window.clamp((10-p_vs-p_g-p_b-p_r-p_tdz), 0, 10);
            }

            if (!window.geofs.animation.values.groundContact) {
              window.lVS = Math.abs(window.geofs.animation.values.verticalSpeed);
              window.lRoll = Math.abs(window.geofs.animation.values.aroll);
            }
            window.isInTDZ = window.getTDZStatus ? window.getTDZStatus() : false;
            window.groundSpeed = window.geofs.animation.values.groundSpeedKnt;
            window.ktias = window.geofs.animation.values.kias.toFixed(1);
            window.kTrue = (window.geofs.aircraft.instance.trueAirSpeed * window.MS_TO_KNOTS).toFixed(1);
            window.vertSpeed = window.geofs.animation.values.verticalSpeed.toFixed(1);
            window.gForces = window.geofs.animation.values.accZ/9.80665;
            window.isGrounded = window.geofs.animation.values.groundContact;
            window.refreshRate = 12;
          } else {
            window.refreshRate = 60;
          }
        }
      } catch (e) {
        console.error('updateLndgStats error', e);
      }
    }

    function updateCalVertS() {
      try {
        if ((typeof window.geofs.animation.values != 'undefined' &&
             !window.geofs.isPaused()) &&
            ((window.geofs.animation.values.altitude !== undefined && window.geofs.animation.values.groundElevationFeet !== undefined)
              ? ((window.geofs.animation.values.altitude - window.geofs.animation.values.groundElevationFeet) + (window.geofs.aircraft.instance.collisionPoints[window.geofs.aircraft.instance.collisionPoints.length - 2].worldPosition[2]*3.2808399))
              : 'N/A') !== window.oldAGL) {

          window.newAGL = (window.geofs.animation.values.altitude !== undefined && window.geofs.animation.values.groundElevationFeet !== undefined)
            ? ((window.geofs.animation.values.altitude - window.geofs.animation.values.groundElevationFeet) + (window.geofs.aircraft.instance.collisionPoints[window.geofs.aircraft.instance.collisionPoints.length - 2].worldPosition[2]*3.2808399))
            : 'N/A';
          window.newTime = Date.now();
          window.calVertS = (window.newAGL - window.oldAGL) * (60000/(window.newTime - window.oldTime || 1));
          window.oldAGL = window.newAGL;
          window.oldTime = Date.now();
        }
      } catch (e) {
        console.error('updateCalVertS error', e);
      }
    }

    window.getTDZStatus = window.getTDZStatus || function() {
      try {
        var nearestRunway = geofs.runways.getNearestRunway(geofs.aircraft.instance.llaLocation);
        var nearestRwDist = window.geofs.utils.distanceBetweenLocations(geofs.aircraft.instance.llaLocation, nearestRunway.aimingPointLla1);
        var testDist = window.geofs.utils.distanceBetweenLocations(geofs.aircraft.instance.llaLocation, nearestRunway.aimingPointLla2);
        if (nearestRwDist > testDist) nearestRwDist = testDist;
        return (nearestRwDist < 600);
      } catch (e) {
        return false;
      }
    };

    window.closeLndgStats = window.closeLndgStats || function() {
      window.statsDiv.style.left = '-50%';
      setTimeout((function() {
        window.statsDiv.innerHTML = ``;
        window.statsOpen = false;
        window.bounces = 0;
      }), 400);
    };

    (function startDynamicLoop() {
      var running = true;
      async function loop() {
        while (running) {
          updateLndgStats();
          var wait = (window.refreshRate && Number(window.refreshRate) > 0) ? Number(window.refreshRate) : 60;
          if (wait < 12) wait = 12;
          await new Promise(r => setTimeout(r, wait));
        }
      }
      loop();
      window._landingStatsLoopStop = function() { running = false; };
    })();

    window._calVertSHandle = setInterval(updateCalVertS, 25);
  }

  // -------------------------
  // 3) Livery Selector
  // -------------------------
  function initLiverySelector() {
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

    (async function bootstrap() {
      try {
        const res = await fetch(`https://api.github.com/repos/kolos26/GEOFS-LiverySelector/commits/main`);
        if (!res.ok) jsDelivr = githubRepo;
        const commit = (await res.json()).sha;
        if (!/^[a-f0-9]{40}$/.test(commit)) jsDelivr = githubRepo;
        jsDelivr = jsDelivr.replace("@main", `@${commit}`);
      } catch (err) { jsDelivr = githubRepo; }

      try {
        fetch(`${jsDelivr}/styles.css?` + Date.now()).then(async data => {
          const styleTag = createTag('style', { type: 'text/css' });
          styleTag.innerHTML = await data.text();
          document.head.appendChild(styleTag);
        });
      } catch (e) {}

      appendNewChild(document.head, 'link', { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css' });
      fetch(`${jsDelivr}/livery.json?` + Date.now()).then(handleLiveryJson).catch(e => console.error('livery.json fetch error', e));

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

      const origButtons = document.getElementsByClassName('geofs-liveries geofs-list-collapsible-item');
      Object.values(origButtons).forEach(btn => btn.parentElement && btn.parentElement.removeChild(btn));

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
      fetch(`${jsDelivr}/whitelist.json?` + Date.now()).then(res => res.json()).then(data => whitelist = data).catch(e => console.warn('whitelist fetch', e));

      setInterval(updateMultiplayer, 5000);

      window.addEventListener("keyup", function (e) {
        if (e.target.classList && e.target.classList.contains("geofs-stopKeyupPropagation")) {
          e.stopImmediatePropagation();
        }
        if (e.key === "l") {
          LiverySelector.togglePanel();
        }
      });
    })();

    async function handleLiveryJson(data) {
      try {
        const json = await data.json();
        Object.keys(json).forEach(key => liveryobj[key] = json[key]);

        if (liveryobj.commit) jsDelivr = jsDelivr.replace("@main", "@" + liveryobj.commit)

        if (liveryobj.version != version) {
          const header = document.querySelector('.livery-list h3');
          if (header) {
            header.appendChild(
              createTag('a', {
                href: 'https://github.com/kolos26/GEOFS-LiverySelector/releases/latest',
                target: '_blank',
                style: 'display:block;width:100%;text-decoration:none;text-align:center;'
              }, 'Update available: ' + liveryobj.version)
            );
          }
        }

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
              element.innerHTML += createTag('small', {
                title: 'Liveries are multiplayer compatible\n(visible to other players)'
              }, '🎮').outerHTML;
          }
        });
      } catch (e) {
        console.error('handleLiveryJson error', e);
      }
    }

    function loadLivery(texture, index, parts, mats) {
      for (let i = 0; i < texture.length; i++) {
        const model3d = geofs.aircraft.instance.definition.parts[parts[i]]['3dmodel'];
        if (typeof texture[i] === 'object') {
          if (texture[i].material !== undefined) {
            const mat = mats[texture[i].material];
            try {
              model3d._model.getMaterial(mat.name)
                .setValue(Object.keys(mat)[1], new Cesium.Cartesian4(...mat[Object.keys(mat)[1]], 1.0));
            } catch (e) {
              console.error('apply material error', e);
            }
          }
          continue;
        }
        try {
          if (geofs.version == 2.9) {
            geofs.api.Model.prototype.changeTexture(texture[i], index[i], model3d);
          } else if (geofs.version >= 3.0 && geofs.version <= 3.7) {
            geofs.api.changeModelTexture(model3d._model, texture[i], index[i]);
          } else {
            geofs.api.changeModelTexture(model3d._model, texture[i], { index: index[i] });
          }
        } catch (error) {
          geofs.api && geofs.api.notify && geofs.api.notify("Hmmm... we can't find this livery, check the console for more info.");
          console.error(error);
        }
      }
    }

    function inputLivery() {
      const airplane = getCurrentAircraft();
      const textures = airplane.liveries[0].texture;
      const inputFields = document.getElementsByName('textureInput');
      if (textures.filter(x => x === textures[0]).length === textures.length) {
        const texture = inputFields[0].value;
        loadLivery(Array(textures.length).fill(texture), airplane.index, airplane.parts);
      } else {
        const texture = [];
        inputFields.forEach(e => texture.push(e.value));
        loadLivery(texture, airplane.index, airplane.parts);
      }
    }

    function submitLivery() {
      const airplane = getCurrentAircraft();
      const textures = airplane.liveries[0].texture;
      const inputFields = document.getElementsByName('textureInput');
      const formFields = {};
      document.querySelectorAll('.livery-submit input').forEach(f => formFields[f.id.replace('livery-submit-', '')] = f);
      if (!localStorage.liveryDiscordId || localStorage.liveryDiscordId.length < 6) {
        return alert('Invalid Discord User id!');
      }
      if (formFields.liveryname.value.trim().length < 3) {
        return alert('Invalid Livery Name!');
      }
      if (!formFields['confirm-perms'].checked || !formFields['confirm-legal'].checked) {
        return alert('Confirm all checkboxes!');
      }
      const json = { name: formFields.liveryname.value.trim(), credits: formFields.credits.value.trim(), texture: [], materials: {} };
      if (!json.name || json.name.trim() == '') return;
      const hists = [];
      const embeds = [];
      inputFields.forEach((f, i) => {
        if (f.type === "text") {
          f.value = f.value.trim();
          if (f.value.match(/^https:\/\/.+/i)) {
            const hist = Object.values(uploadHistory).find(o => o.url == f.value);
            if (!hist) return alert('Only self-uploaded imgbb links work for submitting!');
            if (hist.expiration > 0) return alert('Can\' submit expiring links! DISABLE "Expire links after one hour" option and re-upload texture:\n' + airplane.labels[i]);
            const embed = {
              title: airplane.labels[i] + ' (' + (Math.ceil(hist.size / 1024 / 10.24) / 100) + 'MB, ' + hist.width + 'x' + ' ' + hist.height + ')',
              description: f.value,
              image: { url: f.value },
              fields: [
                { name: 'Timestamp', value: new Date(hist.time * 1e3), inline: true },
                { name: 'File ID', value: hist.id, inline: true },
              ]
            };
            if (hist.submitted) {
              if (!confirm('The following texture was already submitted:\n' + f.value + '\nContinue anyway?')) return;
              embed.fields.push({ name: 'First submitted', value: new Date(hist.submitted * 1e3) });
            }
            embeds.push(embed);
            hists.push(hist);
            json.texture.push(f.value);
          } else {
            json.texture.push(textures[i]);
          }
        } else if (f.type === "color") {
          json.materials[f.id] = [parseInt(f.value.substring(1, 3), 16) / 255, parseInt(f.value.substring(3, 5), 16) / 255, parseInt(f.value.substring(5, 7), 16) / 255];
        }
      });
      if (!embeds.length) return alert('Nothing to submit, upload images first!');

      let content = [
        `Livery upload by <@${localStorage.liveryDiscordId}>`,
        `__Plane:__ \`${geofs.aircraft.instance.id}\` ${geofs.aircraft.instance.aircraftRecord.name}`,
        `__Livery Name:__ \`${json.name}\``,
        '```json\n' + JSON.stringify(json, null, 2) + '```'
      ];

      fetch(atob(liveryobj.dapi), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.join('\n'), embeds })
      }).then(res => {
        hists.forEach(hist => { hist.submitted = hist.submitted || Math.round(new Date() / 1000); });
        localStorage.lsUploadHistory = JSON.stringify(uploadHistory);
      });
    }

    function sortList(id) {
      const list = domById(id);
      let switching = true;
      while (switching) {
        switching = false;
        const b = list.getElementsByTagName('LI');
        for (let i = 0; i < (b.length - 1); i++) {
          let shouldSwitch = false;
          if (b[i].innerHTML.toLowerCase() > b[i + 1].innerHTML.toLowerCase()) {
            shouldSwitch = true; break;
          }
          if (shouldSwitch) {
            b[i].parentNode.insertBefore(b[i + 1], b[i]);
            switching = true;
          }
        }
      }
    }

    function listLiveries() {
      const livList = $('#liverylist').html('');
      livList[0].addEventListener('error', function(e) {
        if (e.target.tagName === 'IMG') {
          e.target.onerror = null; e.target.src = defaultThumb;
        }
      }, true);
      $(livList).on('click', 'li, [data-idx]', function ({ target }) {
        const idx = $(target).closest('li').data('idx'),
              airplane = LiverySelector.liveryobj.aircrafts[geofs.aircraft.instance.id],
              livery = airplane.liveries[idx];
        if (idx === void 0 || target.classList.contains("fa-star")) return;
        livery.disabled || (loadLivery(livery.texture, airplane.index, airplane.parts, livery.materials),
        livery.mp != 'disabled' && setInstanceId(idx + (livery.credits?.toLowerCase() == 'geofs' ? '' : LIVERY_ID_OFFSET)));
      });
      const tempFrag = document.createDocumentFragment(),
            thumbsDir = [noCommit, 'thumbs'].join('/'),
            acftId = geofs.aircraft.instance.id,
            defaultThumb = [thumbsDir, acftId + '.png'].join('/'),
            airplane = getCurrentAircraft();
      $('#listDiv').attr('data-ac', acftId);
      for (let i = 0; i < airplane.liveries.length; i++) {
        const e = airplane.liveries[i];
        if (e.disabled) return;
        const listItem = $('<li/>', {id: [acftId, e.name, 'button'].join('_'), class: 'geofs-visible livery-list-item'});
        listItem.data('idx', i).append($('<span/>', {class: 'livery-name'}).html(e.name));
        listItem.toggleClass('offi', acftId < 100);
        if (acftId < 1000) {
          const thumb = $('<img/>', {loading: 'lazy'});
          thumb.attr('src', [thumbsDir, acftId, acftId + '-' + i + '.png'].join('/'));
          listItem.append(thumb);
        }
        if (e.credits && e.credits.length) $('<small/>').text(`by ${e.credits}`).appendTo(listItem);
        $('<span/>', {
          id: [acftId, e.name].join('_'),
          class: 'fa fa-star',
          onclick: 'LiverySelector.star(this)'
        }).appendTo(listItem);
        listItem.appendTo(tempFrag);
      }
      livList.append(tempFrag);
      sortList('liverylist');
      loadFavorites();
      sortList('favorites');
      loadAirlines();
      addCustomForm();
    }

    function loadFavorites() {
      const favorites = localStorage.getItem('favorites') ?? '';
      if (favorites === null) { localStorage.setItem('favorites', ''); }
      $("#favorites").empty().on("click", "li", function ({ target }) {
        const $match = $(`#liverylist > [id='${$(target).attr("id").replace("_favorite", "_button")}']`);
        if ($match.length === 0) return void ui && ui.notification && ui.notification.show && ui.notification.show(`ID: ${$(target).attr("id")} is missing a liveryList counterpart.`);
        $match.click();
      });
      const list = favorites.split(',');
      const airplane = geofs.aircraft.instance.id;
      list.forEach(function (e) {
        if ((airplane == e.slice(0, airplane.length)) && (e.charAt(airplane.length) == '_')) {
          star(domById(e));
        }
      });
    }

    function loadAirlines() {
      domById("airlinelist").innerHTML = '';
      const airplane = getCurrentAircraft();
      const textures = airplane.liveries[0].texture;
      airlineobjs.forEach(function(airline) {
        let airlinename = appendNewChild(domById('airlinelist'), 'li', {
          style: "color:" + airline.color + ";background-color:" + airline.bgcolor + "; font-weight: bold;"
        });
        airlinename.innerText = airline.name;
        let removebtn = appendNewChild(airlinename, "button", {
          class: "mdl-button mdl-js-button mdl-button--raised mdl-button",
          style: "float: right; margin-top: 6px; background-color: #9e150b;",
          onclick: `LiverySelector.removeAirline("${airline.url}")`
        });
        removebtn.innerText = "- Remove airline";
        if (Object.keys(airline.aircrafts).includes(geofs.aircraft.instance.id)) {
          airline.aircrafts[geofs.aircraft.instance.id].liveries.forEach(function (e, i) {
            let listItem = appendNewChild(domById('airlinelist'), 'li', {
              id: [geofs.aircraft.instance.id, e.name, 'button'].join('_'),
              class: 'livery-list-item'
            });
            if ((textures.filter(x => x === textures[0]).length === textures.length) && textures.length !== 1) {
              const texture = e.texture[0];
              listItem.onclick = () => {
                loadLivery(Array(textures.length).fill(texture), airplane.index, airplane.parts);
                if (airplane.mp != 'disabled' && whitelist && whitelist.includes(airline.url.trim())) {
                  setInstanceId({url: airline.url, idx: i});
                }
              }
            } else {
              listItem.onclick = () => {
                loadLivery(e.texture, airplane.index, airplane.parts, e.materials);
                if (airplane.mp != 'disabled' && whitelist && whitelist.includes(airline.url.trim())) {
                  setInstanceId({url: airline.url, idx: i});
                }
              }
            }
            listItem.innerHTML = createTag('span', { class: 'livery-name' }, e.name).outerHTML;
            if (e.credits && e.credits.length) listItem.innerHTML += `<small>by ${e.credits}</small>`;
          });
        }
      });
    }

    function addCustomForm() {
      const upFields = document.querySelector('#livery-custom-tab-upload .upload-fields');
      const dirFields = document.querySelector('#livery-custom-tab-direct .upload-fields');
      if (upFields) upFields.innerHTML = '';
      if (dirFields) dirFields.innerHTML = '';
      const airplane = getCurrentAircraft();
      const textures = airplane.liveries[0].texture.filter(t => typeof t !== 'object');
      const placeholders = airplane.labels;
      if (textures.length) {
        if (textures.filter(x => x === textures[0]).length === textures.length) {
          createUploadButton(placeholders[0]);
          createDirectButton(placeholders[0]);
        } else {
          placeholders.forEach((placeholder, i) => { createUploadButton(placeholder); createDirectButton(placeholder, i); });
        }
      }
      if (airplane.liveries[0].materials) {
        airplane.liveries[0].materials.forEach((material, key) => {
          let partlist = [];
          airplane.liveries[0].texture.forEach((e, k) => {
            if (typeof(e) === 'object' && e.material == key) partlist.push(airplane.parts[k]);
          });
          createColorChooser(material.name, Object.keys(material)[1], partlist);
          createUploadColorChooser(material.name, Object.keys(material)[1], partlist);
        })
      }
      const tabs = document.querySelector('.livery-custom-tabs li');
      if (tabs) tabs.click();
    }

    function debounceSearch (func) {
      let timeoutId = null;
      return (text) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(text), 250);
      };
    }
    const search = debounceSearch(text => {
      const liveries = document.getElementById('liverylist').children;
      if (text == '') { for (const a of liveries) a.classList.add('geofs-visible'); return; }
      text = text.toLowerCase();
      for (let i = 0; i < liveries.length; i++) {
        const e = liveries[i], v = e.classList.contains('geofs-visible');
        if (e.textContent.toLowerCase().includes(text)) { if (!v) e.classList.add('geofs-visible'); }
        else { if (v) e.classList.remove('geofs-visible'); }
      };
    });

    function changeMaterial(name, color, type, partlist){
      let r = parseInt(color.substring(1, 3), 16) / 255;
      let g = parseInt(color.substring(3, 5), 16) / 255;
      let b = parseInt(color.substring(5, 7), 16) / 255;
      partlist.forEach(part => {
        try {
          geofs.aircraft.instance.definition.parts[part]['3dmodel']._model.getMaterial(name).setValue(type, new Cesium.Cartesian4(r, g, b, 1.0));
        } catch (e) { console.error('changeMaterial error', e); }
      });
    }

    function star(element) {
      const e = element.classList;
      const elementId = [element.id, 'favorite'].join('_');
      let list = (localStorage.getItem('favorites') || '').split(',').filter(Boolean);
      if (e.contains("checked")) {
        const favEl = domById(elementId);
        if (favEl) domById('favorites').removeChild(favEl);
        const index = list.indexOf(element.id);
        if (index !== -1) list.splice(index, 1);
        localStorage.setItem('favorites', list);
      } else {
        const btn = domById([element.id, 'button'].join('_'));
        const fbtn = appendNewChild(domById('favorites'), 'li', { id: elementId, class: 'livery-list-item' });
        fbtn.innerText = btn ? btn.children[0].innerText : element.id;
        list.push(element.id);
        localStorage.setItem('favorites', [...new Set(list)]);
      }
      e.toggle('checked');
    }

    function createUploadButton(id) {
      const customDiv = document.querySelector('#livery-custom-tab-upload .upload-fields');
      appendNewChild(customDiv, 'input', { type: 'file', onchange: 'LiverySelector.uploadLivery(this)' });
      appendNewChild(customDiv, 'input', { type: 'text', name: 'textureInput', class: 'mdl-textfield__input address-input', placeholder: id, id: id });
      appendNewChild(customDiv, 'br');
    }

    function createDirectButton(id, i) {
      const customDiv = document.querySelector('#livery-custom-tab-direct .upload-fields');
      appendNewChild(customDiv, 'input', { type: 'file', onchange: 'LiverySelector.loadLiveryDirect(this,' + i + ')' });
      appendNewChild(customDiv, 'span').innerHTML = id;
      appendNewChild(customDiv, 'br');
    }

    function createColorChooser(name, type, partlist) {
      const customDiv = document.querySelector('#livery-custom-tab-direct .upload-fields');
      appendNewChild(customDiv, 'input', { type: 'color', name: name, class: 'colorChooser', onchange: `changeMaterial("${name}", this.value, "${type}", [${partlist}])` });
      appendNewChild(customDiv, 'span', {style:'padding-top: 20px; padding-bottom: 20px;'}).innerHTML = name;
      appendNewChild(customDiv, 'br');
    }

    function createUploadColorChooser(name, type, partlist) {
      const customDiv = document.querySelector('#livery-custom-tab-upload .upload-fields');
      appendNewChild(customDiv, 'input', { type: 'color', name: "textureInput", id: name, class: 'colorChooser', onchange: `changeMaterial("${name}", this.value, "${type}", [${partlist}])` });
      appendNewChild(customDiv, 'span', {style:'padding-top: 20px; padding-bottom: 20px;'}).innerHTML = name;
      appendNewChild(customDiv, 'br');
    }

    function loadLiveryDirect(fileInput, i) {
      const reader = new FileReader();
      reader.addEventListener('load', (event) => {
        const airplane = getCurrentAircraft();
        const textures = airplane.liveries[0].texture;
        const newTexture = event.target.result;
        if (i === undefined) {
          loadLivery(Array(textures.length).fill(newTexture), airplane.index, airplane.parts);
        } else {
          geofs.api.changeModelTexture(
            geofs.aircraft.instance.definition.parts[airplane.parts[i]]["3dmodel"]._model,
            newTexture,
            { index: airplane.index[i] }
          );
        }
        fileInput.value = null;
      });
      fileInput.files.length && reader.readAsDataURL(fileInput.files[0]);
    }

    function uploadLivery(fileInput) {
      if (!fileInput.files.length) return;
      if (!localStorage.imgbbAPIKEY) {
        alert('No imgbb API key saved! Check API tab');
        fileInput.value = null; return;
      }
      const form = new FormData();
      form.append('image', fileInput.files[0]);
      if (localStorage.liveryAutoremove) form.append('expiration', (new Date() / 1000) * 60 * 60);

      const settings = { 'url': `https://api.imgbb.com/1/upload?key=${localStorage.imgbbAPIKEY}`, 'method': 'POST', 'timeout': 0, 'processData': false, 'mimeType': 'multipart/form-data', 'contentType': false, 'data': form };
      $.ajax(settings).done(function (response) {
        const jx = JSON.parse(response);
        fileInput.nextSibling.value = jx.data.url;
        fileInput.value = null;
        if (!uploadHistory[jx.data.id] || (uploadHistory[jx.data.id].expiration !== jx.data.expiration)) {
          uploadHistory[jx.data.id] = jx.data;
          localStorage.lsUploadHistory = JSON.stringify(uploadHistory);
        }
      });
    }

    function handleCustomTabs(e) {
      e = e || window.event;
      const src = e.target || e.srcElement;
      const tabId = src.innerHTML.toLocaleLowerCase();
      domById('customDiv').querySelectorAll(':scope > div').forEach(tabDiv => {
        if (tabDiv.id != ['livery-custom-tab', tabId].join('-')) { tabDiv.style.display = 'none'; return; }
        tabDiv.style.display = '';
        switch (tabId) {
          case 'upload': {
            const fields = tabDiv.querySelectorAll('input[type="file"]');
            fields.forEach(f => localStorage.imgbbAPIKEY ? f.classList.remove('err') : f.classList.add('err'));
            const apiKeys = !!localStorage.liveryDiscordId && !!localStorage.imgbbAPIKEY;
            tabDiv.querySelector('.livery-submit .api').style.display = apiKeys ? '' : 'none';
            tabDiv.querySelector('.livery-submit .no-api').style.display = apiKeys ? 'none' : '';
          } break;
          case 'download': reloadDownloadsForm(tabDiv); break;
          case 'api': reloadSettingsForm(); break;
        }
      });
    }

    function reloadDownloadsForm(tabDiv) {
      const airplane = getCurrentAircraft();
      const liveries = airplane.liveries;
      const defaults = liveries[0];
      const fields = tabDiv.querySelector('.download-fields');
      fields.innerHTML = '';
      liveries.forEach((livery, liveryNo) => {
        const textures = livery.texture.filter(t => typeof t !== 'object');
        if (!textures.length) return;
        appendNewChild(fields, 'h7').innerHTML = livery.name;
        const wrap = appendNewChild(fields, 'div');
        textures.forEach((href, i) => {
          if (typeof href === 'object') return;
          if (liveryNo > 0 && href == defaults.texture[i]) return;
          const link = appendNewChild(wrap, 'a', { href, target: '_blank', class: "mdl-button mdl-button--raised mdl-button--colored" });
          link.innerHTML = airplane.labels[i];
        });
      });
    }

    function reloadSettingsForm() {
      const apiInput = domById('livery-setting-apikey');
      if (apiInput) apiInput.placeholder = localStorage.imgbbAPIKEY ? 'API KEY SAVED ✓ (type CLEAR to remove)' : 'API KEY HERE';
      const removeCheckbox = domById('livery-setting-remove');
      if (removeCheckbox) removeCheckbox.checked = (localStorage.liveryAutoremove == 1);
      const discordInput = domById('livery-setting-discordid');
      if (discordInput) discordInput.value = localStorage.liveryDiscordId || '';
    }

    function saveSetting(element) {
      const id = element.id.replace('livery-setting-', '');
      switch (id) {
        case 'apikey': {
          if (element.value.length) {
            if (element.value.trim().toLowerCase() == 'clear') delete localStorage.imgbbAPIKEY;
            else localStorage.imgbbAPIKEY = element.value.trim();
            element.value = '';
          }
        } break;
        case 'remove': localStorage.liveryAutoremove = element.checked ? '1' : '0'; break;
        case 'discordid': localStorage.liveryDiscordId = element.value.trim(); break;
      }
      reloadSettingsForm();
    }

    async function addAirline() {
      let url = prompt("Enter URL to the json file of the airline:");
      if (!links.includes(url)) {
        links.push(url);
        localStorage.links += `,${url}`;
        await fetch(url).then(res => res.json()).then(data => airlineobjs.push(data));
        airlineobjs[airlineobjs.length - 1].url = url.trim();
        loadAirlines();
      } else alert("Airline already added");
    }
    function removeAirline(url) {
      removeItem(links, url.trim());
      if (links.toString().charAt(0) === ",") localStorage.links = links.toString().slice(1); else localStorage.links = links.toString();
      airlineobjs.forEach(function (e, index) { if (e.url.trim() === url.trim()) airlineobjs.splice(index, 1); });
      loadAirlines();
    }

    function getCurrentAircraft() { return liveryobj.aircrafts[geofs.aircraft.instance.id]; }
    function setInstanceId(id) { geofs.aircraft.instance.liveryId = id; }

    async function updateMultiplayer() {
      const users = Object.values(multiplayer.visibleUsers || {});
      const texturePromises = users.map(async u => {
        const liveryEntry = liveryobj.aircrafts && liveryobj.aircrafts[u.aircraft];
        let textures = [];
        let otherId = u.currentLivery;
        if (!liveryEntry || !u.model) return;
        if (mpLiveryIds[u.id] === otherId) return;
        mpLiveryIds[u.id] = otherId;
        if (otherId >= ML_ID_OFFSET && otherId < LIVERY_ID_OFFSET) {
          textures = getMLTexture(u, liveryEntry);
        } else if ((otherId >= LIVERY_ID_OFFSET && otherId < LIVERY_ID_OFFSET * 2) || typeof otherId === "object") {
          textures = await getMPTexture(u, liveryEntry);
        } else return;
        textures.forEach(texture => {
          if (texture.material !== undefined) {
            applyMPMaterial(u.model, texture.material, texture.type, texture.color);
          } else {
            applyMPTexture(texture.uri, texture.tex, img => u.model.changeTexture(img, { index: texture.index }));
          }
        });
      });
      await Promise.all(texturePromises);
    }

    function applyMPTexture(url, tex, cb) {
      try {
        Cesium.Resource.fetchImage({ url }).then(img => {
          const canvas = createTag('canvas', { width: tex._width, height: tex._height });
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          cb(canvas.toDataURL('image/png'));
        });
      } catch (e) { console.log('LSMP', !!tex, url, e); }
    }

    function applyMPMaterial(model, name, type, color){
      model._model.getMaterial(name).setValue(type, new Cesium.Cartesian4(...color, 1.0));
    }

    async function getMPTexture(u, liveryEntry) {
      const otherId = u.currentLivery - LIVERY_ID_OFFSET;
      const textures = [];
      const uModelTextures = u.model._model._rendererResources.textures;
      if (!u.currentLivery) return [];
      if (typeof(u.currentLivery) === "object") {
        if ( mpAirlineobjs[u.currentLivery.url] === undefined) {
          await fetch(u.currentLivery.url).then(res => res.json()).then(data => mpAirlineobjs[u.currentLivery.url] = data);
        }
        const texturePromises = liveryEntry.mp.map(async e => {
          if (e.textureIndex !== undefined) {
            return { uri: mpAirlineobjs[u.currentLivery.url].aircrafts[u.aircraft].liveries[u.currentLivery.idx].texture[e.textureIndex], tex: uModelTextures[e.modelIndex], index: e.modelIndex };
          } else if (e.material !== undefined) {
            const mat = mpAirlineobjs[u.currentLivery.url].aircrafts[u.aircraft].liveries[u.currentLivery.idx].materials[e.material];
            const typeKey = Object.keys(mat)[1];
            return { material: mat.name, type: typeKey, color: mat[typeKey] };
          } else if (e.mosaic !== undefined) {
            const mosaicTexture = await generateMosaicTexture(e.mosaic.base, e.mosaic.tiles, mpAirlineobjs[u.currentLivery.url].aircrafts[u.aircraft].liveries[u.currentLivery.idx].texture);
            return { uri: mosaicTexture, tex: uModelTextures[e.modelIndex], index: e.modelIndex };
          }
        });
        const resolvedTextures = await Promise.all(texturePromises);
        textures.push(...resolvedTextures);
      } else {
        const texturePromises = liveryEntry.mp.map(async e => {
          if (e.textureIndex !== undefined) {
            return { uri: liveryEntry.liveries[otherId].texture[e.textureIndex], tex: uModelTextures[e.modelIndex], index: e.modelIndex };
          } else if (e.material !== undefined) {
            const mat = liveryEntry.liveries[otherId].materials[e.material];
            const typeKey = Object.keys(mat)[1];
            return { material: mat.name, type: typeKey, color: mat[typeKey] };
          } else if (e.mosaic !== undefined) {
            const mosaicTexture = await generateMosaicTexture(e.mosaic.base, e.mosaic.tiles, liveryEntry.liveries[otherId].texture);
            return { uri: mosaicTexture, tex: uModelTextures[e.modelIndex], index: e.modelIndex };
          }
        });
        const resolvedTextures = await Promise.all(texturePromises);
        textures.push(...resolvedTextures);
      }
      return textures;
    }

    function getMLTexture(u, liveryEntry) {
      if (!mLiveries.aircraft) {
        fetch(atob(liveryobj.mapi)).then(data => data.json()).then(json => { Object.keys(json).forEach(key => mLiveries[key] = json[key]); });
        return [];
      }
      const liveryId = u.currentLivery - ML_ID_OFFSET;
      const textures = [];
      const texIdx = liveryEntry.labels.indexOf('Texture');
      if (texIdx !== -1) {
        textures.push({
          uri: mLiveries.aircraft[liveryId].mptx,
          tex: u.model._model._rendererResources.textures[liveryEntry.index[texIdx]],
          index: liveryEntry.index[texIdx]
        });
      }
      return textures;
    }

    async function generateMosaicTexture(url, tiles, textures) {
      const baseImage = await Cesium.Resource.fetchImage({ url });
      const canvas = createTag('canvas', { width: baseImage.width, height: baseImage.height });
      const ctx = canvas.getContext('2d');
      ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

      const drawTilePromises = tiles.map(async (tile) => {
        const image = await Cesium.Resource.fetchImage({ url: textures[tile.textureIndex] });
        ctx.drawImage(image, tile.sx, tile.sy, tile.sw, tile.sh, tile.dx, tile.dy, tile.dw, tile.dh);
      });

      await Promise.all(drawTilePromises);
      return canvas.toDataURL('image/png');
    }

    function toggleDiv(id) {
      const div = domById(id);
      const target = window.event && window.event.target;
      if (!target) return;
      if (target.classList.contains('closed')) {
        target.classList.remove('closed'); div.style.display = '';
      } else { target.classList.add('closed'); div.style.display = 'none'; }
    }

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

    function removeItem(array, itemToRemove) {
      const index = array.indexOf(itemToRemove);
      if (index !== -1) array.splice(index, 1);
    }

    function domById(elementId) { return document.getElementById(elementId); }

    function generateListHTML() {
      return `
        <h3><img src="${noCommit}/liveryselector-logo.svg" class="livery-title" title="LiverySelector" /></h3>

        <div class="livery-searchbar mdl-textfield mdl-js-textfield geofs-stopMousePropagation geofs-stopKeyupPropagation">
            <input class="mdl-textfield__input address-input" type="text" placeholder="Search liveries" onkeyup="LiverySelector.search(this.value)" id="searchlivery">
            <label class="mdl-textfield__label" for="searchlivery">Search liveries</label>
        </div>

        <h6 onclick="LiverySelector.toggleDiv('favorites')">Favorite liveries</h6>
        <ul id="favorites" class="geofs-list geofs-visible"></ul>

        <h6 onclick="LiverySelector.toggleDiv('liverylist')">Available liveries</h6>
        <ul id="liverylist" class="geofs-list geofs-visible"></ul>

        <h6 onclick="LiverySelector.toggleDiv('airlinelist')">Virtual airlines</h6><button class="mdl-button mdl-js-button mdl-button--raised mdl-button" style="background-color: #096628; color: white;" onclick="LiverySelector.addAirline()">+ Add airline</button>
        <ul id="airlinelist" class="geofs-list geofs-visible"></ul>

        <h6 onclick="LiverySelector.toggleDiv('customDiv')" class="closed">Load external livery</h6>
        <div id="customDiv" class="mdl-textfield mdl-js-textfield geofs-stopMousePropagation geofs-stopKeyupPropagation" style="display:none;">
            <ul class="livery-custom-tabs" onclick="LiverySelector.handleCustomTabs()">
                <li>Upload</li>
                <li>Direct</li>
                <li>Download</li>
                <li>API</li>
            </ul>
            <div id="livery-custom-tab-upload" style="display:none;">
                <div>Paste URL or upload image to generate imgbb URL</div>
                <div class="upload-fields"></div>
                <div><button class="mdl-button mdl-js-button mdl-button--raised mdl-button--colored" onclick="LiverySelector.inputLivery()">Load livery</button></div>
                <div class="livery-submit geofs-list-collapsible-item">Contribute to the LiverySelector Database
                    <div class="geofs-collapsible no-api">-&gt; Fill in API key and Discord User ID in API tab.</div>
                    <div class="geofs-collapsible api">
                        <label for="livery-submit-liveryname">Livery Name</label>
                        <input type="text" id="livery-submit-liveryname" class="mdl-textfield__input address-input">
                        <label for="livery-submit-credits">Author</label>
                        <input type="text" id="livery-submit-credits" class="mdl-textfield__input address-input">
                        <input type="checkbox" id="livery-submit-confirm-perms">
                        <label for="livery-submit-confirm-perms">I am the author and have created the textures myself or have the permission from the author to use those textures.</label><br>
                        <input type="checkbox" id="livery-submit-confirm-legal">
                        <label for="livery-submit-confirm-legal">I confirm the textures are safe for all ages, are non-offensive and appropriate for the game and don't violate any laws or other regulations.</label>
                        <button class="mdl-button mdl-js-button mdl-button--raised mdl-button--colored" onclick="LiverySelector.submitLivery()">Submit livery for review</button>
                        <small>
                          Join our <a href="https://discord.gg/2tcdzyYaWU" target="_blank">Discord</a> to follow up on your contributions.
                          By submitting you agree to the Discord server rules. Failing to comply may result in exclusion from further submits.
                        </small>
                    </div>
                </div>
            </div>
            <div id="livery-custom-tab-direct" style="display:none;">
                <div>Load texture directly in client, no upload.</div>
                <div class="upload-fields"></div>
            </div>
            <div id="livery-custom-tab-download" style="display:none;">
                <div>Download textures for current Airplane:</div>
                <div class="download-fields"></div>
            </div>
            <div id="livery-custom-tab-api" style="display:none;">
              <div>
                <label for="livery-setting-apikey">Paste your imgbb API key here (<a href="https://api.imgbb.com" target="_blank">get key</a>)</label>
                <input type="text" id="livery-setting-apikey" class="mdl-textfield__input address-input" onchange="LiverySelector.saveSetting(this)">
                <input type="checkbox" id="livery-setting-remove" onchange="LiverySelector.saveSetting(this)">
                <label for="livery-setting-remove">Expire links after one hour<br><small>(only for testing, disable when submitting to the database!)</small></label>
                <label for="livery-setting-discordid">Discord User ID (<a href="https://support.discord.com/hc/en-us/articles/206346498" target="_blank">howto</a>)</label>
                <input type="number" id="livery-setting-discordid" class="mdl-textfield__input address-input" onchange="LiverySelector.saveSetting(this)">
              </div>
            </div>
        </div>
        <br/>
        <a href="https://cdn.jsdelivr.net/gh/kolos26/GEOFS-LiverySelector@main/tutorial.txt" target="_blank"><button class="mdl-button mdl-js-button mdl-button--raised mdl-button">Open tutorial</button></a><br/>
        <a href="https://discord.gg/2tcdzyYaWU" target="_blank"><button class="mdl-button mdl-js-button mdl-button--raised mdl-button">Join our discord server</button></a><br/>
        <a href="https://github.com/kolos26/GEOFS-LiverySelector" target="_blank"><button class="mdl-button mdl-js-button mdl-button--raised mdl-button">Visit our Github page</button></a><br/>
        <a href="mailto:LiverySelector20220816@gmail.com" target="_blank"><button class="mdl-button mdl-js-button mdl-button--raised mdl-button">Contact us: LiverySelector20220816@gmail.com</button></a><br/>
      `;
    }

    function generatePanelButtonHTML() {
      const liveryButton = createTag('button', {
        title: 'Change livery',
        id: 'liverybutton',
        onclick: 'LiverySelector.togglePanel()',
        class: 'mdl-button mdl-js-button geofs-f-standard-ui geofs-mediumScreenOnly',
        'data-toggle-panel': '.livery-list',
        'data-tooltip-classname': 'mdl-tooltip--top',
        'data-upgraded': ',MaterialButton'
      });
      liveryButton.innerHTML = createTag('img', { src: `${noCommit}/liveryselector-logo-small.svg`, height: '30px' }).outerHTML;
      return liveryButton;
    }

    function togglePanel() {
      const p = document.getElementById('listDiv');
      console.time('listLiveries');
      if (p && p.dataset.ac != geofs.aircraft.instance.id) window.LiverySelector.listLiveries();
      console.timeEnd('listLiveries');
    }

    window.LiverySelector = {
      liveryobj,
      loadLivery,
      saveSetting,
      toggleDiv,
      loadLiveryDirect,
      handleCustomTabs,
      listLiveries,
      star,
      search,
      inputLivery,
      uploadLivery,
      submitLivery,
      uploadHistory,
      loadAirlines,
      addAirline,
      removeAirline,
      airlineobjs,
      togglePanel
    };
  }

})(); // end merged IIFE

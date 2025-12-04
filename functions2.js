// ==UserScript==
// @name         GeoFS Livery Selector (Standalone - Full)
// @namespace    https://github.com/kolos26/GEOFS-LiverySelector
// @version      3.3.1
// @description  Advanced livery selector with multiplayer support, custom uploads, virtual airlines & more
// @author       kolos26 and community
// @match        https://*.geo-fs.com/geofs.php*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

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
            if (!res.ok) throw new Error();
            const commit = (await res.json()).sha;
            if (/^[a-f0-9]{40}$/.test(commit)) jsDelivr = jsDelivr.replace("@main", `@${commit}`);
        } catch (err) {
            jsDelivr = githubRepo;
        }

        try {
            fetch(`${jsDelivr}/styles.css?` + Date.now()).then(async data => {
                const styleTag = document.createElement('style');
                styleTag.type = 'text/css';
                styleTag.innerHTML = await data.text();
                document.head.appendChild(styleTag);
            });
        } catch (e) {}

        document.head.appendChild(Object.assign(document.createElement('link'), {
            rel: 'stylesheet',
            href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css'
        }));

        fetch(`${jsDelivr}/livery.json?` + Date.now()).then(handleLiveryJson).catch(e => console.error('livery.json fetch error', e));

        const leftUi = document.querySelector('.geofs-ui-left');
        if (leftUi) {
            const listDiv = document.createElement('div');
            listDiv.id = 'listDiv';
            listDiv.className = 'geofs-list geofs-toggle-panel livery-list';
            listDiv.dataset.noblur = 'true';
            listDiv.dataset.onshow = '{geofs.initializePreferencesPanel()}';
            listDiv.dataset.onhide = '{geofs.savePreferencesPanel()}';
            listDiv.innerHTML = generateListHTML();
            leftUi.appendChild(listDiv);
        }

        const geofsUiButton = document.querySelector('.geofs-ui-bottom');
        if (geofsUiButton) {
            const insertPos = geofs.version >= 3.6 ? 4 : 3;
            geofsUiButton.insertBefore(generatePanelButtonHTML(), geofsUiButton.children[insertPos]);
        }

        document.querySelectorAll('.geofs-liveries.geofs-list-collapsible-item').forEach(btn => btn.parentElement && btn.parentElement.removeChild(btn));

        if (localStorage.getItem('links') === null) {
            localStorage.links = '';
        } else {
            links = localStorage.links.split(",").filter(Boolean);
            links.forEach(async function (e) {
                try {
                    const res = await fetch(e);
                    const data = await res.json();
                    data.url = e.trim();
                    airlineobjs.push(data);
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

            if (liveryobj.commit) jsDelivr = jsDelivr.replace("@main", "@" + liveryobj.commit);
            if (liveryobj.version != version) {
                const header = document.querySelector('.livery-list h3');
                if (header) {
                    header.appendChild(Object.assign(document.createElement('a'), {
                        href: 'https://github.com/kolos26/GEOFS-LiverySelector/releases/latest',
                        target: '_blank',
                        style: 'display:block;width:100%;text-decoration:none;text-align:center;',
                        textContent: 'Update available: ' + liveryobj.version
                    }));
                }
            }

            Object.keys(liveryobj.aircrafts || {}).forEach(aircraftId => {
                if (!liveryobj.aircrafts[aircraftId]) return;
                if (liveryobj.aircrafts[aircraftId].liveries.length < 2) return;
                const element = document.querySelector(`[data-aircraft='${aircraftId}']`);
                if (element) {
                    if (!origHTMLs[aircraftId]) origHTMLs[aircraftId] = element.innerHTML;
                    element.innerHTML = origHTMLs[aircraftId] + `<img src="${noCommit}/liveryselector-logo-small.svg" style="height:30px;width:auto;margin-left:20px;" title="Liveries available">`;
                    if (liveryobj.aircrafts[aircraftId].mp != "disabled") element.innerHTML += '<small title="Liveries are multiplayer compatible\n(visible to other players)">Multiplayer</small>';
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
                        model3d._model.getMaterial(mat.name).setValue(Object.keys(mat)[1], new Cesium.Cartesian4(...mat[Object.keys(mat)[1]], 1.0));
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

        if (!localStorage.liveryDiscordId || localStorage.liveryDiscordId.length < 6) return alert('Invalid Discord User id!');
        if (formFields.liveryname.value.trim().length < 3) return alert('Invalid Livery Name!');
        if (!formFields['confirm-perms'].checked || !formFields['confirm-legal'].checked) return alert('Confirm all checkboxes!');

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
                    if (hist.expiration > 0) return alert('Can\'t submit expiring links! DISABLE "Expire links after one hour" option and re-upload texture:\n' + airplane.labels[i]);
                    const embed = {
                        title: airplane.labels[i] + ' (' + (Math.ceil(hist.size / 1024 / 10.24) / 100) + 'MB, ' + hist.width + 'x' + hist.height + ')',
                        description: f.value,
                        image: { url: f.value },
                        fields: [{ name: 'Timestamp', value: new Date(hist.time * 1e3), inline: true }, { name: 'File ID', value: hist.id, inline: true }]
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
        const list = document.getElementById(id);
        let switching = true;
        while (switching) {
            switching = false;
            const b = list.getElementsByTagName('LI');
            for (let i = 0; i < (b.length - 1); i++) {
                if (b[i].innerHTML.toLowerCase() > b[i + 1].innerHTML.toLowerCase()) {
                    b[i].parentNode.insertBefore(b[i + 1], b[i]);
                    switching = true;
                }
            }
        }
    }

    function listLiveries() {
        const livList = $('#liverylist').html('');
        livList[0].addEventListener('error', function (e) {
            if (e.target.tagName === 'IMG') { e.target.onerror = null; e.target.src = defaultThumb; }
        }, true);

        $(livList).on('click', 'li, [data-idx]', function ({ target }) {
            const idx = $(target).closest('li').data('idx'), airplane = LiverySelector.liveryobj.aircrafts[geofs.aircraft.instance.id], livery = airplane.liveries[idx];
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
            if (e.disabled) continue;
            const listItem = $('<li/>', { id: [acftId, e.name, 'button'].join('_'), class: 'geofs-visible livery-list-item' });
            listItem.data('idx', i).append($('<span/>', { class: 'livery-name' }).html(e.name));
            listItem.toggleClass('offi', acftId < 100);
            if (acftId < 1000) {
                const thumb = $('<img/>', { loading: 'lazy' });
                thumb.attr('src', [thumbsDir, acftId, acftId + '-' + i + '.png'].join('/'));
                listItem.append(thumb);
            }
            if (e.credits && e.credits.length) $('<small/>').text(`by ${e.credits}`).appendTo(listItem);
            $('<span/>', { id: [acftId, e.name].join('_'), class: 'fa fa-star', onclick: 'LiverySelector.star(this)' }).appendTo(listItem);
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
        if (favorites === null) localStorage.setItem('favorites', '');
        $("#favorites").empty().on("click", "li", function ({ target }) {
            const $match = $(`#liverylist > [id='${$(target).attr("id").replace("_favorite", "_button")}']`);
            if ($match.length === 0) return void ui?.notification?.show?.(`ID: ${$(target).attr("id")} is missing a liveryList counterpart.`);
            $match.click();
        });
        const list = favorites.split(',');
        const airplane = geofs.aircraft.instance.id;
        list.forEach(function (e) {
            if ((airplane == e.slice(0, airplane.length)) && (e.charAt(airplane.length) == '_')) {
                star(document.getElementById(e));
            }
        });
    }

    function loadAirlines() {
        document.getElementById("airlinelist").innerHTML = '';
        const airplane = getCurrentAircraft();
        const textures = airplane.liveries[0].texture;
        airlineobjs.forEach(function (airline) {
            let airlinename = document.getElementById('airlinelist').appendChild(Object.assign(document.createElement('li'), {
                style: "color:" + airline.color + ";background-color:" + airline.bgcolor + "; font-weight: bold;"
            }));
            airlinename.innerText = airline.name;
            let removebtn = airlinename.appendChild(Object.assign(document.createElement("button"), {
                class: "mdl-button mdl-js-button mdl-button--raised mdl-button",
                style: "float: right; margin-top: 6px; background-color: #9e150b;",
                onclick: `LiverySelector.removeAirline("${airline.url}")`
            }));
            removebtn.innerText = "- Remove airline";

            if (Object.keys(airline.aircrafts).includes(geofs.aircraft.instance.id)) {
                airline.aircrafts[geofs.aircraft.instance.id].liveries.forEach(function (e, i) {
                    let listItem = document.getElementById('airlinelist').appendChild(Object.assign(document.createElement('li'), {
                        id: [geofs.aircraft.instance.id, e.name, 'button'].join('_'),
                        class: 'livery-list-item'
                    }));
                    if ((textures.filter(x => x === textures[0]).length === textures.length) && textures.length !== 1) {
                        const texture = e.texture[0];
                        listItem.onclick = () => {
                            loadLivery(Array(textures.length).fill(texture), airplane.index, airplane.parts);
                            if (airplane.mp != 'disabled' && whitelist && whitelist.includes(airline.url.trim())) {
                                setInstanceId({ url: airline.url, idx: i });
                            }
                        };
                    } else {
                        listItem.onclick = () => {
                            loadLivery(e.texture, airplane.index, airplane.parts, e.materials);
                            if (airplane.mp != 'disabled' && whitelist && whitelist.includes(airline.url.trim())) {
                                setInstanceId({ url: airline.url, idx: i });
                            }
                        };
                    }
                    listItem.innerHTML = `<span class="livery-name">${e.name}</span>`;
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
                placeholders.forEach((placeholder, i) => {
                    createUploadButton(placeholder);
                    createDirectButton(placeholder, i);
                });
            }
        }

        if (airplane.liveries[0].materials) {
            airplane.liveries[0].materials.forEach((material, key) => {
                let partlist = [];
                airplane.liveries[0].texture.forEach((e, k) => {
                    if (typeof (e) === 'object' && e.material == key) partlist.push(airplane.parts[k]);
                });
                createColorChooser(material.name, Object.keys(material)[1], partlist);
                createUploadColorChooser(material.name, Object.keys(material)[1], partlist);
            });
        }

        const tabs = document.querySelector('.livery-custom-tabs li');
        if (tabs) tabs.click();
    }

    function debounceSearch(func) {
        let timeoutId = null;
        return (text) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func(text), 250);
        };
    }

    const search = debounceSearch(text => {
        const liveries = document.getElementById('liverylist').children;
        if (text == '') {
            for (const a of liveries) a.classList.add('geofs-visible');
            return;
        }
        text = text.toLowerCase();
        for (let i = 0; i < liveries.length; i++) {
            const e = liveries[i], v = e.classList.contains('geofs-visible');
            if (e.textContent.toLowerCase().includes(text)) {
                if (!v) e.classList.add('geofs-visible');
            } else {
                if (v) e.classList.remove('geofs-visible');
            }
        }
    });

    function changeMaterial(name, color, type, partlist) {
        let r = parseInt(color.substring(1, 3), 16) / 255;
        let g = parseInt(color.substring(3, 5), 16) / 255;
        let b = parseInt(color.substring(5, 7), 16) / 255;
        partlist.forEach(part => {
            try {
                geofs.aircraft.instance.definition.parts[part]['3dmodel']._model.getMaterial(name).setValue(type, new Cesium.Cartesian4(r, g, b, 1.0));
            } catch (e) {
                console.error('changeMaterial error', e);
            }
        });
    }

    function star(element) {
        const e = element.classList;
        const elementId = [element.id, 'favorite'].join('_');
        let list = (localStorage.getItem('favorites') || '').split(',').filter(Boolean);
        if (e.contains("checked")) {
            const favEl = document.getElementById(elementId);
            if (favEl) document.getElementById('favorites').removeChild(favEl);
            const index = list.indexOf(element.id);
            if (index !== -1) list.splice(index, 1);
            localStorage.setItem('favorites', list);
        } else {
            const btn = document.getElementById([element.id, 'button'].join('_'));
            const fbtn = document.getElementById('favorites').appendChild(Object.assign(document.createElement('li'), { id: elementId, class: 'livery-list-item' }));
            fbtn.innerText = btn ? btn.children[0].innerText : element.id;
            list.push(element.id);
            localStorage.setItem('favorites', [...new Set(list)]);
        }
        e.toggle('checked');
    }

    function createUploadButton(id) {
        const customDiv = document.querySelector('#livery-custom-tab-upload .upload-fields');
        customDiv.appendChild(Object.assign(document.createElement('input'), { type: 'file', onchange: 'LiverySelector.uploadLivery(this)' }));
        customDiv.appendChild(Object.assign(document.createElement('input'), { type: 'text', name: 'textureInput', class: 'mdl-textfield__input address-input', placeholder: id, id: id }));
        customDiv.appendChild(document.createElement('br'));
    }

    function createDirectButton(id, i) {
        const customDiv = document.querySelector('#livery-custom-tab-direct .upload-fields');
        customDiv.appendChild(Object.assign(document.createElement('input'), { type: 'file', onchange: 'LiverySelector.loadLiveryDirect(this,' + i + ')' }));
        customDiv.appendChild(Object.assign(document.createElement('span'), { innerHTML: id }));
        customDiv.appendChild(document.createElement('br'));
    }

    function createColorChooser(name, type, partlist) {
        const customDiv = document.querySelector('#livery-custom-tab-direct .upload-fields');
        customDiv.appendChild(Object.assign(document.createElement('input'), { type: 'color', name: name, class: 'colorChooser', onchange: `changeMaterial("${name}", this.value, "${type}", [${partlist}])` }));
        customDiv.appendChild(Object.assign(document.createElement('span'), { style: 'padding-top: 20px; padding-bottom: 20px;', innerHTML: name }));
        customDiv.appendChild(document.createElement('br'));
    }

    function createUploadColorChooser(name, type, partlist) {
        const customDiv = document.querySelector('#livery-custom-tab-upload .upload-fields');
        customDiv.appendChild(Object.assign(document.createElement('input'), { type: 'color', name: "textureInput", id: name, class: 'colorChooser', onchange: `changeMaterial("${name}", this.value, "${type}", [${partlist}])` }));
        customDiv.appendChild(Object.assign(document.createElement('span'), { style: 'padding-top: 20px; padding-bottom: 20px;', innerHTML: name }));
        customDiv.appendChild(document.createElement('br'));
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
                geofs.api.changeModelTexture(geofs.aircraft.instance.definition.parts[airplane.parts[i]]["3dmodel"]._model, newTexture, { index: airplane.index[i] });
            }
            fileInput.value = null;
        });
        fileInput.files.length && reader.readAsDataURL(fileInput.files[0]);
    }

    function uploadLivery(fileInput) {
        if (!fileInput.files.length) return;
        if (!localStorage.imgbbAPIKEY) {
            alert('No imgbb API key saved! Check API tab');
            fileInput.value = null;
            return;
        }
        const form = new FormData();
        form.append('image', fileInput.files[0]);
        if (localStorage.liveryAutoremove) form.append('expiration', (new Date() / 1000) * 60 * 60);

        const settings = {
            url: `https://api.imgbb.com/1/upload?key=${localStorage.imgbbAPIKEY}`,
            method: 'POST',
            timeout: 0,
            processData: false,
            mimeType: 'multipart/form-data',
            contentType: false,
            data: form
        };

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
        const tabId = src.innerHTML.toLowerCase();
        document.getElementById('customDiv').querySelectorAll(':scope > div').forEach(tabDiv => {
            if (tabDiv.id != ['livery-custom-tab', tabId].join('-')) {
                tabDiv.style.display = 'none';
                return;
            }
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
            fields.appendChild(Object.assign(document.createElement('h7'), { innerHTML: livery.name }));
            const wrap = fields.appendChild(document.createElement('div'));
            textures.forEach((href, i) => {
                if (typeof href === 'object') return;
                if (liveryNo > 0 && href == defaults.texture[i]) return;
                const link = wrap.appendChild(Object.assign(document.createElement('a'), { href, target: '_blank', class: "mdl-button mdl-button--raised mdl-button--colored" }));
                link.innerHTML = airplane.labels[i];
            });
        });
    }

    function reloadSettingsForm() {
        const apiInput = document.getElementById('livery-setting-apikey');
        if (apiInput) apiInput.placeholder = localStorage.imgbbAPIKEY ? 'API KEY SAVED (type CLEAR to remove)' : 'API KEY HERE';
        const removeCheckbox = document.getElementById('livery-setting-remove');
        if (removeCheckbox) removeCheckbox.checked = (localStorage.liveryAutoremove == 1);
        const discordInput = document.getElementById('livery-setting-discordid');
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
        if (!url) return;
        if (!links.includes(url)) {
            links.push(url);
            localStorage.links += `,${url}`;
            const res = await fetch(url);
            const data = await res.json();
            data.url = url.trim();
            airlineobjs.push(data);
            loadAirlines();
        } else alert("Airline already added");
    }

    function removeAirline(url) {
        removeItem(links, url.trim());
        localStorage.links = links.join(',');
        airlineobjs = airlineobjs.filter(e => e.url.trim() !== url.trim());
        loadAirlines();
    }

    function getCurrentAircraft() {
        return liveryobj.aircrafts[geofs.aircraft.instance.id];
    }

    function setInstanceId(id) {
        geofs.aircraft.instance.liveryId = id;
    }

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
                const canvas = document.createElement('canvas');
                canvas.width = tex._width; canvas.height = tex._height;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                cb(canvas.toDataURL('image/png'));
            });
        } catch (e) {
            console.log('LSMP', !!tex, url, e);
        }
    }

    function applyMPMaterial(model, name, type, color) {
        model._model.getMaterial(name).setValue(type, new Cesium.Cartesian4(...color, 1.0));
    }

    async function getMPTexture(u, liveryEntry) {
        const otherId = u.currentLivery - LIVERY_ID_OFFSET;
        const textures = [];
        const uModelTextures = u.model._model._rendererResources.textures;

        if (typeof (u.currentLivery) === "object") {
            if (mpAirlineobjs[u.currentLivery.url] === undefined) {
                const res = await fetch(u.currentLivery.url);
                mpAirlineobjs[u.currentLivery.url] = await res.json();
            }
            const promises = liveryEntry.mp.map(async e => {
                if (e.textureIndex !== undefined) {
                    return { uri: mpAirlineobjs[u.currentLivery.url].aircrafts[u.aircraft].liveries[u.currentLivery.idx].texture[e.textureIndex], tex: uModelTextures[e.modelIndex], index: e.modelIndex };
                } else if (e.material !== undefined) {
                    const mat = mpAirlineobjs[u.currentLivery.url].aircrafts[u.aircraft].liveries[u.currentLivery.idx].materials[e.material];
                    const typeKey = Object.keys(mat)[1];
                    return { material: mat.name, type: typeKey, color: mat[typeKey] };
                }
            });
            textures.push(...await Promise.all(promises));
        } else {
            const promises = liveryEntry.mp.map(async e => {
                if (e.textureIndex !== undefined) {
                    return { uri: liveryEntry.liveries[otherId].texture[e.textureIndex], tex: uModelTextures[e.modelIndex], index: e.modelIndex };
                } else if (e.material !== undefined) {
                    const mat = liveryEntry.liveries[otherId].materials[e.material];
                    const typeKey = Object.keys(mat)[1];
                    return { material: mat.name, type: typeKey, color: mat[typeKey] };
                }
            });
            textures.push(...await Promise.all(promises));
        }
        return textures;
    }

    function getMLTexture(u, liveryEntry) {
        if (!mLiveries.aircraft) {
            fetch(atob(liveryobj.mapi)).then(d => d.json()).then(json => Object.assign(mLiveries, json));
            return [];
        }
        const liveryId = u.currentLivery - ML_ID_OFFSET;
        const textures = [];
        const texIdx = liveryEntry.labels.indexOf('Texture');
        if (texIdx !== -1) {
            textures.push({ uri: mLiveries.aircraft[liveryId].mptx, tex: u.model._model._rendererResources.textures[liveryEntry.index[texIdx]], index: liveryEntry.index[texIdx] });
        }
        return textures;
    }

    function toggleDiv(id) {
        const div = document.getElementById(id);
        const target = window.event && window.event.target;
        if (!target) return;
        if (target.classList.contains('closed')) {
            target.classList.remove('closed');
            div.style.display = '';
        } else {
            target.classList.add('closed');
            div.style.display = 'none';
        }
    }

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
            <div class="geofs-collapsible no-api">→ Fill in API key and Discord User ID in API tab.</div>
            <div class="geofs-collapsible api">
                <label for="livery-submit-liveryname">Livery Name</label>
                <input type="text" id="livery-submit-liveryname" class="mdl-textfield__input address-input">
                <label for="livery-submit-credits">Author</label>
                <input type="text" id="livery-submit-credits" class="mdl-textfield__input address-input">
                <input type="checkbox" id="livery-submit-confirm-perms"> <label for="livery-submit-confirm-perms">I am the author and have the permission to use these textures.</label><br>
                <input type="checkbox" id="livery-submit-confirm-legal"> <label for="livery-submit-confirm-legal">Textures are safe, non-offensive and appropriate.</label>
                <button class="mdl-button mdl-js-button mdl-button--raised mdl-button--colored" onclick="LiverySelector.submitLivery()">Submit livery for review</button>
                <small>Join our <a href="https://discord.gg/2tcdzyYaWU" target="_blank">Discord</a> to follow up.</small>
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
            <label for="livery-setting-apikey">imgbb API key (<a href="https://api.imgbb.com" target="_blank">get key</a>)</label>
            <input type="text" id="livery-setting-apikey" class="mdl-textfield__input address-input" onchange="LiverySelector.saveSetting(this)">
            <input type="checkbox" id="livery-setting-remove" onchange="LiverySelector.saveSetting(this)"> <label for="livery-setting-remove">Expire links after one hour<br><small>(disable when submitting!)</small></label>
            <label for="livery-setting-discordid">Discord User ID (<a href="https://support.discord.com/hc/en-us/articles/206346498" target="_blank">howto</a>)</label>
            <input type="number" id="livery-setting-discordid" class="mdl-textfield__input address-input" onchange="LiverySelector.saveSetting(this)">
        </div>
    </div>
</div>
<br/>
<a href="https://cdn.jsdelivr.net/gh/kolos26/GEOFS-LiverySelector@main/tutorial.txt" target="_blank"><button class="mdl-button mdl-js-button mdl-button--raised mdl-button">Open tutorial</button></a><br/>
<a href="https://discord.gg/2tcdzyYaWU" target="_blank"><button class="mdl-button mdl-js-button mdl-button--raised mdl-button">Join Discord</button></a><br/>
<a href="https://github.com/kolos26/GEOFS-LiverySelector" target="_blank"><button class="mdl-button mdl-js-button mdl-button--raised mdl-button">GitHub</button></a><br/>
<a href="mailto:LiverySelector20220816@gmail.com" target="_blank"><button class="mdl-button mdl-js-button mdl-button--raised mdl-button">Contact</button></a><br/>
`;
    }

    function generatePanelButtonHTML() {
        const btn = document.createElement('button');
        btn.title = 'Change livery';
        btn.id = 'liverybutton';
        btn.onclick = () => LiverySelector.togglePanel();
        btn.className = 'mdl-button mdl-js-button geofs-f-standard-ui geofs-mediumScreenOnly';
        btn.dataset.togglePanel = '.livery-list';
        btn.dataset.tooltipClassname = 'mdl-tooltip--top';
        btn.innerHTML = `<img src="${noCommit}/liveryselector-logo-small.svg" height="30px">`;
        return btn;
    }

    function togglePanel() {
        const p = document.getElementById('listDiv');
        if (p && p.dataset.ac != geofs.aircraft.instance.id) {
            console.time('listLiveries');
            listLiveries();
            console.timeEnd('listLiveries');
        }
    }

    window.LiverySelector = {
        liveryobj, loadLivery, saveSetting, toggleDiv, loadLiveryDirect, handleCustomTabs,
        listLiveries, star, search, inputLivery, uploadLivery, submitLivery, uploadHistory,
        loadAirlines, addAirline, removeAirline, airlineobjs, togglePanel
    };

})();

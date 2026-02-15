define([], function () {
    'use strict';

    var pluginId = "7c10708f-43e4-4d69-923c-77d01802315b";
    var statusInterval = null;

    var customCss = `
    <style>
        .day-toggle {
            background: var(--theme-background-level1);
            color: var(--theme-text-secondary);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 0.9em;
            transition: all 0.2s;
            text-transform: uppercase;
            font-weight: bold;
        }
        .day-toggle:hover {
            background: var(--theme-background-level2);
            color: var(--theme-text-primary);
        }
        .day-toggle.active {
            background: #52B54B; /* Emby Green */
            color: #fff;
            border-color: #52B54B;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }
        .date-row-container {
            background: rgba(0,0,0,0.2); 
            border: 1px solid rgba(255,255,255,0.05); 
            border-radius: 6px; 
            padding: 15px; 
            margin-bottom: 10px;
        }
    </style>`;

    function getUrlRowHtml(value) {
        var val = value || '';
        return `
            <div class="url-row" style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <div style="flex-grow:1;">
                    <input is="emby-input" class="txtTagUrl" type="text" label="Trakt/MDBList URL or ID" value="${val}" />
                </div>
                <button type="button" is="emby-button" class="raised button-submit btnTestUrl" style="min-width:60px; height:36px; padding:0 10px; font-size:0.8rem; margin:0;" title="Test Source"><span>Test</span></button>
                <button type="button" is="emby-button" class="raised btnRemoveUrl" style="background:transparent !important; min-width:40px; width:40px; padding:0; color:#cc3333; display:flex; align-items:center; justify-content:center; box-shadow:none;" title="Remove URL"><i class="md-icon">remove_circle_outline</i></button>
            </div>`;
    }

    function getMonthOptions(selectedMonth) {
        var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return months.map((m, i) => `<option value="${i + 1}" ${selectedMonth == (i + 1) ? 'selected' : ''}>${m}</option>`).join('');
    }

    function getDayOptions(selectedDay) {
        var html = '';
        for (var i = 1; i <= 31; i++) html += `<option value="${i}" ${selectedDay == i ? 'selected' : ''}>${i}</option>`;
        return html;
    }

    function getWeekButtons(savedDays) {
        var days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        var shortDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        var saved = (savedDays || "").toLowerCase();

        return days.map((d, i) => {
            var isActive = saved.includes(d.toLowerCase());
            return `<button type="button" class="day-toggle ${isActive ? 'active' : ''}" data-day="${d}">${shortDays[i]}</button>`;
        }).join('');
    }

    function getDateRowHtml(interval) {
        var type = interval.Type || 'SpecificDate';

        var sDate = interval.Start ? new Date(interval.Start).toISOString().split('T')[0] : '';
        var eDate = interval.End ? new Date(interval.End).toISOString().split('T')[0] : '';

        var sMonth = interval.Start ? new Date(interval.Start).getMonth() + 1 : 12;
        var sDay = interval.Start ? new Date(interval.Start).getDate() : 1;
        var eMonth = interval.End ? new Date(interval.End).getMonth() + 1 : 12;
        var eDay = interval.End ? new Date(interval.End).getDate() : 31;

        var dayOfWeek = interval.DayOfWeek || '';

        return `
            <div class="date-row date-row-container" style="display: flex; flex-wrap: wrap; align-items: flex-start; gap: 15px;">
                
                <div style="width:150px;">
                    <select is="emby-select" class="selDateType" label="Rule Type" style="width:100%;">
                        <option value="SpecificDate" ${type === 'SpecificDate' ? 'selected' : ''}>Specific Date</option>
                        <option value="EveryYear" ${type === 'EveryYear' ? 'selected' : ''}>Annual (Recurring)</option>
                        <option value="Weekly" ${type === 'Weekly' ? 'selected' : ''}>Weekly Days</option>
                    </select>
                </div>
                
                <div class="inputs-specific" style="display: ${type === 'SpecificDate' ? 'flex' : 'none'}; gap: 10px; flex-grow: 1; align-items: center;">
                    <div style="flex-grow:1;"><input is="emby-input" type="date" class="txtFullStartDate" label="Start Date" value="${sDate}" /></div>
                    <span style="opacity:0.5;">to</span>
                    <div style="flex-grow:1;"><input is="emby-input" type="date" class="txtFullEndDate" label="End Date" value="${eDate}" /></div>
                </div>

                <div class="inputs-annual" style="display: ${type === 'EveryYear' ? 'flex' : 'none'}; gap: 10px; flex-grow: 1; align-items: center;">
                    <div style="display:flex; gap:5px; flex-grow:1;">
                        <select is="emby-select" class="selStartMonth" label="Start Month" style="flex-grow:2;">${getMonthOptions(sMonth)}</select>
                        <select is="emby-select" class="selStartDay" label="Day" style="width:60px;">${getDayOptions(sDay)}</select>
                    </div>
                    <span style="opacity:0.5;">to</span>
                    <div style="display:flex; gap:5px; flex-grow:1;">
                        <select is="emby-select" class="selEndMonth" label="End Month" style="flex-grow:2;">${getMonthOptions(eMonth)}</select>
                        <select is="emby-select" class="selEndDay" label="Day" style="width:60px;">${getDayOptions(eDay)}</select>
                    </div>
                </div>

                <div class="inputs-weekly" style="display: ${type === 'Weekly' ? 'flex' : 'none'}; flex-grow: 1; align-items: center; gap: 5px; flex-wrap: wrap;">
                    <span style="font-size:0.8em; opacity:0.7; margin-right:10px; text-transform:uppercase;">Active On:</span>
                    <div class="week-btn-container" style="display:flex; gap:5px;">
                        ${getWeekButtons(dayOfWeek)}
                    </div>
                </div>

                <button type="button" is="emby-button" class="btnRemoveDate" style="background:transparent; color:#cc3333; min-width:40px; margin-top: 15px;" title="Remove Rule"><i class="md-icon">delete</i></button>
            </div>`;
    }

    function renderTagGroup(tagConfig, container, prepend) {
        var isChecked = tagConfig.Active !== false ? 'checked' : '';
        var tagName = tagConfig.Tag || '';
        var limit = tagConfig.Limit || 50;
        var urls = tagConfig.Urls || (tagConfig.Url ? [tagConfig.Url] : ['']);
        var blacklist = (tagConfig.Blacklist || []).join(', ');
        var intervals = tagConfig.ActiveIntervals || [];

        var activeText = tagConfig.Active !== false ? "Active" : "Disabled";
        var activeColor = tagConfig.Active !== false ? "#52B54B" : "var(--theme-text-secondary)";

        var dateStatusHtml = '';
        if (intervals.length > 0) {
            var types = intervals.map(i => {
                if (i.Type === 'Weekly') return 'Weekly';
                if (i.Type === 'EveryYear') return 'Annual';
                return 'Date';
            });
            var uniqueTypes = [...new Set(types)].join(', ');
            dateStatusHtml = `<span class="tag-date-indicator" style="margin-left:15px; font-size:0.75em; color:#00a4dc; background:rgba(0,164,220,0.1); padding:2px 8px; border-radius:4px; display:flex; align-items:center; gap:4px; border:1px solid rgba(0,164,220,0.3);"><i class="md-icon" style="font-size:1.1em;">calendar_today</i>${uniqueTypes.toUpperCase()}</span>`;
        }

        var html = `
        <div class="tag-row">
            <div class="tag-header" style="display:flex; align-items:center; justify-content:space-between; padding:10px; cursor:pointer;">
                <div style="display:flex; align-items:center;">
                    <div class="header-actions" style="margin-right:15px; display:flex; align-items:center;" onclick="event.stopPropagation()">
                        <span class="lblActiveStatus" style="margin-right:8px; font-size:0.9em; font-weight:bold; color:${activeColor}; min-width:60px; text-align:right;">${activeText}</span>
                        <label class="checkboxContainer" style="margin:0;">
                            <input type="checkbox" is="emby-checkbox" class="chkTagActive" ${isChecked} />
                            <span></span>
                        </label>
                    </div>
                    <div class="tag-info">
                        <span class="tag-title" style="font-weight:bold; font-size:1.1em;">${tagName || 'New Tag'}</span>
                        <span class="tag-status" style="margin-left:10px; font-size:0.8em; opacity:0.7;">${urls.length} SOURCE(S)</span>
                        ${dateStatusHtml}
                    </div>
                </div>
                <i class="md-icon expand-icon">expand_more</i>
            </div>
            <div class="tag-body" style="display:none; padding:15px; border-top:1px solid rgba(255,255,255,0.1);">
                <div class="tag-tabs" style="display: flex; gap: 20px; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div class="tag-tab active" data-tab="general" style="padding: 8px 0; cursor: pointer; font-weight: bold; border-bottom: 2px solid #52B54B;">General</div>
                    <div class="tag-tab" data-tab="advanced" style="padding: 8px 0; cursor: pointer; opacity: 0.6; font-weight: bold; border-bottom: 2px solid transparent;">Advanced</div>
                </div>
                <div class="tab-content general-tab">
                    <div style="display:flex; gap:20px; align-items:center;">
                        <div class="inputContainer" style="flex-grow:1;"><input is="emby-input" class="txtTagName" type="text" label="Tag Name" value="${tagName}" /></div>
                        <div class="inputContainer" style="width:120px;"><input is="emby-input" class="txtTagLimit" type="number" label="Max Items" value="${limit}" min="1" /></div>
                    </div>
                    <p style="margin:10px 0 10px 0; font-size:0.9em; font-weight:bold; opacity:0.7;">Source URLs</p>
                    <div class="url-list-container">${urls.map(u => getUrlRowHtml(u)).join('')}</div>
                    <div style="margin-top:10px;"><button is="emby-button" type="button" class="raised btnAddUrl" style="width:100%; background:transparent; border:1px dashed #555; color:#ccc;"><i class="md-icon" style="margin-right:5px;">add</i>Add another URL</button></div>
                </div>
                <div class="tab-content advanced-tab" style="display:none;">
                    <div class="inputContainer">
                        <p style="margin:0 0 5px 0; font-size:0.9em; font-weight:bold; opacity:0.7;">Blacklist / Ignore (IMDB IDs)</p>
                        <textarea is="emby-textarea" class="txtTagBlacklist" rows="2" placeholder="tt1234567, tt9876543">${blacklist}</textarea>
                    </div>
                    <p style="margin:20px 0 5px 0; font-size:0.9em; font-weight:bold; opacity:0.7;">Active Schedule (Optional)</p>
                    <div class="date-list-container">${intervals.map(i => getDateRowHtml(i)).join('')}</div>
                    <button is="emby-button" type="button" class="btnAddDate" style="width:100%; background:transparent; border:1px dashed #555; margin-top:10px;"><i class="md-icon" style="margin-right:5px;">event</i>Add Schedule Rule</button>
                </div>
                <div style="text-align:right; margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;"><button is="emby-button" type="button" class="raised btnRemoveGroup" style="background:#cc3333 !important; color:#fff;"><i class="md-icon" style="margin-right:5px;">delete</i>Remove Tag Group</button></div>
            </div>
        </div>`;

        if (prepend) container.insertAdjacentHTML('afterbegin', html);
        else container.insertAdjacentHTML('beforeend', html);
        setupRowEvents(prepend ? container.firstElementChild : container.lastElementChild);
    }

    function setupRowEvents(row) {
        row.querySelectorAll('.tag-tab').forEach(tab => {
            tab.addEventListener('click', function () {
                row.querySelectorAll('.tag-tab').forEach(t => { t.style.opacity = "0.6"; t.style.borderBottomColor = "transparent"; });
                this.style.opacity = "1"; this.style.borderBottomColor = "#52B54B";
                var target = this.getAttribute('data-tab');
                row.querySelector('.general-tab').style.display = target === 'general' ? 'block' : 'none';
                row.querySelector('.advanced-tab').style.display = target === 'advanced' ? 'block' : 'none';
            });
        });

        row.addEventListener('change', e => {
            if (e.target.classList.contains('selDateType')) {
                var dateRow = e.target.closest('.date-row');
                var type = e.target.value;
                dateRow.querySelector('.inputs-specific').style.display = type === 'SpecificDate' ? 'flex' : 'none';
                dateRow.querySelector('.inputs-annual').style.display = type === 'EveryYear' ? 'flex' : 'none';
                dateRow.querySelector('.inputs-weekly').style.display = type === 'Weekly' ? 'flex' : 'none';
            }
        });

        row.addEventListener('click', e => {
            if (e.target.classList.contains('day-toggle')) {
                e.target.classList.toggle('active');
            }
        });

        var header = row.querySelector('.tag-header'), body = row.querySelector('.tag-body'), icon = row.querySelector('.expand-icon');
        header.addEventListener('click', e => {
            if (e.target.closest('.header-actions')) return;
            var isHidden = body.style.display === 'none';
            body.style.display = isHidden ? 'block' : 'none';
            icon.innerText = isHidden ? 'expand_less' : 'expand_more';
        });

        var chk = row.querySelector('.chkTagActive'), lblStatus = row.querySelector('.lblActiveStatus');
        chk.addEventListener('change', function () {
            lblStatus.textContent = this.checked ? "Active" : "Disabled";
            lblStatus.style.color = this.checked ? "#52B54B" : "var(--theme-text-secondary)";
        });

        row.querySelector('.btnAddUrl').addEventListener('click', () => { row.querySelector('.url-list-container').insertAdjacentHTML('beforeend', getUrlRowHtml('')); updateCount(row); });

        row.querySelector('.btnAddDate').addEventListener('click', () => row.querySelector('.date-list-container').insertAdjacentHTML('beforeend', getDateRowHtml({ Type: 'SpecificDate' })));

        row.addEventListener('click', e => {
            if (e.target.closest('.btnRemoveUrl')) { e.target.closest('.url-row').remove(); updateCount(row); }
            if (e.target.closest('.btnRemoveDate')) e.target.closest('.date-row').remove();
            if (e.target.closest('.btnRemoveGroup')) if (confirm("Delete this tag group?")) row.remove();

            var btnTest = e.target.closest('.btnTestUrl');
            if (btnTest) {
                var url = btnTest.closest('.url-row').querySelector('.txtTagUrl').value;
                if (!url) return;
                btnTest.disabled = true;
                window.ApiClient.getJSON(window.ApiClient.getUrl("AutoTag/TestUrl", { Url: url, Limit: 1000 })).then(r => window.Dashboard.alert(r.Message)).finally(() => btnTest.disabled = false);
            }
        });

        row.querySelector('.txtTagName').addEventListener('input', function () { row.querySelector('.tag-title').textContent = this.value || 'New Tag'; });
    }

    function updateCount(row) { row.querySelector('.tag-status').textContent = row.querySelectorAll('.txtTagUrl').length + " SOURCE(S)"; }

    function refreshStatus(view) {
        window.ApiClient.getJSON(window.ApiClient.getUrl("AutoTag/Status")).then(result => {
            var label = view.querySelector('#lastRunStatusLabel'), dot = view.querySelector('#dotStatus'), content = view.querySelector('#logContent');
            var btnSave = view.querySelector('.btn-save'), btnRun = view.querySelector('#btnRunSync');

            if (result.IsRunning) {
                if (btnSave) { btnSave.disabled = true; btnSave.style.opacity = "0.5"; btnSave.querySelector('span').textContent = "Sync in progress..."; }
                if (btnRun) btnRun.disabled = true;
            } else {
                if (btnSave) { btnSave.disabled = false; btnSave.style.opacity = "1"; btnSave.querySelector('span').textContent = "Save Settings"; }
                if (btnRun) btnRun.disabled = false;
            }

            if (label) label.textContent = result.LastRunStatus || "Never";
            if (content && result.Logs) content.textContent = result.Logs.join('\n');
            if (dot) {
                dot.className = "status-dot";
                if (result.LastRunStatus.includes("Running")) dot.classList.add("running");
                else if (result.LastRunStatus.includes("Failed")) dot.classList.add("failed");
            }
        });
    }

    return function (view) {
        view.addEventListener('viewshow', () => {
            if (!document.getElementById('autoTagCustomCss')) {
                document.body.insertAdjacentHTML('beforeend', customCss.replace('<style>', '<style id="autoTagCustomCss">'));
            }

            refreshStatus(view);
            statusInterval = setInterval(() => refreshStatus(view), 5000);

            var logOverlay = view.querySelector('#logModalOverlay');
            var helpOverlay = view.querySelector('#helpModalOverlay');

            view.querySelector('#btnOpenLogs').addEventListener('click', e => { e.preventDefault(); logOverlay.classList.add('modal-visible'); });
            view.querySelector('#btnCloseLogs').addEventListener('click', () => logOverlay.classList.remove('modal-visible'));
            logOverlay.addEventListener('click', e => { if (e.target === logOverlay) logOverlay.classList.remove('modal-visible'); });

            view.querySelector('#btnOpenHelp').addEventListener('click', () => helpOverlay.classList.add('modal-visible'));
            view.querySelector('#btnCloseHelp').addEventListener('click', () => helpOverlay.classList.remove('modal-visible'));
            helpOverlay.addEventListener('click', e => { if (e.target === helpOverlay) helpOverlay.classList.remove('modal-visible'); });

            var advHeader = view.querySelector('#advancedSettings .advanced-header');
            if (advHeader) {
                advHeader.addEventListener('click', function () {
                    var body = view.querySelector('#advancedSettings .advanced-body');
                    var icon = view.querySelector('#advancedSettings .expand-icon');
                    var isHidden = body.style.display === 'none';
                    body.style.display = isHidden ? 'block' : 'none';
                    icon.innerText = isHidden ? 'expand_less' : 'expand_more';
                });
            }

            view.querySelector('#btnAddTag').addEventListener('click', () => renderTagGroup({ Tag: '', Urls: [''], Active: true, Limit: 50 }, view.querySelector('#tagListContainer'), true));

            window.ApiClient.getPluginConfiguration(pluginId).then(config => {
                var container = view.querySelector('#tagListContainer'); container.innerHTML = '';
                view.querySelector('#txtTraktClientId').value = config.TraktClientId || '';
                view.querySelector('#txtMdblistApiKey').value = config.MdblistApiKey || '';
                view.querySelector('#chkExtendedConsoleOutput').checked = config.ExtendedConsoleOutput || false;
                view.querySelector('#chkDryRunMode').checked = config.DryRunMode || false;
                var grouped = {};
                (config.Tags || []).forEach(t => {
                    if (!grouped[t.Tag]) grouped[t.Tag] = { Tag: t.Tag, Urls: [], Active: t.Active, Limit: t.Limit, Blacklist: t.Blacklist, ActiveIntervals: t.ActiveIntervals };
                    if (t.Url) grouped[t.Tag].Urls.push(t.Url);
                });
                Object.keys(grouped).forEach(k => renderTagGroup(grouped[k], container, false));
                if (Object.keys(grouped).length === 0) renderTagGroup({ Tag: '', Urls: [''], Active: true, Limit: 50 }, container, false);
            });
        });

        view.addEventListener('viewhide', () => { if (statusInterval) clearInterval(statusInterval); });

        view.querySelector('.AutoTagForm').addEventListener('submit', e => {
            e.preventDefault();
            var flatTags = [];
            view.querySelectorAll('.tag-row').forEach(row => {
                var name = row.querySelector('.txtTagName').value, active = row.querySelector('.chkTagActive').checked, limit = parseInt(row.querySelector('.txtTagLimit').value) || 50;
                var bl = row.querySelector('.txtTagBlacklist').value.split(',').map(s => s.trim()).filter(s => s.length > 0);

                var intervals = [];
                row.querySelectorAll('.date-row').forEach(dr => {
                    var type = dr.querySelector('.selDateType').value;
                    var s = null, e = null, days = "";

                    if (type === 'SpecificDate') {
                        s = dr.querySelector('.txtFullStartDate').value;
                        e = dr.querySelector('.txtFullEndDate').value;
                    } else if (type === 'EveryYear') {
                        var sM = dr.querySelector('.selStartMonth').value, sD = dr.querySelector('.selStartDay').value;
                        var eM = dr.querySelector('.selEndMonth').value, eD = dr.querySelector('.selEndDay').value;
                        s = `2000-${sM.padStart(2, '0')}-${sD.padStart(2, '0')}`;
                        e = `2000-${eM.padStart(2, '0')}-${eD.padStart(2, '0')}`;
                    } else if (type === 'Weekly') {
                        var activeBtns = Array.from(dr.querySelectorAll('.day-toggle.active')).map(b => b.dataset.day);
                        days = activeBtns.join(',');
                    }

                    intervals.push({ Type: type, Start: s || null, End: e || null, DayOfWeek: days });
                });

                row.querySelectorAll('.txtTagUrl').forEach(u => {
                    if (u.value) flatTags.push({ Tag: name, Url: u.value.trim(), Active: active, Limit: limit, Blacklist: bl, ActiveIntervals: intervals });
                });
            });

            window.ApiClient.getPluginConfiguration(pluginId).then(config => {
                config.TraktClientId = view.querySelector('#txtTraktClientId').value;
                config.MdblistApiKey = view.querySelector('#txtMdblistApiKey').value;
                config.ExtendedConsoleOutput = view.querySelector('#chkExtendedConsoleOutput').checked;
                config.DryRunMode = view.querySelector('#chkDryRunMode').checked;
                config.Tags = flatTags;
                window.ApiClient.updatePluginConfiguration(pluginId, config).then(r => window.Dashboard.processPluginConfigurationUpdateResult(r));
            });
        });

        view.querySelector('#btnRunSync').addEventListener('click', () => {
            window.ApiClient.getScheduledTasks().then(tasks => {
                var t = tasks.find(x => x.Key === "AutoTagSyncTask");
                if (t) window.ApiClient.startScheduledTask(t.Id).then(() => window.Dashboard.alert('Sync started!'));
            });
        });
    };
});
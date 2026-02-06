define([], function () {
    'use strict';

    var pluginId = "7c10708f-43e4-4d69-923c-77d01802315b";

    function getUrlRowHtml(value) {
        var val = value || '';
        return `
            <div class="url-row" style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <div style="flex-grow:1;">
                    <input is="emby-input" class="txtTagUrl" type="text" label="Trakt/MDBList URL or ID" value="${val}" />
                </div>
                
                <button type="button" is="emby-button" class="raised button-submit btnTestUrl" style="min-width:60px; height:36px; padding:0 10px; font-size:0.8rem; margin:0;" title="Test Source">
                    <span>Test</span>
                </button>

                <button type="button" is="emby-button" class="raised btnRemoveUrl" style="background:transparent !important; min-width:40px; width:40px; padding:0; color:#cc3333; display:flex; align-items:center; justify-content:center; box-shadow:none;" title="Remove URL">
                    <i class="md-icon">remove_circle_outline</i>
                </button>
            </div>`;
    }

    function renderTagGroup(tagConfig, container) {
        var isChecked = tagConfig.Active !== false ? 'checked' : '';
        var tagName = tagConfig.Tag || '';
        var limit = tagConfig.Limit || 50; // Standardvärde om tomt
        var urls = tagConfig.Urls || [];
        var blacklist = (tagConfig.Blacklist || []).join(', ');

        var activeText = tagConfig.Active !== false ? "Active" : "Disabled";
        var activeColor = tagConfig.Active !== false ? "#52B54B" : "var(--theme-text-secondary)";

        var urlHtml = '';
        if (urls.length > 0) {
            for (var i = 0; i < urls.length; i++) urlHtml += getUrlRowHtml(urls[i]);
        } else {
            urlHtml += getUrlRowHtml('');
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
                    </div>
                </div>
                <i class="md-icon expand-icon">expand_more</i>
            </div>

            <div class="tag-body" style="display:none; padding:15px; border-top:1px solid rgba(255,255,255,0.1);">
                
                <div style="display:flex; gap:20px; align-items:center;">
                    <div class="inputContainer" style="flex-grow:1;">
                        <input is="emby-input" class="txtTagName" type="text" label="Tag Name" value="${tagName}" />
                    </div>
                    <div class="inputContainer" style="width:120px;">
                        <input is="emby-input" class="txtTagLimit" type="number" label="Max Items" value="${limit}" min="1" />
                    </div>
                </div>
                
                <p style="margin:10px 0 10px 0; font-size:0.9em; font-weight:bold; opacity:0.7;">Source URLs</p>
                <div class="url-list-container">${urlHtml}</div>
                <div style="margin-top:10px;">
                    <button is="emby-button" type="button" class="raised btnAddUrl" style="width:100%; background:transparent; border:1px dashed #555; color:#ccc;">
                        <i class="md-icon" style="margin-right:5px;">add</i>Add another URL
                    </button>
                </div>

                <div class="inputContainer" style="margin-top: 30px; padding-top: 20px; border-top: 1px dashed rgba(255,255,255,0.1);">
                    <p style="margin:0 0 5px 0; font-size:0.9em; font-weight:bold; opacity:0.7;">Blacklist / Ignore</p>
                    <textarea is="emby-textarea" 
                              class="txtTagBlacklist" 
                              rows="2" 
                              placeholder="t.ex. tt1234567, The Matrix">${blacklist}</textarea>
                    <div class="fieldDescription">Separate items with comma. Items here will NEVER be tagged by this rule.</div>
                </div>

                <div style="text-align:right; margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
                    <button is="emby-button" type="button" class="raised btnRemoveGroup" onclick="event.stopPropagation()" style="background:#cc3333 !important; color:#fff;">
                        <i class="md-icon" style="margin-right:5px;">delete</i>Remove Tag Group
                    </button>
                </div>
            </div>
        </div>`;

        container.insertAdjacentHTML('beforeend', html);
        var row = container.lastElementChild;
        setupRowEvents(row);
    }

    function setupRowEvents(row) {
        var header = row.querySelector('.tag-header');
        var body = row.querySelector('.tag-body');
        var expandIcon = row.querySelector('.expand-icon');

        header.addEventListener('click', function (e) {
            if (e.target.closest('.header-actions')) return;
            var isHidden = body.style.display === 'none';
            body.style.display = isHidden ? 'block' : 'none';
            expandIcon.innerText = isHidden ? 'expand_less' : 'expand_more';
        });

        var chk = row.querySelector('.chkTagActive');
        var lblStatus = row.querySelector('.lblActiveStatus');

        chk.addEventListener('change', function () {
            if (this.checked) {
                lblStatus.textContent = "Active";
                lblStatus.style.color = "#52B54B";
            } else {
                lblStatus.textContent = "Disabled";
                lblStatus.style.color = "var(--theme-text-secondary)";
            }
        });

        var txtName = row.querySelector('.txtTagName');
        var titleSpan = row.querySelector('.tag-title');
        txtName.addEventListener('input', function () { titleSpan.textContent = this.value || 'New Tag'; });

        row.querySelector('.btnAddUrl').addEventListener('click', function () {
            var list = row.querySelector('.url-list-container');
            list.insertAdjacentHTML('beforeend', getUrlRowHtml(''));
            updateCount(row);
        });

        row.querySelector('.url-list-container').addEventListener('click', function (e) {
            if (e.target.closest('.btnRemoveUrl')) {
                e.target.closest('.url-row').remove();
                updateCount(row);
                return;
            }

            var btnTest = e.target.closest('.btnTestUrl');
            if (btnTest) {
                var urlRow = btnTest.closest('.url-row');
                var url = urlRow.querySelector('.txtTagUrl').value;
                var span = btnTest.querySelector('span');
                var originalText = span.textContent;

                if (!url) {
                    if (window.Dashboard) window.Dashboard.alert("Please enter a URL to test.");
                    return;
                }

                span.textContent = "...";
                btnTest.disabled = true;
                var ApiClient = window.ApiClient;

                ApiClient.getJSON(ApiClient.getUrl("AutoTag/TestUrl", { Url: url, Limit: 10 })).then(function (result) {
                    if (window.Dashboard) {
                        if (result.Success) {
                            window.Dashboard.alert("✅ Valid Link!\n\n" + result.Message);
                        } else {
                            window.Dashboard.alert("❌ Invalid Link:\n" + result.Message);
                        }
                    } else {
                        alert(result.Message);
                    }
                }).catch(function () {
                    if (window.Dashboard) window.Dashboard.alert("❌ Network Error:\nCould not reach the server plugin.");
                }).finally(function () {
                    span.textContent = originalText;
                    btnTest.disabled = false;
                });
            }
        });

        row.querySelector('.btnRemoveGroup').addEventListener('click', function () {
            if (confirm("Delete this tag group?")) row.remove();
        });
    }

    function updateCount(row) {
        var count = row.querySelectorAll('.txtTagUrl').length;
        row.querySelector('.tag-status').textContent = count + " SOURCE(S)";
    }

    return function (view) {
        view.addEventListener('viewshow', function () {
            var ApiClient = window.ApiClient;
            if (window.Dashboard) window.Dashboard.showLoadingMsg();

            ApiClient.getPluginConfiguration(pluginId).then(function (config) {
                var container = view.querySelector('#tagListContainer');
                container.innerHTML = '';

                var advHeader = view.querySelector('#advancedSettings .advanced-header');
                var newHeader = advHeader.cloneNode(true);
                advHeader.parentNode.replaceChild(newHeader, advHeader);
                newHeader.addEventListener('click', function () {
                    var section = view.querySelector('#advancedSettings');
                    var body = section.querySelector('.advanced-body');
                    var icon = section.querySelector('.expand-icon');
                    var isHidden = body.style.display === 'none';
                    body.style.display = isHidden ? 'block' : 'none';
                    icon.innerText = isHidden ? 'expand_less' : 'expand_more';
                });

                view.querySelector('#txtTraktClientId').value = config.TraktClientId || '';
                view.querySelector('#txtMdblistApiKey').value = config.MdblistApiKey || '';
                view.querySelector('#chkExtendedConsoleOutput').checked = config.ExtendedConsoleOutput || false;
                view.querySelector('#chkDryRunMode').checked = config.DryRunMode || false;

                var rawTags = config.Tags || [];
                var grouped = {};
                for (var i = 0; i < rawTags.length; i++) {
                    var t = rawTags[i];
                    var name = t.Tag || 'Untitled';
                    if (!grouped[name]) {
                        grouped[name] = { Tag: name, Urls: [], Active: t.Active !== false, Limit: t.Limit || 50, Blacklist: t.Blacklist || [] };
                    }
                    if (t.Url) grouped[name].Urls.push(t.Url);

                    if (t.Blacklist && t.Blacklist.length > 0) {
                        t.Blacklist.forEach(b => { if (!grouped[name].Blacklist.includes(b)) grouped[name].Blacklist.push(b); });
                    }
                }

                var keys = Object.keys(grouped);
                if (keys.length > 0) { keys.forEach(function (k) { renderTagGroup(grouped[k], container); }); }
                else { renderTagGroup({ Tag: '', Urls: [''], Active: true, Limit: 50, Blacklist: [] }, container); }

                if (window.Dashboard) window.Dashboard.hideLoadingMsg();
            });
        });

        view.querySelector('#btnAddTag').addEventListener('click', function () {
            var container = view.querySelector('#tagListContainer');
            renderTagGroup({ Tag: '', Urls: [''], Active: true, Limit: 50, Blacklist: [] }, container);
            var newRow = container.lastElementChild;
            newRow.querySelector('.tag-body').style.display = 'block';
            newRow.querySelector('.expand-icon').innerText = 'expand_less';
        });

        view.querySelector('.AutoTagForm').addEventListener('submit', function (e) {
            e.preventDefault();
            if (window.Dashboard) window.Dashboard.showLoadingMsg();

            var ApiClient = window.ApiClient;
            var flatTags = [];
            var rows = view.querySelectorAll('.tag-row');

            rows.forEach(function (row) {
                var tagName = row.querySelector('.txtTagName').value;
                var limitVal = parseInt(row.querySelector('.txtTagLimit').value) || 50; // Läs limit
                var isActive = row.querySelector('.chkTagActive').checked;
                var urls = row.querySelectorAll('.txtTagUrl');

                var blText = row.querySelector('.txtTagBlacklist').value;
                var blArray = blText.split(',').map(s => s.trim()).filter(s => s.length > 0);

                if (tagName) {
                    urls.forEach(function (urlInput) {
                        var u = urlInput.value;
                        if (u && u.trim() !== '') {
                            flatTags.push({
                                Tag: tagName,
                                Url: u.trim(),
                                Active: isActive,
                                Limit: limitVal, // Spara limit
                                Blacklist: blArray
                            });
                        }
                    });
                }
            });

            ApiClient.getPluginConfiguration(pluginId).then(function (config) {
                config.TraktClientId = view.querySelector('#txtTraktClientId').value;
                config.MdblistApiKey = view.querySelector('#txtMdblistApiKey').value;
                config.ExtendedConsoleOutput = view.querySelector('#chkExtendedConsoleOutput').checked;
                config.DryRunMode = view.querySelector('#chkDryRunMode').checked;
                config.Tags = flatTags;

                ApiClient.updatePluginConfiguration(pluginId, config).then(function (result) {
                    if (window.Dashboard) window.Dashboard.processPluginConfigurationUpdateResult(result);
                });
            });
            return false;
        });

        var btnRunSync = view.querySelector('#btnRunSync');
        if (btnRunSync) {
            btnRunSync.addEventListener('click', function () {
                if (window.Dashboard) window.Dashboard.showLoadingMsg();
                var ApiClient = window.ApiClient;
                ApiClient.getScheduledTasks().then(function (tasks) {
                    var myTask = tasks.find(t => t.Key === "AutoTagSyncTask");
                    if (myTask) {
                        ApiClient.startScheduledTask(myTask.Id).then(function () {
                            if (window.Dashboard) {
                                window.Dashboard.hideLoadingMsg();
                                window.Dashboard.alert('Sync started!');
                            }
                        });
                    }
                });
            });
        }
    };
});
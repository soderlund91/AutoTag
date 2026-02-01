define([], function () {
    'use strict';

    var pluginId = "E1234567-89AB-CDEF-0123-456789ABCDEF";

    function renderTagRow(tagData, container, prepend) {
        var tActive = (tagData.Active !== false);
        var tName = tagData.Tag || '';
        var tUrl = tagData.Url || '';
        var tLimit = tagData.Limit || 50;

        var checkedStr = tActive ? 'checked' : '';
        var displayTitle = tName ? tName : "New Source";
        var activeStatus = tActive ? "Active" : "Disabled";

        var html = `
            <div class="tag-row">
                <div class="tag-header">
                    <div class="tag-info">
                        <i class="md-icon expand-icon">expand_more</i>
                        <span class="tag-title">${displayTitle}</span>
                        <span class="tag-status" style="${tActive ? 'color:#52B54B' : 'color:#ccc'}">${activeStatus}</span>
                    </div>
                    <div class="header-actions" style="display:flex; align-items:center;">
                        <label class="flex align-items-center" style="margin-right:15px; cursor:pointer;" title="Enable/Disable">
                            <input type="checkbox" class="chkTagActive" ${checkedStr} />
                        </label>
                        <button is="emby-button" type="button" class="raised button-cancel btnRemoveTag" style="min-width: unset; padding: 0.5em;" title="Delete">
                            <i class="md-icon">delete</i>
                        </button>
                    </div>
                </div>
                <div class="tag-body">
                    <div class="inputContainer">
                        <input is="emby-input" type="text" class="txtTagName" label="Tag Name" value="${tName}" />
                        <div class="fieldDescription">The tag applied in Emby (e.g. weekly_trending).</div>
                    </div>
                    <div style="display:flex; align-items: flex-end; gap: 10px;">
                        <div class="inputContainer" style="flex-grow:1;">
                            <input is="emby-input" type="text" class="txtTagUrl" label="Source URL" value="${tUrl}" />
                            <div class="fieldDescription">Trakt URL or MDBList URL.</div>
                        </div>
                        <button is="emby-button" type="button" class="raised button-submit btnTestUrl" style="margin-bottom: 2.2em; min-width: 80px;">
                            <span>Test</span>
                        </button>
                    </div>
                    <div class="inputContainer">
                        <input is="emby-input" type="number" class="txtTagLimit" label="Limit" value="${tLimit}" />
                    </div>
                </div>
            </div>`;

        if (prepend) container.insertAdjacentHTML('afterbegin', html);
        else container.insertAdjacentHTML('beforeend', html);

        setupRowEvents(prepend ? container.firstElementChild : container.lastElementChild);
    }

    function setupRowEvents(row) {
        var header = row.querySelector('.tag-header');
        header.addEventListener('click', function (e) {
            if (e.target.closest('.header-actions')) return;
            row.classList.toggle('expanded');
        });

        var txtName = row.querySelector('.txtTagName');
        var titleSpan = row.querySelector('.tag-title');
        txtName.addEventListener('input', function () { titleSpan.textContent = this.value || "New Source"; });

        var chk = row.querySelector('.chkTagActive');
        var statusSpan = row.querySelector('.tag-status');
        chk.addEventListener('change', function () {
            statusSpan.textContent = this.checked ? "Active" : "Disabled";
            statusSpan.style.color = this.checked ? "#52B54B" : "#ccc";
        });

        var btnTest = row.querySelector('.btnTestUrl');
        btnTest.addEventListener('click', function () {
            var url = row.querySelector('.txtTagUrl').value;
            var limit = row.querySelector('.txtTagLimit').value || 10;
            var span = btnTest.querySelector('span');
            var originalText = span.textContent;
            if (!url) { alert("Please enter a URL to test."); return; }

            span.textContent = "...";
            btnTest.disabled = true;
            var ApiClient = window.ApiClient;

            ApiClient.getJSON(ApiClient.getUrl("AutoTag/TestUrl", { Url: url, Limit: limit })).then(function (result) {
                if (result.Success) {
                    var msg = "✅ Connection Successful!\n\n" + result.Message;
                    alert(msg);
                } else {
                    alert("❌ Error:\n" + result.Message);
                }
            }).catch(function () {
                alert("❌ Network Error:\nCould not reach the server plugin.");
            }).finally(function () {
                span.textContent = originalText;
                btnTest.disabled = false;
            });
        });
    }

    return function (view) {
        view.addEventListener('viewshow', function () {
            var ApiClient = window.ApiClient;
            if (!ApiClient) return;
            if (window.Dashboard) window.Dashboard.showLoadingMsg();

            ApiClient.getPluginConfiguration(pluginId).then(function (config) {
                view.querySelector('#txtTraktClientId').value = config.TraktClientId || '';
                view.querySelector('#txtMdblistApiKey').value = config.MdblistApiKey || '';
                view.querySelector('#chkExtendedConsoleOutput').checked = config.ExtendedConsoleOutput || false;
                view.querySelector('#chkDryRunMode').checked = config.DryRunMode || false;

                var container = view.querySelector('#tagListContainer');
                container.innerHTML = '';

                var tags = config.Tags || [];
                if (tags.length > 0) tags.forEach(function (t) { renderTagRow(t, container, false); });
                else {
                    renderTagRow({ Active: true, Tag: '', Url: '', Limit: 50 }, container, false);
                    container.firstElementChild.classList.add('expanded');
                }
                if (window.Dashboard) window.Dashboard.hideLoadingMsg();
            });
        });

        view.querySelector('#advancedSettings .advanced-header').addEventListener('click', function () {
            this.parentElement.classList.toggle('expanded');
        });

        view.querySelector('#btnRunSync').addEventListener('click', function () {
            var btn = this;
            var originalText = btn.querySelector('span').textContent;

            var isDryRun = view.querySelector('#chkDryRunMode').checked;
            var msg = "Run the AutoTag sync task now?";
            if (isDryRun) msg += "\n\n⚠️ DRY RUN MODE IS ENABLED. No changes will be saved.";

            if (!confirm(msg)) return;

            btn.disabled = true;
            btn.querySelector('span').textContent = "Starting...";
            var ApiClient = window.ApiClient;

            ApiClient.ajax({
                type: "POST",
                url: ApiClient.getUrl("AutoTag/RunSync"),
                dataType: "json"
            })
                .finally(function () {
                    btn.disabled = false;
                    btn.querySelector('span').textContent = originalText;
                });
        });

        view.querySelector('#btnAddTag').addEventListener('click', function () {
            var container = view.querySelector('#tagListContainer');
            renderTagRow({ Active: true, Tag: '', Url: '', Limit: 50 }, container, true);
            container.firstElementChild.classList.add('expanded');
        });

        view.querySelector('#tagListContainer').addEventListener('click', function (e) {
            if (e.target.closest('.btnRemoveTag')) {
                var row = e.target.closest('.tag-row');
                if (row) {
                    row.style.opacity = '0';
                    setTimeout(() => row.remove(), 200);
                }
            }
        });

        view.querySelector('.AutoTagForm').addEventListener('submit', function (e) {
            e.preventDefault();
            var ApiClient = window.ApiClient;
            if (window.Dashboard) window.Dashboard.showLoadingMsg();

            var traktId = view.querySelector('#txtTraktClientId').value;
            var mdbKey = view.querySelector('#txtMdblistApiKey').value;
            var extOutput = view.querySelector('#chkExtendedConsoleOutput').checked;
            var dryRun = view.querySelector('#chkDryRunMode').checked;

            var tags = [];
            var rows = view.querySelectorAll('.tag-row');
            rows.forEach(function (row) {
                var tName = row.querySelector('.txtTagName').value;
                if (tName) {
                    tags.push({
                        Active: row.querySelector('.chkTagActive').checked,
                        Tag: tName,
                        Url: row.querySelector('.txtTagUrl').value,
                        Limit: parseInt(row.querySelector('.txtTagLimit').value) || 50
                    });
                }
            });

            ApiClient.getPluginConfiguration(pluginId).then(function (config) {
                config.TraktClientId = traktId;
                config.MdblistApiKey = mdbKey;
                config.ExtendedConsoleOutput = extOutput;
                config.DryRunMode = dryRun;
                config.Tags = tags;
                ApiClient.updatePluginConfiguration(pluginId, config).then(function (result) {
                    if (window.Dashboard) window.Dashboard.processPluginConfigurationUpdateResult(result);
                });
            });
            return false;
        });
    };
});
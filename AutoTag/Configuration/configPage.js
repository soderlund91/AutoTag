define([], function () {
    'use strict';

    var pluginId = "E1234567-89AB-CDEF-0123-456789ABCDEF";

    function renderTagRow(tagData, container, prepend) {
        var tActive = (tagData.Active !== false);
        var tName = tagData.Tag || '';
        var tUrl = tagData.Url || '';
        var tLimit = tagData.Limit || 50;

        var checkedStr = tActive ? 'checked' : '';

        var html = `
            <div class="tag-row" style="background: rgba(0,0,0,0.2); padding: 15px; margin-bottom: 15px; border-radius: 5px; border-left: 5px solid #52B54B;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                    <label style="display:flex; align-items:center; cursor:pointer;">
                        <input type="checkbox" class="chkTagActive" ${checkedStr} style="margin-right:10px; transform: scale(1.5);" />
                        <h3 style="margin:0;">Active Source</h3>
                    </label>

                    <button is="emby-button" type="button" class="raised button-cancel btnRemoveTag" style="min-width: unset; padding: 0.5em;">X</button>
                </div>
                
                <div class="inputContainer">
                    <input is="emby-input" type="text" class="txtTagName" label="Tag Name" value="${tName}" />
                    <div class="fieldDescription">The tag applied in Emby (e.g. weekly_movies).</div>
                </div>
                
                <div class="inputContainer">
                    <input is="emby-input" type="text" class="txtTagUrl" label="Source URL" value="${tUrl}" />
                    <div class="fieldDescription">Trakt URL or MDBList URL.</div>
                </div>
                
                <div class="inputContainer">
                    <input is="emby-input" type="number" class="txtTagLimit" label="Limit" value="${tLimit}" />
                </div>
            </div>`;

        if (prepend) {
            container.insertAdjacentHTML('afterbegin', html);
        } else {
            container.insertAdjacentHTML('beforeend', html);
        }
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

                var container = view.querySelector('#tagListContainer');
                container.innerHTML = '';

                var tags = config.Tags || [];
                if (tags.length > 0) {
                    tags.forEach(function (t) { renderTagRow(t, container, false); });
                } else {
                    renderTagRow({ Active: true, Tag: '', Url: '', Limit: 50 }, container, false);
                }

                if (window.Dashboard) window.Dashboard.hideLoadingMsg();
            });
        });

        view.querySelector('#btnAddTag').addEventListener('click', function () {
            var container = view.querySelector('#tagListContainer');
            renderTagRow({ Active: true, Tag: '', Url: '', Limit: 50 }, container, true);

        });

        view.querySelector('#tagListContainer').addEventListener('click', function (e) {
            if (e.target.classList.contains('btnRemoveTag')) {
                var row = e.target.closest('.tag-row');
                if (row) row.remove();
            }
        });

        view.querySelector('.AutoTagForm').addEventListener('submit', function (e) {
            e.preventDefault();
            var ApiClient = window.ApiClient;
            if (window.Dashboard) window.Dashboard.showLoadingMsg();

            var traktId = view.querySelector('#txtTraktClientId').value;
            var mdbKey = view.querySelector('#txtMdblistApiKey').value;
            var extOutput = view.querySelector('#chkExtendedConsoleOutput').checked;

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
                config.Tags = tags;

                ApiClient.updatePluginConfiguration(pluginId, config).then(function (result) {
                    if (window.Dashboard) window.Dashboard.processPluginConfigurationUpdateResult(result);
                });
            });
            return false;
        });
    };
});
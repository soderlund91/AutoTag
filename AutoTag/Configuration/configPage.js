define(['emby-input', 'emby-button', 'emby-select', 'emby-checkbox'], function () {
    'use strict';

    var pluginId = "7c10708f-43e4-4d69-923c-77d01802315b";
    var statusInterval = null;
    var originalConfigState = null;

    var cachedCollections = [];
    var cachedPlaylists = [];

    var customCss = `
    <style id="autoTagCustomCss">
        .day-toggle {
            background: rgba(0,0,0,0.2);
            color: var(--theme-text-secondary);
            border: 1px solid var(--theme-border-color-light);
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 0.9em;
            transition: all 0.2s;
            text-transform: uppercase;
            font-weight: bold;
            flex-grow: 1;
            text-align: center;
        }
        .day-toggle:hover {
            background: var(--theme-background-level2);
            color: var(--theme-text-primary);
            border-color: var(--theme-primary-color);
        }
        .day-toggle.active {
            background: #52B54B;
            color: #fff;
            border-color: #52B54B;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }
        
        .date-row-container {
            background: rgba(0,0,0,0.2); 
            border: 1px solid var(--theme-border-color-light);
            border-radius: 6px; 
            padding: 15px; 
            margin-bottom: 10px;
        }

        .selectLabel {
            font-size: 0.9em;
            color: var(--theme-text-secondary);
            margin-bottom: 5px;
            font-weight: 500;
            display: block;
        }

        .tag-indicator {
            margin-left: 10px;
            font-size: 0.75em;
            padding: 2px 8px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 4px;
            font-weight: 500;
        }
        
        .tag-indicator.schedule {
            color: #00a4dc; 
            background: rgba(255,255,255,0.1); 
            border: 1px solid rgba(0,164,220,0.3);
        }

        .tag-indicator.collection {
            color: #E0E0E0; 
            background: rgba(255,255,255,0.1); 
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .badge-container {
            display: flex;
            align-items: center;
        }

        .sort-hidden .drag-handle {
            display: none !important;
        }

        .dry-run-warning {
            background-color: #E67E22;
            color: #000000;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            text-align: center;
            font-weight: bold;
            font-size: 1.1em;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            display: none;
            align-items: center;
            justify-content: center;
            gap: 10px;
            position: sticky;
            top: 60px;
            z-index: 10000;
        }

        .drag-handle {
            cursor: grab;
            margin-right: 15px;
            color: var(--theme-text-secondary);
            display: flex;
            align-items: center;
        }

        .drag-handle:active {
            cursor: grabbing;
        }

        .tag-row {
            position: relative;
            background: var(--theme-background-level2);
            margin-bottom: 15px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-left: 5px solid #52B54B;
            transition: all 0.2s ease;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            overflow: hidden;
        }

        .tag-row.inactive {
            border-left-color: rgba(255, 255, 255, 0.8);
        }

        .tag-row.dragging {
            opacity: 0.4 !important;
            border: 2px dashed #999 !important;
            background: var(--theme-background-level1) !important;
        }

        .sort-placeholder {
            height: 40px;
            background-color: transparent;
            margin-bottom: 15px;
            border-radius: 6px;
            border: 2px dashed rgba(255, 255, 255, 0.1);
            transition: height 0.2s;
        }

        .tag-row.just-moved {
            animation: moveHighlight 2s ease-out forwards;
        }

        .tag-row.just-added {
            animation: addHighlight 2s ease-out forwards;
        }

        @keyframes moveHighlight {
            0% {
                border-top: 1px solid #00a4dc;
                border-right: 1px solid #00a4dc;
                border-bottom: 1px solid #00a4dc;
                box-shadow: 0 0 15px rgba(0,164,220,0.5);
            }
            100% {
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                border-right: 1px solid rgba(255, 255, 255, 0.08);
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            }
        }

        @keyframes addHighlight {
            0% {
                border-top: 1px solid #52B54B;
                border-right: 1px solid #52B54B;
                border-bottom: 1px solid #52B54B;
                box-shadow: 0 0 15px rgba(82,181,75,0.5);
            }
            100% {
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                border-right: 1px solid rgba(255, 255, 255, 0.08);
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            }
        }

        .control-row {
            background: rgba(0,0,0,0.15);
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            border: 1px solid rgba(255,255,255,0.05);
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .control-sub-row {
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .control-group {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .control-label {
            font-size: 0.85em;
            opacity: 0.5;
            text-transform: uppercase;
            font-weight: bold;
            letter-spacing: 0.5px;
        }

        .search-input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            flex-grow: 1;
            max-width: 250px;
        }

        .search-input-wrapper .search-icon {
            position: absolute;
            left: 10px;
            font-size: 1.2em;
            opacity: 0.5;
            pointer-events: none;
        }

        #btnClearSearch {
            position: absolute;
            right: 8px;
            cursor: pointer;
            opacity: 0.5;
            display: none;
        }

        #btnClearSearch:hover {
            opacity: 1;
            color: #cc3333;
        }

        #txtSearchTags {
            width: 100%;
            background: rgba(255,255,255,0.05) !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            border-radius: 4px !important;
            padding: 6px 30px 6px 35px !important;
            color: inherit;
            font-size: 0.95em;
        }

        #txtSearchTags:focus {
            border-color: var(--theme-primary-color) !important;
            background: rgba(255,255,255,0.1) !important;
        }
    </style>`;

    function getUrlRowHtml(value, limit) {
        var val = value || '';
        var lim = limit !== undefined ? limit : 0;
        return `
            <div class="url-row" style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <div style="flex-grow:1;">
                    <input is="emby-input" class="txtTagUrl" type="text" label="Trakt/MDBList URL or ID" value="${val}" />
                </div>
                <div style="width:110px;">
                    <input is="emby-input" class="txtUrlLimit" type="number" label="Max (0=All)" value="${lim}" min="0" />
                </div>
                <button type="button" is="emby-button" class="raised button-submit btnTestUrl" style="min-width:60px; height:36px; padding:0 10px; font-size:0.8rem; margin-top:12px;" title="Test Source"><span>Test</span></button>
                <button type="button" is="emby-button" class="raised btnRemoveUrl" style="background:transparent !important; min-width:40px; width:40px; padding:0; color:#cc3333; display:flex; align-items:center; justify-content:center; box-shadow:none; margin-top:12px;" title="Remove URL"><i class="md-icon">remove_circle_outline</i></button>
            </div>`;
    }

    function getLocalRowHtml(type, selectedName, limit) {
        var options = type === 'LocalCollection' ? cachedCollections : cachedPlaylists;
        var optHtml = '<option value="">-- Select --</option>' + options.map(o => `<option value="${o.Name}" ${selectedName === o.Name ? 'selected' : ''}>${o.Name}</option>`).join('');
        var lim = limit !== undefined ? limit : 0;
        return `
            <div class="local-row" style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <div style="flex-grow:1;">
                    <select is="emby-select" class="selLocalSource" style="width:100%;">
                        ${optHtml}
                    </select>
                </div>
                <div style="width:110px;">
                    <input is="emby-input" class="txtLocalLimit" type="number" label="Max (0=All)" value="${lim}" min="0" />
                </div>
                <button type="button" is="emby-button" class="raised btnRemoveLocal" style="background:transparent !important; min-width:40px; width:40px; padding:0; color:#cc3333; display:flex; align-items:center; justify-content:center; box-shadow:none; margin-top:12px;" title="Remove"><i class="md-icon">remove_circle_outline</i></button>
            </div>`;
    }

    function getMonthOptions(selectedMonth) {
        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
                
                <div style="width:160px;">
                    <label class="selectLabel">Rule Type</label>
                    <select is="emby-select" class="selDateType" style="width:100%;">
                        <option value="SpecificDate" ${type === 'SpecificDate' ? 'selected' : ''}>Specific Date</option>
                        <option value="EveryYear" ${type === 'EveryYear' ? 'selected' : ''}>Recurring</option>
                        <option value="Weekly" ${type === 'Weekly' ? 'selected' : ''}>Week Days</option>
                    </select>
                </div>
                
                <div class="inputs-specific" style="display: ${type === 'SpecificDate' ? 'flex' : 'none'}; gap: 8px; flex-grow: 1; align-items: center;">
                    <div style="flex-grow:1;">
                        <input is="emby-input" type="date" class="txtFullStartDate" label="Start Date" value="${sDate}" />
                    </div>
                    <span style="opacity:0.5; padding-top:15px;">to</span>
                    <div style="flex-grow:1;">
                        <input is="emby-input" type="date" class="txtFullEndDate" label="End Date" value="${eDate}" />
                    </div>
                </div>

                <div class="inputs-annual" style="display: ${type === 'EveryYear' ? 'flex' : 'none'}; gap: 8px; flex-grow: 1; align-items: flex-start;">
                    
                    <div style="display:flex; display:flex; gap:5px;">
                        <div style="width:80px;">
                            <label class="selectLabel">Start Month</label>
                            <select is="emby-select" class="selStartMonth" style="width:100%;">${getMonthOptions(sMonth)}</select>
                        </div>
                        <div style="width:70px;">
                            <label class="selectLabel">Day</label>
                            <select is="emby-select" class="selStartDay" style="width:100%;">${getDayOptions(sDay)}</select>
                        </div>
                    </div>

                    <span style="opacity:0.5; padding-top:32px;">to</span>

                    <div style="display:flex; display:flex; gap:5px;">
                        <div style="width:80px;">
                            <label class="selectLabel">End Month</label>
                            <select is="emby-select" class="selEndMonth" style="width:100%;">${getMonthOptions(eMonth)}</select>
                        </div>
                        <div style="width:70px;">
                            <label class="selectLabel">Day</label>
                            <select is="emby-select" class="selEndDay" style="width:100%;">${getDayOptions(eDay)}</select>
                        </div>
                    </div>
                </div>

                <div class="inputs-weekly" style="display: ${type === 'Weekly' ? 'flex' : 'none'}; flex-grow: 1; align-items: center; gap: 5px; flex-wrap: wrap;">
                    <div style="width:100%;">
                        <label class="selectLabel">Active On Days</label>
                        <div class="week-btn-container" style="display:flex; gap:5px; margin-top:2px;">
                            ${getWeekButtons(dayOfWeek)}
                        </div>
                    </div>
                </div>

                <button type="button" is="emby-button" class="btnRemoveDate" style="background:transparent; color:#cc3333; min-width:40px; margin-top: 25px;" title="Remove Rule"><i class="md-icon">delete</i></button>
            </div>`;
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.tag-row:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function renderTagGroup(tagConfig, container, prepend, index, isNew) {
        var isChecked = tagConfig.Active !== false ? 'checked' : '';
        var tagName = tagConfig.Tag || '';
        var labelName = tagConfig.Name || '';
        var urls = tagConfig.Urls || (tagConfig.Url ? [{ url: tagConfig.Url, limit: tagConfig.Limit !== undefined ? tagConfig.Limit : 0 }] : [{ url: '', limit: 0 }]);
        var blacklist = (tagConfig.Blacklist || []).join(', ');
        var intervals = tagConfig.ActiveIntervals || [];
        var idx = typeof index !== 'undefined' ? index : 9999;

        var lastMod = tagConfig.LastModified || new Date().toISOString();

        var enableColl = tagConfig.EnableCollection ? 'checked' : '';
        var onlyColl = tagConfig.OnlyCollection ? 'checked' : '';
        var collName = tagConfig.CollectionName || '';

        var sourceType = tagConfig.SourceType || "External";
        var localSources = tagConfig.LocalSources || [];
        if (localSources.length === 0) localSources = [{ id: "", limit: 0 }];

        var mediaInfoLimit = tagConfig.Limit || 0;

        var mediaInfo = tagConfig.MediaInfoConditions || [];
        var is4k = mediaInfo.includes("4K") ? "checked" : "";
        var is1080p = mediaInfo.includes("1080p") ? "checked" : "";
        var is720p = mediaInfo.includes("720p") ? "checked" : "";
        var isHEVC = mediaInfo.includes("HEVC") ? "checked" : "";
        var isAV1 = mediaInfo.includes("AV1") ? "checked" : "";
        var isHDR = mediaInfo.includes("HDR") ? "checked" : "";
        var isDolbyVision = mediaInfo.includes("DolbyVision") ? "checked" : "";
        var isAtmos = mediaInfo.includes("Atmos") ? "checked" : "";
        var isTrueHD = mediaInfo.includes("TrueHD") ? "checked" : "";
        var isDTS = mediaInfo.includes("DTS") ? "checked" : "";
        var is51 = mediaInfo.includes("5.1") ? "checked" : "";
        var is71 = mediaInfo.includes("7.1") ? "checked" : "";

        var activeText = tagConfig.Active !== false ? "Active" : "Disabled";
        var activeColor = tagConfig.Active !== false ? "#52B54B" : "var(--theme-text-secondary)";

        var indicatorsHtml = '';
        if (intervals.length > 0) {
            indicatorsHtml += `<span class="tag-indicator schedule"><i class="md-icon" style="font-size:1.1em;">calendar_today</i> Schedule</span>`;
        }
        if (tagConfig.EnableCollection) {
            indicatorsHtml += `<span class="tag-indicator collection"><i class="md-icon" style="font-size:1.1em;">library_books</i> Collection</span>`;
        }

        var sourceCount = 0;
        var sourceLabel = "SOURCE(S)";
        if (sourceType === 'External') {
            sourceCount = urls.length;
        } else if (sourceType === 'LocalCollection' || sourceType === 'LocalPlaylist') {
            sourceCount = localSources.length;
        } else if (sourceType === 'MediaInfo') {
            sourceCount = mediaInfo.length;
            sourceLabel = "FILTER(S)";
        }

        var initialStyle = isNew ? 'display:block;' : 'display:none;';
        var initialIcon = isNew ? 'expand_less' : 'expand_more';

        var inactiveClass = tagConfig.Active === false ? "inactive" : "";
        var newClass = isNew ? "just-added" : "";

        var html = `
        <div class="tag-row ${inactiveClass} ${newClass}" data-index="${idx}" data-last-modified="${lastMod}" data-dirty="false">
            <div class="tag-header" style="display:flex; align-items:center; justify-content:space-between; padding:10px; cursor:pointer;">
                <div style="display:flex; align-items:center;">
                    <div class="header-actions" style="margin-right:15px; display:flex; align-items:center;" onclick="event.stopPropagation()">
                        <div class="drag-handle">
                            <i class="md-icon">reorder</i>
                        </div>
                        <span class="lblActiveStatus" style="margin-right:8px; font-size:0.9em; font-weight:bold; color:${activeColor}; min-width:60px; text-align:right;">${activeText}</span>
                        <label class="checkboxContainer" style="margin:0;">
                            <input type="checkbox" is="emby-checkbox" class="chkTagActive" ${isChecked} />
                            <span></span>
                        </label>
                    </div>
                    <div class="tag-info" style="display:flex; align-items:center;">
                        <span class="tag-title" style="font-weight:bold; font-size:1.1em;">${labelName || tagName || 'New Tag'}</span>
                        <span class="tag-status" style="margin-left:10px; font-size:0.8em; opacity:0.7;">${sourceCount} ${sourceLabel}</span>
                        <span class="badge-container" style="display:flex; align-items:center;">${indicatorsHtml}</span>
                    </div>
                </div>
                <i class="md-icon expand-icon">${initialIcon}</i>
            </div>
            <div class="tag-body" style="${initialStyle} padding:15px; border-top:1px solid rgba(255,255,255,0.1);">
                <div class="tag-tabs" style="display: flex; gap: 20px; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div class="tag-tab active" data-tab="general" style="padding: 8px 0; cursor: pointer; font-weight: bold; border-bottom: 2px solid #52B54B;">Source</div>
                    <div class="tag-tab" data-tab="schedule" style="padding: 8px 0; cursor: pointer; opacity: 0.6; font-weight: bold; border-bottom: 2px solid transparent;">Schedule</div>
                    <div class="tag-tab" data-tab="collection" style="padding: 8px 0; cursor: pointer; opacity: 0.6; font-weight: bold; border-bottom: 2px solid transparent;">Collection</div>
                    <div class="tag-tab" data-tab="advanced" style="padding: 8px 0; cursor: pointer; opacity: 0.6; font-weight: bold; border-bottom: 2px solid transparent;">Blacklist</div>
                </div>
                
                <div class="tab-content general-tab">
                    <div class="inputContainer" style="flex-grow:1;"><input is="emby-input" class="txtEntryLabel" type="text" label="Entry Label (Display Name)" value="${labelName}" /></div>
                    <div class="inputContainer" style="flex-grow:1;"><input is="emby-input" class="txtTagName" type="text" label="Tag Name" value="${tagName}" /></div>
                    
                    <div style="margin-bottom: 15px;">
                        <label class="selectLabel">Source Type</label>
                        <select is="emby-select" class="selSourceType" style="width:100%;">
                            <option value="External" ${sourceType === 'External' ? 'selected' : ''}>External List (Trakt/MDBList)</option>
                            <option value="LocalCollection" ${sourceType === 'LocalCollection' ? 'selected' : ''}>Local Collection</option>
                            <option value="LocalPlaylist" ${sourceType === 'LocalPlaylist' ? 'selected' : ''}>Local Playlist</option>
                            <option value="MediaInfo" ${sourceType === 'MediaInfo' ? 'selected' : ''}>Media Information</option>
                        </select>
                    </div>

                    <div class="source-external-container" style="display: ${sourceType === 'External' ? 'block' : 'none'};">
                        <p style="margin:10px 0 10px 0; font-size:0.9em; font-weight:bold; opacity:0.7;">Source URLs</p>
                        <div class="url-list-container">${urls.map(u => getUrlRowHtml(u.url, u.limit)).join('')}</div>
                        <div style="margin-top:10px;"><button is="emby-button" type="button" class="raised btnAddUrl" style="width:100%; background:transparent; border:1px dashed #555; color:#ccc;"><i class="md-icon" style="margin-right:5px;">add</i>Add another URL</button></div>
                    </div>

                    <div class="source-local-container" style="display: ${(sourceType === 'LocalCollection' || sourceType === 'LocalPlaylist') ? 'block' : 'none'};">
                        <p style="margin:10px 0 10px 0; font-size:0.9em; font-weight:bold; opacity:0.7;" class="local-type-label">${sourceType === 'LocalPlaylist' ? 'Select Playlists' : 'Select Collections'}</p>
                        <div class="local-list-container">${localSources.map(ls => getLocalRowHtml(sourceType, ls.id, ls.limit)).join('')}</div>
                        <div style="margin-top:10px;"><button is="emby-button" type="button" class="raised btnAddLocal" style="width:100%; background:transparent; border:1px dashed #555; color:#ccc;"><i class="md-icon" style="margin-right:5px;">add</i>Add another</button></div>
                    </div>

                    <div class="source-mediainfo-container" style="display: ${sourceType === 'MediaInfo' ? 'block' : 'none'};">
                        <p style="margin:10px 0 5px 0; font-size:0.9em; font-weight:bold; opacity:0.7;">Select Media Requirements (Multiple allowed)</p>
                        <div class="media-info-grid">
                            <label class="checkboxContainer"><input is="emby-checkbox" type="checkbox" class="chkMediaInfo" value="4K" ${is4k} /><span>4K Resolution</span></label>
                            <label class="checkboxContainer"><input is="emby-checkbox" type="checkbox" class="chkMediaInfo" value="1080p" ${is1080p} /><span>Full HD (1080p)</span></label>
                            <label class="checkboxContainer"><input is="emby-checkbox" type="checkbox" class="chkMediaInfo" value="720p" ${is720p} /><span>HD (720p)</span></label>
                            <label class="checkboxContainer"><input is="emby-checkbox" type="checkbox" class="chkMediaInfo" value="HEVC" ${isHEVC} /><span>HEVC (H.265)</span></label>
                            <label class="checkboxContainer"><input is="emby-checkbox" type="checkbox" class="chkMediaInfo" value="AV1" ${isAV1} /><span>AV1 Codec</span></label>
                            <label class="checkboxContainer"><input is="emby-checkbox" type="checkbox" class="chkMediaInfo" value="HDR" ${isHDR} /><span>HDR</span></label>
                            <label class="checkboxContainer"><input is="emby-checkbox" type="checkbox" class="chkMediaInfo" value="DolbyVision" ${isDolbyVision} /><span>Dolby Vision</span></label>
                            <label class="checkboxContainer"><input is="emby-checkbox" type="checkbox" class="chkMediaInfo" value="Atmos" ${isAtmos} /><span>Dolby Atmos</span></label>
                            <label class="checkboxContainer"><input is="emby-checkbox" type="checkbox" class="chkMediaInfo" value="TrueHD" ${isTrueHD} /><span>Dolby TrueHD</span></label>
                            <label class="checkboxContainer"><input is="emby-checkbox" type="checkbox" class="chkMediaInfo" value="DTS" ${isDTS} /><span>DTS Audio</span></label>
                            <label class="checkboxContainer"><input is="emby-checkbox" type="checkbox" class="chkMediaInfo" value="5.1" ${is51} /><span>5.1 Channels</span></label>
                            <label class="checkboxContainer"><input is="emby-checkbox" type="checkbox" class="chkMediaInfo" value="7.1" ${is71} /><span>7.1 Channels</span></label>
                        </div>
                        <div style="width:110px; margin-top:15px;">
                            <input is="emby-input" class="txtMediaInfoLimit" type="number" label="Max (0=All)" value="${mediaInfoLimit}" min="0" />
                        </div>
                    </div>
                </div>

                <div class="tab-content schedule-tab" style="display:none;">
                    <p style="margin:0 0 15px 0; font-size:0.9em; opacity:0.8;">Define when this tag should be active. If empty, it's always active.</p>
                    <div class="date-list-container">${intervals.map(i => getDateRowHtml(i)).join('')}</div>
                    <button is="emby-button" type="button" class="btnAddDate" style="width:100%; background:transparent; border:1px dashed #555; margin-top:10px;"><i class="md-icon" style="margin-right:5px;">event</i>Add Schedule Rule</button>
                </div>

                <div class="tab-content collection-tab" style="display:none;">
                    <div class="checkboxContainer checkboxContainer-withDescription">
                        <label>
                            <input is="emby-checkbox" type="checkbox" class="chkEnableCollection" ${enableColl} />
                            <span>Create Collection</span>
                        </label>
                        <div class="fieldDescription">Automatically create and maintain an Emby Collection from these items.</div>
                    </div>
                    
                    <div class="collection-settings" style="margin-left: 20px; padding-left: 15px; border-left: 2px solid rgba(255,255,255,0.1); margin-top: 10px; display: ${tagConfig.EnableCollection ? 'block' : 'none'};">
                        <div class="inputContainer">
                            <input is="emby-input" type="text" class="txtCollectionName" label="Collection Name" value="${collName}" placeholder="${tagName}" />
                            <div class="fieldDescription">Leave empty to use Tag Name.</div>
                        </div>

                        <div class="checkboxContainer checkboxContainer-withDescription" style="margin-top: 15px;">
                            <label>
                                <input is="emby-checkbox" type="checkbox" class="chkOnlyCollection" ${onlyColl} />
                                <span>Only Collection (Disable Item Tagging)</span>
                            </label>
                            <div class="fieldDescription">If checked, items will be added to the collection but NOT tagged with "${tagName}".</div>
                        </div>
                    </div>
                </div>

                <div class="tab-content advanced-tab" style="display:none;">
                    <div class="inputContainer">
                        <p style="margin:0 0 5px 0; font-size:0.9em; font-weight:bold; opacity:0.7;">Blacklist / Ignore (IMDB IDs)</p>
                        <textarea is="emby-textarea" class="txtTagBlacklist" rows="2" placeholder="tt1234567, tt9876543">${blacklist}</textarea>
                        <div class="fieldDescription">Items with these IDs will never be tagged or added to collection.</div>
                    </div>
                </div>

                <div style="text-align:right; margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;"><button is="emby-button" type="button" class="raised btnRemoveGroup" style="background:#cc3333 !important; color:#fff;"><i class="md-icon" style="margin-right:5px;">delete</i>Remove Tag Group</button></div>
            </div>
        </div>`;

        if (prepend) container.insertAdjacentHTML('afterbegin', html);
        else container.insertAdjacentHTML('beforeend', html);

        var newRow = prepend ? container.firstElementChild : container.lastElementChild;
        setupRowEvents(newRow);

        if (isNew) {
            setTimeout(() => { newRow.classList.remove('just-added'); }, 2000);
        }
    }

    function setupRowEvents(row) {
        var markDirty = function () { row.dataset.dirty = 'true'; checkGlobalDirtyState(); };
        ['input', 'change', 'keyup', 'paste'].forEach(function (evt) {
            row.addEventListener(evt, function (e) {
                if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
                    setTimeout(markDirty, 10);
                }
            }, true);
        });

        function updateBadges(row) {
            var container = row.querySelector('.badge-container');
            if (!container) return;

            var hasSchedule = row.querySelectorAll('.date-row').length > 0;
            var hasCollection = row.querySelector('.chkEnableCollection').checked;

            var html = '';
            if (hasSchedule) {
                html += `<span class="tag-indicator schedule"><i class="md-icon" style="font-size:1.1em;">calendar_today</i> Schedule</span>`;
            }
            if (hasCollection) {
                html += `<span class="tag-indicator collection"><i class="md-icon" style="font-size:1.1em;">library_books</i> Collection</span>`;
            }
            container.innerHTML = html;
        }

        row.querySelectorAll('.tag-tab').forEach(tab => {
            tab.addEventListener('click', function () {
                row.querySelectorAll('.tag-tab').forEach(t => { t.style.opacity = "0.6"; t.style.borderBottomColor = "transparent"; });
                this.style.opacity = "1"; this.style.borderBottomColor = "#52B54B";
                var target = this.getAttribute('data-tab');
                row.querySelector('.general-tab').style.display = target === 'general' ? 'block' : 'none';
                row.querySelector('.schedule-tab').style.display = target === 'schedule' ? 'block' : 'none';
                row.querySelector('.collection-tab').style.display = target === 'collection' ? 'block' : 'none';
                row.querySelector('.advanced-tab').style.display = target === 'advanced' ? 'block' : 'none';
            });
        });

        row.addEventListener('change', e => {
            if (e.target.classList.contains('selSourceType')) {
                var type = e.target.value;
                row.querySelector('.source-external-container').style.display = type === 'External' ? 'block' : 'none';
                row.querySelector('.source-local-container').style.display = (type === 'LocalCollection' || type === 'LocalPlaylist') ? 'block' : 'none';
                row.querySelector('.source-mediainfo-container').style.display = type === 'MediaInfo' ? 'block' : 'none';

                if (type === 'LocalCollection' || type === 'LocalPlaylist') {
                    row.querySelector('.local-list-container').innerHTML = getLocalRowHtml(type, "", 0);
                    row.querySelector('.local-type-label').textContent = type === 'LocalPlaylist' ? "Select Playlists" : "Select Collections";
                }
                updateCount(row);
            }
            
            if (e.target.classList.contains('chkMediaInfo')) {
                updateCount(row);
            }
            
            if (e.target.classList.contains('selDateType')) {
                var dateRow = e.target.closest('.date-row');
                var type = e.target.value;
                dateRow.querySelector('.inputs-specific').style.display = type === 'SpecificDate' ? 'flex' : 'none';
                dateRow.querySelector('.inputs-annual').style.display = type === 'EveryYear' ? 'flex' : 'none';
                dateRow.querySelector('.inputs-weekly').style.display = type === 'Weekly' ? 'flex' : 'none';
            }
            if (e.target.classList.contains('chkEnableCollection')) {
                var settingsDiv = row.querySelector('.collection-settings');
                settingsDiv.style.display = e.target.checked ? 'block' : 'none';

                if (!e.target.checked) {
                    row.querySelector('.chkOnlyCollection').checked = false;
                }
                updateBadges(row);
            }
        });

        row.addEventListener('click', e => {
            if (e.target.classList.contains('day-toggle')) {
                e.target.classList.toggle('active');
                markDirty();
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

            if (this.checked) row.classList.remove('inactive');
            else row.classList.add('inactive');
        });

        row.querySelector('.btnAddUrl').addEventListener('click', () => {
            row.querySelector('.url-list-container').insertAdjacentHTML('beforeend', getUrlRowHtml('', 0));
            updateCount(row);
            markDirty();
        });

        row.querySelector('.btnAddLocal').addEventListener('click', () => {
            var st = row.querySelector('.selSourceType').value;
            row.querySelector('.local-list-container').insertAdjacentHTML('beforeend', getLocalRowHtml(st, "", 0));
            updateCount(row);
            markDirty();
        });

        row.querySelector('.btnAddDate').addEventListener('click', () => {
            row.querySelector('.date-list-container').insertAdjacentHTML('beforeend', getDateRowHtml({ Type: 'SpecificDate' }));
            updateBadges(row);
            markDirty();
        });

        row.addEventListener('click', e => {
            if (e.target.closest('.btnRemoveUrl')) {
                e.target.closest('.url-row').remove();
                updateCount(row);
                markDirty();
            }

            if (e.target.closest('.btnRemoveLocal')) {
                e.target.closest('.local-row').remove();
                updateCount(row);
                markDirty();
            }

            if (e.target.closest('.btnRemoveDate')) {
                e.target.closest('.date-row').remove();
                updateBadges(row);
                markDirty();
            }

            if (e.target.closest('.btnRemoveGroup')) {
                if (confirm("Delete this tag group?")) {
                    row.remove();
                    checkGlobalDirtyState();
                }
            }

            var btnTest = e.target.closest('.btnTestUrl');
            if (btnTest) {
                var uRow = btnTest.closest('.url-row');
                var url = uRow.querySelector('.txtTagUrl').value;
                if (!url) return;

                btnTest.disabled = true;
                window.ApiClient.getJSON(window.ApiClient.getUrl("AutoTag/TestUrl", { Url: url, Limit: 1000 })).then(result => {
                    window.Dashboard.alert(result.Message);
                }).finally(() => btnTest.disabled = false);
            }
        });

        function updateTagTitle() {
            var lbl = row.querySelector('.txtEntryLabel').value;
            var tag = row.querySelector('.txtTagName').value;
            row.querySelector('.tag-title').textContent = lbl || tag || 'New Tag';
        }
        row.querySelector('.txtEntryLabel').addEventListener('input', updateTagTitle);
        row.querySelector('.txtTagName').addEventListener('input', updateTagTitle);

        var handle = row.querySelector('.drag-handle');

        handle.addEventListener('mousedown', () => {
            if (localStorage.getItem('AutoTag_SortBy') === 'Manual') {
                row.setAttribute('draggable', 'true');
            }
        });

        handle.addEventListener('mouseup', () => {
            row.setAttribute('draggable', 'false');
        });

        row.addEventListener('dragstart', (e) => {
            if (localStorage.getItem('AutoTag_SortBy') !== 'Manual') { e.preventDefault(); return; }

            document.querySelectorAll('.tag-body').forEach(b => b.style.display = 'none');
            document.querySelectorAll('.expand-icon').forEach(i => i.innerText = 'expand_more');

            row.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');

            setTimeout(() => {
                row.style.display = 'none';
            }, 0);
        });

        row.addEventListener('dragend', () => {
            row.style.display = '';

            row.classList.remove('dragging');
            row.setAttribute('draggable', 'false');

            var existingPlaceholder = document.querySelector('.sort-placeholder');
            if (existingPlaceholder) existingPlaceholder.remove();

            row.classList.add('just-moved');
            setTimeout(() => { row.classList.remove('just-moved'); }, 2000);

            checkGlobalDirtyState();
        });
    }

    function updateCount(row) {
        var sourceType = row.querySelector('.selSourceType').value;
        var count = 0;
        var label = "SOURCE(S)";
        
        if (sourceType === 'External') {
            count = row.querySelectorAll('.url-row').length;
        } else if (sourceType === 'LocalCollection' || sourceType === 'LocalPlaylist') {
            count = row.querySelectorAll('.local-row').length;
        } else if (sourceType === 'MediaInfo') {
            count = row.querySelectorAll('.chkMediaInfo:checked').length;
            label = "FILTER(S)";
        }
        
        row.querySelector('.tag-status').textContent = count + " " + label;
    }

    function refreshStatus(view) {
        window.ApiClient.getJSON(window.ApiClient.getUrl("AutoTag/Status")).then(result => {
            var label = view.querySelector('#lastRunStatusLabel'), dot = view.querySelector('#dotStatus'), content = view.querySelector('#logContent');
            var btnSave = view.querySelector('.btn-save'), btnRun = view.querySelector('#btnRunSync');

            if (result.IsRunning) {
                if (btnSave) { btnSave.disabled = true; btnSave.style.opacity = "0.5"; btnSave.querySelector('span').textContent = "Sync in progress..."; }
                if (btnRun) btnRun.disabled = true;
            } else {
                if (btnRun) btnRun.disabled = false;
                if (btnSave) {
                    btnSave.querySelector('span').textContent = "Save Settings";
                    checkGlobalDirtyState();
                }
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

    function sortRows(container, criteria) {
        var rows = Array.from(container.querySelectorAll('.tag-row'));

        rows.sort((a, b) => {
            if (criteria === 'Name') {
                var na = (a.querySelector('.txtEntryLabel').value || a.querySelector('.txtTagName').value).toLowerCase();
                var nb = (b.querySelector('.txtEntryLabel').value || b.querySelector('.txtTagName').value).toLowerCase();
                return na.localeCompare(nb);
            }
            if (criteria === 'Active') {
                var aa = a.querySelector('.chkTagActive').checked ? 1 : 0;
                var bb = b.querySelector('.chkTagActive').checked ? 1 : 0;
                return bb - aa;
            }
            if (criteria === 'LatestEdited') {
                var da = new Date(a.dataset.lastModified || 0).getTime();
                var db = new Date(b.dataset.lastModified || 0).getTime();
                return db - da;
            }
            return parseInt(a.dataset.index) - parseInt(b.dataset.index);
        });

        rows.forEach(row => container.appendChild(row));

        if (criteria !== 'Manual') container.classList.add('sort-hidden');
        else container.classList.remove('sort-hidden');
    }

    function getUiConfig(view, forComparison) {
        var flatTags = [];
        view.querySelectorAll('.tag-row').forEach(row => {
            var name = row.querySelector('.txtTagName').value;
            var entryLabel = row.querySelector('.txtEntryLabel').value;
            var active = row.querySelector('.chkTagActive').checked;

            var blInput = row.querySelector('.txtTagBlacklist');
            var bl = blInput ? blInput.value.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];

            var enableColl = row.querySelector('.chkEnableCollection').checked;
            var onlyColl = row.querySelector('.chkOnlyCollection').checked;
            var collName = row.querySelector('.txtCollectionName').value;

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

            var currentLastMod = row.dataset.lastModified || new Date().toISOString();
            if (forComparison) {
                currentLastMod = "CONSTANT_FOR_COMPARISON";
            } else if (row.dataset.dirty === 'true') {
                currentLastMod = new Date().toISOString();
            }

            var st = row.querySelector('.selSourceType').value;
            var mi = [];
            row.querySelectorAll('.chkMediaInfo:checked').forEach(cb => mi.push(cb.value));

            if (st === 'External') {
                row.querySelectorAll('.url-row').forEach(uRow => {
                    var urlVal = uRow.querySelector('.txtTagUrl').value.trim();

                    var limitStr = uRow.querySelector('.txtUrlLimit').value;
                    var limitVal = limitStr ? parseInt(limitStr, 10) : 0;
                    if (isNaN(limitVal)) limitVal = 0;

                    if (urlVal) flatTags.push({
                        Name: entryLabel, Tag: name, Url: urlVal, Active: active, Limit: limitVal, Blacklist: bl, ActiveIntervals: intervals,
                        EnableCollection: enableColl, CollectionName: collName, OnlyCollection: onlyColl, LastModified: currentLastMod,
                        SourceType: st, LocalSourceId: "", MediaInfoConditions: mi
                    });
                });
            } else if (st === 'LocalCollection' || st === 'LocalPlaylist') {
                row.querySelectorAll('.local-row').forEach(lRow => {
                    var localVal = lRow.querySelector('.selLocalSource').value;
                    var limitStr = lRow.querySelector('.txtLocalLimit').value;
                    var limitVal = limitStr ? parseInt(limitStr, 10) : 0;
                    if (isNaN(limitVal)) limitVal = 0;

                    if (localVal) flatTags.push({
                        Name: entryLabel, Tag: name, Url: "", Active: active, Limit: limitVal, Blacklist: bl, ActiveIntervals: intervals,
                        EnableCollection: enableColl, CollectionName: collName, OnlyCollection: onlyColl, LastModified: currentLastMod,
                        SourceType: st, LocalSourceId: localVal, MediaInfoConditions: mi
                    });
                });
            } else {
                var miLimitStr = row.querySelector('.txtMediaInfoLimit') ? row.querySelector('.txtMediaInfoLimit').value : "0";
                var miLimitVal = parseInt(miLimitStr, 10);
                if (isNaN(miLimitVal)) miLimitVal = 0;

                flatTags.push({
                    Name: entryLabel, Tag: name, Url: "", Active: active, Limit: miLimitVal, Blacklist: bl, ActiveIntervals: intervals,
                    EnableCollection: enableColl, CollectionName: collName, OnlyCollection: onlyColl, LastModified: currentLastMod,
                    SourceType: st, LocalSourceId: "", MediaInfoConditions: mi
                });
            }
        });

        return {
            TraktClientId: view.querySelector('#txtTraktClientId').value,
            MdblistApiKey: view.querySelector('#txtMdblistApiKey').value,
            ExtendedConsoleOutput: view.querySelector('#chkExtendedConsoleOutput').checked,
            DryRunMode: view.querySelector('#chkDryRunMode').checked,
            Tags: flatTags
        };
    }

    function checkGlobalDirtyState() {
        var view = document.querySelector('#AutoTagConfigPage');
        if (!view || !originalConfigState) return;

        var current = JSON.stringify(getUiConfig(view, true));
        var btnSave = view.querySelector('.btn-save');

        if (btnSave) {
            if (current !== originalConfigState) {
                btnSave.disabled = false;
                btnSave.style.opacity = "1";
            } else {
                btnSave.disabled = true;
                btnSave.style.opacity = "0.5";
            }
        }
    }

    function updateDryRunWarning() {
        var view = document.querySelector('#AutoTagConfigPage');
        if (!view || !originalConfigState) return;
        var warn = view.querySelector('.dry-run-warning');
        if (warn) {
            try {
                var savedConfig = JSON.parse(originalConfigState);
                warn.style.display = savedConfig.DryRunMode ? 'flex' : 'none';
            } catch (e) {
                warn.style.display = 'none';
            }
        }
    }

    function applyFilters(view) {
        var container = view.querySelector('#tagListContainer');
        var rows = container.querySelectorAll('.tag-row');

        var showScheduleOnly = view.querySelector('#chkFilterSchedule').checked;
        var showCollectionOnly = view.querySelector('#chkFilterCollection').checked;
        var searchTerm = (view.querySelector('#txtSearchTags').value || "").toLowerCase();

        rows.forEach(row => {
            var tagName = (row.querySelector('.txtTagName').value || "").toLowerCase();
            var entryLbl = (row.querySelector('.txtEntryLabel').value || "").toLowerCase();
            var hasSchedule = row.querySelectorAll('.date-row').length > 0;
            var hasCollection = row.querySelector('.chkEnableCollection').checked;

            var matchesSearch = tagName.includes(searchTerm) || entryLbl.includes(searchTerm);
            var matchesFilter = true;
            if (showScheduleOnly && showCollectionOnly) {
                matchesFilter = (hasSchedule || hasCollection);
            } else if (showScheduleOnly) {
                matchesFilter = hasSchedule;
            } else if (showCollectionOnly) {
                matchesFilter = hasCollection;
            }

            row.style.display = (matchesSearch && matchesFilter) ? 'block' : 'none';
        });
    }

    return function (view) {
        view.addEventListener('viewshow', () => {
            if (!document.getElementById('autoTagCustomCss')) {
                document.body.insertAdjacentHTML('beforeend', customCss);
            }

            var container = view.querySelector('#tagListContainer');
            if (container) {
                let rafId = null;
                container.addEventListener('dragover', (e) => {
                    if (localStorage.getItem('AutoTag_SortBy') !== 'Manual') return;
                    e.preventDefault();
                    if (rafId) return;
                    rafId = requestAnimationFrame(() => {
                        const draggingRow = document.querySelector('.tag-row.dragging');
                        if (!draggingRow) { rafId = null; return; }
                        const afterElement = getDragAfterElement(container, e.clientY);
                        var placeholder = document.querySelector('.sort-placeholder');
                        if (!placeholder) {
                            placeholder = document.createElement('div');
                            placeholder.className = 'sort-placeholder';
                        }
                        if (afterElement == null) {
                            if (placeholder.nextElementSibling !== null) container.appendChild(placeholder);
                        } else {
                            if (placeholder.nextElementSibling !== afterElement) container.insertBefore(placeholder, afterElement);
                        }
                        rafId = null;
                    });
                });
                container.addEventListener('drop', (e) => {
                    if (localStorage.getItem('AutoTag_SortBy') !== 'Manual') return;
                    e.preventDefault();
                    const draggingRow = document.querySelector('.tag-row.dragging');
                    const placeholder = document.querySelector('.sort-placeholder');
                    if (draggingRow && placeholder) {
                        container.insertBefore(draggingRow, placeholder);
                        placeholder.remove();
                    }
                });
            }

            view.insertAdjacentHTML('afterbegin', '<div class="dry-run-warning"><i class="md-icon" style="font-size:1.4em;"></i>AUTOTAG<br>DRY RUN MODE IS ACTIVE - NO CHANGES WILL BE SAVED</div>');

            var btnSave = view.querySelector('.btn-save');
            if (btnSave) { btnSave.disabled = true; btnSave.style.opacity = "0.5"; }

            view.querySelector('#txtTraktClientId').addEventListener('input', checkGlobalDirtyState);
            view.querySelector('#txtMdblistApiKey').addEventListener('input', checkGlobalDirtyState);
            view.querySelector('#chkExtendedConsoleOutput').addEventListener('change', checkGlobalDirtyState);
            view.querySelector('#chkDryRunMode').addEventListener('change', checkGlobalDirtyState);

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

            var globalSettingsHeader = view.querySelector('#globalSettings .advanced-header');
            if (globalSettingsHeader) {
                globalSettingsHeader.addEventListener('click', function () {
                    var body = view.querySelector('#globalSettings .advanced-body');
                    var icon = view.querySelector('#globalSettings .expand-icon');
                    var isHidden = body.style.display === 'none';
                    body.style.display = isHidden ? 'block' : 'none';
                    icon.innerText = isHidden ? 'expand_less' : 'expand_more';
                });
            }

            var headerAction = view.querySelector('.sectionTitleContainer');
            if (headerAction && !view.querySelector('#cbSortTags')) {
                var savedSort = localStorage.getItem('AutoTag_SortBy') || 'Manual';
                headerAction.style.display = "flex";
                headerAction.style.alignItems = "center";
                headerAction.style.justifyContent = "space-between";
                headerAction.style.width = "100%";
                headerAction.style.marginBottom = "10px";

                var controlRowHtml = `
                <div class="control-row" style="flex-direction: row !important; align-items: center !important; flex-wrap: nowrap !important; justify-content: flex-start !important; padding: 10px 15px !important; gap: 0 !important;">
                    
                    <span class="control-label" style="opacity:0.7; margin-right: 10px; flex-shrink: 0;">Sort:</span>

                    <select is="emby-select" id="cbSortTags" style="color:inherit; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); padding:5px; border-radius:4px; font-size:0.9em; cursor:pointer; width: 80px; margin-right: 0px;">
                        <option value="Manual" ${savedSort === 'Manual' ? 'selected' : ''}>Manual</option>
                        <option value="Name" ${savedSort === 'Name' ? 'selected' : ''}>Name</option>
                        <option value="Active" ${savedSort === 'Active' ? 'selected' : ''}>Status</option>
                        <option value="LatestEdited" ${savedSort === 'LatestEdited' ? 'selected' : ''}>Latest</option>
                    </select>

                    <div style="width: 1px; height: 25px; background: rgba(255,255,255,0.1); margin-right: 10px;"></div>

                    <span class="control-label" style="opacity:0.7; margin-right: 20px; flex-shrink: 0;"> | Filters:</span>
                    
                    <div class="search-input-wrapper" style="width: 200px !important; margin-right: 10px; flex-shrink: 0;">
                        <i class="md-icon search-icon">search</i>
                        <input type="text" id="txtSearchTags" placeholder="Search..." autocomplete="off" style="padding-left: 28px !important; background: rgba(0,0,0,0.2) !important; border: 1px solid rgba(255,255,255,0.1) !important; width: 100% !important;" />
                        <i class="md-icon" id="btnClearSearch">close</i>
                    </div>

                    <label class="checkboxContainer" style="display: flex !important; align-items: center !important; margin: 0 10px 0 0 !important; cursor: pointer !important; width: auto !important;">
                        <input type="checkbox" id="chkFilterSchedule" is="emby-checkbox" />
                        <span style="font-size: 0.9em; margin-left: 5px; white-space: nowrap;">Schedule</span>
                    </label>

                    <label class="checkboxContainer" style="display: flex !important; align-items: center !important; margin: 0 !important; cursor: pointer !important; width: auto !important;">
                        <input type="checkbox" id="chkFilterCollection" is="emby-checkbox" />
                        <span style="font-size: 0.9em; margin-left: 5px; white-space: nowrap;">Collection</span>
                    </label>

                </div>`;

                headerAction.insertAdjacentHTML('afterend', controlRowHtml);

                const txtSearch = view.querySelector('#txtSearchTags');
                const btnClear = view.querySelector('#btnClearSearch');

                txtSearch.addEventListener('input', () => {
                    btnClear.style.display = txtSearch.value ? 'block' : 'none';
                    applyFilters(view);
                });

                btnClear.addEventListener('click', () => {
                    txtSearch.value = '';
                    btnClear.style.display = 'none';
                    txtSearch.focus();
                    applyFilters(view);
                });

                view.querySelector('#cbSortTags').addEventListener('change', function () {
                    localStorage.setItem('AutoTag_SortBy', this.value);
                    sortRows(view.querySelector('#tagListContainer'), this.value);
                });

                view.querySelector('#chkFilterSchedule').addEventListener('change', () => applyFilters(view));
                view.querySelector('#chkFilterCollection').addEventListener('change', () => applyFilters(view));
            }

            view.querySelector('#btnAddTag').addEventListener('click', () => {
                renderTagGroup({ Tag: '', Urls: [{ url: '', limit: 0 }], Active: true }, view.querySelector('#tagListContainer'), true, undefined, true);
                applyFilters(view);
                checkGlobalDirtyState();
            });

            Promise.all([
                window.ApiClient.getJSON(window.ApiClient.getUrl("Users/" + window.ApiClient.getCurrentUserId() + "/Items", { IncludeItemTypes: "BoxSet", Recursive: true })),
                window.ApiClient.getJSON(window.ApiClient.getUrl("Users/" + window.ApiClient.getCurrentUserId() + "/Items", { IncludeItemTypes: "Playlist", Recursive: true }))
            ]).then(responses => {
                cachedCollections = responses[0].Items || [];
                cachedPlaylists = responses[1].Items || [];

                window.ApiClient.getPluginConfiguration(pluginId).then(config => {
                    var container = view.querySelector('#tagListContainer'); container.innerHTML = '';
                    view.querySelector('#txtTraktClientId').value = config.TraktClientId || '';
                    view.querySelector('#txtMdblistApiKey').value = config.MdblistApiKey || '';
                    view.querySelector('#chkExtendedConsoleOutput').checked = config.ExtendedConsoleOutput || false;
                    view.querySelector('#chkDryRunMode').checked = config.DryRunMode || false;
                    if (view.querySelector('#txtSearchTags')) {
                        view.querySelector('#txtSearchTags').value = '';
                        view.querySelector('#btnClearSearch').style.display = 'none';
                    }
                    if (view.querySelector('#chkFilterSchedule')) view.querySelector('#chkFilterSchedule').checked = false;
                    if (view.querySelector('#chkFilterCollection')) view.querySelector('#chkFilterCollection').checked = false;

                    var grouped = {};
                    (config.Tags || []).forEach(t => {
                        if (!grouped[t.Tag]) grouped[t.Tag] = {
                            Tag: t.Tag, Urls: [], LocalSources: [], Active: t.Active, Blacklist: t.Blacklist, ActiveIntervals: t.ActiveIntervals,
                            EnableCollection: t.EnableCollection, CollectionName: t.CollectionName, OnlyCollection: t.OnlyCollection, LastModified: t.LastModified,
                            SourceType: t.SourceType || "External", MediaInfoConditions: t.MediaInfoConditions || [],
                            Limit: t.Limit || 0
                        };
                        if (t.SourceType === 'External' && t.Url) grouped[t.Tag].Urls.push({ url: t.Url, limit: t.Limit });
                        if ((t.SourceType === 'LocalCollection' || t.SourceType === 'LocalPlaylist') && t.LocalSourceId) grouped[t.Tag].LocalSources.push({ id: t.LocalSourceId, limit: t.Limit });
                        if (t.SourceType === 'MediaInfo') grouped[t.Tag].Limit = t.Limit;
                    });

                    var keys = Object.keys(grouped);
                    keys.forEach((k, i) => renderTagGroup(grouped[k], container, false, i));
                    if (keys.length === 0) renderTagGroup({ Tag: '', Urls: [{ url: '', limit: 0 }], Active: true }, container, false, 0);

                    var savedSort = localStorage.getItem('AutoTag_SortBy') || 'Manual';
                    sortRows(container, savedSort);
                    applyFilters(view);
                    originalConfigState = JSON.stringify(getUiConfig(view, true));
                    checkGlobalDirtyState();
                    updateDryRunWarning();
                });
            });

            view.querySelector('#btnBackupConfig').addEventListener('click', () => {
                window.ApiClient.getPluginConfiguration(pluginId).then(config => {
                    var json = JSON.stringify(config, null, 2);
                    var blob = new Blob([json], { type: "application/json" });
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url; a.download = `AutoTag_Backup_${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                });
            });

            var fileInput = view.querySelector('#fileRestoreConfig');
            view.querySelector('#btnRestoreConfigTrigger').addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', function (e) {
                var file = e.target.files[0]; if (!file) return;
                var reader = new FileReader();
                reader.onload = function (e) {
                    try {
                        var config = JSON.parse(e.target.result);
                        view.querySelector('#txtTraktClientId').value = config.TraktClientId || '';
                        view.querySelector('#txtMdblistApiKey').value = config.MdblistApiKey || '';
                        view.querySelector('#chkExtendedConsoleOutput').checked = config.ExtendedConsoleOutput || false;
                        view.querySelector('#chkDryRunMode').checked = config.DryRunMode || false;

                        var container = view.querySelector('#tagListContainer'); container.innerHTML = '';
                        var grouped = {};
                        (config.Tags || []).forEach(t => {
                            if (!grouped[t.Tag]) grouped[t.Tag] = {
                                Tag: t.Tag, Urls: [], LocalSources: [], Active: t.Active, Blacklist: t.Blacklist, ActiveIntervals: t.ActiveIntervals,
                                EnableCollection: t.EnableCollection, CollectionName: t.CollectionName, OnlyCollection: t.OnlyCollection, LastModified: t.LastModified,
                                SourceType: t.SourceType || "External", MediaInfoConditions: t.MediaInfoConditions || [],
                                Limit: t.Limit || 0
                            };
                            if (t.SourceType === 'External' && t.Url) grouped[t.Tag].Urls.push({ url: t.Url, limit: t.Limit });
                            if ((t.SourceType === 'LocalCollection' || t.SourceType === 'LocalPlaylist') && t.LocalSourceId) grouped[t.Tag].LocalSources.push({ id: t.LocalSourceId, limit: t.Limit });
                            if (t.SourceType === 'MediaInfo') grouped[t.Tag].Limit = t.Limit;
                        });

                        var keys = Object.keys(grouped);
                        keys.forEach((k, i) => renderTagGroup(grouped[k], container, false, i));
                        if (keys.length === 0) renderTagGroup({ Tag: '', Urls: [{ url: '', limit: 50 }], Active: true }, container, false, 0);

                        applyFilters(view);

                        originalConfigState = JSON.stringify(getUiConfig(view, true));
                        window.Dashboard.alert("Configuration loaded!");
                        checkGlobalDirtyState();
                    } catch (err) { window.Dashboard.alert("Failed to parse configuration file."); }
                    fileInput.value = '';
                };
                reader.readAsText(file);
            });
        });

        view.addEventListener('viewhide', () => { if (statusInterval) clearInterval(statusInterval); });

        view.querySelector('.AutoTagForm').addEventListener('submit', e => {
            e.preventDefault();
            var configObj = getUiConfig(view, false);

            window.ApiClient.getPluginConfiguration(pluginId).then(config => {
                config.TraktClientId = configObj.TraktClientId;
                config.MdblistApiKey = configObj.MdblistApiKey;
                config.ExtendedConsoleOutput = configObj.ExtendedConsoleOutput;
                config.DryRunMode = configObj.DryRunMode;
                config.Tags = configObj.Tags;

                window.ApiClient.updatePluginConfiguration(pluginId, config).then(r => {
                    window.Dashboard.processPluginConfigurationUpdateResult(r);

                    view.querySelectorAll('.tag-row').forEach(row => { row.dataset.dirty = 'false'; });

                    originalConfigState = JSON.stringify(getUiConfig(view, true));
                    var btnSave = view.querySelector('.btn-save');
                    if (btnSave) { btnSave.disabled = true; btnSave.style.opacity = "0.5"; }
                    updateDryRunWarning();
                });
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
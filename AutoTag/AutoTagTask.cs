using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Collections;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Logging;
using MediaBrowser.Model.Querying;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Tasks;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace AutoTag
{
    public class AutoTagTask : IScheduledTask
    {
        private readonly ILibraryManager _libraryManager;
        private readonly ICollectionManager _collectionManager;
        private readonly IHttpClient _httpClient;
        private readonly IJsonSerializer _jsonSerializer;
        private readonly ILogger _logger;

        public static string LastRunStatus { get; private set; } = "Unknown (resets at server restart)";
        public static List<string> ExecutionLog { get; } = new List<string>();
        public static bool IsRunning { get; private set; } = false;

        public AutoTagTask(ILibraryManager libraryManager, ICollectionManager collectionManager, IHttpClient httpClient, IJsonSerializer jsonSerializer, ILogManager logManager)
        {
            _libraryManager = libraryManager;
            _collectionManager = collectionManager;
            _httpClient = httpClient;
            _jsonSerializer = jsonSerializer;
            _logger = logManager.GetLogger("AutoTag");
        }

        public string Key => "AutoTagSyncTask";
        public string Name => "AutoTag: Start Sync";
        public string Description => "Syncs tags and collections from MDBList, Trakt, Playlists and Local Media.";
        public string Category => "Library";

        public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
        {
            return new[] { new TaskTriggerInfo { Type = TaskTriggerInfo.TriggerDaily, TimeOfDayTicks = TimeSpan.FromHours(4).Ticks } };
        }

        public async Task Execute(CancellationToken cancellationToken, IProgress<double> progress)
        {
            IsRunning = true;
            try
            {
                lock (ExecutionLog) ExecutionLog.Clear();
                LastRunStatus = "Running...";

                var config = Plugin.Instance?.Configuration;
                if (config == null) return;

                bool debug = config.ExtendedConsoleOutput;
                bool dryRun = config.DryRunMode;

                var startTime = DateTime.Now;
                LogSummary($"AutoTag v{Plugin.Instance.Version}  ·  {startTime:yyyy-MM-dd HH:mm}");
                if (dryRun) LogSummary("! DRY RUN MODE — no changes will be saved");

                var allItems = _libraryManager.GetItemList(new InternalItemsQuery
                {
                    IncludeItemTypes = new[] { "Movie", "Series" },
                    Recursive = true,
                    IsVirtualItem = false
                }).ToList();

                var imdbLookup = new Dictionary<string, List<BaseItem>>(StringComparer.OrdinalIgnoreCase);
                foreach (var item in allItems)
                {
                    if (item.LocationType != LocationType.FileSystem) continue;
                    var imdb = item.GetProviderId("Imdb");
                    if (!string.IsNullOrEmpty(imdb))
                    {
                        if (!imdbLookup.ContainsKey(imdb)) imdbLookup[imdb] = new List<BaseItem>();
                        imdbLookup[imdb].Add(item);
                    }
                }

                int movieCount = allItems.Count(i => i.GetType().Name.Contains("Movie"));
                int seriesCount = allItems.Count(i => i.GetType().Name.Contains("Series"));
                LogSummary($"Library: {movieCount} movies, {seriesCount} series");

                int activeRuleCount = config.Tags.Count(t => t.Active && !string.IsNullOrWhiteSpace(t.Tag));
                LogSummary($"Processing {activeRuleCount} active rule(s)...");

                var fetcher = new ListFetcher(_httpClient, _jsonSerializer);
                var desiredTagsMap = new Dictionary<Guid, HashSet<string>>();
                var desiredCollectionsMap = new Dictionary<string, HashSet<long>>(StringComparer.OrdinalIgnoreCase);
                var collectionDescriptions = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var collectionPosters = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var managedTags = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var activeCollections = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var failedFetches = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                var previouslyManagedTags = LoadFileHistory("autotag_history.txt");
                foreach (var t in previouslyManagedTags) managedTags.Add(t);

                var previouslyManagedCollections = LoadFileHistory("autotag_collections.txt");

                TagCacheManager.Instance.Initialize(Plugin.Instance.DataFolderPath, _jsonSerializer);
                TagCacheManager.Instance.ClearCache();

                double step = 30.0 / (config.Tags.Count > 0 ? config.Tags.Count : 1);
                double currentProgress = 0;

                // Cache: seriesInternalId → ett representativt avsnitt.
                // Byggs lazily vid första träff; delas av alla MediaInfo-regler.
                var seriesEpisodeCache = new Dictionary<long, BaseItem>();

                foreach (var tagConfig in config.Tags)
                {
                    if (string.IsNullOrWhiteSpace(tagConfig.Tag) || !tagConfig.Active) continue;

                    string tagName = tagConfig.Tag.Trim();
                    string displayName = !string.IsNullOrWhiteSpace(tagConfig.Name) ? $"{tagConfig.Name} [{tagName}]" : tagName;
                    string srcLabel = string.IsNullOrEmpty(tagConfig.SourceType) ? "External" : tagConfig.SourceType;
                    managedTags.Add(tagName);

                    if (!IsScheduleActive(tagConfig.ActiveIntervals))
                    {
                        LogSummary($"  ~ {displayName}  ·  skipped (out of schedule)");
                        continue;
                    }

                    string cName = string.IsNullOrWhiteSpace(tagConfig.CollectionName) ? tagName : tagConfig.CollectionName.Trim();
                    if (tagConfig.EnableCollection)
                    {
                        activeCollections.Add(cName);
                        if (!string.IsNullOrWhiteSpace(tagConfig.CollectionDescription))
                            collectionDescriptions[cName] = tagConfig.CollectionDescription;
                        if (!string.IsNullOrWhiteSpace(tagConfig.CollectionPosterPath) && File.Exists(tagConfig.CollectionPosterPath))
                            collectionPosters[cName] = tagConfig.CollectionPosterPath;
                    }

                    try
                    {
                        int effectiveLimit = tagConfig.Limit <= 0 ? 10000 : tagConfig.Limit;
                        var blacklist = new HashSet<string>(tagConfig.Blacklist ?? new List<string>(), StringComparer.OrdinalIgnoreCase);
                        var matchedLocalItems = new List<BaseItem>();
                        int matchCount = 0;

                        if (string.IsNullOrEmpty(tagConfig.SourceType) || tagConfig.SourceType == "External")
                        {
                            var items = await fetcher.FetchItems(tagConfig.Url, effectiveLimit, config.TraktClientId, config.MdblistApiKey, cancellationToken);

                            if (items.Count > 0)
                            {
                                if (items.Count > effectiveLimit) items = items.Take(effectiveLimit).ToList();

                                foreach (var extItem in items)
                                {
                                    if (string.IsNullOrEmpty(extItem.Imdb)) continue;

                                    if (blacklist.Contains(extItem.Imdb))
                                    {
                                        if (debug) LogDebug($"[BL] {extItem.Name} ({extItem.Imdb}) — blacklisted, skipping");
                                        continue;
                                    }

                                    if (tagConfig.EnableTag && !tagConfig.OnlyCollection)
                                        TagCacheManager.Instance.AddToCache($"imdb_{extItem.Imdb}", tagName);

                                    if (imdbLookup.TryGetValue(extItem.Imdb, out var localItems))
                                    {
                                        foreach (var localItem in localItems)
                                        {
                                            if (!matchedLocalItems.Contains(localItem)) matchedLocalItems.Add(localItem);
                                        }
                                    }
                                }
                            }
                            if (debug) LogDebug($"{displayName}: {items.Count} fetched from API, {matchedLocalItems.Count} in library");
                        }
                        else if (tagConfig.SourceType == "LocalCollection" || tagConfig.SourceType == "LocalPlaylist")
                        {
                            if (!string.IsNullOrEmpty(tagConfig.LocalSourceId))
                            {
                                string[] folderTypes = tagConfig.SourceType == "LocalPlaylist"
                                    ? new[] { "Playlist" }
                                    : new[] { "BoxSet" };
                                var allFolders = _libraryManager.GetItemList(new InternalItemsQuery
                                {
                                    IncludeItemTypes = folderTypes,
                                    Recursive = true
                                });
                                var localSourceFolder = allFolders.FirstOrDefault(i =>
                                    string.Equals(i.Name, tagConfig.LocalSourceId, StringComparison.OrdinalIgnoreCase)
                                );

                                if (localSourceFolder != null)
                                {
                                    var children = new List<BaseItem>();
                                    if (debug) LogDebug($"{displayName}: found '{localSourceFolder.Name}' ({localSourceFolder.GetType().Name})");

                                    if (tagConfig.SourceType == "LocalCollection")
                                    {
                                        children = _libraryManager.GetItemList(new InternalItemsQuery
                                        {
                                            CollectionIds = new[] { localSourceFolder.InternalId },
                                            IsVirtualItem = false
                                        }).ToList();
                                    }
                                    else
                                    {
                                        // Använd ListIds — Embys korrekta API för att hämta playlist-innehåll
                                        children = _libraryManager.GetItemList(new InternalItemsQuery
                                        {
                                            ListIds = new[] { localSourceFolder.InternalId }
                                        }).ToList();
                                    }

                                    if (children.Count == 0)
                                    {
                                        LogSummary($"  ! {displayName}  ·  '{tagConfig.LocalSourceId}' is empty or virtual", "Warn");
                                    }
                                    else if (debug)
                                    {
                                        LogDebug($"{displayName}: {children.Count} items in '{tagConfig.LocalSourceId}'");
                                    }

                                    foreach (var child in children)
                                    {
                                        if (child == null) continue;

                                        BaseItem itemToTag = child;

                                        // Packa upp om det är ett PlaylistItem-objekt
                                        if (child.GetType().Name.Contains("PlaylistItem"))
                                        {
                                            try { 
                                                var inner = ((dynamic)child).Item; 
                                                if (inner != null) itemToTag = inner;
                                            } catch { }
                                        }

                                        // Om det är ett avsnitt, applicera taggen på Serien istället
                                        if (itemToTag.GetType().Name.Contains("Episode"))
                                        {
                                            try { 
                                                var series = ((dynamic)itemToTag).Series; 
                                                if (series != null) itemToTag = series;
                                            } catch { }
                                        }

                                        // Släpp bara igenom Filmer och Serier
                                        if (!itemToTag.GetType().Name.Contains("Movie") && !itemToTag.GetType().Name.Contains("Series"))
                                            continue;

                                        var imdb = itemToTag.GetProviderId("Imdb");
                                        if (!string.IsNullOrEmpty(imdb) && blacklist.Contains(imdb)) continue;

                                        if (!matchedLocalItems.Contains(itemToTag))
                                        {
                                            matchedLocalItems.Add(itemToTag);
                                        }
                                    }
                                }
                                else
                                {
                                    LogSummary($"  ! {displayName}  ·  {tagConfig.SourceType} '{tagConfig.LocalSourceId}' not found", "Warn");
                                }

                                if (effectiveLimit < 10000 && matchedLocalItems.Count > effectiveLimit)
                                    matchedLocalItems = matchedLocalItems.Take(effectiveLimit).ToList();
                            }
                        }
                        else if (tagConfig.SourceType == "MediaInfo")
                        {
                            foreach (var item in allItems)
                            {
                                if (item.LocationType != LocationType.FileSystem) continue;

                                var imdb = item.GetProviderId("Imdb");
                                if (!string.IsNullOrEmpty(imdb) && blacklist.Contains(imdb)) continue;

                                if (ItemMatchesMediaInfo(item, tagConfig, debug, seriesEpisodeCache))
                                {
                                    matchedLocalItems.Add(item);
                                }
                            }

                            if (effectiveLimit < 10000 && matchedLocalItems.Count > effectiveLimit)
                                matchedLocalItems = matchedLocalItems.Take(effectiveLimit).ToList();
                        }

                        if (matchedLocalItems.Count > 0)
                        {
                            foreach (var localItem in matchedLocalItems)
                            {
                                matchCount++;
                                if (tagConfig.EnableTag && !tagConfig.OnlyCollection)
                                {
                                    if (!desiredTagsMap.ContainsKey(localItem.Id))
                                        desiredTagsMap[localItem.Id] = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                                    desiredTagsMap[localItem.Id].Add(tagName);

                                    var imdb = localItem.GetProviderId("Imdb");
                                    if (!string.IsNullOrEmpty(imdb) && tagConfig.SourceType != "External")
                                    {
                                        TagCacheManager.Instance.AddToCache($"imdb_{imdb}", tagName);
                                    }
                                }

                                if (tagConfig.EnableCollection)
                                {
                                    if (!desiredCollectionsMap.ContainsKey(cName))
                                        desiredCollectionsMap[cName] = new HashSet<long>();
                                    desiredCollectionsMap[cName].Add(localItem.InternalId);
                                }
                            }
                            LogSummary($"  + {displayName}  ·  {matchCount} matched  [{srcLabel}]");
                        }
                        else
                        {
                            LogSummary($"  - {displayName}  ·  0 matched  [{srcLabel}]");
                        }
                    }
                    catch (Exception ex)
                    {
                        LogSummary($"  ! {displayName}  ·  Error: {ex.Message}", "Error");
                        failedFetches.Add(tagName);
                        if (tagConfig.EnableCollection) failedFetches.Add(cName);
                    }

                    currentProgress += step;
                    progress.Report(currentProgress);
                }

                if (!dryRun)
                {
                    TagCacheManager.Instance.Save();
                    SaveFileHistory("autotag_history.txt", managedTags.ToList());
                }

                int tagsAdded = 0, tagsRemoved = 0, itemsChanged = 0;
                foreach (var item in allItems)
                {
                    var existingTags = new HashSet<string>(item.Tags, StringComparer.OrdinalIgnoreCase);
                    var targetTags = desiredTagsMap.ContainsKey(item.Id) ? desiredTagsMap[item.Id] : new HashSet<string>();

                    var toRemove = existingTags.Where(t => managedTags.Contains(t) && !targetTags.Contains(t) && !failedFetches.Contains(t)).ToList();
                    var toAdd = targetTags.Where(t => !existingTags.Contains(t)).ToList();

                    if (toRemove.Count == 0 && toAdd.Count == 0) continue;

                    itemsChanged++;
                    if (!dryRun)
                    {
                        foreach (var t in toRemove) { item.RemoveTag(t); tagsRemoved++; }
                        foreach (var t in toAdd) { item.AddTag(t); tagsAdded++; }
                        _libraryManager.UpdateItem(item, item.Parent, ItemUpdateType.MetadataEdit, null);
                    }
                    else
                    {
                        tagsAdded += toAdd.Count; tagsRemoved += toRemove.Count;
                    }
                }
                if (tagsAdded > 0 || tagsRemoved > 0)
                    LogSummary($"Tags: +{tagsAdded} added, -{tagsRemoved} removed  ({itemsChanged} items)");
                else
                    LogSummary("Tags: no changes");

                int collCreated = 0, collUpdated = 0;
                foreach (var kvp in desiredCollectionsMap)
                {
                    string cName = kvp.Key;
                    var desiredIds = kvp.Value;
                    if (desiredIds.Count == 0) continue;

                    var existingColl = _libraryManager.GetItemList(new InternalItemsQuery { IncludeItemTypes = new[] { "BoxSet" }, Name = cName, Recursive = true }).FirstOrDefault();

                    if (existingColl == null)
                    {
                        if (dryRun) continue;
                        var createdRef = await _collectionManager.CreateCollection(new CollectionCreationOptions { Name = cName, IsLocked = false, ItemIdList = desiredIds.ToArray() });
                        if (createdRef != null)
                        {
                            collCreated++;
                            if (debug) LogDebug($"Created collection '{cName}'  ({desiredIds.Count} items)");
                            if (collectionDescriptions.ContainsKey(cName) || collectionPosters.ContainsKey(cName))
                            {
                                var newColl = _libraryManager.GetItemList(new InternalItemsQuery
                                    { IncludeItemTypes = new[] { "BoxSet" }, Name = cName, Recursive = true }).FirstOrDefault();
                                if (newColl != null)
                                    ApplyCollectionMeta(newColl, cName, collectionDescriptions, collectionPosters, debug);
                            }
                        }
                    }
                    else
                    {
                        var currentMembers = _libraryManager.GetItemList(new InternalItemsQuery { CollectionIds = new[] { existingColl.InternalId }, Recursive = true, IsVirtualItem = false }).Select(i => i.InternalId).ToHashSet();
                        var toAdd = desiredIds.Where(id => !currentMembers.Contains(id)).ToList();
                        var toRemove = currentMembers.Where(id => !desiredIds.Contains(id)).ToList();
                        if (toAdd.Count > 0 && !dryRun)
                            await _collectionManager.AddToCollection(existingColl.InternalId, toAdd.ToArray());
                        if (toRemove.Count > 0 && !dryRun)
                            _collectionManager.RemoveFromCollection((BoxSet)existingColl, toRemove.ToArray());
                        if ((toAdd.Count > 0 || toRemove.Count > 0) && !dryRun)
                        {
                            collUpdated++;
                            if (debug) LogDebug($"Collection '{cName}': +{toAdd.Count} added, -{toRemove.Count} removed");
                        }
                        if (!dryRun && (collectionDescriptions.ContainsKey(cName) || collectionPosters.ContainsKey(cName)))
                            ApplyCollectionMeta(existingColl, cName, collectionDescriptions, collectionPosters, debug);
                    }
                }
                if (collCreated > 0 || collUpdated > 0)
                    LogSummary($"Collections: {collCreated} created, {collUpdated} updated");

                int collDeleted = 0;
                var toDelete = previouslyManagedCollections.Where(h => !activeCollections.Contains(h)).ToList();
                foreach (var oldName in toDelete)
                {
                    if (failedFetches.Contains(oldName))
                    {
                        LogSummary($"  ! Skipping cleanup of '{oldName}' — fetch failed (safety check)", "Warn");
                        activeCollections.Add(oldName);
                        continue;
                    }

                    var coll = _libraryManager.GetItemList(new InternalItemsQuery { IncludeItemTypes = new[] { "BoxSet" }, Name = oldName, Recursive = true }).FirstOrDefault();
                    if (coll != null && !dryRun)
                    {
                        _libraryManager.DeleteItem(coll, new DeleteOptions { DeleteFileLocation = false });
                        collDeleted++;
                        if (debug) LogDebug($"Deleted collection '{oldName}'  (not active/scheduled)");
                    }
                }
                if (collDeleted > 0)
                    LogSummary($"Cleanup: {collDeleted} collection(s) removed");

                if (!dryRun) SaveFileHistory("autotag_collections.txt", activeCollections.ToList());

                progress.Report(100);
                var elapsed = DateTime.Now - startTime;
                string elapsedStr = elapsed.TotalMinutes >= 1
                    ? $"{(int)elapsed.TotalMinutes}m {elapsed.Seconds}s"
                    : $"{(int)elapsed.TotalSeconds}s";
                string finalStatus = dryRun ? "Dry Run" : "Success";
                LastRunStatus = $"{finalStatus} ({DateTime.Now:HH:mm})";
                LogSummary($"Done in {elapsedStr}  ·  {finalStatus}");
            }
            catch (Exception ex)
            {
                LastRunStatus = $"Failed: {ex.Message}";
                LogSummary($"CRITICAL ERROR: {ex.Message}", "Error");
            }
            finally { IsRunning = false; }
        }

        private bool IsScheduleActive(List<DateInterval> intervals)
        {
            if (intervals == null || intervals.Count == 0) return true;
            var now = DateTime.Now;
            foreach (var interval in intervals)
            {
                bool match = false;
                if (interval.Type == "Weekly") { if (!string.IsNullOrEmpty(interval.DayOfWeek) && interval.DayOfWeek.IndexOf(now.DayOfWeek.ToString(), StringComparison.OrdinalIgnoreCase) >= 0) match = true; }
                else if (interval.Type == "EveryYear") { if (interval.Start.HasValue && interval.End.HasValue) { var s = new DateTime(now.Year, interval.Start.Value.Month, interval.Start.Value.Day); var e = new DateTime(now.Year, interval.End.Value.Month, interval.End.Value.Day); if (e < s) e = e.AddYears(1); if (now.Date >= s.Date && now.Date <= e.Date) match = true; } }
                else { if ((!interval.Start.HasValue || now.Date >= interval.Start.Value.Date) && (!interval.End.HasValue || now.Date <= interval.End.Value.Date)) match = true; }
                if (match) return true;
            }
            return false;
        }

        private bool ItemMatchesMediaInfo(BaseItem item, TagConfig tagConfig, bool debug, Dictionary<long, BaseItem>? seriesEpisodeCache = null)
        {
            var filters = tagConfig.MediaInfoFilters;
            var legacy = tagConfig.MediaInfoConditions;
            bool hasFilters = filters != null && filters.Count > 0;
            bool hasLegacy = legacy != null && legacy.Count > 0;
            if (!hasFilters && !hasLegacy) return true;

            BaseItem itemToCheck = item;
            if (item.GetType().Name.Contains("Series"))
            {
                if (seriesEpisodeCache != null)
                {
                    if (!seriesEpisodeCache.TryGetValue(item.InternalId, out var cached))
                    {
                        cached = _libraryManager.GetItemList(new InternalItemsQuery
                        {
                            IncludeItemTypes = new[] { "Episode" },
                            Parent = item,
                            Recursive = true,
                            Limit = 1
                        }).FirstOrDefault() ?? item;
                        seriesEpisodeCache[item.InternalId] = cached;
                    }
                    itemToCheck = cached;
                }
                else
                {
                    itemToCheck = _libraryManager.GetItemList(new InternalItemsQuery
                    {
                        IncludeItemTypes = new[] { "Episode" },
                        Parent = item,
                        Recursive = true,
                        Limit = 1
                    }).FirstOrDefault() ?? item;
                }
            }

            bool is4k = false, is1080 = false, is720 = false, isHevc = false, isAv1 = false;
            bool isHdr = false, isDv = false, isAtmos = false, isTrueHd = false, isDts = false;
            bool is51 = false, is71 = false;

            try
            {
                dynamic dynItem = itemToCheck;
                try {
                    int defaultWidth = (int)dynItem.Width;
                    if (defaultWidth >= 3800) is4k = true;
                    else if (defaultWidth >= 1900) is1080 = true;
                    else if (defaultWidth >= 1200) is720 = true;
                } catch { }

                System.Collections.IEnumerable streams = null;
                try { streams = dynItem.GetMediaStreams(); } catch { }
                if (streams == null) {
                    try {
                        var sources = dynItem.GetMediaSources(false);
                        if (sources != null) { foreach (var src in sources) { if (src.MediaStreams != null) { streams = src.MediaStreams; break; } } }
                    } catch { }
                }
                if (streams == null) { try { streams = dynItem.MediaStreams; } catch { } }

                if (streams != null)
                {
                    foreach (dynamic stream in streams)
                    {
                        try
                        {
                            string type = stream.Type?.ToString() ?? "";
                            string codec = stream.Codec?.ToString() ?? "";
                            string profile = stream.Profile?.ToString() ?? "";
                            string videoRange = "";
                            try { videoRange = stream.VideoRange?.ToString() ?? ""; } catch { }

                            if (type.Equals("Video", StringComparison.OrdinalIgnoreCase))
                            {
                                try { int w = (int)stream.Width; if (w >= 3800) is4k = true; else if (w >= 1900) is1080 = true; else if (w >= 1200) is720 = true; } catch { }
                                if (codec.IndexOf("hevc", StringComparison.OrdinalIgnoreCase) >= 0 || codec.IndexOf("h265", StringComparison.OrdinalIgnoreCase) >= 0) isHevc = true;
                                if (codec.IndexOf("av1", StringComparison.OrdinalIgnoreCase) >= 0) isAv1 = true;
                                if (profile.IndexOf("dv", StringComparison.OrdinalIgnoreCase) >= 0 || profile.IndexOf("dolby vision", StringComparison.OrdinalIgnoreCase) >= 0) isDv = true;
                                if (videoRange.IndexOf("hdr", StringComparison.OrdinalIgnoreCase) >= 0) isHdr = true;
                                if (profile.IndexOf("hdr", StringComparison.OrdinalIgnoreCase) >= 0) isHdr = true;
                            }
                            else if (type.Equals("Audio", StringComparison.OrdinalIgnoreCase))
                            {
                                if (profile.IndexOf("atmos", StringComparison.OrdinalIgnoreCase) >= 0) isAtmos = true;
                                if (codec.IndexOf("truehd", StringComparison.OrdinalIgnoreCase) >= 0) isTrueHd = true;
                                if (codec.IndexOf("dts", StringComparison.OrdinalIgnoreCase) >= 0) isDts = true;
                                try { int ch = (int)stream.Channels; if (ch == 6) is51 = true; if (ch >= 8) is71 = true; } catch { }
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }

            if (hasFilters)
            {
                // All filter groups must pass (AND between groups)
                foreach (var filter in filters!)
                {
                    if (filter.Criteria == null || filter.Criteria.Count == 0) continue;
                    bool isOr = string.Equals(filter.Operator, "OR", StringComparison.OrdinalIgnoreCase);
                    bool groupPass = isOr
                        ? filter.Criteria.Any(c => EvaluateCriterion(c, is4k, is1080, is720, isHevc, isAv1, isHdr, isDv, isAtmos, isTrueHd, isDts, is51, is71))
                        : filter.Criteria.All(c => EvaluateCriterion(c, is4k, is1080, is720, isHevc, isAv1, isHdr, isDv, isAtmos, isTrueHd, isDts, is51, is71));
                    if (!groupPass) return false;
                }
                return true;
            }

            // Legacy: all conditions must match (AND)
            foreach (var cond in legacy!)
            {
                if (!EvaluateCriterion(cond, is4k, is1080, is720, isHevc, isAv1, isHdr, isDv, isAtmos, isTrueHd, isDts, is51, is71))
                    return false;
            }
            return true;
        }

        private static bool EvaluateCriterion(string cond, bool is4k, bool is1080, bool is720, bool isHevc, bool isAv1, bool isHdr, bool isDv, bool isAtmos, bool isTrueHd, bool isDts, bool is51, bool is71)
        {
            return cond switch
            {
                "4K" => is4k,
                "1080p" => is1080,
                "720p" => is720,
                "HEVC" => isHevc,
                "AV1" => isAv1,
                "HDR" => isHdr || isDv,
                "DolbyVision" => isDv,
                "Atmos" => isAtmos,
                "TrueHD" => isTrueHd,
                "DTS" => isDts,
                "5.1" => is51,
                "7.1" => is71,
                _ => false
            };
        }

        private void LogSummary(string message, string level = "Info")
        {
            var msg = $"[{DateTime.Now:HH:mm:ss}] {message}";
            lock (ExecutionLog) { ExecutionLog.Add(msg); if (ExecutionLog.Count > 200) ExecutionLog.RemoveAt(0); }
            if (level == "Error") _logger.Error(message); else if (level == "Warn") _logger.Warn(message); else _logger.Info(message);
        }

        private void LogDebug(string message)
        {
            var msg = $"[{DateTime.Now:HH:mm:ss}] [DEBUG] {message}";
            lock (ExecutionLog) { ExecutionLog.Add(msg); if (ExecutionLog.Count > 200) ExecutionLog.RemoveAt(0); }
        }

        private List<string> LoadFileHistory(string filename)
        {
            try { var path = Path.Combine(Plugin.Instance.DataFolderPath, filename); if (File.Exists(path)) return File.ReadAllLines(path).Select(l => l.Trim()).Where(l => !string.IsNullOrEmpty(l)).ToList(); } catch { }
            return new List<string>();
        }

        private void SaveFileHistory(string filename, List<string> data)
        {
            try { var path = Path.Combine(Plugin.Instance.DataFolderPath, filename); Directory.CreateDirectory(Path.GetDirectoryName(path)); File.WriteAllLines(path, data); } catch { }
        }

        private void ApplyCollectionMeta(BaseItem item, string cName,
            Dictionary<string, string> descriptions, Dictionary<string, string> posters, bool debug)
        {
            bool metaChanged = false;

            if (descriptions.TryGetValue(cName, out var desc) && !string.IsNullOrWhiteSpace(desc))
            {
                item.Overview = desc;
                metaChanged = true;
            }

            if (posters.TryGetValue(cName, out var posterPath) && File.Exists(posterPath))
            {
                var imageInfo = new ItemImageInfo
                {
                    Path = posterPath,
                    Type = ImageType.Primary,
                    DateModified = File.GetLastWriteTimeUtc(posterPath)
                };
                var otherImages = (item.ImageInfos ?? Array.Empty<ItemImageInfo>())
                    .Where(i => i.Type != ImageType.Primary).ToList();
                otherImages.Add(imageInfo);
                item.ImageInfos = otherImages.ToArray();
                _libraryManager.UpdateItem(item, item.Parent, ItemUpdateType.ImageUpdate, null);
                if (debug) LogDebug($"Applied poster to '{cName}'");
            }

            if (metaChanged)
                _libraryManager.UpdateItem(item, item.Parent, ItemUpdateType.MetadataEdit, null);
        }
    }
}
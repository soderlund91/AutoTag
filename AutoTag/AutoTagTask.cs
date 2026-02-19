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
        public string Description => "Syncs tags and collections from MDBList and Trakt based on configuration.";
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

                LogSummary($"--- STARTING AUTOTAG (v{Plugin.Instance.Version}) ---");
                if (dryRun) LogSummary("!!! DRY RUN MODE - NO CHANGES WILL BE SAVED !!!");

                LogSummary("Phase 1: Indexing local library...");

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

                LogSummary("Phase 2: Fetching lists...");

                var fetcher = new ListFetcher(_httpClient, _jsonSerializer);
                var desiredTagsMap = new Dictionary<Guid, HashSet<string>>();
                var desiredCollectionsMap = new Dictionary<string, HashSet<long>>(StringComparer.OrdinalIgnoreCase);
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

                foreach (var tagConfig in config.Tags)
                {
                    if (string.IsNullOrWhiteSpace(tagConfig.Tag) || !tagConfig.Active) continue;

                    string tagName = tagConfig.Tag.Trim();
                    managedTags.Add(tagName);

                    if (!IsScheduleActive(tagConfig.ActiveIntervals))
                    {
                        if (debug) LogDebug($"Skipping '{tagName}' (Out of schedule).");
                        continue;
                    }

                    string cName = string.IsNullOrWhiteSpace(tagConfig.CollectionName) ? tagName : tagConfig.CollectionName.Trim();
                    if (tagConfig.EnableCollection) activeCollections.Add(cName);

                    try
                    {
                        int effectiveLimit = tagConfig.Limit <= 0 ? 10000 : tagConfig.Limit;
                        var items = await fetcher.FetchItems(tagConfig.Url, effectiveLimit, config.TraktClientId, config.MdblistApiKey, cancellationToken);

                        if (items.Count > 0)
                        {
                            if (items.Count > effectiveLimit) items = items.Take(effectiveLimit).ToList();
                            int matchCount = 0;

                            var blacklist = new HashSet<string>(tagConfig.Blacklist ?? new List<string>(), StringComparer.OrdinalIgnoreCase);

                            foreach (var extItem in items)
                            {
                                if (string.IsNullOrEmpty(extItem.Imdb)) continue;

                                if (blacklist.Contains(extItem.Imdb))
                                {
                                    if (debug) LogDebug($"Skipping '{extItem.Name}' ({extItem.Imdb}) - Item is blacklisted.");
                                    continue;
                                }

                                if (!tagConfig.OnlyCollection)
                                    TagCacheManager.Instance.AddToCache($"imdb_{extItem.Imdb}", tagName);

                                if (imdbLookup.TryGetValue(extItem.Imdb, out var localItems))
                                {
                                    foreach (var localItem in localItems)
                                    {
                                        matchCount++;
                                        if (!tagConfig.OnlyCollection)
                                        {
                                            if (!desiredTagsMap.ContainsKey(localItem.Id))
                                                desiredTagsMap[localItem.Id] = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                                            desiredTagsMap[localItem.Id].Add(tagName);
                                        }

                                        if (tagConfig.EnableCollection)
                                        {
                                            if (!desiredCollectionsMap.ContainsKey(cName))
                                                desiredCollectionsMap[cName] = new HashSet<long>();
                                            desiredCollectionsMap[cName].Add(localItem.InternalId);
                                        }
                                    }
                                }
                            }
                            LogSummary($"   -> [OK] '{tagName}': Matched {matchCount} items.");
                        }
                    }
                    catch (Exception ex)
                    {
                        LogSummary($"Error fetching '{tagName}': {ex.Message}", "Error");
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

                LogSummary("Phase 3: Syncing Tags...");
                int tagsAdded = 0, tagsRemoved = 0;
                foreach (var item in allItems)
                {
                    var existingTags = new HashSet<string>(item.Tags, StringComparer.OrdinalIgnoreCase);
                    var targetTags = desiredTagsMap.ContainsKey(item.Id) ? desiredTagsMap[item.Id] : new HashSet<string>();

                    var toRemove = existingTags.Where(t => managedTags.Contains(t) && !targetTags.Contains(t) && !failedFetches.Contains(t)).ToList();
                    var toAdd = targetTags.Where(t => !existingTags.Contains(t)).ToList();

                    if (toRemove.Count == 0 && toAdd.Count == 0) continue;

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
                LogSummary($"Tags: +{tagsAdded}, -{tagsRemoved}");

                LogSummary("Phase 4: Syncing Collections...");
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
                        if (createdRef != null) LogSummary($"   -> Created Collection '{cName}'.");
                    }
                    else
                    {
                        var currentMembers = _libraryManager.GetItemList(new InternalItemsQuery { CollectionIds = new[] { existingColl.InternalId }, Recursive = true, IsVirtualItem = false }).Select(i => i.InternalId).ToHashSet();
                        var toAdd = desiredIds.Where(id => !currentMembers.Contains(id)).ToList();
                        if (toAdd.Count > 0 && !dryRun)
                        {
                            await _collectionManager.AddToCollection(existingColl.InternalId, toAdd.ToArray());
                            LogSummary($"   -> '{cName}': Added {toAdd.Count} items.");
                        }
                    }
                }

                LogSummary("Phase 5: Cleanup...");
                var toDelete = previouslyManagedCollections.Where(h => !activeCollections.Contains(h)).ToList();
                foreach (var oldName in toDelete)
                {
                    if (failedFetches.Contains(oldName))
                    {
                        LogSummary($"   -> Skipping cleanup of '{oldName}' due to fetch error (Safety).", "Warn");
                        activeCollections.Add(oldName);
                        continue;
                    }

                    var coll = _libraryManager.GetItemList(new InternalItemsQuery { IncludeItemTypes = new[] { "BoxSet" }, Name = oldName, Recursive = true }).FirstOrDefault();
                    if (coll != null && !dryRun)
                    {
                        _libraryManager.DeleteItem(coll, new DeleteOptions { DeleteFileLocation = true });
                        LogSummary($"   -> Deleted '{oldName}' (Not active/scheduled).");
                    }
                }

                if (!dryRun) SaveFileHistory("autotag_collections.txt", activeCollections.ToList());

                progress.Report(100);
                LastRunStatus = (dryRun ? "Dry Run Complete" : "Success") + $" ({DateTime.Now:HH:mm})";
                LogSummary("--- AUTOTAG FINISHED ---");
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
    }
}
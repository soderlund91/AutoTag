using MediaBrowser.Common.Net;
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
        private readonly IHttpClient _httpClient;
        private readonly IJsonSerializer _jsonSerializer;
        private readonly ILogger _logger;

        public static string LastRunStatus { get; private set; } = "Never";
        public static List<string> ExecutionLog { get; } = new List<string>();
        public static bool IsRunning { get; private set; } = false;

        public AutoTagTask(ILibraryManager libraryManager, IHttpClient httpClient, IJsonSerializer jsonSerializer, ILogManager logManager)
        {
            _libraryManager = libraryManager;
            _httpClient = httpClient;
            _jsonSerializer = jsonSerializer;
            _logger = logManager.GetLogger("AutoTag");
        }

        public string Key => "AutoTagSyncTask";
        public string Name => "AutoTag: Sync Tags";
        public string Description => "Syncs tags from MDBList and Trakt based on configuration.";
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
                lock (ExecutionLog)
                {
                    ExecutionLog.Clear();
                }
                LastRunStatus = "Running...";

                var config = Plugin.Instance?.Configuration;
                if (config == null)
                {
                    LastRunStatus = "Failed: Configuration missing";
                    return;
                }

                bool debug = config.ExtendedConsoleOutput;
                bool dryRun = config.DryRunMode;

                LogAndTrace($"--- STARTING AUTOTAG (v{Plugin.Instance.Version}) ---");
                if (dryRun) LogAndTrace("!!! DRY RUN MODE ENABLED - No changes will be saved !!!");

                var fetcher = new ListFetcher(_httpClient, _jsonSerializer);
                var newTagData = new Dictionary<string, List<ExternalItemDto>>();

                var inactiveTags = new List<string>();

                int totalItemsFetched = 0;

                double step = 40.0 / (config.Tags.Count > 0 ? config.Tags.Count : 1);
                double currentProgress = 0;

                LogAndTrace("Phase 1: Fetching data and validating schedules...");

                foreach (var tagConfig in config.Tags)
                {
                    if (!tagConfig.Active || string.IsNullOrWhiteSpace(tagConfig.Tag)) continue;

                    string tagName = tagConfig.Tag.Trim();

                    if (tagConfig.ActiveIntervals != null && tagConfig.ActiveIntervals.Count > 0)
                    {
                        var now = DateTime.Now;
                        bool withinInterval = false;

                        foreach (var interval in tagConfig.ActiveIntervals)
                        {
                            if (interval.Type == "Weekly")
                            {
                                if (!string.IsNullOrEmpty(interval.DayOfWeek) &&
                                    interval.DayOfWeek.IndexOf(now.DayOfWeek.ToString(), StringComparison.OrdinalIgnoreCase) >= 0)
                                {
                                    withinInterval = true;
                                }
                            }
                            else if (interval.Type == "EveryYear")
                            {
                                if (interval.Start.HasValue && interval.End.HasValue)
                                {
                                    var startDate = new DateTime(now.Year, interval.Start.Value.Month, interval.Start.Value.Day);
                                    var endDate = new DateTime(now.Year, interval.End.Value.Month, interval.End.Value.Day);

                                    if (endDate < startDate) endDate = endDate.AddYears(1);

                                    if (now.Date >= startDate.Date && now.Date <= endDate.Date)
                                        withinInterval = true;
                                }
                            }
                            else
                            {
                                if ((!interval.Start.HasValue || now.Date >= interval.Start.Value.Date) &&
                                    (!interval.End.HasValue || now.Date <= interval.End.Value.Date))
                                {
                                    withinInterval = true;
                                }
                            }

                            if (withinInterval) break;
                        }

                        if (!withinInterval)
                        {
                            if (debug) LogAndTrace($"Tag '{tagName}' is out of schedule. Marking for cleanup.");
                            inactiveTags.Add(tagName);
                            continue;
                        }
                    }

                    if (!newTagData.ContainsKey(tagName)) newTagData[tagName] = new List<ExternalItemDto>();

                    try
                    {
                        if (debug) LogAndTrace($"Fetching '{tagName}' from: {tagConfig.Url}");

                        var items = await fetcher.FetchItems(tagConfig.Url, tagConfig.Limit, config.TraktClientId, config.MdblistApiKey, cancellationToken);

                        if (items.Count > 0)
                        {
                            if (items.Count > tagConfig.Limit) items = items.Take(tagConfig.Limit).ToList();
                            newTagData[tagName].AddRange(items);
                            totalItemsFetched += items.Count;
                        }
                    }
                    catch (Exception ex)
                    {
                        LogAndTrace($"Failed to fetch data for '{tagName}': {ex.Message}", "Error");
                    }

                    currentProgress += step;
                    progress.Report(currentProgress);
                }

                if (config.Tags.Any(t => t.Active) && totalItemsFetched == 0 && inactiveTags.Count == 0 && !dryRun)
                {
                    LogAndTrace("CRITICAL: Fetched 0 items and no tags to clean. Aborting sync.", "Error");
                    LastRunStatus = "Failed: No items found";
                    return;
                }

                LogAndTrace($"Phase 2: Updating library. Found {totalItemsFetched} items to tag.");

                TagCacheManager.Instance.Initialize(Plugin.Instance.DataFolderPath, _jsonSerializer);
                TagCacheManager.Instance.ClearCache();

                var currentTags = newTagData.Keys.ToList();
                var previousTags = LoadTagHistory();

                var orphanedTags = previousTags.Except(currentTags, StringComparer.OrdinalIgnoreCase).ToList();
                if (orphanedTags.Count > 0)
                {
                    foreach (var orphan in orphanedTags) CleanUpTag(orphan, debug, dryRun);
                }

                if (inactiveTags.Count > 0)
                {
                    LogAndTrace($"Cleaning up {inactiveTags.Count} scheduled tags that are currently inactive.");
                    foreach (var tag in inactiveTags)
                    {
                        if (!orphanedTags.Contains(tag, StringComparer.OrdinalIgnoreCase))
                        {
                            CleanUpTag(tag, debug, dryRun);
                        }
                    }
                }

                if (!dryRun) SaveTagHistory(currentTags);

                foreach (var tagName in currentTags) CleanUpTag(tagName, debug, dryRun);

                progress.Report(50);
                step = 50.0 / (newTagData.Count > 0 ? newTagData.Count : 1);

                foreach (var tagName in currentTags)
                {
                    var itemsToTag = newTagData[tagName];
                    int addedCount = 0;

                    foreach (var item in itemsToTag)
                    {
                        if (string.IsNullOrEmpty(item.Imdb)) continue;

                        TagCacheManager.Instance.AddToCache($"imdb_{item.Imdb}", tagName);

                        if (MatchAndTag(item, tagName, debug, dryRun)) addedCount++;
                    }

                    if (debug || addedCount > 0)
                    {
                        string prefix = dryRun ? "[DRY RUN] Would have tagged" : "Tagged";
                        LogAndTrace($"    -> {prefix} {addedCount} items with '{tagName}'.");
                    }

                    currentProgress += step;
                    progress.Report(50 + currentProgress);
                }

                if (!dryRun) TagCacheManager.Instance.Save();

                progress.Report(100);
                LastRunStatus = dryRun ? $"Dry Run Finished ({DateTime.Now:HH:mm:ss})" : $"Success ({DateTime.Now:HH:mm:ss})";
                LogAndTrace("--- Finished ---");
            }
            finally
            {
                IsRunning = false;
            }
        }

        private void LogAndTrace(string message, string level = "Info")
        {
            var timestamp = DateTime.Now.ToString("HH:mm:ss");
            var formattedMsg = $"[{timestamp}] [{level}] {message}";

            lock (ExecutionLog)
            {
                ExecutionLog.Add(formattedMsg);
                if (ExecutionLog.Count > 2000) ExecutionLog.RemoveAt(0);
            }

            if (level == "Error") _logger.Error(message);
            else if (level == "Warn") _logger.Warn(message);
            else _logger.Info(message);
        }

        private string GetHistoryFilePath() => Path.Combine(Plugin.Instance.DataFolderPath, "autotag_history.txt");

        private List<string> LoadTagHistory()
        {
            try
            {
                var path = GetHistoryFilePath();
                if (File.Exists(path)) return File.ReadAllLines(path).Select(l => l.Trim()).Where(l => !string.IsNullOrEmpty(l)).ToList();
            }
            catch { }
            return new List<string>();
        }

        private void SaveTagHistory(List<string> tags)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(GetHistoryFilePath()));
                File.WriteAllLines(GetHistoryFilePath(), tags);
            }
            catch { }
        }

        private void CleanUpTag(string tagName, bool debug, bool dryRun)
        {
            var query = new InternalItemsQuery { Recursive = true, Tags = new[] { tagName } };
            var allItems = _libraryManager.GetItemList(query);

            int count = 0;
            foreach (var item in allItems)
            {
                count++;
                if (dryRun) continue;

                var master = _libraryManager.GetItemById(item.Id);
                if (master != null)
                {
                    master.RemoveTag(tagName);
                    _libraryManager.UpdateItem(master, master.Parent, ItemUpdateType.MetadataEdit, null);
                }
            }

            if (count > 0 && debug)
            {
                string prefix = dryRun ? "[DRY RUN] Would remove" : "[CLEANUP] Removed";
                LogAndTrace($"      {prefix} '{tagName}' from {count} items.");
            }
        }

        private bool MatchAndTag(ExternalItemDto extItem, string tagName, bool debug, bool dryRun)
        {
            var target = FindValidItem(new Dictionary<string, string> { { "imdb", extItem.Imdb } });

            if (target != null)
            {
                bool hasTag = target.Tags.Contains(tagName, StringComparer.OrdinalIgnoreCase);

                if (dryRun)
                {
                    if (debug) LogAndTrace($"      [DRY RUN] Would ADD {tagName} -> {target.Name}");
                    return true;
                }

                if (!hasTag)
                {
                    var masterItem = _libraryManager.GetItemById(target.Id);
                    if (masterItem != null)
                    {
                        masterItem.AddTag(tagName);
                        _libraryManager.UpdateItem(masterItem, masterItem.Parent, ItemUpdateType.MetadataEdit, null);
                        if (debug) LogAndTrace($"      [ADD] {tagName} -> {masterItem.Name}");
                        return true;
                    }
                }
            }
            return false;
        }

        private BaseItem? FindValidItem(Dictionary<string, string> ids)
        {
            var results = _libraryManager.GetItemList(new InternalItemsQuery
            {
                IncludeItemTypes = new[] { "Movie", "Series" },
                Recursive = true,
                AnyProviderIdEquals = ids
            });
            return results.FirstOrDefault(i => !i.IsVirtualItem && i.LocationType == LocationType.FileSystem);
        }
    }
}
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
            var config = Plugin.Instance?.Configuration;
            if (config == null) return;

            bool debug = config.ExtendedConsoleOutput;
            bool dryRun = config.DryRunMode;

            _logger.Info($"--- STARTING AUTOTAG (v1.3.1 - Safe Mode) ---");

            var fetcher = new ListFetcher(_httpClient, _jsonSerializer);

            var newTagData = new Dictionary<string, List<ExternalItemDto>>();
            int totalItemsFetched = 0;
            bool anyFetchFailed = false;

            double step = 40.0 / (config.Tags.Count > 0 ? config.Tags.Count : 1);
            double currentProgress = 0;

            _logger.Info("Phase 1: Fetching data from external sources...");

            foreach (var tagConfig in config.Tags)
            {
                if (!tagConfig.Active || string.IsNullOrWhiteSpace(tagConfig.Tag)) continue;

                string tagName = tagConfig.Tag.Trim();
                if (!newTagData.ContainsKey(tagName)) newTagData[tagName] = new List<ExternalItemDto>();

                try
                {
                    if (debug) _logger.Info($"Fetching '{tagName}' from: {tagConfig.Url}");

                    var items = await fetcher.FetchItems(tagConfig.Url, tagConfig.Limit, config.TraktClientId, config.MdblistApiKey, cancellationToken);

                    if (items.Count > 0)
                    {
                        if (items.Count > tagConfig.Limit) items = items.Take(tagConfig.Limit).ToList();
                        newTagData[tagName].AddRange(items);
                        totalItemsFetched += items.Count;
                    }
                    else
                    {
                        if (debug) _logger.Warn($"Source returned 0 items for '{tagName}'.");
                    }
                }
                catch (Exception ex)
                {
                    _logger.Error($"Failed to fetch data for '{tagName}': {ex.Message}");
                    anyFetchFailed = true;
                }

                currentProgress += step;
                progress.Report(currentProgress);
            }

            if (config.Tags.Any(t => t.Active) && totalItemsFetched == 0)
            {
                _logger.Error("CRITICAL: Fetched 0 items from all active sources. Aborting sync to protect existing tags.");
                return;
            }

            if (anyFetchFailed && debug)
            {
                _logger.Warn("Some sources failed to download. Proceeding with the ones that worked.");
            }

            _logger.Info($"Phase 2: Updating library. Found {totalItemsFetched} items to tag.");

            TagCacheManager.Instance.Initialize(Plugin.Instance.DataFolderPath, _jsonSerializer);
            TagCacheManager.Instance.ClearCache();

            var currentTags = newTagData.Keys.ToList();

            var previousTags = LoadTagHistory();
            var orphanedTags = previousTags.Except(currentTags, StringComparer.OrdinalIgnoreCase).ToList();

            if (orphanedTags.Count > 0)
            {
                foreach (var orphan in orphanedTags) CleanUpTag(orphan, debug, dryRun);
            }

            if (!dryRun) SaveTagHistory(currentTags);

            foreach (var tagName in currentTags) CleanUpTag(tagName, debug, dryRun);

            progress.Report(50);
            step = 50.0 / (newTagData.Count > 0 ? newTagData.Count : 1);

            foreach (var tagConfig in config.Tags)
            {
                if (!tagConfig.Active) continue;
                string tagName = tagConfig.Tag.Trim();

                if (!newTagData.ContainsKey(tagName)) continue;
                var itemsToTag = newTagData[tagName];

                var localBlacklist = new HashSet<string>(tagConfig.Blacklist ?? new List<string>(), StringComparer.OrdinalIgnoreCase);
                int addedCount = 0;
                var processedIds = new HashSet<string>();

                foreach (var item in itemsToTag)
                {
                    if (string.IsNullOrEmpty(item.Imdb)) continue;

                    if (localBlacklist.Contains(item.Imdb))
                    {
                        if (debug) _logger.Info($"   [BLACKLIST] Skipped '{item.Name}' ({item.Imdb})");
                        continue;
                    }

                    TagCacheManager.Instance.AddToCache($"imdb_{item.Imdb}", tagName);

                    if (processedIds.Contains(item.Imdb)) continue;
                    processedIds.Add(item.Imdb);

                    if (MatchAndTag(item, tagName, debug, dryRun)) addedCount++;
                }

                if (debug || addedCount > 0)
                    _logger.Info($"    -> Tagged {addedCount} items with '{tagName}'.");

                currentProgress += step;
                progress.Report(50 + currentProgress);
            }

            if (!dryRun) TagCacheManager.Instance.Save();

            progress.Report(100);
            _logger.Info("--- Finished ---");
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
            var query = new InternalItemsQuery { Recursive = true, DtoOptions = new MediaBrowser.Controller.Dto.DtoOptions(true), Tags = new[] { tagName } };
            var allItems = _libraryManager.GetItemList(query);

            int count = 0;
            foreach (var item in allItems)
            {
                if (dryRun) { count++; continue; }

                var master = _libraryManager.GetItemById(item.Id);
                if (master != null && master.Tags.Contains(tagName, StringComparer.OrdinalIgnoreCase))
                {
                    master.RemoveTag(tagName);
                    _libraryManager.UpdateItem(master, master.Parent, ItemUpdateType.MetadataEdit, null);
                    count++;
                }
            }
            if (count > 0 && debug)
            {
                string prefix = dryRun ? "[DRY RUN] Would remove" : "[CLEANUP] Removed";
                _logger.Info($"      {prefix} '{tagName}' from {count} items.");
            }
        }

        private bool MatchAndTag(ExternalItemDto extItem, string tagName, bool debug, bool dryRun)
        {
            BaseItem? target = null;

            if (!string.IsNullOrEmpty(extItem.Imdb))
                target = FindValidItem(new Dictionary<string, string> { { "imdb", extItem.Imdb } });

            if (target != null && !target.Tags.Contains(tagName, StringComparer.OrdinalIgnoreCase))
            {
                if (dryRun)
                {
                    if (debug) _logger.Info($"      [DRY RUN] Would ADD {tagName} -> {target.Name}");
                    return true;
                }

                var masterItem = _libraryManager.GetItemById(target.Id);
                if (masterItem != null)
                {
                    masterItem.AddTag(tagName);
                    _libraryManager.UpdateItem(masterItem, masterItem.Parent, ItemUpdateType.MetadataEdit, null);
                    if (debug) _logger.Info($"      [ADD] {tagName} -> {masterItem.Name}");
                    return true;
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
                AnyProviderIdEquals = ids,
                DtoOptions = new MediaBrowser.Controller.Dto.DtoOptions(true)
            });
            return results.FirstOrDefault(i => !i.IsVirtualItem && i.LocationType == LocationType.FileSystem && !string.IsNullOrEmpty(i.Path));
        }
    }
}
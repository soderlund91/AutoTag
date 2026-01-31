using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Model.Tasks;
using MediaBrowser.Controller.Library;
using MediaBrowser.Common.Net;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Logging;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Model.Querying;
using MediaBrowser.Model.Entities;
using System.IO;

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
            _logger.Info($"--- STARTING AUTOTAG (Memory Edition) ---");

            var currentTags = config.Tags
                .Where(t => !string.IsNullOrWhiteSpace(t.Tag))
                .Select(t => t.Tag.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var previousTags = LoadTagHistory();

            var orphanedTags = previousTags.Except(currentTags, StringComparer.OrdinalIgnoreCase).ToList();

            if (orphanedTags.Count > 0)
            {
                _logger.Info($"[MEMORY] Detected {orphanedTags.Count} deleted tags in configuration. Cleaning up...");
                foreach (var orphan in orphanedTags)
                {
                    CleanUpTag(orphan, debug);
                }
            }

            SaveTagHistory(currentTags);

            progress.Report(5);

            if (debug) _logger.Info($"[PHASE 1] Cleaning up {currentTags.Count} active tags...");

            foreach (var tagName in currentTags)
            {
                CleanUpTag(tagName, debug);
            }
            progress.Report(10);

            _logger.Info($"[PHASE 2 & 3] Fetching lists and applying tags...");

            double step = 90.0 / (config.Tags.Count > 0 ? config.Tags.Count : 1);
            double currentProgress = 10;

            foreach (var tagConfig in config.Tags)
            {
                if (!tagConfig.Active || string.IsNullOrWhiteSpace(tagConfig.Tag))
                {
                    currentProgress += step;
                    continue;
                }

                string tagName = tagConfig.Tag.Trim();
                _logger.Info($"[SOURCE] Processing '{tagName}' from: {tagConfig.Url}");

                try
                {
                    List<ExternalItemDto> itemsFound = new List<ExternalItemDto>();

                    if (tagConfig.Url.Contains("mdblist.com"))
                        itemsFound = await FetchMdblist(tagConfig.Url, config.MdblistApiKey, cancellationToken);
                    else
                        itemsFound = await FetchTrakt(tagConfig.Url, config.TraktClientId, tagConfig.Limit, cancellationToken);

                    if (itemsFound.Count > tagConfig.Limit)
                        itemsFound = itemsFound.Take(tagConfig.Limit).ToList();

                    if (debug) _logger.Info($"    -> Source returned {itemsFound.Count} items.");

                    int addedCount = 0;
                    var processedIds = new HashSet<string>();

                    foreach (var item in itemsFound)
                    {
                        string uid = !string.IsNullOrEmpty(item.Imdb) ? item.Imdb : $"tmdb-{item.Tmdb}";
                        if (processedIds.Contains(uid)) continue;
                        processedIds.Add(uid);

                        if (MatchAndTag(item, tagName, debug))
                            addedCount++;
                    }

                    _logger.Info($"    -> Successfully tagged {addedCount} items.");
                }
                catch (Exception ex)
                {
                    _logger.Error($"Error processing {tagConfig.Url}: {ex.Message}");
                }

                currentProgress += step;
                progress.Report(currentProgress);
            }

            progress.Report(100);
            _logger.Info("--- Finished ---");
        }


        private string GetHistoryFilePath()
        {
            return Path.Combine(Plugin.Instance.DataFolderPath, "autotag_history.txt");
        }

        private List<string> LoadTagHistory()
        {
            try
            {
                var path = GetHistoryFilePath();
                if (File.Exists(path))
                {
                    return File.ReadAllLines(path)
                               .Where(l => !string.IsNullOrWhiteSpace(l))
                               .Select(l => l.Trim())
                               .ToList();
                }
            }
            catch (Exception ex)
            {
                _logger.Error($"Could not load tag history: {ex.Message}");
            }
            return new List<string>();
        }

        private void SaveTagHistory(List<string> tags)
        {
            try
            {
                var path = GetHistoryFilePath();
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                File.WriteAllLines(path, tags);
            }
            catch (Exception ex)
            {
                _logger.Error($"Could not save tag history: {ex.Message}");
            }
        }


        private void CleanUpTag(string tagName, bool debug)
        {
            var query = new InternalItemsQuery
            {
                Recursive = true,
                DtoOptions = new MediaBrowser.Controller.Dto.DtoOptions(true)
            };

            var allItems = _libraryManager.GetItemList(query);
            int count = 0;

            foreach (var item in allItems)
            {
                if (item.Tags.Contains(tagName, StringComparer.OrdinalIgnoreCase))
                {
                    var master = _libraryManager.GetItemById(item.Id);
                    var actualTag = master?.Tags.FirstOrDefault(t => t.Equals(tagName, StringComparison.OrdinalIgnoreCase));

                    if (master != null && actualTag != null)
                    {
                        master.RemoveTag(actualTag);
                        _libraryManager.UpdateItem(master, master.Parent, ItemUpdateType.MetadataEdit, null);
                        count++;
                    }
                }
            }

            if (count > 0 && debug) _logger.Info($"      [CLEANUP] Removed '{tagName}' from {count} items.");
        }

        private bool MatchAndTag(ExternalItemDto extItem, string tagName, bool debug)
        {
            BaseItem? target = null;

            if (!string.IsNullOrEmpty(extItem.Imdb))
                target = FindValidItem(new Dictionary<string, string> { { "imdb", extItem.Imdb } });

            if (target == null && !string.IsNullOrEmpty(extItem.Tmdb))
                target = FindValidItem(new Dictionary<string, string> { { "tmdb", extItem.Tmdb } });

            if (target != null)
            {
                if (!target.Tags.Contains(tagName, StringComparer.OrdinalIgnoreCase))
                {
                    var masterItem = _libraryManager.GetItemById(target.Id);

                    if (masterItem != null && !string.IsNullOrEmpty(masterItem.Path))
                    {
                        masterItem.AddTag(tagName);
                        _libraryManager.UpdateItem(masterItem, masterItem.Parent, ItemUpdateType.MetadataEdit, null);
                        if (debug) _logger.Info($"      [ADD] {tagName} -> {masterItem.Name}");
                        return true;
                    }
                }
            }
            return false;
        }

        private BaseItem? FindValidItem(Dictionary<string, string> ids)
        {
            var query = new InternalItemsQuery
            {
                IncludeItemTypes = new[] { "Movie", "Series" },
                Recursive = true,
                AnyProviderIdEquals = ids,
                DtoOptions = new MediaBrowser.Controller.Dto.DtoOptions(true)
            };

            var results = _libraryManager.GetItemList(query);

            foreach (var item in results)
            {
                if (!item.IsVirtualItem &&
                    item.LocationType == LocationType.FileSystem &&
                    !string.IsNullOrEmpty(item.Path))
                {
                    return item;
                }
            }
            return null;
        }

        private async Task<List<ExternalItemDto>> FetchMdblist(string listUrl, string apiKey, CancellationToken cancellationToken)
        {
            var cleanUrl = listUrl.Trim().TrimEnd('/');
            if (!cleanUrl.EndsWith("/json")) cleanUrl += "/json";
            var apiUrl = $"{cleanUrl}?apikey={apiKey}";
            try
            {
                using (var stream = await _httpClient.Get(new HttpRequestOptions { Url = apiUrl, CancellationToken = cancellationToken }))
                {
                    var result = _jsonSerializer.DeserializeFromStream<List<MdbListItem>>(stream);
                    if (result != null) return result.Select(x => new ExternalItemDto { Name = x.title, Imdb = x.imdb_id, Tmdb = x.id?.ToString() }).ToList();
                }
            }
            catch { }
            return new List<ExternalItemDto>();
        }

        private async Task<List<ExternalItemDto>> FetchTrakt(string rawUrl, string clientId, int limit, CancellationToken cancellationToken)
        {
            string path = rawUrl.Replace("https://trakt.tv", "").Replace("https://api.trakt.tv", "").Trim().Split('?')[0];

            if (path.Contains("?") && path.Split('?').Length > 0)
                path = path.Split('?')[0];

            path = path.Trim();

            if (path.Contains("/users/") && path.Contains("/lists/") && !path.EndsWith("/items"))
            {
                path = path.TrimEnd('/') + "/items";
            }

            if (!path.StartsWith("/")) path = "/" + path;

            var options = new HttpRequestOptions { Url = $"https://api.trakt.tv{path}?limit={limit}", CancellationToken = cancellationToken };

            options.RequestHeaders.Add("trakt-api-version", "2");
            options.RequestHeaders.Add("trakt-api-key", clientId);
            options.UserAgent = "AutoTagPlugin/1.0";
            options.RequestHeaders.Add("Accept", "application/json");

            return await FetchTraktRobust(options);
        }

        private async Task<List<ExternalItemDto>> FetchTraktRobust(HttpRequestOptions options)
        {
            try
            {
                using (var stream = await _httpClient.Get(options))
                using (var reader = new StreamReader(stream))
                {
                    string json = await reader.ReadToEndAsync();
                    var list = new List<ExternalItemDto>();

                    try
                    {
                        var wrappedList = _jsonSerializer.DeserializeFromString<List<TraktBaseObject>>(json);
                        if (wrappedList != null && wrappedList.Any(x => x.movie != null || x.show != null))
                        {
                            foreach (var item in wrappedList)
                            {
                                string? title = item.movie?.title ?? item.show?.title;
                                string? imdb = item.movie?.ids?.imdb ?? item.show?.ids?.imdb;
                                string? tmdb = (item.movie?.ids?.tmdb ?? item.show?.ids?.tmdb)?.ToString();
                                if (!string.IsNullOrEmpty(title)) list.Add(new ExternalItemDto { Name = title, Imdb = imdb, Tmdb = tmdb });
                            }
                            return list;
                        }
                    }
                    catch { }

                    try
                    {
                        var flatList = _jsonSerializer.DeserializeFromString<List<TraktMovie>>(json);
                        if (flatList != null)
                        {
                            foreach (var item in flatList)
                            {
                                if (!string.IsNullOrEmpty(item.title))
                                {
                                    list.Add(new ExternalItemDto { Name = item.title, Imdb = item.ids?.imdb, Tmdb = item.ids?.tmdb?.ToString() });
                                }
                            }
                            if (list.Count > 0) return list;
                        }
                    }
                    catch { }

                    return list;
                }
            }
            catch (Exception ex)
            {
                throw ex;
            }
        }
    }

    public class ExternalItemDto { public string? Name { get; set; } public string? Imdb { get; set; } public string? Tmdb { get; set; } }
    public class MdbListItem { public string? title { get; set; } public string? imdb_id { get; set; } public int? id { get; set; } }

    public class TraktBaseObject { public TraktMovie? movie { get; set; } public TraktShow? show { get; set; } }
    public class TraktMovie { public string? title { get; set; } public TraktIds? ids { get; set; } }
    public class TraktShow { public string? title { get; set; } public TraktIds? ids { get; set; } }
    public class TraktIds { public string? imdb { get; set; } public int? tmdb { get; set; } }
}
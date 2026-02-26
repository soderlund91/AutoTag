using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Logging;
using MediaBrowser.Model.Serialization;
using System.Linq;
using System.Text.Json;

namespace AutoTag
{
    public class ServerEntryPoint : IServerEntryPoint
    {
        private readonly ILibraryManager _libraryManager;
        private readonly ILogger _logger;
        private readonly IJsonSerializer _jsonSerializer;

        public ServerEntryPoint(ILibraryManager libraryManager, ILogManager logManager, IJsonSerializer jsonSerializer)
        {
            _libraryManager = libraryManager;
            _logger = logManager.GetLogger("AutoTag_RealTime");
            _jsonSerializer = jsonSerializer;
        }

        public void Run()
        {
            if (Plugin.Instance == null) return;
            TagCacheManager.Instance.Initialize(Plugin.Instance.DataFolderPath, _jsonSerializer);

            _libraryManager.ItemAdded += OnItemChanged;
            _libraryManager.ItemUpdated += OnItemChanged;
        }

        private void OnItemChanged(object sender, ItemChangeEventArgs e)
        {
            ProcessItem(e.Item);
        }

        private void ProcessItem(BaseItem item)
        {
            if (!(item is MediaBrowser.Controller.Entities.Movies.Movie) && !(item is MediaBrowser.Controller.Entities.TV.Series))
                return;

            if (item.IsVirtualItem) return;

            var ids = item.ProviderIds;
            if (ids == null || ids.Count == 0) return;

            var tagsFound = TagCacheManager.Instance.GetTagsForIds(ids);

            if (tagsFound.Count > 0)
            {
                bool changed = false;
                foreach (var tag in tagsFound)
                {
                    if (!item.Tags.Contains(tag, System.StringComparer.OrdinalIgnoreCase))
                    {
                        item.AddTag(tag);
                        changed = true;
                        _logger.Info($"[Real-Time] Automatically tagged '{item.Name}' with '{tag}'");
                    }
                }

                if (changed)
                {
                    _libraryManager.UpdateItem(item, item.Parent, ItemUpdateType.MetadataEdit, null);
                }
            }
        }

        public void Dispose()
        {
            _libraryManager.ItemAdded -= OnItemChanged;
            _libraryManager.ItemUpdated -= OnItemChanged;
        }
    }
}
using MediaBrowser.Model.Plugins;
using System.Collections.Generic;

namespace AutoTag
{
    public class PluginConfiguration : BasePluginConfiguration
    {
        public string TraktClientId { get; set; } = string.Empty;
        public string MdblistApiKey { get; set; } = string.Empty;
        public bool ExtendedConsoleOutput { get; set; } = false;

        public List<TagConfig> Tags { get; set; } = new List<TagConfig>();
    }

    public class TagConfig
    {
        public bool Active { get; set; } = true;
        public string Tag { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
        public int Limit { get; set; } = 50;
    }
}
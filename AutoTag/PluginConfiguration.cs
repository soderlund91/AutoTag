using MediaBrowser.Model.Plugins;
using System;
using System.Collections.Generic;

namespace AutoTag
{
    public class PluginConfiguration : BasePluginConfiguration
    {
        public string TraktClientId { get; set; } = "";
        public string MdblistApiKey { get; set; } = "";
        public bool ExtendedConsoleOutput { get; set; } = false;
        public bool DryRunMode { get; set; } = false;
        public List<TagConfig> Tags { get; set; } = new List<TagConfig>();
    }

    public class TagConfig
    {
        public bool Active { get; set; } = true;
        public string Tag { get; set; } = "";
        public string Url { get; set; } = "";
        public int Limit { get; set; } = 50;
        public List<string> Blacklist { get; set; } = new List<string>();
        public List<DateInterval> ActiveIntervals { get; set; } = new List<DateInterval>();

        public bool EnableCollection { get; set; } = false;
        public string CollectionName { get; set; } = "";
        public bool OnlyCollection { get; set; } = false;
    }

    public class DateInterval
    {
        public string Type { get; set; } = "SpecificDate";
        public DateTime? Start { get; set; }
        public DateTime? End { get; set; }
        public string DayOfWeek { get; set; } = "Friday";
    }
}
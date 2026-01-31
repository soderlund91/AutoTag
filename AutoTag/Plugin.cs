using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Drawing;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace AutoTag
{
    public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages, IHasThumbImage
    {
        public override string Name => "Auto Tag";

        public override Guid Id => new Guid("E1234567-89AB-CDEF-0123-456789ABCDEF");

        public override string Description => "Automatic tagging system based on Trakt and MDBList.";

        public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
            : base(applicationPaths, xmlSerializer)
        {
            Instance = this;
        }

        public static Plugin? Instance { get; private set; }

        public IEnumerable<PluginPageInfo> GetPages()
        {
            var assembly = GetType().Assembly;

            var htmlPath = assembly.GetManifestResourceNames().FirstOrDefault(r => r.EndsWith("configPage.html"));
            var jsPath = assembly.GetManifestResourceNames().FirstOrDefault(r => r.EndsWith("configPage.js"));

            if (htmlPath == null || jsPath == null)
            {
                return new List<PluginPageInfo>();
            }

            return new[]
            {
                new PluginPageInfo
                {
                    Name = "AutoTag",
                    EmbeddedResourcePath = htmlPath,
                    
                    EnableInMainMenu = true,
                    DisplayName = "AutoTag",
                    MenuIcon = "local_offer"
                },
                new PluginPageInfo
                {
                    Name = "AutoTagJS",
                    EmbeddedResourcePath = jsPath
                }
            };
        }

        public Stream GetThumbImage()
        {
            var type = GetType();
            var thumbPath = type.Assembly.GetManifestResourceNames().FirstOrDefault(r => r.EndsWith("thumb.png"));
            return (thumbPath != null ? type.Assembly.GetManifestResourceStream(thumbPath) : Stream.Null) ?? Stream.Null;
        }

        public ImageFormat ThumbImageFormat => ImageFormat.Png;
    }
}
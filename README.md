<img width="512" height="130" alt="autotag" src="https://github.com/user-attachments/assets/3ae7b44c-12bd-4b61-ad1a-56987e57c110" />

# Emby AutoTag Plugin 🏷️

**AutoTag** is a powerful plugin for Emby Server that automatically manages tags and collections for your Movies and TV Series based on dynamic lists from **Trakt** and **MDBList**.

Stop manually tagging "Trending", "Recommended" content. Let AutoTag keep your library in sync with the world.

Perfect for Emby 4.10+, this plugin pairs perfectly with the new Home Screen management in Emby Server v4.10.0.1+. It allows you to populate your home screen based on Tags instead of cluttering your library with temporary Collections—or go all-in and let the plugin manage your Collections for you!

## 🚀 Key Features

### 🌟 Dynamic Trending, Popular & Personal Lists
Make your library feel alive! AutoTag allows you to maintain dynamic tags that update automatically every day.
* **Trending Now:** Create a tag that always shows what's currently hot worldwide.
* **Your Personal Curations:** Bring your own taste! Sync your personal lists from Trakt or MDBList (e.g., "Best of 80s", "Dad's Favorites") and they will appear as tags on your media.
* **Popular & Top Rated:** Keep a "Best of" list that manages itself.
* **Automagical Sync:** Simply link a URL, and the plugin handles the rest—adding new hits and removing old ones without you lifting a finger.

### 📅 Advanced Scheduling
Make your library dynamic! Set tags and collections to be active only during specific times. AutoTag handles the cleanup automatically.
* **Annual:** Perfect for "Christmas Movies" (e.g., active Dec 1 - Dec 31 every year).
* **Weekly:** Create a "Friday Movie Night" tag that only appears on specific weekdays.
* **Specific Dates:** For one-time events or marathons.
* **Smart Cleanup:** When a tag is "out of season," it is automatically removed from your items.

### 📚 Automated Collection Management (v2.0+)
Let AutoTag be your librarian. Beyond just tagging, the plugin can now manage your Emby Collections.
* **Auto-Create:** If a list is active, AutoTag can automatically create a corresponding Emby Collection.
* **Dynamic Membership:** Items are added to the collection as they enter the list and kept in sync.
* **Only Collection Mode:** Want the collection but don't want the tags on your items? Enable "Disable Item Tagging" to keep your item metadata clean while still enjoying organized collections.
* **Smart Removal:** If you disable a collection or a schedule ends, the plugin **automatically deletes** the collection from Emby to keep your library clutter-free.

### 🔄 True Synchronization
AutoTag doesn't just add tags; it **enforces** them.
* If a movie enters your Trakt list -> **Tag/Collection Added**.
* If a movie *leaves* your Trakt list -> **Tag/Collection Removed**.
* Your library always reflects the current state of the list.

### 🛡️ Safety & Stability
* **Safety Lock:** Prevents you from saving settings or starting a new run while a sync is already in progress to ensure database integrity.
* **Fail-Safe Cleanup:** If a remote list fails to download (network error), the plugin will **skip cleanup** for that specific tag/collection to prevent accidental data loss.
* **Dry Run Mode:** Test your configuration safely in the logs without modifying a single item in your library.
* **Live Logging:** View the execution log directly inside the plugin settings with real-time status updates.

### 🧠 Self-Cleaning Memory
Changed your mind? If you delete a configuration from the settings, AutoTag remembers and **automatically wipes** that tag and/or collection from your entire library on the next run. No manual cleanup required.

---

## 📦 Installation

1. Download the latest `.dll` from the [Releases](../../releases) page.
2. Shut down your Emby Server.
3. Place the `.dll` file in your Emby plugins folder.
4. Start Emby Server.

---

## ⚙️ Configuration

Go to your Emby Dashboard. You will see **Auto Tag** in the sidebar menu.

### 1. API Keys
* **Trakt Client ID:** Required if you use Trakt lists. You can get one for free at [Trakt API](https://trakt.tv/oauth/applications).
* **MDBList API Key:** Required if you use MDBList. Get one for free at [MDBList.com](https://mdblist.com/developer/)

### 2. Managing Sources
The configuration is organized into four intuitive tabs for each source:

#### 🏠 Source Tab
| Setting | Description |
| :--- | :--- |
| **Active** | Toggle to enable/disable this specific source. |
| **Tag Name** | The actual tag applied to your media (e.g., `weekly_trending`). |
| **Limit** | Max number of items to tag/collect from this list (e.g., Top 50). |
| **Source URL** | The URL to the Trakt or MDBList. |

#### 📅 Schedule Tab
| Setting | Description |
| :--- | :--- |
| **Schedule Rule** | Define when this source should be active. |
| *- Specific Date* | Active only between a Start and End date. |
| *- Recurring* | Recurring every year (e.g., Dec 1 - Dec 31). |
| *- Week Days* | Active only on specific days (e.g., Friday & Saturday). |

#### 📚 Collection Tab
| Setting | Description |
| :--- | :--- |
| **Create Collection** | Toggle to automatically maintain an Emby Collection for this list. |
| **Collection Name** | Optional. Set a custom name for the collection (defaults to Tag Name). |
| **Disable Tagging** | If checked, items are added to the collection but **no tags** are added to the media. |

#### 🔧 Advanced Tab
| Setting | Description |
| :--- | :--- |
| **Blacklist** | Comma-separated IMDB IDs to ignore (e.g., `tt1234567`). Useful to filter out specific content. |

---

### 🔗 Supported URL Examples

**Trakt:**
* **Trending Movies:** `https://trakt.tv/movies/trending`
* **Popular Movies:** `https://trakt.tv/movies/popular`
* **Watched (Weekly):** `https://trakt.tv/movies/watched/weekly`
* **User List:** `https://trakt.tv/users/username/lists/my-awesome-list`

**MDBList:**
* **Dynamic List:** `https://mdblist.com/lists/user/listname/`

---

## 🕒 How it works

The plugin creates a Scheduled Task in Emby called **"AutoTag: Sync Tags"**.

* **Default Schedule:** Runs daily at 04:00 AM.
* **Manual Run:** You can run it anytime via the **"Run Full Sync"** button in the plugin settings.

### The Logic Flow
1. **Schedule Validation:** Checks if the rule is active today. If a schedule has ended, the associated tags and collections are **automatically removed**.
2. **Memory Check:** Compares the current config with history to detect deleted rules and perform cleanup.
3. **Fetch & Match:** Downloads the list and matches items via IMDB/TMDB/TVDB IDs.
4. **Enforce:** * Updates tags on library items.
    * Synchronizes Emby Collection memberships.
    * Creates or deletes Collections as needed.

---

## ❓ Troubleshooting

**Q: I disabled "Create Collection", but the collection is still there?**
A: Run the sync task. The plugin will detect that the collection is no longer managed and will remove it for you.

**Q: Why was my collection not deleted even though the schedule ended?**
A: Check your logs. If the plugin failed to connect to MDBList/Trakt during that run, it enters "Safety Mode" and refuses to delete anything until a successful connection is established.

**Q: Does this work with TV Shows?**
A: Yes! It supports both Movies and Series.

---
### Screenshots

<img width="784" height="937" alt="image" src="https://github.com/user-attachments/assets/f17719d8-dfa3-4476-8394-6bdb8a0e3cde" />

<img width="736" height="462" alt="image" src="https://github.com/user-attachments/assets/08739544-631d-4403-84ed-7887c7fa00b2" />
<img width="734" height="606" alt="image" src="https://github.com/user-attachments/assets/1c2bbc23-1c71-4a01-9fff-b902751bcf45" />
<img width="741" height="439" alt="image" src="https://github.com/user-attachments/assets/d09dab50-3d13-454b-9633-85f084470cb5" />
<img width="739" height="317" alt="image" src="https://github.com/user-attachments/assets/809e8e54-2fdc-4bc1-8032-e7472c4a1093" />






---
**Disclaimer:** This plugin is not affiliated with Emby, Trakt, or MDBList.  
This plugin is heavily vibe-coded, tested at my own server but still use at your own risk.



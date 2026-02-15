<img width="512" height="130" alt="autotag" src="https://github.com/user-attachments/assets/3ae7b44c-12bd-4b61-ad1a-56987e57c110" />

# Emby AutoTag Plugin 🏷️

**AutoTag** is a powerful plugin for Emby Server that automatically manages tags for your Movies and TV Series based on dynamic lists from **Trakt** and **MDBList**.

Stop manually tagging "Trending", "Recommended" content. Let AutoTag keep your library in sync with the world.

Perfect for Emby 4.10+, this plugin pairs perfectly with the new Home Screen management in Emby Server v4.10.0.1+. It allows you to populate your home screen based on Tags instead of cluttering your library with temporary Collections.

## 🚀 Key Features

### 🌟 Dynamic Trending, Popular & Personal Lists
Make your library feel alive! AutoTag allows you to maintain dynamic tags that update automatically every day.
* **Trending Now:** Create a tag that always shows what's currently hot worldwide.
* **Your Personal Curations:** Bring your own taste! Sync your personal lists from Trakt or MDBList (e.g., "Best of 80s", "Dad's Favorites") and they will appear as tags on your media.
* **Popular & Top Rated:** Keep a "Best of" list that manages itself.
* **Automagical Sync:** Simply link a URL, and the plugin handles the rest—adding new hits and removing old ones without you lifting a finger.

### 📅 Advanced Scheduling
Make your library dynamic! Set tags to be active only during specific times. AutoTag handles the cleanup automatically.
* **Annual:** Perfect for "Christmas Movies" (e.g., active Dec 1 - Dec 31 every year).
* **Weekly:** Create a "Friday Movie Night" tag that only appears on specific weekdays.
* **Specific Dates:** For one-time events or marathons.
* **Smart Cleanup:** When a tag is "out of season," it is automatically removed from your items.

### 🔄 True Synchronization
AutoTag doesn't just add tags; it **enforces** them.
* If a movie enters your Trakt list -> **Tag Added**.
* If a movie *leaves* your Trakt list -> **Tag Removed**.
* Your library always reflects the current state of the list.

### 🛡️ Safety & Stability
* **Safety Lock:** Prevents you from saving settings or starting a new run while a sync is already in progress to ensure database integrity.
* **Dry Run Mode:** Test your configuration safely in the logs without modifying a single item in your library.
* **Live Logging:** View the execution log directly inside the plugin settings.

### 🧠 Self-Cleaning Memory
Changed your mind? If you delete a tag configuration from the settings, AutoTag remembers and **automatically wipes** that tag from your entire library on the next run. No manual cleanup required.

---

### Screenshots

<img width="514" height="618" alt="screenshot" src="https://github.com/user-attachments/assets/4dcc3f4f-5734-4f64-94e8-80d8f96340d7" />

<img width="375" height="264" alt="tag" src="https://github.com/user-attachments/assets/ae3ac719-490b-403b-aea1-20050e630afe" />

<img width="375" height="383" alt="schedule" src="https://github.com/user-attachments/assets/b5a09c90-f7af-477f-b726-e6cdf5aafe87" />


---

## 📦 Installation

1.  Download the latest `.dll` from the [Releases](../../releases) page.
2.  Shut down your Emby Server.
3.  Place the `.dll` file in your Emby plugins folder.
4.  Start Emby Server.

---

## ⚙️ Configuration

Go to your Emby Dashboard. You will see **Auto Tag** in the sidebar menu.

### 1. API Keys
* **Trakt Client ID:** Required if you use Trakt lists. You can get one for free at [Trakt API](https://trakt.tv/oauth/applications).
* **MDBList API Key:** Required if you use MDBList. Get one for free at  [MDBList.com](https://mdblist.com/developer/)

### 2. Adding Sources
Click **+ Add Source** to create a new sync task. The settings are now organized into two tabs:

#### 🏠 General Tab
| Setting | Description |
| :--- | :--- |
| **Active** | Toggle to enable/disable this source. |
| **Tag Name** | The actual tag applied to your media (e.g., `weekly_trending`). |
| **Limit** | Max number of items to tag from this list (e.g., Top 50). |
| **Source URL** | The URL to the list (see examples below). |

#### 🔧 Advanced Tab
| Setting | Description |
| :--- | :--- |
| **Blacklist** | Comma-separated IMDB IDs to ignore (e.g., `tt1234567`). Useful if a specific movie keeps getting tagged incorrectly. |
| **Schedule** | Add rules for when this tag should be active. |
| *- Specific Date* | Active only between a Start and End date. |
| *- Annual* | Recurring every year (e.g., Dec 1 - Dec 31). Year is ignored. |
| *- Weekly* | Active only on specific days (e.g., Friday & Saturday). |

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
* **Manual Run:** You can run it anytime via *Settings -> Scheduled Tasks -> Library* or directly via the **"Run Full Sync"** button in the plugin settings.

### The Logic Flow
1.  **Schedule Validation:** Checks if the tag is currently active based on your Date/Weekly rules. If not, the tag is **immediately removed** from all items.
2.  **Memory Check:** Detects if you deleted any tags from the config and cleans them up.
3.  **Fetch & Match:** Downloads the list from Trakt/MDBList and matches items via IMDB/TMDB IDs.
4.  **Apply:** Adds the tag to matched items and removes it from items no longer in the list.

---

## ❓ Troubleshooting

**Q: I removed a tag configuration, but the tag is still on my movies?**
A: Run the "AutoTag: Sync Tags" scheduled task one more time. The plugin needs one run to detect the deletion and perform the cleanup.

**Q: My "Christmas" tag disappeared in January.**
A: This is intended behavior if you set an **Annual** schedule for December. The plugin automatically cleans up tags that are "out of season."

**Q: The "Save Settings" button is greyed out.**
A: The Safety Lock is active because a sync is currently running. Wait for the sync to finish or check the logs status.

**Q: Does this work with TV Shows?**
A: Yes! It supports both Movies and Series.

---

**Disclaimer:** This plugin is not affiliated with Emby, Trakt, or MDBList. 
This plugin is heavily vibe-coded, use at your own risk (I always thest new releases).

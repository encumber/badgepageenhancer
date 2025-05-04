// ==UserScript==
// @name         Steam Badge Enhancer with Detailed Data and Crafted Highlight (Adjusted Delays)
// @namespace    http://tampermonkey.net/
// @version      1.2 // Increment version for adjusted delays
// @description  Enhances Steam badges by appending detailed data, including First Completion date and highlighting crafted badges, with adjustable API call delays.
// @author       Your Name
// @match        https://steamcommunity.com/*/badges/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    const STEAMSETS_API_KEY = ''; // Replace with your actual Steamsets API key
    const STEAMSETS_API_URL = 'https://api.steamsets.com/v1/app.listBadges';
    const STEAM_BADGE_INFO_URL = 'https://steamcommunity.com/my/ajaxgetbadgeinfo/';
    const STEAMSETS_API_CALL_DELAY_MS = 800; // 1 second delay before Steamsets API calls
    const STEAM_API_CALL_DELAY_MS = 200; // 200ms delay between Steam's ajaxgetbadgeinfo calls
    // --- End Configuration ---

    // Add some basic styling to ensure consistency and handle the appended content
    GM_addStyle(`


        /* Style for the container holding the appended badge details */
        .enhanced_badge_details_container {
            display: flex;
            flex-wrap: wrap;
            justify-content: center; /* Center the individual badges */
            align-items: flex-start; /* Align items to the top */
            margin-top: 10px; /* Space between original content and new content */
            padding-top: 10px;
            border-top: 1px solid #303030; /* Separator line */
            width: 100%; /* Take full width of the badge row */
        }

        .badge_info_container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 5px 15px; /* Increased horizontal margin (left and right) */
            text-align: center;
            width: 120px; /* Increased width of each badge container */
            flex-shrink: 0; /* Prevent shrinking */
             position: relative; /* Needed for highlight pseudo-element */
        }

        .badge_image {
            width: 64px; /* Adjust image size as needed */
            height: 64px; /* Adjust image size as needed */
            object-fit: contain;
            margin-bottom: 5px;
        }

        .badge_name {
            font-weight: bold;
            margin-bottom: 2px;
            font-size: 0.8em; /* Adjust font size for name */
            /* Added text truncation styles */
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%; /* Ensure it respects the container width */
        }

        .badge_xp, .badge_scarcity, .badge_completion_date, .badge_level_display { /* Added .badge_level_display */
            font-size: 0.8em; /* Adjust font size for these elements */
            color: #8f98a0; /* Adjust secondary text color */
        }

        .badge_completion_date {
             font-size: 0.75em; /* Slightly smaller font for the date */
             white-space: nowrap; /* Prevent wrapping for the date */
             overflow: hidden; /* Hide overflow */
             text-overflow: ellipsis; /* Show ellipsis if still overflows */
             max-width: 100%; /* Ensure it respects the container width */
        }

        /* Style for highlighting the crafted badge */
        .badge_info_container.crafted {
            box-shadow: 0 0 8px 2px rgb(154 155 255 / 50%);
            border: 1px solid #8e8e95;
            padding: 0px 5px 15px 5px;
        }

        /* Optional: Style for the loading indicator */
        .badge_row.is_link.loading .badge_content {
             opacity: 0.5; /* Dim original content while loading */
        }
         .badge_row.is_link .enhanced_badge_details_container.loading::before {
             content: "Loading detailed badge data...";
             color: #8f98a0;
             font-style: italic;
             margin: 10px;
             width: 100%; /* Make the loading text take full width */
             display: block; /* Ensure it's on its own line */
             text-align: center;
         }
    `);

    function extractAppIdFromBadgeLink(badgeRow) {
        const badgeLink = badgeRow.querySelector('a.badge_row_overlay');
        if (badgeLink) {
            const match = badgeLink.href.match(/\/gamecards\/(\d+)\//);
            if (match && match[1]) {
                return parseInt(match[1], 10);
            }
        }

        // Fallback if primary link not found or doesn't have appid
        const badgeImageLink = badgeRow.querySelector('.badge_info_image a'); // Link around the badge image
        if (badgeImageLink) {
            const steamStoreLinkMatch = badgeImageLink.href.match(/\/app\/(\d+)\//);
            if (steamStoreLinkMatch && steamStoreLinkMatch[1]) {
                return parseInt(steamStoreLinkMatch[1], 10);
            }
        }

        return null;
    }

    async function getBadgeData(appId) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: STEAMSETS_API_URL,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${STEAMSETS_API_KEY}`
                },
                data: JSON.stringify({ appId: appId }),
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);

                        if (data && Array.isArray(data.badges)) {
                            console.log(`Successfully fetched Steamsets badge data for appId ${appId}`);
                            resolve(data.badges);
                        } else {
                            console.error(`Steamsets API response for appId ${appId} did not contain a valid 'badges' array. Response data:`, data);
                            resolve([]); // Resolve with empty array if data is not as expected
                        }
                    } catch (e) {
                        console.error(`Error parsing Steamsets API response for appId ${appId}:`, e);
                        resolve([]); // Resolve with empty array on parsing error
                    }
                },
                onerror: function(error) {
                    console.error(`GM_xmlhttpRequest error for appId ${appId}:`, error);
                    resolve([]); // Resolve with empty array on request error
                }
            });
        });
    }

     async function getCraftedBadgeInfo(appId, isFoil = false) {
         return new Promise((resolve, reject) => {
             let url = `${STEAM_BADGE_INFO_URL}${appId}`;
             if (isFoil) {
                 url += '?border=1'; // Add parameter for foil badge info
             }

             GM_xmlhttpRequest({
                 method: 'GET',
                 url: url,
                 onload: function(response) {
                     try {
                         const data = JSON.parse(response.responseText); // Parse the JSON response

                         let craftedLevel = 0;
                         let isCrafted = false;

                         // Check if badgedata and level exist in the JSON response
                         if (data && data.badgedata && typeof data.badgedata.level === 'number') {
                              craftedLevel = data.badgedata.level;
                              // Consider it crafted if the level is greater than 0
                              isCrafted = craftedLevel > 0;
                         }

                         console.log(`Fetched crafted info for appId ${appId} (Foil: ${isFoil}): Crafted Level = ${craftedLevel}, Is Crafted = ${isCrafted}`);

                         // Return the crafted level and whether a badge (at any level) is crafted
                         resolve({ craftedLevel: craftedLevel, isCrafted: isCrafted });

                     } catch (e) {
                         console.error(`Error parsing Steam badge info JSON for appId ${appId} (Foil: ${isFoil}):`, e);
                         resolve({ craftedLevel: 0, isCrafted: false }); // Resolve with default values on error
                     }
                 },
                 onerror: function(error) {
                     console.error(`GM_xmlhttpRequest error fetching Steam badge info for appId ${appId} (Foil: ${isFoil}):`, error);
                     resolve({ craftedLevel: 0, isCrafted: false }); // Resolve with default values on error
                 }
             });
         });
     }


    // Helper function for introducing a delay
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

     // Helper function to format date for display
     function formatDateForDisplay(dateString) {
         try {
             const date = new Date(dateString);
             if (isNaN(date.getTime())) {
                 return 'Date unavailable';
             }

             const options = {
                 month: 'short', // 'Jan', 'Feb', etc.
                 day: 'numeric',
                 year: 'numeric',
                 hour: 'numeric', // 12-hour format
                 minute: 'numeric',
                 hour12: true // Use 12-hour format with AM/PM
             };

             // Use locale-specific formatting, then replace commas for the desired format
             let formatted = date.toLocaleString(undefined, options);

             // The default toLocaleString with 'short' month and numeric day/year
             // often results in "Month Day, Year, HH:MM AM/PM".
             // We'll return this format directly.

             return formatted;

         } catch (e) {
             console.error("Error formatting date:", e);
             return 'Date Formatting Error';
         }
     }


    async function processBadges() {
        const allBadgeRows = document.querySelectorAll('.badge_row.is_link');
        const badgeRowsByAppId = new Map(); // Map to store badge rows grouped by App ID

        // Group badge rows by App ID
        allBadgeRows.forEach(badgeRow => {
            const appId = extractAppIdFromBadgeLink(badgeRow);
            if (appId) {
                if (!badgeRowsByAppId.has(appId)) {
                    badgeRowsByAppId.set(appId, []);
                }
                badgeRowsByAppId.get(appId).push(badgeRow);
            }
        });

        // Process each unique App ID
        for (const [appId, rowsForApp] of badgeRowsByAppId.entries()) {
            // Add loading indicator to all rows for this App ID
            rowsForApp.forEach(badgeRow => {
                 const enhancedBadgeDetailsContainer = document.createElement('div');
                 enhancedBadgeDetailsContainer.classList.add('enhanced_badge_details_container', 'loading');
                 badgeRow.appendChild(enhancedBadgeDetailsContainer);
            });

            // --- Fetch Steamsets data with 1-second delay ---
            await delay(STEAMSETS_API_CALL_DELAY_MS);
            const badgeData = await getBadgeData(appId);

            // --- Fetch Crafted Badge Info (Normal) with shorter delay ---
             await delay(STEAM_API_CALL_DELAY_MS);
             const craftedNormalInfo = await getCraftedBadgeInfo(appId, false);

             // --- Fetch Crafted Badge Info (Foil) with shorter delay ---
             await delay(STEAM_API_CALL_DELAY_MS);
             const craftedFoilInfo = await getCraftedBadgeInfo(appId, true);


            // Remove loading indicator from all rows for this App ID
             rowsForApp.forEach(badgeRow => {
                 const loadingContainer = badgeRow.querySelector('.enhanced_badge_details_container.loading');
                 if(loadingContainer) {
                     loadingContainer.classList.remove('loading');
                     loadingContainer.innerHTML = ''; // Clear placeholder text/styles
                 }
             });


            if (badgeData.length > 0) {
                // Sort badges: Levels 1-5 (non-foil) then Foil
                const sortedBadges = badgeData.sort((a, b) => {
                    if (a.isFoil === b.isFoil) {
                        return a.baseLevel - b.baseLevel; // Sort by level if same foil status
                    }
                    return a.isFoil ? 1 : -1; // Foil comes after non-foil
                });

                // Create the HTML content for the detailed badges once
                const detailedBadgesHtml = sortedBadges.map(badge => {
                    const formattedCompletionDate = badge.firstCompletion ? formatDateForDisplay(badge.firstCompletion) : 'Date unavailable';

                    // Determine if this badge level should be highlighted
                    let isCraftedHighlight = false;
                    if (!badge.isFoil && craftedNormalInfo.isCrafted && craftedNormalInfo.craftedLevel === badge.baseLevel) {
                        isCraftedHighlight = true;
                    } else if (badge.isFoil && craftedFoilInfo.isCrafted && craftedFoilInfo.craftedLevel === badge.baseLevel) {
                         isCraftedHighlight = true;
                    }

                    // Add 'crafted' class if it needs highlighting
                    const containerClass = isCraftedHighlight ? 'badge_info_container crafted' : 'badge_info_container';

                    return `
                        <div class="${containerClass}">
                            <div class="badge_name" title="${badge.name}">${badge.name}</div>
                            <img class="badge_image" src="https://cdn.fastly.steamstatic.com/steamcommunity/public/images/items/${appId}/${badge.badgeImage}" alt="${badge.name}">
                            <div class="badge_completion_date">${formattedCompletionDate}</div> <!-- Added First Completion Date -->
                            <div class="badge_scarcity">Scarcity: ${badge.scarcity}</div>
                            <div class="badge_level_display">Level: ${badge.baseLevel}${badge.isFoil ? ' (Foil)' : ''}</div> <!-- Added Level Display -->
                        </div>
                    `;
                }).join(''); // Join the array of HTML strings into a single string

                // Append the created HTML content to *all* relevant badge rows for this App ID
                rowsForApp.forEach(badgeRow => {
                     const container = badgeRow.querySelector('.enhanced_badge_details_container');
                     if (container) {
                         container.innerHTML = detailedBadgesHtml; // Set the innerHTML of the specific container
                     }
                });

            } else {
                 console.log(`No detailed badge data found for appId ${appId}. Displaying "No data available".`);
                 // Display a message in all relevant rows if no data was found
                 rowsForApp.forEach(badgeRow => {
                      const container = badgeRow.querySelector('.enhanced_badge_details_container');
                      if (container) {
                          const noDataMessage = document.createElement('div');
                          noDataMessage.textContent = `No detailed badge data available for this game (App ID: ${appId}).`;
                          noDataMessage.style.color = '#8f98a0';
                          noDataMessage.style.margin = '10px auto'; // Center the message
                          container.appendChild(noDataMessage);
                      }
                 });
            }
        }
    }


    // Run the processing function when the page is loaded
    window.addEventListener('load', processBadges);

})();

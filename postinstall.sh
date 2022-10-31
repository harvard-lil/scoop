#-------------------------------------------------------------------------------
# Post-install script
#-------------------------------------------------------------------------------

# System-wide Playwright install / update of Playwright
npm i -D playwright;

# Pull yt-dlp (2022.10.04 version)
mkdir ./node_modules/yt-dlp/;
curl -L https://github.com/yt-dlp/yt-dlp/releases/download/2022.10.04/yt-dlp > ./node_modules/yt-dlp/yt-dlp;
chmod a+x ./node_modules/yt-dlp/yt-dlp;
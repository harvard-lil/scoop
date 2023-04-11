#-------------------------------------------------------------------------------
# Post-install script
#-------------------------------------------------------------------------------
mkdir ./executables/;

# Pull yt-dlp (v2023.03.04)
curl -L https://github.com/yt-dlp/yt-dlp/releases/download/2023.03.04/yt-dlp > ./executables/yt-dlp;
chmod a+x ./executables/yt-dlp;

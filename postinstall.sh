#-------------------------------------------------------------------------------
# Post-install script
#-------------------------------------------------------------------------------
# Pull yt-dlp (2023.01.02 version)
mkdir ./executables/;
curl -L https://github.com/yt-dlp/yt-dlp/releases/download/2023.01.02/yt-dlp > ./executables/yt-dlp;
chmod a+x ./executables/yt-dlp;

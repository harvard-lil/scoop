#-------------------------------------------------------------------------------
# Post-install script
#-------------------------------------------------------------------------------

# Pull yt-dlp (2022.11.11 version)
mkdir ./executables/;
curl -L https://github.com/yt-dlp/yt-dlp/releases/download/2022.11.11/yt-dlp > ./executables/yt-dlp;
chmod a+x ./executables/yt-dlp;

# Create tmp directory
mkdir ./tmp/;

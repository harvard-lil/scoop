#-------------------------------------------------------------------------------
# Post-install script
#-------------------------------------------------------------------------------
mkdir ./executables/;

# Pull yt-dlp (v2024.12.23)
curl -L https://github.com/yt-dlp/yt-dlp/releases/download/2024.12.23/yt-dlp > ./executables/yt-dlp;
chmod a+x ./executables/yt-dlp;

# Pull crip (v2.1.0)
if [ "$(uname)" == "Darwin" ]; then
    curl -L https://github.com/Hakky54/certificate-ripper/releases/download/2.1.0/crip-macos-amd64.tar.gz > ./executables/crip.tar.gz;
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
    if [ "$(uname -m)" == "aarch64" ]; then
        curl -L https://github.com/Hakky54/certificate-ripper/releases/download/2.1.0/crip-linux-aarch64.tar.gz > ./executables/crip.tar.gz;
    else
        curl -L https://github.com/Hakky54/certificate-ripper/releases/download/2.1.0/crip-linux-amd64.tar.gz > ./executables/crip.tar.gz;
    fi
fi

cd ./executables;
tar -xzvf crip.tar.gz;
chmod a+x crip;
rm crip.tar.gz;
cd ..;

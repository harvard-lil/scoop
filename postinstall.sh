#-------------------------------------------------------------------------------
# Post-install script
#-------------------------------------------------------------------------------
set -eu

mkdir -p ./executables/;

# Pull yt-dlp (v2026.08.19) and verify its upstream SHA-256.
curl --fail --location --proto '=https' --tlsv1.2 https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp > ./executables/yt-dlp;
if command -v sha256sum >/dev/null 2>&1; then
    printf '%s  %s\n' '1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6' './executables/yt-dlp' | sha256sum -c -;
elif command -v shasum >/dev/null 2>&1; then
    printf '%s  %s\n' '1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6' './executables/yt-dlp' | shasum -a 256 -c -;
else
    echo 'A SHA-256 verification tool (sha256sum or shasum) is required.' >&2;
    exit 1;
fi
chmod a+x ./executables/yt-dlp;

# Pull crip (v2.1.0) and verify the selected upstream release artifact.
if [ "$(uname)" == "Darwin" ]; then
    CRIP_URL='https://github.com/Hakky54/certificate-ripper/releases/download/2.1.0/crip-macos-amd64.tar.gz';
    CRIP_SHA256='74ab3a37b1c23784871fd3dbfbff2afc014f9ce1f6831c61b829e293d493e24e';
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
    if [ "$(uname -m)" == "aarch64" ]; then
        CRIP_URL='https://github.com/Hakky54/certificate-ripper/releases/download/2.1.0/crip-linux-aarch64.tar.gz';
        CRIP_SHA256='b72867b24d3d2c7fd9811c7d7486a1a43334412339f004eac52ebc2dc5b93509';
    else
        CRIP_URL='https://github.com/Hakky54/certificate-ripper/releases/download/2.1.0/crip-linux-amd64.tar.gz';
        CRIP_SHA256='a857e35e2f4adc8b424a14353e39fa7a1b3e19a4f1359b198944abf908296c8c';
    fi
fi

curl --fail --location --proto '=https' --tlsv1.2 "$CRIP_URL" > ./executables/crip.tar.gz;
if command -v sha256sum >/dev/null 2>&1; then
    printf '%s  %s\n' "$CRIP_SHA256" './executables/crip.tar.gz' | sha256sum -c -;
elif command -v shasum >/dev/null 2>&1; then
    printf '%s  %s\n' "$CRIP_SHA256" './executables/crip.tar.gz' | shasum -a 256 -c -;
else
    echo 'A SHA-256 verification tool (sha256sum or shasum) is required.' >&2;
    exit 1;
fi

cd ./executables;
tar -xzvf crip.tar.gz;
chmod a+x crip;
rm crip.tar.gz;
cd ..;

#!/bin/bash

# check for mkcert
if ! command -v mkcert &> /dev/null
then
    echo "mkcert must be installed -- see https://github.com/FiloSottile/mkcert"
    exit 1
fi

# make and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# install requirements
pip install -r requirements.txt

# make cert
rm -f cert.pem key.pem fullchain.pem

mkcert -cert-file cert.pem -key-file key.pem example.org

cp cert.pem fullchain.pem

CAROOT=$(mkcert -CAROOT)

cat "$CAROOT/rootCA.pem" >> fullchain.pem

CERT_ROOTS=`openssl x509 -noout -in "$CAROOT"/rootCA.pem -fingerprint -sha256 | cut -f 2 -d '=' | sed 's/://g' | awk '{print tolower($0)}'`

cat <<EOF > .env
DOMAIN=example.org
CERTFILE=fullchain.pem
KEYFILE=key.pem
CERT_ROOTS=$CERT_ROOTS
EOF

# run service
flask --app app run

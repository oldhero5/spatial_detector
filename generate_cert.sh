#!/bin/bash

# Generate a proper certificate for local development

echo "Generating local development certificate..."

# Get local IP address
LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
echo "Local IP: $LOCAL_IP"

# Create certificate config
cat > cert.conf <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C=US
ST=State
L=City
O=Spatial Detector Dev
OU=Development
CN=localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = $LOCAL_IP
EOF

# Generate private key
openssl genrsa -out key.pem 2048

# Generate certificate
openssl req -new -x509 -sha256 -key key.pem -out cert.pem -days 365 -config cert.conf

# Create a p12 file for easy import to Keychain
openssl pkcs12 -export -out cert.p12 -inkey key.pem -in cert.pem -passout pass:

echo ""
echo "Certificate generated successfully!"
echo ""
echo "To add to macOS Keychain (for Safari):"
echo "1. Double-click cert.p12 in Finder"
echo "2. Add to login keychain"
echo "3. Open Keychain Access"
echo "4. Find 'localhost' certificate"
echo "5. Double-click it"
echo "6. Expand 'Trust' section"
echo "7. Set 'When using this certificate' to 'Always Trust'"
echo ""
echo "Or run: security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain cert.pem"
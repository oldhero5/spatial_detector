#!/usr/bin/env python3
"""Run the web server with HTTPS for camera access"""

import ssl

from spatial_detector.web.server import WebServer


def main():
    # Create SSL context for HTTPS
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)

    # Generate self-signed certificate (for development only)
    import os

    cert_file = "cert.pem"
    key_file = "key.pem"

    if not os.path.exists(cert_file) or not os.path.exists(key_file):
        print("Generating self-signed certificate...")
        os.system(
            f'openssl req -x509 -newkey rsa:4096 -nodes -out {cert_file} -keyout {key_file} -days 365 -subj "/CN=localhost"'
        )

    context.load_cert_chain(cert_file, key_file)

    # Start server with HTTPS
    server = WebServer()
    print("Starting HTTPS server on https://localhost:5011")
    print("Note: You'll need to accept the self-signed certificate in your browser")

    server.socketio.run(
        server.app,
        host="0.0.0.0",
        port=5011,
        ssl_context=context,
        debug=True,
        allow_unsafe_werkzeug=True,
    )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Run the web server on localhost (HTTP is fine for localhost)"""

from spatial_detector.web.server import WebServer

def main():
    # Start server without HTTPS on localhost
    server = WebServer(host="127.0.0.1", port=5011)
    print(f"Starting server on http://localhost:5011")
    print("Note: Camera access works on localhost even without HTTPS")
    server.start()

if __name__ == "__main__":
    main()
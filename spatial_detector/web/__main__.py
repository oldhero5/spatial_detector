"""
Main entry point for the Spatial Detector web interface
"""

import argparse
import sys

from spatial_detector.web.server import WebServer


def main():
    """Command-line entry point for the web server"""
    parser = argparse.ArgumentParser(description="Spatial Detector Web Interface")
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host address to bind the server (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=5011,
        help="Port to run the server on (default: 5011)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Run in debug mode",
    )
    parser.add_argument(
        "--templates",
        type=str,
        help="Custom template directory path",
    )
    parser.add_argument(
        "--static",
        type=str,
        help="Custom static files directory path",
    )

    args = parser.parse_args()

    try:
        server = WebServer(
            host=args.host,
            port=args.port,
            static_folder=args.static,
            template_folder=args.templates,
        )
        print(
            f"Starting Spatial Detector Web Interface on http://{args.host}:{args.port}"
        )
        print("Press Ctrl+C to exit")
        server.start()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        if hasattr(server, "shutdown"):
            server.shutdown()
        sys.exit(0)
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

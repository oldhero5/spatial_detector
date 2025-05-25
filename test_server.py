#!/usr/bin/env python3
"""Simple test script to verify server functionality"""

import subprocess
import sys
import time

import requests


def test_server():
    """Test the web server functionality"""
    print("Starting web server...")

    # Start the server
    server_process = subprocess.Popen(
        [sys.executable, "-m", "spatial_detector.web"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    # Give server time to start
    print("Waiting for server to start...")
    time.sleep(5)

    try:
        # Test if server is running
        response = requests.get("http://localhost:5011/api/status")
        if response.status_code == 200:
            print("✓ Server is running")
            status = response.json()
            print(f"  Status: {status.get('status')}")
            print(f"  Detector ready: {status.get('detector_ready')}")
            print(f"  Depth ready: {status.get('depth_ready')}")
        else:
            print("✗ Server returned error:", response.status_code)
    except Exception as e:
        print("✗ Could not connect to server:", e)

    # Terminate server
    print("\nStopping server...")
    server_process.terminate()
    server_process.wait()

    print("Test complete!")


if __name__ == "__main__":
    test_server()

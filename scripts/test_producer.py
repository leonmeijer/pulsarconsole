#!/usr/bin/env python3
"""Test producer script to generate messages for dashboard testing."""

import os
import time
import json
import asyncio
from datetime import datetime

try:
    import pulsar
except ImportError:
    print("Installing pulsar-client...")
    import subprocess
    subprocess.check_call(["pip", "install", "pulsar-client"])
    import pulsar


def produce_messages():
    """Produce messages at ~10 per second.

    Environment variables:
        PULSAR_SERVICE_URL: Pulsar broker URL (e.g., pulsar://localhost:6650)
        PULSAR_AUTH_TOKEN: JWT authentication token for Pulsar

    Example usage:
        export PULSAR_SERVICE_URL="pulsar://localhost:6650"
        export PULSAR_AUTH_TOKEN="your-jwt-token-here"
        python test_producer.py

    Or with bws (Bitwarden Secrets Manager):
        bws run -- python test_producer.py
    """

    # Connection settings from environment variables
    service_url = os.environ.get("PULSAR_SERVICE_URL")
    token = os.environ.get("PULSAR_AUTH_TOKEN")
    topic = "persistent://public/default/test-metrics"

    # Validate required environment variables
    if not service_url:
        raise ValueError(
            "PULSAR_SERVICE_URL environment variable is required. "
            "Example: export PULSAR_SERVICE_URL='pulsar://localhost:6650'"
        )
    if not token:
        raise ValueError(
            "PULSAR_AUTH_TOKEN environment variable is required. "
            "Set this to your Pulsar JWT authentication token."
        )

    print(f"Connecting to {service_url}...")

    # Create client with authentication
    client = pulsar.Client(
        service_url,
        authentication=pulsar.AuthenticationToken(token)
    )

    # Create producer
    producer = client.create_producer(topic)
    print(f"Connected! Producing to {topic}")
    print("Press Ctrl+C to stop\n")

    message_count = 0
    start_time = time.time()

    try:
        while True:
            # Create message payload
            payload = {
                "id": message_count,
                "timestamp": datetime.now().isoformat(),
                "data": f"Test message {message_count}",
                "value": message_count % 100
            }

            # Send message
            producer.send(json.dumps(payload).encode('utf-8'))
            message_count += 1

            # Print progress every 10 messages
            if message_count % 10 == 0:
                elapsed = time.time() - start_time
                rate = message_count / elapsed
                print(f"Sent {message_count} messages ({rate:.1f} msg/s)")

            # Sleep to maintain ~10 messages per second
            time.sleep(0.1)

    except KeyboardInterrupt:
        print(f"\n\nStopped. Total messages sent: {message_count}")
        elapsed = time.time() - start_time
        print(f"Average rate: {message_count / elapsed:.1f} msg/s")
    finally:
        producer.close()
        client.close()


if __name__ == "__main__":
    produce_messages()

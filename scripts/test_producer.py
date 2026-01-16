#!/usr/bin/env python3
"""Test producer script to generate messages for dashboard testing."""

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
    """Produce messages at ~10 per second."""

    # Connection settings
    service_url = "pulsar://192.168.30.41:30650"
    token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJwdWxzYXItY29uc29sZSJ9.ihedkW6-9esrSdGkbkq1kEA-iP-wfq6AwzXRwcuT050"
    topic = "persistent://public/default/test-metrics"

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

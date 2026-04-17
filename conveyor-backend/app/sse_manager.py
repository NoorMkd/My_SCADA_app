# ============================================================
# sse_manager.py
# Manages all live connections to React browsers.
#
# How it works:
#   - Each React browser tab that opens GET /api/stream
#     gets its own personal "queue" (like a mailbox)
#   - When ESP32 data arrives → we put it in EVERY mailbox
#   - Each browser tab reads from its own mailbox and
#     displays the new data immediately
#
# A "queue" is just a list that works safely across
# multiple async tasks at the same time.
# ============================================================

import asyncio
import json
from typing import AsyncGenerator


class SSEManager:
    """
    The central hub that distributes live sensor data
    to all connected React browser tabs.
    """

    def __init__(self):
        # List of all active queues
        # One queue = one connected React browser tab
        self._queues: list[asyncio.Queue] = []

    def _add_client(self) -> asyncio.Queue:
        """
        Called when a new React tab connects.
        Creates a personal queue for that tab and
        registers it so it receives future broadcasts.
        """
        # maxsize=10 means: hold max 10 unread messages
        # If a tab is too slow → old messages are dropped
        queue: asyncio.Queue = asyncio.Queue(maxsize=10)
        self._queues.append(queue)
        print(f"[SSE] New client connected — total: {len(self._queues)}")
        return queue

    def _remove_client(self, queue: asyncio.Queue):
        """
        Called when a React tab disconnects
        (user closes tab, refreshes, navigates away).
        Removes its queue so we stop sending to it.
        """
        if queue in self._queues:
            self._queues.remove(queue)
            print(f"[SSE] Client disconnected — total: {len(self._queues)}")

    async def broadcast(self, data: dict):
        """
        Sends data to EVERY connected React tab.
        Called by mqtt_handler every time ESP32 sends data.

        If a tab's queue is full (slow connection) → skip it.
        We never block waiting for a slow client.
        """
        dead_queues = []

        for queue in self._queues:
            try:
                # put_nowait = add to queue without waiting
                # Raises QueueFull if the queue is full
                queue.put_nowait(data)
            except asyncio.QueueFull:
                # This tab is too slow — mark for removal
                dead_queues.append(queue)

        # Clean up slow/dead connections
        for queue in dead_queues:
            self._remove_client(queue)

    async def stream(self) -> AsyncGenerator[str, None]:
        """
        The actual SSE stream for one React tab.
        This function runs forever (until tab disconnects).

        SSE format that browsers understand:
            data: {"speed": 48.5, "temperature": 52.3, ...}\n\n

        The \n\n at the end is required by the SSE standard.
        The browser splits on \n\n to get each message.
        """
        queue = self._add_client()

        try:
            while True:
                try:
                    # Wait up to 30 seconds for new data
                    # timeout=30 means: if no ESP32 data for
                    # 30 seconds, send a keepalive ping
                    data = await asyncio.wait_for(
                        queue.get(),
                        timeout=30.0
                    )

                    # Convert dict to JSON string and send
                    # This is the message React receives
                    yield f"data: {json.dumps(data)}\n\n"

                except asyncio.TimeoutError:
                    # No data for 30 seconds
                    # Send a comment line to keep connection alive
                    # Browsers close SSE connections after ~45s of silence
                    # This prevents that
                    yield ": keepalive\n\n"

        except asyncio.CancelledError:
            # React tab was closed or navigated away
            # Clean up this client's queue
            self._remove_client(queue)


# ── Single shared instance ────────────────────────────────────
# This is the ONE SSEManager used by the entire app.
# mqtt_handler imports this to call broadcast()
# routers/sensors.py imports this to call stream()
#
# Usage:
#   from app.sse_manager import sse_manager
#   await sse_manager.broadcast(data)     # in mqtt_handler
#   sse_manager.stream()                  # in router
sse_manager = SSEManager()
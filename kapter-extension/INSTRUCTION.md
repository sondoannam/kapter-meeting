# Kapter Extension: Capture Client

## Overview

The **Kapter Extension** is a core component of the Kapter 2.0 AI Meeting Assistant. It serves as the primary data ingestion point (the "Capture Client"), responsible for capturing high-quality audio directly from Google Meet sessions and transmitting it to the backend for processing.

## Core Responsibilities

- **Audio Capture**: Captures synchronized audio from the Google Meet tab (system sound) and the user's microphone.
- **Real-time Streaming**: Encodes audio into chunks and streams them via WebSockets to the Kapter Backend.
- **Session Control**: Provides a user interface (Widget and Popup) for starting, monitoring, and stopping meeting recordings.
- **State Management**: Orchestrates the meeting state across multiple browser components (Content Script, Popup, and Background Service Worker).

## Architectural Design

The extension is built using **React** and **TypeScript**, following the **Chrome Extension Manifest V3** standard.

### Key Components:

1. **Background Service Worker**: The central orchestrator. It manages the lifecycle of the recording session and coordinates messages between the Popup, Content Script, and Offscreen Document.
2. **Offscreen Document**: Since Manifest V3 service workers cannot access DOM APIs needed for live audio processing, this hidden document is spawned to handle capture, PCM encoding, and WebSocket transmission.
3. **Content Script (Widget)**: Injects a floating control panel directly into the Google Meet interface, providing a seamless user experience.
4. **Popup**: Provides a quick way for users to check status, manage settings, and manually control recordings without opening the meeting tab.

## Data Flow

1. User clicks **Start Recording** on the Widget or Popup.
2. Background Worker spawns an **Offscreen Document**.
3. Offscreen Document requests a stream via `chrome.tabCapture`.
4. Audio is downmixed and encoded into **raw PCM s16le** chunks.
5. Chunks are sent every **2 seconds** over a **WebSocket** connection to the NestJS Gateway.
6. Upon **Stop**, the session is finalized, and the user is redirected to the Web App Dashboard for review.

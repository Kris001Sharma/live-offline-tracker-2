# Mobile Application

This document outlines the architecture, layout, and implementation guidelines for the worker mobile application.

## Native Android Diagnostic Requirement

The application is an Android-native application.

Browser developer-console output must therefore **not** be considered the primary diagnostic mechanism for device-level runtime investigation.

For significant native workflows, device-observable structured diagnostics must be available.

This requirement applies particularly to:
- authentication;
- connectivity;
- SQLite persistence;
- device identity;
- trusted-device verification;
- registration;
- synchronization;
- background execution;
- native lifecycle;
- permissions;
- offline/online transitions.

Diagnostics should allow engineers to establish, where relevant:
- workflow start and completion;
- lifecycle ordering;
- current state;
- relevant non-sensitive identifiers;
- persistence/write outcome;
- persistence/read-back outcome;
- domain mapping outcome;
- remote request outcome;
- synchronization outcome;
- authoritative decision;
- exact failure boundary;
- error category and cause.

Diagnostics must be structured and useful on a physical Android device.

Do not expose:
- passwords;
- authentication tokens;
- secrets;
- private keys;
- unnecessary personal data;
- sensitive production data.

Clearly distinguish:
- development diagnostics;
- validation/investigation diagnostics;
- meaningful production error logging.

Temporary investigation instrumentation must be removed after the investigation unless its production value has been explicitly established.

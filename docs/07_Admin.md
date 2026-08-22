# Admin Dashboard

This document details the features, components, and interface design of the administration and route playback web portal.

## Administrative Web Access — Architecture Constraint Only

The system requires a future web-based administrative access path for system administrators who primarily use the system for:
- monitoring;
- analytics;
- administration;
- reporting;
- operational oversight.

The architecture must distinguish:

### Worker access
Worker operational access remains subject to the existing:
`Authentication → Trusted Device Verification → Worker Application`
flow.

### Administrative access
Administrative web access must have its own explicitly defined:
`Authentication → Authorization → Administrative Web Application`
flow.

The administrative path must NOT be implemented as a Trusted Device bypass.

Specifically, administrator web access must not:
- create worker trusted-device records;
- modify worker trusted-device state;
- mark administrator browsers as worker trusted devices;
- weaken worker device verification;
- alter trusted-device authority rules;
- change worker offline authorization;
- introduce privilege escalation.

The same human identity may eventually possess both administrative and worker capabilities, but those capabilities must remain explicitly separated at the access-control level.

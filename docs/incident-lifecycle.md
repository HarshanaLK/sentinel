# Incident lifecycle

```text
signal breach -> open -> acknowledged -> resolved
                 ^                   |
                 |---- de-dupe ------|
```

Signals come from threshold rules, SLO evaluation, or anomaly scoring. A fingerprint is stable for the same logical signal, so repeated worker ticks update the existing unresolved incident rather than flooding operators.

Acknowledgement and resolution are explicit operator actions and append timeline events. A newly observed breach after resolution creates a new incident because the partial unique index only protects unresolved fingerprints.
